/* Copyright (c) 2026. All rights reserved. */
import { Injectable, BadRequestException } from '@nestjs/common';
import { Role, PrescriptionStatus, Prisma, Prescription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminListPrescriptionsDto } from './dto/admin-list-prescriptions.dto';

export interface AggregateMetrics {
  totals: { doctors: number; patients: number; prescriptions: number };
  byStatus: { pending: number; consumed: number };
  byDay: Array<{ date: string; count: number }>;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDate(value: string, label: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${label} date`);
    }
    return parsed;
  }

  private parseOptionalDate(value: string | undefined, fallback: Date): Date {
    if (!value) {
      return fallback;
    }
    return new Date(value);
  }

  private buildDateRangeWhere(
    from?: string,
    to?: string,
  ): Prisma.PrescriptionWhereInput {
    const where: Prisma.PrescriptionWhereInput = {};
    if (from || to) {
      where.createdAt = {};
      if (from) {
        (where.createdAt as Prisma.DateTimeFilter).gte = this.parseDate(
          from,
          'from',
        );
      }
      if (to) {
        (where.createdAt as Prisma.DateTimeFilter).lte = this.parseDate(
          to,
          'to',
        );
      }
    }
    return where;
  }

  private async fetchAggregateMetrics(
    where: Prisma.PrescriptionWhereInput,
    byDayQuery: Promise<Array<{ date: Date; count: bigint }>>,
  ): Promise<AggregateMetrics> {
    const [
      doctorsCount,
      patientsCount,
      totalPrescriptions,
      pendingPrescriptions,
      consumedPrescriptions,
      byDayRaw,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.DOCTOR } }),
      this.prisma.user.count({ where: { role: Role.PATIENT } }),
      this.prisma.prescription.count({ where }),
      this.prisma.prescription.count({
        where: { ...where, status: PrescriptionStatus.PENDING },
      }),
      this.prisma.prescription.count({
        where: { ...where, status: PrescriptionStatus.CONSUMED },
      }),
      byDayQuery,
    ]);

    const byDay = byDayRaw.map(row => ({
      date: row.date.toISOString().split('T')[0],
      count: Number(row.count),
    }));

    return {
      totals: {
        doctors: doctorsCount,
        patients: patientsCount,
        prescriptions: totalPrescriptions,
      },
      byStatus: {
        pending: pendingPrescriptions,
        consumed: consumedPrescriptions,
      },
      byDay,
    };
  }

  async getDashboardMetrics(): Promise<AggregateMetrics> {
    const byDayQuery = this.prisma.$queryRaw<
      Array<{ date: Date; count: bigint }>
    >`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(id) as count
      FROM "Prescription"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC;
    `;
    return this.fetchAggregateMetrics({}, byDayQuery);
  }

  async getDashboardMetricsFiltered(
    from?: string,
    to?: string,
  ): Promise<
    AggregateMetrics & {
      topDoctors: Array<{ doctorId: string; count: number }>;
    }
  > {
    const where = this.buildDateRangeWhere(from, to);
    const fromDate = this.parseOptionalDate(from, new Date('1970-01-01'));
    const toDate = this.parseOptionalDate(to, new Date('2100-01-01'));

    const byDayQuery = this.prisma.$queryRaw<
      Array<{ date: Date; count: bigint }>
    >`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(id) as count
      FROM "Prescription"
      WHERE "createdAt" >= ${fromDate}
      AND "createdAt" <= ${toDate}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC;
    `;

    const [base, topDoctorsRaw] = await Promise.all([
      this.fetchAggregateMetrics(where, byDayQuery),
      this.prisma.$queryRaw<Array<{ doctorId: string; count: bigint }>>`
        SELECT "doctorId", COUNT(*) as count
        FROM "Prescription"
        WHERE "createdAt" >= ${fromDate}
        AND "createdAt" <= ${toDate}
        GROUP BY "doctorId"
        ORDER BY count DESC
        LIMIT 5;
      `,
    ]);

    const topDoctors = topDoctorsRaw.map(row => ({
      doctorId: row.doctorId,
      count: Number(row.count),
    }));

    return { ...base, topDoctors };
  }

  async findAllPrescriptions(filter: AdminListPrescriptionsDto): Promise<{
    data: Prescription[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const {
      page = 1,
      limit = 10,
      status,
      doctorId,
      patientId,
      from,
      to,
    } = filter;

    const where = this.buildDateRangeWhere(from, to);
    if (status) {
      where.status = status;
    }
    if (doctorId) {
      where.doctorId = doctorId;
    }
    if (patientId) {
      where.patientId = patientId;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          doctor: { select: { id: true, email: true, role: true } },
          patient: { select: { id: true, email: true, role: true } },
          items: true,
        },
      }),
      this.prisma.prescription.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
