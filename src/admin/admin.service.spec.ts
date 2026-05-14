import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role, PrescriptionStatus } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;
  let prismaService: {
    user: { count: jest.Mock };
    prescription: { count: jest.Mock; findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: { count: jest.fn() },
      prescription: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardMetrics', () => {
    it('should aggregate and return dashboard metrics', async () => {
      prismaService.user.count.mockImplementation(async args => {
        if (args?.where?.role === Role.DOCTOR) return 5;
        if (args?.where?.role === Role.PATIENT) return 20;
        return 0;
      });

      prismaService.prescription.count.mockImplementation(async args => {
        if (args?.where?.status === PrescriptionStatus.PENDING) return 10;
        if (args?.where?.status === PrescriptionStatus.CONSUMED) return 15;
        if (!args?.where?.status) return 25;
        return 0;
      });

      prismaService.prescription.findMany.mockResolvedValue([
        { id: '1', createdAt: new Date('2023-01-01T10:00:00Z') } as any,
        { id: '2', createdAt: new Date('2023-01-01T12:00:00Z') } as any,
        { id: '3', createdAt: new Date('2023-01-02T10:00:00Z') } as any,
      ]);

      prismaService.$queryRaw.mockResolvedValue([
        { date: new Date('2023-01-01'), count: BigInt(2) },
        { date: new Date('2023-01-02'), count: BigInt(1) },
      ]);

      const result = await service.getDashboardMetrics();

      expect(result.totals.doctors).toBe(5);
      expect(result.totals.patients).toBe(20);
      expect(result.totals.prescriptions).toBe(25);
      expect(result.byStatus.pending).toBe(10);
      expect(result.byStatus.consumed).toBe(15);
      expect(result.byDay).toEqual([
        { date: '2023-01-01', count: 2 },
        { date: '2023-01-02', count: 1 },
      ]);
    });
  });

  describe('getDashboardMetricsFiltered', () => {
    beforeEach(() => {
      prismaService.user.count.mockResolvedValue(3);
      prismaService.prescription.count.mockResolvedValue(7);
      prismaService.$queryRaw
        .mockResolvedValueOnce([
          { date: new Date('2026-01-01'), count: BigInt(2) },
        ])
        .mockResolvedValueOnce([
          { authorId: 'doctor-1', count: BigInt(5) },
          { authorId: 'doctor-2', count: BigInt(3) },
        ]);
    });

    it('should return metrics with no filter (open-ended date range)', async () => {
      const result = await service.getDashboardMetricsFiltered();

      expect(result.totals.doctors).toBe(3);
      expect(result.byDay).toEqual([{ date: '2026-01-01', count: 2 }]);
      expect(result.topDoctors).toEqual([
        { authorId: 'doctor-1', count: 5 },
        { authorId: 'doctor-2', count: 3 },
      ]);
    });

    it('should apply both from and to date filters', async () => {
      const result = await service.getDashboardMetricsFiltered(
        '2026-01-01',
        '2026-01-31',
      );

      expect(result.totals.doctors).toBe(3);
      expect(prismaService.prescription.count).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: expect.any(Date), lte: expect.any(Date) },
        },
      });
    });

    it('should throw BadRequestException for invalid from date', async () => {
      await expect(
        service.getDashboardMetricsFiltered('not-a-date'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid to date', async () => {
      await expect(
        service.getDashboardMetricsFiltered(undefined, 'still-not-a-date'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllPrescriptions', () => {
    const mockPrescription = {
      id: 'rx-1',
      doctorId: 'doctor-1',
      patientId: 'patient-1',
      status: PrescriptionStatus.PENDING,
      items: [],
      notes: null,
      createdAt: new Date('2026-01-15'),
      updatedAt: new Date('2026-01-15'),
    };

    it('should return paginated data with defaults when no filter given', async () => {
      prismaService.prescription.findMany.mockResolvedValue([
        mockPrescription as any,
      ]);
      prismaService.prescription.count.mockResolvedValue(1);

      const result = await service.findAllPrescriptions({});

      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(prismaService.prescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it('should apply status, authorId, patientId, and date filters', async () => {
      prismaService.prescription.findMany.mockResolvedValue([]);
      prismaService.prescription.count.mockResolvedValue(0);

      await service.findAllPrescriptions({
        page: 2,
        limit: 5,
        status: PrescriptionStatus.CONSUMED,
        authorId: 'doctor-9',
        patientId: 'patient-9',
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(prismaService.prescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: PrescriptionStatus.CONSUMED,
            authorId: 'doctor-9',
            patientId: 'patient-9',
            createdAt: { gte: expect.any(Date), lte: expect.any(Date) },
          },
          skip: 5,
          take: 5,
        }),
      );
    });

    it('should throw BadRequestException for invalid from in findAllPrescriptions', async () => {
      await expect(
        service.findAllPrescriptions({ from: 'invalid-date' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid to in findAllPrescriptions', async () => {
      await expect(
        service.findAllPrescriptions({ to: 'invalid-date' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
