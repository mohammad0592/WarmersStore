# Implementation Plan — دفا

> Status: **Proposed — awaiting approval.** Requirements live in [PROJECT_SPEC.md](PROJECT_SPEC.md).

## 1. Architecture

**One Docker image** on Railway. ASP.NET Core 10 serves the built React SPA from `wwwroot` and the API under `/api`. Railway PostgreSQL is the database.

- **Same origin:** no CORS, and the admin uses HttpOnly/Secure/SameSite=Strict cookies.
- **Modular monolith:** one API project with vertical feature folders. Each feature owns its endpoints, DTOs, validation and EF configuration.
- **Migrations:** applied by the app at startup, in every environment (changed in M12; it used to be a separate `efbundle` pre-deploy step).
- **First admin:** created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars only if no admin exists.
- **Images:** stored through an `IImageStorage` abstraction, backed by a Railway Volume in v1 and swappable for S3/R2 later.
- **Cross-cutting:** ProblemDetails errors, Serilog, built-in rate limiter, security headers, OpenAPI in development only.

### 1.1 Architectural impact of authorized distributors

Distributors are a **separate, read-mostly directory feature**. Changes:

1. **New backend feature module `Features/Distributors`.** It owns `City` and `Distributor`: public read endpoints plus admin CRUD.
   - Hard isolation: no references to or from `Checkout`, `Orders`, `Cart`, `Delivery` or `Pricing`.
   - An architecture unit test enforces this. It fails the build if the `Distributors` namespace and the checkout/order namespaces reference each other.
2. **`City` is its own table**, used only by distributors. It is **not merged with `DeliveryArea`**:
   - Delivery areas describe *our* delivery zones and fees, which may not map 1:1 to cities.
   - Keeping them apart keeps the two purchasing methods independent.
   - A nullable link can be added later if ever useful.
3. **Google Maps is links only:**
   - No embedded maps, no Maps API key, no billing, and no third-party scripts tracking visitors.
   - The server builds the outbound map URL:
     - From coordinates when present: `https://www.google.com/maps/search/?api=1&query={lat},{lng}`.
     - Otherwise from the stored, validated Google Maps URL.
   - The server **never fetches or expands** short links (prevents SSRF).
4. **Shared building blocks are reused:** `IImageStorage` (shop photos), admin auth policy, validation, ProblemDetails.
5. **Store settings:** a `ShowDistributors` flag controls the nav link and the homepage "وين بتلاقينا؟" section. The section's text lives in `HomepageContent`.
6. **Frontend:** a new `features/distributors` (public page) and `features/admin/distributors`. The page has no cart or checkout imports, which an ESLint `no-restricted-imports` rule enforces.
7. **Caching:** public distributor and city responses are output-cached for a short time, and the cache is cleared on admin changes. This is cheap because the data rarely changes.

No new services, infrastructure or cost.

## 2. Database schema (PostgreSQL, EF Core)

Money is `numeric(10,2)`. "Unset" rules are `NULL`. Localized text is a JSON column `{ "ar": "...", "en": null }` (EF complex type).

```
Product
  Id, Slug (unique), Name, ShortDescription, Description, UsageGuidance?, SafetyInfo?
  WidthCm, HeightCm (numeric(5,1)), HeatMinHours, HeatMaxHours
  IsAdhesive bool?                   -- null = not specified
  PiecesPerRetailBag int
  SellingUnit (Piece | RetailBag), PiecesPerSellingUnit int
  UnitPrice numeric(10,2)?           -- per selling unit; required to activate
  IsActive, IsCustomEligible, DisplayOrder, CreatedAt, UpdatedAt, xmin (concurrency)
ProductImage        Id, ProductId → Product (cascade), StorageKey, AltText?, SortOrder (first = primary)

ReadyMadePackage (table "packages")  Id, Slug, Name, Description, ImageKey?, Price, IsActive, IsFeatured,
                    DisplayOrder, DeletedAt? (soft delete), CreatedAt, UpdatedAt
PackageItem         PK(PackageId, ProductId), Quantity > 0; FK Product = Restrict

CustomPackageSettings (single row)  IsEnabled, MinItems?, MaxItems?, MinSubtotal?, MaxQuantityPerProduct?
ProductCustomRule   ProductId PK → Product, MinQty?, MaxQty?
CustomDiscountTier  Id, MinItems, Type (Percent | Fixed), Value, IsActive

DeliveryArea        Id, Name, Fee, FreeDeliveryThreshold?, IsActive, DisplayOrder, Note?
DeliverySettings (single row)  Mode (None | Flat | PerArea), FlatFee?, FreeThreshold?, Message?

StoreSettings (single row)
  StoreName, LogoKey?, WhatsAppNumber (E.164), Phone?, Email?, Address?
  FacebookUrl?, InstagramUrl?, TikTokUrl?
  Homepage jsonb { HeroTitle?, HeroDescription?, WhereToFindText? }   -- M11; null fields fall back to built-in text
  Announcement?, AnnouncementActive, MinOrderTotal?
  ShowDistributors bool (default false)                         -- NEW

City                                                            -- NEW
  Id, Slug (unique, ASCII, for URLs), Name (localized), IsActive, DisplayOrder,
  CreatedAt, UpdatedAt

Distributor                                                     -- NEW
  Id
  Name            varchar(120), required
  CityId          → City (Restrict: a city in use can't be deleted)
  Address         varchar(300), required
  PhoneNumber     varchar(20)?   E.164
  GoogleMapsUrl   varchar(500)?  https + allow-listed Google Maps hosts
  Latitude        numeric(9,6)?  -90..90   } both or neither
  Longitude       numeric(9,6)?  -180..180 }
  ImageKey        varchar(200)?  storage key (public URL built at read time)
  IsActive        bool           requires (GoogleMapsUrl or coordinates) if that rule is approved
  DisplayOrder    int
  CreatedAt, UpdatedAt, xmin
  Indexes: (IsActive, CityId, DisplayOrder)

ApplicationUser (+ Identity tables)

-- if order persistence is approved (online orders only; no distributor link):
Order               Id, Reference, Status (PendingConfirmation | Confirmed | Cancelled | Completed),
                    CustomerName, CustomerPhone, Address, DeliveryAreaName (snapshot), Notes?,
                    Subtotal, Discount, DeliveryFee, Total, CreatedAt, StatusChangedAt, ExpiresAt
OrderItem           Id, OrderId, Kind (ReadyMade | Custom), PackageId?, NameSnapshot,
                    Quantity, UnitPrice, LineTotal
OrderItemProduct    OrderItemId, ProductId, ProductNameSnapshot, Quantity, UnitPrice
```

Notes:
- Distributors store `ImageKey`, not `ImageUrl`. The public URL comes from storage, so switching from a volume to R2 needs no data migration.
- **Deleting a distributor is a hard delete** (nothing references it) and also removes its image. The admin UI asks for confirmation first.

**Allowed Google Maps hosts:** `www.google.com/maps`, `google.com/maps`, `maps.google.com`, `maps.app.goo.gl`, `goo.gl/maps`, plus country domains `www.google.{ps,co.il}/maps`.

## 3. API

### Public (anonymous, cached where read-only)

| Method | Route | Notes |
|---|---|---|
| GET | `/api/products`, `/api/products/{slug}` | Active only |
| GET | `/api/packages`, `/api/packages/{slug}` | Active, not deleted |
| GET | `/api/custom-package-rules` | Effective rules (nulls = none) |
| GET | `/api/store-settings` | Public subset only |
| GET | `/api/delivery-options` | Mode and active areas with fees |
| POST | `/api/checkout/quote` | Cart → priced lines and per-line errors. No personal data. Rate-limited |
| POST | `/api/checkout/submit` | Cart and customer → validated summary, WhatsApp text and `wa.me` URL (+ order reference). Rate-limited |
| GET | `/api/cities` | **New.** Active cities with ≥1 active distributor, with `distributorCount` |
| GET | `/api/distributors?cityId={id}` | **New.** Active distributors in active cities, ordered by city order, then DisplayOrder |
| GET | `/api/distributors/{id}` | **New.** 404 if inactive |

Public distributor DTO: `id, name, city {id, slug, name}, address, phone?, mapUrl, imageUrl?`. No raw coordinates or internal fields are needed beyond `mapUrl`.

### Admin (`Admin` role, cookie auth, antiforgery on writes)

| Area | Routes |
|---|---|
| Auth | `POST /api/admin/auth/login`, `POST /api/admin/auth/logout`, `GET /api/admin/auth/me` |
| Dashboard | `GET /api/admin/dashboard` (counts, incl. active distributors) |
| Products | `GET/POST /api/admin/products`, `GET/PUT/DELETE /api/admin/products/{id}`, `POST/DELETE /api/admin/products/{id}/images[/{imageId}]`, `PUT /api/admin/products/order` |
| Packages | `GET/POST /api/admin/packages`, `GET/PUT/DELETE /api/admin/packages/{id}`, `PUT /api/admin/packages/{id}/image` |
| Custom rules | `GET/PUT /api/admin/custom-package-rules` |
| Delivery | `GET/PUT /api/admin/delivery-settings`, CRUD `/api/admin/delivery-areas` |
| Store | `GET/PUT /api/admin/store-settings`, `PUT /api/admin/store-settings/logo` |
| **Cities** | `GET/POST /api/admin/cities`, `PUT/DELETE /api/admin/cities/{id}` (409 if in use), `PUT /api/admin/cities/order` |
| **Distributors** | `GET /api/admin/distributors?cityId=&active=`, `POST /api/admin/distributors`, `GET/PUT/DELETE /api/admin/distributors/{id}`, `PATCH /api/admin/distributors/{id}/status`, `PUT/DELETE /api/admin/distributors/{id}/image`, `PUT /api/admin/distributors/order` |
| Orders (if approved) | `GET /api/admin/orders`, `GET /api/admin/orders/{id}`, `PATCH /api/admin/orders/{id}/status` |

**Distributor validation:**
- Name 2–120 characters; address 5–300.
- City must exist.
- Phone must parse to E.164.
- Map URL must be absolute `https` on an allowed host.
- Latitude and longitude come as a pair and must be in range.
- Images: JPEG/PNG/WebP by file signature, ≤ 5 MB, re-encoded to WebP and resized (max 1200 px).

## 4. Folder structure

```
WarmersStore/
├─ src/
│  ├─ WarmersStore.Api/
│  │  ├─ Features/
│  │  │  ├─ Catalog/ Packages/ CustomPackages/ Delivery/ Settings/
│  │  │  ├─ Checkout/        PricingEngine, RuleValidator, WhatsAppMessageBuilder
│  │  │  ├─ Orders/          (if approved)
│  │  │  ├─ Distributors/    City, Distributor, MapLinkBuilder, public + admin endpoints   ← new
│  │  │  ├─ Media/ Auth/ Dashboard/
│  │  ├─ Domain/ Infrastructure/ (DbContext, Migrations, Storage, Seeding) Common/
│  │  └─ Program.cs
│  └─ web/src/
│     ├─ app/ components/ui/ lib/ i18n/ stores/cart.ts
│     └─ features/
│        ├─ home/ products/ packages/ builder/ cart/ checkout/
│        ├─ distributors/    DistributorsPage, CityFilter, DistributorCard, empty states   ← new
│        └─ admin/{dashboard,products,packages,rules,delivery,settings,distributors,cities}
├─ tests/ WarmersStore.UnitTests/ WarmersStore.IntegrationTests/ (web e2e: Playwright)
├─ Dockerfile  docker-compose.yml  .env.example  README.md
```

## 5. Roadmap

Each milestone is small, testable and demoable.

| # | Milestone | Done when |
|---|---|---|
| M0 ✅ | Repo, solution, Vite app, compose Postgres, `/health`, SPA served by API, Dockerfile | `docker build` and run locally serve the SPA and `/health` |
| M1 ✅ | Entities and migrations (**incl. City, Distributor**), development-only placeholder seed (distributors marked "(بيانات تجريبية)"), public GET APIs (**incl. `/api/cities`, `/api/distributors`**) | Integration tests: only active items returned; city filter works; inactive distributor → 404 |
| M2 ✅ | Pricing engine, rule validator, quote and submit endpoints, WhatsApp message builder | Unit tests for every rule and for rounding; tampered-cart tests |
| M3 ✅ | Design system ported from the Figma code: tokens, fonts, RTL, header/footer (**nav incl. موزعونا المعتمدون**), mobile menu, i18n | Visual check at 375/768/1280 px |
| M4 ✅ | Home (**incl. "وين بتلاقينا؟" section**), products, product details, ready-made packages | Responsive checks; section hidden when `ShowDistributors` is false |
| **M5 ✅** | **`/distributors` page:** intro, in-store-only notice, city filter (URL-synced), cards, map CTA, both empty states, loading and error states | Vitest for filter/empty states; manual check of map links on Android/iOS; no cart/checkout imports (lint rule) |
| M6 ✅ | Custom builder and cart (saved in browser, edit/duplicate/remove, live quote) | Vitest plus manual testing |
| M7 ✅ | Checkout form and WhatsApp hand-off (+ saved orders if approved) | Playwright end-to-end flow |
| M8 ✅ | Admin login, roles, lockout, dashboard (**incl. active distributors count**) | Auth integration tests; anonymous → 401 on every admin route |
| M9 ✅ | Admin products (with images) and packages | |
| **M10 ✅** | **Admin إدارة الموزعين + cities:** list with city/status filters, create/edit form, Google Maps URL/coordinates validation, image upload, activate/deactivate, reorder, delete with confirmation; city CRUD | Integration tests: validation rejects non-Google/`http`/`javascript:` URLs, half-filled coordinates and bad images; city-in-use delete → 409; deactivated distributor disappears publicly |
| **M11 ✅** | **Admin custom rules, delivery, store settings (incl. `ShowDistributors` and "وين بتلاقينا؟" text), orders list:** store settings + logo, custom-package limits/per-product rules/discount tiers, delivery mode + areas, orders list (status filter, search) with details and status changes | Integration tests: settings validation and WhatsApp normalization (ordering turns on once set), rules round-trip and public rules, PerArea needs an active area, Flat needs a fee, order search/details, only allowed status moves (409 otherwise) |
| M12 | **Hardening, Railway deploy, production checklist, README:** Content-Security-Policy, response compression, 1 MB default request limit, startup migrations, low-memory runtime settings, lazy checkout, Arabic error page, robots.txt, deployment guide | Integration tests: CSP and compression. Production image checked locally. **Smoke test on the live deployment is still to run after the push** |

M5 depends only on M1 and M3. It can be built in parallel with M6–M7 because it shares no code with the cart or checkout.

## 6. Implementation notes

Decisions taken while building that refine the plan above:

- **M1, initial catalog:** the four products from the brief are seeded in every environment, **inactive and unpriced**. The admin adds prices and photos, then activates them. Their default selling unit is the factory retail bag, so bags are never split; this is changeable per product until the selling-unit decision is made.
- **M1, no singleton rows in migrations:** the settings rows (store, delivery, custom-package) are inserted by the startup seeder when missing, not by migrations. Each table has a `CHECK (id = 1)`.
- **M1, product visibility:** the public product list shows active products even without a price, because the catalog page doesn't show prices. `availableForCustom` is true only when the product is active, eligible and priced.
- **M1, package availability:** a package that contains an inactive product is still listed, with `isAvailable: false`. `regularPrice` (the contents bought individually) is null when any content is unpriced.
- **M1, cities:** `/api/cities` lists only cities a customer can pick, meaning active cities with at least one active distributor.
- **M1, local Postgres:** compose publishes on host port 5433 to avoid clashing with a natively installed PostgreSQL.
- **M2, store-wide max per product:** `CustomPackageSettings.MaxQuantityPerProduct` was added (the brief lists it among the custom-package settings). When a per-product rule also exists, the stricter limit applies.
- **M2, rule semantics:**
  - Custom-package limits apply **per custom package**, not across the cart.
  - Items are counted in selling units.
  - `MinSubtotal` is compared **before** the package's discount.
  - The store-wide `MinOrderTotal` is compared with the cart subtotal **after** discounts and before delivery.
- **M2, discounts:**
  - The tier with the highest reached `MinItems` applies, to custom packages only.
  - Percentages round to the nearest agora, half away from zero.
  - A discount never exceeds the package subtotal.
- **M2, delivery:**
  - Per-area mode: a quote without an area returns `fee: null`; submitting without one is an error. An area's own free-delivery threshold overrides the global one.
  - `None` mode charges nothing, and the message says delivery is "confirmed when we contact you".
- **M2, error contract:**
  - Malformed requests (shapes the UI can't produce) → 400.
  - Business-rule failures → 200 on quote, or 422 on submit, with the quote and per-line `{code, message, params}`.
  - Missing store WhatsApp number → 422 `ordering_unavailable`.
- **M2, customer input:**
  - Phone numbers are normalized to E.164: spaces, dashes, a leading `00` and Arabic-Indic digits are accepted.
  - Control characters are removed, and line breaks are kept only in the notes and delivery instructions.
- **M2, no order persistence yet:** `submit` returns `reference: null`, and the message has no reference line until saved orders are decided (M7).
- **M3, design source:** the Figma Make code export lives in `design/figma-export/` and is git-ignored. It is a Next.js + Payload app, used only as a visual reference: its tokens, icons and component styles were ported into `src/web`, and its Payload/CMS parts are ignored.
- **M3, content the export hardcodes:** the announcement bar comes from store settings and is hidden when empty. The export's fixed announcement text, delivery claim and safety copy are not reused.
- **M3, navigation:** "موزعونا المعتمدون" appears in the header, mobile menu and footer only when `showDistributors` is on, though `/distributors` stays reachable directly. Products, packages and distributors show "coming soon" placeholders until M4/M5.
- **M3, cart button:** the design's header cart button is added in M6 together with the cart, so the site never shows a button that does nothing.
- **M3, font:** Cairo is self-hosted (`@fontsource-variable/cairo`) instead of the export's Google Fonts import. That avoids a third-party request and keeps a future Content-Security-Policy simple.
- **M4, product details:** a real page at `/products/:slug` (shareable, with a browser tab title) rather than the export's modal. Unknown specs are left out instead of guessed. Usage and safety sections appear only once that text exists. Durations read as "8–10 ساعات تقريباً", following the brief's "approximately".
- **M4, product cards:** they add size and bag contents to the design's duration and adhesive chips, as the brief requires. No prices are shown in the catalog; the sales flow leads to `/packages`.
- **M4, package cards:**
  - A savings badge ("وفّر X ₪") shows when the package is cheaper than its contents bought separately. Otherwise a "باقة مميّزة" chip shows for featured packages.
  - Unavailable packages stay listed, dimmed and labelled.
  - Quantity and add-to-cart controls arrive in M6.
- **M4, home:**
  - Featured packages are shown, or the first three if none are featured.
  - The products and packages sections hide when empty.
  - "وين بتلاقينا؟" shows the two ways to buy as separate cards, only while `showDistributors` is on.
  - The design's safety bullets in the trust panel were replaced with non-claims (cash on delivery, no account needed). The WhatsApp panel appears only once a number is configured.
- **M5, distributors page:**
  - All visible distributors are loaded once and filtered on the client by `?city=<slug>` (the data is small). The city chips come from `/api/cities`, so only cities with active shops are offered.
  - Distributors are grouped under city headings.
  - Your intro text and the in-store-only notice appear word for word, with the notice always visible above the list.
- **M5, cards:**
  - The primary action is "عرض الموقع على الخريطة", which opens Google Maps in a new tab. The phone is a `tel:` link.
  - A card without a map link says so instead of showing a dead button.
  - As a second line of defence, the frontend renders only `https:` map links.
- **M5, empty states:**
  - No distributors at all: "coming soon", with a link to order online.
  - Unknown city or no shops in it: a link back to all cities and one to order online. These are the page's only links into online ordering; there are no cart, order or delivery buttons.
- **M5, isolation:** an `oxlint` `no-restricted-imports` override stops `src/features/distributors/**` from importing cart, checkout, packages or builder code.
- **M6, cart storage:**
  - The cart is a Zustand store saved to `localStorage` under `dafa-cart`, holding line ids, package/product ids, quantities, and package names for display while loading. No prices are stored.
  - Whatever is read back is checked first. Malformed lines, duplicate ids and duplicate products are dropped, and quantities are capped (99 per ready-made line, 999 per product). The 30-line limit matches the API.
  - If storage is blocked, the cart works in memory only.
- **M6, prices:** every amount in the drawer comes from `POST /api/checkout/quote`, which re-runs when the cart changes, and the server's per-line errors are shown on the line. The builder's live total is a client-side copy of the server rules (`customPricing.ts`, unit-tested against the same rounding cases) for instant feedback; the cart then shows the server's numbers.
- **M6, cart lines:**
  - Adding the same ready-made package again increases its quantity.
  - Every custom package is its own line, and can be edited (`/packages?edit=<lineId>#custom` loads it into the builder and "حفظ التعديلات" updates it in place), duplicated (the copy goes right after it) or removed.
  - The header badge counts ready-made quantities plus one per custom package.
- **M6, builder:** shows only products that are `availableForCustom`. The −/+ control stops at the stricter of the store-wide and per-product maximums, and the first unmet rule is shown as an Arabic hint. "Add" stays disabled until every rule is met. The whole section shows a message instead when custom packages are switched off.
- **M6, drawer:** behaves as a dialog (Escape closes it, focus stays inside it and returns afterwards, the page behind doesn't scroll), with an empty state.
  - Delivery reads "يتم تأكيده عند التواصل" (mode None), "حسب منطقة التوصيل" (per-area, no area chosen yet), "مجاني" or the fee.
  - The checkout button joins in M7.
- **M6, hash links:** `/packages#custom` (home, footer, drawer "تعديل") now scrolls to the builder after client-side navigation.
- **M7, orders (decided: save orders):**
  - `submit` saves a **PendingConfirmation** order before sending the customer to WhatsApp. Statuses are PendingConfirmation → Confirmed / Cancelled → Completed; nothing moves automatically. The brief's *Draft* status isn't used, because an order only exists once the customer presses send.
  - Each order is a full snapshot: customer details, delivery mode/area, totals, each line, the products in each line with names and prices, and the exact WhatsApp text the customer was handed. Order lines aren't foreign keys to products or packages, so catalog edits and deletions never change past orders.
- **M7, references:** `DF-YYMMDD-XXXX` (UTC date plus 4 characters from an alphabet without 0/O/1/I/L), with a unique index and retry on collision.
- **M7, idempotency:** the checkout page sends a `submissionId` (one per visit). Resubmitting with it returns the existing order instead of creating a second one, including when two requests race.
- **M7, retention:** a background service deletes PendingConfirmation and Cancelled orders 90 days after their last status change (`Orders__UnconfirmedRetentionDays`). Confirmed and Completed orders are kept as business records.
- **M7, checkout page (`/checkout`):**
  - It's a page rather than the design's modal, using the design's form and summary layout.
  - The phone field has a country selector (+970 default, +972, other). "0599 123 456" becomes `+970599123456`, and a full `+…` or `00…` number is accepted with any selector.
  - In per-area mode a delivery area is required, and the summary re-quotes with it.
  - Server field errors (400) map onto the fields; business-rule failures (422) appear in the summary; the button is disabled until a store WhatsApp number is set.
- **M7, after sending:** the cart is cleared, the reference and wa.me link are kept in `sessionStorage`, and the browser goes to `/checkout/sent` and then WhatsApp via `location.assign` (mobile browsers block `window.open` after a request). The sent page repeats that the order counts only once it's sent in WhatsApp, and can reopen WhatsApp. Only `https://wa.me/` links are accepted from storage.
- **M8, admin authentication:**
  - ASP.NET Core Identity (`AddIdentityCore` + role `Admin`). Identity tables are renamed to snake_case like the rest of the schema.
  - The session cookie `dafa_admin` is HttpOnly, SameSite=Strict, Secure in production, lasts 8 hours with sliding renewal, and is a session cookie.
  - Passwords need at least 12 characters and no composition rules (NIST SP 800-63B). Accounts lock for 15 minutes after 5 failures.
  - Wrong password, unknown account, locked account and non-admin user all get the same 401, and unknown accounts still run a password hash so timing reveals nothing.
  - Login is rate-limited per IP, and admin requests that change data must send `X-Dafa-Admin`.
- **M8, guard test:** `EveryAdminEndpointExceptLogin_RequiresTheAdminPolicy` walks every route under `/api/admin` and fails if any lacks the policy, which protects M9–M11 endpoints as they're added.
- **M8, first admin:** created at startup from `Admin:Email` / `Admin:Password` (user secrets locally, Railway variables in production) only while no admin exists. The password is never logged.
- **M8, keys:** data-protection keys are persisted in PostgreSQL so cookies survive redeploys and could be shared by multiple instances.
- **M8, admin frontend:**
  - `/admin/*` is a lazy-loaded chunk (~10 KB) with its own layout and no storefront header, footer or cart; it's marked `noindex`.
  - A 401 from any admin call re-checks `/me`, which sends the user to `/admin/login?next=…` (`next` is restricted to `/admin` paths).
  - The dashboard shows counts plus a launch checklist (WhatsApp number, prices, active products and packages, distributors visibility). The sidebar gains sections as M9–M11 add them.
- **M8, bundle size:** the main storefront bundle is ~188 KB gzipped. Lazy-loading checkout (form libraries) is a candidate for M12.
- **M9, admin catalog:**
  - Products: CRUD, reorder, and up to 10 images each (upload with alt text, reorder, delete). The first image is the main one.
  - Packages: CRUD with item rows, a single image, reorder, and soft delete. A deleted package's slug can be reused.
  - Edits use optimistic concurrency (`xmin` version → 409 with a "reload" option). Validation messages are Arabic and keyed per field, with `items[i].x` mapped onto form rows.
  - A product can't be activated without a price. One that's in a package can't be deleted (409 naming the packages); deactivate it instead.
  - `PiecesPerSellingUnit` is derived from the selling unit (piece = 1, bag = pieces per bag), so bags are never split.
- **M9, images:**
  - **SkiaSharp** (MIT) instead of ImageSharp: v4 needs a license key for Release builds, and 3.1.x has unpatched high-severity advisories.
  - Uploads are validated by content, limited in size and pixel count, oriented from EXIF (all 8 orientations unit-tested), resized to ≤1600 px, re-encoded to WebP without metadata, and stored under random keys behind `IImageStorage` (local disk now, S3/R2 later).
  - Served from `/media` with an immutable cache. Old files are deleted on replace or delete.
  - Docker uses `/data/media`, owned by the app user, with a compose `media` volume. On Railway, attach a Volume at `/data/media`.
  - (Done before M12) Railway mounts volumes owned by root. `docker-entrypoint.sh` starts as root, gives the media folder (and anything root wrote there) to the app user, then drops to that user with `setpriv` (no capabilities). The app never runs as root, and `RAILWAY_RUN_UID` isn't needed.
- **M9, product details:** changed from a page to the design's modal at `/products/:slug`, nested over the catalog. It's shareable, closes with Back or Escape, and is a bottom sheet on phones.
- **M9, dev and ops fixes:**
  - Vite now proxies `/media`. Requests the browser abandons are logged as 499 at info level, not as 500 errors.
  - Vitest is capped at 4 workers (out-of-memory crashes on low RAM).
  - Compose builds the production image and publishes it on 8088.
- **M10, cities:**
  - Add, rename, change the slug, activate or deactivate, and reorder, all on one admin page.
  - Deleting a city that still has distributors returns 409 with a clear message (the database also restricts it).
  - Cities stay separate from delivery areas.
- **M10, distributors:**
  - Admin list with city and status filters, a quick active/inactive toggle, and reordering within a selected city.
  - The form covers name, city, address, phone, Google Maps link, coordinates, active status and one shop photo.
  - Moving a shop to another city puts it at the end of that city's list. Edits use the `xmin` version, so a stale edit returns 409.
  - Deleting is a hard delete that also removes the photo; nothing references distributors.
- **M10, map links:**
  - Only https Google Maps links are accepted: `google.{com,ps,co.il}/maps`, `maps.google.com`, `maps.app.goo.gl` and `goo.gl/maps`. That rejects http, `javascript:`, look-alike hosts, credentials in the URL and non-default ports (unit-tested). The server never fetches them.
  - Coordinates come as a pair within range, with at most 6 decimals. The map link is built from them without trailing zeros.
- **M10, activation needs a location (decision #2 applied):** a distributor can't be active without a map link or coordinates, because the page's main button depends on it. It can be saved inactive without one.
- **M10, phone numbers:**
  - Normalization moved to `Common/PhoneNumbers` and is shared by checkout and distributors, so distributors don't depend on the checkout code.
  - A distributor number written locally with one leading 0 (`059…`, `09…`) is read as +970. International numbers are kept.
- **M10, still pending:** the `ShowDistributors` switch (nav link and homepage section) is set in M11's store settings.
- **M11, store settings:**
  - One page covers store name, WhatsApp number, minimum order, the `ShowDistributors` switch, the announcement, homepage text, contacts, social links and the logo.
  - The WhatsApp number and phone use the same normalization as distributors (a local `059…` is read as +970). Social links must be https.
  - An announcement can't be switched on while empty.
  - Homepage text (hero title, hero description, "وين بتلاقينا؟" text) is optional. Each empty field falls back to the built-in Arabic text, which the admin form shows as the placeholder. Badges, buttons and section titles stay in the translation file.
  - The logo is stored like other images (validated, resized, WebP) under `branding/`.
- **M11, custom-package rules:**
  - The whole rule set is saved at once. Per-product rules and discount tiers are replaced, not merged. Empty limits are sent as null ("no rule"), and per-product rows with no limits are dropped.
  - Validation: min ≤ max, unique products and tier thresholds, percentages ≤ 100. Inactive tiers are kept for the admin but not published.
- **M11, delivery:**
  - Mode `None` / `Flat` / `PerArea`. Flat requires a fee; PerArea requires at least one active area.
  - Areas have add, edit, reorder and delete. Deleting an area never changes past orders, because they keep a copy of its name.
- **M12, migrations:** on Railway the pre-deploy `efbundle` step left the first deploy without tables, and its logs weren't available to find out why. The app now migrates at startup, which leaves one mechanism everywhere and needs no special variable. `efbundle` and the compose `migrate` service are gone. A failed migration fails the health check, so the previous deployment keeps running.
- **M12, hardening:**
  - The CSP allows only the site's own origin (plus `data:` images), with no `unsafe-*`. Checked in a browser against the production image: no violations.
  - Railway doesn't compress responses, so the 635 KB main script was sent in full. The app now compresses text responses itself (Brotli or gzip, not images).
  - Request bodies are limited to 1 MB by default. Image uploads keep their own 6 MB limit, confirmed with a 2.7 MB upload through Kestrel.
  - Runtime: workstation GC, no concurrent GC, no tiered PGO. Under the same local load this used about 100 MB against 138 MB.
  - Checkout is a separate bundle, so first-load JavaScript drops from ~188 KB to ~155 KB gzipped.
  - Rate limits rely on the proxy's `X-Forwarded-For`, using the last address. This hasn't been checked from behind Railway's proxy.
- **M11, orders:**
  - Newest first, 25 per page. Status filter and search (by reference, name, or 4+ phone digits) live in the URL.
  - The details page shows the items, totals, customer and the expected WhatsApp message, with a copy button and a link that opens the chat.
  - Allowed status moves: pending → confirmed or cancelled, and confirmed → completed or cancelled. Completed and cancelled are final. Anything else returns 409.
  - Every change goes through a confirmation dialog. Nothing confirms an order automatically; the page reminds the admin that opening WhatsApp isn't sending.
