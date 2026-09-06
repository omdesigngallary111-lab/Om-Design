-- Next online admission form number starts at 1725.
-- Offline paper forms already used 1–1724.
--
-- Production-safe: never lowers the sequence below existing max(form_number).
-- Existing admission rows keep their current form_number values.

select setval(
  'public.admission_form_number_seq',
  greatest(
    1724,
    coalesce((select max(form_number) from public.admissions), 0)
  )
);
