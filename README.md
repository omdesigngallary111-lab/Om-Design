# Om Design & Classes

Public marketing site, phone/OTP auth + account management, the full
design catalogue, wishlist, and an admin panel for the embroidery
design marketplace. All six planned phases are built.

**Auth and catalog are stubbed against a placeholder Supabase client** —
all UI, routing, and data-fetching logic are built and will work as
soon as real credentials are added to `.env`; until then, catalog pages
run on bundled mock data and auth screens show an explicit "not
connected yet" notice rather than failing silently.

## Run it

```bash
npm install
cp .env.example .env   # fill in once Supabase details are shared
npm run dev
```

## What's built (Phase 1)

- Project scaffold: Vite + React Router + Tailwind + Framer Motion
- Design tokens in `tailwind.config.js` (maroon / gold / teal / ivory palette,
  Fraunces + Manrope type)
- Shared components: `Navbar`, `Footer`, `Section`, `Card`, `Modal`,
  `ThreadDivider` (signature scroll-drawn running-stitch motif)
- Pages: `Home`, `About`, `Contact` — fully responsive, scroll-triggered
  motion, reduced-motion respected, visible focus states
- `src/lib/supabaseClient.js` stub, wired to env vars

## What's built (Phase 2)

- `AuthProvider` (`src/context/AuthContext.jsx`) — session + profile
  state, exposed app-wide via `useAuth()`
- `src/lib/auth.js` — `sendOtp`, `verifyOtp`, `signOut`, `fetchProfile`,
  `updateProfile`; every function checks whether Supabase is configured
  and returns a clear message instead of throwing if it isn't
- `/login` — two-step phone → OTP form (no email/password, per the brief)
- `/account` (protected by `ProtectedRoute`) — edit name / email / phone
- `Navbar` now shows the real avatar menu (My Account, Wishlist, Logout)
  once a session exists, replacing the Login button
- `supabase/migrations/002_profile_creation_trigger.sql` — creates the
  `profiles` row server-side via an `auth.users` trigger, see judgment
  call #6 below for why

## What's built (Phase 3)

- `src/data/mockCatalog.js` — mock categories + designs shaped exactly
  like your `categories`/`designs` tables
- `src/lib/catalog.js` — `fetchCategories`, `fetchCategoryBySlug`,
  `fetchDesigns` (filters), `fetchDesignBySlug`; each runs a real
  Supabase query when configured, or filters the mock data when not —
  no page changes needed once real credentials land
- `src/lib/wishlist.js` — `isWishlisted`/`addToWishlist`/`removeFromWishlist`,
  used by the detail page's Add to Wishlist button now; the dedicated
  Wishlist page/toggle-everywhere UI is Phase 4
- `/categories` — category grid
- `/designs` — full catalogue with search + category/format/price
  filters, all driven by URL query params (`?category=&format=&min=&max=&q=`)
  so filtered views are shareable and category cards can deep-link in
- `/designs/:slug` — product detail: gallery with thumbnail strip, full
  description, spec list (format/stitch count/size), tags, Add to
  Wishlist (auth-gated — redirects to `/login` if signed out), stubbed
  Buy Now

## What's built (Phase 4)

- `src/components/WishlistButton.jsx` — the single wishlist toggle used
  everywhere (catalog cards as a compact heart icon, product detail as
  a labelled button, wishlist page implicitly via remove); auth-gated,
  redirects to `/login` on a signed-out click
- `src/lib/wishlist.js` gained `fetchWishlistDesigns` — joins
  `wishlists` → `designs` for the real Supabase query
- `/wishlist` (protected route) — grid of saved designs with inline
  Remove, empty state pointing back to `/designs`
- `Card.jsx` gained a `topRight` slot so catalog listing cards can carry
  the heart icon without needing a separate card variant

## What's built (Phase 5)

- Two new migrations, **both required before Admin works at all**:
  - `003_admin_profiles_access.sql` — admins can only see/edit their own
    profile under your original RLS; this adds admin-wide read/update
    via a `security definer` `is_admin()` helper (avoids the recursive-
    policy trap of a `profiles` policy querying `profiles` directly)
  - `004_storage_buckets.sql` — creates `product-images` (public) and
    `design-files` (private) buckets with matching policies; these
    buckets don't exist from the table schema alone
- `src/lib/admin.js` — dashboard stats, Categories CRUD, Products CRUD,
  Storage uploads, Users list + role update. **No mock-data fallback**
  here (see judgment call #12 pattern) — `/admin` requires a real admin
  session to even reach, so there's nothing to demo without Supabase
  connected regardless
- `AdminRoute` — gates on session + `profile.role === 'admin'`,
  redirects non-admins to `/`
- `/admin` — Dashboard (live counts: designs, categories, users, orders),
  `/admin/products` (table + modal form, image upload, private
  design-file upload, active/featured toggles), `/admin/categories`
  (table + modal form), `/admin/users` (table with a role-toggle button)
- Admin panel has its own layout (sidebar, no public Navbar/Footer)

## What's built (Phase 6)

- **Toasts** (`src/context/ToastContext.jsx`) — replaced the one
  `alert()` (Buy Now) and added confirmation toasts for wishlist
  add/remove, contact form submit, account save, and every admin
  Category/Product/User CRUD action (save, delete, role change).
  Inline errors near form fields are kept where precision matters
  (login, account, admin forms) — toasts are for transient
  confirmations, not for things the user needs to read carefully.
- **SEO** (`src/components/Seo.jsx`) — per-page `<title>` + meta
  description, dependency-free (no react-helmet — not worth the bundle
  weight for two tags). Every public page has one; `/login`, `/account`,
  `/wishlist`, and all of `/admin/*` are `noindex`, backed by a
  `public/robots.txt` disallow list too.
- **Performance** — every route except Home is now `React.lazy()`-loaded
  behind a `<Suspense>` boundary, so a visitor browsing only the public
  site never downloads the admin bundle (and an admin's first load
  doesn't pull in the whole public site either). Catalog and gallery
  images use `loading="lazy"` except the active product-detail image.
- **Accessibility** — a skip-to-content link (first focusable element,
  visible on focus), `aria-pressed` on the catalog filter buttons,
  `aria-label` on the breadcrumb nav, `scope="col"` on every admin table
  header, and an `aria-live` region for toasts. Reduced-motion and
  visible focus states were already in place from Phase 1's base styles.
- **Loading/empty states** — audited across all phases; Categories,
  Designs, Wishlist, and every admin table already had skeletons/empty
  states from earlier phases — no gaps found there.

## Judgment calls flagged so far

1. **3D vs SVG hero.** Went with SVG/Framer Motion only, no React Three
   Fiber — a thread motif is inherently 2D, and it keeps the hero light and
   fast on mobile. R3F is a better fit later for something like a rotating
   product/hoop viewer on design detail pages (Phase 3), if you want it.
2. **`/categories` is linked in the Navbar** before the route exists
   (Phase 3). It will 404 until then — left in intentionally so the nav
   doesn't need restructuring later.
3. **Login button is a static stub.** Phase 2 swaps this one spot for a
   real avatar menu once Supabase phone/OTP auth is wired in; no other
   layout changes needed.
4. **Newsletter signup (Footer) and Contact form** both only show a local
   "submitted" state right now — neither has a backend. Your schema
   doesn't include a subscribers or messages table, so before these go
   live you'll want to decide: add tables + RLS policies for them, or
   point them at an external service (e.g. Mailchimp, a form endpoint).
   I didn't add tables on your behalf since that's a schema decision.
5. **Photos are placeholder slots** throughout (hero, story, team, map) —
   swap in real assets once available; they're already Storage-shaped
   (single image per slot) to match `thumbnail_url` / `gallery_urls`
   conventions from your schema.
6. **Profile row creation uses a server-side trigger, not a client insert.**
   Your original `profiles` RLS policies only cover select/update for the
   owner — no insert policy — so a client-side "create my row on first
   login" call would be rejected by RLS as written. Rather than open an
   insert policy, `supabase/migrations/002_profile_creation_trigger.sql`
   adds a `security definer` trigger on `auth.users` that creates the row
   the moment the user exists. **You'll need to run this migration** (SQL
   editor in the Supabase dashboard, or the CLI) before phone sign-up will
   result in a usable profile.
7. **Phone edits in My Account don't re-verify the number.** Changing the
   phone field updates the contact record only; it doesn't change what
   the user signs in with or confirm they own the new number. Flagged in
   the code — a real "change sign-in phone" flow would need its own OTP
   step and is a reasonable candidate for a later phase if you want it.
8. **OTP delivery depends on your Supabase project having an SMS
   provider configured** (Twilio, MessageBird, etc.) and phone auth
   enabled in Auth settings — both off by default and both dashboard-only,
   so I can't verify or set them myself.
9. **"Buy Now" is a stub by design, not an oversight.** Your schema has
   an `orders` table with a `status` field, which implies a payment
   flow, but no provider is named anywhere (Razorpay, Stripe, etc.) —
   that's a real decision with cost and integration implications, so I
   didn't pick one for you. The button currently shows a placeholder
   message; wiring real checkout is a good candidate for its own phase
   once you've chosen a provider.
10. **Product image fields (`thumbnail_url`, `gallery_urls`) render as
    labelled placeholder slots** in both card and detail views when
    empty, same pattern as the marketing-page photo slots — nothing to
    change once Storage URLs exist, the components already expect them.
11. **Mock catalogue data lives in `src/data/mockCatalog.js`** purely so
    Phase 3 is fully browsable today. It's dead weight once Supabase is
    connected (the `if (supabase)` branches in `catalog.js` take over
    automatically) — safe to delete at that point, nothing imports it
    elsewhere.
12. **Wishlist has no mock-data fallback, unlike the catalog.** It can't
    actually be demoed until real Supabase auth is connected — without
    it, `session` is always null, so every wishlist click redirects to
    `/login` (which itself can't complete sign-in yet). That's the
    correct behavior for an auth-gated feature, just flagging that it's
    the one Phase 3/4 area that stays fully inert until credentials land,
    unlike catalog browsing which works today via mock data.
13. **Your original RLS blocked the Users tab entirely.** The only
    `profiles` policies were `auth.uid() = id` for select/update — an
    admin querying "all users" would get back just their own row, and a
    role-toggle on someone else's row would be silently rejected.
    `003_admin_profiles_access.sql` fixes this via a `security definer`
    helper function rather than a naive self-referencing policy (which
    would recurse). **This migration is not optional** — Users won't
    work without it.
14. **Storage buckets aren't part of your original schema** (it only
    defines tables) — `004_storage_buckets.sql` creates `product-images`
    (public) and `design-files` (private) with policies restricting
    writes to admins. Run this before trying to upload anything from
    the Products form, or uploads will fail with a "bucket not found"
    error.
15. **Design-file uploads return a Storage path, not a public URL** —
    the bucket is private by design (matches your schema's `-- private
    bucket` comment), so there's deliberately no public download link.
    Customer-facing file delivery after purchase needs its own flow
    (signed URLs, most likely) once checkout exists — not built yet
    since it depends on the payment provider decision flagged earlier.
16. **Role-toggle in Users has two safety rails I added, not requested
    explicitly**: promoting someone to admin requires a confirm dialog
    (demoting doesn't — lower consequence), and an admin can't change
    their own role from that table (avoids locking themselves out).
    Flagging since both are opinionated defaults rather than spec'd
    behavior — happy to remove either if you'd rather it be a plain
    toggle.
17. **Products form re-uploads on every file selection** — there's no
    "replace" confirmation or old-file cleanup on edit. Swapping a
    product image or design file on an existing product uploads a new
    Storage object and points the record at it, but the previous file
    stays in the bucket. Fine for now; worth a cleanup pass if Storage
    usage becomes a cost concern.
18. **Your original schema enables RLS on `orders` but never adds a
    policy for it** (every other table gets one). With RLS on and no
    policy, Postgres denies all access by default — including to
    admins — so the Dashboard's order count would silently show 0
    forever without a fix. `005_orders_policies.sql` adds an "own
    orders" policy for customers and an admin-manage-all policy, on the
    assumption this was an oversight rather than intentional lockdown —
    worth double-checking that assumption before running it.
19. **SEO metadata is dependency-free**, not using react-helmet or
    similar — a page component sets its own `<title>`/description via a
    small `useEffect`-based component. Fine for this app's needs (a
    handful of pages, no complex head management), but if the catalogue
    grows into hundreds of indexed product pages, revisit whether
    something more robust (proper SSR/prerendering for crawlers) is
    worth it — a client-rendered SPA's meta tags are invisible to
    crawlers that don't execute JS, which is a real limitation search
    engines increasingly work around but don't universally handle.

## Bugfix (post-launch)

`src/context/AuthContext.jsx` had a race condition: on initial load, it
called `loadProfile()` without awaiting it, then immediately set
`loading` to `false`. Route guards (`AdminRoute`, `ProtectedRoute`)
treat `loading: false` as "safe to check the role now" — so on a fresh
page load, an actual admin could get redirected away from `/admin`
simply because the profile query hadn't come back yet, making it look
like the role change didn't take effect. Fixed by awaiting the profile
fetch before clearing `loading`, and adding a second `profileLoading`
flag (combined into the same `loading` value exposed to consumers) so
the same gap can't reopen on a post-login profile refetch either.

## Native apps (Capacitor)

The Android (and later iOS) apps ship as a **bundled** Capacitor shell around
the Vite `dist/` build — not a remote WebView of the live site.

| | |
|---|---|
| **App name** | Om Design & Classes |
| **Package / bundle ID** | `com.omdesignandclasses.app` |
| **webDir** | `dist` |

### Build & sync (required before every native build)

Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RAZORPAY_KEY_ID`)
are baked in at **Vite build time**. They must be present in `.env` (or the
CI environment) when you run:

```bash
npm run cap:build   # = npm run build && npx cap sync
```

### Android (this machine)

1. Install [Android Studio](https://developer.android.com/studio) (JDK + SDK + an emulator or a USB device with debugging on).
2. `npm run cap:android` — builds, syncs, opens the project in Android Studio.
3. Or `npm run cap:run:android` for a connected device/emulator.

Confirm on a real device: admission/product image pick opens the **native**
camera/gallery sheet; design detail **Share** opens the OS share sheet;
hardware back walks in-app history.

### iOS (Codemagic)

Deferred until an Apple Developer Team ID is available. Do not configure
Universal Links / Associated Domains until then.

### Icons

Source assets live in `resources/icon.png` and `resources/splash.png`
(cleaned circular monogram on ivory). Regenerate platform mipmaps/splash:

```bash
npm run generate:assets
```

### Deep links (App Links)

Shared design URLs (`https://www.omdesignandclasses.com/designs/...`) open in
the app when installed. Verification files ship from `public/.well-known/` —
**deploy the web build** so they are live on the production domain.

- Android: `assetlinks.json` (debug SHA included; add release SHA after you
  create the upload keystore)
- iOS Universal Links: deferred until Apple Team ID is available

After deploy, rebuild the Android app (`npm run cap:build`) so the intent
filter + bundled JS deep-link handler stay in sync.

### Play Store — signed AAB (Android)

iOS / Codemagic is on hold until you have an Apple Team ID.

1. **Create the upload keystore once** (gitignored — back it up offline):

   ```powershell
   .\scripts\create-android-keystore.ps1
   ```

   That writes `android/release.keystore` + `android/key.properties` and prints
   the release SHA-256. Add that SHA to `public/.well-known/assetlinks.json`,
   then redeploy the website.

2. **Build the release bundle** (needs `.env` Vite vars present):

   ```bash
   npm run cap:aab
   ```

   Output: `android/app/build/outputs/bundle/release/app-release.aab`

3. **Play Console**
   - Create the app with package `com.omdesignandclasses.app`
   - Upload the AAB to **Closed testing** first
   - New personal Play Console accounts typically need **12 testers for 14 days**
     in closed testing before production access is granted — budget that into
     the launch timeline
   - Do **not** lose `release.keystore` / `key.properties`; without them you
     cannot ship updates as the same app

Review the AAB with me before submitting to production.


1. Run all five files in `supabase/migrations/` in order (001 is your
   original schema, saved here in case it wasn't already applied).
2. Enable phone auth + configure an SMS provider in the Supabase Auth
   dashboard.
3. Send me the project URL and anon key (or add them to `.env`
   yourself) — no code changes needed on either side once that's done,
   since every data-fetching function already branches on whether
   Supabase is configured.
4. Decide a payment provider for Buy Now/checkout — flagged throughout
   as deliberately unbuilt rather than guessed at.
5. Swap the placeholder photo slots (hero, story, team, category/product
   images) for real assets.

Happy to keep going on any of these, or on rougher edges (e.g. the
Storage-cleanup-on-replace note in judgment call #17) — just say which.
