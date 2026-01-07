-- Add ready_for_review flag and allow owners to set it (even read-only) while keeping other updates restricted to read-write.

alter table public.agile_issues
  add column if not exists ready_for_review boolean not null default false;

-- Policy to allow the owner with at least read-only module access to set ready_for_review.
create policy "Agile issues request review flag"
on public.agile_issues
for update
using (
  auth.role() = 'service_role'
  or (
    public.agile_access_level() in ('read-only','read-write')
    and owner_id = (select id from public.users where auth_user_id = auth.uid())
  )
)
with check (
  auth.role() = 'service_role'
  or (
    public.agile_access_level() in ('read-only','read-write')
    and owner_id = (select id from public.users where auth_user_id = auth.uid())
  )
);

