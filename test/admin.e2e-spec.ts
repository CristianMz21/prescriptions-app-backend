import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

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

describe('Admin Endpoints (e2e)', () => {
  let app: INestApplication;

  let adminCookie: string;
  let doctorCookie: string;
  let patientCookie: string;

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
      .send({ email: 'admin@clinic.com', password: 'Password123!' })
      .expect(201);
    adminCookie = extractAccessCookie(adminLogin.headers['set-cookie']);

    const doctorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'doctor@clinic.com', password: 'Password123!' })
      .expect(201);
    doctorCookie = extractAccessCookie(doctorLogin.headers['set-cookie']);

    const patientLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'patient@clinic.com', password: 'Password123!' })
      .expect(201);
    patientCookie = extractAccessCookie(patientLogin.headers['set-cookie']);
  });

  describe('GET /admin/prescriptions', () => {
    it('should list all prescriptions for admin with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/prescriptions?page=1&limit=5')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta.page).toEqual(1);
      expect(res.body.meta.limit).toEqual(5);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('totalPages');
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/prescriptions?status=PENDING&limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      if (res.body.data.length > 0) {
        expect(res.body.data[0].status).toEqual('PENDING');
      }
    });

    it('should filter by doctorId', async () => {
      const adminListRes = await request(app.getHttpServer())
        .get('/admin/prescriptions?limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      if (adminListRes.body.data.length > 0) {
        const doctorId = adminListRes.body.data[0].doctorId;
        const filteredRes = await request(app.getHttpServer())
          .get(`/admin/prescriptions?doctorId=${doctorId}&limit=10`)
          .set('Cookie', adminCookie)
          .expect(200);

        expect(
          filteredRes.body.data.every((p: any) => p.doctorId === doctorId),
        ).toBe(true);
      }
    });

    it('should filter by patientId', async () => {
      const adminListRes = await request(app.getHttpServer())
        .get('/admin/prescriptions?limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      if (adminListRes.body.data.length > 0) {
        const patientId = adminListRes.body.data[0].patientId;
        const filteredRes = await request(app.getHttpServer())
          .get(`/admin/prescriptions?patientId=${patientId}&limit=10`)
          .set('Cookie', adminCookie)
          .expect(200);

        expect(
          filteredRes.body.data.every((p: any) => p.patientId === patientId),
        ).toBe(true);
      }
    });

    it('should filter by date range', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/prescriptions?from=2026-01-01&to=2026-12-31&limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 403 when doctor accesses /admin/prescriptions', async () => {
      await request(app.getHttpServer())
        .get('/admin/prescriptions')
        .set('Cookie', doctorCookie)
        .expect(403);
    });

    it('should return 403 when patient accesses /admin/prescriptions', async () => {
      await request(app.getHttpServer())
        .get('/admin/prescriptions')
        .set('Cookie', patientCookie)
        .expect(403);
    });

    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .get('/admin/prescriptions')
        .expect(401);
    });

    it('should return 400 for invalid status value', async () => {
      await request(app.getHttpServer())
        .get('/admin/prescriptions?status=INVALID')
        .set('Cookie', adminCookie)
        .expect(400);
    });

    it('should include doctor and patient data in response', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/prescriptions?limit=1')
        .set('Cookie', adminCookie)
        .expect(200);

      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty('doctor');
        expect(res.body.data[0]).toHaveProperty('patient');
        expect(res.body.data[0].doctor).toHaveProperty('id');
        expect(res.body.data[0].doctor).toHaveProperty('email');
        expect(res.body.data[0].patient).toHaveProperty('id');
        expect(res.body.data[0].patient).toHaveProperty('email');
      }
    });
  });

  describe('GET /admin/metrics', () => {
    it('should return metrics for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/metrics')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body).toHaveProperty('totals');
      expect(res.body).toHaveProperty('byStatus');
      expect(res.body).toHaveProperty('byDay');
      expect(res.body).toHaveProperty('topDoctors');
      expect(res.body.totals).toHaveProperty('doctors');
      expect(res.body.totals).toHaveProperty('patients');
      expect(res.body.totals).toHaveProperty('prescriptions');
      expect(res.body.byStatus).toHaveProperty('pending');
      expect(res.body.byStatus).toHaveProperty('consumed');
    });

    it('should apply from/to date filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/metrics?from=2026-01-01&to=2026-12-31')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body).toHaveProperty('totals');
      expect(res.body).toHaveProperty('topDoctors');
      expect(Array.isArray(res.body.topDoctors)).toBe(true);
    });

    it('should return 403 when doctor accesses /admin/metrics', async () => {
      await request(app.getHttpServer())
        .get('/admin/metrics')
        .set('Cookie', doctorCookie)
        .expect(403);
    });

    it('should return 403 when patient accesses /admin/metrics', async () => {
      await request(app.getHttpServer())
        .get('/admin/metrics')
        .set('Cookie', patientCookie)
        .expect(403);
    });

    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer()).get('/admin/metrics').expect(401);
    });

    it('should return 400 for invalid date format', async () => {
      await request(app.getHttpServer())
        .get('/admin/metrics?from=not-a-date')
        .set('Cookie', adminCookie)
        .expect(400);
    });

    it('should return 400 for invalid to date format', async () => {
      await request(app.getHttpServer())
        .get('/admin/metrics?to=invalid')
        .set('Cookie', adminCookie)
        .expect(400);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
