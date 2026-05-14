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

## CI drift rule

CI regenerates `openapi.json` and the Postman assets, then runs:

```bash
git diff --exit-code -- openapi.json postman
```

A diff means the API contract changed without committed regenerated Postman artifacts, so CI fails. Newman failures also fail CI. Reports are written under `reports/postman/` and uploaded as workflow artifacts.
