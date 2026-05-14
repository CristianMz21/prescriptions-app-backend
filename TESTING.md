# Testing Guide

Authoritative reference for running and extending the test suite of the Prescription Management API.

## Test layers

| Layer | Location | Runner | Purpose |
|---|---|---|---|
| **Unit** | `src/**/*.spec.ts` | Jest | Pure logic, mocked Prisma + EmailService, fast |
| **Integration / E2E** | `test/**/*.e2e-spec.ts` | Jest (e2e config) | Real Nest app + real Postgres + Puppeteer Chrome |
| **OpenAPI contract** | `openapi.json` | `swagger-cli validate` | Schema validity & drift detection |
| **Postman / Newman** | `postman/` | Newman CLI | API-level smoke + contract suite generated from OpenAPI |

The unit suite must NEVER touch Postgres. Integration and E2E suites use a real database; **no Prisma mocking** there.

## Pre-requisites

| Dependency | How |
|---|---|
| Node.js 24 | `nvm install 24` |
| pnpm 11.x | `corepack enable pnpm` |
| PostgreSQL 15+ on port 5433 | `docker compose up postgres -d` (uses `docker-compose.yml` at repo root) |
| Redis 7 on port 6379 | `docker compose up redis -d` |
| Chrome (Puppeteer) | `pnpm exec puppeteer browsers install chrome` (one-time) |
| `.env` | Copy `.env.example` and set `DATABASE_URL`, `JWT_*_SECRET`, `SEED_DEFAULT_PASSWORD`, optionally `SMTP_*` |

## One-shot setup

```bash
pnpm install --frozen-lockfile
pnpm exec prisma generate
pnpm exec prisma migrate deploy
SEED_DEFAULT_PASSWORD='DevSeed123!' pnpm exec prisma db seed
```

Seed is **idempotent**: re-running it never duplicates `admin@clinic.com`, `doctor@clinic.com`, `doctor2@clinic.com`, or `patient@clinic.com`. Their password is the value of `SEED_DEFAULT_PASSWORD`.

## Commands

| Goal | Command |
|---|---|
| Format check | `pnpm run format:check` |
| Format (write) | `pnpm run format` |
| Lint (strict, `--max-warnings=0`) | `pnpm run lint:check` |
| Lint + auto-fix | `pnpm run lint` |
| TypeScript typecheck | `pnpm run typecheck` |
| Build | `pnpm run build` |
| Unit tests | `pnpm exec jest --testPathIgnorePatterns=e2e` |
| Unit tests + coverage | `pnpm run test:cov` |
| Integration tests only (prescriptions e2e) | `pnpm run test:integration` |
| Full E2E suite | `SEED_DEFAULT_PASSWORD='DevSeed123!' pnpm run test:e2e` |
| Export OpenAPI | `pnpm run export:openapi` |
| Validate OpenAPI | `pnpm run validate:openapi` |
| Generate Postman collection from OpenAPI | `pnpm run postman:generate` |
| Postman/Newman local (needs server on :3000) | `pnpm run postman:test:local` |
| Postman/Newman CI mode | `pnpm run postman:test:ci` |

## Coverage policy

- Jest threshold is **80%** across branches, functions, lines, statements (configured in `package.json#jest.coverageThreshold`).
- Excluded from coverage: `*.module.ts`, `main.ts`, `*.entity.ts`, `*.dto.ts`, `*.decorator.ts`, `*.guard.ts`, `*.filter.ts`, `*.controller.ts`, `*.interface.ts`, `env.validation.ts`, `permissions.ts`. These either have no logic to test or are exercised end-to-end.
- Critical services with full unit coverage: `AuthService`, `UsersService`, `PrescriptionsService`, `AdminService`, `PdfService`, `EmailService`, `JwtStrategy`.
- E2E covers the integration story: cookies + DB + transactions + audit logs + Puppeteer PDF generation.

## Test authoring conventions

1. **No `.skip`, `.only`, `.todo`, `xdescribe`, `xit`**. CI grep enforces this implicitly via test counts.
2. **Real assertions**. Supertest's `.expect(NNN)` is allowed but every test MUST end with at least one Jest `expect(...)` — Sonar S2699 enforces this.
3. **No `any`, `@ts-ignore`, or `eslint-disable` to silence test errors**. If types fight you, fix the source.
4. **Resolve dynamic IDs**, never hardcode UUIDs. The e2e specs use:
   - `extractAccessCookie`, `extractRefreshCookie` from `test/users-and-auth.e2e-spec.ts` and `test/prescriptions.e2e-spec.ts`
   - `resolvePatientId(userId)`, `resolveDoctorId(userId)` in `test/prescriptions.e2e-spec.ts` (read `prisma.patient.findUnique({ where: { userId } })` etc.)
   - `getOrCreateUser(app, email, password, role, adminCookie)` for ad-hoc test fixtures
5. **EmailService is always mocked in e2e** via `Test.createTestingModule({ imports: [AppModule] }).overrideProvider(EmailService).useValue({ sendPrescriptionCreatedEmail: jest.fn().mockResolvedValue(undefined) })`. Never hit a real SMTP server from tests.
6. **Whitelist + transform** is enabled on the `ValidationPipe`; tests sending extra unknown fields will get 400.
7. **One Nest app per spec** (`Test.createTestingModule(...)` in `beforeAll`, `await app.close()` in `afterAll`). E2E specs run serially; do not parallelize unless you isolate DB state.

## Error response shape (validated by tests)

All non-2xx responses (validation, RBAC, ownership, not found) MUST match:

```json
{
  "statusCode": 400,
  "message": ["patientId must be a UUID", "items should not be empty"],
  "error": "Bad Request",
  "timestamp": "2026-05-14T05:14:00.000Z",
  "path": "/prescriptions"
}
```

`message` is an array for validation errors and a string for everything else. `statusCode` is checked exactly; `error` is the canonical reason phrase. Stack traces are never returned.

## RBAC + IDOR matrix (covered in tests)

| Scenario | Test file | Test name |
|---|---|---|
| Unauthenticated → 401 (all guarded endpoints) | `users-and-auth.e2e-spec.ts` | `should return 401 without cookie` (multiple) |
| Wrong role → 403 | `users-and-auth.e2e-spec.ts`, `admin.e2e-spec.ts`, `prescriptions.e2e-spec.ts` | `should return 403 as DOCTOR` / `... PATIENT` |
| Patient A → Patient B prescription | `prescriptions.e2e-spec.ts` | `should return 403 when patient tries to access another patients prescription` |
| Doctor A → Doctor B prescription | `prescriptions.e2e-spec.ts` | `should return 403 when doctor tries to access another doctors prescription` |
| Cross-doctor PDF download | `prescriptions.e2e-spec.ts` | `returns 403 when a doctor downloads another doctor prescription PDF` |
| Cross-patient PDF download | `prescriptions.e2e-spec.ts` | `returns 403 when a patient downloads another patient prescription PDF` |
| Cross-user profile read | `users-and-auth.e2e-spec.ts` | `should return 403 when a patient reads another user profile` |
| Already-consumed re-consume | `prescriptions.e2e-spec.ts` | `PATCH /:id/consume creates a PrescriptionAuditLog and rejects re-consume` |
| Cookie security flags | `users-and-auth.e2e-spec.ts` | `attaches HttpOnly + SameSite=Strict flags...` |
| Refresh token flow | `users-and-auth.e2e-spec.ts` | `POST /auth/refresh` describe block |

## CI guarantees

`.github/workflows/ci-security.yml` runs on every push:

1. **quality-gates** — format / lint / typecheck
2. **build-and-openapi** — build + export + validate OpenAPI; uploads `openapi.json` artifact
3. **unit-tests** — Jest + coverage (≥80%)
4. **integration-tests** — Postgres + Redis + Puppeteer Chrome, runs `prescriptions.e2e-spec.ts`
5. **e2e-tests** — Full e2e suite
6. **dependency-audit** — `pnpm audit --audit-level=high`
7. **semgrep**, **codeql**, **gitleaks**, **cats-fuzz**, **owasp-zap**

`.github/workflows/postman-newman.yml` runs the Newman suite + checks OpenAPI drift via `git diff --exit-code -- openapi.json`.

CI fails on:
- any failing or skipped test
- lint or typecheck errors
- coverage below threshold
- OpenAPI validate errors or drift
- Newman assertion failures

## Adding a new endpoint — testing checklist

1. Add unit tests for service logic (happy + not-found + forbidden + edge).
2. Add e2e covering: success per allowed role, 401 unauthenticated, 403 wrong role, 400 invalid input (validation), 404 not found, ownership/IDOR if applicable.
3. Decorate controller for Swagger so `pnpm run export:openapi && pnpm run validate:openapi` stays green.
4. If the response shape changes, regenerate Postman: `pnpm run postman:generate`; ensure CI Newman tests still pass.
5. Run the full local battery before pushing:
   ```bash
   pnpm run lint:check && pnpm run typecheck && pnpm run build \
     && pnpm exec jest --testPathIgnorePatterns=e2e \
     && SEED_DEFAULT_PASSWORD='DevSeed123!' pnpm run test:e2e \
     && pnpm run export:openapi && pnpm run validate:openapi
   ```

## Troubleshooting

- **`401` everywhere** → `SEED_DEFAULT_PASSWORD` is not exported; e2e logins fail. Set it.
- **Tests time out during PDF tests** → Chrome not installed; run `pnpm exec puppeteer browsers install chrome`. Tests use 30s timeout in `test/jest-e2e.json`.
- **Port 5433 / 6379 in use** → another Postgres/Redis is bound; stop it or change the port in `.env` + `docker-compose.yml`.
- **`prescription email dispatch unexpectedly threw`** in tests → EmailService mock not registered; verify the `overrideProvider(EmailService)` call in the e2e setup.
