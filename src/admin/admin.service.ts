import { Injectable, BadRequestException } from '@nestjs/common';
import { Role, PrescriptionStatus, Prisma, Prescription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminListPrescriptionsDto } from './dto/admin-list-prescriptions.dto';

/**
 * Servicio de Administración.
 *
 * Provee métricas agregadas para el dashboard administrativo:
 * - Conteo de doctores, pacientes y prescripciones totales
 * - Conteo por status (pending/consumed)
 * - Serie temporal de prescripciones por día (últimos 30 días)
 *
 * @security Solo accesible por usuarios con rol ADMIN.
 *          El RolesGuard valida el rol antes de invocar cualquier método.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Agrega métricas globales del sistema para el dashboard admin.
   *
   * @returns Objeto con:
   *   - totals: contadores de doctores, pacientes y prescripciones
   *   - byStatus: contadores de prescripciones por estado (pending/consumed)
   *   - byDay: array de objetos { date, count } con prescripciones por día (últimos 30 días)
   *
   * @performance
   * - Conteos simples se ejecutan en paralelo (Promise.all)
   * - Serie temporal usa SQL puro via $queryRaw (Prisma no soporta DATE_TRUNC en ORM)
   *
   * @note Los raw queries usan DATE_TRUNC de PostgreSQL para grouping temporal.
   *       Los bigints del COUNT se convierten a Number para evitar errores de serialización JSON.
   */
  async getDashboardMetrics() {
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

    const byDayRaw: Array<{ date: Date; count: bigint }> = await this.prisma
      .$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(id) as count
      FROM "Prescription"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC;
    `;

    const byDay = byDayRaw.map((row) => ({
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

  async getDashboardMetricsFiltered(from?: string, to?: string) {
    const where: Prisma.PrescriptionWhereInput = {};
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const parsed = new Date(from);
        if (isNaN(parsed.getTime()))
          throw new BadRequestException('Invalid from date');
        (where.createdAt as Prisma.DateTimeFilter).gte = parsed;
      }
      if (to) {
        const parsed = new Date(to);
        if (isNaN(parsed.getTime()))
          throw new BadRequestException('Invalid to date');
        (where.createdAt as Prisma.DateTimeFilter).lte = parsed;
      }
    }

    const [
      doctorsCount,
      patientsCount,
      totalPrescriptions,
      pendingPrescriptions,
      consumedPrescriptions,
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
    ]);

    const fromDate = from ? new Date(from) : new Date('1970-01-01');
    const toDate = to ? new Date(to) : new Date('2100-01-01');

    const byDayRaw: Array<{ date: Date; count: bigint }> = await this.prisma
      .$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(id) as count
      FROM "Prescription"
      WHERE "createdAt" >= ${fromDate}
      AND "createdAt" <= ${toDate}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC;
    `;

    const byDay = byDayRaw.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      count: Number(row.count),
    }));

    const topDoctorsRaw: Array<{ doctorId: string; count: bigint }> = await this
      .prisma.$queryRaw<Array<{ doctorId: string; count: bigint }>>`
        SELECT "doctorId", COUNT(*) as count
        FROM "Prescription"
        WHERE "createdAt" >= ${fromDate}
        AND "createdAt" <= ${toDate}
        GROUP BY "doctorId"
        ORDER BY count DESC
        LIMIT 5;
      `;

    const topDoctors = topDoctorsRaw.map((row) => ({
      doctorId: row.doctorId,
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
      topDoctors,
    };
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

    const where: Prisma.PrescriptionWhereInput = {};
    if (status) where.status = status;
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const parsed = new Date(from);
        if (isNaN(parsed.getTime()))
          throw new BadRequestException('Invalid from date');
        (where.createdAt as Prisma.DateTimeFilter).gte = parsed;
      }
      if (to) {
        const parsed = new Date(to);
        if (isNaN(parsed.getTime()))
          throw new BadRequestException('Invalid to date');
        (where.createdAt as Prisma.DateTimeFilter).lte = parsed;
      }
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
