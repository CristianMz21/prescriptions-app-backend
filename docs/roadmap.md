# Roadmap — Prescriptions App

## Estado Actual del Proyecto

| Componente | Estado | Notas |
|-----------|--------|-------|
| Auth (login/refresh/logout) | ✅ Listo | JWT en HttpOnly cookies |
| Users (CRUD + listados) | ✅ Listo | ADMIN, DOCTOR, PATIENT |
| Prescriptions (CRUD + consume + PDF) | ✅ Listo | Puppeteer + Handlebars |
| Admin (metricas + listado total) | ✅ Listo | Metrics + all prescriptions |
| Swagger /docs | ✅ Listo | withCredentials enabled |
| Prisma migrations | ✅ Listo | Nunca synchronize: true |
| Seed data | ✅ Listo | Upsert (re-runnable) |
| Unit tests | ✅ Listo | Coverage >= 80% |
| E2E tests | ✅ Listo | auth.e2e-spec.ts + prescriptions.e2e-spec.ts |
| Wiki (MkDocs + GitHub Pages) | ✅ Listo | https://CristianMz21.github.io/prescriptions-app-backend/ |
| CI/CD (GitHub Actions) | ✅ Listo | Lint + tests + security |

---

## Features Implementadas

### Auth
- Login con email/password
- Refresh token automatico (cookie)
- Logout (limpieza de cookies)
- Perfil del usuario actual
- JWT de 15 min + refresh de 7 dias

### Users
- Crear usuario (ADMIN)
- Listar todos los usuarios (ADMIN)
- Listar pacientes (ADMIN + DOCTOR)
- Listar doctores (ADMIN)
- Ver detalle de usuario (ADMIN + DOCTOR)

### Prescriptions
- Crear prescripcion (DOCTOR)
- Listar propias filtradas por rol (All)
- Ver detalle (Owner/Admin)
- Marcar como consumida (PATIENT owner)
- Descargar PDF (Owner/Admin)

### Admin
- Listar todas las prescripciones (ADMIN)
- Dashboard de metricas: totals + by status + by day (ADMIN)

---

## Features Pendientes / Deuda Tecnica

### Alta Prioridad

| Feature | Descripcion | Status |
|---------|-------------|--------|
| Rate Limiting | `@nestjs/throttler` no instalado | ⚠️ Pendiente |
| Tests de coverage | Coverage actual desconocido | 🔄 Verificar |

### Media Prioridad

| Feature | Descripcion | Status |
|---------|-------------|--------|
| 2FA / MFA | Autenticacion de dos factores | ❌ Pendiente |
| Audit trail | Log de acciones sensibles | ❌ Pendiente |
| Notificaciones | Email/SMS al paciente cuando se crea prescripcion | ❌ Pendiente |
| Historico de cambios | Track cambios en prescripciones | ❌ Pendiente |
| Export CSV | Exportar listado de prescripciones | ❌ Pendiente |

### Baja Prioridad

| Feature | Descripcion | Status |
|---------|-------------|--------|
| Dark mode en docs | Tema oscuro para la wiki | ❌ Pendiente |
| Multi-idioma | Soporte ingles/espanol | ❌ Pendiente |
| Carga de archivos | Avatar para usuarios | ❌ Pendiente |

---

## Decisiones de Arquitectura Tomadas

### 1. Roles en User.role (no tablas separadas)

Un solo modelo `User` con `role: ADMIN | DOCTOR | PATIENT`. No hay `Doctor` ni `Patient` como tablas separadas.

**Ventaja:** Queries simples, no hay joins extras.
**Desventaja:** Menos flexibilidad si en el futuro se necesitan perfiles complejos por rol.

### 2. Items como Json (no PrescriptionItem)

`Prescription.items` es un campo `Json` con array de `{name, dosage, instructions}`.

**Ventaja:** Schema simple, sin tabla intermedia.
**Desventaja:** No se puede hacer query directa sobre items individuales en SQL.

### 3. Auth con Cookies (no Bearer)

Tokens en HttpOnly cookies, no en Authorization header.

**Ventaja:** Proteccion contra XSS, CSRF mitigado con sameSite.
**Desventaja:** Mas complejo de testar con curl (requiere --cookie).

### 4. PDF con Puppeteer (no pdfkit)

Generacion de PDF via Puppeteer (headless Chrome) + Handlebars.

**Ventaja:** PDF de alta fidelidad,HTML completo.
**Desventaja:** Puppeteer es heavy dependency, CI necesita Chromium.

---

## Glosario

| Termino | Definicion |
|---------|------------|
| IDOR | Insecure Direct Object Reference — acceso a recursos de otro usuario |
| RBAC | Role-Based Access Control — control de acceso por roles |
| HttpOnly cookie | Cookie no accesible via JavaScript (segura contra XSS) |
| fast-fail | La app no inicia si falta configuracion critica |
| seed | Datos de prueba insertados en la DB |