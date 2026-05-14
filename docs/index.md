# Prescriptions App Wiki

Backend API para el sistema de gestión de prescripciones médicas. Built with **NestJS + TypeScript + Prisma 6 + PostgreSQL**.

## Stack

- **Framework**: NestJS + TypeScript
- **ORM**: Prisma 6
- **Database**: PostgreSQL (puerto 5433)
- **Auth**: JWT access token (15m) + refresh token (7d) en **HttpOnly cookies**
- **Authorization**: RBAC con tres roles — `ADMIN`, `DOCTOR`, `PATIENT`
- **Documentation**: Swagger/OpenAPI en `/docs`

## Documentación

- [Arquitectura](arquitectura.md) — Visión general, modelo de datos, estructura de carpetas
- [Contratos API](contratos-api.md) — Endpoints, request/response examples
- [Seguridad](seguridad.md) — Modelo de seguridad, RBAC, headers

## Empezando

```bash
# Instalar dependencias
npm install

# Generar Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed

# Start dev server
npm run start:dev
```

## Credenciales de Test

| Email | Role | Password |
|-------|------|----------|
| `admin@clinic.com` | ADMIN | `Password123!` |
| `doctor@clinic.com` | DOCTOR | `Password123!` |
| `patient@clinic.com` | PATIENT | `Password123!` |

## Links

- **API Docs**: `http://localhost:3000/docs`
- **Repo**: [GitHub](https://github.com/CristianMz21/prescriptions-app-backend)