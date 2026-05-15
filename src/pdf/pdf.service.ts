/* Copyright (c) 2026. All rights reserved. */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { launch, Browser } from 'puppeteer';
import { compile } from 'handlebars';
import { toDataURL } from 'qrcode';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface PdfPrescriptionItem {
  name: string;
  dosage: string | null;
  quantity: number | null;
  instructions: string | null;
}

export interface PdfPrescriptionData {
  id: string;
  code: string;
  createdAt: Date;
  status: string;
  notes: string | null;
  items: PdfPrescriptionItem[];
  patient: {
    user: { email: string };
  };
  author: {
    specialty?: string | null;
    medicalId?: string | null;
    signatureText?: string | null;
    signatureImageUrl?: string | null;
    user: { email: string };
  };
  qrCodeUrl?: string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(private readonly configService: ConfigService) {}

  async generatePrescriptionPdf(
    prescription: PdfPrescriptionData,
  ): Promise<Buffer> {
    let browser: Browser | null = null;

    try {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const appOrigin = this.configService.get<string>('APP_ORIGIN');
      const qrBaseUrl = frontendUrl ?? appOrigin;
      const qrPath = `/patient/prescriptions/${prescription.code}`;
      let defaultQrUrl = qrPath;
      if (qrBaseUrl) {
        defaultQrUrl = `${qrBaseUrl}${qrPath}`;
      }
      const qrData = prescription.qrCodeUrl ?? defaultQrUrl;

      const qrCodeDataUrl = await toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        margin: 1,
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      });

      // Resolve relative to the compiled service file so we don't depend on
      // process.cwd() and so the template is found whether the app runs from
      // the repo root in dev (ts-node) or from `dist/` in prod (Docker). The
      // template ships next to the compiled .js via `compilerOptions.assets`
      // in `nest-cli.json` (`**/*.hbs`).
      const templatePath = join(__dirname, 'templates', 'prescription.hbs');
      const templateContent = await readFile(templatePath, 'utf8');
      const template = compile(templateContent);

      const html = template({
        prescriptionId: prescription.id,
        code: prescription.code,
        date: prescription.createdAt.toLocaleDateString(),
        status: prescription.status,
        patientEmail: prescription.patient.user.email,
        doctorEmail: prescription.author.user.email,
        doctorSpecialty: prescription.author.specialty,
        doctorMedicalId: prescription.author.medicalId,
        doctorSignatureText: prescription.author.signatureText,
        doctorSignatureImageUrl: prescription.author.signatureImageUrl,
        items: prescription.items,
        notes: prescription.notes,
        qrCode: qrCodeDataUrl,
      });

      browser = await launch({
        headless: true,
        // `--disable-dev-shm-usage` is required in containers (Render, ECS,
        // Docker): the default /dev/shm is 64 MB and Chromium crashes when
        // it tries to allocate shared memory above that. The two sandbox
        // flags are needed because Render's container runs as a non-root
        // user without the kernel features Chromium's sandbox wants.
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
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
