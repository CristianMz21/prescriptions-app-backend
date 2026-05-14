# Postman/Newman API QA Suite

This suite is generated from `openapi.json` and then enriched with curated business-flow, RBAC, IDOR, and negative tests.

## Source of truth

- `openapi.json` is authoritative.
- Do not manually add undocumented endpoints to the collection.
- If an endpoint, request body, query parameter, or response schema is missing, fix the NestJS controller/DTO decorators first, then run:

```bash
pnpm run export:openapi
pnpm run validate:openapi
pnpm run postman:generate
```

## Files

- `prescription-api.postman_collection.json` — generated + curated collection.
- `prescription-api.local.postman_environment.json` — local environment values.
- `prescription-api.ci.postman_environment.json` — CI environment values.

Secrets are not committed. Pass the seeded password at runtime:

```bash
export SEED_DEFAULT_PASSWORD='your-local-seed-password'
pnpm run postman:test:local
```

## Local run

Start the backend and database with seeded users, then run:

```bash
pnpm run export:openapi
pnpm run validate:openapi
pnpm run postman:generate
pnpm run postman:test:local
```

The collection logs in as the seeded Admin, Doctor, and Patient users, persists HttpOnly cookie values from `Set-Cookie`, and passes them explicitly as `Cookie` headers for protected requests. If a future CSRF cookie/header is added, the scripts capture and forward it automatically.

## Auth helper and `roleOverride`

The Users, Prescriptions, and Admin folders delegate cookie management to a shared `authHelper` collection variable. Each request sets `requiredRole` (admin/doctor/patient) in its pre-request script and the helper:

- Builds the `Cookie` header from the matching `${role}AccessToken / RefreshToken / CsrfToken` env vars.
- Auto-logs in via `POST /auth/login` if the role's token is missing (using `${role}Email` and `seedPassword`). No need to run "Login admin/doctor/patient" manually first.
- Respects the env var `roleOverride` (admin/doctor/patient). When non-empty, every helper-managed request is sent as that role — useful for testing cross-role visibility without editing scripts.

The `Security - Negative RBAC and IDOR` and `Sequential E2E - Prescription Business Flow` folders intentionally bypass `roleOverride` to keep their negative/orchestrated assertions deterministic.

Defaults worth knowing:

- `PrescriptionsController_findAll | _findOne | _downloadPdf` default to **admin** so they work against any prescription in the system. Set `roleOverride=patient` to view from the patient perspective.
- `_create` stays **doctor**, `_markAsConsumed` stays **patient** — backend RBAC enforces this regardless of override.

## CI drift rule

CI regenerates `openapi.json` and the Postman assets, then runs:

```bash
git diff --exit-code -- openapi.json postman
```

A diff means the API contract changed without committed regenerated Postman artifacts, so CI fails. Newman failures also fail CI. Reports are written under `reports/postman/` and uploaded as workflow artifacts.
