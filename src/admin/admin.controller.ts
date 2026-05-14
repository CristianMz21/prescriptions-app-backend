/* Copyright (c) 2026. All rights reserved. */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiCookieAuth,
  ApiExtraModels,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { AdminMetricsDto } from './dto/admin-metrics.dto';
import { AdminListPrescriptionsDto } from './dto/admin-list-prescriptions.dto';
import { MetricsResponseDto } from './dto/metrics-response.dto';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto';
import { PaginationMetaDto } from '../common/dto/pagination-meta.dto';
import { PrescriptionResponseDto } from '../prescriptions/dto/prescription-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { apiPaginatedOkResponse } from '../common/swagger/api-paginated-response.decorator';
import {
  UNAUTHORIZED_DESC,
  FORBIDDEN_ADMIN_DESC,
  BAD_REQUEST_QUERY_DESC,
} from '../common/swagger/swagger-descriptions';

@ApiTags('Admin')
@ApiCookieAuth('accessToken')
@ApiExtraModels(PaginatedResultDto, PaginationMetaDto, PrescriptionResponseDto)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('prescriptions')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all prescriptions (Admin Only)' })
  @apiPaginatedOkResponse(
    PrescriptionResponseDto,
    'Returns paginated list of all prescriptions',
  )
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: BAD_REQUEST_QUERY_DESC,
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: FORBIDDEN_ADMIN_DESC,
  })
  listPrescriptions(@Query() filter: AdminListPrescriptionsDto) {
    return this.adminService.findAllPrescriptions(filter);
  }

  @Get('metrics')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get dashboard metrics (Admin Only)' })
  @ApiOkResponse({
    type: MetricsResponseDto,
    description: 'Returns aggregated system metrics',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Bad Request — invalid date parameters',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: FORBIDDEN_ADMIN_DESC,
  })
  getMetrics(@Query() metricsDto: AdminMetricsDto) {
    return this.adminService.getDashboardMetricsFiltered(
      metricsDto.from,
      metricsDto.to,
    );
  }
}
