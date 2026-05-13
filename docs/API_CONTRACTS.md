# API Contracts — Prescriptions App MVP

> **OpenAPI 3.0.3 spec** | All endpoints require JWT Bearer token unless marked **Public**

---

## 1. Auth API

### POST /auth/login

**Public** — No authentication required.

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

**Public** — Requires `refreshToken` in body.

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
  "refreshToken": "new-refresh-token..."
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

**Auth required.**

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

**Auth required.**

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

## 2. Users API

### POST /users

**Auth required** — `admin` role only.

**Request:**

```yaml
POST /users
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "email": "newpatient@test.com",
  "password": "Patient123*",
  "name": "María López",
  "role": "patient",
  "birthDate": "1985-08-22"
}
```

For a doctor:

```json
{
  "email": "newdoctor@test.com",
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
  "email": "newpatient@test.com",
  "name": "María López",
  "role": "patient",
  "doctorId": null,
  "patientId": "cld4..."
}
```

**Response 409** (email already exists):

```json
{
  "statusCode": 409,
  "message": "El email ya está registrado",
  "error": "Conflict"
}
```

---

## 3. Patients API

### GET /patients

**Auth required** — `admin`, `doctor` roles.

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

**Auth required** — `admin`, `doctor` roles.

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
        "user": {
          "name": "Dr. Juan Pérez"
        }
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

## 4. Doctors API

### GET /doctors

**Auth required** — `admin` role only.

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

**Auth required** — `admin` role only.

**Request:**

```yaml
GET /doctors/cld9...
Authorization: Bearer <accessToken>
```

**Response 200:**

```json
{
  "id": "cld9...",
  "specialty": "Cardiología",
  "user": {
    "id": "cld10...",
    "email": "doctor@test.com",
    "name": "Dr. Juan Pérez",
    "role": "doctor"
  },
  "prescriptions": [...]
}
```

---

## 5. Prescriptions API

### POST /prescriptions

**Auth required** — `doctor` role only. `authorId` is inferred from JWT.

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

Or by patient email (instead of patientId):

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
  "patient": {
    "user": { "name": "Carlos García" }
  },
  "author": {
    "user": { "name": "Dr. Juan Pérez" }
  }
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

**Auth required** — Role-based filtering applied automatically.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `10` | Items per page (max 100) |
| `status` | string | — | Filter by `pending` or `consumed` |
| `from` | string (date) | — | Filter from date (ISO) |
| `to` | string (date) | — | Filter to date (ISO) |
| `sort` | string | `createdAt` | Sort field |
| `order` | string | `desc` | `asc` or `desc` |

**Doctor request:**

```yaml
GET /prescriptions?page=1&limit=10&status=pending
Authorization: Bearer <accessToken>
```

→ Returns only prescriptions authored by the doctor.

**Patient request:**

```yaml
GET /prescriptions?status=pending&sort=createdAt&order=desc
Authorization: Bearer <accessToken>
```

→ Returns only prescriptions received by the patient.

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
      "patient": {
        "user": { "name": "Carlos García" }
      },
      "author": {
        "user": { "name": "Dr. Juan Pérez" }
      }
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

**Auth required** — Owner (doctor who authored OR patient who received) or `admin`.

**Request:**

```yaml
GET /prescriptions/cld11...
Authorization: Bearer <accessToken>
```

**Response 200:** Same as POST response with full details.

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

**Auth required** — `patient` role only, must be the prescription owner.

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

**Response 400** (already consumed):

```json
{
  "statusCode": 400,
  "message": "Ya está marcada como consumida",
  "error": "Bad Request"
}
```

---

### GET /prescriptions/:id/pdf

**Auth required** — Owner or `admin`.

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

## 6. Metrics API

### GET /metrics

**Auth required** — `admin` role only.

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

## 7. Error Response Schema

All errors follow RFC 7807:

```json
{
  "statusCode": 400,
  "message": "Human readable message",
  "error": "Error Type",
  "timestamp": "2026-05-13T12:00:00.000Z",
  "path": "/prescriptions"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation, business rule) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient role or not owner) |
| 404 | Not Found |
| 409 | Conflict (duplicate email) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |