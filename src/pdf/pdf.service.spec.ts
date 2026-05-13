import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('pdf-content')),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfService],
    }).compile();

    service = module.get<PdfService>(PdfService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePrescriptionPdf', () => {
    it('should generate a PDF buffer successfully', async () => {
      const mockPrescription = {
        id: '1',
        createdAt: new Date(),
        status: 'PENDING',
        notes: 'Notes',
        items: [{ name: 'Meds', dosage: '10mg', quantity: '1', instructions: 'Take 1' }],
        doctor: { id: 'd1', email: 'doc@c.com', role: 'DOCTOR' },
        patient: { id: 'p1', email: 'pat@c.com', role: 'PATIENT' },
      } as any;

      const result = await service.generatePrescriptionPdf(mockPrescription);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('pdf-content');
    });

    it('should throw InternalServerErrorException on error', async () => {
      const mockPrescription = {
        items: 'invalid-items-that-will-cause-handlebars-to-fail-or-puppeteer'
      } as any;

      // Mock puppeteer to throw
      const puppeteer = require('puppeteer');
      puppeteer.launch.mockRejectedValueOnce(new Error('Browser failed'));

      await expect(service.generatePrescriptionPdf(mockPrescription)).rejects.toThrow('Failed to generate PDF prescription');
    });
  });
});
