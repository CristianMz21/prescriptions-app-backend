import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('metrics')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get dashboard metrics (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Returns aggregated system metrics.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User is not an Admin.' })
  getMetrics() {
    return this.adminService.getDashboardMetrics();
  }
}
