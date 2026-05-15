import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { Prescription, PrescriptionStatus } from '@prisma/client';
import { AdminController } from './admin.controller';
import { AdminService, AggregateMetrics } from './admin.service';
import { AdminListPrescriptionsDto } from './dto/admin-list-prescriptions.dto';

type FilteredMetrics = AggregateMetrics & {
  topDoctors: Array<{ authorId: string; count: number }>;
};

const emptyFilteredMetrics = (): FilteredMetrics => ({
  totals: { doctors: 0, patients: 0, prescriptions: 0 },
  byStatus: { pending: 0, consumed: 0 },
  byDay: [],
  topDoctors: [],
});

const makePrescription = (id: string): Prescription => ({
  id,
  code: `RX-${id.toUpperCase()}`,
  status: PrescriptionStatus.PENDING,
  notes: null,
  createdAt: new Date('2026-01-15T00:00:00Z'),
  updatedAt: new Date('2026-01-15T00:00:00Z'),
  consumedAt: null,
  expiryDate: null,
  authorId: 'doctor-1',
  patientId: 'patient-1',
});

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: jest.Mocked<AdminService>;

  beforeEach(async () => {
    const mockAdminService = {
      getDashboardMetrics: jest.fn(),
      getDashboardMetricsFiltered: jest.fn(),
      findAllPrescriptions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: mockAdminService }],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMetrics', () => {
    it('should call adminService.getDashboardMetricsFiltered with from/to params', async () => {
      const mockMetrics = emptyFilteredMetrics();
      adminService.getDashboardMetricsFiltered.mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics({
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(adminService.getDashboardMetricsFiltered).toHaveBeenCalledWith(
        '2026-01-01',
        '2026-01-31',
      );
      expect(result).toEqual(mockMetrics);
    });

    it('should call adminService.getDashboardMetricsFiltered without params', async () => {
      const mockMetrics = emptyFilteredMetrics();
      adminService.getDashboardMetricsFiltered.mockResolvedValue(mockMetrics);

      await controller.getMetrics({});

      expect(adminService.getDashboardMetricsFiltered).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });
  });

  describe('listPrescriptions', () => {
    it('should call adminService.findAllPrescriptions with filter', async () => {
      const mockResult = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      adminService.findAllPrescriptions.mockResolvedValue(mockResult);

      const filter: AdminListPrescriptionsDto = {
        page: 2,
        limit: 5,
        status: PrescriptionStatus.PENDING,
      };
      const result = await controller.listPrescriptions(filter);

      expect(adminService.findAllPrescriptions).toHaveBeenCalledWith(filter);
      expect(result).toEqual(mockResult);
    });

    it('should return paginated prescriptions', async () => {
      const mockResult = {
        data: [makePrescription('p1'), makePrescription('p2')],
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      };
      adminService.findAllPrescriptions.mockResolvedValue(mockResult);

      const result = await controller.listPrescriptions({});

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });
});
