/* Copyright (c) 2026. All rights reserved. */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
  ): Promise<{
    data: Prescription[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
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

  private buildOwnershipWhere(
    id: string,
    user: JwtPayload,
  ): Prisma.PrescriptionWhereInput {
    const base: Prisma.PrescriptionWhereInput = { id };
    if (user.role === Role.PATIENT) {
      base.patientId = user.id;
    } else if (user.role === Role.DOCTOR) {
      base.doctorId = user.id;
    }
    return base;
  }

  private async getOwnershipCheck(
    id: string,
    user: JwtPayload,
  ): Promise<{ exists: boolean; belongsToUser: boolean }> {
    const raw = await this.prisma.prescription.findFirst({
      where: { id },
      select: { id: true, patientId: true, doctorId: true },
    });
    if (!raw) {
      return { exists: false, belongsToUser: false };
    }
    if (user.role === Role.ADMIN) {
      return { exists: true, belongsToUser: true };
    }
    if (user.role === Role.PATIENT) {
      return { exists: true, belongsToUser: raw.patientId === user.id };
    }
    if (user.role === Role.DOCTOR) {
      return { exists: true, belongsToUser: raw.doctorId === user.id };
    }
    return { exists: true, belongsToUser: false };
  }

  async findOneById(id: string, user: JwtPayload): Promise<Prescription> {
    const { exists, belongsToUser } = await this.getOwnershipCheck(id, user);
    if (!exists) {
      throw new NotFoundException(
        'Prescription not found or you do not have permission to access it.',
      );
    }
    if (!belongsToUser) {
      throw new ForbiddenException(
        'You do not have permission to access this prescription.',
      );
    }

    const prescription = await this.prisma.prescription.findFirst({
      where: this.buildOwnershipWhere(id, user),
      include: {
        doctor: { select: { id: true, email: true, role: true } },
        patient: { select: { id: true, email: true, role: true } },
      },
    });

    return prescription as Prescription;
  }

  async markAsConsumed(
    patientId: string,
    prescriptionId: string,
  ): Promise<Prescription> {
    const raw = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId },
      select: { id: true, patientId: true },
    });

    if (!raw) {
      throw new NotFoundException(
        'Prescription not found or does not belong to you.',
      );
    }

    if (raw.patientId !== patientId) {
      throw new ForbiddenException(
        'You do not have permission to access this prescription.',
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
