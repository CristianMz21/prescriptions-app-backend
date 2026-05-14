# Prescription Management System: Backend Architectural Design

> **Nota**: Este documento describe la arquitectura actual del proyecto. Fue reescrito para reemplazar el diseño pre-implementación que describía un modelo de datos antiguo.

---

## 1. High-Level Architecture

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
│  ┌──────────┐ ┌──────────┐                                │
│  │   PDF   │  │   Prisma │                                │
│  └──────────┘ └──────────┘                                │
└──────────────────────────────┬──────────────────────────────┘
                              │ Prisma Client
┌─────────────────────────────▼──────────────────────────────┐
│                   POSTGRESQL DATABASE                        │
│  User · Doctor · Patient · Prescription                   │
│  PrescriptionItem · PrescriptionAuditLog                 │
└────────────────────────────────────────────────────────────┘
```

---

## 2. Data Model (Prisma Schema)

El schema Prisma es la **única fuente de verdad** del modelo de datos.

```prisma
enum Role { ADMIN · DOCTOR · PATIENT }

enum PrescriptionStatus { PENDING · CONSUMED }

enum ThemePreference { SYSTEM · LIGHT · DARK }

model User {
  id              String     @id @default(uuid())
  email           String     @unique
  passwordHash    String
  role            Role
  themePreference ThemePreference @default(SYSTEM)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  doctor    Doctor?
  patient   Patient?
  auditLogs PrescriptionAuditLog[] @relation("ChangedBy")

  @@index([email])
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
  createdAt  DateTime            @default(now())

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

## 3. Module Structure

| Módulo | Responsabilidad |
|--------|----------------|
| **AuthModule** | Login, logout, refresh, profile |
| **UsersModule** | User management + Doctor/Patient directory |
| **PrescriptionsModule** | Prescription CRUD, consume, PDF |
| **AdminModule** | Dashboard metrics, all prescriptions listing |
| **PdfModule** | Puppeteer PDF generation |
| **PrismaModule** | Singleton PrismaClient |

---

## 4. Auth Architecture

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

---

## 5. Security Model

### RBAC

| Accion | ADMIN | DOCTOR | PATIENT |
|--------|:-----:|:------:|:-------:|
| Login | OK | OK | OK |
| Ver propio perfil | OK | OK | OK |
| Crear usuario | OK | NO | NO |
| Listar pacientes | OK | OK | NO |
| Listar doctores | OK | NO | NO |
| Crear prescripcion | NO | OK | NO |
| Ver propias | OK | las que autoro | las que recibio |
| Consumir prescripcion | NO | NO | OK owner |
| Ver metricas | OK | NO | NO |

### IDOR Prevention

```typescript
private applyTenantBoundary(where: Prisma.PrescriptionWhereInput, user: JwtPayload) {
  if (user.role === Role.PATIENT) {
    where.patient = { userId: user.id };
  } else if (user.role === Role.DOCTOR) {
    where.author = { userId: user.id };
  }
}
```

---

## 6. Metrics Response

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

## 7. Folder Structure

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