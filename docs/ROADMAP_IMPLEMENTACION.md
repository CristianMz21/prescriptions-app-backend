# Roadmap de Implementación — Prescriptions App MVP

> **Timeline:** 12 días (estimado 2 semanas)
> **Equipo:** 1 desarrollador
> **Meta:** MVP fully funcional desplegado

---

## Visión General de Fases

```
Semana 1: Infraestructura → Datos → Auth
Semana 2: Lógica de Negocio → PDF → Métricas → Testing
```

| Fase | Nombre | Días | Entregable |
|------|--------|------|------------|
| **Fase 1** | Infraestructura | 1 | NestJS scaffold + Prisma + PostgreSQL |
| **Fase 2** | Modelado de Datos | 1 | Schema aplicado + datos seed |
| **Fase 3** | Capa de Auth | 2 | JWT + refresh + guards + decorators |
| **Fase 4** | Lógica de Negocio Core | 3 | Módulos Users, Patients, Doctors, Prescriptions |
| **Fase 5** | PDF y Métricas | 1 | Generación PDF + métricas admin |
| **Fase 6** | Testing | 2 | Tests unitarios + E2E |
| **Fase 7** | Deploy | 2 | Railway/Render + CI/CD |

---

## Fase 1 — Infraestructura (Día 1)

### Metas
- Proyecto NestJS scaffold y ejecutándose
- Prisma configurado con PostgreSQL
- Estructura de módulos en su lugar

### Tareas

- [ ] NestJS scaffold via `nest new backend --skip-git --package-manager npm`
- [ ] Verificar que `npm run start` funciona en puerto 3000
- [ ] Instalar dependencias: `npm install prisma @prisma/client @prisma/adapter-pg pg`
- [ ] Ejecutar `npx prisma init` → generar `prisma/schema.prisma`
- [ ] Configurar `.env` con `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
- [ ] Agregar `moduleFormat = "cjs"` al generator en `schema.prisma`
- [ ] Ejecutar `npx prisma generate` → verificar output `generated/prisma/`
- [ ] Crear `src/prisma/prisma.module.ts` y `prisma.service.ts`
- [ ] Registrar `PrismaModule` como `@Global()` en `AppModule`
- [ ] Verificar que `npm run build` pasa

### Criterios de Salida
- `npm run build` pasa sin errores
- Prisma client generado en `generated/prisma/`
- App inicia en puerto 3000

---

## Fase 2 — Modelado de Datos (Día 2)

### Metas
- Schema Prisma completo creado y aplicado
- Base de datos migrada
- Script seed populando datos de prueba

### Tareas

- [ ] Escribir `schema.prisma` completo con todos los modelos:
  - `User`, `Doctor`, `Patient`, `Prescription`, `PrescriptionItem`, `RefreshToken`
  - Enums: `Role`, `PrescriptionStatus`
  - Todos los índices según `ARQUITECTURA.md`
- [ ] Ejecutar `npx prisma migrate dev --name init` (requiere PostgreSQL corriendo)
  - **Alternativa si no hay DB:** `npx prisma migrate dev --name init --skip-generate` luego aplicar manualmente
- [ ] Crear `prisma/seed.ts`:
  - 1 Admin (`admin@test.com` / `Admin123*`)
  - 1 Doctor (`doctor@test.com` / `Doctor123*`, especialidad: Cardiología)
  - 1 Patient (`patient@test.com` / `Patient123*`)
  - 2 prescripciones de ejemplo (1 pending, 1 consumed)
- [ ] Agregar script `prisma:seed` a `package.json`
- [ ] Ejecutar `npm run prisma:seed` — verificar datos creados

### Criterios de Salida
- `npx prisma migrate` aplica exitosamente
- `seed.ts` corre sin errores
- DB contiene 3 usuarios + 2 prescripciones

---

## Fase 3 — Capa de Auth (Días 3-4)

### Metas
- Autenticación JWT completa funcionando
- Refresh token rotation implementado
- Guards y decorators funcionales

### Tareas

#### Día 3 — Auth Core

- [ ] Instalar: `npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt`
- [ ] Instalar dev: `npm install -D @types/passport-jwt @types/bcrypt`
- [ ] Instalar: `npm install class-validator class-transformer`
- [ ] Crear `src/auth/dto/login.dto.ts` y `refresh-token.dto.ts`
- [ ] Crear `src/auth/strategies/jwt.strategy.ts`
- [ ] Crear `src/auth/strategies/refresh-token.strategy.ts`
- [ ] Crear `src/auth/guards/jwt-auth.guard.ts`
- [ ] Crear `src/auth/guards/roles.guard.ts`
- [ ] Crear `src/auth/decorators/roles.decorator.ts`
- [ ] Crear `src/auth/decorators/current-user.decorator.ts`

#### Día 4 — Auth Service + Controller

- [ ] Crear `src/auth/auth.service.ts`:
  - `login()` → bcrypt compare + JWT sign + refresh token hash almacenado en DB
  - `refresh()` → validar DB refresh token + rotar + revocar viejo
  - `logout()` → revocar refresh token en DB
  - `getMe()` → retornar perfil de usuario actual
- [ ] Crear `src/auth/auth.controller.ts` con los 4 endpoints
- [ ] Crear `src/auth/auth.module.ts` conectando todo
- [ ] Actualizar `AppModule` para importar `AuthModule`
- [ ] Verificar que `npm run build` pasa
- [ ] Testear flujo: Login → recibir tokens → llamar `/auth/me` con JWT → Refresh → Logout

### Criterios de Salida
- `POST /auth/login` retorna `{accessToken, refreshToken, user}`
- `POST /auth/refresh` rota tokens sin re-login
- `POST /auth/logout` invalida refresh token
- `GET /auth/me` retorna info del usuario actual
- Guards retornan 401 por token faltante, 403 por rol incorrecto

---

## Fase 4 — Lógica de Negocio Core (Días 5-7)

### Metas
- Módulo Users para creación de usuarios admin
- Módulo Patients para listado/detalle
- Módulo Doctors para listado/detalle
- Módulo Prescriptions con CRUD completo + filtros

### Tareas

#### Día 5 — Users + Patients + Doctors

- [ ] **UsersModule:**
  - Crear `src/users/dto/create-user.dto.ts`
  - Crear `src/users/users.service.ts` — `create()` con bcrypt + creación de perfil
  - Crear `src/users/users.controller.ts` — `POST /users` (solo admin)
  - Crear `src/users/users.module.ts`
  - Registrar en `AppModule`

- [ ] **PatientsModule:**
  - Crear `src/patients/patients.service.ts` — `findAll()`, `findOne()`
  - Crear `src/patients/patients.controller.ts` — `GET /patients`, `GET /patients/:id`
  - Crear `src/patients/patients.module.ts`
  - Registrar en `AppModule`

- [ ] **DoctorsModule:**
  - Crear `src/doctors/doctors.service.ts` — `findAll()`, `findOne()`
  - Crear `src/doctors/doctors.controller.ts` — `GET /doctors`, `GET /doctors/:id`
  - Crear `src/doctors/doctors.module.ts`
  - Registrar en `AppModule`

#### Día 6 — Prescriptions Service + Controller

- [ ] Crear `src/prescriptions/dto/create-prescription.dto.ts`
- [ ] Crear `src/prescriptions/dto/pagination.dto.ts`
- [ ] Crear `src/prescriptions/prescriptions.service.ts`:
  - `create()` — patientId o patientEmail, generación de código, creación de items
  - `findAll()` — filtro por rol, paginación, filtros por status/fecha
  - `findOne()` — check de ownership + prevención IDOR
  - `consume()` — check de status + actualización de consumedAt
- [ ] Crear `src/prescriptions/prescriptions.controller.ts` — los 5 endpoints
- [ ] Crear `src/prescriptions/prescriptions.module.ts`
- [ ] Registrar en `AppModule`

#### Día 7 — Integración PDF + Refinamiento de Paginación

- [ ] Instalar `npm install pdfkit` + `npm install -D @types/pdfkit`
- [ ] Agregar `generatePdf()` a `PrescriptionsService` (pdfkit)
- [ ] Implementar `GET /prescriptions/:id/pdf` retornando `StreamableFile`
- [ ] Setear headers `Content-Type: application/pdf` y `Content-Disposition` correctos
- [ ] Testear paginación: `GET /prescriptions?page=2&limit=5&status=pending`
- [ ] Verificar que el build pasa end-to-end

### Criterios de Salida
- Admin puede crear usuarios con perfiles doctor/patient
- Doctor puede listar patients pero patient no puede
- Doctor puede crear prescripción
- Patient puede listar solo sus prescripciones
- Patient puede marcar prescripción como consumida
- Paginación funciona con `?page=&limit=&status=&from=&to=&sort=&order=`
- Descarga PDF retorna PDF válido

---

## Fase 5 — Métricas (Día 8)

### Metas
- Endpoint de métricas admin retorna analytics agregados

### Tareas

- [ ] Crear `src/metrics/metrics.service.ts`:
  - `totalPatients`, `totalDoctors`, `totalPrescriptions`
  - `prescriptionsByStatus` (count groupBy status)
  - `prescriptionsByDay` (últimos 30 días, groupBy fecha)
- [ ] Crear `src/metrics/metrics.controller.ts` — `GET /metrics` (solo admin)
- [ ] Crear `src/metrics/metrics.module.ts`
- [ ] Registrar en `AppModule`
- [ ] Testear: Login como admin → `GET /metrics` → verificar todos los campos presentes
- [ ] Testear: Login como doctor → `GET /metrics` → esperar 403

### Criterios de Salida
- `GET /metrics` retorna todos los campos esperados
- Solo admin puede acceder
- Non-admin recibe 403

---

## Fase 6 — Testing (Días 9-10)

### Metas
- Tests unitarios para todos los servicios
- Tests E2E para flujos auth y RBAC

### Tareas

#### Día 9 — Tests Unitarios

- [ ] Instalar `npm install --save-dev jest-mock-extended`
- [ ] Crear `src/auth/auth.service.spec.ts` — test login, refresh, logout
- [ ] Crear `src/prescriptions/prescriptions.service.spec.ts` — test CRUD + consume
- [ ] Crear `src/users/users.service.spec.ts` — test create user
- [ ] Ejecutar `npm run test` — verificar que todos pasen

#### Día 10 — Tests E2E

- [ ] Crear `test/auth.e2e-spec.ts`:
  - Login con credenciales válidas → 200 + tokens
  - Login con contraseña incorrecta → 401
  - Refresh token → nuevo access token
  - Logout → token revocado
- [ ] Crear `test/prescriptions.e2e-spec.ts`:
  - Doctor crea prescripción → 201
  - Patient marca como consumida → 200
  - Patient A intenta consumir prescripción del Patient B → 403
  - Acceso no autorizado → 401
- [ ] Crear `test/rbac.e2e-spec.ts`:
  - Patient intenta crear prescripción → 403
  - Doctor intenta acceder a métricas → 403
  - Admin accede a métricas → 200
- [ ] Ejecutar `npm run test:e2e` — verificar que todos pasen

### Criterios de Salida
- Coverage de tests unitarios ≥ 70% para servicios
- Todos los tests E2E pasan
- RBAC correctamente enforced en tests

---

## Fase 7 — Deployment (Días 11-12)

### Metas
- Backend desplegado en Railway/Render
- PostgreSQL provisionado
- CI/CD configurado

### Tareas

#### Día 11 — Deploy Backend

- [ ] Push todo el código a GitHub (`git push origin main`)
- [ ] Crear proyecto en Railway → conectar al repo GitHub
- [ ] Agregar variables de entorno en dashboard de Railway:
  - `DATABASE_URL` → Connection string de PostgreSQL en Railway
  - `JWT_SECRET` → Secreto 256-bit aleatorio
  - `JWT_REFRESH_SECRET` → Secreto 256-bit aleatorio
  - `PORT` → `3000`
- [ ] Configurar build en Railway: `npm run build`
- [ ] Configurar start en Railway: `node dist/main.js`
- [ ] Provisionar PostgreSQL en Railway → obtener connection string
- [ ] Ejecutar `npx prisma migrate deploy` (o aplicar migraciones via Railway CLI)
- [ ] Ejecutar seed: `npm run prisma:seed` contra DB de producción
- [ ] Verificar que la app está live: `GET https://<app>.railway.app` → 200

#### Día 12 — CI/CD + Verificaciones Finales

- [ ] Agregar `Procfile` o config Railway para tipo de proceso correcto
- [ ] Agregar `.env.example` al repo (sin valores reales)
- [ ] Verificar todos los endpoints funcionan en producción:
  - Login → tokens
  - Crear prescripción como doctor
  - Descargar PDF
  - Acceder a métricas como admin
- [ ] Testear casos de error: token inválido → 401, rol incorrecto → 403
- [ ] Actualizar `README.md` con:
  - URL live
  - Referencia de variables de entorno
  - Link a documentación API
  - Credenciales seed
- [ ] Git tag: `v1.0.0` para release

### Criterios de Salida
- Backend live en URL de producción
- Todos los endpoints API funcionales
- Usuarios seed funcionan en producción
- README actualizado

---

## Registro de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| PostgreSQL no disponible para migración | Medio | Alto | Usar `prisma migrate dev --skip-generate`; aplicar SQL manualmente después |
| Errores en generación de PDF | Bajo | Medio | Testear output PDF manualmente; pdfkit es estable |
| Scripts pnpm bloqueados en CI | Alto | Medio | Usar npm en scripts CI; `.npmrc` con `ignore-scripts=false` |
| JWT secret débil en producción | Bajo | Alto | Usar `openssl rand -base64 32` para secretos de producción |
| Rate limiting muy agresivo | Bajo | Bajo | Ajustar thresholds después de load testing |

---

## Checklist de Hitos

- [ ] `npm run build` pasa limpio
- [ ] `npm run start:dev` inicia en modo watch
- [ ] `npx prisma generate` completa sin errores
- [ ] `npx prisma migrate` aplica exitosamente
- [ ] `npm run prisma:seed` populates datos de prueba
- [ ] Login funciona y retorna JWT
- [ ] Los 4 roles (admin/doctor/patient) pueden hacer login
- [ ] RBAC enforced en todos los endpoints protegidos
- [ ] IDOR prevention testeado (patient no puede acceder a prescripciones de otros)
- [ ] Paginación funciona correctamente
- [ ] Descarga PDF retorna archivo PDF válido
- [ ] Endpoint de métricas retorna agregaciones correctas
- [ ] Tests unitarios ≥ 70% coverage
- [ ] Tests E2E pasan para auth + RBAC
- [ ] Backend desplegado en producción
- [ ] README actualizado con URL live
