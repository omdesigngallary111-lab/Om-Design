-- Join date for class admissions (office form + printed template).
alter table public.admissions
  add column if not exists join_date date;
