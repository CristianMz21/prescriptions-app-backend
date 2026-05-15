# Arquitectura — Prescriptions App

> Sistema de gestión de prescripciones médicas con autenticación cookie-based y RBAC.

---

## 1. Visión General

```
┌─────────────────────────────────────────────────────────────┐
│  Doctor App  ·  Patient App  ·  Admin Dashboard           │
└──────────────────────┬─────────────────────────────────────┘
                          │ HTTPS (JWT HttpOnly cookies)
┌───────────────────────▼────────────────────────────────────┐
│                 NESTJS APPLICATION                          │
│  Helmet · ValidationPipe · CORS · cookie-parser           │
│                                                          │
│  JwtAuthGuard (cookie) → RolesGuard                      │
│  @CurrentUser()  @Roles()                                │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐   │
│  │  Auth    │ │  Users   │ │Prescrip-  │ │  Admin   │   │
│  │  Module  │ │  Module  │ │  tions    │ │  Module  │   │
│  └──────────┘ └──────────┘ └───────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │   PDF   │  │  Email   │  │  Prisma  │               │
│  └──────────┘ └──────────┘ └──────────┘                │
└──────────────────────────────┬──────────────────────────────┘
                               │ Prisma Client
┌─────────────────────────────▼──────────────────────────────┐
│                   POSTGRESQL DATABASE                        │
│  User · Doctor · Patient · Prescription                    │
│  PrescriptionItem · PrescriptionAuditLog                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Modelo de Datos

El schema Prisma es la **única fuente de verdad** del modelo de datos.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  DOCTOR
  PATIENT
}

enum PrescriptionStatus {
  PENDING
  CONSUMED
}

enum ThemePreference {
  SYSTEM
  LIGHT
  DARK
}

model User {
  id              String          @id @default(uuid())
  email           String          @unique
  passwordHash    String
  name            String
  phone           String?
  role            Role
  themePreference ThemePreference @default(SYSTEM)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  doctor    Doctor?
  patient   Patient?
  auditLogs PrescriptionAuditLog[] @relation("ChangedBy")

  @@index([email])
  @@index([name])
}

model Doctor {
  id                String  @id @default(uuid())
  userId            String  @unique
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  specialty         String?
  medicalId         String?
  signatureText     String?
  signatureImageUrl String?

  prescriptions Prescription[] @relation("AuthoredBy")
}

model Patient {
  id        String    @id @default(uuid())
  userId    String    @unique
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  birthDate DateTime?

  prescriptions Prescription[]
}

model Prescription {
  id         String             @id @default(uuid())
  code       String             @unique    // RX-XXXXXXXXXX
  status     PrescriptionStatus @default(PENDING)
  notes      String?
  createdAt  DateTime           @default(now())
  updatedAt  DateTime           @updatedAt
  consumedAt DateTime?
  expiryDate DateTime?

  authorId String
  author   Doctor @relation("AuthoredBy", fields: [authorId], references: [id])

  patientId String
  patient   Patient @relation(fields: [patientId], references: [id])

  items     PrescriptionItem[]
  auditLogs PrescriptionAuditLog[]

  @@index([status, createdAt])
  @@index([patientId])
  @@index([authorId])
  @@index([notes])
}

model PrescriptionItem {
  id           String   @id @default(uuid())
  name         String
  dosage       String?
  quantity     Int?
  unit         String
  instructions String?
  createdAt    DateTime @default(now())

  prescriptionId String
  prescription   Prescription @relation(fields: [prescriptionId], references: [id], onDelete: Cascade)

  @@index([prescriptionId])
  @@index([name])
}

model PrescriptionAuditLog {
  id             String       @id @default(uuid())
  prescriptionId  String
  prescription   Prescription @relation(fields: [prescriptionId], references: [id], onDelete: Cascade)

  changedById String?
  changedBy   User? @relation("ChangedBy", fields: [changedById], references: [id], onDelete: SetNull)

  fromStatus PrescriptionStatus?
  toStatus   PrescriptionStatus
  reason     String?
  createdAt  DateTime @default(now())

  @@index([prescriptionId])
  @@index([changedById])
  @@index([createdAt])
  @@index([toStatus])
}
```

### Relaciones

- `User` tiene optionally-one `Doctor` o `Patient` (relación 1:1 via `userId`)
- `Doctor` authored muchas `Prescription` (relación 1:N via `authorId`)
- `Patient` recibe muchas `Prescription` (relación 1:N via `patientId`)
- `Prescription` tiene muchos `PrescriptionItem` (tabla separada, no Json)
- `PrescriptionAuditLog` registra cambios de estado con tracking de quién lo hizo

---

## 3. Estructura de Módulos

| Módulo | Responsabilidad |
|--------|----------------|
| **AuthModule** | Login, logout, refresh, profile |
| **UsersModule** | User management + Doctor/Patient directory |
| **PrescriptionsModule** | Prescription CRUD, consume, PDF |
| **AdminModule** | Dashboard metrics, all prescriptions listing |
| **PdfModule** | Puppeteer PDF generation |
| **EmailModule** | SMTP email notifications (no-op si no está configurado) |
| **PrismaModule** | Singleton PrismaClient |

---

## 4. Estructura de Carpetas

```
backend/
├── src/
│   ├── main.ts                       # Entry point, ValidationPipe, Swagger
│   ├── app.module.ts                 # Root module
│   ├── auth/                         # Login, logout, refresh, profile
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── refresh-token.strategy.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   └── current-user.decorator.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       ├── login-response.dto.ts
│   │       └── refresh-token.dto.ts
│   ├── users/                        # User management + Doctor/Patient listing
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   └── users.service.ts
│   ├── prescriptions/               # Prescription CRUD + consume + PDF
│   │   ├── prescriptions.module.ts
│   │   ├── prescriptions.controller.ts
│   │   ├── prescriptions.service.ts
│   │   └── dto/
│   │       ├── create-prescription.dto.ts
│   │       └── prescription-response.dto.ts
│   ├── admin/                       # Admin metrics + all prescriptions
│   │   ├── admin.module.ts
│   │   ├── admin.controller.ts
│   │   ├── admin.service.ts
│   │   └── dto/
│   │       └── metrics-response.dto.ts
│   ├── pdf/                         # Puppeteer PDF generation
│   │   └── pdf.service.ts
│   ├── email/                        # SMTP email notifications
│   │   └── email.service.ts
│   ├── prisma/                      # Singleton PrismaClient
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── config/
│   │   └── env.validation.ts
│   └── common/
│       ├── filters/
│       │   └── http-exception.filter.ts
│       ├── interfaces/
│       │   └── jwt-payload.interface.ts
│       └── utils/
│           └── code.utils.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── test/
    └── *.e2e-spec.ts
```

---

## 5. Auth Architecture

### JWT Payload

```json
{
  "sub": "user-id-uuid",
  "email": "doctor@clinic.com",
  "role": "DOCTOR"
}
```

### Token Architecture

| Token | Vida util | Almacenamiento |
|-------|-----------|----------------|
| Access Token (JWT) | 15 min | HttpOnly cookie |
| Refresh Token | 7 dias | HttpOnly cookie |

- Tokens **nunca** van en Authorization header ni en body de respuesta
- Login response: `{ message: "Login successful", user: { id, email, role } }`
- Swagger UI configurado con `withCredentials: true`

---

## 6. Security Model

### RBAC

| Accion | ADMIN | DOCTOR | PATIENT |
|--------|:-----:|:------:|:-------:|
| Login | OK | OK | OK |
| Ver propio perfil | OK | OK | OK |
| Crear usuario | OK | NO | NO |
| Listar usuarios | OK | NO | NO |
| Listar pacientes | OK | OK | NO |
| Listar doctores | OK | NO | NO |
| Ver detalle usuario | OK | OK | NO |
| Crear prescripcion | NO | OK | NO |
| Ver propias | OK | las que autoro | las que recibio |
| Detalle prescripcion | OK | si es autor | si es dueno |
| Marcar consumida | NO | NO | OK owner |
| Descargar PDF | OK | si autor | si dueno |
| Listar todas prescripciones | OK | NO | NO |
| Ver metricas | OK | NO | NO |

### IDOR Prevention

Los ownership checks viven en la **capa de servicio**, no en el controller. Se implementan via `applyTenantBoundary`:

```typescript
private applyTenantBoundary(where: Prisma.PrescriptionWhereInput, user: JwtPayload) {
  if (user.role === Role.PATIENT) {
    where.patient = { userId: user.id };
  } else if (user.role === Role.DOCTOR) {
    where.author = { userId: user.id };
  }
  // ADMIN: sin filtro — ve todo
}
```

---

## 7. Decisiones Clave de Arquitectura

### 7.1 Doctor/Patient como Tablas Separadas

`Doctor` y `Patient` son tablas separadas vinculadas 1:1 a `User` via `userId`.

- Permiten datos específicos del rol (specialty para Doctor, birthDate para Patient)
- Queries de listado filtran por `role` y luego join con la tabla correspondiente
- Auth es un solo `User`, no múltiples perfiles

### 7.2 PrescriptionItem como Tabla Relacional

`Prescription.items` es una relación a la tabla `PrescriptionItem` — no un campo Json. Cada item tiene `name`, `dosage`, `quantity`, `instructions`. Esto permite indexación y queries per-item.

### 7.3 Middleware Global (main.ts)

Todo request pasa por:

1. **Helmet** — Security headers (X-Frame-Options DENY, nosniff, XSS, etc.)
2. **cookieParser** — Parseo de cookies para auth
3. **CORS** — Origen pinned a `FRONTEND_URL` con `credentials: true`
4. **ValidationPipe** — `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
5. **HttpExceptionFilter** — JSON error format consistente

---

## 8. Metrics Response

`GET /admin/metrics` retorna:

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

---

## 9. Variables de Entorno

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `JWT_ACCESS_SECRET` | Secreto para access tokens | `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | Secreto para refresh tokens | `openssl rand -base64 32` |
| `JWT_ACCESS_TTL` | TTL access token (string) | `"15m"` |
| `JWT_REFRESH_TTL` | TTL refresh token (string) | `"7d"` |
| `PORT` | Puerto HTTP | `3000` |
| `FRONTEND_URL` | Origen CORS (alternative) | `http://localhost:3001` |
| `APP_ORIGIN` | Origen CORS (alternative) | `http://localhost:3001` |
| `NODE_ENV` | Entorno | `development` |
| `SEED_DEFAULT_PASSWORD` | Password para usuarios seed | `Password123!` |
| `SMTP_HOST` | Servidor SMTP (opcional) | `smtp.example.com` |
| `SMTP_PORT` | Puerto SMTP (default 587) | `587` |
| `SMTP_USER` | Usuario SMTP (opcional) | `user` |
| `SMTP_PASS` | Password SMTP (opcional) | `pass` |
| `SMTP_FROM` | Dirección From (opcional) | `no-reply@clinic.local` |
| `REDIS_URL` | Redis connection string (requerido para CI) | `redis://localhost:6379` |

> **Note**: At least one of `APP_ORIGIN` or `FRONTEND_URL` must be set for CORS to work.

La app hace **fast-fail** al iniciar si falta alguna variable o está malformada (`src/config/env.validation.ts`).