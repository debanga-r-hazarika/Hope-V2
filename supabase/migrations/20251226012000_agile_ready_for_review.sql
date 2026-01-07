alter table if exists public.agile_issues
  add column if not exists ready_for_review boolean default false;

update public.agile_issues
set ready_for_review = coalesce(ready_for_review, false);


