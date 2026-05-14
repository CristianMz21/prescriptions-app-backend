# Seguridad — Prescriptions App

## 1. Autenticacion y Gestion de Tokens

### 1.1 Arquitectura de Tokens

| Token | Vida util | Almacenamiento | Transporte |
|-------|-----------|----------------|------------|
| Access Token (JWT) | 15 minutos | HttpOnly cookie | Automatico por navegador |
| Refresh Token | 7 dias | HttpOnly cookie | Automatico por navegador |

**No existe Bearer header ni refresh token en body.**

### 1.2 Almacenamiento de Contrasenas

- **Algoritmo:** bcrypt con factor de costo 10
- Las passwords seed usan bcrypt

### 1.3 Estructura del JWT

```json
{
  "sub": "user-id-uuid",
  "email": "doctor@clinic.com",
  "role": "DOCTOR",
  "iat": 1718275200,
  "exp": 1718276100
}
```

El JWT contiene **3 claims**: `sub` (user ID), `email`, `role`. No incluye `name` porque User no tiene ese campo.

### 1.4 Variables de Entorno Relacionadas

- `JWT_ACCESS_SECRET` — Secreto para access tokens
- `JWT_REFRESH_SECRET` — Secreto para refresh tokens
- `JWT_ACCESS_TTL` — `"15m"`
- `JWT_REFRESH_TTL` — `"7d"`
- `SMTP_HOST` — Servidor SMTP (opcional; si no está, email disabled)
- `SMTP_PORT` — Puerto SMTP (default 587)
- `SMTP_USER` / `SMTP_PASS` — Credenciales SMTP (opcional)
- `SMTP_FROM` — Dirección From (default `no-reply@clinic.local`)

---

## 2. Autorizacion (RBAC)

### 2.1 Matriz de Permisos

| Accion | ADMIN | DOCTOR | PATIENT |
|--------|:-----:|:------:|:-------:|
| Login | OK | OK | OK |
| Ver propio perfil | OK | OK | OK |
| Crear usuario | OK | NO | NO |
| Listar usuarios | OK | NO | NO |
| Listar pacientes | OK | OK | NO |
| Listar doctores | OK | NO | NO |
| Ver detalle usuario | OK | OK | NO |
| Crear prescripcion | NO | OK | NO |
| Listar propias | OK | las que autoro | las que recibio |
| Detalle prescripcion | OK | si es autor | si es dueno |
| Marcar consumida | NO | NO | OK owner |
| Descargar PDF | OK | si autor | si dueno |
| Listar todas prescripciones | OK | NO | NO |
| Ver metricas | OK | NO | NO |

### 2.2 Cadena de Guards

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
```

- `JwtAuthGuard` extrae token de cookie y valida JWT
- `RolesGuard` verifica si `user.role` esta en los roles requeridos

### 2.3 Prevencion de IDOR (applyTenantBoundary)

El ownership check vive en la **capa de servicio**, implementado via `applyTenantBoundary`:

```typescript
private applyTenantBoundary(where: Prisma.PrescriptionWhereInput, user: JwtPayload) {
  if (user.role === Role.PATIENT) {
    where.patient = { userId: user.id };   // Solo el paciente puede consumir sus propias
  } else if (user.role === Role.DOCTOR) {
    where.author = { userId: user.id };      // Solo el doctor puede ver las que autoro
  }
  // ADMIN: sin filtro — ve todo
}
```

---

## 3. Validacion de Entrada

### 3.1 ValidationPipe Global

```typescript
new ValidationPipe({
  whitelist: true,              // Elimina propriedades fuera del DTO
  forbidNonWhitelisted: true,    // Rechaza requests con campos desconocidos
  transform: true,              // Transforma objetos planos a instancias DTO
})
```

### 3.2 Prevencion de Inyeccion SQL

Todas las queries usan Prisma (parametrizadas automaticamente).

```typescript
// CORRECTO
await this.prisma.user.findUnique({ where: { email: dto.email } });

// PROHIBIDO
await this.prisma.$queryRawUnsafe(`SELECT * FROM user WHERE email = '${dto.email}'`);
```

---

## 4. Headers de Seguridad HTTP

| Header | Valor | Proteccion |
|--------|-------|------------|
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `Cache-Control` | `no-store` | No cache de respuestas |
| `Strict-Transport-Security` | `max-age=31536000` | Forzar HTTPS |

Implementados via Helmet + custom middleware en `src/main.ts`.

---

## 5. Modelo de Amenazas

| Amenaza | Vector | Mitigacion |
|---------|--------|------------|
| **Replay de Token** | Cookies robadas | 15m TTL corto + refresh rotation |
| **IDOR** | Paciente cambia URL | applyTenantBoundary en service layer |
| **Escalacion de Privilegios** | Doctor accede a metricas admin | RolesGuard verifica rol |
| **Mass Assignment** | Payload con `role: 'ADMIN'` | ValidationPipe whitelist |
| **Inyeccion SQL** | Parametros maliciosos | Solo consultas parametrizadas Prisma |
| **XSS en PDF** | Script en nombre de item | Handlebars escapa por defecto |
| **Fuerza Bruta** | Password guessing | bcrypt cost=10 + errores genericos |

---

## 6. Checklist OWASP Top 10

| Categoria | Estado | Implementacion |
|-----------|--------|----------------|
| A01 Broken Access Control | OK | RolesGuard + applyTenantBoundary |
| A02 Cryptographic Failures | OK | bcrypt, secretos JWT firmados |
| A03 Injection | OK | Prisma parametrizadas + ValidationPipe |
| A04 Insecure Design | OK | Matriz RBAC + ownership checks |
| A05 Security Misconfiguration | OK | Headers OK + CORS configurado |
| A06 Vulnerable Components | OK | npm audit en CI |
| A07 Auth Failures | OK | JWT corta vida + cookie HttpOnly |
| A08 Data Integrity | OK | Prisma transacciones + audit log |
| A09 Logging Failures | OK | Interceptor existe, logs disponibles |
| A10 SSRF | N/A | No hay file upload |
| **Email Injection** | OK | nodemailer sendMail — parámetros no controlados por usuario |