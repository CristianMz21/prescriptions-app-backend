# Modelo de Seguridad — Prescriptions App MVP

> **Alcance:** Backend NestJS + Prisma + PostgreSQL
> **Cobertura OWASP Top 10 para esta aplicación**

---

## 1. Autenticación y Gestión de Sesiones

### 1.1 Arquitectura de Tokens

| Token | Vida útil | Almacenamiento | Transporte |
|-------|-----------|----------------|------------|
| Access Token (JWT) | 15 minutos | Memoria del cliente | Header `Authorization: Bearer` |
| Refresh Token | 7 días | PostgreSQL (hasheado con SHA-256) | Solo en el body del request |

**¿Por qué esta approche:**
- Access token en memoria = XSS no puede robarlo (no puede acceder a `localStorage`/`sessionStorage` via JS en CSP moderno)
- Refresh token hasheado en DB = aunque se filtre la DB, los tokens no son utilizables
- Revocación en DB = logout instantáneo

### 1.2 Almacenamiento de Contraseñas

```
password texto plano → bcrypt.compare() → válido/inválido
```

- **Algoritmo:** bcrypt con factor de costo **10**
- **Salt:** automático por contraseña
- **Seed scripts** usan bcrypt, NO SHA (las passwords seed son datos de prueba, no producción)

### 1.3 Estructura del JWT

```json
{
  "sub": "user-id-cuid",
  "email": "doctor@test.com",
  "role": "doctor",
  "iat": 1718275200,
  "exp": 1718276100  // +15 minutos
}
```

**Secretos almacenados en variables de entorno:**
- `JWT_SECRET` — secreto para firmar access tokens
- `JWT_REFRESH_SECRET` — secreto para firmar refresh tokens

---

## 2. Autorización (RBAC)

![Matriz RBAC](./diagrams/matriz-rbac.png)

### 2.1 Jerarquía de Roles

```
admin > doctor > patient
```

Los roles **no** son acumulativos. Cada rol tiene permisos explícitos.

### 2.2 Cadena de Guards

Cada ruta protegida usa:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor')
```

`JwtAuthGuard` corre primero → valida JWT → extrae usuario.
`RolesGuard` corre segundo → verifica si `user.role` ∈ roles requeridos.

### 2.3 Prevención de IDOR (Crítico)

**Problema:** Un paciente podría acceder a las prescripciones de otro paciente cambiando el ID en la URL.

**Mitigación en la capa de servicio:**

```typescript
// En findOne() y generatePdf():
const isOwner = userRole === 'admin'
  || (userRole === 'doctor' && prescription.authorId === doctorProfileId)
  || (userRole === 'patient' && prescription.patientId === patientProfileId);

if (!isOwner) {
  throw new ForbiddenException('No tenés acceso a esta prescripción');
}
```

**Para el endpoint consume():**
```typescript
if (prescription.patientId !== patientProfileId) {
  throw new ForbiddenException('Solo el paciente puede marcar como consumida');
}
```

---

## 3. Validación de Entrada

### 3.1 ValidationPipe Global

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,         // Elimina propiedades que no están en el DTO
    forbidNonWhitelisted: true, // Rechaza requests con campos desconocidos
    transform: true,          // Transforma objetos planos a instancias DTO
  }),
);
```

### 3.2 Ejemplos de DTOs

```typescript
// CreatePrescriptionDto — valida cada campo
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
  items: CreatePrescriptionItemDto[];  // mínimo 1 item
}
```

### 3.3 Prevención de Inyección SQL

Prisma usa **consultas parametrizadas exclusivamente**:

```typescript
// ✅ SEGURO — Prisma auto-parametriza
await this.prisma.user.findUnique({ where: { email: dto.email } });

// ❌ PROHIBIDO — Nunca usar $queryRawUnsafe
await this.prisma.$queryRawUnsafe(`SELECT * FROM user WHERE email = '${dto.email}'`);
```

**Política:** `$queryRawUnsafe` y `$executeRawUnsafe` están bannidos del codebase.

---

## 4. Rate Limiting

### 4.1 Estrategia

- **Global:** 100 requests/minuto por IP
- **Rutas auth:** 5 requests/minuto por IP (más estricto para `/auth/login`)

### 4.2 Implementación

```typescript
// main.ts
app.use(
  ThrottlerModule.forRoot([{
    ttl: 60000,
    limit: 100,
  }]),
);

// Para rutas auth (vía decorador o guard)
@UseGuards(ThrottlerGuard, JwtAuthGuard)
@Controller('auth')
```

### 4.3 Mitigación de Fuerza Bruta

El endpoint `/auth/login`:
1. Siempre retorna 401 para "usuario no encontrado" y "contraseña incorrecta" (no hay leak de timing)
2. Rate limited a 5 intentos/minuto por IP

---

## 5. Headers de Seguridad HTTP

| Header | Valor | Protección |
|--------|-------|------------|
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-XSS-Protection` | `1; mode=block` | XSS legacy (Chrome) |
| `Strict-Transport-Security` | `max-age=31536000` | Forzar HTTPS |
| `Content-Security-Policy` | `default-src 'none'` | CSP estricto |

Implementación via `@nestjs/common` o middleware Helmet en `main.ts`.

---

## 6. Modelo de Amenazas (STRIDE-lite)

| Amenaza | Vector de Ataque | Impacto | Mitigación |
|---------|------------------|---------|------------|
| **Robo de Credenciales** | Phishing, keylogger | Toma de cuenta completa | 2FA fuera del alcance MVP; cookie HTTP-only para el futuro |
| **Replay de Token** | Refresh token robado | Suplantación | Token hasheado en DB + revocación + 7d expiry |
| **IDOR** | Paciente cambia URL para ver datos de otro paciente | Breach de privacidad | Ownership check en service layer |
| **Escalación de Privilegios** | Doctor intenta acceder a métricas admin | Exposición de datos | RolesGuard verifica rol antes del endpoint |
| **Mass Assignment** | Atacante agrega `role: 'admin'` al payload | Escalación de privilegios | ValidationPipe `whitelist:true` elimina campos desconocidos |
| **Inyección SQL** | SQL malformado en parámetros | Exfiltración de datos | Solo consultas parametrizadas de Prisma |
| **Fuerza Bruta en Login** | Password guessing automatizado | Compromiso de cuenta | bcrypt cost=10 + rate limit en /auth/login |
| **Exposición de Datos Sensibles** | API retorna hash de password en respuesta | Robo de credenciales | DTOs nunca incluyen campo `password` |
| **Robo de Refresh Token** | XSS lee body con refresh token | Secuestro de sesión a largo plazo | Refresh token en body (no cookie) reduce riesgo XSS |

---

## 7. Checklist de Exposición de Datos

| Verificación | Estado | Implementación |
|-------------|--------|----------------|
| Contraseñas nunca en respuestas | ✅ | DTO excluye `password` |
| Refresh token hasheado en DB | ✅ | `sha256(token)` almacenado, nunca raw |
| Payload JWT sin datos sensibles | ✅ | Solo `sub`, `email`, `role` |
| Mensajes de error genéricos en auth | ✅ | Mismo 401 para "mal email" o "mal password" |
| Rate limit en login | ✅ | 5 req/min por IP |
| ValidationPipe strip whitelist | ✅ | Campos desconocidos eliminados |
| No stack traces en producción | ✅ | Global exception filter sanitiza |
| ENV vars nunca en respuestas | ✅ | Solo DATABASE_URL en .env |

---

## 8. Configuración CORS

```typescript
// main.ts — ejemplo de config CORS
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,  // Permitir cookies si se necesitan en el futuro
});
```

**MVP actual:** CORS abierto durante desarrollo; restringir a origen(es) específico(s) antes del deploy.

---

## 9. Testing de Seguridad

### 9.1 Qué Testear

| Test | Método |
|------|--------|
| Inyección SQL | Intentar `' OR 1=1 --` en parámetro `patientEmail` de prescripción |
| IDOR | Paciente A intenta acceder a prescripción del Paciente B por ID |
| Escalación de Rol | Intentar agregar `"role": "admin"` al payload de creación de usuario |
| Rate Limit de Auth | Llamadas rápidas a `/auth/login` con credenciales diferentes |
| XSS en PDF | Inyectar `<script>` en nombre de item de prescripción — verificar que no se ejecute en PDF o API |

### 9.2 Herramientas

- **Análisis Estático:** `npm audit`, reglas de seguridad eslint
- **Testing Dinámico:** Manual via Postman/curl
- **Dependencias:** `npm audit` (ejecutar en CI)

---

## 10. Gestión de Secretos

| Secreto | Dónde | Rotación |
|---------|-------|----------|
| `DATABASE_URL` | `.env` (local), CI env vars (deploy) | Al cambiar credenciales de DB |
| `JWT_SECRET` | `.env` (local), CI env vars (deploy) | Cuando se necesite rotación |
| `JWT_REFRESH_SECRET` | `.env` (local), CI env vars (deploy) | Cuando se necesite rotación |

**Nunca hacer commit de secretos reales** — `.env` está en `.gitignore`. Usar template `.env.example`.

---

## 11. Cobertura OWASP Top 10

| Categoría OWASP | ¿Cubierto? | Implementación |
|---------------|-----------|----------------|
| A01 Broken Access Control | ✅ | RolesGuard + checks IDOR en servicios |
| A02 Cryptographic Failures | ✅ | bcrypt para passwords, secretos JWT firmados |
| A03 Injection | ✅ | Consultas parametrizadas Prisma, ValidationPipe |
| A04 Insecure Design | ✅ | Matriz RBAC, ownership checks |
| A05 Security Misconfiguration | ⚠️ | CSP/headers, CORS — necesita config prod |
| A06 Vulnerable Components | ⚠️ | `npm audit` — necesita automatización CI |
| A07 Auth & Auth Failures | ✅ | JWT corta vida, rotación refresh, bcrypt |
| A08 Data Integrity | ⚠️ | No enforced a nivel DB todavía |
| A09 Logging Failures | ⏳ | Interceptor logging existe, necesita agregación |
| A10 SSRF | N/A | No hay file upload / URL fetch en MVP |
