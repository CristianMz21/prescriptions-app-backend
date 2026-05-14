# Deploying to Render

## What you create

| Resource | Render type | Why |
|---|---|---|
| `prescriptions-api` | **Web Service** (Docker) | NestJS HTTP API; needs a public URL the frontend can call |
| `prescriptions-db` | **PostgreSQL** | Replaces the local Postgres on `:5433` |

> **Important**: do NOT pick "Private Service" — the frontend (Next.js on Vercel/Render Static) needs to reach the API over HTTPS from the browser. Private Services are unreachable from outside Render.

## One-click deploy via Blueprint

This repo ships `render.yaml` so Render can provision everything at once:

1. Push the latest backend code to `main` on GitHub (already done if CI is green).
2. In Render: **Dashboard → New → Blueprint**.
3. Connect this repo (`CristianMz21/prescriptions-app-backend`).
4. Render detects `render.yaml` and shows a preview with:
   - 1 PostgreSQL `prescriptions-db` (free, version 16)
   - 1 Web Service `prescriptions-api` (Docker build, Starter plan)
5. Click **Apply**. First deploy takes ~5–10 minutes (Docker build + Puppeteer Chromium fetch + migrations).

## Manual env vars (after Blueprint applies)

Render auto-generates `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and wires `DATABASE_URL` from the Postgres resource. You must fill these by hand in the service's **Environment** tab:

| Var | Where it goes | Example |
|---|---|---|
| `SEED_DEFAULT_PASSWORD` | required for first-time seed | a strong random password |
| `FRONTEND_URL` | once the frontend is deployed | `https://your-frontend.vercel.app` |
| `APP_ORIGIN` | same as FRONTEND_URL (used for CORS) | `https://your-frontend.vercel.app` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | optional email notifications | leave unset to skip emails |

## First-time database seeding

`start.sh` runs `npx prisma migrate deploy` on every boot, so the schema is always up to date. But the **seed** (`prisma/seed.ts`) is not run automatically. Once after the first successful deploy:

1. Open the service in Render → **Shell** tab.
2. Run:
   ```bash
   SEED_DEFAULT_PASSWORD="$SEED_DEFAULT_PASSWORD" npx prisma db seed
   ```
3. You should see `🎉 Seeding finished successfully.` Seed is idempotent — re-running it is safe.

## Plan sizing (why Starter, not Free)

| Plan | RAM | Puppeteer (PDF) | Recommendation |
|---|---|---|---|
| Free | 512 MB, sleeps after 15 min | OOM crashes on concurrent PDF requests | ❌ |
| **Starter ($7/mo)** | **512 MB, no sleep** | works for low traffic | ✅ default in `render.yaml` |
| Standard ($25/mo) | 2 GB | comfortable | upgrade if PDF generation gets heavier |

PostgreSQL Free tier (1 GB) is fine for development; upgrade if data grows past ~500 MB.

## Frontend wiring

Once the API is live at `https://prescriptions-api.onrender.com`:

1. In the **frontend** project (`frontend/prescriptions-app`), set the env var:
   ```bash
   NEXT_PUBLIC_API_URL=https://prescriptions-api.onrender.com
   ```
2. Re-deploy the frontend.
3. Update the backend's `FRONTEND_URL` and `APP_ORIGIN` to the deployed frontend origin so CORS allows the SPA.

## Health check

Render polls `/` (configured via `healthCheckPath` in `render.yaml`). The `AppController` returns `"Hello World!"` on `GET /`, which is enough to keep the service marked healthy. If you ever rename or guard that endpoint, update `render.yaml`.

## Cold start + sleep behavior

- **Starter plan**: never sleeps; first request after deploy waits ~10s for app boot.
- **Free plan** (if downgraded): sleeps after 15 min of no traffic; cold-start adds ~30-60s on the first hit.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Prisma migrate deploy` fails on boot | The `DATABASE_URL` is wrong; verify the Postgres resource is linked. |
| `500 Internal Server Error` on every request | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` missing — Render's `generateValue: true` should have set them; check the Environment tab. |
| PDF endpoint returns 500 | Puppeteer can't launch Chromium. The Dockerfile installs `chromium` + libs for Alpine; if the image was built before that change, force a redeploy. |
| CORS errors from the frontend | `FRONTEND_URL` and `APP_ORIGIN` not set to the frontend's deployed origin (must include scheme, e.g., `https://`). |
| `Failed to send prescription email` | SMTP env vars missing — by design, the API logs a warning and continues. Set `SMTP_HOST` to enable. |
| Service won't boot, "Out of memory" in logs | Upgrade to Standard plan (2 GB RAM) for Puppeteer headroom. |

## Manual UI alternative (no Blueprint)

If you prefer the wizard over `render.yaml`:

1. **New → PostgreSQL**:
   - Name: `prescriptions-db`
   - User: `prescriptions`
   - Database: `prescriptions`
   - Plan: Free
   - PostgreSQL version: 16
2. **New → Web Service** (NOT Private Service):
   - Connect the backend repo
   - Runtime: **Docker**
   - Branch: `main`
   - Dockerfile path: `./Dockerfile`
   - Plan: Starter
   - Health Check Path: `/`
   - Environment Variables (in the wizard):
     - `NODE_ENV` = `production`
     - `PORT` = `3000`
     - `DATABASE_URL` → click "Add from Database" → pick `prescriptions-db` → `Internal Database URL`
     - `JWT_ACCESS_SECRET` → click "Generate"
     - `JWT_REFRESH_SECRET` → click "Generate"
     - `JWT_ACCESS_TTL` = `15m`
     - `JWT_REFRESH_TTL` = `7d`
     - `SEED_DEFAULT_PASSWORD` = (strong password)
     - `FRONTEND_URL` = (frontend URL, fill in after frontend is deployed)
     - `APP_ORIGIN` = same as FRONTEND_URL
   - Click **Create Web Service**.
3. After first deploy succeeds: Shell tab → `npx prisma db seed` (once).
