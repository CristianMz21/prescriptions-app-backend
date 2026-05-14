import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionsService } from './prescriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role, PrescriptionStatus } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let prismaService: {
    prescription: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  const mockPrescription = {
    id: '1',
    doctorId: 'd1',
    patientId: 'p1',
    status: PrescriptionStatus.PENDING,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      prescription: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PrescriptionsService>(PrescriptionsService);
    prismaService = module.get(PrismaService);
  });

  describe('create', () => {
    it('should create a prescription', async () => {
      prismaService.prescription.create.mockResolvedValue(mockPrescription);
      const dto = { patientId: 'p1', items: [], notes: 'notes' };
      const result = await service.create('d1', dto);
      expect(prismaService.prescription.create).toHaveBeenCalled();
      expect(result).toEqual(mockPrescription);
    });

    it('should throw BadRequestException on P2003 (foreign key)', async () => {
      const err = new Error('FK violation') as Error & { code: string };
      err.code = 'P2003';
      prismaService.prescription.create.mockRejectedValue(err);

      await expect(
        service.create('d1', { patientId: 'p-missing', items: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on P2025 (record not found)', async () => {
      const err = new Error('Record not found') as Error & { code: string };
      err.code = 'P2025';
      prismaService.prescription.create.mockRejectedValue(err);

      await expect(
        service.create('d1', { patientId: 'p-missing', items: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rethrow unknown prisma errors from create', async () => {
      prismaService.prescription.create.mockRejectedValue(new Error('boom'));

      await expect(
        service.create('d1', { patientId: 'p1', items: [] }),
      ).rejects.toThrow('boom');
    });
  });

  describe('findAll', () => {
    it('should list for patient', async () => {
      prismaService.prescription.findMany.mockResolvedValue([mockPrescription]);
      prismaService.prescription.count.mockResolvedValue(1);

      const result = await service.findAll(
        { id: 'p1', email: 'patient@clinic.com', role: Role.PATIENT },
        {},
      );
      expect(prismaService.prescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patientId: 'p1' } }),
      );
      expect(result.data).toEqual([mockPrescription]);
    });

    it('should list for doctor', async () => {
      prismaService.prescription.findMany.mockResolvedValue([mockPrescription]);
      prismaService.prescription.count.mockResolvedValue(1);

      const result = await service.findAll(
        { id: 'd1', email: 'doctor@clinic.com', role: Role.DOCTOR },
        {},
      );
      expect(prismaService.prescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { doctorId: 'd1' } }),
      );
    });

    it('should handle dates and status filter', async () => {
      prismaService.prescription.findMany.mockResolvedValue([mockPrescription]);
      prismaService.prescription.count.mockResolvedValue(1);

      const result = await service.findAll(
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
          id: 'p1',
          email: 'patient@clinic.com',
          role: Role.PATIENT,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when patient is not the owner', async () => {
      prismaService.prescription.findFirst.mockResolvedValue({
        id: '1',
        patientId: 'someone-else',
        doctorId: 'd1',
      });
      await expect(
        service.findOneById('1', {
          id: 'p1',
          email: 'patient@clinic.com',
          role: Role.PATIENT,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when doctor is not the owner', async () => {
      prismaService.prescription.findFirst.mockResolvedValue({
        id: '1',
        patientId: 'p1',
        doctorId: 'some-other-doctor',
      });
      await expect(
        service.findOneById('1', {
          id: 'd1',
          email: 'doctor@clinic.com',
          role: Role.DOCTOR,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markAsConsumed', () => {
    it('should update status if owned', async () => {
      prismaService.prescription.findFirst.mockResolvedValue(mockPrescription);
      prismaService.prescription.update.mockResolvedValue({
        ...mockPrescription,
        status: PrescriptionStatus.CONSUMED,
      });

      const result = await service.markAsConsumed('p1', '1');
      expect(prismaService.prescription.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: PrescriptionStatus.CONSUMED },
        include: { items: true },
      });
      expect(result.status).toBe(PrescriptionStatus.CONSUMED);
    });

    it('should throw if not owned or not found', async () => {
      prismaService.prescription.findFirst.mockResolvedValue(null);
      await expect(service.markAsConsumed('p1', '1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when patient does not own prescription', async () => {
      prismaService.prescription.findFirst.mockResolvedValue({
        id: '1',
        patientId: 'other-patient',
      });
      await expect(service.markAsConsumed('p1', '1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
