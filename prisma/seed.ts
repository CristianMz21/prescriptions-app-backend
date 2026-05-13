import { PrismaClient, Role, PrescriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  const saltRounds = 10;
  const defaultPassword = '***REDACTED-DEV-PASSWORD***';
  const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

  // ---------------------------------------------------------
  // 1. Seed Users (Upsert ensures we don't duplicate on re-runs)
  // ---------------------------------------------------------

  // Seed Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@clinic.com' },
    update: {},
    create: {
      email: 'admin@clinic.com',
      passwordHash: hashedPassword,
      role: Role.ADMIN,
    },
  });
  console.log(`✅ Upserted ADMIN user: ${admin.email}`);

  // Seed Doctor
  const doctor = await prisma.user.upsert({
    where: { email: 'doctor@clinic.com' },
    update: {},
    create: {
      email: 'doctor@clinic.com',
      passwordHash: hashedPassword,
      role: Role.DOCTOR,
    },
  });
  console.log(`✅ Upserted DOCTOR user: ${doctor.email}`);

  // Seed Patient
  const patient = await prisma.user.upsert({
    where: { email: 'patient@clinic.com' },
    update: {},
    create: {
      email: 'patient@clinic.com',
      passwordHash: hashedPassword,
      role: Role.PATIENT,
    },
  });
  console.log(`✅ Upserted PATIENT user: ${patient.email}`);

  // ---------------------------------------------------------
  // 2. Seed Prescriptions
  // ---------------------------------------------------------

  // Only seed prescriptions if the patient has none, to avoid spamming the DB on multiple runs.
  const existingPrescriptionsCount = await prisma.prescription.count({
    where: { patientId: patient.id },
  });

  if (existingPrescriptionsCount === 0) {
    const dummyPrescriptions = [
      {
        status: PrescriptionStatus.PENDING,
        items: [
          { name: 'Amoxicillin', dosage: '500mg', instructions: 'Take 1 pill every 8 hours for 7 days' },
        ],
        notes: 'Take with food to avoid stomach upset.',
        doctorId: doctor.id,
        patientId: patient.id,
      },
      {
        status: PrescriptionStatus.CONSUMED,
        items: [
          { name: 'Ibuprofen', dosage: '400mg', instructions: 'Take 1 pill every 6 hours as needed for pain' },
        ],
        notes: null,
        doctorId: doctor.id,
        patientId: patient.id,
      },
      {
        status: PrescriptionStatus.PENDING,
        items: [
          { name: 'Lisinopril', dosage: '10mg', instructions: 'Take 1 pill daily in the morning' },
          { name: 'Atorvastatin', dosage: '20mg', instructions: 'Take 1 pill daily at bedtime' },
        ],
        notes: 'Follow up in 3 months for blood work.',
        doctorId: doctor.id,
        patientId: patient.id,
      },
      {
        status: PrescriptionStatus.CONSUMED,
        items: [
          { name: 'Azithromycin', dosage: '250mg', instructions: 'Take 2 pills on day 1, then 1 pill daily for 4 days' },
        ],
        notes: 'Finish the entire course even if feeling better.',
        doctorId: doctor.id,
        patientId: patient.id,
      },
      {
        status: PrescriptionStatus.PENDING,
        items: [
          { name: 'Metformin', dosage: '500mg', instructions: 'Take 1 pill twice daily with meals' },
        ],
        notes: 'Monitor blood sugar levels closely.',
        doctorId: doctor.id,
        patientId: patient.id,
      },
    ];

    console.log(`⏳ Seeding ${dummyPrescriptions.length} dummy prescriptions...`);
    
    for (const prescriptionData of dummyPrescriptions) {
      await prisma.prescription.create({
        data: prescriptionData,
      });
    }
    
    console.log(`✅ Successfully created ${dummyPrescriptions.length} dummy prescriptions.`);
  } else {
    console.log('⚠️  Prescriptions already exist for the seeded patient. Skipping prescription seeding.');
  }

  console.log('🎉 Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
