# Implementation Roadmap — Prescriptions App MVP

> **Timeline:** 12 days (estimated 2 weeks)
> **Team:** 1 developer
> **Goal:** MVP fully functional backend deployed

---

## Phase Overview

```
Week 1: Infrastructure → Data → Auth
Week 2: Business Logic → PDF → Metrics → Testing
```

| Phase | Name | Days | Deliverable |
|-------|------|------|-------------|
| **Phase 1** | Infrastructure | 1 | NestJS scaffold + Prisma + PostgreSQL |
| **Phase 2** | Data Modeling | 1 | Schema applied + seed data |
| **Phase 3** | Auth Layer | 2 | JWT + refresh + guards + decorators |
| **Phase 4** | Core Business | 3 | Users, Patients, Doctors, Prescriptions modules |
| **Phase 5** | PDF & Metrics | 1 | PDF generation + admin metrics |
| **Phase 6** | Testing | 2 | Unit tests + E2E |
| **Phase 7** | Deploy | 2 | Railway/Render + CI/CD |

---

## Phase 1 — Infrastructure (Day 1)

### Goals
- NestJS project scaffolded and running
- Prisma configured with PostgreSQL
- Module structure in place

### Tasks

- [ ] NestJS scaffold via `nest new backend --skip-git --package-manager npm`
- [ ] Verify `npm run start` works on port 3000
- [ ] Install dependencies: `npm install prisma @prisma/client @prisma/adapter-pg pg`
- [ ] Run `npx prisma init` → generate `prisma/schema.prisma`
- [ ] Configure `.env` with `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
- [ ] Add `moduleFormat = "cjs"` to generator in `schema.prisma`
- [ ] Run `npx prisma generate` → verify `generated/prisma/` output
- [ ] Create `src/prisma/prisma.module.ts` and `prisma.service.ts`
- [ ] Register `PrismaModule` as `@Global()` in `AppModule`
- [ ] Verify `npm run build` passes

### Exit Criteria
- `npm run build` passes with no errors
- Prisma client generated to `generated/prisma/`
- App starts on port 3000

---

## Phase 2 — Data Modeling (Day 2)

### Goals
- Full Prisma schema created and applied
- Database migrated
- Seed script populates test data

### Tasks

- [ ] Write complete `schema.prisma` with all models:
  - `User`, `Doctor`, `Patient`, `Prescription`, `PrescriptionItem`, `RefreshToken`
  - Enums: `Role`, `PrescriptionStatus`
  - All indexes as per `ARCHITECTURE.md`
- [ ] Run `npx prisma migrate dev --name init` (requires PostgreSQL running)
  - **Alternative if no DB:** `npx prisma migrate dev --name init --skip-generate` then manual apply
- [ ] Create `prisma/seed.ts`:
  - 1 Admin (`admin@test.com` / `Admin123*`)
  - 1 Doctor (`doctor@test.com` / `Doctor123*`, specialty: Cardiología)
  - 1 Patient (`patient@test.com` / `Patient123*`)
  - 2 sample prescriptions (1 pending, 1 consumed)
- [ ] Add `prisma:seed` script to `package.json`
- [ ] Run `npm run prisma:seed` — verify data created

### Exit Criteria
- `npx prisma migrate` applies successfully
- `seed.ts` runs without errors
- Database contains 3 users + 2 prescriptions

---

## Phase 3 — Auth Layer (Days 3-4)

### Goals
- Full JWT authentication working
- Refresh token rotation implemented
- Guards and decorators functional

### Tasks

#### Day 3 — Auth Core

- [ ] Install: `npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt`
- [ ] Install dev: `npm install -D @types/passport-jwt @types/bcrypt`
- [ ] Install: `npm install class-validator class-transformer`
- [ ] Create `src/auth/dto/login.dto.ts` and `refresh-token.dto.ts`
- [ ] Create `src/auth/strategies/jwt.strategy.ts`
- [ ] Create `src/auth/strategies/refresh-token.strategy.ts`
- [ ] Create `src/auth/guards/jwt-auth.guard.ts`
- [ ] Create `src/auth/guards/roles.guard.ts`
- [ ] Create `src/auth/decorators/roles.decorator.ts`
- [ ] Create `src/auth/decorators/current-user.decorator.ts`

#### Day 4 — Auth Service + Controller

- [ ] Create `src/auth/auth.service.ts`:
  - `login()` → bcrypt compare + JWT sign + refresh token hash stored in DB
  - `refresh()` → validate DB refresh token + rotate + revoke old
  - `logout()` → revoke refresh token in DB
  - `getMe()` → return current user profile
- [ ] Create `src/auth/auth.controller.ts` with all 4 endpoints
- [ ] Create `src/auth/auth.module.ts` wiring everything
- [ ] Update `AppModule` to import `AuthModule`
- [ ] Verify `npm run build` passes
- [ ] Test flow: Login → receive tokens → call `/auth/me` with JWT → Refresh → Logout

### Exit Criteria
- `POST /auth/login` returns `{accessToken, refreshToken, user}`
- `POST /auth/refresh` rotates tokens without re-login
- `POST /auth/logout` invalidates refresh token
- `GET /auth/me` returns current user info
- Guards return 401 for missing token, 403 for wrong role

---

## Phase 4 — Core Business Logic (Days 5-7)

### Goals
- Users module for admin user creation
- Patients module for listing/detail
- Doctors module for listing/detail
- Prescriptions module with full CRUD + filtering

### Tasks

#### Day 5 — Users + Patients + Doctors

- [ ] **UsersModule:**
  - Create `src/users/dto/create-user.dto.ts`
  - Create `src/users/users.service.ts` — `create()` with bcrypt + profile creation
  - Create `src/users/users.controller.ts` — `POST /users` (admin only)
  - Create `src/users/users.module.ts`
  - Register in `AppModule`

- [ ] **PatientsModule:**
  - Create `src/patients/patients.service.ts` — `findAll()`, `findOne()`
  - Create `src/patients/patients.controller.ts` — `GET /patients`, `GET /patients/:id`
  - Create `src/patients/patients.module.ts`
  - Register in `AppModule`

- [ ] **DoctorsModule:**
  - Create `src/doctors/doctors.service.ts` — `findAll()`, `findOne()`
  - Create `src/doctors/doctors.controller.ts` — `GET /doctors`, `GET /doctors/:id`
  - Create `src/doctors/doctors.module.ts`
  - Register in `AppModule`

#### Day 6 — Prescriptions Service + Controller

- [ ] Create `src/prescriptions/dto/create-prescription.dto.ts`
- [ ] Create `src/prescriptions/dto/pagination.dto.ts`
- [ ] Create `src/prescriptions/prescriptions.service.ts`:
  - `create()` — patientId or patientEmail, code generation, items creation
  - `findAll()` — role-based filtering, pagination, status/date filters
  - `findOne()` — ownership check + IDOR prevention
  - `consume()` — status check + consumedAt update
- [ ] Create `src/prescriptions/prescriptions.controller.ts` — all 5 endpoints
- [ ] Create `src/prescriptions/prescriptions.module.ts`
- [ ] Register in `AppModule`

#### Day 7 — PDF Integration + Pagination Refinement

- [ ] Install `npm install pdfkit` + `npm install -D @types/pdfkit`
- [ ] Add `generatePdf()` to `PrescriptionsService` (pdfkit)
- [ ] Implement `GET /prescriptions/:id/pdf` returning `StreamableFile`
- [ ] Set correct `Content-Type: application/pdf` and `Content-Disposition` headers
- [ ] Test pagination: `GET /prescriptions?page=2&limit=5&status=pending`
- [ ] Verify build passes end-to-end

### Exit Criteria
- Admin can create users with doctor/patient profiles
- Doctor can list patients but patient cannot
- Doctor can create prescription
- Patient can list their prescriptions only
- Patient can mark prescription as consumed
- Pagination works with `?page=&limit=&status=&from=&to=&sort=&order=`
- PDF download returns valid PDF

---

## Phase 5 — Metrics (Day 8)

### Goals
- Admin metrics endpoint returns aggregated analytics

### Tasks

- [ ] Create `src/metrics/metrics.service.ts`:
  - `totalPatients`, `totalDoctors`, `totalPrescriptions`
  - `prescriptionsByStatus` (count groupBy status)
  - `prescriptionsByDay` (last 30 days, groupBy date)
- [ ] Create `src/metrics/metrics.controller.ts` — `GET /metrics` (admin only)
- [ ] Create `src/metrics/metrics.module.ts`
- [ ] Register in `AppModule`
- [ ] Test: Login as admin → `GET /metrics` → verify all fields present
- [ ] Test: Login as doctor → `GET /metrics` → expect 403

### Exit Criteria
- `GET /metrics` returns all expected fields
- Only admin can access it
- Non-admin gets 403

---

## Phase 6 — Testing (Days 9-10)

### Goals
- Unit tests for all services
- E2E tests for auth flows and RBAC

### Tasks

#### Day 9 — Unit Tests

- [ ] Install `npm install --save-dev jest-mock-extended`
- [ ] Create `src/auth/auth.service.spec.ts` — test login, refresh, logout
- [ ] Create `src/prescriptions/prescriptions.service.spec.ts` — test CRUD + consume
- [ ] Create `src/users/users.service.spec.ts` — test create user
- [ ] Run `npm run test` — verify all pass

#### Day 10 — E2E Tests

- [ ] Create `test/auth.e2e-spec.ts`:
  - Login with valid credentials → 200 + tokens
  - Login with wrong password → 401
  - Refresh token → new access token
  - Logout → token revoked
- [ ] Create `test/prescriptions.e2e-spec.ts`:
  - Doctor creates prescription → 201
  - Patient marks as consumed → 200
  - Patient A tries to consume Patient B's prescription → 403
  - Unauthorized访问 → 401
- [ ] Create `test/rbac.e2e-spec.ts`:
  - Patient tries to create prescription → 403
  - Doctor tries to access metrics → 403
  - Admin accesses metrics → 200
- [ ] Run `npm run test:e2e` — verify all pass

### Exit Criteria
- Unit test coverage ≥ 70% for services
- All E2E tests pass
- RBAC correctly enforced in tests

---

## Phase 7 — Deployment (Days 11-12)

### Goals
- Backend deployed to Railway/Render
- PostgreSQL provisioned
- CI/CD configured

### Tasks

#### Day 11 — Deploy Backend

- [ ] Push all code to GitHub (`git push origin main`)
- [ ] Create Railway project → connect to GitHub repo
- [ ] Add environment variables in Railway dashboard:
  - `DATABASE_URL` → Railway PostgreSQL connection string
  - `JWT_SECRET` → random 256-bit secret
  - `JWT_REFRESH_SECRET` → random 256-bit secret
  - `PORT` → `3000`
- [ ] Configure Railway build: `npm run build`
- [ ] Configure Railway start: `node dist/main.js`
- [ ] Provision PostgreSQL in Railway → get connection string
- [ ] Run `npx prisma migrate deploy` (or apply migrations via Railway CLI)
- [ ] Run seed: `npm run prisma:seed` against production DB
- [ ] Verify app is live: `GET https://<app>.railway.app` → 200

#### Day 12 — CI/CD + Final Checks

- [ ] Add `Procfile` or Railway config for proper process type
- [ ] Add `.env.example` to repo (without real values)
- [ ] Verify all endpoints work in production:
  - Login → tokens
  - Create prescription as doctor
  - Download PDF
  - Access metrics as admin
- [ ] Test error cases: invalid token → 401, wrong role → 403
- [ ] Update `README.md` with:
  - Live URL
  - Environment variables reference
  - API documentation link
  - Seed credentials
- [ ] Git tag: `v1.0.0` for release

### Exit Criteria
- Backend live at production URL
- All API endpoints functional
- Seed users work in production
- README updated

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PostgreSQL not available for migration | Medium | High | Use `prisma migrate dev --skip-generate`; manual SQL apply later |
| PDF generation errors | Low | Medium | Test PDF output manually; pdfkit is stable |
| pnpm scripts blocked in CI | High | Medium | Use npm in CI scripts; `.npmrc` with `ignore-scripts=false` |
| JWT secret weak in production | Low | High | Use `openssl rand -base64 32` for production secrets |
| Rate limiting too aggressive | Low | Low | Tune thresholds after load testing |

---

## Milestone Checklist

- [ ] `npm run build` passes clean
- [ ] `npm run start:dev` starts in watch mode
- [ ] `npx prisma generate` completes without errors
- [ ] `npx prisma migrate` applies successfully
- [ ] `npm run prisma:seed` populates test data
- [ ] Login works and returns JWT
- [ ] All 4 roles (admin/doctor/patient) can login
- [ ] RBAC enforced on all protected endpoints
- [ ] IDOR prevention tested (patient can't access other's prescriptions)
- [ ] Pagination works correctly
- [ ] PDF download returns valid PDF file
- [ ] Metrics endpoint returns correct aggregations
- [ ] Unit tests ≥ 70% coverage
- [ ] E2E tests pass for auth + RBAC
- [ ] Backend deployed to production
- [ ] README updated with live URL