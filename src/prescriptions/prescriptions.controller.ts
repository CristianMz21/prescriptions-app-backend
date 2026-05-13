/* Copyright (c) 2026. All rights reserved. */
import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  StreamableFile,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role, Prescription } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PaginationFilterDto } from './dto/pagination-filter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PdfService, PdfPrescriptionData } from '../pdf/pdf.service';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('Prescriptions')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(
    private readonly prescriptionsService: PrescriptionsService,
    private readonly pdfService: PdfService,
  ) {}

  @Post()
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Create a new prescription (Doctor Only)' })
  @ApiResponse({
    status: 201,
    description: 'The prescription has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid payload.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a Doctor.',
  })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createPrescriptionDto: CreatePrescriptionDto,
  ): Promise<Prescription> {
    return this.prescriptionsService.create(user.id, createPrescriptionDto);
  }

  @Get()
  @ApiOperation({ summary: 'List prescriptions (Paginated)' })
  @ApiResponse({
    status: 200,
    description:
      'Returns a paginated list of prescriptions based on user role.',
  })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() filterDto: PaginationFilterDto,
  ): Promise<{ data: Prescription[]; meta: unknown }> {
    return this.prescriptionsService.findAll(user, filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get prescription detail by ID' })
  @ApiResponse({ status: 200, description: 'Returns the prescription detail.' })
  @ApiResponse({
    status: 404,
    description:
      'Not Found - Prescription does not exist or access is forbidden.',
  })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') prescriptionId: string,
  ): Promise<Prescription> {
    return this.prescriptionsService.findOneById(prescriptionId, user);
  }

  @Patch(':id/consume')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Mark prescription as consumed (Patient Only)' })
  @ApiResponse({
    status: 200,
    description: 'The prescription status has been updated to CONSUMED.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a Patient.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Not Found - Prescription does not exist or does not belong to the patient.',
  })
  markAsConsumed(
    @CurrentUser() user: JwtPayload,
    @Param('id') prescriptionId: string,
  ): Promise<Prescription> {
    return this.prescriptionsService.markAsConsumed(user.id, prescriptionId);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download prescription PDF' })
  @ApiResponse({ status: 200, description: 'Streams the generated PDF file.' })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Not authorized to download this prescription.',
  })
  async downloadPdf(
    @CurrentUser() user: JwtPayload,
    @Param('id') prescriptionId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const prescription = await this.prescriptionsService.findOneById(
      prescriptionId,
      user,
    );

    const buffer = await this.pdfService.generatePrescriptionPdf(
      prescription as unknown as PdfPrescriptionData,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="prescription-${prescription.id}.pdf"`,
    });

    return new StreamableFile(buffer);
  }
}
