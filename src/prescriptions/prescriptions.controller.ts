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
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { PdfService, PdfPrescriptionData } from '../pdf/pdf.service';
import { PrescriptionResponseDto } from './dto/prescription-response.dto';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto';
import { PaginationMetaDto } from '../common/dto/pagination-meta.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { apiPaginatedOkResponse } from '../common/swagger/api-paginated-response.decorator';
import {
  UNAUTHORIZED_DESC,
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
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Bad Request — invalid payload or patient not found',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: FORBIDDEN_DOCTOR_DESC,
  })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createPrescriptionDto: CreatePrescriptionDto,
  ) {
    return this.prescriptionsService.create(user.id, createPrescriptionDto);
  }

  @Get()
  @ApiOperation({ summary: 'List prescriptions (Paginated)' })
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
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: BAD_REQUEST_QUERY_DESC,
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: UNAUTHORIZED_DESC,
  })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() filterDto: PaginationFilterDto,
  ) {
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
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Not Found — prescription does not exist or access forbidden',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: FORBIDDEN_PRESCRIPTION_DESC,
  })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') prescriptionId: string,
  ) {
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
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Bad Request — prescription already consumed',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description:
      'Forbidden — Patient role required or prescription does not belong to patient',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description:
      'Not Found — prescription not found or does not belong to patient',
  })
  markAsConsumed(
    @CurrentUser() user: JwtPayload,
    @Param('id') prescriptionId: string,
    @Body() dto: ConsumePrescriptionDto,
  ) {
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
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: FORBIDDEN_PRESCRIPTION_DESC,
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description:
      'Not Found — prescription not found or not authorized to download',
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

    const filenameKey =
      (prescription as unknown as { code?: string }).code ?? prescription.id;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="prescription-${filenameKey}.pdf"`,
    });

    return new StreamableFile(buffer);
  }
}
