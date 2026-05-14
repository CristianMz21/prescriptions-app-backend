# Guia de Desarrollo — Prescriptions App

## 1. Setup Local

### Requisitos

- Node.js 22.x
- PostgreSQL 15+ (puerto 5433)
- npm o pnpm

### Pasos

```bash
# 1. Clonar repo
git clone https://github.com/CristianMz21/prescriptions-app-backend.git
cd prescriptions-app-backend

# 2. Instalar dependencias
npm install

# 3. Crear .env
cp .env.example .env
# Editar .env con valores reales

# 4. Generar Prisma client
npx prisma generate

# 5. Crear DB y aplicar migraciones
npx prisma migrate dev

# 6. Seed database
npx prisma db seed

# 7. Iniciar en modo desarrollo
npm run start:dev
```

### Puerto

El backend corre en `http://localhost:3000`. Swagger en `http://localhost:3000/docs`.

---

## 2. Comandos Principales

```bash
# Desarrollo
npm run start:dev        # Iniciar con hot-reload
npm run build            # Build de produccion

# Calidad
npm run lint            # ESLint
npm run typecheck        # TypeScript type check
npm run format           # Prettier format

# Testing
npm test                # Unit tests
npm run test:cov        # Unit tests + coverage
npm run test:e2e         # E2E tests

# Prisma
npx prisma generate     # Generar client
npx prisma migrate dev  # Aplicar migraciones (dev)
npx prisma migrate deploy # Aplicar migraciones (prod)
npx prisma db seed      # Seed database
npx prisma db push      # Push schema sin migracion (dev only)
npx prisma studio       # UI para explorar DB

# Reset completo
npx prisma migrate reset --force
```

---

## 3. Credentials de Test

| Email | Role | Password |
|-------|------|----------|
| `admin@clinic.com` | ADMIN | `Password123!` |
| `doctor@clinic.com` | DOCTOR | `Password123!` |
| `patient@clinic.com` | PATIENT | `Password123!` |

---

## 4. Estructura de Archivos Clave

### src/main.ts

Entry point. Configura:
- Helmet (security headers)
- CORS (pinned a FRONTEND_URL)
- ValidationPipe global
- HttpExceptionFilter
- Swagger/OpenAPI

### src/config/env.validation.ts

Valida todas las variables de entorno al iniciar. La app hace **fast-fail** si falta alguna.

### src/common/filters/http-exception.filter.ts

Formateo consistente de errores JSON:

```json
{
  "statusCode": 400,
  "message": "Mensaje legible",
  "error": "Bad Request"
}
```

---

## 5. Testing

### Unit Tests

```bash
# Correr todos
npm test

# Un archivo especifico
npx jest src/prescriptions/prescriptions.service.spec.ts

# Coverage
npm run test:cov
```

### E2E Tests

```bash
# Correr todos
npm run test:e2e

# Un archivo especifico
npm run test:e2e -- prescriptions.e2e-spec.ts
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
// ❌ INCORRECTO
const secret = process.env.JWT_ACCESS_SECRET;

// ✅ CORRECTO
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
npm run lint && npm run typecheck && npm test

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
npx prisma studio
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