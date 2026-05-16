/*
 * QA acceptance check #9 — "Migrations and seed run without errors".
 *
 * What it does: connect to the Postgres pointed at by `DATABASE_URL`
 * (already migrated + seeded by the surrounding CI step) and assert
 * the seed's contract holds. Exits non-zero on any failure so this
 * script is safe to drop straight into a CI workflow step.
 *
 * Contract asserted:
 *   - All 4 fixed users exist (admin / doctor / doctor2 / patient)
 *     and have the expected role.
 *   - At least 70 prescriptions exist (the seed generates 70).
 *   - At least 24 generated patients + 6 generated doctors exist,
 *     so admin lists and metrics have realistic-shaped data.
 *
 * Intentionally NOT a migrate/seed runner — orchestration is the
 * caller's job (CI step or developer). This script only validates.
 */
import { PrismaClient } from '@prisma/client';

interface FixedUserExpectation {
  email: string;
  role: 'ADMIN' | 'DOCTOR' | 'PATIENT';
}

const FIXED_USERS: ReadonlyArray<FixedUserExpectation> = [
  { email: 'admin@clinic.com', role: 'ADMIN' },
  { email: 'doctor@clinic.com', role: 'DOCTOR' },
  { email: 'doctor2@clinic.com', role: 'DOCTOR' },
  { email: 'patient@clinic.com', role: 'PATIENT' },
];

const MIN_TOTAL_PRESCRIPTIONS = 70;
const MIN_GENERATED_DOCTORS = 6;
const MIN_GENERATED_PATIENTS = 24;

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const failures: string[] = [];

  // 1. Fixed users present + correct role.
  for (const { email, role } of FIXED_USERS) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    if (!user) {
      failures.push(`fixed user ${email} missing`);
      continue;
    }
    if (user.role !== role) {
      failures.push(
        `fixed user ${email} has role ${user.role}, expected ${role}`,
      );
    }
  }

  // 2. Prescription count meets the seed contract.
  const totalRx = await prisma.prescription.count();
  if (totalRx < MIN_TOTAL_PRESCRIPTIONS) {
    failures.push(
      `prescriptions: have ${totalRx}, expected ≥ ${MIN_TOTAL_PRESCRIPTIONS}`,
    );
  }

  // 3. Generated doctors / patients shape check.
  const doctorCount = await prisma.doctor.count();
  if (doctorCount < MIN_GENERATED_DOCTORS) {
    failures.push(
      `doctors: have ${doctorCount}, expected ≥ ${MIN_GENERATED_DOCTORS}`,
    );
  }
  const patientCount = await prisma.patient.count();
  if (patientCount < MIN_GENERATED_PATIENTS) {
    failures.push(
      `patients: have ${patientCount}, expected ≥ ${MIN_GENERATED_PATIENTS}`,
    );
  }

  // Report.
  if (failures.length > 0) {
    console.error('❌ QA seed smoke FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return;
  }
  console.log('✅ QA seed smoke OK');
  console.log(`   fixed users: ${FIXED_USERS.length} (all roles correct)`);
  console.log(`   prescriptions: ${totalRx} (≥ ${MIN_TOTAL_PRESCRIPTIONS})`);
  console.log(`   doctors: ${doctorCount} (≥ ${MIN_GENERATED_DOCTORS})`);
  console.log(`   patients: ${patientCount} (≥ ${MIN_GENERATED_PATIENTS})`);
}

main()
  .catch(err => {
    console.error('❌ QA seed smoke crashed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
