# Project Specification — دفا (Arabic Warming Products Store)

> Status: **Draft — awaiting approval.** Brand name "دفا" is the working name from the Figma design and is not final.
> This file is the single source of truth for requirements. Illustrative values (prices, package contents, limits, fees) are **placeholders**, never finalized business decisions.

## 1. Business overview

We import disposable air-activated warming products from China and sell them in Palestine.

Customers have **two independent ways to buy**:

| | Option A — Order online (website) | Option B — Buy from an authorized distributor |
|---|---|---|
| Where | Our website | A physical shop in the customer's city |
| How | Ready-made packages and/or custom packages → cart → checkout → WhatsApp | Find a shop on `/distributors` → visit it in person |
| Delivery | Delivered by **our business** | **None.** Customer visits the shop |
| Payment | Cash on delivery to us | Paid directly to the seller in the shop |

**Critical rule:** distributors are **not** connected to the cart, checkout, delivery, WhatsApp ordering, or orders in any way. The two methods stay clearly separated in UI, API and data.

No customer registration or login. No online payment gateway. Mobile-first, Arabic-first (RTL), English may be added later.

## 2. Design reference

- Published site: https://salt-cosmic-71429179.figma.site
- Figma Make project: https://www.figma.com/make/SNYntpuEfDqAaxEJlDPzgE/Arabic-Warming-Products-Store
- The design is the visual source of truth (layout, colors, typography, spacing, RTL, responsiveness). Its Make source code should be exported so components can be ported directly.
- The design has **no distributors page or section yet**. Those must be designed in the same visual language.
- Content in the design that is **not** approved business content and must be treated as placeholder:
  - Prices and package contents (e.g. باقة الأسبوع 49 ₪, باقة العائلة 99 ₪, "وفّر 1 ₪").
  - Safety text (e.g. "لا تضع اللاصق مباشرة على الجلد", "للاستخدام الخارجي فقط"). Real safety guidance will be supplied by the business.
  - Delivery claim "توصيل لجميع مناطق الضفة الغربية".
  - Foot warmer labelled "غير لاصق" (adhesive status not stated in the brief).

## 3. Products

Four product types at launch. **Everything below is editable in the admin**: specs, images, enabled/disabled, display order.

| # | Arabic name | Size | Heat duration | Adhesive | Pieces per factory retail bag |
|---|---|---|---|---|---|
| 1 | لاصق تدفئة الجسم | 10 × 13 cm | ~8–10 h | Yes | 1 |
| 2 | دفاية اليدين | 5.5 × 9 cm | ~8–10 h | No | 2 |
| 3 | دفاية القدم | 8 × 12 cm | ~3–4 h | Not specified | 2 |
| 4 | لاصق تدفئة أصابع القدم | 7 × 10 cm | ~7–8 h | Yes | 2 |

- Distinguish **individual warmer**, **factory retail bag**, and the **selling unit** the customer picks. The selling unit per product is configurable (piece or retail bag). All quantities are expressed in selling units, and the UI also shows the piece count.
- No invented certifications, medical claims, safety instructions or extra specs. Descriptions and safety guidance will be supplied later.

## 4. Customer website (public)

Arabic-first RTL, natural Palestinian Arabic, all UI strings in translation files (i18n-ready). Loading, empty, error and validation states everywhere.

### 4.1 Navigation (header + mobile menu)

الرئيسية · المنتجات · الباقات · **موزعونا المعتمدون** · cart icon · WhatsApp contact.

### 4.2 Home — `/`

- Logo and navigation, optional store announcement bar.
- Hero: "خليك دافي وين ما كنت" with CTAs to Packages and Products.
- Overview of the four products.
- The two online purchase options (ready-made / custom), with clear messaging that packages can be customized.
- Featured packages.
- How ordering works: 1) اختر باقاتك 2) أضفها للسلة 3) أدخل معلومات التوصيل 4) أرسل طلبك عبر واتساب
- Cash-on-delivery information.
- **"وين بتلاقينا؟" section (new):**
  - Description: "بتقدر تطلب أونلاين مع التوصيل، أو تزور أحد موزعينا المعتمدين وتشتري منتجاتنا مباشرة من المحل."
  - Shown as two clearly separated choices:
    - **Order online (with delivery)** → `/packages`
    - **Buy in a shop** → CTA "اكتشف موزعينا" → `/distributors`
- WhatsApp contact button, footer with contact and social links.

### 4.3 Products — `/products` and `/products/:slug`

Catalog of active products: image, name, description, heat duration, dimensions, adhesive status (when known), pieces per retail bag, "عرض التفاصيل". The details view shows full specs, plus usage and safety guidance once supplied. The primary flow guides customers toward `/packages`.

### 4.4 Packages — `/packages` (main sales page)

- **الباقات الجاهزة:** name, description, optional image, included products × quantities, price (₪), availability, optional featured badge, quantity selector, add to cart. Several different packages can be in the cart at once.
- **صمّم باقتك على كيفك:** per product, image, name, price per selling unit, +/− controls and subtotal. Also shows total units, a live total, validation messages, and "add custom package to cart". Customers can create many custom packages, and edit, remove or duplicate them.
- Custom package rules (min/max items, min order value, max per product, product eligibility, quantity discounts) are **admin-configurable and unset by default**. They are enforced on the backend.

### 4.5 Authorized distributors — `/distributors` (new)

Page title: **موزعونا المعتمدون**. Same design system as the rest of the site.

- **Intro:** "بتفضّل تشتري من المحل؟ منتجاتنا متوفرة لدى موزعينا المعتمدين في عدة مدن. اختار مدينتك، اعرف أقرب موزّع إلك، وزوره مباشرة لشراء منتجاتنا."
- **Prominent notice (always visible above the list):** "الشراء من الموزعين يتم من داخل المحل فقط، ولا تتوفر خدمة التوصيل من خلالهم."
- **City filter:** "كل المدن" plus the cities that have active distributors. Chips on mobile or a select. The selection is reflected in the URL (`/distributors?city=<slug>`) so it can be shared.
- **Responsive grid of cards.** Each card shows:
  - Shop name, city, physical address.
  - Optional shop photo/logo, with a branded fallback.
  - Optional phone number (rendered LTR, as a `tel:` link).
  - "موزع معتمد" badge.
  - Primary CTA **"عرض الموقع على الخريطة"**, which opens Google Maps in a new tab/app.
- **Empty states:**
  - City selected but no distributors there: a friendly message plus a link back to "كل المدن" and a link to order online with delivery.
  - No distributors at all: a "coming soon" message plus a link to order online.
- **Not on this page:** "اطلب الآن", "أضف للسلة", distributor WhatsApp ordering, or any delivery option. (The site-wide header cart icon stays as it is on every page.)
- **No real distributor data is invented.** Placeholder distributors exist only in development seed data and are clearly marked "(بيانات تجريبية)".

### 4.6 Cart

A unified cart for ready-made and custom packages. Each line has a unique ID.
- Ready-made lines: quantity +/− and remove.
- Custom lines: edit, duplicate and remove.
- Shows: package name, contents, unit price, subtotal, total, delivery fee (if configured), and estimated final total.
- Saved in localStorage (IDs and quantities only). Never trusted for prices; the backend recalculates.

### 4.7 Checkout and WhatsApp

- **Required:** full name, WhatsApp number with country code (default +970, international numbers allowed), delivery address.
- **Optional:** delivery instructions, notes.
- The full order summary is shown before sending.
- On "إرسال الطلب عبر واتساب":
  1. Validate the form on the client.
  2. The server re-prices from the database, checks availability and rules, and builds the Arabic message.
  3. The browser opens `wa.me`, and the customer presses Send.
- The message includes: reference (if orders are saved), customer name/phone/address, every package with its quantity, full contents of each custom package, subtotals, delivery fee, total, cash on delivery, and notes.
- Opening WhatsApp ≠ order sent. Orders are never auto-confirmed. No WhatsApp Business API in v1.

## 5. Admin dashboard — `/admin`

ASP.NET Core Identity, cookie session, server-side authorization on every admin endpoint, no public registration, no hardcoded password.

- **Login / logout**, protected routes, safe errors, lockout.
- **Overview:** active products, active ready-made packages, whether custom packages are enabled, **active distributors count**, quick links. No invented order statistics.
- **Products:** create/edit names, descriptions and specs; selling unit and price; images; enable/disable; display order.
- **Ready-made packages:** create/edit name, description, items × quantities, price, image, featured, enable/disable, delete.
- **Custom package settings:** enabled, min/max items, min order amount, max per product, eligibility, discounts.
- **Delivery settings:** areas, fees, free-delivery threshold, messages. (Applies to online orders only.)
- **Store settings:** store name, logo, WhatsApp business number, contact info, social links, homepage text (including the "وين بتلاقينا؟" section text), announcements.
- **إدارة الموزعين (new):**
  - Add, edit, activate/deactivate, delete (with a confirmation dialog), and reorder distributors.
  - Assign a distributor to a city.
  - Physical address.
  - Google Maps link and/or coordinates.
  - Shop photo/logo upload, replace and remove.
  - Optional phone number.
  - Only active distributors appear publicly.
- **Cities (new, part of distributor management):** add, rename, reorder, activate/deactivate. A city can't be deleted while distributors reference it.
- Distributors have **no accounts** and no dashboard access in v1.

## 6. Explicitly out of scope

- Distributors: delivery, carts, checkout, WhatsApp ordering, inventory sync, commissions, payments, login accounts, order management.
- Online payments, customer accounts, WhatsApp Business API, microservices or message brokers.

## 7. Technology

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, React Router, TanStack Query, Zustand (cart), React Hook Form + Zod, i18next.
- **Backend:** ASP.NET Core 10 Minimal APIs (modular monolith), EF Core 10 + PostgreSQL, Identity, ProblemDetails, Serilog, rate limiting, OpenAPI (development only).
- **Deploy:** one multi-stage Docker image on Railway (API serves the SPA) plus Railway PostgreSQL. Config comes from environment variables, and no secrets are in Git.

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for architecture, schema, API and roadmap.

## 8. Security and privacy requirements

Server-side authorization; Identity password hashing; backend price/rule validation; protection against tampered cart data; safe uploads (signature check, size limit, re-encode, random names); input validation including **map URL validation**; rate limiting on public write endpoints and login; strict CORS (same-origin); no connection strings in the frontend; minimal personal-data collection with a retention policy if orders are stored.

## 9. Open business decisions

| Decision | Blocks | Recommendation |
|---|---|---|
| Save orders (PendingConfirmation) or not | Checkout milestone | Yes, with a retention period |
| Selling unit per product (piece vs retail bag) | Builder/cart milestone | Configurable per product |
| Delivery fee model (none / flat / per area) | Checkout milestone | Per area |
| Price rounding (whole ₪ or agorot) | Pricing milestone | Store 2 decimals, display whole ₪ when exact |
| Show the distributors nav link and homepage section when there are zero active distributors? | Distributors milestone | Admin toggle, off until the first real distributor is added |
| Require a map link/coordinates before a distributor can be activated? | Distributors milestone | Yes, since the main CTA depends on it |
| Initial list of cities | Admin seed | Seed only the city names you confirm. Admin can add more |
| Figma Make code export | Design-system milestone | Export or push to GitHub |
| Image storage on a Railway Volume | Media milestone | Yes for v1 |

Deferred to admin configuration: all prices, package contents, custom-package limits and discounts, delivery areas and fees, WhatsApp number, product descriptions and safety text, photos, logo, social links, real distributor data, domain.
