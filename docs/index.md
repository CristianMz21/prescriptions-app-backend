# Prescriptions App — Wiki

Sistema de gestión de prescripciones médicas. Backend API construida con **NestJS + TypeScript + Prisma 6 + PostgreSQL**.

## quick-navigation

- [Arquitectura](arquitectura.md) — Vista general del sistema, modelo de datos, estructura de carpetas
- [Architecture Roadmap](ARCHITECTURE_ROADMAP.md) — Diseño arquitectónico completo y roadmap
- [Módulos](modulos.md) — Detalle de cada módulo: Auth, Users, Prescriptions, Admin, PDF
- [Contratos API](contratos-api.md) — Endpoints, request/response examples
- [Seguridad](seguridad.md) — JWT cookies, RBAC, headers HTTP, OWASP
- [Despliegue](despliegue.md) — Deploy, variables de entorno, GitHub Actions
- [Guía de Desarrollo](guia-desarrollo.md) — Setup local, comandos, testing
- [Roadmap](roadmap.md) — Estado actual del proyecto, features implementados

## Stack Tecnológico

| Componente | Tecnología |
|-----------|------------|
| Framework | NestJS + TypeScript |
| ORM | Prisma 6 |
| Base de datos | PostgreSQL |
| Auth | JWT access (15m) + refresh (7d) en HttpOnly cookies |
| Authorization | RBAC — ADMIN, DOCTOR, PATIENT |
| Docs API | Swagger/OpenAPI en `/docs` |
| PDF | Puppeteer + Handlebars |

## Links Rápidos

- **API en vivo**: `http://localhost:3000/docs` (Swagger)
- **Repositorio**: [GitHub](https://github.com/CristianMz21/prescriptions-app-backend)
- **Wiki**: [GitHub Pages](https://CristianMz21.github.io/prescriptions-app-backend/)

## Credenciales Seed

| Email | Role | Password |
|-------|------|----------|
| `admin@clinic.com` | ADMIN | `Password123!` (example; real password via `SEED_DEFAULT_PASSWORD` env var) |
| `doctor@clinic.com` | DOCTOR | `Password123!` |
| `doctor2@clinic.com` | DOCTOR | `Password123!` |
| `patient@clinic.com` | PATIENT | `Password123!` |

## Estado del Proyecto

| Módulo | Estado |
|--------|--------|
| Auth (login/refresh/logout) |  Implementado |
| Users (CRUD + listados) |  Implementado |
| Prescriptions (CRUD + consume + PDF) |  Implementado |
| Admin (métricas + listado total) |  Implementado |
| Wiki + GitHub Pages |  Implementado |
| E2E Tests |  Implementado |