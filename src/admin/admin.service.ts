import { Injectable } from '@nestjs/common';
import { Role, PrescriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
    // 1. Conteos rápidos ejecutados en paralelo
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

    // 2. Serie temporal via SQL Raw
    // DATE_TRUNC('day', ...) agrupa prescripciones por fecha (YYYY-MM-DD)
    // Filtra últimas 4 semanas para evitar datos excesivos
    const byDayRaw: Array<{ date: Date; count: bigint }> = await this.prisma
      .$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(id) as count
      FROM "Prescription"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC;
    `;

    // 3. Normalizar BigInt a Number para serialización JSON
    // BigInt no es serializable por JSON.stringify nativo
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
}
