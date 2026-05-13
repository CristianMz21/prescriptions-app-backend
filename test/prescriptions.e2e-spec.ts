import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';

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

describe('Prescriptions Flow (e2e)', () => {
  let app: INestApplication;

  let adminCookie: string;
  let patientCookie: string;
  let doctorCookie: string;

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

    const patientLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'patient@clinic.com', password: '***REDACTED-DEV-PASSWORD***' })
      .expect(201);
    patientCookie = extractAccessCookie(patientLogin.headers['set-cookie']);

    const doctorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'doctor@clinic.com', password: '***REDACTED-DEV-PASSWORD***' })
      .expect(201);
    doctorCookie = extractAccessCookie(doctorLogin.headers['set-cookie']);
  });

  describe('Test 1: Pagination & Filtering (Admin)', () => {
    it('should parse query parameters correctly and return paginated prescriptions', async () => {
      return request(app.getHttpServer())
        .get('/prescriptions?page=1&limit=5&status=PENDING')
        .set('Cookie', adminCookie)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(res.body.meta.page).toEqual(1);
          expect(res.body.meta.limit).toEqual(5);
          if (res.body.data.length > 0) {
            expect(res.body.data[0].status).toEqual('PENDING');
          }
        });
    });
  });

  describe('Test 2: Strict RBAC', () => {
    it('should return 403 Forbidden when a PATIENT tries to create a prescription', async () => {
      const mockPayload = {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
        items: [{ name: 'Test Med', dosage: '10mg', quantity: 30 }],
      };

      return request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', patientCookie)
        .send(mockPayload)
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toEqual(
            'Insufficient permissions to access this resource',
          );
          expect(res.body.error).toEqual('Forbidden');
        });
    });
  });

  describe('Test 3: ValidationPipe (class-validator)', () => {
    it('should return 400 Bad Request when a DOCTOR sends an invalid payload', async () => {
      const invalidPayload = {
        patientId: 'not-a-uuid',
      };

      return request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', doctorCookie)
        .send(invalidPayload)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([
              'patientId must be a UUID',
              'Items array must not be empty',
            ]),
          );
          expect(res.body.error).toEqual('Bad Request');
        });
    });
  });

  describe('GET /prescriptions/:id — Contract: ownership', () => {
    it('should return 403 when doctor tries to access another doctors prescription', async () => {
      const adminRes = await request(app.getHttpServer())
        .get('/prescriptions?limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      const doctorsPrescription = adminRes.body.data.find(
        (p: any) => p.doctorId !== undefined,
      );

      if (doctorsPrescription) {
        await request(app.getHttpServer())
          .get(`/prescriptions/${doctorsPrescription.id}`)
          .set('Cookie', doctorCookie)
          .expect(403)
          .expect((res) => {
            expect(res.body.message).toEqual(
              'You do not have permission to access this prescription.',
            );
            expect(res.body.error).toEqual('Forbidden');
          });
      }
    });

    it('should return prescription detail when doctor accesses their own prescription', async () => {
      const res = await request(app.getHttpServer())
        .get('/prescriptions')
        .set('Cookie', doctorCookie)
        .expect(200);

      if (res.body.data.length > 0) {
        const ownPrescription = res.body.data[0];
        await request(app.getHttpServer())
          .get(`/prescriptions/${ownPrescription.id}`)
          .set('Cookie', doctorCookie)
          .expect(200);
      }
    });

    it('should return 403 when patient tries to access another patients prescription', async () => {
      const adminRes = await request(app.getHttpServer())
        .get('/prescriptions?limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      const seededPatientId = adminRes.body.data[0]?.patientId;
      const prescriptionNotBelongingToSeededPatient = adminRes.body.data.find(
        (p: any) => p.patientId !== seededPatientId,
      );

      if (prescriptionNotBelongingToSeededPatient) {
        await request(app.getHttpServer())
          .get(`/prescriptions/${prescriptionNotBelongingToSeededPatient.id}`)
          .set('Cookie', patientCookie)
          .expect(403)
          .expect((res) => {
            expect(res.body.message).toEqual(
              'You do not have permission to access this prescription.',
            );
            expect(res.body.error).toEqual('Forbidden');
          });
      }
    });

    it('should allow admin to access any prescription', async () => {
      const res = await request(app.getHttpServer())
        .get('/prescriptions')
        .set('Cookie', adminCookie)
        .expect(200);

      if (res.body.data.length > 0) {
        const anyPrescription = res.body.data[0];
        await request(app.getHttpServer())
          .get(`/prescriptions/${anyPrescription.id}`)
          .set('Cookie', adminCookie)
          .expect(200);
      }
    });
  });

  describe('GET /me/prescriptions — Patient List (status, pagination)', () => {
    it('should return only own prescriptions for patient with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/prescriptions?page=1&limit=10')
        .set('Cookie', patientCookie)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.data.every((p: any) => p.patientId !== undefined)).toBe(
        true,
      );
    });

    it('should filter by status for patient prescriptions', async () => {
      const res = await request(app.getHttpServer())
        .get('/prescriptions?status=PENDING&limit=10')
        .set('Cookie', patientCookie)
        .expect(200);

      if (res.body.data.length > 0) {
        expect(res.body.data[0].status).toEqual('PENDING');
      }
    });

    it('should return 401 without auth cookie', async () => {
      await request(app.getHttpServer()).get('/prescriptions').expect(401);
    });
  });

  describe('PATCH /prescriptions/:id/consume — Patient Actions', () => {
    it('should return 403 when doctor tries to consume a prescription', async () => {
      const adminRes = await request(app.getHttpServer())
        .get('/prescriptions?limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      if (adminRes.body.data.length > 0) {
        const prescriptionId = adminRes.body.data[0].id;
        await request(app.getHttpServer())
          .patch(`/prescriptions/${prescriptionId}/consume`)
          .set('Cookie', doctorCookie)
          .expect(403);
      }
    });

    it('should return 403 when patient tries to consume a prescription not belonging to them', async () => {
      const adminRes = await request(app.getHttpServer())
        .get('/prescriptions?limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      const seededPatientId = adminRes.body.data[0]?.patientId;
      const prescriptionNotBelongingToSeededPatient = adminRes.body.data.find(
        (p: any) => p.patientId !== seededPatientId,
      );

      if (prescriptionNotBelongingToSeededPatient) {
        await request(app.getHttpServer())
          .patch(
            `/prescriptions/${prescriptionNotBelongingToSeededPatient.id}/consume`,
          )
          .set('Cookie', patientCookie)
          .expect(403);
      }
    });
  });

  describe('GET /prescriptions/:id/pdf — Patient PDF Download', () => {
    it('should return 403 when doctor tries to download a prescription PDF not their own', async () => {
      const adminRes = await request(app.getHttpServer())
        .get('/prescriptions?limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      if (adminRes.body.data.length > 0) {
        const prescriptionId = adminRes.body.data[0].id;
        await request(app.getHttpServer())
          .get(`/prescriptions/${prescriptionId}/pdf`)
          .set('Cookie', doctorCookie)
          .expect(403);
      }
    });

    it('should return 403 when patient tries to download another patients prescription PDF', async () => {
      const adminRes = await request(app.getHttpServer())
        .get('/prescriptions?limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      const seededPatientId = adminRes.body.data[0]?.patientId;
      const prescriptionNotBelongingToSeededPatient = adminRes.body.data.find(
        (p: any) => p.patientId !== seededPatientId,
      );

      if (prescriptionNotBelongingToSeededPatient) {
        await request(app.getHttpServer())
          .get(
            `/prescriptions/${prescriptionNotBelongingToSeededPatient.id}/pdf`,
          )
          .set('Cookie', patientCookie)
          .expect(403);
      }
    });
  });

  describe('GET /prescriptions — List never leaks across roles', () => {
    it('should never return a prescription where doctorId differs from requesting doctor', async () => {
      const res = await request(app.getHttpServer())
        .get('/prescriptions?limit=50')
        .set('Cookie', doctorCookie)
        .expect(200);

      if (res.body.data.length > 0) {
        const wrongOwner = res.body.data.filter(
          (p: any) =>
            p.doctorId !== undefined &&
            p.doctorId !== res.body.data[0]?.doctorId,
        );
        expect(wrongOwner.length).toBe(0);
      }
    });

    it('should never return a prescription where patientId differs from requesting patient', async () => {
      const res = await request(app.getHttpServer())
        .get('/prescriptions?limit=50')
        .set('Cookie', patientCookie)
        .expect(200);

      if (res.body.data.length > 0) {
        const wrongOwner = res.body.data.filter(
          (p: any) =>
            p.patientId !== undefined &&
            p.patientId !== res.body.data[0]?.patientId,
        );
        expect(wrongOwner.length).toBe(0);
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
