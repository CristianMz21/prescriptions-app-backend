import { Controller, Post, Get, Patch, Param, Body, Query, UseGuards, ForbiddenException, StreamableFile, Res } from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PaginationFilterDto } from './dto/pagination-filter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PdfService } from '../pdf/pdf.service';

@ApiTags('Prescriptions')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(
    private readonly prescriptionsService: PrescriptionsService,
    private readonly pdfService: PdfService
  ) {}

  /**
   * DOCTOR ONLY: Creates a new prescription.
   */
  @Post()
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Create a new prescription (Doctor Only)' })
  @ApiResponse({ status: 201, description: 'The prescription has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid payload.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User is not a Doctor.' })
  create(@CurrentUser() user: any, @Body() createPrescriptionDto: CreatePrescriptionDto) {
    // We pass the authenticated doctor's ID securely from the JWT payload
    return this.prescriptionsService.create(user.id, createPrescriptionDto);
  }

  /**
   * MULTI-ROLE: Lists prescriptions. 
   * The Service layer manages data scoping (IDOR prevention) based on the user's role.
   */
  @Get()
  @ApiOperation({ summary: 'List prescriptions (Paginated)' })
  @ApiResponse({ status: 200, description: 'Returns a paginated list of prescriptions based on user role.' })
  // No @Roles() decorator means any authenticated role (Admin, Doctor, Patient) can access it
  findAll(@CurrentUser() user: any, @Query() filterDto: PaginationFilterDto) {
    return this.prescriptionsService.findAll(user, filterDto);
  }

  /**
   * PATIENT ONLY: Updates the status of a specific prescription to CONSUMED.
   */
  @Patch(':id/consume')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Mark prescription as consumed (Patient Only)' })
  @ApiResponse({ status: 200, description: 'The prescription status has been updated to CONSUMED.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User is not a Patient.' })
  @ApiResponse({ status: 404, description: 'Not Found - Prescription does not exist or does not belong to the patient.' })
  markAsConsumed(@CurrentUser() user: any, @Param('id') prescriptionId: string) {
    // We pass the authenticated patient's ID to the service to enforce ownership
    return this.prescriptionsService.markAsConsumed(user.id, prescriptionId);
  }

  /**
   * PATIENT ONLY: Downloads the prescription as a securely generated PDF.
   */
  @Get(':id/pdf')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Download prescription PDF (Patient Only)' })
  @ApiResponse({ status: 200, description: 'Streams the generated PDF file.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized to download this prescription.' })
  async downloadPdf(
    @CurrentUser() user: any, 
    @Param('id') prescriptionId: string,
    @Res({ passthrough: true }) res: Response
  ) {
    // 1. Fetch the full prescription record (includes doctor and patient relations)
    const prescription = await this.prescriptionsService.findOneById(prescriptionId);

    // 2. CRITICAL IDOR CHECK: Re-verify that the fetched prescription's patientId matches the @CurrentUser()'s ID
    if (prescription.patientId !== user.id) {
      throw new ForbiddenException('You are not authorized to download this prescription.');
    }

    // 3. Pass data to the PdfService to generate buffer
    const buffer = await this.pdfService.generatePrescriptionPdf(prescription);

    // 4. Set correct response headers for PDF stream
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="prescription-${prescription.id}.pdf"`,
    });

    // 5. Return StreamableFile
    return new StreamableFile(buffer);
  }
}
