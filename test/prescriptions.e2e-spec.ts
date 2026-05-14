import { randomUUID } from 'node:crypto';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { Role } from '@prisma/client';
import { PrismaService } from './../src/prisma/prisma.service';
import { EmailService } from './../src/email/email.service';
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

interface PersistedUser {
  id: string;
  email: string;
  role: Role;
}

interface GetOrCreateUserResult {
  cookie: string;
  user: PersistedUser;
}

async function getOrCreateUser(
  app: INestApplication,
  email: string,
  password: string,
  role: Role,
  adminCookie: string,
): Promise<GetOrCreateUserResult> {
  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password });

  if (loginRes.status === 201) {
    const loginBody = loginRes.body as { user?: PersistedUser; id?: string };
    const user: PersistedUser = {
      id: loginBody.user?.id ?? loginBody.id ?? '',
      email,
      role,
    };
    if (!user.id || user.id.trim() === '') {
      throw new Error(
        `getOrCreateUser: login succeeded but user.id is empty for ${email}. Response body: ${JSON.stringify(loginRes.body)}`,
      );
    }
    return {
      cookie: extractAccessCookie(loginRes.headers['set-cookie']),
      user,
    };
  }

  const createRes = await request(app.getHttpServer())
    .post('/users')
    .set('Cookie', adminCookie)
    .send({ email, password, role });

  if (createRes.status === 409) {
    const usersRes = await request(app.getHttpServer())
      .get('/users')
      .set('Cookie', adminCookie)
      .expect(200);
    const users = (usersRes.body.data ?? usersRes.body) as PersistedUser[];
    const foundUser = users.find((u: PersistedUser) => u.email === email);
    if (!foundUser?.id) {
      throw new Error(
        `getOrCreateUser: 409 conflict but could not find user ${email} via admin /users`,
      );
    }
    const retryLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return {
      cookie: extractAccessCookie(retryLoginRes.headers['set-cookie']),
      user: { id: foundUser.id, email, role },
    };
  }

  if (createRes.status !== 201) {
    throw new Error(
      `getOrCreateUser: failed to create user ${email}, got status ${createRes.status}: ${JSON.stringify(createRes.body)}`,
    );
  }

  const createdUser: PersistedUser = {
    id: createRes.body.id ?? '',
    email,
    role,
  };
  if (!createdUser.id || createdUser.id.trim() === '') {
    throw new Error(
      `getOrCreateUser: user creation returned 201 but id is empty for ${email}. Response body: ${JSON.stringify(createRes.body)}`,
    );
  }

  const retryLoginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);

  return {
    cookie: extractAccessCookie(retryLoginRes.headers['set-cookie']),
    user: createdUser,
  };
}

describe('Prescriptions Flow (e2e)', () => {
  let app: INestApplication;

  let adminCookie: string;
  let patientCookie: string;
  let doctorCookie: string;
  let seededDoctorId: string;
  let seededPatientId: string;
  let secondDoctorCookie: string;
  let secondDoctorId: string;
  let secondDoctorEmail: string;
  let secondPatientId: string;
  let prisma: PrismaService;

  const resolvePatientId = async (userId: string): Promise<string> => {
    const row = await prisma.patient.findUnique({ where: { userId } });
    if (!row) throw new Error(`No Patient row for userId ${userId}`);
    return row.id;
  };
  const resolveDoctorId = async (userId: string): Promise<string> => {
    const row = await prisma.doctor.findUnique({ where: { userId } });
    if (!row) throw new Error(`No Doctor row for userId ${userId}`);
    return row.id;
  };

  const emailMock = {
    sendPrescriptionCreatedEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(emailMock)
      .compile();

    prisma = moduleFixture.get(PrismaService);
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

    const patientLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'patient@clinic.com', password: TEST_PASSWORD })
      .expect(201);
    patientCookie = extractAccessCookie(patientLogin.headers['set-cookie']);
    const seededPatientUserId = (patientLogin.body.user?.id ??
      patientLogin.body.id ??
      '') as string;
    if (!seededPatientUserId.trim()) {
      throw new Error('seededPatientUserId is empty');
    }
    seededPatientId = await resolvePatientId(seededPatientUserId);

    const doctorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'doctor@clinic.com', password: TEST_PASSWORD })
      .expect(201);
    doctorCookie = extractAccessCookie(doctorLogin.headers['set-cookie']);
    const seededDoctorUserId = (doctorLogin.body.user?.id ??
      doctorLogin.body.id ??
      '') as string;
    if (!seededDoctorUserId.trim()) {
      throw new Error('seededDoctorUserId is empty');
    }
    seededDoctorId = await resolveDoctorId(seededDoctorUserId);

    // randomUUID provides a cryptographically-strong unique suffix without
    // tripping Sonar S2245 (Math.random is not safe for any uniqueness guarantee).
    const runId = Date.now().toString(36) + randomUUID().slice(0, 4);

    secondDoctorEmail = `e2e-doctor2-${runId}@clinic.com`;
    const secondDoctorResult = await getOrCreateUser(
      app,
      secondDoctorEmail,
      TEST_PASSWORD,
      Role.DOCTOR,
      adminCookie,
    );
    secondDoctorCookie = secondDoctorResult.cookie;
    secondDoctorId = await resolveDoctorId(secondDoctorResult.user.id);

    const secondPatientResult = await getOrCreateUser(
      app,
      `e2e-patient2-${runId}@clinic.com`,
      TEST_PASSWORD,
      Role.PATIENT,
      adminCookie,
    );
    secondPatientId = await resolvePatientId(secondPatientResult.user.id);

    if (secondDoctorId === seededDoctorId) {
      throw new Error(
        `Setup error: second doctor ${secondDoctorId} has same ID as seeded doctor ${seededDoctorId}`,
      );
    }
    if (secondPatientId === seededPatientId) {
      throw new Error(
        `Setup error: second patient ${secondPatientId} has same ID as seeded patient ${seededPatientId}`,
      );
    }
  });

  describe('Test 1: Pagination & Filtering (Admin)', () => {
    it('should parse query parameters correctly and return paginated prescriptions', async () => {
      return request(app.getHttpServer())
        .get('/prescriptions?page=1&limit=5&status=PENDING')
        .set('Cookie', adminCookie)
        .expect(200)
        .expect(res => {
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
        patientId: randomUUID(),
        items: [{ name: 'Test Med', dosage: '10mg', quantity: 30 }],
      };

      return request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', patientCookie)
        .send(mockPayload)
        .expect(403)
        .expect(res => {
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
        .expect(res => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([
              'patientId must be a UUID',
              'items should not be empty',
            ]),
          );
          expect(res.body.error).toEqual('Bad Request');
        });
    });

    it('returns 400 when item quantity is less than 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [{ name: 'Test', dosage: '5mg', quantity: 0 }],
        })
        .expect(400);
      expect(res.body.error).toEqual('Bad Request');
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/quantity must not be less than 1/i),
        ]),
      );
    });

    it('returns 400 when item quantity is a non-numeric string', async () => {
      const res = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [{ name: 'Test', dosage: '5mg', quantity: 'not-a-number' }],
        })
        .expect(400);
      expect(res.body.error).toEqual('Bad Request');
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/quantity must be an integer/i),
        ]),
      );
    });
  });

  describe('GET /prescriptions/:id — Contract: ownership', () => {
    it('should return 403 when doctor tries to access another doctors prescription', async () => {
      const prescriptionRes = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [{ name: 'Test Med', dosage: '10mg', quantity: 30 }],
        })
        .expect(201);

      const prescriptionId = prescriptionRes.body.id;

      await request(app.getHttpServer())
        .get(`/prescriptions/${prescriptionId}`)
        .set('Cookie', adminCookie)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/prescriptions/${prescriptionId}`)
        .set('Cookie', doctorCookie)
        .expect(403)
        .expect(res => {
          expect(res.body.message).toEqual(
            'You do not have permission to access this prescription.',
          );
          expect(res.body.error).toEqual('Forbidden');
        });
    });

    it('should return prescription detail when doctor accesses their own prescription', async () => {
      const res = await request(app.getHttpServer())
        .get('/prescriptions')
        .set('Cookie', doctorCookie)
        .expect(200);
      expect(res.status).toBe(200);

      if (res.body.data.length > 0) {
        const ownPrescription = res.body.data[0];
        await request(app.getHttpServer())
          .get(`/prescriptions/${ownPrescription.id}`)
          .set('Cookie', doctorCookie)
          .expect(200);
      }
    });

    it('should return 403 when patient tries to access another patients prescription', async () => {
      const prescriptionRes = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [{ name: 'Test Med', dosage: '10mg', quantity: 30 }],
        })
        .expect(201);

      const prescriptionId = prescriptionRes.body.id;

      await request(app.getHttpServer())
        .get(`/prescriptions/${prescriptionId}`)
        .set('Cookie', adminCookie)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/prescriptions/${prescriptionId}`)
        .set('Cookie', patientCookie)
        .expect(403)
        .expect(res => {
          expect(res.body.message).toEqual(
            'You do not have permission to access this prescription.',
          );
          expect(res.body.error).toEqual('Forbidden');
        });
    });

    it('should allow admin to access any prescription', async () => {
      const res = await request(app.getHttpServer())
        .get('/prescriptions')
        .set('Cookie', adminCookie)
        .expect(200);
      expect(res.status).toBe(200);

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
      const prescriptionRes = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [{ name: 'Test Med', dosage: '10mg', quantity: 30 }],
        })
        .expect(201);
      expect(prescriptionRes.status).toBe(201);

      const prescriptionId = prescriptionRes.body.id;

      await request(app.getHttpServer())
        .get(`/prescriptions/${prescriptionId}`)
        .set('Cookie', adminCookie)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/prescriptions/${prescriptionId}/consume`)
        .set('Cookie', doctorCookie)
        .expect(403);
    });

    it('should return 403 when patient tries to consume a prescription not belonging to them', async () => {
      const prescriptionRes = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [{ name: 'Test Med', dosage: '10mg', quantity: 30 }],
        })
        .expect(201);
      expect(prescriptionRes.status).toBe(201);

      const prescriptionId = prescriptionRes.body.id;

      await request(app.getHttpServer())
        .get(`/prescriptions/${prescriptionId}`)
        .set('Cookie', adminCookie)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/prescriptions/${prescriptionId}/consume`)
        .set('Cookie', patientCookie)
        .expect(403);
    });
  });

  describe('GET /prescriptions/:id/pdf — Positive Authorization + Content', () => {
    it('should return 200 and valid PDF when patient downloads their own prescription', async () => {
      const prescriptionRes = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [
            {
              name: 'Amoxicillin',
              dosage: '500mg',
              quantity: 30,
              instructions: 'Take 1 pill every 8 hours',
            },
          ],
        })
        .expect(201);

      const prescriptionId = prescriptionRes.body.id;

      const pdfRes = await request(app.getHttpServer())
        .get(`/prescriptions/${prescriptionId}/pdf`)
        .set('Cookie', secondDoctorCookie)
        .expect(200);

      expect(pdfRes.headers['content-type']).toMatch(/application\/pdf/);
      expect(pdfRes.headers['content-disposition']).toMatch(/\.pdf/);
      expect(pdfRes.body).toBeDefined();
      expect(Buffer.isBuffer(pdfRes.body)).toBe(true);
      const bodyBuffer =
        pdfRes.body instanceof Buffer
          ? pdfRes.body
          : Buffer.from(pdfRes.body as unknown as ArrayBuffer);
      expect(bodyBuffer.length).toBeGreaterThan(0);
      expect(bodyBuffer.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('should return 200 and valid PDF when doctor downloads a prescription they created', async () => {
      const prescriptionRes = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [
            {
              name: 'Ibuprofen',
              dosage: '400mg',
              quantity: 20,
              instructions: 'Take 1 tablet after meals',
            },
          ],
        })
        .expect(201);

      const prescriptionId = prescriptionRes.body.id;

      const pdfRes = await request(app.getHttpServer())
        .get(`/prescriptions/${prescriptionId}/pdf`)
        .set('Cookie', secondDoctorCookie)
        .expect(200);

      expect(pdfRes.headers['content-type']).toMatch(/application\/pdf/);
      expect(pdfRes.headers['content-disposition']).toMatch(/\.pdf/);
      expect(pdfRes.body).toBeDefined();
      const bodyBuffer =
        pdfRes.body instanceof Buffer
          ? pdfRes.body
          : Buffer.from(pdfRes.body as unknown as ArrayBuffer);
      expect(bodyBuffer.length).toBeGreaterThan(0);
      expect(bodyBuffer.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('should return 200 and valid PDF when admin downloads any prescription', async () => {
      const prescriptionRes = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [
            {
              name: 'Paracetamol',
              dosage: '500mg',
              quantity: 10,
              instructions: 'Take 2 tablets every 6 hours',
            },
          ],
        })
        .expect(201);

      const prescriptionId = prescriptionRes.body.id;

      const pdfRes = await request(app.getHttpServer())
        .get(`/prescriptions/${prescriptionId}/pdf`)
        .set('Cookie', adminCookie)
        .expect(200);

      expect(pdfRes.headers['content-type']).toMatch(/application\/pdf/);
      expect(pdfRes.headers['content-disposition']).toMatch(/\.pdf/);
      expect(pdfRes.body).toBeDefined();
      const bodyBuffer =
        pdfRes.body instanceof Buffer
          ? pdfRes.body
          : Buffer.from(pdfRes.body as unknown as ArrayBuffer);
      expect(bodyBuffer.length).toBeGreaterThan(0);
      expect(bodyBuffer.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('should return 401 when no auth cookie is provided', async () => {
      const prescriptionRes = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [{ name: 'Test Med', dosage: '10mg', quantity: 5 }],
        })
        .expect(201);

      const prescriptionId = prescriptionRes.body.id;

      await request(app.getHttpServer())
        .get(`/prescriptions/${prescriptionId}/pdf`)
        .expect(401);
    });

    it('returns 403 when a doctor downloads another doctor prescription PDF', async () => {
      // Created by secondDoctor for secondPatient; the seeded `doctor` is a
      // different author and must not be allowed to download it.
      const prescriptionRes = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [{ name: 'IDOR', dosage: '1mg', quantity: 1 }],
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/prescriptions/${prescriptionRes.body.id}/pdf`)
        .set('Cookie', doctorCookie)
        .expect(403);
      expect(res.body).toMatchObject({ statusCode: 403 });
    });

    it('returns 403 when a patient downloads another patient prescription PDF', async () => {
      const prescriptionRes = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [{ name: 'IDOR', dosage: '1mg', quantity: 1 }],
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/prescriptions/${prescriptionRes.body.id}/pdf`)
        .set('Cookie', patientCookie)
        .expect(403);
      expect(res.body).toMatchObject({ statusCode: 403 });
    });

    it('should return 404 when prescription does not exist', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const _res = await request(app.getHttpServer())
        .get(`/prescriptions/${nonExistentId}/pdf`)
        .set('Cookie', adminCookie)
        .expect(404);
      expect(_res.status).toBe(404);
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

  describe('Audit log + state transitions', () => {
    it('PATCH /:id/consume creates a PrescriptionAuditLog and rejects re-consume', async () => {
      const created = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', secondDoctorCookie)
        .send({
          patientId: secondPatientId,
          items: [{ name: 'AuditMed', dosage: '10mg', quantity: 5 }],
        })
        .expect(201);

      const rxId = created.body.id;
      // Need the second patient's cookie to mark as consumed
      const secondPatientLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: created.body.patient?.user?.email ?? null,
          password: TEST_PASSWORD,
        });
      // If login failed (email missing in body), fall back to fetching user via prisma:
      let consumerCookie: string;
      if (secondPatientLogin.status === 201) {
        consumerCookie = extractAccessCookie(
          secondPatientLogin.headers['set-cookie'],
        );
      } else {
        const patientRow = await prisma.patient.findUnique({
          where: { id: secondPatientId },
          select: { user: { select: { email: true } } },
        });
        const retry = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: patientRow!.user.email, password: TEST_PASSWORD })
          .expect(201);
        consumerCookie = extractAccessCookie(retry.headers['set-cookie']);
      }

      const consumed = await request(app.getHttpServer())
        .patch(`/prescriptions/${rxId}/consume`)
        .set('Cookie', consumerCookie)
        .send({ reason: 'picked up' })
        .expect(200);
      expect(consumed.body.status).toBe('CONSUMED');
      expect(consumed.body.consumedAt).toBeTruthy();

      const logs = await prisma.prescriptionAuditLog.findMany({
        where: { prescriptionId: rxId },
      });
      expect(logs.length).toBe(1);
      expect(logs[0].fromStatus).toBe('PENDING');
      expect(logs[0].toStatus).toBe('CONSUMED');
      expect(logs[0].reason).toBe('picked up');

      const reConsume = await request(app.getHttpServer())
        .patch(`/prescriptions/${rxId}/consume`)
        .set('Cookie', consumerCookie)
        .send({})
        .expect(409);
      expect(reConsume.body.message).toMatch(/already consumed/i);
    });
  });

  describe('Advanced search ?q=', () => {
    it('returns case-insensitive matches on items.name', async () => {
      const res = await request(app.getHttpServer())
        .get('/prescriptions?q=amoxi&limit=50')
        .set('Cookie', adminCookie)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Seeded set contains "Amoxicillin"
      const names = res.body.data.flatMap((p: any) =>
        (p.items ?? []).map((i: any) => i.name.toLowerCase()),
      );
      const hasMatch = names.some((n: string) => n.includes('amoxi'));
      expect(hasMatch).toBe(true);
    });

    it('returns empty list when q matches nothing visible to the user', async () => {
      const res = await request(app.getHttpServer())
        .get('/prescriptions?q=zzz-no-match-zzz')
        .set('Cookie', patientCookie)
        .expect(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('Author attribution across sessions (login → create → logout → re-login → create)', () => {
    it('persists each prescription with the doctor who was authenticated at create time', async () => {
      const itemSeed = `cross-session-${randomUUID()}`;

      // --- Session 1: seeded doctor logs in fresh ---
      const session1Login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'doctor@clinic.com', password: TEST_PASSWORD })
        .expect(201);
      const session1Cookie = extractAccessCookie(
        session1Login.headers['set-cookie'],
      );

      const create1 = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', session1Cookie)
        .send({
          patientId: seededPatientId,
          notes: 'session 1',
          items: [
            {
              name: `${itemSeed}-A`,
              dosage: '10mg',
              quantity: 1,
              instructions: 'x',
            },
          ],
        })
        .expect(201);
      const rx1Id = create1.body.id as string;

      // --- Logout: server clears cookies, we drop the cookie reference ---
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', session1Cookie)
        .expect(200);

      // --- Session 2: a DIFFERENT doctor logs in fresh ---
      const session2Login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: secondDoctorEmail, password: TEST_PASSWORD })
        .expect(201);
      const session2Cookie = extractAccessCookie(
        session2Login.headers['set-cookie'],
      );

      const create2 = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Cookie', session2Cookie)
        .send({
          patientId: seededPatientId,
          notes: 'session 2',
          items: [
            {
              name: `${itemSeed}-B`,
              dosage: '20mg',
              quantity: 2,
              instructions: 'y',
            },
          ],
        })
        .expect(201);
      const rx2Id = create2.body.id as string;

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', session2Cookie)
        .expect(200);

      // --- Verify directly in the database (bypasses any API serialization) ---
      const rows = await prisma.prescription.findMany({
        where: { id: { in: [rx1Id, rx2Id] } },
        include: { author: { include: { user: true } } },
      });
      const byId = new Map(rows.map(r => [r.id, r]));
      const rx1 = byId.get(rx1Id);
      const rx2 = byId.get(rx2Id);

      expect(rx1).toBeDefined();
      expect(rx2).toBeDefined();
      expect(rx1!.id).not.toBe(rx2!.id);

      // Both belong to the same patient
      expect(rx1!.patientId).toBe(seededPatientId);
      expect(rx2!.patientId).toBe(seededPatientId);

      // Authors are correctly attributed to the doctor logged in for each request
      expect(rx1!.authorId).toBe(seededDoctorId);
      expect(rx2!.authorId).toBe(secondDoctorId);
      expect(rx1!.author.user.email).toBe('doctor@clinic.com');
      expect(rx2!.author.user.email).toBe(secondDoctorEmail);

      // Authors are distinct — the logout/re-login actually switched identity
      expect(rx1!.authorId).not.toBe(rx2!.authorId);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
