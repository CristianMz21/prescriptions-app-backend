# Security Model — Prescriptions App MVP

> **Scope:** Backend NestJS + Prisma + PostgreSQL
> **OWASP Top 10 coverage for this application**

---

## 1. Authentication & Session Management

### 1.1 Token Architecture

| Token | Lifetime | Storage | Transport |
|-------|----------|---------|-----------|
| Access Token (JWT) | 15 minutes | Client memory | `Authorization: Bearer` header |
| Refresh Token | 7 days | PostgreSQL (hashed with SHA-256) | Request body only |

**Why this approach:**
- Access token in memory = XSS cannot steal it (cannot access `localStorage`/`sessionStorage` via JS in modern CSP)
- Refresh token hashed in DB = even if DB is leaked, tokens are not usable
- DB revocation = instant logout capability

### 1.2 Password Storage

```
plaintext password → bcrypt.compare() → valid/invalid
```

- **Algorithm:** bcrypt with cost factor **10**
- **Salt:** automatic per password
- **Seed scripts** use bcrypt, NOT SHA (seed passwords are test data, not production)

### 1.3 JWT Structure

```json
{
  "sub": "user-id-cuid",
  "email": "doctor@test.com",
  "role": "doctor",
  "iat": 1718275200,
  "exp": 1718276100  // +15 minutes
}
```

**Secrets stored in environment variables:**
- `JWT_SECRET` — signing secret for access tokens
- `JWT_REFRESH_SECRET` — signing secret for refresh tokens

---

## 2. Authorization (RBAC)

### 2.1 Role Hierarchy

```
admin > doctor > patient
```

Roles are **not** cumulative. Each role has explicit permissions.

### 2.2 Guard Chain

Every protected route uses:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor')
```

`JwtAuthGuard` runs first → validates JWT → extracts user.
`RolesGuard` runs second → checks if user.role ∈ required roles.

### 2.3 IDOR Prevention (Critical)

**Problem:** A patient could access another patient's prescriptions by changing the URL ID.

**Mitigation in service layer:**

```typescript
// In findOne() and generatePdf():
const isOwner = userRole === 'admin'
  || (userRole === 'doctor' && prescription.authorId === doctorProfileId)
  || (userRole === 'patient' && prescription.patientId === patientProfileId);

if (!isOwner) {
  throw new ForbiddenException('No tenés acceso a esta prescripción');
}
```

**For consume() endpoint:**
```typescript
if (prescription.patientId !== patientProfileId) {
  throw new ForbiddenException('Solo el paciente puede marcar como consumida');
}
```

---

## 3. Input Validation

### 3.1 Global ValidationPipe

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,         // Strip properties not in DTO
    forbidNonWhitelisted: true, // Reject requests with unknown fields
    transform: true,          // Transform plain objects to DTO instances
  }),
);
```

### 3.2 DTO Examples

```typescript
// CreatePrescriptionDto — validates every field
export class CreatePrescriptionDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsEmail()
  patientEmail?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items: CreatePrescriptionItemDto[];  // min 1 item
}
```

### 3.3 SQL Injection Prevention

Prisma uses **parameterized queries exclusively**:

```typescript
// ✅ SAFE — Prisma auto-parameterizes
await this.prisma.user.findUnique({ where: { email: dto.email } });

// ❌ FORBIDDEN — Never use $queryRawUnsafe
await this.prisma.$queryRawUnsafe(`SELECT * FROM user WHERE email = '${dto.email}'`);
```

**Policy:** `$queryRawUnsafe` and `$executeRawUnsafe` are banned from the codebase.

---

## 4. Rate Limiting

### 4.1 Strategy

- **Global:** 100 requests/minute per IP
- **Auth routes:** 5 requests/minute per IP (stricter for `/auth/login`)

### 4.2 Implementation

```typescript
// main.ts
app.use(
  ThrottlerModule.forRoot([{
    ttl: 60000,
    limit: 100,
  }]),
);

// For auth routes (via decorator or guard)
@UseGuards(ThrottlerGuard, JwtAuthGuard)
@Controller('auth')
```

### 4.3 Brute Force Mitigation

The `/auth/login` endpoint:
1. Always returns 401 for both "user not found" and "wrong password" (no timing leak)
2. Rate limited to 5 attempts/minute per IP

---

## 5. HTTP Security Headers

| Header | Value | Protection |
|--------|-------|------------|
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS (Chrome) |
| `Strict-Transport-Security` | `max-age=31536000` | Force HTTPS |
| `Content-Security-Policy` | `default-src 'none'` | CSP strict |

Implementation via `@nestjs/common` or Helmet middleware in `main.ts`.

---

## 6. Threat Model (STRIDE-lite)

| Threat | Attack Vector | Impact | Mitigation |
|--------|--------------|---------|------------|
| **Credential Theft** | Phishing, keylogger | Full account takeover | 2FA not in MVP scope; HTTP-only cookie consideration for future |
| **Token Replay** | Stolen refresh token | Impersonation | Token hash in DB + revocation + 7d expiry |
| **IDOR** | Patient changes URL to see another patient's data | Privacy breach | Ownership check in service layer |
| **Privilege Escalation** | Doctor tries to access admin metrics | Data leak | RolesGuard checks role before endpoint |
| **Mass Assignment** | Attacker adds `role: 'admin'` to payload | Privilege escalation | ValidationPipe `whitelist:true` strips unknown fields |
| **SQL Injection** | Malformed SQL in parameters | Data exfiltration | Prisma parameterized queries only |
| **Brute Force Login** | Automated password guessing | Account compromise | bcrypt cost=10 + rate limit on /auth/login |
| **Sensitive Data Exposure** | API returns password hash in response | Credential theft | DTOs never include `password` field |
| **Refresh Token Theft** | XSS reads body with refresh token | Long-term session hijack | Refresh token in body (not cookie) reduces XSS risk |

---

## 7. Data Exposure Checklist

| Check | Status | Implementation |
|-------|--------|----------------|
| Passwords never in responses | ✅ | DTO excludes `password` |
| Refresh token hash in DB | ✅ | `sha256(token)` stored, never raw |
| JWT payload no sensitive data | ✅ | Only `sub`, `email`, `role` |
| Error messages generic on auth | ✅ | Same 401 msg for "bad email" or "bad password" |
| Rate limit on login | ✅ | 5 req/min per IP |
| ValidationPipe strip whitelist | ✅ | Unknown fields stripped |
| No stack traces in production | ✅ | Global exception filter sanitizes |
| ENV vars never in responses | ✅ | Only DATABASE_URL in .env |

---

## 8. CORS Configuration

```typescript
// main.ts — example CORS config
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,  // Allow cookies if needed in future
});
```

**Current MVP:** CORS open during development; restrict to specific origin(s) before deploy.

---

## 9. Security Testing

### 9.1 What to Test

| Test | Method |
|------|--------|
| SQL Injection | Try `' OR 1=1 --` in prescription `patientEmail` param |
| IDOR | Patient A tries to access Patient B's prescription by ID |
| Role Escalation | Try adding `"role": "admin"` to user creation payload |
| Auth Rate Limit | Rapid `/auth/login` calls with different creds |
| XSS in PDF | Inject `<script>` in prescription item name — verify it doesn't execute in PDF or API |

### 9.2 Tools

- **Static Analysis:** `npm audit`, `eslint security rules`
- **Dynamic Testing:** Manual via Postman/curl
- **Dependency:** `npm audit` (run in CI)

---

## 10. Secrets Management

| Secret | Where | Rotation |
|--------|-------|----------|
| `DATABASE_URL` | `.env` (local), CI env vars (deploy) | On DB credential change |
| `JWT_SECRET` | `.env` (local), CI env vars (deploy) | Anytime rotation needed |
| `JWT_REFRESH_SECRET` | `.env` (local), CI env vars (deploy) | Anytime rotation needed |

**Never commit real secrets** — `.env` is in `.gitignore`. Use `.env.example` template.

---

## 11. OWASP Top 10 Coverage

| OWASP Category | Covered? | Implementation |
|---------------|---------|----------------|
| A01 Broken Access Control | ✅ | RolesGuard + IDOR checks in services |
| A02 Cryptographic Failures | ✅ | bcrypt for passwords, JWT signed secrets |
| A03 Injection | ✅ | Prisma parameterized queries, ValidationPipe |
| A04 Insecure Design | ✅ | RBAC matrix, ownership checks |
| A05 Security Misconfiguration | ⚠️ | CSP/headers, CORS — need prod config |
| A06 Vulnerable Components | ⚠️ | `npm audit` — need CI automation |
| A07 Auth & Auth Failures | ✅ | JWT short-lived, refresh rotation, bcrypt |
| A08 Data Integrity | ⚠️ | Not enforced at DB level yet |
| A09 Logging Failures | ⏳ | Interceptor logging exists, needs log aggregation |
| A10 SSRF | N/A | No file upload / URL fetch in MVP |