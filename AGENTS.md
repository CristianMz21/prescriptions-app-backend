# AGENTS.md — Backend Prescriptions App

## Stack
- **NestJS + TypeScript + Prisma 6 + PostgreSQL** (port 5433, not default 5432)
- **Package scripts**: `build`, `format`, `start:dev`, `lint`, `test`, `test:e2e`, `prisma:seed`
- **Command order**: `lint → typecheck → test` (run lint/typecheck before tests)

## Architecture
- Feature modules: `auth/`, `prescriptions/`, `admin/`, `users/`
- **No Doctor/Patient separate tables** — roles (ADMIN/DOCTOR/PATIENT) live on `User` model
- Prisma schema is the **only** source of truth for data model; `docs/ARQUITECTURA.md` is stale (describes a removed intermediate design)
- IDOR enforcement: service-layer `where` clauses filter by `user.role` + `user.id`

- Use `findFirst` (not `findUnique`) for prescriptions — no unique constraint on patientId/doctorId

## Auth
- JWT access token (15m TTL) + refresh token (7d TTL) in **HttpOnly cookies**
- Swagger docs at `/docs` with `withCredentials: true`
- `FRONTEND_URL` env var controls CORS origin (must be set)
- **No Bearer token in Authorization header** — cookie-based

## Env / Startup
- Required: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL` ("15m"), `JWT_REFRESH_TTL` ("7d"), `PORT` (3000), `FRONTEND_URL`, `NODE_ENV`
- App **fast-fails** on startup if any env var is missing/malformed (`src/config/env.validation.ts`)

- **Do not use `process.env` outside `ConfigModule`** — use `ConfigService`

## Database
- Migrations via `prisma migrate dev/deploy` — **never** `synchronize: true`
- Seed users (re-runnable, upsert): `admin@clinic.com`, `doctor@clinic.com`, `patient@clinic.com` — all with `Password123!`
- Run seed: `npm run prisma:seed` or `prisma db seed`

## Testing
- Unit tests: `jest` (rootDir = `src/`, pattern `*.spec.ts`)
- E2E tests: `jest --config ./test/jest-e2e.json` (rootDir = `.`, pattern `*.e2e-spec.ts`)
- E2E auth: login → extract `accessToken` cookie → set on subsequent requests via `set('Cookie', cookie)`
- `supertest` for HTTP-level assertions

## Key Files
- `src/main.ts` — entry, ValidationPipe, global filters, Swagger setup
- `src/config/env.validation.ts` — strict env validation (fast-fail on startup)
- `src/common/filters/http-exception.filter.ts` — global error format
- `prisma/schema.prisma` — **authoritative** data model
- `test/prescriptions.e2e-spec.ts` — example E2E test (auth + RBAC + validation)
- `.opencode/rules/` — mandatory rules auto-loaded via `opencode.json`

## Gotchas
- **Puppeteer** is a heavy dev dependency (used for PDF generation via `src/pdf/`)
- No `@nestjs/throttler` visible in current code — rate limiting may not be enforced
- `prescriptions.items` stored as `Json` type — array of `{name, dosage, instructions}` objects, no product catalog
- `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` are **strings** ("15m", "7d"), not numbers
- Role enums are UPPERCASE in Prisma: `ADMIN`, `DOCTOR`, `PATIENT`