import { faker } from '@faker-js/faker';
import {
  Doctor,
  Patient,
  PrescriptionStatus,
  PrismaClient,
  Role,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generatePrescriptionCode } from '../src/common/utils/code.utils';

const prisma = new PrismaClient();

// Deterministic dataset: same `faker.seed` + same `prisma migrate reset`
// always produce the same rows. Helps CI parity + reproducible demos.
faker.seed(42);

// ---------------------------------------------------------
// Catalogs (hand-curated; faker has no medical vocabulary)
// ---------------------------------------------------------

const MEDS: ReadonlyArray<{
  name: string;
  dosage: string;
  unit: string;
  instructions: string;
}> = [
  {
    name: 'Amoxicillin',
    dosage: '500mg',
    unit: 'cápsulas',
    instructions: 'Take 1 every 8 hours for 7 days',
  },
  {
    name: 'Ibuprofen',
    dosage: '400mg',
    unit: 'comprimidos',
    instructions: 'Take 1 every 6 hours as needed for pain',
  },
  {
    name: 'Paracetamol',
    dosage: '500mg',
    unit: 'comprimidos',
    instructions: 'Take 1-2 every 6 hours; max 4g/day',
  },
  {
    name: 'Lisinopril',
    dosage: '10mg',
    unit: 'comprimidos',
    instructions: 'Take 1 daily in the morning',
  },
  {
    name: 'Atorvastatin',
    dosage: '20mg',
    unit: 'comprimidos',
    instructions: 'Take 1 daily at bedtime',
  },
  {
    name: 'Metformin',
    dosage: '500mg',
    unit: 'comprimidos',
    instructions: 'Take 1 twice daily with meals',
  },
  {
    name: 'Azithromycin',
    dosage: '250mg',
    unit: 'comprimidos',
    instructions: 'Take 2 on day 1, then 1 daily for 4 days',
  },
  {
    name: 'Omeprazole',
    dosage: '20mg',
    unit: 'cápsulas',
    instructions: 'Take 1 daily before breakfast',
  },
  {
    name: 'Salbutamol',
    dosage: '100mcg',
    unit: 'inhalaciones',
    instructions: '2 puffs every 4-6 hours as needed',
  },
  {
    name: 'Loratadine',
    dosage: '10mg',
    unit: 'comprimidos',
    instructions: 'Take 1 daily for allergies',
  },
  {
    name: 'Levothyroxine',
    dosage: '50mcg',
    unit: 'comprimidos',
    instructions: 'Take 1 daily on empty stomach',
  },
  {
    name: 'Sertraline',
    dosage: '50mg',
    unit: 'comprimidos',
    instructions: 'Take 1 daily in the morning',
  },
  {
    name: 'Insulin Glargine',
    dosage: '100UI/ml',
    unit: 'ml',
    instructions: 'Inject SC once daily at bedtime',
  },
  {
    name: 'Diazepam',
    dosage: '5mg',
    unit: 'comprimidos',
    instructions: 'Take 1 at night as needed for anxiety',
  },
  {
    name: 'Cetirizine',
    dosage: '10mg',
    unit: 'comprimidos',
    instructions: 'Take 1 daily for allergies',
  },
];

const SPECIALTIES: readonly string[] = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Neurology',
  'Psychiatry',
  'Oncology',
  'Orthopedics',
  'Gynecology',
  'Ophthalmology',
  'ENT',
  'Rheumatology',
  'Gastroenterology',
];

const LATAM_COUNTRY_CODES: readonly string[] = [
  '+54 11',
  '+57 1',
  '+52 55',
  '+56 2',
  '+51 1',
  '+593 2',
];

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

const randomPhone = (): string => {
  const cc = faker.helpers.arrayElement(LATAM_COUNTRY_CODES);
  return `${cc} ${faker.string.numeric(4)}-${faker.string.numeric(4)}`;
};

const randomNotes = (): string | null => {
  const notes = [
    'Take with food to avoid stomach upset.',
    'Follow up in 2 weeks.',
    'Monitor blood pressure daily.',
    'Drink plenty of water.',
    'Avoid alcohol while on this medication.',
    'Finish the entire course even if feeling better.',
    'Schedule a blood test in 1 month.',
    null,
  ];
  return faker.helpers.arrayElement(notes);
};

// ---------------------------------------------------------
// Fixed users (preserved for e2e test contract)
// ---------------------------------------------------------

const upsertAdmin = (passwordHash: string) =>
  prisma.user.upsert({
    where: { email: 'admin@clinic.com' },
    update: {
      passwordHash,
      role: Role.ADMIN,
      name: 'Sandra Admin',
      phone: '+54 11 4000-0001',
    },
    create: {
      email: 'admin@clinic.com',
      passwordHash,
      name: 'Sandra Admin',
      phone: '+54 11 4000-0001',
      role: Role.ADMIN,
    },
  });

const upsertDoctor1 = (passwordHash: string) =>
  prisma.user.upsert({
    where: { email: 'doctor@clinic.com' },
    update: {
      passwordHash,
      role: Role.DOCTOR,
      name: 'Jane Doe',
      phone: '+54 11 4000-1001',
    },
    create: {
      email: 'doctor@clinic.com',
      passwordHash,
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

const upsertDoctor2 = (passwordHash: string) =>
  prisma.user.upsert({
    where: { email: 'doctor2@clinic.com' },
    update: {
      passwordHash,
      role: Role.DOCTOR,
      name: 'John Smith',
      phone: '+54 11 4000-1002',
    },
    create: {
      email: 'doctor2@clinic.com',
      passwordHash,
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

const upsertPatient1 = (passwordHash: string) =>
  prisma.user.upsert({
    where: { email: 'patient@clinic.com' },
    update: {
      passwordHash,
      role: Role.PATIENT,
      name: 'Carlos Rivera',
      phone: '+54 11 4000-2001',
    },
    create: {
      email: 'patient@clinic.com',
      passwordHash,
      name: 'Carlos Rivera',
      phone: '+54 11 4000-2001',
      role: Role.PATIENT,
      patient: { create: { birthDate: new Date('1990-05-21') } },
    },
    include: { patient: true },
  });

// ---------------------------------------------------------
// Generated cohorts
// ---------------------------------------------------------

type UserWithDoctor = User & { doctor: Doctor | null };
type UserWithPatient = User & { patient: Patient | null };

async function seedGeneratedDoctors(
  passwordHash: string,
  count: number,
): Promise<UserWithDoctor[]> {
  const docs: UserWithDoctor[] = [];
  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const name = `${firstName} ${lastName}`;
    const email = `dr.${faker.helpers
      .slugify(name)
      .toLowerCase()}.${faker.number.int({ min: 100, max: 999 })}@clinic.com`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone: randomPhone(),
        role: Role.DOCTOR,
        doctor: {
          create: {
            specialty: faker.helpers.arrayElement(SPECIALTIES),
            medicalId: `MED-3${faker.string.numeric(4)}`,
            signatureText: `Dr. ${name}`,
          },
        },
      },
      include: { doctor: true },
    });
    docs.push(user);
  }
  return docs;
}

async function seedGeneratedPatients(
  passwordHash: string,
  count: number,
): Promise<UserWithPatient[]> {
  const pats: UserWithPatient[] = [];
  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const name = `${firstName} ${lastName}`;
    const email = `${faker.helpers
      .slugify(name)
      .toLowerCase()}.${faker.number.int({ min: 100, max: 999 })}@clinic.com`;
    const birthDate = faker.date.birthdate({ min: 5, max: 85, mode: 'age' });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone: randomPhone(),
        role: Role.PATIENT,
        patient: { create: { birthDate } },
      },
      include: { patient: true },
    });
    pats.push(user);
  }
  return pats;
}

// ---------------------------------------------------------
// Prescriptions
// ---------------------------------------------------------

async function seedPrescriptions(
  doctors: UserWithDoctor[],
  patients: UserWithPatient[],
  count: number,
): Promise<void> {
  const validDoctors = doctors.filter(
    (
      d,
    ): d is UserWithDoctor & {
      doctor: Doctor;
    } => d.doctor !== null,
  );
  const validPatients = patients.filter(
    (p): p is UserWithPatient & { patient: Patient } => p.patient !== null,
  );
  if (validDoctors.length === 0 || validPatients.length === 0) {
    throw new Error(
      `Cannot seed prescriptions: ${validDoctors.length} doctors, ${validPatients.length} patients available.`,
    );
  }

  for (let i = 0; i < count; i++) {
    const doctorUser = faker.helpers.arrayElement(validDoctors);
    const patientUser = faker.helpers.arrayElement(validPatients);
    const status = faker.helpers.weightedArrayElement([
      { value: PrescriptionStatus.PENDING, weight: 5 },
      { value: PrescriptionStatus.CONSUMED, weight: 5 },
    ]);
    const consumedAt =
      status === PrescriptionStatus.CONSUMED
        ? faker.date.recent({ days: 60 })
        : null;
    const expiryDate =
      status === PrescriptionStatus.PENDING && faker.datatype.boolean(0.6)
        ? faker.date.soon({ days: 90 })
        : null;
    const itemCount = faker.number.int({ min: 1, max: 3 });
    const items = faker.helpers.arrayElements(MEDS, itemCount).map(med => ({
      name: med.name,
      dosage: med.dosage,
      unit: med.unit,
      quantity: faker.number.int({ min: 5, max: 90 }),
      instructions: med.instructions,
    }));

    const created = await prisma.prescription.create({
      data: {
        code: generatePrescriptionCode(),
        authorId: doctorUser.doctor.id,
        patientId: patientUser.patient.id,
        status,
        consumedAt,
        expiryDate,
        notes: randomNotes(),
        items: { create: items },
      },
    });

    if (status === PrescriptionStatus.CONSUMED) {
      await prisma.prescriptionAuditLog.create({
        data: {
          prescriptionId: created.id,
          changedById: patientUser.id,
          fromStatus: PrescriptionStatus.PENDING,
          toStatus: PrescriptionStatus.CONSUMED,
          reason: 'Patient confirmed pickup at pharmacy',
        },
      });
    }
  }
}

// ---------------------------------------------------------
// Main
// ---------------------------------------------------------

async function main(): Promise<void> {
  console.log('🌱 Starting realistic seed (faker.seed=42)...');

  const saltRounds = 10;
  const defaultPassword =
    process.env.SEED_DEFAULT_PASSWORD ?? '<DEV_SEED_PASSWORD>';
  const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

  // 1. Fixed users (e2e contract)
  const admin = await upsertAdmin(passwordHash);
  const doctor1 = await upsertDoctor1(passwordHash);
  const doctor2 = await upsertDoctor2(passwordHash);
  const patient1 = await upsertPatient1(passwordHash);
  console.log(
    `✅ Fixed users: ${admin.email}, ${doctor1.email}, ${doctor2.email}, ${patient1.email}`,
  );

  // 2. Generated cohorts (only if first-time; idempotent guard)
  const existingDoctors = await prisma.doctor.count();
  const existingPatients = await prisma.patient.count();

  let generatedDoctors: UserWithDoctor[] = [];
  if (existingDoctors <= 2) {
    generatedDoctors = await seedGeneratedDoctors(passwordHash, 6);
    console.log(`✅ Generated ${generatedDoctors.length} additional doctors.`);
  } else {
    console.log(
      `⏭️  Skipped doctor generation (already ${existingDoctors} present).`,
    );
  }

  let generatedPatients: UserWithPatient[] = [];
  if (existingPatients <= 1) {
    generatedPatients = await seedGeneratedPatients(passwordHash, 24);
    console.log(
      `✅ Generated ${generatedPatients.length} additional patients.`,
    );
  } else {
    console.log(
      `⏭️  Skipped patient generation (already ${existingPatients} present).`,
    );
  }

  // 3. Prescriptions
  const existingPrescriptions = await prisma.prescription.count();
  if (existingPrescriptions === 0) {
    const allDoctors = [doctor1, doctor2, ...generatedDoctors];
    const allPatients = [patient1, ...generatedPatients];
    await seedPrescriptions(allDoctors, allPatients, 70);
    console.log(`✅ Seeded 70 prescriptions across doctor/patient pairs.`);
  } else {
    console.log(
      `⏭️  Skipped prescription generation (already ${existingPrescriptions} present).`,
    );
  }

  console.log('🎉 Seeding finished.');
}

main()
  .catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
