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
└── decorators/
    ├── roles.decorator.ts
    └── current-user.decorator.ts
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
3. Response: { user } (tokens en cookies, no en body)
```

### Flujo de Refresh

```
1. POST /auth/refresh (cookie refreshToken enviada automaticamente)
2. AuthService.refresh():
   - Verifica refreshToken con JWT_REFRESH_SECRET
   - Firma nuevo accessToken
   - Setea nueva cookie accessToken
3. Response: { user }
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
└── users.service.ts
```

### Endpoints

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| `POST` | `/users` | Crear usuario | ADMIN |
| `GET` | `/users` | Listar todos | ADMIN |
| `GET` | `/users/patients` | Listar pacientes | ADMIN, DOCTOR |
| `GET` | `/users/doctors` | Listar doctores | ADMIN |
| `GET` | `/users/:id` | Detalle usuario | ADMIN, DOCTOR |

### DTOs Principales

```typescript
// CreateUserDto
{
  email: string;        // unico
  password: string;
  name: string;
  role: 'ADMIN' | 'DOCTOR' | 'PATIENT';
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
    └── pagination.dto.ts
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
  patientId?: string;        // ID del paciente (mutually exclusive con patientEmail)
  patientEmail?: string;     // Email del paciente (busca y obtiene ID)
  notes?: string;
  items: Array<{
    name: string;
    dosage: string;
    instructions: string;
  }>;
}
```

**Validacion**: Se requiere `patientId` O `patientEmail`, no ambos. Items debe tener al menos 1 elemento.

### Logica de FindAll por Rol

```typescript
// DOCTOR  → where: { doctorId: currentUser.id }
// PATIENT → where: { patientId: currentUser.id }
// ADMIN   → sin filtro (ve todas)
```

### IDOR Prevention en consume()

```typescript
async consume(prescriptionId: string, currentUser: User) {
  const prescription = await this.prisma.prescription.findFirst({
    where: {
      id: prescriptionId,
      patientId: currentUser.id,  // Solo el paciente puede consumir
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

---

## AdminModule

Endpoints exclusivos de administracion.

### Archivos

```
admin/
├── admin.module.ts
├── admin.controller.ts
└── admin.service.ts
```

### Endpoints

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| `GET` | `/admin/prescriptions` | Listar todas con filtros | ADMIN |
| `GET` | `/admin/metrics` | Métricas agregadas | ADMIN |

### Metrics Response

```typescript
{
  totalPatients: number;
  totalDoctors: number;
  totalPrescriptions: number;
  prescriptionsByStatus: {
    PENDING: number;
    CONSUMED: number;
  };
  prescriptionsByDay: Array<{
    date: string;   // YYYY-MM-DD
    total: number;
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
// Uso en un servicio
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
  ├─ Validar patientId o patientEmail
  ├─ user.findFirst({ where: { id: patientId, role: PATIENT } })
  ├─ Generar code: PRESC-{random6}
  ├─ prescription.create({ data: { ..., doctorId: currentUser.id } })
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
  ├─ Si PATIENT → where: { patientId: currentUser.id }
  ├─ pagination (page, limit, status, from, to, sort, order)
  ├─ include: { patient: true, doctor: true }
  └─ Return { data: [...], meta: { page, limit, total, totalPages } }
```