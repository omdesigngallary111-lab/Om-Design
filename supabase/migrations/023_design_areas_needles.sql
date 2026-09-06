-- Area & Needle options for products (admin-managed, like design_types).
-- designs keep text columns for display; new FKs drive dropdowns + filters.
-- Default rows match the studio's standard hoop sizes / needle counts.

create table if not exists public.design_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint design_areas_name_unique unique (name)
);

create table if not exists public.design_needles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint design_needles_name_unique unique (name)
);

alter table public.design_areas enable row level security;
alter table public.design_needles enable row level security;

drop policy if exists "public read active design_areas" on public.design_areas;
create policy "public read active design_areas" on public.design_areas
  for select using (is_active = true);

drop policy if exists "admin write design_areas" on public.design_areas;
create policy "admin write design_areas" on public.design_areas
  for all using (public.is_admin());

drop policy if exists "public read active design_needles" on public.design_needles;
create policy "public read active design_needles" on public.design_needles
  for select using (is_active = true);

drop policy if exists "admin write design_needles" on public.design_needles;
create policy "admin write design_needles" on public.design_needles
  for all using (public.is_admin());

-- Also allow admins to see inactive design_types (existing pattern in 019);
-- areas/needles use is_admin() OR is_active above.

alter table public.designs
  add column if not exists area_id uuid references public.design_areas(id) on delete set null,
  add column if not exists needle_id uuid references public.design_needles(id) on delete set null;

create index if not exists designs_area_id_idx on public.designs (area_id);
create index if not exists designs_needle_id_idx on public.designs (needle_id);

-- Seed defaults (idempotent)
insert into public.design_areas (name, sort_order) values
  ('100 mm', 10),
  ('125 mm', 20),
  ('150 mm', 30),
  ('175 mm', 40),
  ('200 mm', 50),
  ('225 mm', 60),
  ('250 mm', 70),
  ('300 mm', 80),
  ('330 mm', 90),
  ('400 mm', 100),
  ('500 mm', 110),
  ('600 mm', 120)
on conflict (name) do nothing;

insert into public.design_needles (name, sort_order) values
  ('1', 1),
  ('2', 2),
  ('3', 3),
  ('4', 4),
  ('5', 5),
  ('6', 6),
  ('7', 7),
  ('8', 8),
  ('9', 9),
  ('10', 10),
  ('11', 11),
  ('12', 12)
on conflict (name) do nothing;

-- Backfill FKs from existing free-text where names match (trimmed)
update public.designs d
set area_id = a.id
from public.design_areas a
where d.area_id is null
  and d.area is not null
  and lower(trim(d.area)) = lower(a.name);

update public.designs d
set needle_id = n.id
from public.design_needles n
where d.needle_id is null
  and d.needle is not null
  and lower(trim(d.needle)) = lower(n.name);
