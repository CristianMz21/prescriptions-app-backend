import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { PdfService } from '../pdf/pdf.service';
import { Role, PrescriptionStatus } from '@prisma/client';
import type { Prescription } from '@prisma/client';
import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';

// Provide a fake Response object
const mockResponse = (): Response => {
  const res: { set: jest.Mock } = { set: jest.fn() };
  res.set = jest.fn().mockReturnValue(res);
  return res as unknown as Response;
};

describe('PrescriptionsController', () => {
  let controller: PrescriptionsController;
  let prescriptionsService: jest.Mocked<PrescriptionsService>;
  let pdfService: jest.Mocked<PdfService>;

  const mockPrescription = {
    id: 'prescription-1',
    doctorId: 'doctor-1',
    patientId: 'patient-1',
    items: [],
    notes: 'Test notes',
    status: PrescriptionStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrescriptionsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOneById: jest.fn(),
      markAsConsumed: jest.fn(),
    };

    const mockPdfService = {
      generatePrescriptionPdf: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrescriptionsController],
      providers: [
        { provide: PrescriptionsService, useValue: mockPrescriptionsService },
        { provide: PdfService, useValue: mockPdfService },
      ],
    }).compile();

    controller = module.get<PrescriptionsController>(PrescriptionsController);
    prescriptionsService = module.get(PrescriptionsService);
    pdfService = module.get(PdfService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create a prescription (happy path)', async () => {
      const dto = { patientId: 'patient-1', items: [], notes: 'notes' };
      const user = {
        id: 'doctor-1',
        email: 'doctor@clinic.com',
        role: Role.DOCTOR,
      };
      prescriptionsService.create.mockResolvedValue(mockPrescription);

      const result = await controller.create(user, dto);

      expect(prescriptionsService.create).toHaveBeenCalledWith(user.id, dto);
      expect(result).toEqual(mockPrescription);
    });
  });

  describe('findAll', () => {
    it('should list prescriptions correctly paginated', async () => {
      const filterDto = { page: 1, limit: 10 };
      const user = {
        id: 'patient-1',
        email: 'patient@clinic.com',
        role: Role.PATIENT,
      };
      const expectedResult = {
        data: [mockPrescription],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      prescriptionsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(user, filterDto);

      expect(prescriptionsService.findAll).toHaveBeenCalledWith(
        user,
        filterDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should get prescription detail by id', async () => {
      const user = {
        id: 'patient-1',
        email: 'patient@clinic.com',
        role: Role.PATIENT,
      };
      prescriptionsService.findOneById.mockResolvedValue(mockPrescription);

      const result = await controller.findOne(user, mockPrescription.id);

      expect(prescriptionsService.findOneById).toHaveBeenCalledWith(
        mockPrescription.id,
        user,
      );
      expect(result).toEqual(mockPrescription);
    });
  });

  describe('markAsConsumed', () => {
    it('should mark prescription as consumed', async () => {
      const user = {
        id: 'patient-1',
        email: 'patient@clinic.com',
        role: Role.PATIENT,
      };
      const consumedPrescription = {
        ...mockPrescription,
        status: PrescriptionStatus.CONSUMED,
      };
      prescriptionsService.markAsConsumed.mockResolvedValue(
        consumedPrescription,
      );

      const result = await controller.markAsConsumed(user, mockPrescription.id);

      expect(prescriptionsService.markAsConsumed).toHaveBeenCalledWith(
        user.id,
        mockPrescription.id,
      );
      expect(result.status).toBe(PrescriptionStatus.CONSUMED);
    });
  });

  describe('downloadPdf', () => {
    it('should fetch prescription, generate PDF and return StreamableFile', async () => {
      const user = {
        id: 'patient-1',
        email: 'patient@clinic.com',
        role: Role.PATIENT,
      };
      const mockBuffer = Buffer.from('fake-pdf-content');
      const res = mockResponse();

      prescriptionsService.findOneById.mockResolvedValue(mockPrescription);
      pdfService.generatePrescriptionPdf.mockResolvedValue(mockBuffer);

      const result = await controller.downloadPdf(
        user,
        mockPrescription.id,
        res,
      );

      expect(prescriptionsService.findOneById).toHaveBeenCalledWith(
        mockPrescription.id,
        user,
      );
      expect(pdfService.generatePrescriptionPdf).toHaveBeenCalledWith(
        mockPrescription,
      );
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="prescription-${mockPrescription.id}.pdf"`,
        }),
      );
      expect(result).toBeInstanceOf(StreamableFile);
    });
  });
});
