-- Allow "Full Time" as an admission batch type (in addition to A–G).

alter table public.admissions
  drop constraint if exists admissions_batch_type_check;

alter table public.admissions
  add constraint admissions_batch_type_check
  check (
    batch_type is null
    or batch_type in ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'Full Time')
  );
