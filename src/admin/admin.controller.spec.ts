import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: jest.Mocked<AdminService>;

  beforeEach(async () => {
    const mockAdminService = {
      getDashboardMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMetrics', () => {
    it('should call adminService.getDashboardMetrics', async () => {
      const mockMetrics = { totals: { users: 0 } } as any;
      adminService.getDashboardMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(adminService.getDashboardMetrics).toHaveBeenCalled();
      expect(result).toEqual(mockMetrics);
    });
  });
});
