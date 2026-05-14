import { PrismaClient, Role, PrescriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generatePrescriptionCode } from '../src/common/utils/code.utils';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  const saltRounds = 10;
  const defaultPassword =
    process.env.SEED_DEFAULT_PASSWORD ?? '<DEV_SEED_PASSWORD>';
  const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

  // ---------------------------------------------------------
  // 1. Seed Users + typed role tables (Doctor/Patient)
  // ---------------------------------------------------------

  const admin = await prisma.user.upsert({
    where: { email: 'admin@clinic.com' },
    update: {
      passwordHash: hashedPassword,
      role: Role.ADMIN,
      name: 'Sandra Admin',
      phone: '+54 11 4000-0001',
    },
    create: {
      email: 'admin@clinic.com',
      passwordHash: hashedPassword,
      name: 'Sandra Admin',
      phone: '+54 11 4000-0001',
      role: Role.ADMIN,
    },
  });
  console.log(`✅ Upserted ADMIN user: ${admin.email}`);

  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor@clinic.com' },
    update: {
      passwordHash: hashedPassword,
      role: Role.DOCTOR,
      name: 'Jane Doe',
      phone: '+54 11 4000-1001',
    },
    create: {
      email: 'doctor@clinic.com',
      passwordHash: hashedPassword,
      name: 'Jane Doe',
      phone: '+54 11 4000-1001',
      role: Role.DOCTOR,
      doctor: {
        create: {
          specialty: 'General Practice',
          medicalId: 'MED-10001',
          signatureText: 'Dr. Jane Doe',
        },
      },
    },
    include: { doctor: true },
  });
  console.log(`✅ Upserted DOCTOR user: ${doctorUser.email}`);

  const doctor2User = await prisma.user.upsert({
    where: { email: 'doctor2@clinic.com' },
    update: {
      passwordHash: hashedPassword,
      role: Role.DOCTOR,
      name: 'John Smith',
      phone: '+54 11 4000-1002',
    },
    create: {
      email: 'doctor2@clinic.com',
      passwordHash: hashedPassword,
      name: 'John Smith',
      phone: '+54 11 4000-1002',
      role: Role.DOCTOR,
      doctor: {
        create: {
          specialty: 'Pediatrics',
          medicalId: 'MED-20002',
          signatureText: 'Dr. John Smith',
        },
      },
    },
    include: { doctor: true },
  });
  console.log(`✅ Upserted DOCTOR user: ${doctor2User.email}`);

  const patientUser = await prisma.user.upsert({
    where: { email: 'patient@clinic.com' },
    update: {
      passwordHash: hashedPassword,
      role: Role.PATIENT,
      name: 'Carlos Rivera',
      phone: '+54 11 4000-2001',
    },
    create: {
      email: 'patient@clinic.com',
      passwordHash: hashedPassword,
      name: 'Carlos Rivera',
      phone: '+54 11 4000-2001',
      role: Role.PATIENT,
      patient: { create: { birthDate: new Date('1990-05-21') } },
    },
    include: { patient: true },
  });
  console.log(`✅ Upserted PATIENT user: ${patientUser.email}`);

  const doctor = doctorUser.doctor;
  const patient = patientUser.patient;
  if (!doctor || !patient) {
    throw new Error('Doctor or Patient typed-row was not created');
  }

  // ---------------------------------------------------------
  // 2. Seed Prescriptions
  // ---------------------------------------------------------

  const existingPrescriptionsCount = await prisma.prescription.count({
    where: { patientId: patient.id },
  });

  if (existingPrescriptionsCount === 0) {
    // expiryDate ~30 days from now for the first PENDING script — exercises the new field.
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const dummyPrescriptions = [
      {
        status: PrescriptionStatus.PENDING,
        expiryDate: thirtyDaysFromNow,
        items: [
          {
            name: 'Amoxicillin',
            dosage: '500mg',
            quantity: 21,
            unit: 'cápsulas',
            instructions: 'Take 1 pill every 8 hours for 7 days',
          },
        ],
        notes: 'Take with food to avoid stomach upset.',
      },
      {
        status: PrescriptionStatus.CONSUMED,
        expiryDate: null,
        items: [
          {
            name: 'Ibuprofen',
            dosage: '400mg',
            quantity: 30,
            unit: 'comprimidos',
            instructions: 'Take 1 pill every 6 hours as needed for pain',
          },
        ],
        notes: null,
      },
      {
        status: PrescriptionStatus.PENDING,
        expiryDate: null,
        items: [
          {
            name: 'Lisinopril',
            dosage: '10mg',
            quantity: 30,
            unit: 'comprimidos',
            instructions: 'Take 1 pill daily in the morning',
          },
          {
            name: 'Atorvastatin',
            dosage: '20mg',
            quantity: 30,
            unit: 'comprimidos',
            instructions: 'Take 1 pill daily at bedtime',
          },
        ],
        notes: 'Follow up in 3 months for blood work.',
      },
      {
        status: PrescriptionStatus.CONSUMED,
        expiryDate: null,
        items: [
          {
            name: 'Azithromycin',
            dosage: '250mg',
            quantity: 6,
            unit: 'comprimidos',
            instructions: 'Take 2 pills on day 1, then 1 pill daily for 4 days',
          },
        ],
        notes: 'Finish the entire course even if feeling better.',
      },
      {
        status: PrescriptionStatus.PENDING,
        expiryDate: null,
        items: [
          {
            name: 'Metformin',
            dosage: '500mg',
            quantity: 60,
            unit: 'comprimidos',
            instructions: 'Take 1 pill twice daily with meals',
          },
        ],
        notes: 'Monitor blood sugar levels closely.',
      },
    ];

    console.log(
      `⏳ Seeding ${dummyPrescriptions.length} dummy prescriptions...`,
    );

    for (const { items, ...prescriptionData } of dummyPrescriptions) {
      const consumedAt =
        prescriptionData.status === PrescriptionStatus.CONSUMED
          ? new Date()
          : null;
      const created = await prisma.prescription.create({
        data: {
          ...prescriptionData,
          code: generatePrescriptionCode(),
          authorId: doctor.id,
          patientId: patient.id,
          consumedAt,
          items: { create: items },
        },
      });

      // For CONSUMED prescriptions, also seed the corresponding audit log
      // (idempotency guarded by the if-block above which only runs on first seed).
      if (prescriptionData.status === PrescriptionStatus.CONSUMED) {
        await prisma.prescriptionAuditLog.create({
          data: {
            prescriptionId: created.id,
            changedById: patientUser.id,
            fromStatus: PrescriptionStatus.PENDING,
            toStatus: PrescriptionStatus.CONSUMED,
            reason: 'Seeded historical consumption',
          },
        });
      }
    }

    console.log(
      `✅ Successfully created ${dummyPrescriptions.length} dummy prescriptions (with audit logs for CONSUMED).`,
    );
  } else {
    console.log(
      '⚠️  Prescriptions already exist for the seeded patient. Skipping prescription seeding.',
    );
  }

  console.log('🎉 Seeding finished successfully.');
}

main()
  .catch(e => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
