# Guia de Desarrollo — Prescriptions App

## 1. Setup Local

### Requisitos

- Node.js 22.x or 24.x
- PostgreSQL 15+ (puerto 5433)
- Redis 7 (puerto 6379) — requerido para CI; opcional para desarrollo local
- pnpm

### Pasos

```bash
# 1. Clonar repo
git clone https://github.com/CristianMz21/prescriptions-app-backend.git
cd prescriptions-app-backend

# 2. Instalar dependencias
pnpm install

# 3. Crear .env
cp .env.example .env
# Editar .env con valores reales

# 4. Generar Prisma client
pnpm exec prisma generate

# 5. Crear DB y aplicar migraciones
pnpm exec prisma migrate dev

# 6. Seed database
SEED_DEFAULT_PASSWORD="Password123!" pnpm exec prisma db seed

# 7. Iniciar en modo desarrollo
pnpm run start:dev
```

### Puerto

El backend corre en `http://localhost:3000`. Swagger en `http://localhost:3000/docs`.

---

## 2. Comandos Principales

```bash
# Desarrollo
pnpm run start:dev        # Iniciar con hot-reload
pnpm run build            # Build de produccion

# Calidad
pnpm run lint             # ESLint
pnpm run typecheck        # TypeScript type check
pnpm run format           # Prettier format

# Testing
pnpm test                 # Unit tests
pnpm run test:cov         # Unit tests + coverage
pnpm run test:e2e          # E2E tests

# Prisma
pnpm exec prisma generate # Generar client
pnpm exec prisma migrate dev  # Aplicar migraciones (dev)
pnpm exec prisma migrate deploy # Aplicar migraciones (prod)
pnpm exec prisma db seed   # Seed database
pnpm exec prisma db push   # Push schema sin migracion (dev only)
pnpm exec prisma studio    # UI para explorar DB

# Reset completo
pnpm exec prisma migrate reset --force
```

---

## 3. Credentials de Test

| Email | Role | Password |
|-------|------|----------|
| `admin@clinic.com` | ADMIN | controlled by `SEED_DEFAULT_PASSWORD` env var |
| `doctor@clinic.com` | DOCTOR | controlled by `SEED_DEFAULT_PASSWORD` env var |
| `doctor2@clinic.com` | DOCTOR | controlled by `SEED_DEFAULT_PASSWORD` env var |
| `patient@clinic.com` | PATIENT | controlled by `SEED_DEFAULT_PASSWORD` env var |

---

## 4. Estructura de Archivos Clave

### src/main.ts

Entry point. Configura:
- Helmet (security headers)
- CORS (pinned a FRONTEND_URL)
- ValidationPipe global
- HttpExceptionFilter
- Swagger/OpenAPI
- `app.enableShutdownHooks()` para graceful shutdown

### src/config/env.validation.ts

Valida todas las variables de entorno al iniciar. La app hace **fast-fail** si falta alguna (excepto SMTP que es opcional).

### src/common/filters/http-exception.filter.ts

Formateo consistente de errores JSON:

```json
{
  "statusCode": 400,
  "message": "Mensaje legible",
  "error": "Bad Request"
}
```

### src/email/email.service.ts

Servicio de email via nodemailer. Si `SMTP_HOST` no está configurado, todas las operaciones son no-op (logdebug en vez de enviar). No lanza errores — solo loguea.

### src/prisma/prisma.service.ts

Extiende `PrismaClient`. Singleton inyectado globalmente. Solo una instancia — no crear más.

---

## 5. Testing

### Unit Tests

```bash
# Correr todos
pnpm test

# Un archivo especifico
pnpm exec jest src/prescriptions/prescriptions.service.spec.ts

# Coverage
pnpm run test:cov
```

### E2E Tests

```bash
# Correr todos
pnpm run test:e2e

# Un archivo especifico
pnpm run test:e2e -- prescriptions.e2e-spec.ts
```

### Patron de Auth en E2E

```typescript
// 1. Login para obtener cookie
const loginRes = await request(app.getHttpServer())
  .post('/auth/login')
  .send({ email: 'doctor@clinic.com', password: 'Password123!' });

const cookie = loginRes.headers['set-cookie'];

// 2. Usar cookie en requests subsecuentes
await request(app.getHttpServer())
  .get('/prescriptions')
  .set('Cookie', cookie);
```

---

## 6. Reglas de Desarrollo

### No usar process.env fuera de ConfigModule

```typescript
// NO INCORRECTO
const secret = process.env.JWT_ACCESS_SECRET;

// OK CORRECTO
const secret = this.configService.get('JWT_ACCESS_SECRET');
```

### No usar synchronize: true

Nunca cambiar `synchronize: true` en Prisma. Usar migraciones:

```bash
npx prisma migrate dev --name add_new_field
```

### No usar $queryRawUnsafe

Evitar SQL crudo. Usar Prisma queries parametrizadas.

### No suprimir errores de TypeScript

No usar `# noqa`, `# type: ignore`, `@ts-ignore`. Arreglar errores en su lugar.

---

## 7. Workflow de Desarrollo

```bash
# 1. Crear feature branch
git checkout -b feat/nueva-feature

# 2. Desarrollar + tests
pnpm run lint && pnpm run typecheck && pnpm test

# 3. Commit
git add .
git commit -m "feat: descripcion de la feature"

# 4. Push
git push origin feat/nueva-feature

# 5. Crear PR en GitHub
# 6. Merge a main → CI corre automaticamente
```

---

## 8. Debugging

### Logs

```bash
# Ver logs del servidor
npm run start:dev 2>&1 | tee logs.txt

# Ver logs de Prisma queries
DATABASE_URL="..." npx prisma migrate dev --debug
```

### Prisma Studio

```bash
pnpm exec prisma studio
```

Abre UI en `http://localhost:5555` para explorar datos.

---

## 9. Docker (Opcional)

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["node", "dist/main.js"]
```