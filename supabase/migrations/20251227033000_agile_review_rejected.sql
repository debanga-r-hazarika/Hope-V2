-- Track review rejection state alongside ready_for_review

alter table public.agile_issues
  add column if not exists review_rejected boolean not null default false;


