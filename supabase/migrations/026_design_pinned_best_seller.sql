-- Pinned designs sort to the top of the catalogue.
-- Best-seller flag drives a storefront badge only (no sort change).

alter table public.designs
  add column if not exists is_pinned boolean not null default false;

alter table public.designs
  add column if not exists is_best_seller boolean not null default false;

create index if not exists designs_is_pinned_idx
  on public.designs (is_pinned desc, created_at desc)
  where is_active = true;
