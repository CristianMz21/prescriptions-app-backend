# Prescription Management System: Backend Architectural Design & Roadmap

As requested, here is the comprehensive technical design documentation and development roadmap for the MVP Prescription Management System. This document outlines a secure, scalable, and modular backend architecture using NestJS, Prisma, and PostgreSQL.

---

## 1. High-Level Architecture Overview

The system will follow a Domain-Driven modular architecture, leveraging NestJS's dependency injection to ensure strict separation of concerns between controllers (routing), services (business logic), and repositories (data access via Prisma).

### Module Structure
*   **`AppModule`**: The root module that orchestrates configuration, database connections, and global middleware.
*   **`PrismaModule`**: A globally scoped module responsible for managing the Prisma Client singleton and database lifecycle events.
*   **`AuthModule`**: Handles authentication (login, registration, token refresh) and integrates with `@nestjs/jwt`.
*   **`UsersModule`**: Manages user data retrieval, RBAC mapping, and profile management.
*   **`PrescriptionsModule`**: The core business domain. Contains logic for creation (Doctor), viewing/updating (Patient/Doctor/Admin), and listing.
*   **`MetricsModule`**: Dedicated to Admin analytical queries (totals, daily series). Separating this ensures heavy aggregation queries don't pollute operational endpoints.
*   **`PdfModule`**: An infrastructure module wrapping PDF generation logic (e.g., using `puppeteer` or `pdfkit`), exposed as a service to be consumed by the `PrescriptionsModule`.

### Data Flow
1.  **Request Ingestion**: Incoming requests pass through global middleware (Helmet, CORS) and the Rate Limiter.
2.  **Authentication & Authorization**: The `JwtAuthGuard` intercepts the request, extracting and validating the JWT from the HTTP-Only cookie. The `RolesGuard` then verifies if the authenticated user's role satisfies the endpoint's requirements.
3.  **Validation**: `@UsePipes(ValidationPipe)` intercepts the payload, validating and transforming it according to the defined DTOs using `class-validator` and `class-transformer`.
4.  **Controller Layer**: The request reaches the Controller, which delegates the operation to the appropriate Service.
5.  **Service & Data Layer**: The Service executes business logic and interacts with the database via the `PrismaService`.
6.  **Exception Handling**: Any thrown errors (e.g., `NotFoundException`, `UnauthorizedException`) are caught by a global `HttpExceptionFilter` to format a consistent JSON error response.

---

## 2. Database Modeling (Prisma Schema)

Efficient indexing and relational mapping are critical. Here is the proposed schema structure:

```prisma
enum Role {
  ADMIN
  DOCTOR
  PATIENT
}

enum PrescriptionStatus {
  PENDING
  CONSUMED
}

model User {
  id             String         @id @default(uuid())
  email          String         @unique
  passwordHash   String
  role           Role
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  
  // Relations
  prescriptionsAsDoctor  Prescription[] @relation("DoctorPrescriptions")
  prescriptionsAsPatient Prescription[] @relation("PatientPrescriptions")
  
  @@index([email])
}

model Prescription {
  id          String             @id @default(uuid())
  status      PrescriptionStatus @default(PENDING)
  items       Json               // Array of manually typed items: [{ name, dosage, instructions }]
  notes       String?
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  // Relations
  doctorId    String
  doctor      User               @relation("DoctorPrescriptions", fields: [doctorId], references: [id])
  patientId   String
  patient     User               @relation("PatientPrescriptions", fields: [patientId], references: [id])

  // Indexes for frequent queries
  @@index([status])
  @@index([createdAt])
  @@index([doctorId])
  @@index([patientId])
}
```

---

## 3. Step-by-Step Implementation Roadmap

### Phase 1: Project Setup & Infrastructure (Days 1-2)
*   **Initialization**: Scaffold NestJS project (`nest new`).
*   **Database Setup**: Initialize Prisma (`npx prisma init`), configure PostgreSQL connection strings via `.env`.
*   **Security Baseline**: Install and configure `helmet`, configure CORS for specific origins (and allow credentials for cookies), and set up `@nestjs/throttler` for rate limiting.
*   **Global Enhancements**: Implement the global `ValidationPipe` (with `whitelist: true` and `transform: true`) and a global `HttpExceptionFilter`.

### Phase 2: Data Modeling & Seeding (Day 3)
*   **Schema Application**: Apply the Prisma schema and run initial migrations (`npx prisma migrate dev`).
*   **Seed Script**: Create `prisma/seed.ts` utilizing `bcrypt` to hash passwords. Generate:
    *   1 Admin user.
    *   1 Doctor user.
    *   1 Patient user.
    *   10-20 dummy prescriptions with randomized statuses and creation dates.

### Phase 3: Auth & Security Layer (Days 4-5)
*   **JWT Implementation**: Configure `@nestjs/jwt`. Implement login logic that generates an Access Token (short-lived, e.g., 15m) and a Refresh Token (long-lived, e.g., 7d).
*   **Cookie Management**: Configure the Auth controller to attach tokens via `res.cookie()` utilizing HTTP-Only, Secure, and SameSite strict attributes.
*   **Guards & Decorators**: 
    *   Create `JwtAuthGuard` to read tokens from cookies.
    *   Create `@Roles(...roles)` decorator and `RolesGuard` for RBAC.
    *   Create `@CurrentUser()` decorator to inject the user entity into controllers.

### Phase 4: Core Business Logic (Days 6-8)
*   **Users/Profile Flow**: Implement `GET /auth/profile`.
*   **Doctor Flow**: 
    *   `POST /prescriptions` (Validates array of items DTO, sets `doctorId` from token).
    *   `GET /prescriptions/authored` (List with pagination).
*   **Patient Flow**: 
    *   `GET /prescriptions/mine` (List patient's prescriptions).
    *   `PATCH /prescriptions/:id/consume` (Updates status to `CONSUMED`).
*   **Admin Flow (Metrics)**: 
    *   `GET /admin/prescriptions` (List all, sortable/filterable).
    *   `GET /admin/metrics` (Utilize Prisma's `groupBy` and `count` for totals, status counts, and daily time-series generation).

### Phase 5: PDF Generation (Day 9)
*   **Strategy**: Utilize `puppeteer` (headless Chrome) for the highest fidelity.
*   **Implementation**: Create `PdfService`.
    *   Design a simple HTML/CSS template.
    *   Inject prescription data into the template using a lightweight engine like Handlebars.
    *   Convert HTML to PDF buffer via Puppeteer and return it via a `StreamableFile` in NestJS with the correct `Content-Type` (`application/pdf`) and `Content-Disposition` headers.

### Phase 6: Testing & Deployment (Days 10-12)
*   **Unit Testing**: Use Jest to mock Prisma (`jest-mock-extended`) and test isolated service logic (e.g., verifying status change logic).
*   **E2E Testing**: Setup Supertest. Create dedicated DB containers (via Docker) for tests. Write E2E flows testing full authentication loops (checking cookie headers) and RBAC rejection (e.g., Patient trying to create a prescription).
*   **Deployment**: Create Dockerfile. Setup CI/CD to push to Railway/Render. Ensure build steps include `npx prisma generate` and `npx prisma migrate deploy`.

---

## 4. OpenAPI/Swagger Strategy

Documenting the API contracts is crucial for frontend consumption and automated testing.

*   **Integration**: Install `@nestjs/swagger`.
*   **Configuration**: Initialize the `DocumentBuilder` in `main.ts` (e.g., setting title, version, and cookie authentication requirements).
*   **Implementation**:
    *   Use `@ApiTags()` on controllers to group endpoints (e.g., 'Auth', 'Doctor', 'Patient', 'Admin').
    *   Use `@ApiOperation()` and `@ApiResponse()` on methods to describe intent and potential error states (e.g., 401 Unauthorized, 403 Forbidden, 404 Not Found).
    *   Decorate DTO classes with `@ApiProperty()` so Swagger can infer request body schemas and validation requirements.
    *   **Security Definition**: Define Cookie Authentication in Swagger configuration (`.addCookieAuth('Authentication')`) to allow testing directly from the Swagger UI.

---

## 5. Security Checklist (NestJS/Prisma Specific)

*   [ ] **Cross-Site Scripting (XSS) Prevention**: 
    *   Tokens are stored strictly in `HTTP-Only`, `Secure`, `SameSite=Strict` cookies. The frontend cannot access them via JavaScript.
*   [ ] **Cross-Site Request Forgery (CSRF)**:
    *   Since using cookies, configure CORS to accept specific origins and explicitly enable `credentials: true`. Consider adding `csurf` middleware if standard SameSite protections need reinforcement for older browsers.
*   [ ] **Injection Attacks**:
    *   Prisma intrinsically protects against SQL injection through parameterized queries. Avoid using `Prisma.$queryRawUnsafe` entirely.
*   [ ] **Data Exposure / Serialization**:
    *   Use `class-transformer`'s `@Exclude()` decorator on the `User` entity to ensure `passwordHash` is *never* serialized in responses. 
    *   Ensure global `ValidationPipe` has `whitelist: true` and `forbidNonWhitelisted: true` to strip malicious properties from request bodies.
*   [ ] **Rate Limiting & Brute Force**:
    *   Apply `@nestjs/throttler` globally.
    *   Apply stricter rate limits to the `/auth/login` and `/auth/refresh` routes to mitigate credential stuffing.
*   [ ] **Dependency Security**:
    *   Regularly run `npm audit`.
    *   Run Helmet to set secure HTTP headers (HSTS, NoSniff, X-Frame-Options).
*   [ ] **IDOR (Insecure Direct Object Reference) Prevention**:
    *   In the Patient and Doctor flows, the Service layer *must* append `where: { patientId: currentUser.id }` or `doctorId` respectively, rather than trusting the `:id` parameter alone when updating/fetching individual records.