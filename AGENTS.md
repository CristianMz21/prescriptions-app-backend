# AGENTS.md — Backend Prescriptions App

## Stack
- **NestJS + TypeScript + Prisma 6 + PostgreSQL**
- **Package scripts**: `build`, `format`, `start:dev`, `lint`, `test`, `test:e2e`, `prisma:seed`, `typecheck`
- **Command order**: `lint → typecheck → test` (run lint/typecheck before tests)

## Architecture
- Feature modules: `auth/`, `prescriptions/`, `admin/`, `users/`
- **Doctor/Patient as separate tables** — linked 1:1 to `User` via `userId`
- Prisma schema is the **only** source of truth for data model
- IDOR enforcement: `applyTenantBoundary()` in prescriptions service filters by `user.role` + `user.id`
- Use `findFirst` (not `findUnique`) for prescriptions — no unique constraint on patientId+authorId
- `PrescriptionItem` is a **separate table** (`Prescription` has `items PrescriptionItem[]`) — **NOT stored as Json**
- `PrescriptionAuditLog` tracks status changes with `changedBy` reference

## Auth
- JWT access token (15m TTL) + refresh token (7d TTL) in **HttpOnly cookies**
- JWT payload: `{ sub: userId, email, role }`
- Login response: `{ message: "Login successful", user: { id, email, role } }`
- Swagger docs at `/docs` with `withCredentials: true`
- CORS origin: at least one of `APP_ORIGIN` or `FRONTEND_URL` env vars must be set
- **No Bearer token in Authorization header** — cookie-based

## Env / Startup
- Required: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL` ("15m"), `JWT_REFRESH_TTL` ("7d"), `PORT` (3000), `NODE_ENV`, and **either** `APP_ORIGIN` **or** `FRONTEND_URL`
- App **fast-fails** on startup if any env var is missing/malformed (`src/config/env.validation.ts`)
- **Do not use `process.env` outside `ConfigModule`** — use `ConfigService`

## Database
- Migrations via `prisma migrate dev/deploy` — **never** `synchronize: true`
- Seed users (re-runnable, upsert): `admin@clinic.com`, `doctor@clinic.com`, `doctor2@clinic.com`, `patient@clinic.com`
- Seed password via `SEED_DEFAULT_PASSWORD` env var (fallback: `<DEV_SEED_PASSWORD>` — logins fail if unset)
- Run seed: `npm run prisma:seed` or `prisma db seed`

## Testing
- Unit tests: `jest` (rootDir = `src/`, pattern `*.spec.ts`)
- E2E tests: `jest --config ./test/jest-e2e.json` (rootDir = `.`, pattern `*.e2e-spec.ts`)
- E2E auth: login → extract `accessToken` cookie → set on subsequent requests via `set('Cookie', cookie)`
- `supertest` for HTTP-level assertions
- Test credentials via `test/test-credentials.ts` → reads `SEED_DEFAULT_PASSWORD` env var

## Key Files
- `src/main.ts` — entry, ValidationPipe, global filters, Swagger setup, helmet, cookie-parser
- `src/config/env.validation.ts` — strict env validation via `class-validator` (fast-fail on startup)
- `src/common/filters/http-exception.filter.ts` — global error format
- `prisma/schema.prisma` — **authoritative** data model
- `test/prescriptions.e2e-spec.ts` — example E2E test (auth + RBAC + validation)
- `.opencode/rules/` — mandatory rules auto-loaded via `opencode.json`

## Gotchas
- **Puppeteer** is a heavy dev dependency (used for PDF generation via `src/pdf/`)
- No `@nestjs/throttler` in this project — rate limiting is not implemented
- `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` are **strings** ("15m", "7d"), not numbers
- Role enums are UPPERCASE in Prisma: `ADMIN`, `DOCTOR`, `PATIENT`
- `tsconfig.json` uses `"module": "nodenext"` + `"moduleResolution": "nodenext"` — affects import resolution
- `User` model has no `name` field — responses use `email` for identification
- Prescription code format: `RX-XXXXXXXXXX` (unique, generated via nanoid)