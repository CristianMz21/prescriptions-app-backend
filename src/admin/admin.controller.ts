import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { AdminMetricsDto } from './dto/admin-metrics.dto';
import { AdminListPrescriptionsDto } from './dto/admin-list-prescriptions.dto';

@ApiTags('Admin')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('prescriptions')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all prescriptions (Admin Only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: 'PENDING',
    enumName: 'PrescriptionStatus',
  })
  @ApiQuery({ name: 'doctorId', required: false, type: String })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of all prescriptions.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin role required.' })
  listPrescriptions(@Query() filter: AdminListPrescriptionsDto) {
    return this.adminService.findAllPrescriptions(filter);
  }

  @Get('metrics')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get dashboard metrics (Admin Only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns aggregated system metrics.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin role required.' })
  getMetrics(@Query() metricsDto: AdminMetricsDto) {
    return this.adminService.getDashboardMetricsFiltered(
      metricsDto.from,
      metricsDto.to,
    );
  }
}
