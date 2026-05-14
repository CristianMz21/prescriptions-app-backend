/* Copyright (c) 2026. All rights reserved. */
import { Module } from '@nestjs/common';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfModule } from '../pdf/pdf.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PdfModule, EmailModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService, PrismaService],
})
export class PrescriptionsModule {}
