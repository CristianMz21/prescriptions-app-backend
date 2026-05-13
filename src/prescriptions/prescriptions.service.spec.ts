import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionsService } from './prescriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role, PrescriptionStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let prismaService: jest.Mocked<PrismaService>;

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
    prismaService = module.get(PrismaService) as any;
  });

  describe('create', () => {
    it('should create a prescription', async () => {
      prismaService.prescription.create.mockResolvedValue(mockPrescription as any);
      const dto = { patientId: 'p1', items: [], notes: 'notes' };
      const result = await service.create('d1', dto);
      expect(prismaService.prescription.create).toHaveBeenCalled();
      expect(result).toEqual(mockPrescription);
    });
  });

  describe('findAll', () => {
    it('should list for patient', async () => {
      prismaService.prescription.findMany.mockResolvedValue([mockPrescription] as any);
      prismaService.prescription.count.mockResolvedValue(1);
      
      const result = await service.findAll({ id: 'p1', role: Role.PATIENT }, {});
      expect(prismaService.prescription.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { patientId: 'p1' } }));
      expect(result.data).toEqual([mockPrescription]);
    });

    it('should list for doctor', async () => {
      prismaService.prescription.findMany.mockResolvedValue([mockPrescription] as any);
      prismaService.prescription.count.mockResolvedValue(1);
      
      const result = await service.findAll({ id: 'd1', role: Role.DOCTOR }, {});
      expect(prismaService.prescription.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { doctorId: 'd1' } }));
    });

    it('should handle dates and status filter', async () => {
      prismaService.prescription.findMany.mockResolvedValue([mockPrescription] as any);
      prismaService.prescription.count.mockResolvedValue(1);
      
      const result = await service.findAll(
        { id: 'a1', role: Role.ADMIN }, 
        { status: PrescriptionStatus.PENDING, fromDate: '2023-01-01', toDate: '2023-12-31' }
      );
      
      expect(prismaService.prescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: PrescriptionStatus.PENDING,
            createdAt: { gte: new Date('2023-01-01'), lte: new Date('2023-12-31') }
          })
        })
      );
    });
  });

  describe('findOneById', () => {
    it('should find one for admin without boundaries', async () => {
      prismaService.prescription.findFirst.mockResolvedValue(mockPrescription as any);
      const result = await service.findOneById('1', { id: 'a1', role: Role.ADMIN });
      expect(prismaService.prescription.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: '1' } }));
      expect(result).toEqual(mockPrescription);
    });

    it('should throw if not found', async () => {
      prismaService.prescription.findFirst.mockResolvedValue(null);
      await expect(service.findOneById('1', { id: 'p1', role: Role.PATIENT })).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsConsumed', () => {
    it('should update status if owned', async () => {
      prismaService.prescription.findFirst.mockResolvedValue(mockPrescription as any);
      prismaService.prescription.update.mockResolvedValue({ ...mockPrescription, status: PrescriptionStatus.CONSUMED } as any);

      const result = await service.markAsConsumed('p1', '1');
      expect(prismaService.prescription.update).toHaveBeenCalledWith({ where: { id: '1' }, data: { status: PrescriptionStatus.CONSUMED } });
      expect(result.status).toBe(PrescriptionStatus.CONSUMED);
    });

    it('should throw if not owned or not found', async () => {
      prismaService.prescription.findFirst.mockResolvedValue(null);
      await expect(service.markAsConsumed('p1', '1')).rejects.toThrow(NotFoundException);
    });
  });
});
