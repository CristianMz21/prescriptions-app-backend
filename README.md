# Prescription Management API

Backend API for the Prescription Management System. Built with NestJS, Prisma ORM, and PostgreSQL.

## Overview

- **Framework**: NestJS + TypeScript
- **ORM**: Prisma 6
- **Database**: PostgreSQL
- **Authentication**: JWT access token (15m TTL) + refresh token (7d TTL) stored in HttpOnly cookies
- **Authorization**: RBAC with three roles — `ADMIN`, `DOCTOR`, `PATIENT`
- **Validation**: class-validator + ValidationPipe (whitelist, forbidNonWhitelisted, transform)
- **Documentation**: Swagger/OpenAPI at `/docs`

## Requirements

- Node.js 22.x or compatible
- PostgreSQL 15+
- npm

## Environment Variables

Create a `.env` file in the project root. Replace each `<...>` placeholder with a real local value before running anything; the file is gitignored so your values stay out of version control.

```env
DATABASE_URL="postgresql://user:<DEV_DB_PASSWORD>@localhost:5433/prescriptions_db?schema=public"
JWT_ACCESS_SECRET="<DEV_ACCESS_SECRET_PLACEHOLDER>"
JWT_REFRESH_SECRET="<DEV_REFRESH_SECRET_PLACEHOLDER>"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="7d"
PORT=3000
FRONTEND_URL="http://localhost:3001"
NODE_ENV="development"
SEED_DEFAULT_PASSWORD="<DEV_SEED_PASSWORD>"
```

> **Note**: `JWT_ACCESS_TTL` and `JWT_REFRESH_TTL` are strings (e.g., `"15m"`, `"7d"`), not numbers.
>
> **Note**: `SEED_DEFAULT_PASSWORD` is required by both `prisma/seed.ts` and the e2e harness so seeded users and test logins stay in sync. If unset, both fall back to the obviously-non-secret string `<DEV_SEED_PASSWORD>` and logins fail loudly until configured.

## Local Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (creates database schema)
npx prisma migrate dev

# Seed the database with sample data
npx prisma db seed

# Start the development server
npm run start:dev
```

The API will be available at `http://localhost:3000`.

## Database Reset

```bash
npx prisma migrate reset --force
```

This drops the database, re-runs migrations, and seeds fresh data.

## Test Credentials

All seeded users share the same password, read from `SEED_DEFAULT_PASSWORD` (see Environment Variables above). Set this in `.env` to the value you want to log in with locally.

| Email | Role | Notes |
|-------|------|-------|
| `admin@clinic.com` | ADMIN | Full system access |
| `doctor@clinic.com` | DOCTOR | Create/manage prescriptions |
| `doctor2@clinic.com` | DOCTOR | Secondary doctor account |
| `patient@clinic.com` | PATIENT | Access own prescriptions |

> All seeded users share the same password, controlled by `SEED_DEFAULT_PASSWORD` (see Environment Variables). `Password123!` is used as example value in docs but the actual password is set via env var.

## Main API Endpoints

### Auth

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/auth/login` | Login with email/password | Public |
| `POST` | `/auth/refresh` | Refresh access token | Public (uses cookie) |
| `POST` | `/auth/logout` | Clear auth cookies | Required |
| `GET` | `/auth/profile` | Get current user profile | Required |

### Users

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/users` | Create new user | ADMIN |
| `GET` | `/users` | List all users | ADMIN |
| `GET` | `/users/patients` | List all patients | ADMIN, DOCTOR |
| `GET` | `/users/doctors` | List all doctors | ADMIN |
| `GET` | `/users/:id` | Get user by ID | ADMIN, DOCTOR |

### Prescriptions

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/prescriptions` | Create prescription | DOCTOR |
| `GET` | `/prescriptions` | List prescriptions (paginated, role-filtered) | All |
| `GET` | `/prescriptions/:id` | Get prescription detail | Owner/Admin |
| `PATCH` | `/prescriptions/:id/consume` | Mark as consumed | PATIENT (owner) |
| `GET` | `/prescriptions/:id/pdf` | Download prescription PDF | Owner/Admin |

### Admin

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/admin/prescriptions` | List all prescriptions with filters and pagination | ADMIN |
| `GET` | `/admin/metrics` | Dashboard metrics | ADMIN |

### Admin Metrics Response

```json
{
  "totals": {
    "doctors": 5,
    "patients": 20,
    "prescriptions": 100
  },
  "byStatus": {
    "pending": 60,
    "consumed": 40
  },
  "byDay": [
    { "date": "2026-01-15", "count": 12 }
  ],
  "topDoctors": [
    { "authorId": "uuid", "count": 15 }
  ]
}
```

## Swagger / OpenAPI

Interactive API documentation is available at:

```
http://localhost:3000/docs
```

Use the Swagger UI "Try it out" feature with `withCredentials: true` enabled for cookie-based auth.

## Testing Commands

```bash
# Lint
npm run lint

# TypeScript type check
npx tsc --noEmit

# Build
npm run build

# Unit tests
npm test

# E2E tests
npm run test:e2e -- admin.e2e-spec.ts
npm run test:e2e -- prescriptions.e2e-spec.ts
```

## Architecture Notes

### Modules

- **Auth** — Login, logout, token refresh, profile
- **Users** — User management and directory
- **Prescriptions** — Prescription CRUD, PDF generation, consume action, audit log
- **Admin** — Dashboard metrics and admin-only prescription listing
- **PDF** — Server-side PDF generation via Puppeteer + Handlebars
- **PrismaModule** — Singleton PrismaClient

### Security

- **JWT in HttpOnly cookies** — Access token (15m) and refresh token (7d) stored server-side only; never exposed to JavaScript
- **RBAC** — Guards and decorators enforce role-based access at controller level
- **IDOR Prevention** — `applyTenantBoundary()` filters prescriptions by authenticated user's identity and role
- **ValidationPipe** — Global whitelist + forbidNonWhitelisted + transform for all incoming DTOs
- **Helmet** — Security headers configured
- **CORS** — Configured to allow requests only from `FRONTEND_URL`
- **Cookie flags** — `httpOnly: true`, `sameSite: 'strict'`, `secure: true` in production

### Data Model

- Users have role `ADMIN`, `DOCTOR`, or `PATIENT`
- `Doctor` and `Patient` are separate tables linked 1:1 to `User` via `userId`
- Prescriptions belong to one doctor (`author`) and one patient
- Prescription items stored in separate `PrescriptionItem` table (not Json)
- `PrescriptionAuditLog` tracks all status changes
- Prisma schema is the authoritative data model
- Prescription code format: `RX-XXXXXXXXXX` (unique)

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE.txt).