/* Copyright (c) 2026. All rights reserved. */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { SMTP_DEFAULT_PORT, SMTP_SECURE_PORT } from '../common/constants';

export interface PrescriptionEmailPayload {
  code: string;
  doctorEmail: string;
  itemNames: string[];
}

const DEFAULT_FROM_ADDRESS = 'no-reply@clinic.local';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly enabled: boolean;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const fromOverride = this.configService.get<string>('SMTP_FROM');
    this.fromAddress = fromOverride ?? DEFAULT_FROM_ADDRESS;
    this.enabled = Boolean(host);
    if (!this.enabled) {
      this.logger.warn(
        'SMTP_HOST is not configured. Email notifications are disabled (no-op mode).',
      );
    }
  }

  private resolvePort(rawValue: string | undefined): number {
    if (!rawValue) {
      return SMTP_DEFAULT_PORT;
    }
    return Number(rawValue);
  }

  private buildAuth(
    user: string | undefined,
    pass: string | undefined,
  ): { user: string; pass: string } | undefined {
    if (!user || !pass) {
      return undefined;
    }
    return { user, pass };
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }
    const host = this.configService.getOrThrow<string>('SMTP_HOST');
    const portRaw = this.configService.get<string>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const port = this.resolvePort(portRaw);
    this.transporter = createTransport({
      host,
      port,
      secure: port === SMTP_SECURE_PORT,
      auth: this.buildAuth(user, pass),
    });
    return this.transporter;
  }

  private formatItemList(itemNames: string[]): string {
    if (itemNames.length === 0) {
      return '';
    }
    return `\n\nMedications:\n- ${itemNames.join('\n- ')}`;
  }

  private formatErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
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
      const itemList = this.formatItemList(payload.itemNames);
      const text =
        `You have a new prescription (code ${payload.code}) issued by ${payload.doctorEmail}.${itemList}\n\n` +
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
      this.logger.error(
        `Failed to send prescription email to ${to}: ${this.formatErrorMessage(err)}`,
      );
    }
  }
}
