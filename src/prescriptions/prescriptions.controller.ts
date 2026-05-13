import { Controller, Post, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PaginationFilterDto } from './dto/pagination-filter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  /**
   * DOCTOR ONLY: Creates a new prescription.
   */
  @Post()
  @Roles(Role.DOCTOR)
  create(@CurrentUser() user: any, @Body() createPrescriptionDto: CreatePrescriptionDto) {
    // We pass the authenticated doctor's ID securely from the JWT payload
    return this.prescriptionsService.create(user.id, createPrescriptionDto);
  }

  /**
   * MULTI-ROLE: Lists prescriptions. 
   * The Service layer manages data scoping (IDOR prevention) based on the user's role.
   */
  @Get()
  // No @Roles() decorator means any authenticated role (Admin, Doctor, Patient) can access it
  findAll(@CurrentUser() user: any, @Query() filterDto: PaginationFilterDto) {
    return this.prescriptionsService.findAll(user, filterDto);
  }

  /**
   * PATIENT ONLY: Updates the status of a specific prescription to CONSUMED.
   */
  @Patch(':id/consume')
  @Roles(Role.PATIENT)
  markAsConsumed(@CurrentUser() user: any, @Param('id') prescriptionId: string) {
    // We pass the authenticated patient's ID to the service to enforce ownership
    return this.prescriptionsService.markAsConsumed(user.id, prescriptionId);
  }
}
