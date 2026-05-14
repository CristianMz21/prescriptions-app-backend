/* Copyright (c) 2026. All rights reserved. */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const sendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail })),
}));

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildService = async (
    env: Record<string, string | undefined>,
  ): Promise<EmailService> => {
    const mockConfig = {
      get: jest.fn((key: string) => env[key]),
      getOrThrow: jest.fn((key: string) => {
        const value = env[key];
        if (!value) {
          throw new Error(`missing ${key}`);
        }
        return value;
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    return module.get(EmailService);
  };

  it('logs a warning and skips delivery when SMTP_HOST is not configured', async () => {
    const service = await buildService({});
    await service.sendPrescriptionCreatedEmail('patient@clinic.com', {
      code: 'RX-AAA',
      doctorEmail: 'doc@c.com',
      itemNames: ['Amoxi'],
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends mail via nodemailer when SMTP_HOST is configured', async () => {
    sendMail.mockResolvedValueOnce({ messageId: 'mid' });
    const service = await buildService({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      SMTP_FROM: 'no-reply@clinic.com',
    });
    await service.sendPrescriptionCreatedEmail('patient@clinic.com', {
      code: 'RX-BBB',
      doctorEmail: 'doc@c.com',
      itemNames: ['Ibuprofen'],
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'no-reply@clinic.com',
        to: 'patient@clinic.com',
        subject: expect.stringContaining('RX-BBB'),
      }),
    );
  });

  it('swallows nodemailer errors so the API call never fails', async () => {
    sendMail.mockRejectedValueOnce(new Error('SMTP down'));
    const service = await buildService({
      SMTP_HOST: 'smtp.example.com',
    });
    await expect(
      service.sendPrescriptionCreatedEmail('patient@clinic.com', {
        code: 'RX-CCC',
        doctorEmail: 'doc@c.com',
        itemNames: [],
      }),
    ).resolves.toBeUndefined();
  });
});
