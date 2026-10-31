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

1. Start PostgreSQL:

   ```bash
   docker compose up -d db
   ```

2. Run the API on http://localhost:5080:

   ```bash
   dotnet run --project src/WarmersStore.Api
   ```

   `appsettings.Development.json` points at the compose database. Its password is a local-only development value.

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

## Tests

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

The app refuses to start if no database is configured.

## Deployment (Railway)

Full deployment steps and the production checklist come in milestone M12. In short:

1. Create a Railway project from this GitHub repo. `railway.json` selects the Dockerfile and the `/health` healthcheck.
2. Add a PostgreSQL service, and set `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the app service.
3. Generate a Railway domain. TLS is terminated by Railway, and the app trusts `X-Forwarded-*` headers.
