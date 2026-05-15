# Modulos — Prescriptions App

## Indice

- [AuthModule](#authmodule)
- [UsersModule](#usersmodule)
- [PrescriptionsModule](#prescriptionsmodule)
- [AdminModule](#adminmodule)
- [PdfModule](#pdfmodule)
- [PrismaModule](#prismamodule)

---

## AuthModule

Gestiona autenticación: login, logout, refresh y perfil del usuario actual.

### Archivos

```
auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── strategies/
│   ├── jwt.strategy.ts
│   └── refresh-token.strategy.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   └── roles.guard.ts
├── decorators/
│   ├── roles.decorator.ts
│   └── current-user.decorator.ts
└── dto/
    ├── login.dto.ts
    ├── login-response.dto.ts
    └── refresh-token.dto.ts
```

### Endpoints

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| `POST` | `/auth/login` | Login con email/password | Publico |
| `POST` | `/auth/refresh` | Refrescar access token | Publico (cookie) |
| `POST` | `/auth/logout` | Limpiar cookies | JWT |
| `GET` | `/auth/profile` | Perfil del usuario actual | JWT |

### Flujo de Login

```
1. POST /auth/login {email, password}
2. AuthService.login():
   - Busca user por email (Prisma)
   - bcrypt.compare(password, passwordHash)
   - Si valido: firma accessToken (15m) + refreshToken (7d)
   - Setea HttpOnly cookies
3. Response: { message: "Login successful", user: { id, email, role } }
   (tokens en cookies, no en body)
```

### Flujo de Refresh

```
1. POST /auth/refresh (cookie refreshToken enviada automaticamente)
2. AuthService.refresh():
   - Verifica refreshToken con JWT_REFRESH_SECRET
   - Firma nuevo accessToken
   - Setea nueva cookie accessToken
3. Response: { user: { id, email, role } }
```

### JWT Payload

```typescript
{
  sub: string;   // User ID (UUID)
  email: string;
  role: Role;    // ADMIN | DOCTOR | PATIENT
}
```

### Guards

**JwtAuthGuard** — Extrae `accessToken` de cookie, verifica JWT con `JWT_ACCESS_SECRET`. Si expire/ausente → 401.

**RolesGuard** — Usa `@Roles()` decorator para verificar `user.role`.

### Decorators

```typescript
@Roles('DOCTOR')           // Requiere rol DOCTOR
@CurrentUser()             // Inyecta usuario del JWT
@GetUser()                  // Alias de CurrentUser
```

---

## UsersModule

Gestión de usuarios y listado de pacientes/doctores.

### Archivos

```
users/
├── users.module.ts
├── users.controller.ts
├── users.service.ts
└── dto/
    ├── create-user.dto.ts
    └── user-entity.ts
```

### Endpoints

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| `POST` | `/users` | Crear usuario | ADMIN |
| `GET` | `/users` | Listar todos | ADMIN |
| `GET` | `/users/patients` | Listar pacientes | ADMIN, DOCTOR |
| `GET` | `/users/doctors` | Listar doctores | ADMIN |
| `GET` | `/users/:id` | Detalle usuario | ADMIN, DOCTOR |

### User Response (UserEntity)

El `User` expuesta en API tiene campos `name` (requerido) y `phone` (opcional). Campos:

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `email` | string | Email |
| `name` | string | Nombre para display en UI |
| `phone` | string? | Teléfono de contacto |
| `role` | Role | ADMIN \| DOCTOR \| PATIENT |
| `themePreference` | ThemePreference | SYSTEM \| LIGHT \| DARK |
| `createdAt` | DateTime | Fecha de creación |
| `updatedAt` | DateTime | Última actualización |
| `doctor` | DoctorProfileSummary? | Solo para DOCTOR |
| `patient` | PatientProfileSummary? | Solo para PATIENT |

### CreateUserDto

```typescript
{
  email: string;
  password: string;
  role: 'ADMIN' | 'DOCTOR' | 'PATIENT';
  name: string;                  // Requerido — nombre para UI
  phone?: string;                 // Opcional — teléfono de contacto
  specialty?: string;             // solo para DOCTOR
  medicalId?: string;            // solo para DOCTOR
  signatureText?: string;        // solo para DOCTOR
  signatureImageUrl?: string;    // solo para DOCTOR
  birthDate?: string;            // solo para PATIENT (ISO-8601)
}
```

---

## PrescriptionsModule

Core del negocio. CRUD de prescripciones, acción consume, descarga PDF.

### Archivos

```
prescriptions/
├── prescriptions.module.ts
├── prescriptions.controller.ts
├── prescriptions.service.ts
└── dto/
    ├── create-prescription.dto.ts
    └── prescription-response.dto.ts
```

### Endpoints

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| `POST` | `/prescriptions` | Crear prescripcion | DOCTOR |
| `GET` | `/prescriptions` | Listar (filtrado por rol) | All |
| `GET` | `/prescriptions/:id` | Detalle | Owner/Admin |
| `PATCH` | `/prescriptions/:id/consume` | Marcar consumida | PATIENT (owner) |
| `GET` | `/prescriptions/:id/pdf` | Descargar PDF | Owner/Admin |

### CreatePrescriptionDto

```typescript
{
  patientId: string;        // ID del Patient (UUID)
  items: Array<{
    name: string;
    dosage?: string;
    quantity?: number;
    instructions?: string;
  }>;
  notes?: string;
}
```

**Nota**: No existe `patientEmail` — solo `patientId`.

### PrescriptionResponseDto

```typescript
{
  id: string;
  code: string;              // RX-XXXXXXXXXX
  status: PrescriptionStatus;
  items: PrescriptionItem[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  consumedAt?: Date;
  authorId: string;          // Doctor UUID
  patientId: string;         // Patient UUID
  author: {
    id: string;
    specialty?: string;
    medicalId?: string;
    signatureText?: string;
    signatureImageUrl?: string;
    user: { id: string; email: string; role: string; };
  };
  patient: {
    id: string;
    birthDate?: Date;
    user: { id: string; email: string; role: string; };
  };
}
```

### Logica de FindAll por Rol (applyTenantBoundary)

```typescript
// PATIENT → where: { patient: { userId: currentUser.id } }
// DOCTOR  → where: { author: { userId: currentUser.id } }
// ADMIN   → sin filtro (ve todas)
```

### IDOR Prevention en consume()

```typescript
async consume(prescriptionId: string, currentUser: JwtPayload) {
  const prescription = await this.prisma.prescription.findFirst({
    where: {
      id: prescriptionId,
      patient: { userId: currentUser.id },  // Solo el paciente puede consumir
    },
  });
  if (!prescription) {
    throw new ForbiddenException('No tenes acceso a esta prescripcion');
  }
  if (prescription.status === 'CONSUMED') {
    throw new BadRequestException('Ya esta marcada como consumida');
  }
  return this.prisma.prescription.update({ ... });
}
```

### Email Post-Create

Al crear una prescripción exitosamente, `PrescriptionsService` envía un email de notificación al paciente (`sendPrescriptionCreatedEmail`). Si `SMTP_HOST` no está configurado, el email se跳过 — no falla la creación.

---

## AdminModule

Endpoints exclusivos de administracion.

### Archivos

```
admin/
├── admin.module.ts
├── admin.controller.ts
├── admin.service.ts
└── dto/
    └── metrics-response.dto.ts
```

### Endpoints

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| `GET` | `/admin/prescriptions` | Listar todas con filtros | ADMIN |
| `GET` | `/admin/metrics` | Métricas agregadas | ADMIN |

### Metrics Response

```typescript
{
  totals: {
    doctors: number;
    patients: number;
    prescriptions: number;
  };
  byStatus: {
    pending: number;
    consumed: number;
  };
  byDay: Array<{
    date: string;   // YYYY-MM-DD
    count: number;
  }>;
  topDoctors: Array<{
    authorId: string;
    count: number;
  }>;
}
```

---

## PdfModule

Generacion de PDF via Puppeteer (headless Chrome) + Handlebars templates.

### Archivos

```
pdf/
├── pdf.service.ts
└── templates/
    └── prescription.hbs
```

### Flujo de Generacion

```
1. GET /prescriptions/:id/pdf
2. PrescriptionsController → PdfService.generatePdf(prescription)
3. PdfService:
   - Carga template Handlebars
   - Compila data (prescription + patient + doctor)
   - Puppeteer: abre Chrome headless
   - Renderiza HTML → PDF buffer
   - Elimina browser
4. Response: StreamableFile (Content-Type: application/pdf)
```

### Dependencias

- **Puppeteer** — Chrome headless (heavy dev dependency)
- **Handlebars** — Template engine
- CI requiere Chromium instalado en el runner

---

## EmailModule

Notificaciones por email via SMTP (nodemailer). **Modo no-op si `SMTP_HOST` no está configurado** — la app funciona sin email.

### Archivos

```
email/
├── email.module.ts
└── email.service.ts
```

### EmailService

```typescript
// Constructor — no-op si SMTP_HOST no está configurado
constructor(private configService: ConfigService) {
  const host = this.configService.get<string>('SMTP_HOST');
  this.enabled = Boolean(host);
}

// Envía email con datos de la prescripción
async sendPrescriptionCreatedEmail(
  to: string,
  payload: PrescriptionEmailPayload,  // { code, doctorEmail, itemNames }
): Promise<void>
```

### Variables de Entorno

| Variable | Requerido | Default |
|----------|-----------|---------|
| `SMTP_HOST` | No | — (disabled) |
| `SMTP_PORT` | No | `587` |
| `SMTP_USER` | No | — |
| `SMTP_PASS` | No | — |
| `SMTP_FROM` | No | `no-reply@clinic.local` |

### Integración

Cuando se crea una prescripción, `PrescriptionsService` inyecta `EmailService` y llama `sendPrescriptionCreatedEmail(to, payload)` — no bloquea la respuesta HTTP (async, errors logueados no lanzados).

---

## PrismaModule

Proveedor global del PrismaClient singleton.

### Archivos

```
prisma/
├── prisma.module.ts
├── prisma.service.ts
```

### PrismaService

Extiende `PrismaClient` de `@prisma/client`. Se inyecta en todos los servicios que necesitan acceso a la DB.

```typescript
constructor(private prisma: PrismaService) {}

async findUser(id: string) {
  return this.prisma.user.findUnique({ where: { id } });
}
```

**No crear nuevas instancias** — usar la inyectada. Asegura un solo connection pool.

---

## Flujo de Datos Completo

### Crear Prescripcion (DOCTOR)

```
Doctor App
  │
  ├─ POST /prescriptions { patientId, items, notes }
  │   Cookie: accessToken
  │
PrescriptionsController
  ├─ @UseGuards(JwtAuthGuard, RolesGuard)
  ├─ @Roles('DOCTOR')
  │
PrescriptionsService.create(dto, currentUser)
  ├─ Validar patientId existe y role=PATIENT
  ├─ Generar code: RX-{random10}
  ├─ prescription.create({ data: { ..., authorId: doctor.id } })
  └─ Return prescription (201)
```

### Ver Propias Prescripciones (PATIENT)

```
Patient App
  │
  ├─ GET /prescriptions
  │   Cookie: accessToken
  │
PrescriptionsController
  ├─ @UseGuards(JwtAuthGuard, RolesGuard)
  │
PrescriptionsService.findAll(pagination, currentUser)
  ├─ Si PATIENT → where: { patient: { userId: currentUser.id } }
  ├─ pagination (page, limit, status, from, to, sort, order)
  ├─ include: { patient: true, author: true }
  └─ Return { data: [...], meta: { page, limit, total, totalPages } }
```

### Consumir Prescripcion (PATIENT)

```
Patient App
  │
  ├─ PATCH /prescriptions/:id/consume
  │   Cookie: accessToken
  │
PrescriptionsController
  ├─ @UseGuards(JwtAuthGuard, RolesGuard)
  ├─ @Roles('PATIENT')
  │
PrescriptionsService.consume(id, currentUser)
  ├─ applyTenantBoundary(where, currentUser) → patient.userId = currentUser.id
  ├─ findFirst → verificar ownership
  ├─ Verificar status !== CONSUMED
  ├─ prescription.update({ status: CONSUMED, consumedAt: now() })
  ├─ auditLog.create({ fromStatus: PENDING, toStatus: CONSUMED })
  └─ Return updated prescription
```