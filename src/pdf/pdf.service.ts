/* Copyright (c) 2026. All rights reserved. */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { launch, Browser } from 'puppeteer';
import { compile } from 'handlebars';
import { toDataURL } from 'qrcode';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface PdfPrescriptionData {
  id: string;
  createdAt: Date;
  status: string;
  notes: string | null;
  items: unknown;
  patient: {
    email: string;
  };
  doctor: {
    email: string;
  };
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generatePrescriptionPdf(
    prescription: PdfPrescriptionData,
  ): Promise<Buffer> {
    let browser: Browser | null = null;

    try {
      const qrCodeDataUrl = await toDataURL(prescription.id, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        margin: 1,
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      });

      const templatePath = join(
        process.cwd(),
        'src/pdf/templates/prescription.hbs',
      );
      const templateContent = await readFile(templatePath, 'utf8');
      const template = compile(templateContent);

      const html = template({
        prescriptionId: prescription.id,
        date: prescription.createdAt.toLocaleDateString(),
        status: prescription.status,
        patientEmail: prescription.patient.email,
        doctorEmail: prescription.doctor.email,
        items: prescription.items,
        notes: prescription.notes,
        qrCode: qrCodeDataUrl,
      });

      browser = await launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
      });

      return Buffer.from(pdfUint8Array);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Error generating PDF: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          'An unknown error occurred while generating PDF',
          String(error),
        );
      }
      throw new InternalServerErrorException(
        'Failed to generate PDF prescription',
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
