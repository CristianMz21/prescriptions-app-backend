# Prescription Management API

API de gestión de prescripciones médicas. Encargate de la autenticación, recetas y métricas de una clínica.

## Quick Start

**Prereqs:** Docker, pnpm 11.1.1, Node ≥ 20.

```bash
git clone https://github.com/CristianMz21/prescriptions-app-backend.git
cd prescriptions-app-backend
pnpm dev:up      # equivalente a: node scripts/dev-up.mjs
```

Listo en `http://localhost:3000`. Documentación interactiva en `http://localhost:3000/docs`.

El script funciona en **Windows, macOS y Linux** sin shell-específico.

<details>
<summary><strong>¿Qué hace <code>dev:up</code>?</strong></summary>

1. Verifica `docker`, `pnpm` y Node ≥ 20 en el PATH.
2. Crea `.env` desde `.env.example` si no existe.
3. Arranca Postgres (`docker compose up -d postgres`) y espera a `pg_isready`.
4. `pnpm install --frozen-lockfile` (sólo si `pnpm-lock.yaml` cambió).
5. `pnpm exec prisma generate` + `pnpm exec prisma migrate deploy`.
6. `pnpm run build` + `pnpm exec prisma db seed` (el seed se ejecuta contra `dist/prisma/seed.js`).
7. `pnpm run start:dev` (Ctrl-C lo detiene limpiamente).

Flags útiles: `--skip-seed`, `--skip-build`, `--dev` (usa `migrate dev`), `--no-server` (sale tras el seed).

</details>

<details>
<summary><strong>Pasos manuales (sin <code>dev:up</code>)</strong></summary>

Si necesitas debuggear un paso individual:

```bash
cp .env.example .env                     # editar JWT_*_SECRET
docker compose up -d postgres            # desde la raíz del monorepo
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate dev
pnpm run build                           # obligatorio antes del seed
pnpm exec prisma db seed                 # corre node dist/prisma/seed.js
pnpm run start:dev
```

</details>

---

## Credenciales Seed

| Email | Role | Password |
|-------|------|----------|
| `admin@clinic.com` | ADMIN | `SEED_DEFAULT_PASSWORD` |
| `doctor@clinic.com` | DOCTOR | `SEED_DEFAULT_PASSWORD` |
| `doctor2@clinic.com` | DOCTOR | `SEED_DEFAULT_PASSWORD` |
| `patient@clinic.com` | PATIENT | `SEED_DEFAULT_PASSWORD` |

---

## Endpoints Principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/login` | Login |
| `POST` | `/auth/refresh` | Refrescar token |
| `POST` | `/auth/logout` | Logout |
| `GET` | `/auth/profile` | Mi perfil |
| `POST` | `/users` | Crear usuario (ADMIN) |
| `GET` | `/users` | Listar usuarios (ADMIN) |
| `GET` | `/users/patients` | Listar pacientes |
| `POST` | `/prescriptions` | Crear receta (DOCTOR) |
| `GET` | `/prescriptions` | Mis recetas |
| `GET` | `/prescriptions/:id` | Ver receta |
| `PATCH` | `/prescriptions/:id/consume` | Consumir receta (PATIENT) |
| `GET` | `/prescriptions/:id/pdf` | Descargar PDF |
| `GET` | `/admin/metrics` | Métricas (ADMIN) |

---

## FAQ

**CORS no funciona**
Al menos una de `APP_ORIGIN` o `FRONTEND_URL` debe estar configurada en `.env`.

**Login falla**
`SEED_DEFAULT_PASSWORD` debe coincidir con el valor usado en `prisma db seed`.

**Resetear base de datos**
```bash
pnpm exec prisma migrate reset --force
```

**Redis es necesario?**
Solo para CI. En desarrollo local funciona sin Redis.

---

## Comandos Útiles

```bash
pnpm run start:dev      # Desarrollo con hot-reload
pnpm run build           # Build producción
pnpm run lint            # Lint
pnpm run typecheck       # TypeScript
pnpm test                # Tests unitarios
pnpm run test:e2e         # Tests E2E
pnpm exec prisma studio   # Explorador de BD (http://localhost:5555)
```

---

## Documentación Detallada

- [Guía de Desarrollo](docs/guia-desarrollo.md) — Setup, comandos, troubleshooting
- [Arquitectura](docs/arquitectura.md) — Modelo de datos, estructura de módulos
- [Contratos API](docs/contratos-api.md) — Endpoints, request/response examples
- [Seguridad](docs/seguridad.md) — JWT, RBAC, headers
- [Swagger](http://localhost:3000/docs) — Documentación interactiva

## License

GPL-3.0