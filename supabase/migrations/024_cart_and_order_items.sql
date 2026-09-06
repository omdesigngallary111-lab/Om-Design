-- Cart + multi-item orders (production-safe).
-- Keeps orders.design_id for legacy Buy Now rows; backfills order_items
-- so every paid order can download per design.

-- ---------- Cart ----------
create table if not exists public.cart_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  design_id uuid not null references public.designs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, design_id)
);

create index if not exists cart_items_user_id_idx on public.cart_items (user_id);
create index if not exists cart_items_design_id_idx on public.cart_items (design_id);

alter table public.cart_items enable row level security;

drop policy if exists "own cart" on public.cart_items;
create policy "own cart" on public.cart_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- Order line items ----------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  design_id uuid not null references public.designs (id),
  unit_price numeric(10, 2) not null,
  design_name text,
  created_at timestamptz not null default now(),
  constraint order_items_order_design_unique unique (order_id, design_id)
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_design_id_idx on public.order_items (design_id);

alter table public.order_items enable row level security;

drop policy if exists "own order items" on public.order_items;
create policy "own order items" on public.order_items
  for select
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

drop policy if exists "admin manage order items" on public.order_items;
create policy "admin manage order items" on public.order_items
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Backfill historical single-design orders (idempotent).
insert into public.order_items (order_id, design_id, unit_price, design_name)
select
  o.id,
  o.design_id,
  coalesce(o.amount, 0),
  d.name
from public.orders o
left join public.designs d on d.id = o.design_id
where o.design_id is not null
  and not exists (
    select 1
    from public.order_items oi
    where oi.order_id = o.id
      and oi.design_id = o.design_id
  );
