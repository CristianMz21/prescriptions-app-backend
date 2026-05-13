/* Copyright (c) 2026. All rights reserved. */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Role, PrescriptionStatus, Prescription, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PaginationFilterDto } from './dto/pagination-filter.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

const isPrismaError = (
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Error && 'code' in err;

@Injectable()
export class PrescriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    doctorId: string,
    createPrescriptionDto: CreatePrescriptionDto,
  ): Promise<Prescription> {
    try {
      return await this.prisma.prescription.create({
        data: {
          doctorId,
          patientId: createPrescriptionDto.patientId,
          items:
            createPrescriptionDto.items as unknown as Prisma.InputJsonValue,
          notes: createPrescriptionDto.notes,
          status: PrescriptionStatus.PENDING,
        },
      });
    } catch (err: unknown) {
      if (
        isPrismaError(err) &&
        (err.code === 'P2003' || err.code === 'P2025')
      ) {
        throw new BadRequestException(
          'Patient not found. Please provide a valid patient ID.',
        );
      }
      throw err;
    }
  }

  async findAll(
    user: JwtPayload,
    filterDto: PaginationFilterDto,
  ): Promise<{ data: Prescription[]; meta: unknown }> {
    const { page = 1, limit = 10, status, fromDate, toDate } = filterDto;
    const skip = (page - 1) * limit;

    const where: Prisma.PrescriptionWhereInput = {};

    // IDOR BOUNDARY ENFORCEMENT AT DATABASE LEVEL
    if (user.role === Role.PATIENT) {
      where.patientId = user.id;
    } else if (user.role === Role.DOCTOR) {
      where.doctorId = user.id;
    }
    // ADMIN has no tenant restrictions

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate)
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(fromDate);
      if (toDate)
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(toDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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

  async findOneById(id: string, user: JwtPayload): Promise<Prescription> {
    const where: Prisma.PrescriptionWhereInput = { id };

    // Enforce IDOR boundaries directly in the database query
    if (user.role === Role.PATIENT) {
      where.patientId = user.id;
    } else if (user.role === Role.DOCTOR) {
      where.doctorId = user.id;
    }

    // Use findFirst instead of findUnique because we are using non-unique fields (patientId/doctorId)
    const prescription = await this.prisma.prescription.findFirst({
      where,
      include: {
        doctor: { select: { id: true, email: true, role: true } },
        patient: { select: { id: true, email: true, role: true } },
      },
    });

    if (!prescription) {
      throw new NotFoundException(
        'Prescription not found or you do not have permission to access it.',
      );
    }

    return prescription;
  }

  async markAsConsumed(
    patientId: string,
    prescriptionId: string,
  ): Promise<Prescription> {
    // Enforce ownership directly in the Prisma query using a compound where clause
    // Do NOT fetch the record first and check the ID in memory.
    const prescription = await this.prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        patientId,
      },
    });

    if (!prescription) {
      throw new NotFoundException(
        'Prescription not found or does not belong to you.',
      );
    }

    return this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: PrescriptionStatus.CONSUMED,
      },
    });
  }
}
