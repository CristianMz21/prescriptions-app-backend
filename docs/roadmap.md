# Roadmap — Prescriptions App

## Estado Actual del Proyecto

| Componente | Estado | Notas |
|-----------|--------|-------|
| Auth (login/refresh/logout) | OK Listo | JWT en HttpOnly cookies |
| Users (CRUD + listados) | OK Listo | ADMIN, DOCTOR, PATIENT con Doctor/Patient tables |
| Prescriptions (CRUD + consume + PDF) | OK Listo | Puppeteer + Handlebars, code RX- |
| Admin (metricas + listado total) | OK Listo | Metrics con topDoctors + byDay |
| Swagger /docs | OK Listo | withCredentials enabled |
| Prisma migrations | OK Listo | Nunca synchronize: true |
| Seed data | OK Listo | Upsert (re-runnable) |
| Unit tests | OK Listo | Coverage >= 80% |
| E2E tests | OK Listo | auth.e2e-spec.ts + prescriptions.e2e-spec.ts |
| Wiki (MkDocs + GitHub Pages) | OK Listo | https://CristianMz21.github.io/prescriptions-app-backend/ |
| CI/CD (GitHub Actions) | OK Listo | Lint + tests + security |

---

## Features Implementadas

### Auth
- Login con email/password → `{ message, user: { id, email, role } }`
- Refresh token automatico (cookie)
- Logout (limpieza de cookies)
- Perfil del usuario actual
- JWT de 15 min + refresh de 7 dias en HttpOnly cookies

### Users
- Crear usuario (ADMIN) con campos de Doctor/Patient opcionales
- Listar todos los usuarios (ADMIN)
- Listar pacientes (ADMIN + DOCTOR)
- Listar doctores (ADMIN)
- Ver detalle de usuario (ADMIN + DOCTOR)

### Prescriptions
- Crear prescripcion (DOCTOR) con `code: RX-XXXXXXXXXX`
- Listar propias filtradas por rol (All)
- Ver detalle (Owner/Admin)
- Marcar como consumida (PATIENT owner)
- Descargar PDF (Owner/Admin)
- Audit log de cambios de estado

### Admin
- Listar todas las prescripciones (ADMIN)
- Dashboard de metricas: totals + byStatus + byDay + topDoctors (ADMIN)

---

## Decisiones de Arquitectura Tomadas

### 1. Doctor/Patient como Tablas Separadas

`Doctor` y `Patient` son tablas separadas vinculadas 1:1 a `User` via `userId`.

**Ventaja:** Datos específicos del rol (specialty para Doctor, birthDate para Patient)
**Tradeoff:** Queries de listado requieren join con la tabla de rol

### 2. Items como Tabla Relacional

`Prescription.items` es una relación a la tabla `PrescriptionItem` — no un campo Json.

**Ventaja:** Indexación por item, queries per-item, constraints sobre quantity
**Tradeoff:** Schema más complejo, más joins

### 3. Auth con Cookies (no Bearer)

Tokens en HttpOnly cookies, no en Authorization header.

**Ventaja:** Proteccion contra XSS, CSRF mitigado con sameSite
**Tradeoff:** Mas complejo de testar con curl (requiere --cookie)

### 4. PDF con Puppeteer (no pdfkit)

Generacion de PDF via Puppeteer (headless Chrome) + Handlebars.

**Ventaja:** PDF de alta fidelidad, HTML completo
**Tradeoff:** Puppeteer es heavy dependency, CI necesita Chromium

---

## Glosario

| Termino | Definicion |
|---------|------------|
| IDOR | Insecure Direct Object Reference — acceso a recursos de otro usuario |
| RBAC | Role-Based Access Control — control de acceso por roles |
| HttpOnly cookie | Cookie no accesible via JavaScript (segura contra XSS) |
| fast-fail | La app no inicia si falta configuracion critica |
| seed | Datos de prueba insertados en la DB |
| applyTenantBoundary | Funcion que filtra prescriptions por rol en findAll |
| topDoctors | Top 5 doctores por cantidad de prescripciones en el periodo |