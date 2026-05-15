# Prescription Management API

API de gestión de prescripciones médicas. Encargate de la autenticación, recetas y métricas de una clínica.

## Quick Start

```bash
# 1. Clonar y entrar
git clone https://github.com/CristianMz21/prescriptions-app-backend.git
cd prescriptions-app-backend

# 2. Instalar
pnpm install

# 3. Configurar .env
cp .env.example .env
# Editar DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, SEED_DEFAULT_PASSWORD

# 4. Levantar
pnpm exec prisma generate
pnpm exec prisma migrate dev
pnpm exec prisma db seed
pnpm run start:dev
```

Listo en `http://localhost:3000`. Documentación interactiva en `http://localhost:3000/docs`.

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