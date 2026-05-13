import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as QRCode from 'qrcode';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class PdfService {
  /**
   * Generates a PDF buffer for a given prescription.
   * Compiles Handlebars template, generates QR code, and runs Puppeteer.
   */
  async generatePrescriptionPdf(prescription: any): Promise<Buffer> {
    let browser: puppeteer.Browser | null = null;
    try {
      // 1. Generate QR Code as base64 string
      // The QR code contains the unique ID of the prescription for verification.
      const qrCodeDataUrl = await QRCode.toDataURL(prescription.id, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        margin: 1,
        color: {
          dark: '#111827', // Matching the premium dark tone of the template
          light: '#ffffff'
        }
      });

      // 2. Read Handlebars template
      const templatePath = path.join(process.cwd(), 'src/pdf/templates/prescription.hbs');
      const templateContent = await fs.readFile(templatePath, 'utf8');

      // 3. Compile template
      const template = handlebars.compile(templateContent);
      
      // Inject data into template
      const html = template({
        prescriptionId: prescription.id,
        date: prescription.createdAt.toLocaleDateString(),
        status: prescription.status,
        patientEmail: prescription.patient.email,
        doctorEmail: prescription.doctor.email,
        items: prescription.items,
        notes: prescription.notes,
        qrCode: qrCodeDataUrl
      });

      // 4. Launch headless Puppeteer browser
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Recommended for containerized environments
      });

      const page = await browser.newPage();
      
      // Set the HTML content
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // 5. Generate PDF
      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true, // Ensures CSS background colors/borders are printed
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });

      // return Buffer from Uint8Array
      return Buffer.from(pdfUint8Array);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new InternalServerErrorException('Failed to generate PDF prescription');
    } finally {
      // 6. Robust cleanup: Ensure browser is closed to prevent memory leaks
      if (browser) {
        await browser.close();
      }
    }
  }
}
