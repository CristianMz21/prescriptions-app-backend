# Security Policy — Prescriptions App

## Supported Versions

| Version | Supported |
| ------- | ------------------ |
| 0.0.1+ | :white_check_mark: |

## Reporting a Vulnerability

To report a security vulnerability, please DO NOT open a public issue.
Instead, contact the maintainers directly via GitHub or email.

---

## Security Model

### Authentication
- JWT access token (15m TTL) + refresh token (7d TTL) in **HttpOnly cookies**
- Tokens never in Authorization header or response body
- `bcrypt` for password hashing (cost factor 10)

### Authorization (RBAC)
- Three roles: `ADMIN`, `DOCTOR`, `PATIENT`
- Guards enforce role at controller level (`@Roles()` decorator)
- IDOR prevention via `applyTenantBoundary()` in service layer

### Data Protection
- All Prisma queries are parameterized (SQL injection prevention)
- `ValidationPipe` with `whitelist: true` + `forbidNonWhitelisted: true`
- Sensitive data excluded via `ClassSerializerInterceptor`
- No secrets logged

### Security Headers
| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Cache-Control` | `no-store` |
| `Strict-Transport-Security` | `max-age=31536000` |

Implemented via Helmet.

### Dependency Security
- `npm audit` runs in CI on every push
- `pnpm audit --audit-level=high` in dependency-audit job
- Dev dependencies pinned in `package.json`

---

## OWASP Top 10 Coverage

| Category | Status | Implementation |
|-----------|--------|----------------|
| A01 Broken Access Control | OK | RolesGuard + applyTenantBoundary |
| A02 Cryptographic Failures | OK | bcrypt, JWT secrets |
| A03 Injection | OK | Prisma parameterized queries + ValidationPipe |
| A04 Insecure Design | OK | RBAC matrix + ownership checks |
| A05 Security Misconfiguration | OK | Headers OK + CORS configured |
| A06 Vulnerable Components | OK | npm audit in CI |
| A07 Auth Failures | OK | JWT short-lived + cookie HttpOnly |
| A08 Data Integrity | OK | Prisma transactions + audit log |
| A09 Logging Failures | OK | Exception filters + logging available |
| A10 SSRF | N/A | No file upload |
| Email Injection | OK | nodemailer with controlled params |