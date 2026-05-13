# Security Rules

## Authentication
- Use `@nestjs/jwt` + `@nestjs/passport` for JWT auth
- Short-lived access tokens (15min), refresh tokens (7d)
- Never expose sensitive data in JWT payloads

## Input Validation
- Use `class-validator` decorators on ALL DTOs
- Enable `ValidationPipe` globally with `whitelist: true`
- Validate route params (`@Param('id', ParseUUIDPipe)`)

## Authorization
- Use **guards** for access control, never manual checks in controllers
- Role-based guards with `@Roles()` decorator
- `@Public()` decorator for exempt routes

## Rate Limiting
- Implement `@nestjs/throttler` for all endpoints
- Stricter limits on auth endpoints (login, forgot-password)
- Anonymous users = lower limits

## Output Sanitization
- Use `@Exclude()` on sensitive entity fields
- Never log sensitive data (passwords, tokens)
- Set proper `Content-Type` headers

## SQL Injection
- Prisma parameterized queries (automatic)
- Never use template strings for raw queries with user input