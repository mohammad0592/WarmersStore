# دفا — Warming Products Store

Arabic-first (RTL) store for disposable air-activated warmers in Palestine.
Customers order packages online and send the order over WhatsApp (cash on delivery), or buy in person from authorized distributors.

- Requirements: [PROJECT_SPEC.md](PROJECT_SPEC.md)
- Architecture and roadmap: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)

## Stack

| Part | Tech |
|---|---|
| API | ASP.NET Core 10 (Minimal APIs), PostgreSQL, Serilog |
| Web | React + TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, i18next |
| Deploy | One Docker image (API serves the built SPA) on Railway, plus Railway PostgreSQL |

## Repository layout

```
src/WarmersStore.Api/          ASP.NET Core API; serves the SPA from wwwroot in production
src/web/                       React app (Vite)
tests/WarmersStore.UnitTests/  xUnit unit tests
tests/WarmersStore.IntegrationTests/  xUnit + WebApplicationFactory
Dockerfile                     Multi-stage production image
docker-compose.yml             Local PostgreSQL (+ optional production image)
railway.json                   Railway build/deploy settings
```

## Prerequisites

- .NET SDK 10
- Node.js 24
- Docker Desktop (for PostgreSQL)

## Local development

1. Start PostgreSQL. It listens on host port **5433**, so it doesn't clash with a locally installed PostgreSQL on 5432:

   ```bash
   docker compose up -d db
   ```

2. Run the API on http://localhost:5080:

   ```bash
   dotnet run --project src/WarmersStore.Api
   ```

   `appsettings.Development.json` points at the compose database. Its password is a local-only development value.
   In Development the API applies migrations at startup and seeds **sample data**: placeholder prices, packages, cities and distributors, all marked "(بيانات تجريبية)".

3. Run the web app on http://localhost:5173. Vite proxies `/api` and `/health` to the API.

   ```bash
   npm --prefix src/web install
   ```

   ```bash
   npm --prefix src/web run dev
   ```

Useful URLs while the API runs in Development:

- `GET /health` — liveness (process is up)
- `GET /health/ready` — readiness (database reachable)
- `GET /openapi/v1.json` — OpenAPI document (Development only)

## Database and migrations

EF Core with PostgreSQL, snake_case names. Migrations live in `src/WarmersStore.Api/Infrastructure/Persistence/Migrations`.

Add a migration after changing the model (restore the local `dotnet-ef` tool once with `dotnet tool restore`):

```bash
dotnet ef migrations add <Name> --project src/WarmersStore.Api -o Infrastructure/Persistence/Migrations
```

How the schema gets applied:

- **Development:** automatically at API startup.
- **Production:** never at app startup. The Docker image contains `efbundle`, a standalone migration runner. Railway runs it as the pre-deploy command; locally the compose `migrate` service runs it.

Seeding at startup:

| Data | When | Notes |
|---|---|---|
| Settings rows and the 4 products from the brief | Every environment, only if missing | Products start **inactive and unpriced**; the admin prices and activates them |
| Sample packages, cities, distributors, prices | Development only | Clearly marked placeholder data; never runs in Production |

To reset your local database, delete the compose volume. This erases all local data:

```bash
docker compose down -v
```

## Public API

| Endpoint | Returns |
|---|---|
| `GET /api/products`, `GET /api/products/{slug}` | Active products |
| `GET /api/packages`, `GET /api/packages/{slug}` | Active, non-deleted ready-made packages with contents, `regularPrice`, `isAvailable` |
| `GET /api/custom-package-rules` | Builder rules (`null` = not configured) |
| `GET /api/delivery-options` | Delivery mode, fees, active areas (per-area mode only) |
| `GET /api/store-settings` | Public store settings only |
| `GET /api/cities` | Active cities that have active distributors, with counts |
| `GET /api/distributors?cityId=`, `GET /api/distributors/{id}` | Active distributors in active cities, with a Google Maps link |
| `POST /api/checkout/quote` | Prices a cart from the database and reports rule problems per line (no personal data) |
| `POST /api/checkout/submit` | Validates cart and customer, returns the Arabic WhatsApp message and the `wa.me` link |

Checkout responses:

| Status | Meaning |
|---|---|
| `200` | Priced. For `submit`, the cart is valid and the WhatsApp link is ready |
| `400` | Malformed request: field-keyed `ValidationProblemDetails`, including customer details |
| `422` | Valid request but a business rule failed. The body is the quote; each error has a `code`, Arabic `message` and `params` |
| `429` | Rate limited per client IP |

The cart sends only ids and quantities; prices sent by a client are ignored. Opening WhatsApp doesn't mean the order was sent, so nothing is marked confirmed.

Submitting needs the store's WhatsApp number (`store_settings.whats_app_number`), which the admin sets in M11. Until then, `submit` returns `422 ordering_unavailable`.

## Admin dashboard (`/admin`)

ASP.NET Core Identity with an HttpOnly, SameSite=Strict session cookie. Accounts lock for 15 minutes after 5 failed sign-ins, and sign-in is rate-limited per IP. There is no public registration.

**The first admin** is created at startup from configuration, only while no admin exists. Nothing is hard-coded. Passwords need at least 12 characters, and long passphrases are encouraged.

- **Locally**, store the login in .NET user secrets, which live in your user profile and never in the repo:

  ```bash
  dotnet user-secrets set "Admin:Email" "you@example.com" --project src/WarmersStore.Api
  ```

  ```bash
  dotnet user-secrets set "Admin:Password" "a-long-passphrase-of-your-own" --project src/WarmersStore.Api
  ```

  Restart the API, then sign in at http://localhost:5173/admin. `dotnet user-secrets list --project src/WarmersStore.Api` shows what's stored.
- **In production**, set the Railway variables `Admin__Email` and `Admin__Password` for the first deploy. Once the account exists you can remove them; they're ignored after that.

Security notes:

- **Server-side checks:** every `/api/admin/*` endpoint except login requires the `Admin` role. An integration test fails the build if a new admin endpoint is ever mapped without it.
- **Cross-site protection:** state-changing admin requests must send the `X-Dafa-Admin` header; together with SameSite cookies this blocks cross-site request forgery.
- **Cookie keys:** the keys that encrypt the cookie are stored in PostgreSQL (`data_protection_keys`), so redeploys don't sign admins out.

## Tests

Integration tests start a throwaway PostgreSQL container (Testcontainers), so Docker must be running.

```bash
dotnet test
```

```bash
npm --prefix src/web test
```

```bash
npm --prefix src/web run lint
```

## Production image (locally)

Build and run the same image Railway will run, with the compose database:

```bash
docker compose --profile app up --build
```

Then open http://localhost:8080.

## Configuration

All production configuration comes from environment variables; nothing secret is committed. See [.env.example](.env.example).

| Variable | Purpose |
|---|---|
| `ConnectionStrings__Default` | Npgsql connection string (takes precedence) |
| `DATABASE_URL` | `postgres://` URL alternative, e.g. Railway's `${{Postgres.DATABASE_URL}}` |
| `ASPNETCORE_ENVIRONMENT` | `Production` in the image by default |
| `PORT` | Set by Railway; the app listens on it when present (otherwise 8080 in the container) |
| `Database__MigrateOnStartup` | `true` in Development; leave `false` in production (the pre-deploy step migrates) |
| `Database__SeedEssentialData` | Default `true`: settings rows plus the inactive initial catalog, inserted only if missing |
| `Database__SeedSampleData` | `true` in Development; ignored in Production |
| `RateLimiting__QuotePerMinute` | Quote requests per client IP per minute (default 60) |
| `RateLimiting__SubmitPerMinute` | Submit requests per client IP per minute (default 10) |
| `RateLimiting__LoginPerMinute` | Admin sign-in attempts per client IP per minute (default 10) |
| `Admin__Email`, `Admin__Password` | Create the first admin on startup if none exists; ignored afterwards |
| `Orders__UnconfirmedRetentionDays` | Days before unconfirmed or cancelled orders are deleted (default 90) |

The app refuses to start if no database is configured.

## Deployment (Railway)

Full deployment steps and the production checklist come in milestone M12. In short:

1. Create a Railway project from this GitHub repo. `railway.json` selects the Dockerfile, runs `./efbundle` (migrations) before each deploy, and uses the `/health` healthcheck.
2. Add a PostgreSQL service, and set `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the app service.
3. Generate a Railway domain. TLS is terminated by Railway, and the app trusts `X-Forwarded-*` headers.
