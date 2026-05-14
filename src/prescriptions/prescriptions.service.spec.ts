import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionsService } from './prescriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { Role, PrescriptionStatus } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let prismaService: {
    doctor: { findUnique: jest.Mock };
    patient: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    prescription: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    prescriptionAuditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const mockPrescription = {
    id: '1',
    code: 'RX-TEST123ABC',
    authorId: 'd1',
    patientId: 'p1',
    status: PrescriptionStatus.PENDING,
    createdAt: new Date(),
    consumedAt: null,
  };

  let emailService: { sendPrescriptionCreatedEmail: jest.Mock };

  beforeEach(async () => {
    const mockPrismaService = {
      doctor: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          user: { email: 'doctor@clinic.com' },
        }),
      },
      patient: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      prescription: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      prescriptionAuditLog: { create: jest.fn() },
      $transaction: jest.fn().mockImplementation(async cb => {
        const tx = {
          prescription: { update: jest.fn() },
          prescriptionAuditLog: { create: jest.fn() },
        };
        return cb(tx);
      }),
    };
    const mockEmailService = {
      sendPrescriptionCreatedEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<PrescriptionsService>(PrescriptionsService);
    prismaService = module.get(PrismaService);
    emailService = module.get(EmailService);
  });

  describe('create', () => {
    it('should create a prescription and dispatch email', async () => {
      const created = {
        ...mockPrescription,
        items: [{ name: 'Amoxi' }],
        patient: { user: { email: 'patient@clinic.com' } },
      };
      prismaService.prescription.create.mockResolvedValue(created);
      const dto = { patientId: 'p1', items: [], notes: 'notes' };
      const result = await service.create('doctor-user-id', dto);
      expect(prismaService.doctor.findUnique).toHaveBeenCalledWith({
        where: { userId: 'doctor-user-id' },
        select: { id: true, user: { select: { email: true } } },
      });
      expect(prismaService.prescription.create).toHaveBeenCalled();
      expect(emailService.sendPrescriptionCreatedEmail).toHaveBeenCalledWith(
        'patient@clinic.com',
        expect.objectContaining({
          code: created.code,
          doctorEmail: 'doctor@clinic.com',
          itemNames: ['Amoxi'],
        }),
      );
      expect(result).toEqual(created);
    });

    it('should throw UnprocessableEntityException when patientId does not match any Patient or User', async () => {
      prismaService.patient.findUnique.mockResolvedValueOnce(null);
      prismaService.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create('doctor-user-id', {
          patientId: 'p-missing',
          items: [],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should resolve the User.id of a patient to its Patient.id transparently', async () => {
      prismaService.patient.findUnique.mockResolvedValueOnce(null);
      prismaService.user.findUnique.mockResolvedValueOnce({
        patient: { id: 'real-patient-id' },
      });
      const created = {
        ...mockPrescription,
        patientId: 'real-patient-id',
        items: [],
        patient: { user: { email: 'patient@clinic.com' } },
      };
      prismaService.prescription.create.mockResolvedValue(created);

      await service.create('doctor-user-id', {
        patientId: 'user-id-of-patient',
        items: [],
      });

      expect(prismaService.prescription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ patientId: 'real-patient-id' }),
        }),
      );
    });

    it('should include hint when the provided id is a User with no Patient profile', async () => {
      prismaService.patient.findUnique.mockResolvedValueOnce(null);
      // First call from resolvePatientId returns no patient relation
      prismaService.user.findUnique.mockResolvedValueOnce({ patient: null });
      // Second call from buildPatientNotFoundError surfaces the user details
      prismaService.user.findUnique.mockResolvedValueOnce({
        email: 'doctor@clinic.com',
        role: 'DOCTOR',
      });

      await expect(
        service.create('doctor-user-id', {
          patientId: 'doctor-user-id-by-mistake',
          items: [],
        }),
      ).rejects.toThrow(/belongs to a User.*no Patient profile/);
    });

    it('should throw UnprocessableEntityException on P2003 (race condition fallback)', async () => {
      const err = new Error('FK violation') as Error & { code: string };
      err.code = 'P2003';
      prismaService.prescription.create.mockRejectedValue(err);

      await expect(
        service.create('doctor-user-id', {
          patientId: 'p1',
          items: [],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException on P2025 (race condition fallback)', async () => {
      const err = new Error('Record not found') as Error & { code: string };
      err.code = 'P2025';
      prismaService.prescription.create.mockRejectedValue(err);

      await expect(
        service.create('doctor-user-id', {
          patientId: 'p1',
          items: [],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should rethrow unknown prisma errors from create', async () => {
      prismaService.prescription.create.mockRejectedValue(new Error('boom'));

      await expect(
        service.create('doctor-user-id', { patientId: 'p1', items: [] }),
      ).rejects.toThrow('boom');
    });

    it('should throw BadRequestException when doctor record is missing', async () => {
      prismaService.doctor.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create('orphan-user', { patientId: 'p1', items: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should list for patient', async () => {
      prismaService.prescription.findMany.mockResolvedValue([mockPrescription]);
      prismaService.prescription.count.mockResolvedValue(1);

      const result = await service.findAll(
        {
          id: 'patient-user-id',
          email: 'patient@clinic.com',
          role: Role.PATIENT,
        },
        {},
      );
      expect(prismaService.prescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patient: { userId: 'patient-user-id' } },
        }),
      );
      expect(result.data).toEqual([mockPrescription]);
    });

    it('should list for doctor', async () => {
      prismaService.prescription.findMany.mockResolvedValue([mockPrescription]);
      prismaService.prescription.count.mockResolvedValue(1);

      await service.findAll(
        { id: 'doctor-user-id', email: 'doctor@clinic.com', role: Role.DOCTOR },
        {},
      );
      expect(prismaService.prescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { author: { userId: 'doctor-user-id' } },
        }),
      );
    });

    it('should handle dates and status filter', async () => {
      prismaService.prescription.findMany.mockResolvedValue([mockPrescription]);
      prismaService.prescription.count.mockResolvedValue(1);

      await service.findAll(
        { id: 'a1', email: 'admin@clinic.com', role: Role.ADMIN },
        {
          status: PrescriptionStatus.PENDING,
          fromDate: '2023-01-01',
          toDate: '2023-12-31',
        },
      );

      expect(prismaService.prescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: PrescriptionStatus.PENDING,
            createdAt: {
              gte: new Date('2023-01-01'),
              lte: new Date('2023-12-31'),
            },
          }),
        }),
      );
    });
  });

  describe('findOneById', () => {
    it('should find one for admin without boundaries', async () => {
      prismaService.prescription.findFirst.mockResolvedValue(mockPrescription);
      const result = await service.findOneById('1', {
        id: 'a1',
        email: 'admin@clinic.com',
        role: Role.ADMIN,
      });
      expect(prismaService.prescription.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: '1' } }),
      );
      expect(result).toEqual(mockPrescription);
    });

    it('should throw if not found', async () => {
      prismaService.prescription.findFirst.mockResolvedValue(null);
      await expect(
        service.findOneById('1', {
          id: 'patient-user-id',
          email: 'patient@clinic.com',
          role: Role.PATIENT,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when patient is not the owner', async () => {
      prismaService.prescription.findFirst.mockResolvedValue({
        id: '1',
        patient: { userId: 'someone-else' },
        author: { userId: 'd1' },
      });
      await expect(
        service.findOneById('1', {
          id: 'patient-user-id',
          email: 'patient@clinic.com',
          role: Role.PATIENT,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when doctor is not the owner', async () => {
      prismaService.prescription.findFirst.mockResolvedValue({
        id: '1',
        patient: { userId: 'p1' },
        author: { userId: 'some-other-doctor' },
      });
      await expect(
        service.findOneById('1', {
          id: 'doctor-user-id',
          email: 'doctor@clinic.com',
          role: Role.DOCTOR,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markAsConsumed', () => {
    it('should update status, set consumedAt, and create audit log atomically', async () => {
      const updated = {
        ...mockPrescription,
        status: PrescriptionStatus.CONSUMED,
        consumedAt: new Date(),
      };
      prismaService.prescription.findFirst.mockResolvedValue({
        id: '1',
        status: PrescriptionStatus.PENDING,
        patient: { userId: 'patient-user-id' },
      });
      const txAuditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
      const txUpdate = jest.fn().mockResolvedValue(updated);
      prismaService.$transaction.mockImplementation(async cb =>
        cb({
          prescription: { update: txUpdate },
          prescriptionAuditLog: { create: txAuditCreate },
        }),
      );

      const result = await service.markAsConsumed('patient-user-id', '1', {
        reason: 'pharmacy pickup',
      });

      expect(txUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: expect.objectContaining({
            status: PrescriptionStatus.CONSUMED,
            consumedAt: expect.any(Date),
          }),
          include: expect.objectContaining({ items: true }),
        }),
      );
      expect(txAuditCreate).toHaveBeenCalledWith({
        data: {
          prescriptionId: '1',
          changedById: 'patient-user-id',
          fromStatus: PrescriptionStatus.PENDING,
          toStatus: PrescriptionStatus.CONSUMED,
          reason: 'pharmacy pickup',
        },
      });
      expect(result.status).toBe(PrescriptionStatus.CONSUMED);
    });

    it('should reject when prescription is already CONSUMED', async () => {
      prismaService.prescription.findFirst.mockResolvedValue({
        id: '1',
        status: PrescriptionStatus.CONSUMED,
        patient: { userId: 'patient-user-id' },
      });
      await expect(
        service.markAsConsumed('patient-user-id', '1'),
      ).rejects.toThrow(ConflictException);
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw if not owned or not found', async () => {
      prismaService.prescription.findFirst.mockResolvedValue(null);
      await expect(
        service.markAsConsumed('patient-user-id', '1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when patient does not own prescription', async () => {
      prismaService.prescription.findFirst.mockResolvedValue({
        id: '1',
        status: PrescriptionStatus.PENDING,
        patient: { userId: 'other-patient-user' },
      });
      await expect(
        service.markAsConsumed('patient-user-id', '1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll with q search', () => {
    it('should combine tenant boundary with case-insensitive OR for q', async () => {
      prismaService.prescription.findMany.mockResolvedValue([]);
      prismaService.prescription.count.mockResolvedValue(0);
      await service.findAll(
        { id: 'p-user', email: 'p@c.com', role: Role.PATIENT },
        { q: 'Amoxi' },
      );
      expect(prismaService.prescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patient: { userId: 'p-user' },
            OR: [
              { notes: { contains: 'Amoxi', mode: 'insensitive' } },
              {
                items: {
                  some: { name: { contains: 'Amoxi', mode: 'insensitive' } },
                },
              },
            ],
          }),
        }),
      );
    });
  });

  describe('findAll new filters', () => {
    const adminUser = {
      id: 'a-user',
      email: 'a@c.com',
      role: Role.ADMIN,
    } as const;

    beforeEach(() => {
      prismaService.prescription.findMany.mockResolvedValue([]);
      prismaService.prescription.count.mockResolvedValue(0);
    });

    it('should filter by consumedAt range', async () => {
      await service.findAll(adminUser, {
        consumedFromDate: '2026-01-01',
        consumedToDate: '2026-12-31',
      });
      const call = prismaService.prescription.findMany.mock.calls[0][0];
      expect(call.where.consumedAt.gte).toBeInstanceOf(Date);
      expect(call.where.consumedAt.lte).toBeInstanceOf(Date);
    });

    it('should filter by code (case-insensitive contains)', async () => {
      await service.findAll(adminUser, { code: 'RX-AB' });
      const call = prismaService.prescription.findMany.mock.calls[0][0];
      expect(call.where.code).toEqual({
        contains: 'RX-AB',
        mode: 'insensitive',
      });
    });

    it('should filter by hasNotes=true (notes is not null)', async () => {
      await service.findAll(adminUser, { hasNotes: true });
      const call = prismaService.prescription.findMany.mock.calls[0][0];
      expect(call.where.notes).toEqual({ not: null });
    });

    it('should filter by hasNotes=false (notes is null)', async () => {
      await service.findAll(adminUser, { hasNotes: false });
      const call = prismaService.prescription.findMany.mock.calls[0][0];
      expect(call.where.notes).toBeNull();
    });

    it('should accept patientId override for ADMIN', async () => {
      await service.findAll(adminUser, { patientId: 'pat-1' });
      const call = prismaService.prescription.findMany.mock.calls[0][0];
      expect(call.where.patient).toEqual({
        OR: [{ id: 'pat-1' }, { userId: 'pat-1' }],
      });
    });

    it('should silently ignore patientId override for PATIENT (tenant wins)', async () => {
      await service.findAll(
        { id: 'p-user', email: 'p@c.com', role: Role.PATIENT },
        { patientId: 'other-patient' },
      );
      const call = prismaService.prescription.findMany.mock.calls[0][0];
      // tenant boundary keeps patient.userId (own); override is dropped
      expect(call.where.patient).toEqual({ userId: 'p-user' });
    });

    it('should silently ignore authorId override for DOCTOR (tenant wins)', async () => {
      await service.findAll(
        { id: 'd-user', email: 'd@c.com', role: Role.DOCTOR },
        { authorId: 'other-doctor' },
      );
      const call = prismaService.prescription.findMany.mock.calls[0][0];
      expect(call.where.author).toEqual({ userId: 'd-user' });
    });

    it('should accept sortBy/sortOrder whitelist', async () => {
      await service.findAll(adminUser, {
        sortBy: 'consumedAt' as never,
        sortOrder: 'asc' as never,
      });
      const call = prismaService.prescription.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ consumedAt: 'asc' });
    });
  });
});
