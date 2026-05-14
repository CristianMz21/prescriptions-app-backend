/* Copyright (c) 2026. All rights reserved. */
import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';

@Module({
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
