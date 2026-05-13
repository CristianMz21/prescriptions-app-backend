# Contratos de API — App de Prescripciones MVP

> **OpenAPI 3.0.3 spec** | Todos los endpoints requieren JWT Bearer a menos que esté marcado **Público**

---

## 1. API de Auth

### POST /auth/login

**Público** — Sin autenticación requerida.

**Request:**

```yaml
POST /auth/login
Content-Type: application/json

{
  "email": "doctor@test.com",
  "password": "Doctor123*"
}
```

**Response 200:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a1b2c3d4e5f6...",
  "user": {
    "id": "cld1...",
    "email": "doctor@test.com",
    "name": "Dr. Juan Pérez",
    "role": "doctor",
    "doctorId": "cld2...",
    "patientId": null
  }
}
```

**Response 401:**

```json
{
  "statusCode": 401,
  "message": "Credenciales inválidas",
  "error": "Unauthorized"
}
```

---

### POST /auth/refresh

**Público** — Requiere `refreshToken` en body.

**Request:**

```yaml
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "a1b2c3d4e5f6..."
}
```

**Response 200:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "nuevo-refresh-token..."
}
```

**Response 401:**

```json
{
  "statusCode": 401,
  "message": "Refresh token inválido o expirado",
  "error": "Unauthorized"
}
```

---

### POST /auth/logout

**Auth requerida.**

**Request:**

```yaml
POST /auth/logout
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "refreshToken": "a1b2c3d4e5f6..."
}
```

**Response 200:**

```json
{
  "message": "Logged out successfully"
}
```

---

### GET /auth/me

**Auth requerida.**

**Request:**

```yaml
GET /auth/me
Authorization: Bearer <accessToken>
```

**Response 200:**

```json
{
  "id": "cld1...",
  "email": "doctor@test.com",
  "name": "Dr. Juan Pérez",
  "role": "doctor",
  "doctorId": "cld2...",
  "patientId": null
}
```

---

## 2. API de Users

### POST /users

**Auth requerida** — Solo rol `admin`.

**Request:**

```yaml
POST /users
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "email": "nuevopaciente@test.com",
  "password": "Patient123*",
  "name": "María López",
  "role": "patient",
  "birthDate": "1985-08-22"
}
```

Para un doctor:

```json
{
  "email": "nuevodoctor@test.com",
  "password": "Doctor123*",
  "name": "Dra. Ana García",
  "role": "doctor",
  "specialty": "Dermatología"
}
```

**Response 201:**

```json
{
  "id": "cld3...",
  "email": "nuevopaciente@test.com",
  "name": "María López",
  "role": "patient",
  "doctorId": null,
  "patientId": "cld4..."
}
```

**Response 409** (email ya existe):

```json
{
  "statusCode": 409,
  "message": "El email ya está registrado",
  "error": "Conflict"
}
```

---

## 3. API de Patients

### GET /patients

**Auth requerida** — Roles `admin`, `doctor`.

**Request:**

```yaml
GET /patients
Authorization: Bearer <accessToken>
```

**Response 200:**

```json
[
  {
    "id": "cld5...",
    "birthDate": "1990-05-15T00:00:00.000Z",
    "user": {
      "id": "cld6...",
      "email": "patient@test.com",
      "name": "Carlos García",
      "role": "patient"
    },
    "prescriptions": [
      {
        "id": "cld7...",
        "code": "PRESC-ABC123",
        "status": "pending",
        "createdAt": "2026-05-13T10:00:00.000Z"
      }
    ]
  }
]
```

---

### GET /patients/:id

**Auth requerida** — Roles `admin`, `doctor`.

**Request:**

```yaml
GET /patients/cld5...
Authorization: Bearer <accessToken>
```

**Response 200:**

```json
{
  "id": "cld5...",
  "birthDate": "1990-05-15T00:00:00.000Z",
  "user": {
    "id": "cld6...",
    "email": "patient@test.com",
    "name": "Carlos García",
    "role": "patient"
  },
  "prescriptions": [
    {
      "id": "cld7...",
      "code": "PRESC-ABC123",
      "status": "pending",
      "notes": "Tomar con comida",
      "createdAt": "2026-05-13T10:00:00.000Z",
      "updatedAt": "2026-05-13T10:00:00.000Z",
      "consumedAt": null,
      "items": [
        {
          "id": "cld8...",
          "name": "Aspirina 100mg",
          "dosage": "1 tableta",
          "quantity": 30,
          "instructions": "Una vez al día por la mañana"
        }
      ],
      "author": {
        "user": { "name": "Dr. Juan Pérez" }
      }
    }
  ]
}
```

**Response 404:**

```json
{
  "statusCode": 404,
  "message": "Paciente no encontrado",
  "error": "Not Found"
}
```

---

## 4. API de Doctors

### GET /doctors

**Auth requerida** — Solo rol `admin`.

**Request:**

```yaml
GET /doctors
Authorization: Bearer <accessToken>
```

**Response 200:**

```json
[
  {
    "id": "cld9...",
    "specialty": "Cardiología",
    "user": {
      "id": "cld10...",
      "email": "doctor@test.com",
      "name": "Dr. Juan Pérez",
      "role": "doctor"
    },
    "prescriptions": [
      {
        "id": "cld7...",
        "code": "PRESC-ABC123",
        "status": "pending",
        "createdAt": "2026-05-13T10:00:00.000Z"
      }
    ]
  }
]
```

---

### GET /doctors/:id

**Auth requerida** — Solo rol `admin`.

**Request:**

```yaml
GET /doctors/cld9...
Authorization: Bearer <accessToken>
```

---

## 5. API de Prescriptions

### POST /prescriptions

**Auth requerida** — Solo rol `doctor`. `authorId` se infiere del JWT.

**Request:**

```yaml
POST /prescriptions
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "patientId": "cld5...",
  "notes": "Tomar con comida. Evitar alcohol.",
  "items": [
    {
      "name": "Aspirina 100mg",
      "dosage": "1 tableta",
      "quantity": "30",
      "instructions": "Una vez al día por la mañana"
    },
    {
      "name": "Omeprazol 20mg",
      "dosage": "1 cápsula",
      "quantity": "14",
      "instructions": "Antes del desayuno"
    }
  ]
}
```

O por email del paciente (en lugar de patientId):

```json
{
  "patientEmail": "patient@test.com",
  "notes": "Tratamiento de 30 días",
  "items": [...]
}
```

**Response 201:**

```json
{
  "id": "cld11...",
  "code": "PRESC-M3XK9P",
  "status": "pending",
  "notes": "Tomar con comida. Evitar alcohol.",
  "createdAt": "2026-05-13T12:00:00.000Z",
  "updatedAt": "2026-05-13T12:00:00.000Z",
  "consumedAt": null,
  "patientId": "cld5...",
  "authorId": "cld9...",
  "items": [
    {
      "id": "cld12...",
      "name": "Aspirina 100mg",
      "dosage": "1 tableta",
      "quantity": 30,
      "instructions": "Una vez al día por la mañana"
    }
  ],
  "patient": { "user": { "name": "Carlos García" } },
  "author": { "user": { "name": "Dr. Juan Pérez" } }
}
```

**Response 400:**

```json
{
  "statusCode": 400,
  "message": "Se requiere patientId o patientEmail",
  "error": "Bad Request"
}
```

---

### GET /prescriptions

**Auth requerida** — Filtrado automático por rol.

**Parámetros de query:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Número de página |
| `limit` | integer | `10` | Items por página (max 100) |
| `status` | string | — | Filtrar por `pending` o `consumed` |
| `from` | string (fecha) | — | Filtrar desde fecha (ISO) |
| `to` | string (fecha) | — | Filtrar hasta fecha (ISO) |
| `sort` | string | `createdAt` | Campo de ordenamiento |
| `order` | string | `desc` | `asc` o `desc` |

**Doctor request:**

```yaml
GET /prescriptions?page=1&limit=10&status=pending
Authorization: Bearer <accessToken>
```

→ Retorna solo las prescripciones que el doctor autorizó.

**Patient request:**

```yaml
GET /prescriptions?status=pending&sort=createdAt&order=desc
Authorization: Bearer <accessToken>
```

→ Retorna solo las prescripciones recibidas por el paciente.

**Response 200:**

```json
{
  "data": [
    {
      "id": "cld11...",
      "code": "PRESC-M3XK9P",
      "status": "pending",
      "notes": "Tomar con comida",
      "createdAt": "2026-05-13T12:00:00.000Z",
      "consumedAt": null,
      "items": [...],
      "patient": { "user": { "name": "Carlos García" } },
      "author": { "user": { "name": "Dr. Juan Pérez" } }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### GET /prescriptions/:id

**Auth requerida** — Dueño (doctor autor o patient dueño) o `admin`.

**Response 200:** Igual que POST response con todos los detalles.

**Response 403:**

```json
{
  "statusCode": 403,
  "message": "No tenés acceso a esta prescripción",
  "error": "Forbidden"
}
```

---

### PATCH /prescriptions/:id/consume

**Auth requerida** — Solo rol `patient`, debe ser el dueño de la prescripción.

**Request:**

```yaml
PATCH /prescriptions/cld11.../consume
Authorization: Bearer <accessToken>
```

**Response 200:**

```json
{
  "id": "cld11...",
  "code": "PRESC-M3XK9P",
  "status": "consumed",
  "consumedAt": "2026-05-13T15:00:00.000Z",
  ...
}
```

**Response 400** (ya consumida):

```json
{
  "statusCode": 400,
  "message": "Ya está marcada como consumida",
  "error": "Bad Request"
}
```

---

### GET /prescriptions/:id/pdf

**Auth requerida** — Dueño o `admin`.

**Request:**

```yaml
GET /prescriptions/cld11.../pdf
Authorization: Bearer <accessToken>
```

**Response 200:**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="prescription-PRESC-M3XK9P.pdf"

<binary PDF data>
```

---

## 6. API de Metrics

### GET /metrics

**Auth requerida** — Solo rol `admin`.

**Request:**

```yaml
GET /metrics
Authorization: Bearer <accessToken>
```

**Response 200:**

```json
{
  "totalPatients": 2,
  "totalDoctors": 2,
  "totalPrescriptions": 35,
  "prescriptionsByStatus": {
    "pending": 20,
    "consumed": 15
  },
  "prescriptionsByDay": [
    { "date": "2026-05-10", "total": 5 },
    { "date": "2026-05-11", "total": 3 },
    { "date": "2026-05-12", "total": 8 },
    { "date": "2026-05-13", "total": 2 }
  ]
}
```

---

## 7. Formato de Respuesta de Error

Todos los errores siguen RFC 7807:

```json
{
  "statusCode": 400,
  "message": "Mensaje legible",
  "error": "Error Type",
  "timestamp": "2026-05-13T12:00:00.000Z",
  "path": "/prescriptions"
}
```

### Códigos HTTP Comunes

| Código | Significado |
|--------|-------------|
| 200 | Éxito |
| 201 | Creado |
| 400 | Bad Request (validación, regla de negocio) |
| 401 | Unauthorized (token faltante/inválido) |
| 403 | Forbidden (rol insuficiente o no es dueño) |
| 404 | No encontrado |
| 409 | Conflict (email duplicado) |
| 429 | Demasiadas solicitudes (rate limited) |
| 500 | Error interno del servidor |