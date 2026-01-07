-- Agile module schema, defaults, and RLS

-- Status columns drive the Kanban board
create table if not exists public.agile_statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  position integer not null default 0,
  color text default 'sky',
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

-- Roadmap buckets (e.g., Now / Next / Later)
create table if not exists public.agile_roadmap_buckets (
  id text primary key,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Core work items
create table if not exists public.agile_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status_id uuid references public.agile_statuses(id) on delete set null,
  estimate integer,
  owner_id uuid references public.users(id),
  owner_name text,
  tags text[] default '{}'::text[],
  roadmap_bucket text references public.agile_roadmap_buckets(id) on delete set null,
  ordering integer not null default 0,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agile_issues_status_idx on public.agile_issues(status_id);
create index if not exists agile_issues_owner_idx on public.agile_issues(owner_id);
create index if not exists agile_issues_bucket_idx on public.agile_issues(roadmap_bucket);

-- Keep updated_at fresh on updates
create or replace function public.set_agile_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agile_issues_updated_at on public.agile_issues;
create trigger trg_agile_issues_updated_at
before update on public.agile_issues
for each row
execute function public.set_agile_updated_at();

-- Defaults
insert into public.agile_statuses (id, name, description, position, color)
values
  (gen_random_uuid(), 'To Do', 'Planned and ready to start', 1, 'sky'),
  (gen_random_uuid(), 'In Progress', 'Currently being worked on', 2, 'amber'),
  (gen_random_uuid(), 'Done', 'Completed items', 3, 'emerald')
on conflict do nothing;

insert into public.agile_roadmap_buckets (id, name, sort_order)
values
  ('now', 'Now', 1),
  ('next', 'Next', 2),
  ('later', 'Later', 3)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Access helper leveraging existing module access (RW/RO/No Access)
create or replace function public.agile_access_level()
returns text
language sql
security definer
stable
set search_path = public
as $$
  with profile as (
    select id, role
    from public.users
    where auth_user_id = auth.uid()
  ), access as (
    select
      case
        when p.role = 'admin' then 'read-write'
        when uma.access_level in ('read-write','read-only') then uma.access_level
        when uma.access_level is null and uma.has_access then 'read-write'
        else 'no-access'
      end as level
    from profile p
    left join public.user_module_access uma
      on uma.user_id = p.id
     and uma.module_name = 'agile'
  )
  select coalesce(level, 'no-access') from access limit 1;
$$;

-- RLS: enable and gate by module access
alter table public.agile_statuses enable row level security;
alter table public.agile_roadmap_buckets enable row level security;
alter table public.agile_issues enable row level security;

create policy "Agile statuses read" on public.agile_statuses
  for select
  using (
    auth.role() = 'service_role'
    or public.agile_access_level() in ('read-only','read-write')
  );

create policy "Agile statuses write" on public.agile_statuses
  for all
  using (
    auth.role() = 'service_role'
    or public.agile_access_level() = 'read-write'
  )
  with check (
    auth.role() = 'service_role'
    or public.agile_access_level() = 'read-write'
  );

create policy "Agile roadmap read" on public.agile_roadmap_buckets
  for select
  using (
    auth.role() = 'service_role'
    or public.agile_access_level() in ('read-only','read-write')
  );

create policy "Agile roadmap write" on public.agile_roadmap_buckets
  for all
  using (
    auth.role() = 'service_role'
    or public.agile_access_level() = 'read-write'
  )
  with check (
    auth.role() = 'service_role'
    or public.agile_access_level() = 'read-write'
  );

create policy "Agile issues read" on public.agile_issues
  for select
  using (
    auth.role() = 'service_role'
    or public.agile_access_level() in ('read-only','read-write')
  );

create policy "Agile issues write" on public.agile_issues
  for all
  using (
    auth.role() = 'service_role'
    or public.agile_access_level() = 'read-write'
  )
  with check (
    auth.role() = 'service_role'
    or public.agile_access_level() = 'read-write'
  );


