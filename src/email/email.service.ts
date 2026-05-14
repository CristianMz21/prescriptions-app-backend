/* Copyright (c) 2026. All rights reserved. */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface PrescriptionEmailPayload {
  code: string;
  doctorEmail: string;
  itemNames: string[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly enabled: boolean;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    this.fromAddress =
      this.configService.get<string>('SMTP_FROM') ?? 'no-reply@clinic.local';
    this.enabled = Boolean(host);
    if (!this.enabled) {
      this.logger.warn(
        'SMTP_HOST is not configured. Email notifications are disabled (no-op mode).',
      );
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }
    const host = this.configService.getOrThrow<string>('SMTP_HOST');
    const portRaw = this.configService.get<string>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const port = portRaw ? Number(portRaw) : 587;
    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.transporter;
  }

  async sendPrescriptionCreatedEmail(
    to: string,
    payload: PrescriptionEmailPayload,
  ): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(
        `Skipped prescription email to ${to} (SMTP disabled). Code=${payload.code}`,
      );
      return;
    }
    try {
      const subject = `New prescription ${payload.code} from your doctor`;
      const items = payload.itemNames.length
        ? `\n\nMedications:\n- ${payload.itemNames.join('\n- ')}`
        : '';
      const text =
        `You have a new prescription (code ${payload.code}) issued by ${payload.doctorEmail}.${items}\n\n` +
        `Please log in to the clinic portal to review the details.`;
      await this.getTransporter().sendMail({
        from: this.fromAddress,
        to,
        subject,
        text,
      });
      this.logger.log(
        `Sent prescription email to ${to} (code=${payload.code})`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to send prescription email to ${to}: ${message}`,
      );
    }
  }
}
