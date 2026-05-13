import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { Role } from '@prisma/client';

const extractAccessCookie = (
  setCookieHeader: string | string[] | undefined,
): string => {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const accessCookie = cookies.find((cookie) =>
    cookie.startsWith('accessToken='),
  );
  if (!accessCookie) {
    throw new Error('accessToken cookie not found in login response');
  }
  return accessCookie;
};

const extractRefreshCookie = (
  setCookieHeader: string | string[] | undefined,
): string => {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const refreshCookie = cookies.find((cookie) =>
    cookie.startsWith('refreshToken='),
  );
  if (!refreshCookie) {
    throw new Error('refreshToken cookie not found in login response');
  }
  return refreshCookie;
};

describe('Auth & Users Endpoints (e2e)', () => {
  let app: INestApplication;

  let adminCookie: string;
  let doctorCookie: string;
  let patientCookie: string;

  const uniqueSuffix = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@clinic.com', password: '***REDACTED-DEV-PASSWORD***' })
      .expect(201);
    adminCookie = extractAccessCookie(adminLogin.headers['set-cookie']);

    const doctorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'doctor@clinic.com', password: '***REDACTED-DEV-PASSWORD***' })
      .expect(201);
    doctorCookie = extractAccessCookie(doctorLogin.headers['set-cookie']);

    const patientLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'patient@clinic.com', password: '***REDACTED-DEV-PASSWORD***' })
      .expect(201);
    patientCookie = extractAccessCookie(patientLogin.headers['set-cookie']);
  });

  describe('POST /auth/login', () => {
    it('should return 401 with invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@clinic.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('should return 401 with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@clinic.com', password: '***REDACTED-DEV-PASSWORD***' })
        .expect(401);
    });

    it('should return 400 with missing fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@clinic.com' })
        .expect(400);
    });
  });

  describe('GET /auth/profile', () => {
    it('should return 200 with valid cookie and expose user without passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email');
      expect(res.body).toHaveProperty('role');
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body.email).toBe('admin@clinic.com');
      expect(res.body.role).toBe('ADMIN');
    });

    it('should return 401 without cookie', async () => {
      await request(app.getHttpServer()).get('/auth/profile').expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 200 with valid cookie and clear auth cookies', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', adminCookie)
        .expect(200);

      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();

      const clearCookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      const accessCleared = clearCookies.some((c) =>
        c.startsWith('accessToken=;'),
      );
      expect(accessCleared).toBe(true);
    });

    it('should return 401 without cookie', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });

  describe('GET /users', () => {
    it('should return 200 as ADMIN with paginated list', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 403 as DOCTOR', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('Cookie', doctorCookie)
        .expect(403);
    });

    it('should return 403 as PATIENT', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('Cookie', patientCookie)
        .expect(403);
    });

    it('should return 401 without cookie', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });
  });

  describe('POST /users', () => {
    it('should return 201 as ADMIN creating new user', async () => {
      const email = `newuser_${uniqueSuffix}@clinic.com`;
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Cookie', adminCookie)
        .send({ email, password: '***REDACTED-DEV-PASSWORD***', role: Role.PATIENT })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toBe(email);
      expect(res.body.role).toBe('PATIENT');
    });

    it('should return 403 as DOCTOR', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('Cookie', doctorCookie)
        .send({
          email: `doctor_create_${uniqueSuffix}@clinic.com`,
          password: '***REDACTED-DEV-PASSWORD***',
          role: Role.PATIENT,
        })
        .expect(403);
    });

    it('should return 403 as PATIENT', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('Cookie', patientCookie)
        .send({
          email: `patient_create_${uniqueSuffix}@clinic.com`,
          password: '***REDACTED-DEV-PASSWORD***',
          role: Role.PATIENT,
        })
        .expect(403);
    });

    it('should return 400 with invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('Cookie', adminCookie)
        .send({ email: 'not-an-email', role: 'INVALID_ROLE' })
        .expect(400);
    });

    it('should return 409 duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('Cookie', adminCookie)
        .send({
          email: 'admin@clinic.com',
          password: '***REDACTED-DEV-PASSWORD***',
          role: Role.ADMIN,
        })
        .expect(409);
    });

    it('should return 401 without cookie', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({
          email: `nocookie_${uniqueSuffix}@clinic.com`,
          password: '***REDACTED-DEV-PASSWORD***',
          role: Role.PATIENT,
        })
        .expect(401);
    });
  });

  describe('GET /users/patients', () => {
    it('should return 200 as ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/patients')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('email');
        expect(res.body[0]).toHaveProperty('role');
      }
    });

    it('should return 200 as DOCTOR', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/patients')
        .set('Cookie', doctorCookie)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 403 as PATIENT', async () => {
      await request(app.getHttpServer())
        .get('/users/patients')
        .set('Cookie', patientCookie)
        .expect(403);
    });

    it('should return 401 without cookie', async () => {
      await request(app.getHttpServer()).get('/users/patients').expect(401);
    });
  });

  describe('GET /users/doctors', () => {
    it('should return 200 as ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/doctors')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('email');
        expect(res.body[0]).toHaveProperty('role');
      }
    });

    it('should return 403 as DOCTOR', async () => {
      await request(app.getHttpServer())
        .get('/users/doctors')
        .set('Cookie', doctorCookie)
        .expect(403);
    });

    it('should return 403 as PATIENT', async () => {
      await request(app.getHttpServer())
        .get('/users/doctors')
        .set('Cookie', patientCookie)
        .expect(403);
    });

    it('should return 401 without cookie', async () => {
      await request(app.getHttpServer()).get('/users/doctors').expect(401);
    });
  });

  describe('GET /users/:id', () => {
    it('should return 200 as ADMIN for any user', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Cookie', adminCookie)
        .expect(200);

      if (res.body.length > 0) {
        const userId = res.body[0].id;
        const userRes = await request(app.getHttpServer())
          .get(`/users/${userId}`)
          .set('Cookie', adminCookie)
          .expect(200);

        expect(userRes.body).toHaveProperty('id');
        expect(userRes.body).toHaveProperty('email');
        expect(userRes.body).toHaveProperty('role');
        expect(userRes.body).not.toHaveProperty('passwordHash');
      }
    });

    it('should return 200 as DOCTOR for any user', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Cookie', adminCookie)
        .expect(200);

      if (res.body.length > 0) {
        const userId = res.body[0].id;
        await request(app.getHttpServer())
          .get(`/users/${userId}`)
          .set('Cookie', doctorCookie)
          .expect(200);
      }
    });

    it('should return 403 as PATIENT', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Cookie', adminCookie)
        .expect(200);

      if (res.body.length > 0) {
        const userId = res.body[0].id;
        await request(app.getHttpServer())
          .get(`/users/${userId}`)
          .set('Cookie', patientCookie)
          .expect(403);
      }
    });

    it('should return 401 without cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Cookie', adminCookie)
        .expect(200);

      if (res.body.length > 0) {
        const userId = res.body[0].id;
        await request(app.getHttpServer()).get(`/users/${userId}`).expect(401);
      }
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/users/${nonExistentId}`)
        .set('Cookie', adminCookie)
        .expect(404);
    });
  });

  describe('Admin access cross-check', () => {
    it('should return 200 for ADMIN on GET /admin/metrics', async () => {
      await request(app.getHttpServer())
        .get('/admin/metrics')
        .set('Cookie', adminCookie)
        .expect(200);
    });

    it('should return 403 for DOCTOR on GET /admin/metrics', async () => {
      await request(app.getHttpServer())
        .get('/admin/metrics')
        .set('Cookie', doctorCookie)
        .expect(403);
    });

    it('should return 403 for PATIENT on GET /admin/metrics', async () => {
      await request(app.getHttpServer())
        .get('/admin/metrics')
        .set('Cookie', patientCookie)
        .expect(403);
    });

    it('should return 401 for unauthenticated on GET /admin/metrics', async () => {
      await request(app.getHttpServer()).get('/admin/metrics').expect(401);
    });

    it('should return 200 for ADMIN on GET /admin/prescriptions', async () => {
      await request(app.getHttpServer())
        .get('/admin/prescriptions')
        .set('Cookie', adminCookie)
        .expect(200);
    });

    it('should return 403 for DOCTOR on GET /admin/prescriptions', async () => {
      await request(app.getHttpServer())
        .get('/admin/prescriptions')
        .set('Cookie', doctorCookie)
        .expect(403);
    });

    it('should return 403 for PATIENT on GET /admin/prescriptions', async () => {
      await request(app.getHttpServer())
        .get('/admin/prescriptions')
        .set('Cookie', patientCookie)
        .expect(403);
    });

    it('should return 401 for unauthenticated on GET /admin/prescriptions', async () => {
      await request(app.getHttpServer())
        .get('/admin/prescriptions')
        .expect(401);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
