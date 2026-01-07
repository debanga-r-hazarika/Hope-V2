-- Add priority to agile issues

alter table public.agile_issues
  add column if not exists priority text not null default 'normal'
  check (priority in ('high','normal','low'));

update public.agile_issues
  set priority = coalesce(priority, 'normal');


