import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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

    // Authenticate Admin
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@clinic.com', password: '***REDACTED-DEV-PASSWORD***' })
      .expect(201);
    adminCookie = extractAccessCookie(adminLogin.headers['set-cookie']);

    // Authenticate Patient
    const patientLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'patient@clinic.com', password: '***REDACTED-DEV-PASSWORD***' })
      .expect(201);
    patientCookie = extractAccessCookie(patientLogin.headers['set-cookie']);

    // Authenticate Doctor
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
          // Verify structure
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(res.body.meta.page).toEqual(1);
          expect(res.body.meta.limit).toEqual(5);
          // Verify that returned data only contains PENDING statuses
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
        items: [{ name: 'Test Med', dosage: '10mg', quantity: '30' }],
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
      // Invalid payload: missing 'items', invalid UUID for patientId
      const invalidPayload = {
        patientId: 'not-a-uuid',
      };

      return request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', doctorCookie)
        .send(invalidPayload)
        .expect(400)
        .expect((res) => {
          // Assert that class-validator error messages are present
          expect(res.body.message).toEqual(
            expect.arrayContaining([
              'patientId must be a UUID',
              'items should not be empty',
              'items must be an array',
            ]),
          );
          expect(res.body.error).toEqual('Bad Request');
        });
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
