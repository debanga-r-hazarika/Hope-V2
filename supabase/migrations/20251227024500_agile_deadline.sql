-- Add deadline date to agile issues for backlog tracking

alter table public.agile_issues
  add column if not exists deadline_date date;

-- No backfill required; null means no deadline.


