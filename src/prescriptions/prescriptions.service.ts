import { Injectable, NotFoundException } from '@nestjs/common';
import { Role, PrescriptionStatus } from '@prisma/client';
// Assuming a global PrismaService exists to interact with the database.
import { PrismaService } from '../prisma/prisma.service'; 
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PaginationFilterDto } from './dto/pagination-filter.dto';

@Injectable()
export class PrescriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new prescription.
   * Assumes validation of Doctor existence is handled upstream or naturally via FK constraint.
   */
  async create(doctorId: string, createPrescriptionDto: CreatePrescriptionDto) {
    return this.prisma.prescription.create({
      data: {
        doctorId,
        patientId: createPrescriptionDto.patientId,
        // Cast to 'any' is necessary to satisfy Prisma's Json wrapper for structured arrays
        items: createPrescriptionDto.items as any,
        notes: createPrescriptionDto.notes,
        status: PrescriptionStatus.PENDING,
      },
    });
  }

  /**
   * Retrieves a paginated list of prescriptions.
   * CRITICAL: Implements IDOR prevention by strictly scoping the 'where' clause 
   * based on the authenticated user's role and ID.
   */
  async findAll(user: any, filterDto: PaginationFilterDto) {
    const { page = 1, limit = 10, status, fromDate, toDate } = filterDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    // ------------------------------------------------------------------
    // IDOR BOUNDARY ENFORCEMENT
    // ------------------------------------------------------------------
    if (user.role === Role.PATIENT) {
      where.patientId = user.id; // Patients only see their own prescriptions
    } else if (user.role === Role.DOCTOR) {
      where.doctorId = user.id; // Doctors only see prescriptions they issued
    }
    // If ADMIN, 'where' remains unscoped to User ID, allowing them to see all

    // Apply optional filters
    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    // Execute queries concurrently for better performance
    const [data, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }, // Newest first
      }),
      this.prisma.prescription.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves a specific prescription by ID, including relations.
   */
  async findOneById(id: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        doctor: { select: { id: true, email: true, role: true } },
        patient: { select: { id: true, email: true, role: true } }
      }
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found.');
    }

    return prescription;
  }

  /**
   * Marks a specific prescription as consumed.
   * CRITICAL: Re-verifies ownership in the query to prevent IDOR manipulation via the :id param.
   */
  async markAsConsumed(patientId: string, prescriptionId: string) {
    // 1. Fetch to verify existence AND ownership
    const prescription = await this.prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        patientId, // Critical boundary check
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found or does not belong to you.');
    }

    // 2. Update state
    return this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: PrescriptionStatus.CONSUMED,
      },
    });
  }
}
