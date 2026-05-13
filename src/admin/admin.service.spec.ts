import { Test, TestingModule } from '@nestjs/testing';
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
      prismaService.user.count.mockImplementation(async (args) => {
        if (args?.where?.role === Role.DOCTOR) return 5;
        if (args?.where?.role === Role.PATIENT) return 20;
        return 0;
      });

      prismaService.prescription.count.mockImplementation(async (args) => {
        if (args?.where?.status === PrescriptionStatus.PENDING) return 10;
        if (args?.where?.status === PrescriptionStatus.CONSUMED) return 15;
        if (!args?.where) return 25;
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
});
