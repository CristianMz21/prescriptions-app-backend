/* Copyright (c) 2026. All rights reserved. */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Role, PrescriptionStatus, Prescription, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PaginationFilterDto } from './dto/pagination-filter.dto';
import { ConsumePrescriptionDto } from './dto/consume-prescription.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { generatePrescriptionCode } from '../common/utils/code.utils';
import { EmailService } from '../email/email.service';

const isPrismaError = (
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Error && 'code' in err;

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(
    doctorUserId: string,
    createPrescriptionDto: CreatePrescriptionDto,
  ): Promise<Prescription> {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId: doctorUserId },
      select: { id: true, user: { select: { email: true } } },
    });
    if (!doctor) {
      throw new BadRequestException(
        'Authenticated user has no associated Doctor record.',
      );
    }
    let prescription: Prescription & {
      items: { name: string }[];
      patient: { user: { email: string } };
    };
    try {
      prescription = await this.prisma.prescription.create({
        data: {
          code: generatePrescriptionCode(),
          authorId: doctor.id,
          patientId: createPrescriptionDto.patientId,
          notes: createPrescriptionDto.notes,
          status: PrescriptionStatus.PENDING,
          items: {
            create: createPrescriptionDto.items.map(item => ({
              name: item.name,
              dosage: item.dosage,
              quantity: item.quantity,
              instructions: item.instructions,
            })),
          },
        },
        include: {
          items: true,
          patient: {
            select: { user: { select: { email: true } } },
          },
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

    // Fire-and-forget patient notification. Failures never block the response.
    this.emailService
      .sendPrescriptionCreatedEmail(prescription.patient.user.email, {
        code: prescription.code,
        doctorEmail: doctor.user.email,
        itemNames: prescription.items.map(item => item.name),
      })
      .catch(err => {
        this.logger.warn(
          `Prescription email dispatch unexpectedly threw: ${String(err)}`,
        );
      });

    return prescription;
  }

  private applyTenantBoundary(
    where: Prisma.PrescriptionWhereInput,
    user: JwtPayload,
  ): void {
    if (user.role === Role.PATIENT) {
      where.patient = { userId: user.id };
    } else if (user.role === Role.DOCTOR) {
      where.author = { userId: user.id };
    }
    // ADMIN: no tenant restrictions
  }

  async findAll(
    user: JwtPayload,
    filterDto: PaginationFilterDto,
  ): Promise<{
    data: Prescription[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { page = 1, limit = 10, status, fromDate, toDate, q } = filterDto;
    const skip = (page - 1) * limit;

    const where: Prisma.PrescriptionWhereInput = {};
    this.applyTenantBoundary(where, user);

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(fromDate);
      }
      if (toDate) {
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(toDate);
      }
    }

    if (q && q.trim().length > 0) {
      const term = q.trim();
      where.OR = [
        { notes: { contains: term, mode: 'insensitive' } },
        { items: { some: { name: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
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

  private async getOwnershipCheck(
    id: string,
    user: JwtPayload,
  ): Promise<{ exists: boolean; belongsToUser: boolean }> {
    const raw = await this.prisma.prescription.findFirst({
      where: { id },
      select: {
        id: true,
        author: { select: { userId: true } },
        patient: { select: { userId: true } },
      },
    });
    if (!raw) {
      return { exists: false, belongsToUser: false };
    }
    if (user.role === Role.ADMIN) {
      return { exists: true, belongsToUser: true };
    }
    if (user.role === Role.PATIENT) {
      return { exists: true, belongsToUser: raw.patient.userId === user.id };
    }
    if (user.role === Role.DOCTOR) {
      return { exists: true, belongsToUser: raw.author.userId === user.id };
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

    const where: Prisma.PrescriptionWhereInput = { id };
    this.applyTenantBoundary(where, user);

    const prescription = await this.prisma.prescription.findFirst({
      where,
      include: {
        author: {
          include: {
            user: { select: { id: true, email: true, role: true } },
          },
        },
        patient: {
          include: {
            user: { select: { id: true, email: true, role: true } },
          },
        },
        items: true,
      },
    });

    return prescription as Prescription;
  }

  async markAsConsumed(
    patientUserId: string,
    prescriptionId: string,
    dto?: ConsumePrescriptionDto,
  ): Promise<Prescription> {
    const raw = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId },
      select: {
        id: true,
        status: true,
        patient: { select: { userId: true } },
      },
    });

    if (!raw) {
      throw new NotFoundException(
        'Prescription not found or does not belong to you.',
      );
    }

    if (raw.patient.userId !== patientUserId) {
      throw new ForbiddenException(
        'You do not have permission to access this prescription.',
      );
    }

    if (raw.status === PrescriptionStatus.CONSUMED) {
      throw new BadRequestException('Prescription already consumed');
    }

    return this.prisma.$transaction(async tx => {
      const updated = await tx.prescription.update({
        where: { id: prescriptionId },
        data: {
          status: PrescriptionStatus.CONSUMED,
          consumedAt: new Date(),
        },
        include: { items: true },
      });

      await tx.prescriptionAuditLog.create({
        data: {
          prescriptionId,
          changedById: patientUserId,
          fromStatus: raw.status,
          toStatus: PrescriptionStatus.CONSUMED,
          reason: dto?.reason ?? null,
        },
      });

      return updated;
    });
  }
}
