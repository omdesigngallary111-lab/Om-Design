# Om Design & Classes — Flutter / Mobile API Guide

Share this file with the Flutter (Android + iOS) developer.

## Important architecture note

This project has **no custom REST `/api` backend**.

The web app talks to:

1. **Supabase Auth** — signup / login / session
2. **Supabase PostgREST** — tables (`designs`, `cart_items`, etc.) with RLS
3. **Supabase Storage** — images + private design files
4. **Supabase Edge Functions** — checkout, offers, phone login, downloads
5. **Razorpay** — payments (via Edge Functions + Flutter Razorpay SDK)

**Recommended Flutter stack**

| Concern | Package / approach |
|--------|---------------------|
| Backend client | [`supabase_flutter`](https://pub.dev/packages/supabase_flutter) |
| Payments | [`razorpay_flutter`](https://pub.dev/packages/razorpay_flutter) |
| Auth / catalog / cart / wishlist | Direct Supabase table queries (same as web) |
| Checkout / offers / phone login / downloads | `supabase.functions.invoke(...)` |

Do **not** invent a parallel REST API unless you have a strong reason. Reuse this Supabase project.

---

## Credentials to share (safe for clients)

Ask the web maintainer for:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-public-key>
```

These match the web app env vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Never put these in the Flutter app

- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Razorpay **public** `key_id` is returned by `create-razorpay-order` at checkout time — prefer that over hardcoding.

---

## Base URLs

| Service | URL |
|--------|-----|
| Supabase project | `{SUPABASE_URL}` |
| Auth | `{SUPABASE_URL}/auth/v1/...` |
| Database (PostgREST) | `{SUPABASE_URL}/rest/v1/{table}` |
| Storage | `{SUPABASE_URL}/storage/v1/...` |
| Edge Functions | `{SUPABASE_URL}/functions/v1/{function-name}` |
| WhatsApp (contact only) | `https://wa.me/918866401539?text=...` |

---

## Auth & headers

### Session

Supabase Auth returns a session with:

- `access_token`
- `refresh_token`
- `user`

Persist and auto-refresh via `supabase_flutter` (same behavior as web).

### Edge Function headers

```http
POST {SUPABASE_URL}/functions/v1/{name}
Content-Type: application/json
Authorization: Bearer {access_token_or_anon_key}
apikey: {SUPABASE_ANON_KEY}
```

| Case | Bearer token |
|------|----------------|
| Logged-in user (checkout, downloads, wallet) | `session.access_token` |
| Public-ish (`validate-offer`, `sign-in-with-phone`) | Anon key is OK if no user token |

### Roles (`profiles.role`)

Stored on `profiles.role`. Allowed values: `customer` | `admin` | `staff`.  
Default for new signups: `customer`.

See **Part I — Role access matrix** below for the full breakdown.

---

## Flutter init (example)

```dart
await Supabase.initialize(
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
);

final supabase = Supabase.instance.client;
```

Invoke an Edge Function:

```dart
final res = await supabase.functions.invoke(
  'create-razorpay-order',
  body: {
    'design_id': designId,
    'offer_code': offerCode, // or null
  },
);
final data = res.data as Map<String, dynamic>;
```

---

# Part A — Edge Functions (HTTP APIs)

All methods: **POST** (+ OPTIONS CORS).  
Base: `{SUPABASE_URL}/functions/v1/{name}`

---

## A1. `sign-in-with-phone`

Phone login (looks up email from `profiles.phone`, then signs in).

| | |
|--|--|
| **Auth** | Anon key OK (`verify_jwt` disabled) |
| **Rate limit** | ~10 requests / minute / IP |
| **Web source** | `src/lib/auth.js` → Login page |

### Request

```json
{
  "phone": "8866401539",
  "password": "YourPassword1!"
}
```

Phone rules:

- 10-digit Indian mobile → stored/normalized as `+91XXXXXXXXXX`
- Also accepts `91XXXXXXXXXX`

### Success `200`

```json
{
  "session": {
    "access_token": "...",
    "refresh_token": "...",
    "user": { "id": "...", "email": "..." }
  },
  "user": { "id": "...", "email": "..." }
}
```

Then in Flutter:

```dart
await supabase.auth.setSession(
  data['session']['access_token'],
  data['session']['refresh_token'],
);
```

### Errors

- `400` / `401` — `"Invalid email/mobile or password."`
- `429` — rate limited

---

## A2. `validate-offer`

Preview discount before checkout. Offers table is **not** publicly readable.

| | |
|--|--|
| **Auth** | Anon key OK |
| **Web source** | `DesignDetail.jsx`, `Cart.jsx` |

### Request

```json
{
  "order_amount": 499.0,
  "code": "SAVE10"
}
```

- Pass `"code": null` (or omit) to apply the best **automatic** (no-code) active offer.

### Success when applicable

```json
{
  "applicable": true,
  "offer_id": "<uuid>",
  "code": "SAVE10",
  "discount_percentage": 10,
  "original_amount": 499,
  "discount_amount": 49.9,
  "final_amount": 449.1
}
```

### Success when not applicable

```json
{
  "applicable": false,
  "reason": "Offer code not found or inactive"
}
```

**Note:** This is UI preview only. Charge-time revalidation happens inside checkout Edge Functions.

---

## A3. Checkout body (shared)

Used by:

- `create-razorpay-order`
- `purchase-with-wallet`
- `claim-free-order`

Pass **either** buy-now **or** cart — not both.

### Buy now

```json
{
  "design_id": "<design-uuid>",
  "offer_code": "SAVE10"
}
```

### Cart checkout

```json
{
  "from_cart": true,
  "offer_code": null
}
```

`offer_code` may be `null` / omitted.

Server always reloads prices from DB (never trust client prices).

---

## A4. `create-razorpay-order`

Creates pending order + Razorpay order. User JWT required.

| | |
|--|--|
| **Auth** | User `access_token` |
| **Web source** | `DesignDetail.jsx`, `Cart.jsx` via `src/lib/razorpay.js` |

### Request

Checkout body (A3).

### Success `200`

```json
{
  "order_id": "<uuid>",
  "razorpay_order_id": "order_...",
  "amount": 44900,
  "currency": "INR",
  "key_id": "rzp_...",
  "original_amount": 499,
  "discount_amount": 50,
  "final_amount": 449,
  "item_count": 1,
  "from_cart": false,
  "offer": {
    "offer_id": "<uuid>",
    "code": "SAVE10",
    "discount_percentage": 10
  }
}
```

- `amount` is in **paise** (Razorpay).
- If `final_amount <= 0`, this fails — use `claim-free-order` instead.

### Flutter payment step

Open Razorpay SDK with:

- `key` = `key_id`
- `order_id` = `razorpay_order_id`
- `amount` = `amount` (paise)
- `currency` = `INR`

On success, call `verify-razorpay-payment`.

---

## A5. `verify-razorpay-payment`

Verifies signature, marks order paid, returns signed download URLs (~10 minutes).

| | |
|--|--|
| **Auth** | User JWT |
| **Web source** | Razorpay success handler in `DesignDetail.jsx`, `Cart.jsx` |

### Request

```json
{
  "razorpay_order_id": "order_...",
  "razorpay_payment_id": "pay_...",
  "razorpay_signature": "...",
  "clear_cart": true
}
```

- Set `clear_cart: true` after cart checkout.

### Success `200`

```json
{
  "order_id": "<uuid>",
  "signed_url": "https://.../design-files/...?token=...",
  "downloads": [
    {
      "order_item_id": "<uuid>",
      "design_id": "<uuid>",
      "design_name": "Floral Border",
      "signed_url": "https://..."
    }
  ]
}
```

Use `downloads[]` for multi-item cart orders. `signed_url` at top level is a convenience for single-item.

---

## A6. `purchase-with-wallet`

Pay with `profiles.wallet_balance`. User JWT required.

| | |
|--|--|
| **Auth** | User JWT |
| **Web source** | `DesignDetail.jsx`, `Cart.jsx` |

### Request

Checkout body (A3).

### Success `200`

```json
{
  "order_id": "<uuid>",
  "signed_url": "https://...",
  "downloads": [ { "order_item_id": "...", "design_id": "...", "design_name": "...", "signed_url": "..." } ],
  "final_amount": 449,
  "original_amount": 499,
  "discount_amount": 50,
  "wallet_balance": 51,
  "payment_method": "wallet",
  "item_count": 1
}
```

---

## A7. `claim-free-order`

For orders where final amount is `0` (100% offer). User JWT required.

| | |
|--|--|
| **Auth** | User JWT |
| **Web source** | `DesignDetail.jsx`, `Cart.jsx` |

### Request

Checkout body (A3).

### Success `200`

Same download shape as wallet purchase, with:

```json
{
  "final_amount": 0,
  "payment_method": "free",
  "item_count": 1
}
```

---

## A8. `request-order-download-url`

Re-issue signed download URLs for an already **paid** order owned by the user.

| | |
|--|--|
| **Auth** | User JWT |
| **Web source** | `Account.jsx` |

### Request

```json
{
  "order_id": "<uuid>",
  "order_item_id": "<uuid>"
}
```

- `order_item_id` optional — omit to get all items (or use for one line).

### Success `200`

```json
{
  "order_id": "<uuid>",
  "signed_url": "https://...",
  "downloads": [ { "order_item_id": "...", "design_id": "...", "design_name": "...", "signed_url": "..." } ]
}
```

Requires `orders.status === "paid"` and ownership.

---

## A9. `admin-credit-wallet` (admin only)

| | |
|--|--|
| **Auth** | User JWT + `profiles.role === "admin"` |
| **Web source** | `src/lib/admin.js` → Admin Users |

### Request

```json
{
  "target_user_id": "<uuid>",
  "amount": 500,
  "note": "optional note"
}
```

### Success

```json
{
  "ok": true,
  "transaction_id": "<uuid>",
  "wallet_balance": 1500
}
```

---

## A10. Do not use from Flutter storefront

| Function | Why |
|----------|-----|
| `submit-admission` | Returns **410** — public admission intake disabled |
| `razorpay-webhook` | Server-only (Razorpay → Supabase). Not called by apps |

---

# Part B — Supabase Auth (SDK)

Web source: `src/lib/auth.js`, `AuthContext`, Login / Reset password pages.

| Action | SDK | Payload / notes | Used in |
|--------|-----|-----------------|---------|
| Sign up | `auth.signUp` | email, password; metadata `full_name`, `phone` | Login |
| Sign in (email) | `auth.signInWithPassword` | email + password | Login |
| Sign in (phone) | Edge `sign-in-with-phone` + `setSession` | phone + password | Login |
| Reset password email | `auth.resetPasswordForEmail` | email; redirect to reset page | Login |
| Update password | `auth.updateUser({ password })` | new password | Reset password |
| Sign out | `auth.signOut` | — | Account / auth |
| Session listen | `auth.onAuthStateChange` | — | App bootstrap |

### Sign up metadata example

```json
{
  "email": "user@example.com",
  "password": "StrongPass1!",
  "data": {
    "full_name": "Harsh",
    "phone": "+918866401539"
  }
}
```

Phone normalization (web):

- 10 digits → `+91XXXXXXXXXX`
- Valid Indian mobile starts with 6–9

### Profile after login

```text
SELECT * FROM profiles WHERE id = auth.uid()
```

**Profile shape**

```json
{
  "id": "uuid",
  "full_name": "string|null",
  "email": "string|null",
  "phone": "+91...|null",
  "avatar_url": "string|null",
  "role": "customer|admin|staff",
  "wallet_balance": 0.0,
  "created_at": "timestamptz",
  "updated_at": "timestamptz"
}
```

Customer can update: `full_name`, `email`, `phone` (do **not** let client set `role` or `wallet_balance`).

Web: `Account.jsx`, `src/lib/auth.js` (`fetchProfile` / `updateProfile`).

---

# Part C — Database tables (storefront)

Prefer `supabase.from('table')...` in Flutter. RLS enforces access.

Web sources:

- Catalog → `src/lib/catalog.js`
- Cart → `src/lib/cart.js`
- Wishlist → `src/lib/wishlist.js`
- Orders list → `src/pages/Account.jsx`

---

## C1. Categories

| Op | Details | Screens |
|----|---------|---------|
| List | `categories` select `*`, order `sort_order` asc | Home, Categories |
| By slug | `.eq('slug', slug).single()` | Catalog |

---

## C2. Subcategories

```text
subcategories
  select *, categories!inner(id, slug, name)
  order sort_order asc
  optional filter: categories.slug = categorySlug
```

Used on Designs / filters.

---

## C3. Designs (storefront)

### List

```text
designs
  select *, categories(slug,name), subcategories(slug,name), design_types(name)
  where is_active = true
  order is_pinned desc, created_at desc
  range pagination
```

### Filters (all optional)

| Filter | How |
|--------|-----|
| `categorySlug` | join `categories!inner` + `.eq('categories.slug', ...)` |
| `subcategorySlug` | join `subcategories!inner` + `.eq('subcategories.slug', ...)` |
| `format` | `.eq('file_format', ...)` — `DST` \| `EMB` \| `DHE` \| `DHP` \| `ZIP` |
| `minPrice` / `maxPrice` | `.gte` / `.lte` on `price` |
| `query` | `.or(name.ilike.%q%,design_id.ilike.%q%)` |
| `designTypeId` | `.eq('design_type_id', ...)` |
| `area` | `.eq('area', ...)` text value |
| `needle` | `.eq('needle', ...)` text value |
| `featuredOnly` | `.eq('is_featured', true)` |
| `page` / `pageSize` | default page size **10** |

### Detail by slug

```text
designs
  select *, categories(name,slug), subcategories(name,slug,category_id), design_types(name)
  where slug = ? and is_active = true
  single
```

### Design fields (main)

```text
id, name, slug, description, price,
category_id, subcategory_id,
thumbnail_url, gallery_urls[],
design_file_url,          ← private storage PATH, not a public URL
file_format, stitch_count, size_mm, tags[],
area, needle, area_id, needle_id, design_type_id,
design_id,                ← public 6-digit code (searchable)
is_featured, is_active, is_pinned, is_best_seller,
created_at, updated_at
```

**Critical:** never download `design_file_url` directly. Use signed URLs from checkout / `request-order-download-url`.

---

## C4. Filter option tables

| Table | Query | Used for |
|-------|-------|----------|
| `design_types` | `id, name` where `is_active` | Designs filters |
| `design_areas` | `id, name` where `is_active`, order `sort_order` | Designs filters |
| `design_needles` | `id, name` where `is_active`, order `sort_order` | Designs filters |

---

## C5. Carousel

```text
carousel_slides
  select *
  where is_active = true
  order sort_order asc
```

Used on Home.

---

## C6. Cart (`cart_items`)

PK: `(user_id, design_id)`

| Op | Payload / query | Used in |
|----|-----------------|---------|
| Check | select by `user_id` + `design_id` | Detail CTAs |
| Add | upsert `{ user_id, design_id }` on conflict ignore | Detail / list |
| Remove | delete by `user_id` + `design_id` | Cart |
| Clear | delete all for `user_id` | After paid cart checkout |
| Count | `count` head for `user_id` | Badge |
| List | join designs (see below) | Cart page |

### Cart list select

```text
cart_items
  select created_at, design_id, designs (
    id, name, slug, price, thumbnail_url, file_format, design_id, is_active, design_file_url
  )
  where user_id = ?
  order created_at desc
```

Web: `src/lib/cart.js`, `CartContext`, `Cart.jsx`.

---

## C7. Wishlist (`wishlists`)

| Op | Payload | Used in |
|----|---------|---------|
| Check | `user_id` + `design_id` | Wishlist button |
| Add | insert `{ user_id, design_id }` | Wishlist button |
| Remove | delete by pair | Wishlist button / page |
| List | `select design_id, designs(*)` order `created_at` desc | Wishlist page |

Web: `src/lib/wishlist.js`.

---

## C8. Orders (customer read)

**Do not INSERT orders from the client.** Only Edge Functions create orders.

### List own orders

```text
orders
  select
    id, status, amount, created_at, design_id, payment_method,
    order_items ( id, design_id, design_name, unit_price )
  where user_id = auth.uid()
  order created_at desc
```

### Order fields

```text
id, user_id, design_id,
amount,
status: pending | paid | failed,
razorpay_order_id,
payment_method: razorpay | wallet | free | null,
offer_id, offer_usage_counted,
created_at
```

### order_items

```text
id, order_id, design_id, unit_price, design_name, created_at
```

Re-download: Edge Function `request-order-download-url`.

Web: `Account.jsx`.

---

## C9. Offers

- **No public SELECT** on `offers`
- Storefront must use `validate-offer`
- Admin CRUD exists in web admin only

---

# Part D — Storage

| Bucket | Public? | Purpose |
|--------|---------|---------|
| `product-images` | Yes | Thumbnails / gallery |
| `design-files` | No | Machine embroidery files |
| `admission-photos` | No | Admin admissions only |

### Public image URL pattern

```text
{SUPABASE_URL}/storage/v1/object/public/product-images/{path}
```

Private design files are served only via **signed URLs** from Edge Functions (~10 minutes TTL).

---

# Part E — Checkout flows (copy these)

## E1. Razorpay (paid)

```text
1. (Optional) validate-offer for UI preview
2. create-razorpay-order  { design_id } OR { from_cart: true }
3. Open Razorpay Flutter SDK with key_id + razorpay_order_id + amount (paise)
4. On success → verify-razorpay-payment
5. Save / open downloads[].signed_url
6. Later → request-order-download-url
```

## E2. Wallet

```text
1. validate-offer (optional)
2. purchase-with-wallet
3. Use downloads[].signed_url
4. Refresh profile.wallet_balance
```

## E3. Free (100% discount)

```text
1. validate-offer → final_amount === 0
2. claim-free-order
3. Use downloads[].signed_url
```

---

# Part F — Admin / admissions (optional)

Only needed if Flutter also builds admin/staff tools.

Web source: `src/lib/admin.js`

### Admin catalog CRUD tables

- `categories`, `subcategories`
- `designs`
- `design_types`, `design_areas`, `design_needles`
- `carousel_slides`
- `offers`
- `orders` (+ joins profiles / designs / order_items)
- `profiles` (list users, update `role`)

### Admissions (admin/staff)

Public `submit-admission` is **disabled (410)**.

Admin creates via:

1. RPC `next_admission_form_number`
2. Upload to `admission-photos`
3. Insert into `admissions`
4. Optional `admission_fee_installments` CRUD

Main admission fields:

```text
form_number, student_name, student_mobile, father_mobile,
photo / signature / aadhaar storage paths,
addresses, reference_details, class times,
batch_type (A–G | Full Time), package, join_date,
preferred_language (en | gu),
status (pending | reviewed | enrolled | rejected),
reviewed_by, timestamps
```

### Wallet credit

Use Edge Function `admin-credit-wallet` only (not direct balance updates).

---

# Part G — Related web source map

| Domain | Primary files |
|--------|----------------|
| Supabase client | `src/lib/supabaseClient.js` |
| Auth | `src/lib/auth.js` |
| Catalog | `src/lib/catalog.js` |
| Cart | `src/lib/cart.js` |
| Wishlist | `src/lib/wishlist.js` |
| Edge HTTP helper | `src/lib/razorpay.js` → `callEdgeFunction` |
| Checkout UI | `src/pages/DesignDetail.jsx`, `src/pages/Cart.jsx` |
| Account / downloads | `src/pages/Account.jsx` |
| Admin | `src/lib/admin.js` |
| Edge Functions | `supabase/functions/*` |
| Schema / RLS | `supabase/migrations/*.sql` |

---

# Part H — Flutter checklist / gotchas

1. Use **same** Supabase project as the website.
2. Prefer `supabase_flutter` over hand-rolled REST.
3. Never expose service-role key or Razorpay secret in the app.
4. Never trust client-side prices; always checkout via Edge Functions.
5. `design_file_url` is a **path**, not a download link.
6. Signed download URLs expire (~10 minutes) — re-request when needed.
7. Offers are not publicly queryable — use `validate-offer`.
8. Orders are created only by Edge Functions.
9. Public admission API is disabled — office/admin only.
10. Contact WhatsApp is just a deep link (`wa.me`), not an API.

---

# Quick reference — Edge Functions

| Function | Auth | Purpose |
|----------|------|---------|
| `sign-in-with-phone` | Anon | Phone + password login |
| `validate-offer` | Anon | Preview discount |
| `create-razorpay-order` | User | Start Razorpay checkout |
| `verify-razorpay-payment` | User | Confirm payment + get downloads |
| `purchase-with-wallet` | User | Pay with wallet + downloads |
| `claim-free-order` | User | Free checkout + downloads |
| `request-order-download-url` | User | Refresh download links |
| `admin-credit-wallet` | Admin | Credit user wallet |

---

# Part I — Role access matrix

Roles live on `profiles.role`: **`customer`** (default) · **`staff`** · **`admin`**.

Enforced in two layers:

1. **UI** — `src/lib/roles.js`, `AdminRoute` / `AdminOnlyRoute`, admin nav
2. **Database RLS** — policies using `is_admin()`, `is_staff()`, `can_access_admissions()`, `can_create_admissions()`

A user cannot promote themselves to admin/staff. Only an existing **admin** can change roles (Users tab + DB trigger).

### After login — default landing page

| Role | Default path |
|------|----------------|
| `admin` | `/admin` (dashboard) |
| `staff` | `/admin/admissions` |
| `customer` | `/account` |

---

## Quick summary

| Area | Guest (anon) | Customer | Staff | Admin |
|------|:------------:|:--------:|:-----:|:-----:|
| Browse catalog / designs / carousel | Yes | Yes | Yes | Yes |
| Sign up / login | Yes | Yes | Yes | Yes |
| Cart / wishlist / checkout / own downloads | — | Yes | Yes* | Yes* |
| Own profile + wallet balance (read) | — | Yes | Yes | Yes |
| Office admissions (list / view / create) | — | — | Yes | Yes |
| Edit / delete admissions + fee installments write | — | — | — | Yes |
| Catalog admin (products, categories, offers, …) | — | — | — | Yes |
| All users / change roles / credit wallet | — | — | — | Yes |
| All orders (admin list) | — | — | — | Yes |

\* Staff and admin can also use the shop like a customer (same cart/checkout APIs), if logged in.

---

## 1. Guest (not logged in)

| Can | Cannot |
|-----|--------|
| Read public catalog (`categories`, `subcategories`, active `designs`, filters, carousel) | Cart, wishlist, checkout |
| Call `validate-offer` | See own orders / downloads |
| Call `sign-in-with-phone` / use Auth signup-login | Any `/admin/*` route |
| Open public image URLs (`product-images`) | Read private `design-files` or `admission-photos` |
| | Read/write `offers`, admissions, all users |

---

## 2. Customer (`role = customer`)

Shopper account. **No office/admin panel.**

### App / UI access

| Allowed | Denied |
|---------|--------|
| Home, catalog, design detail | Entire `/admin/*` (redirected home) |
| Cart, wishlist | Admissions office |
| Account (profile, own orders, re-download) | Users / products / offers admin |
| Checkout (Razorpay / wallet / free) | Credit anyone’s wallet |

### Data access (RLS)

| Resource | Access |
|----------|--------|
| Own `profiles` row | Read + update (name/email/phone). **Cannot** change `role` or `wallet_balance` |
| Public catalog tables | Read (active designs, etc.) |
| Own `cart_items` | Full CRUD |
| Own `wishlists` | Full CRUD |
| Own `orders` / `order_items` | **Read only** (create via Edge Functions only) |
| Own `wallet_transactions` | Read (UI currently shows balance only) |
| `offers` | No direct SELECT — use `validate-offer` |
| `admissions` | None |
| Storage `design-files` | Only via signed URLs from paid checkout Edge Functions |
| Storage `admission-photos` | None |

### Edge Functions

| Allowed | Denied |
|---------|--------|
| Checkout + download functions | `admin-credit-wallet` |
| `validate-offer`, `sign-in-with-phone` | |

---

## 3. Staff (`role = staff`)

**Customer shop access + admissions office (create & view only).**  
Cannot edit/delete admissions or open the full admin panel.

### App / UI access

| Allowed routes | Denied / redirected |
|----------------|---------------------|
| `/admin/admissions` (list) | Dashboard, Products, Categories, Subcategories |
| `/admin/admissions/new` (create) | Design Types, Area & Needle, Offers, Carousel |
| `/admin/admissions/:id` (view / print) | Users, Orders |
| Storefront shop (same as customer) | Admission **edit** page (`.../edit`) — admin only in UI |
| | Delete admission — admin only in UI |

Nav shows **only Admissions**. Trying other `/admin/*` pages redirects to `/admin/admissions`.

### Admissions permissions (staff)

| Action | Allowed? |
|--------|----------|
| List / search / view admissions | Yes |
| Create admission (+ upload photo/signature/aadhaar) | Yes |
| Get next form number (`next_admission_form_number`) | Yes |
| View fee installments | Yes (read-only) |
| Update admission fields / status | **No** (RLS + UI) |
| Delete admission | **No** |
| Insert / update / delete fee installments | **No** |

### Storage `admission-photos` (staff)

| Op | Allowed? |
|----|----------|
| Select (signed URLs / view) | Yes |
| Insert (upload on create) | Yes |
| Update / delete (e.g. create rollback) | Yes (create flow) |

### Everything else

Same as **customer** for shop (cart, wishlist, checkout, own orders).  
Same as customer for catalog write — **no** product/offer/category admin.  
**Cannot** list all users, change roles, or credit wallets.

---

## 4. Admin (`role = admin`)

Full office + shop + user management.

### App / UI — full `/admin` panel

| Page | Access |
|------|--------|
| Dashboard | Yes |
| Products | Yes (CRUD + image/file upload) |
| Categories / Subcategories | Yes |
| Design Types / Area & Needle | Yes |
| Offers | Yes |
| Carousel | Yes |
| Users | Yes (change role, credit wallet) |
| Orders | Yes (view all) |
| Admissions | Yes (create, view, **edit**, **delete**, fee installments CRUD) |

### Data access (RLS) — admin extras

| Resource | Access |
|----------|--------|
| All `profiles` | Read + update (including `role`) |
| Catalog tables (`designs`, `categories`, …) | Full write (incl. inactive designs) |
| `offers` | Full CRUD |
| `carousel_slides` | Full CRUD |
| All `orders` / `order_items` | Manage / read all |
| All `wallet_transactions` | Read all |
| `admissions` | Full CRUD |
| `admission_fee_installments` | Full CRUD |
| Storage `product-images` | Upload / update / delete |
| Storage `design-files` | Manage |
| Storage `admission-photos` | Full |

### Edge Functions

All customer checkout functions **plus** `admin-credit-wallet`.

### Role changes

Only admins can set another user’s role to `customer` | `staff` | `admin`.  
UI blocks changing **your own** role in the Users table (safety).  
DB trigger also blocks non-admin role escalation.

---

## 5. Feature matrix (detailed)

| Feature | Guest | Customer | Staff | Admin |
|---------|:-----:|:--------:|:-----:|:-----:|
| Browse designs / categories | ✅ | ✅ | ✅ | ✅ |
| Validate offer code | ✅ | ✅ | ✅ | ✅ |
| Cart & wishlist | ❌ | ✅ | ✅ | ✅ |
| Buy (Razorpay / wallet / free) | ❌ | ✅ | ✅ | ✅ |
| Own order history & re-download | ❌ | ✅ | ✅ | ✅ |
| Update own profile | ❌ | ✅ | ✅ | ✅ |
| Admissions list / view | ❌ | ❌ | ✅ | ✅ |
| Admissions create | ❌ | ❌ | ✅ | ✅ |
| Admissions edit / delete | ❌ | ❌ | ❌ | ✅ |
| Fee installments write | ❌ | ❌ | ❌ | ✅ |
| Products / categories admin | ❌ | ❌ | ❌ | ✅ |
| Offers / carousel admin | ❌ | ❌ | ❌ | ✅ |
| View all orders | ❌ | ❌ | ❌ | ✅ |
| Manage users & roles | ❌ | ❌ | ❌ | ✅ |
| Credit user wallet | ❌ | ❌ | ❌ | ✅ |
| Upload product / design files | ❌ | ❌ | ❌ | ✅ |

---

## 6. Flutter implementation tips

```dart
final role = profile['role'] as String?; // from profiles

bool get isAdmin => role == 'admin';
bool get isStaff => role == 'staff';
bool get canAccessAdmissions => isAdmin || isStaff;
bool get canEditAdmissions => isAdmin;
bool get canAccessFullAdmin => isAdmin;
```

Mirror web helpers in `src/lib/roles.js`.

- Storefront app: usually only need **customer** behavior.
- Office app / dual app: gate screens with `canAccessAdmissions` / `isAdmin`.
- Never rely on UI alone — RLS will still reject forbidden writes.

---

*Generated from the Om Design & Classes web codebase for Flutter Android/iOS integration.*
