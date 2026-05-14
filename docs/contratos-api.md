# Contratos API — Prescriptions App

> **OpenAPI 3.0.3 spec** | Autenticación via **HttpOnly cookies** (no Bearer header)
> Usa `withCredentials: true` en el cliente HTTP para enviar cookies cross-origin.

Todos los endpoints requieren JWT cookie a menos que esté marcado **Publico**.

---

## 1. API de Auth

### POST /auth/login

**Publico**

```yaml
POST /auth/login
Content-Type: application/json

{
  "email": "doctor@clinic.com",
  "password": "Password123!"
}
```

**Response 200:**

```json
{
  "user": {
    "id": "uuid-...",
    "email": "doctor@clinic.com",
    "name": "Dr. Juan Perez",
    "role": "DOCTOR"
  }
}
```

Cookies seteadas:
- `accessToken` — HttpOnly, 15 min
- `refreshToken` — HttpOnly, 7 dias

**Response 401:**

```json
{
  "statusCode": 401,
  "message": "Credenciales invalidas",
  "error": "Unauthorized"
}
```

---

### POST /auth/refresh

**Publico** — Cookie `refreshToken` enviada automaticamente por el navegador.

```yaml
POST /auth/refresh
Cookie: refreshToken=<token>
```

**Response 200:**

```json
{
  "user": {
    "id": "uuid-...",
    "email": "doctor@clinic.com",
    "name": "Dr. Juan Perez",
    "role": "DOCTOR"
  }
}
```

---

### POST /auth/logout

**Auth requerida**

```yaml
POST /auth/logout
Cookie: accessToken=<token>
```

**Response 200:**

```json
{
  "message": "Logged out successfully"
}
```

---

### GET /auth/profile

**Auth requerida**

```yaml
GET /auth/profile
Cookie: accessToken=<token>
```

**Response 200:**

```json
{
  "id": "uuid-...",
  "email": "doctor@clinic.com",
  "name": "Dr. Juan Perez",
  "role": "DOCTOR"
}
```

---

## 2. API de Users

### POST /users

**Auth requerida** — Solo rol `ADMIN`.

```yaml
POST /users
Cookie: accessToken=<token>
Content-Type: application/json

{
  "email": "nuevopaciente@clinic.com",
  "password": "Password123!",
  "name": "Maria Lopez",
  "role": "PATIENT"
}
```

**Response 201:**

```json
{
  "id": "uuid-...",
  "email": "nuevopaciente@clinic.com",
  "name": "Maria Lopez",
  "role": "PATIENT"
}
```

**Response 409** (email duplicado):

```json
{
  "statusCode": 409,
  "message": "El email ya esta registrado",
  "error": "Conflict"
}
```

---

### GET /users

**Auth requerida** — Solo `ADMIN`.

```yaml
GET /users
Cookie: accessToken=<token>
```

**Response 200:**

```json
[
  {
    "id": "uuid-...",
    "email": "admin@clinic.com",
    "name": "Admin",
    "role": "ADMIN"
  },
  {
    "id": "uuid-...",
    "email": "doctor@clinic.com",
    "name": "Dr. Juan Perez",
    "role": "DOCTOR"
  }
]
```

---

### GET /users/patients

**Auth requerida** — Roles `ADMIN`, `DOCTOR`.

```yaml
GET /users/patients
Cookie: accessToken=<token>
```

**Response 200:**

```json
[
  {
    "id": "uuid-...",
    "email": "patient@clinic.com",
    "name": "Carlos Garcia",
    "role": "PATIENT"
  }
]
```

---

### GET /users/doctors

**Auth requerida** — Solo `ADMIN`.

```yaml
GET /users/doctors
Cookie: accessToken=<token>
```

**Response 200:**

```json
[
  {
    "id": "uuid-...",
    "email": "doctor@clinic.com",
    "name": "Dr. Juan Perez",
    "role": "DOCTOR"
  }
]
```

---

### GET /users/:id

**Auth requerida** — Roles `ADMIN`, `DOCTOR`.

```yaml
GET /users/:id
Cookie: accessToken=<token>
```

**Response 200:**

```json
{
  "id": "uuid-...",
  "email": "patient@clinic.com",
  "name": "Carlos Garcia",
  "role": "PATIENT"
}
```

---

## 3. API de Prescriptions

### POST /prescriptions

**Auth requerida** — Solo rol `DOCTOR`. `doctorId` se infiere del JWT.

```yaml
POST /prescriptions
Cookie: accessToken=<token>
Content-Type: application/json

{
  "patientId": "uuid-paciente...",
  "notes": "Tomar con comida. Evitar alcohol.",
  "items": [
    {
      "name": "Aspirina 100mg",
      "dosage": "1 tableta",
      "instructions": "Una vez al dia por la manana"
    },
    {
      "name": "Omeprazol 20mg",
      "dosage": "1 capsula",
      "instructions": "Antes del desayuno"
    }
  ]
}
```

Tambien acepta `patientEmail` en lugar de `patientId`.

**Response 201:**

```json
{
  "id": "uuid-...",
  "code": "PRESC-M3XK9P",
  "status": "PENDING",
  "notes": "Tomar con comida. Evitar alcohol.",
  "createdAt": "2026-05-13T12:00:00.000Z",
  "updatedAt": "2026-05-13T12:00:00.000Z",
  "consumedAt": null,
  "patientId": "uuid-paciente...",
  "doctorId": "uuid-doctor...",
  "items": [
    {
      "name": "Aspirina 100mg",
      "dosage": "1 tableta",
      "instructions": "Una vez al dia por la manana"
    }
  ],
  "patient": {
    "id": "uuid-paciente...",
    "email": "patient@clinic.com",
    "name": "Carlos Garcia",
    "role": "PATIENT"
  },
  "doctor": {
    "id": "uuid-doctor...",
    "email": "doctor@clinic.com",
    "name": "Dr. Juan Perez",
    "role": "DOCTOR"
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

**Auth requerida** — Filtrado automatico por rol (Doctor ve las que autoro, Patient las que recibio, Admin ve todas).

**Query params:**

| Param | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `page` | integer | `1` | Numero de pagina |
| `limit` | integer | `10` | Items por pagina (max 100) |
| `status` | string | — | `PENDING` o `CONSUMED` |
| `from` | ISO date | — | Filtrar desde fecha |
| `to` | ISO date | — | Filtrar hasta fecha |
| `sort` | string | `createdAt` | Campo de ordenamiento |
| `order` | string | `desc` | `asc` o `desc` |

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid-...",
      "code": "PRESC-M3XK9P",
      "status": "PENDING",
      "notes": "Tomar con comida",
      "createdAt": "2026-05-13T12:00:00.000Z",
      "consumedAt": null,
      "items": [...],
      "patient": { "id": "...", "email": "...", "name": "...", "role": "PATIENT" },
      "doctor": { "id": "...", "email": "...", "name": "...", "role": "DOCTOR" }
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

**Auth requerida** — Dueño (doctor autor o patient dueño) o `ADMIN`.

**Response 200:** Igual que POST response con todos los detalles.

**Response 403:**

```json
{
  "statusCode": 403,
  "message": "No tenes acceso a esta prescripcion",
  "error": "Forbidden"
}
```

---

### PATCH /prescriptions/:id/consume

**Auth requerida** — Solo rol `PATIENT`, debe ser el dueño de la prescripcion.

```yaml
PATCH /prescriptions/:id/consume
Cookie: accessToken=<token>
```

**Response 200:**

```json
{
  "id": "uuid-...",
  "code": "PRESC-M3XK9P",
  "status": "CONSUMED",
  "consumedAt": "2026-05-13T15:00:00.000Z",
  ...
}
```

**Response 400** (ya consumida):

```json
{
  "statusCode": 400,
  "message": "Ya esta marcada como consumida",
  "error": "Bad Request"
}
```

---

### GET /prescriptions/:id/pdf

**Auth requerida** — Dueño o `ADMIN`.

```yaml
GET /prescriptions/:id/pdf
Cookie: accessToken=<token>
```

**Response 200:**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="prescription-PRESC-M3XK9P.pdf"

<binary PDF data>
```

---

## 4. API de Admin

### GET /admin/prescriptions

**Auth requerida** — Solo `ADMIN`. Mismos query params que `GET /prescriptions`.

**Response 200:** Misma estructura, pero lista todas sin filtro de rol.

---

### GET /admin/metrics

**Auth requerida** — Solo `ADMIN`.

```yaml
GET /admin/metrics
Cookie: accessToken=<token>
```

**Response 200:**

```json
{
  "totalPatients": 2,
  "totalDoctors": 2,
  "totalPrescriptions": 35,
  "prescriptionsByStatus": {
    "PENDING": 20,
    "CONSUMED": 15
  },
  "prescriptionsByDay": [
    { "date": "2026-05-10", "total": 5 },
    { "date": "2026-05-11", "total": 3 }
  ]
}
```

---

## 5. Codigos HTTP

| Codigo | Significado |
|--------|-------------|
| 200 | Exito |
| 201 | Creado |
| 400 | Bad Request (validacion, regla de negocio) |
| 401 | Unauthorized (token faltante/invalido/expirado) |
| 403 | Forbidden (rol insuficiente o no es dueño) |
| 404 | No encontrado |
| 409 | Conflict (email duplicado) |
| 500 | Error interno del servidor |