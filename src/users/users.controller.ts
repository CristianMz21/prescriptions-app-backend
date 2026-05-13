import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('patients')
  @Roles(Role.ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'List all patients (Admin/Doctor Only)' })
  @ApiResponse({ status: 200, description: 'Returns a list of all patients.' })
  findAllPatients() {
    return this.usersService.findAllByRole(Role.PATIENT);
  }

  @Get('doctors')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all doctors (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Returns a list of all doctors.' })
  findAllDoctors() {
    return this.usersService.findAllByRole(Role.DOCTOR);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Get user detail by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
