# Despliegue — Prescriptions App

## 1. Configuracion de Variables de Entorno

### Variables Requeridas

```env
DATABASE_URL="postgresql://user:password@host:5433/prescriptions_db?schema=public"
JWT_ACCESS_SECRET="generar-con-openssl-rand-base64-32"
JWT_REFRESH_SECRET="generar-con-openssl-rand-base64-32"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="7d"
PORT=3000
FRONTEND_URL="https://tu-frontend.com"
NODE_ENV="production"
SEED_DEFAULT_PASSWORD="Password123!"
# Opcional: email via SMTP (descomentar si se necesita)
# SMTP_HOST="smtp.example.com"
# SMTP_PORT="587"
# SMTP_USER="user"
# SMTP_PASS="pass"
# SMTP_FROM="no-reply@tu-clinica.com"
```

### Generar Secrets

```bash
# Access secret
openssl rand -base64 32

# Refresh secret
openssl rand -base64 32
```

---

## 2. Deployment Local

```bash
# 1. Instalar dependencias
npm install

# 2. Generar Prisma client
npx prisma generate

# 3. Aplicar migraciones
npx prisma migrate deploy

# 4. Seed database (opcional)
npm run prisma:seed

# 5. Iniciar
npm run start:prod
# o en desarrollo
npm run start:dev
```

---

## 3. GitHub Actions CI/CD

El proyecto tiene un workflow principal de CI en `.github/workflows/` que corre en cada push a `main`:

### Jobs del Workflow CI

1. **Install + Format + Lint + Typecheck** — Valida code quality
2. **Unit Tests** — Coverage >= 80%
3. **E2E Tests** — Tests end-to-end contra DB real
4. **Dependency Audit** — `npm audit`
5. **Security: Gitleaks** — Detecta secretos en el codigo
6. **CodeQL** — Analisis estatico de seguridad

### Workflow de Wiki (MkDocs)

Archivo: `.github/workflows/docs.yml`

Se dispara en cada push a `main` cuando cambian `docs/**` o `mkdocs.yml`.

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - 'mkdocs.yml'
```

Pasos:
1. Checkout
2. Setup Python 3.12
3. Install mkdocs + material
4. Build sitio estatico (`mkdocs build`)
5. Upload artifact
6. Deploy a GitHub Pages

---

## 4. Desplegar a Railway (Ejemplo)

### 1. Conectar Repo GitHub

Ve a [railway.app](https://railway.app) → New Project → Connect GitHub repo.

### 2. Variables de Entorno

Agregar en Railway dashboard:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | Connection string de Railway PostgreSQL |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 32` |
| `JWT_ACCESS_TTL` | `15m` |
| `JWT_REFRESH_TTL` | `7d` |
| `PORT` | `3000` |
| `FRONTEND_URL` | URL de tu frontend desplegado |
| `NODE_ENV` | `production` |

### 3. Configurar Build

- **Build Command:** `npm run build`
- **Start Command:** `node dist/main.js`

### 4. Provisionar PostgreSQL

Railway puede crear un PostgreSQL automaticamente. Obtener `DATABASE_URL` del dashboard.

### 5. Migraciones

Agregar un paso de post-deploy:

```bash
npx prisma migrate deploy
```

---

## 5. Desplegar a Render

### 1. Conectar Repo

Ve a [render.com](https://render.com) → New → Web Service → Connect GitHub repo.

### 2. Configuracion

| Campo | Valor |
|-------|-------|
| Build Command | `npm run build` |
| Start Command | `node dist/main.js` |
| Environment | `Node` |

### 3. Variables de Entorno

Same que Railway (ver seccion 4.1).

### 4. PostgreSQL

Render ofrece PostgreSQL como managed database. Crear desde el dashboard y obtener `DATABASE_URL`.

---

## 6. Verificacion Post-Deploy

```bash
# Health check
curl https://tu-backend.com/auth/profile

# Expected: 401 (sin auth) o 200 (con cookie)
```

---

## 7. Wiki en GitHub Pages

La wiki se despliega automaticamente via `.github/workflows/docs.yml`.

URL: **https://CristianMz21.github.io/prescriptions-app-backend/**

Para actualizar contenido:
1. Editar archivos en `docs/`
2. Push a `main`
3. GitHub Actions construye y despliega automaticamente