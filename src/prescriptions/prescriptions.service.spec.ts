import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionsService } from './prescriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role, PrescriptionStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  prescription: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PrescriptionsService>(PrescriptionsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should pass where: { patientId: user.id } to Prisma when user is a PATIENT', async () => {
      const mockUser = { id: 'patient-123', role: Role.PATIENT };
      const filterDto = { page: 1, limit: 10 };

      mockPrismaService.prescription.findMany.mockResolvedValue([]);
      mockPrismaService.prescription.count.mockResolvedValue(0);

      await service.findAll(mockUser, filterDto);

      // Verify Prisma findMany was called with correct scope
      expect(prisma.prescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: 'patient-123',
          }),
        }),
      );
    });
  });

  describe('markAsConsumed (IDOR Prevention)', () => {
    it('should throw NotFoundException if prescription does not exist or patientId does not match (IDOR attempt)', async () => {
      const mockPatientId = 'patient-123';
      const mockPrescriptionId = 'prescription-456';

      // Mock Prisma to return null, simulating an IDOR attempt where a patient tries to consume someone else's prescription
      mockPrismaService.prescription.findFirst.mockResolvedValue(null);

      await expect(service.markAsConsumed(mockPatientId, mockPrescriptionId))
        .rejects
        .toThrow(NotFoundException);

      // Ensure we passed both ID and patientId to the lookup query
      expect(prisma.prescription.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockPrescriptionId,
          patientId: mockPatientId, // CRUCIAL: IDOR Protection boundary
        },
      });
      // Ensure update is never called
      expect(prisma.prescription.update).not.toHaveBeenCalled();
    });

    it('should successfully update status if patientId matches', async () => {
      const mockPatientId = 'patient-123';
      const mockPrescriptionId = 'prescription-456';
      
      const mockPrescription = {
        id: mockPrescriptionId,
        patientId: mockPatientId,
        status: PrescriptionStatus.PENDING,
      };

      mockPrismaService.prescription.findFirst.mockResolvedValue(mockPrescription);
      mockPrismaService.prescription.update.mockResolvedValue({ ...mockPrescription, status: PrescriptionStatus.CONSUMED });

      const result = await service.markAsConsumed(mockPatientId, mockPrescriptionId);

      expect(result.status).toEqual(PrescriptionStatus.CONSUMED);
      expect(prisma.prescription.update).toHaveBeenCalledWith({
        where: { id: mockPrescriptionId },
        data: { status: PrescriptionStatus.CONSUMED },
      });
    });
  });
});
