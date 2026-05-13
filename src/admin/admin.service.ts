import { Injectable } from '@nestjs/common';
import { Role, PrescriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service'; // Assuming PrismaService is available

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregates global metrics for the Admin dashboard.
   */
  async getDashboardMetrics() {
    // 1. Fetch fast aggregations concurrently
    const [doctorsCount, patientsCount, totalPrescriptions, pendingPrescriptions, consumedPrescriptions] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.DOCTOR } }),
      this.prisma.user.count({ where: { role: Role.PATIENT } }),
      this.prisma.prescription.count(),
      this.prisma.prescription.count({ where: { status: PrescriptionStatus.PENDING } }),
      this.prisma.prescription.count({ where: { status: PrescriptionStatus.CONSUMED } }),
    ]);

    // 2. Fetch Time-Series Data via Raw SQL
    // PostgreSQL DATE_TRUNC is the most reliable way to group rows by date when using Prisma
    const byDayRaw: Array<{ date: Date, count: bigint }> = await this.prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(id) as count
      FROM "Prescription"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC;
    `;

    // Map BigInt (returned by COUNT in raw queries) to standard Numbers 
    // to prevent JSON serialization errors (TypeError: Do not know how to serialize a BigInt)
    const byDay = byDayRaw.map(row => ({
      date: row.date.toISOString().split('T')[0], // Extract YYYY-MM-DD
      count: Number(row.count)
    }));

    // 3. Construct and return structured response
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
