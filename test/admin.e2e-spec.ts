import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { TEST_PASSWORD } from './test-credentials';

const extractAccessCookie = (
  setCookieHeader: string | string[] | undefined,
): string => {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const accessCookie = cookies.find(cookie =>
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
      .send({ email: 'admin@clinic.com', password: TEST_PASSWORD })
      .expect(201);
    adminCookie = extractAccessCookie(adminLogin.headers['set-cookie']);

    const doctorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'doctor@clinic.com', password: TEST_PASSWORD })
      .expect(201);
    doctorCookie = extractAccessCookie(doctorLogin.headers['set-cookie']);

    const patientLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'patient@clinic.com', password: TEST_PASSWORD })
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

    it('should filter by authorId', async () => {
      const adminListRes = await request(app.getHttpServer())
        .get('/admin/prescriptions?limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      if (adminListRes.body.data.length > 0) {
        const authorId = adminListRes.body.data[0].authorId;
        const filteredRes = await request(app.getHttpServer())
          .get(`/admin/prescriptions?authorId=${authorId}&limit=10`)
          .set('Cookie', adminCookie)
          .expect(200);

        expect(
          filteredRes.body.data.every((p: any) => p.authorId === authorId),
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
        .get(
          '/admin/prescriptions?fromDate=2026-01-01&toDate=2026-12-31&limit=10',
        )
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 403 when doctor accesses /admin/prescriptions', async () => {
      const _res = await request(app.getHttpServer())
        .get('/admin/prescriptions')
        .set('Cookie', doctorCookie)
        .expect(403);
      expect(_res.status).toBe(403);
    });

    it('should return 403 when patient accesses /admin/prescriptions', async () => {
      const _res = await request(app.getHttpServer())
        .get('/admin/prescriptions')
        .set('Cookie', patientCookie)
        .expect(403);
      expect(_res.status).toBe(403);
    });

    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .get('/admin/prescriptions')
        .expect(401);
    });

    it('should return 400 for invalid status value', async () => {
      const _res = await request(app.getHttpServer())
        .get('/admin/prescriptions?status=INVALID')
        .set('Cookie', adminCookie)
        .expect(400);
      expect(_res.status).toBe(400);
    });

    it('should include author and patient data in response', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/prescriptions?limit=1')
        .set('Cookie', adminCookie)
        .expect(200);

      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty('author');
        expect(res.body.data[0]).toHaveProperty('patient');
        expect(res.body.data[0].author).toHaveProperty('id');
        expect(res.body.data[0].author).toHaveProperty('user');
        expect(res.body.data[0].author.user).toHaveProperty('email');
        expect(res.body.data[0].patient).toHaveProperty('id');
        expect(res.body.data[0].patient).toHaveProperty('user');
        expect(res.body.data[0].patient.user).toHaveProperty('email');
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
      const _res = await request(app.getHttpServer())
        .get('/admin/metrics')
        .set('Cookie', doctorCookie)
        .expect(403);
      expect(_res.status).toBe(403);
    });

    it('should return 403 when patient accesses /admin/metrics', async () => {
      const _res = await request(app.getHttpServer())
        .get('/admin/metrics')
        .set('Cookie', patientCookie)
        .expect(403);
      expect(_res.status).toBe(403);
    });

    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer()).get('/admin/metrics').expect(401);
    });

    it('should return 400 for invalid date format', async () => {
      const _res = await request(app.getHttpServer())
        .get('/admin/metrics?from=not-a-date')
        .set('Cookie', adminCookie)
        .expect(400);
      expect(_res.status).toBe(400);
    });

    it('should return 400 for invalid to date format', async () => {
      const _res = await request(app.getHttpServer())
        .get('/admin/metrics?to=invalid')
        .set('Cookie', adminCookie)
        .expect(400);
      expect(_res.status).toBe(400);
    });
  });

  describe('GET /admin/metrics/stream (SSE)', () => {
    it('streams at least one MetricsStreamSnapshot for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/metrics/stream')
        .set('Cookie', adminCookie)
        .buffer(true)
        .parse((response, callback) => {
          let chunks = '';
          const closableResponse = response as unknown as {
            destroy: () => void;
          };
          response.on('data', chunk => {
            chunks += chunk.toString('utf8');
            // First event arrives via startWith(0) — close immediately to avoid hanging.
            if (chunks.includes('"timestamp"')) {
              closableResponse.destroy();
            }
          });
          response.on('end', () => callback(null, chunks));
          response.on('close', () => callback(null, chunks));
        });
      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
      expect(String(res.body)).toMatch(/"totals"/);
      expect(String(res.body)).toMatch(/"timestamp"/);
    }, 10000);

    it('returns 403 when a non-admin tries to subscribe', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/metrics/stream')
        .set('Cookie', doctorCookie)
        .expect(403);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        statusCode: 403,
        message: expect.any(String),
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
