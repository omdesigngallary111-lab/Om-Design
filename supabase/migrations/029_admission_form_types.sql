-- Separate form-number series for Student, Sketcher, and Emcad.
-- Student keeps the existing numeric sequence (already set to start at 1725).
-- Sketcher starts at S-06. Emcad starts at E-29.
-- Existing rows stay students; their form numbers are preserved as text.

alter table public.admissions
  add column if not exists admission_type text not null default 'student';

alter table public.admissions
  drop constraint if exists admissions_admission_type_check;

alter table public.admissions
  add constraint admissions_admission_type_check
  check (admission_type in ('student', 'sketcher', 'emcad'));

-- Store prefixed codes (S-06, E-29) alongside existing numeric student numbers.
alter table public.admissions
  alter column form_number type text using form_number::text;

create sequence if not exists public.admission_sketcher_form_seq start with 6;
create sequence if not exists public.admission_emcad_form_seq start with 29;

create or replace function public.next_admission_form_code(p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  if auth.role() is distinct from 'service_role'
     and not public.can_create_admissions() then
    raise exception 'forbidden';
  end if;

  if p_type = 'sketcher' then
    n := nextval('public.admission_sketcher_form_seq');
    return 'S-' || lpad(n::text, 2, '0');
  elsif p_type = 'emcad' then
    n := nextval('public.admission_emcad_form_seq');
    return 'E-' || lpad(n::text, 2, '0');
  elsif p_type is null or p_type = 'student' then
    return nextval('public.admission_form_number_seq')::text;
  else
    raise exception 'invalid admission type';
  end if;
end;
$$;

revoke all on function public.next_admission_form_code(text) from public, anon;
grant execute on function public.next_admission_form_code(text) to authenticated, service_role;
