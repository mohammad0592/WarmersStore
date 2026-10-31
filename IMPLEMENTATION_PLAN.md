# Implementation Plan — دفا

> Status: **Proposed — awaiting approval.** Requirements live in [PROJECT_SPEC.md](PROJECT_SPEC.md).

## 1. Architecture

**One Docker image** on Railway. ASP.NET Core 10 serves the built React SPA from `wwwroot` and the API under `/api`. Railway PostgreSQL is the database.

- **Same origin:** no CORS, and the admin uses HttpOnly/Secure/SameSite=Strict cookies.
- **Modular monolith:** one API project with vertical feature folders. Each feature owns its endpoints, DTOs, validation and EF configuration.
- **Migrations:** the image ships an EF migration bundle (`efbundle`), run as Railway's pre-deploy command (and by the compose `migrate` service locally). Development migrates at startup.
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
  HomepageContent jsonb (incl. "وين بتلاقينا؟" text)          -- added in M11 once its shape is known
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
| M3 | Design system ported from the Figma code: tokens, fonts, RTL, header/footer (**nav incl. موزعونا المعتمدون**), mobile menu, i18n | Visual check at 375/768/1280 px |
| M4 | Home (**incl. "وين بتلاقينا؟" section**), products, product details, ready-made packages | Responsive checks; section hidden when `ShowDistributors` is false |
| **M5** | **`/distributors` page:** intro, in-store-only notice, city filter (URL-synced), cards, map CTA, both empty states, loading and error states | Vitest for filter/empty states; manual check of map links on Android/iOS; no cart/checkout imports (lint rule) |
| M6 | Custom builder and cart (saved in browser, edit/duplicate/remove, live quote) | Vitest plus manual testing |
| M7 | Checkout form and WhatsApp hand-off (+ saved orders if approved) | Playwright end-to-end flow |
| M8 | Admin login, roles, lockout, dashboard (**incl. active distributors count**) | Auth integration tests; anonymous → 401 on every admin route |
| M9 | Admin products (with images) and packages | |
| **M10** | **Admin إدارة الموزعين + cities:** list with city/status filters, create/edit form, Google Maps URL/coordinates validation, image upload, activate/deactivate, reorder, delete with confirmation; city CRUD | Integration tests: validation rejects non-Google/`http`/`javascript:` URLs, half-filled coordinates and bad images; city-in-use delete → 409; deactivated distributor disappears publicly |
| M11 | Admin custom rules, delivery, store settings (**incl. `ShowDistributors` and "وين بتلاقينا؟" text**), orders list | |
| M12 | Hardening, Railway deploy, production checklist, README | Smoke test on the live deployment |

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
