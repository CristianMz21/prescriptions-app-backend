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

### 1.4 Variables de Entorno Relacionadas

- `JWT_ACCESS_SECRET` — Secreto para access tokens
- `JWT_REFRESH_SECRET` — Secreto para refresh tokens
- `JWT_ACCESS_TTL` — `"15m"`
- `JWT_REFRESH_TTL` — `"7d"`

---

## 2. Autorizacion (RBAC)

### 2.1 Matriz de Permisos

| Accion | ADMIN | DOCTOR | PATIENT |
|--------|:-----:|:------:|:-------:|
| Login | ✅ | ✅ | ✅ |
| Ver propio perfil | ✅ | ✅ | ✅ |
| Crear usuario | ✅ | ❌ | ❌ |
| Listar usuarios | ✅ | ❌ | ❌ |
| Listar pacientes | ✅ | ✅ | ❌ |
| Listar doctores | ✅ | ❌ | ❌ |
| Ver detalle usuario | ✅ | ✅ | ❌ |
| Crear prescripcion | ❌ | ✅ | ❌ |
| Listar propias | ✅ | las que autoro | las que recibio |
| Detalle prescripcion | ✅ | si es autor | si es dueno |
| Marcar consumida | ❌ | ❌ | ✅ owner |
| Descargar PDF | ✅ | si autor | si dueno |
| Listar todas prescripciones | ✅ | ❌ | ❌ |
| Ver metricas | ✅ | ❌ | ❌ |

### 2.2 Cadena de Guards

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
```

- `JwtAuthGuard` extrae token de cookie y valida JWT
- `RolesGuard` verifica si `user.role` esta en los roles requeridos

### 2.3 Prevencion de IDOR

El ownership check vive en la **capa de servicio**:

```typescript
async consume(prescriptionId: string, currentUser: User) {
  const prescription = await this.prisma.prescription.findFirst({
    where: {
      id: prescriptionId,
      patientId: currentUser.id,  // Solo el paciente puede consumir sus propias
    },
  });
  if (!prescription) {
    throw new ForbiddenException('No tenes acceso a esta prescripcion');
  }
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
| **IDOR** | Paciente cambia URL | Ownership check en service layer |
| **Escalacion de Privilegios** | Doctor accede a metricas admin | RolesGuard verifica rol |
| **Mass Assignment** | Payload con `role: 'ADMIN'` | ValidationPipe whitelist |
| **Inyeccion SQL** | Parametros maliciosos | Solo consultas parametrizadas Prisma |
| **XSS en PDF** | Script en nombre de item | Handlebars escapa por defecto |
| **Fuerza Bruta** | Password guessing | bcrypt cost=10 + errores genericos |

---

## 6. Checklist OWASP Top 10

| Categoria | Estado | Implementacion |
|-----------|--------|----------------|
| A01 Broken Access Control | ✅ | RolesGuard + IDOR checks en servicios |
| A02 Cryptographic Failures | ✅ | bcrypt, secretos JWT firmados |
| A03 Injection | ✅ | Prisma parametrizadas + ValidationPipe |
| A04 Insecure Design | ✅ | Matriz RBAC + ownership checks |
| A05 Security Misconfiguration | ✅ | Headers OK + CORS configurado |
| A06 Vulnerable Components | ✅ | npm audit en CI |
| A07 Auth Failures | ✅ | JWT corta vida + cookie HttpOnly |
| A08 Data Integrity | ✅ | Prisma transacciones |
| A09 Logging Failures | ✅ | Interceptor existe, logs disponibles |
| A10 SSRF | N/A | No hay file upload |