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
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiQuery,
} from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PaginationFilterDto } from './dto/pagination-filter.dto';
import { ConsumePrescriptionDto } from './dto/consume-prescription.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PdfService } from '../pdf/pdf.service';
import { PrescriptionResponseDto } from './dto/prescription-response.dto';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto';
import { PaginationMetaDto } from '../common/dto/pagination-meta.dto';
import { apiPaginatedOkResponse } from '../common/swagger/api-paginated-response.decorator';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';
import {
  BAD_REQUEST_QUERY_DESC,
  FORBIDDEN_DOCTOR_DESC,
} from '../common/swagger/swagger-descriptions';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

const FORBIDDEN_PRESCRIPTION_DESC =
  'Forbidden — you do not have access to this prescription';
const PRESCRIPTION_ID_PARAM_DESC = 'Prescription ID (UUID v4)';

@ApiTags('Prescriptions')
@ApiCookieAuth('accessToken')
@ApiExtraModels(PaginatedResultDto, PaginationMetaDto, PrescriptionResponseDto)
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
  @ApiCreatedResponse({
    type: PrescriptionResponseDto,
    description: 'Prescription created successfully',
  })
  @ApiStandardErrors({
    400: 'Bad Request — invalid payload (DTO validation failed)',
    401: true,
    403: FORBIDDEN_DOCTOR_DESC,
    422: 'Unprocessable Entity — payload is well-formed but the referenced patientId does not exist',
  })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createPrescriptionDto: CreatePrescriptionDto,
  ): ReturnType<PrescriptionsService['create']> {
    return this.prescriptionsService.create(user.id, createPrescriptionDto);
  }

  @Get()
  @ApiOperation({
    summary:
      'List prescriptions (Paginated). Role-scoped: Doctor sees own authored, Patient sees own received, Admin sees all.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Case-insensitive substring match against prescription notes and item names. Role-based visibility is preserved.',
  })
  @apiPaginatedOkResponse(
    PrescriptionResponseDto,
    'Returns paginated list of prescriptions based on user role',
  )
  @ApiStandardErrors({
    400: BAD_REQUEST_QUERY_DESC,
    401: true,
  })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() filterDto: PaginationFilterDto,
  ): ReturnType<PrescriptionsService['findAll']> {
    return this.prescriptionsService.findAll(user, filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get prescription detail by ID' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: PRESCRIPTION_ID_PARAM_DESC,
  })
  @ApiOkResponse({
    type: PrescriptionResponseDto,
    description: 'Returns the prescription detail',
  })
  @ApiStandardErrors({
    401: true,
    403: FORBIDDEN_PRESCRIPTION_DESC,
    404: 'Not Found — prescription does not exist or access forbidden',
  })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') prescriptionId: string,
  ): ReturnType<PrescriptionsService['findOneById']> {
    return this.prescriptionsService.findOneById(prescriptionId, user);
  }

  @Patch(':id/consume')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Mark prescription as consumed (Patient Only)' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: PRESCRIPTION_ID_PARAM_DESC,
  })
  @ApiOkResponse({
    type: PrescriptionResponseDto,
    description: 'Prescription status updated to CONSUMED',
  })
  @ApiStandardErrors({
    401: true,
    403: 'Forbidden — Patient role required or prescription does not belong to patient',
    404: 'Not Found — prescription not found or does not belong to patient',
    409: 'Conflict — prescription has already been consumed',
  })
  markAsConsumed(
    @CurrentUser() user: JwtPayload,
    @Param('id') prescriptionId: string,
    @Body() dto: ConsumePrescriptionDto,
  ): ReturnType<PrescriptionsService['markAsConsumed']> {
    return this.prescriptionsService.markAsConsumed(
      user.id,
      prescriptionId,
      dto,
    );
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download prescription PDF' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: PRESCRIPTION_ID_PARAM_DESC,
  })
  @ApiResponse({
    status: 200,
    description: 'Streams the generated PDF file',
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiStandardErrors({
    401: true,
    403: FORBIDDEN_PRESCRIPTION_DESC,
    404: 'Not Found — prescription not found or not authorized to download',
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

    const buffer = await this.pdfService.generatePrescriptionPdf(prescription);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="prescription-${prescription.code}.pdf"`,
    });

    return new StreamableFile(buffer);
  }
}
