/* Copyright (c) 2026. All rights reserved. */
import { Injectable, BadRequestException } from '@nestjs/common';
import { Role, PrescriptionStatus, Prisma, Prescription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminListPrescriptionsDto } from './dto/admin-list-prescriptions.dto';
import { PrescriptionSortBy } from '../prescriptions/dto/pagination-filter.dto';
import {
  caseInsensitiveContains,
  dateRangeFilter,
  toPrismaSort,
} from '../common/utils/filter.utils';

export interface AggregateMetrics {
  totals: { doctors: number; patients: number; prescriptions: number };
  byStatus: { pending: number; consumed: number };
  byDay: Array<{ date: string; count: number }>;
}

export interface MetricsStreamSnapshot {
  totals: { doctors: number; patients: number; prescriptions: number };
  byStatus: { pending: number; consumed: number };
  timestamp: string;
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

  async getStreamSnapshot(): Promise<MetricsStreamSnapshot> {
    const [
      doctorsCount,
      patientsCount,
      totalPrescriptions,
      pendingPrescriptions,
      consumedPrescriptions,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.DOCTOR } }),
      this.prisma.user.count({ where: { role: Role.PATIENT } }),
      this.prisma.prescription.count(),
      this.prisma.prescription.count({
        where: { status: PrescriptionStatus.PENDING },
      }),
      this.prisma.prescription.count({
        where: { status: PrescriptionStatus.CONSUMED },
      }),
    ]);
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
      timestamp: new Date().toISOString(),
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
      topDoctors: Array<{ authorId: string; count: number }>;
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
      this.prisma.$queryRaw<Array<{ authorId: string; count: bigint }>>`
        SELECT "authorId", COUNT(*) as count
        FROM "Prescription"
        WHERE "createdAt" >= ${fromDate}
        AND "createdAt" <= ${toDate}
        GROUP BY "authorId"
        ORDER BY count DESC
        LIMIT 5;
      `,
    ]);

    const topDoctors = topDoctorsRaw.map(row => ({
      authorId: row.authorId,
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
      authorId,
      patientId,
      fromDate,
      toDate,
      consumedFromDate,
      consumedToDate,
      code,
      hasNotes,
      patientEmail,
      doctorEmail,
      q,
      sortBy = PrescriptionSortBy.CreatedAt,
      sortOrder,
    } = filter;

    const where = this.buildDateRangeWhere(fromDate, toDate);
    if (status) {
      where.status = status;
    }
    if (authorId) {
      where.authorId = authorId;
    }
    if (patientId) {
      where.patientId = patientId;
    }

    const consumedAtFilter = dateRangeFilter(consumedFromDate, consumedToDate);
    if (consumedAtFilter) where.consumedAt = consumedAtFilter;

    const codeFilter = caseInsensitiveContains(code);
    if (codeFilter) where.code = codeFilter;

    if (typeof hasNotes === 'boolean') {
      where.notes = hasNotes ? { not: null } : null;
    }

    const patientEmailFilter = caseInsensitiveContains(patientEmail);
    if (patientEmailFilter) {
      where.patient = { user: { email: patientEmailFilter } };
    }

    const doctorEmailFilter = caseInsensitiveContains(doctorEmail);
    if (doctorEmailFilter) {
      where.author = { user: { email: doctorEmailFilter } };
    }

    if (q && q.trim().length > 0) {
      const term = q.trim();
      where.OR = [
        { notes: { contains: term, mode: 'insensitive' } },
        { items: { some: { name: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const orderBy: Prisma.PrescriptionOrderByWithRelationInput = {
      [sortBy]: toPrismaSort(sortOrder),
    };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
