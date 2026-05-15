import { faker } from '@faker-js/faker';
import {
  Doctor,
  Patient,
  PrescriptionStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Deterministic dataset: faker.seed=42 + the same upsert keys yield the same
// rows on every run, so seeding is safe to chain into every deploy.
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

const GENERATED_DOCTORS_COUNT = 6;
const GENERATED_PATIENTS_COUNT = 24;
const PRESCRIPTIONS_COUNT = 70;

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

// Deterministic prescription code, stable across re-runs while faker.seed=42.
const deterministicPrescriptionCode = (): string =>
  `RX-${faker.string.alphanumeric({ length: 10, casing: 'upper' })}`;

// ---------------------------------------------------------
// Fixed users (e2e + QA contract)
//
// On UPDATE we deliberately omit `passwordHash` so re-deploying never resets
// a credential that an operator may have rotated. The hash is only set on
// initial CREATE.
// ---------------------------------------------------------

interface FixedUserSpec {
  email: string;
  name: string;
  phone: string;
  role: Role;
}

const FIXED_USERS: ReadonlyArray<FixedUserSpec> = [
  {
    email: 'admin@clinic.com',
    name: 'Sandra Admin',
    phone: '+54 11 4000-0001',
    role: Role.ADMIN,
  },
  {
    email: 'doctor@clinic.com',
    name: 'Jane Doe',
    phone: '+54 11 4000-1001',
    role: Role.DOCTOR,
  },
  {
    email: 'doctor2@clinic.com',
    name: 'John Smith',
    phone: '+54 11 4000-1002',
    role: Role.DOCTOR,
  },
  {
    email: 'patient@clinic.com',
    name: 'Carlos Rivera',
    phone: '+54 11 4000-2001',
    role: Role.PATIENT,
  },
];

interface FixedDoctorProfile {
  email: string;
  specialty: string;
  medicalId: string;
}

const FIXED_DOCTORS: ReadonlyArray<FixedDoctorProfile> = [
  {
    email: 'doctor@clinic.com',
    specialty: 'General Practice',
    medicalId: 'MED-10001',
  },
  {
    email: 'doctor2@clinic.com',
    specialty: 'Pediatrics',
    medicalId: 'MED-20002',
  },
];

interface FixedPatientProfile {
  email: string;
  birthDate: Date;
}

const FIXED_PATIENTS: ReadonlyArray<FixedPatientProfile> = [
  { email: 'patient@clinic.com', birthDate: new Date('1990-05-21') },
];

async function upsertFixedUser(
  spec: FixedUserSpec,
  passwordHash: string,
): Promise<void> {
  await prisma.user.upsert({
    where: { email: spec.email },
    update: {
      name: spec.name,
      phone: spec.phone,
      role: spec.role,
    },
    create: {
      email: spec.email,
      passwordHash,
      name: spec.name,
      phone: spec.phone,
      role: spec.role,
    },
  });
}

async function upsertFixedDoctorProfile(
  profile: FixedDoctorProfile,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: profile.email },
  });
  await prisma.doctor.upsert({
    where: { userId: user.id },
    update: {
      specialty: profile.specialty,
      medicalId: profile.medicalId,
      signatureText: `Dr. ${user.name}`,
    },
    create: {
      userId: user.id,
      specialty: profile.specialty,
      medicalId: profile.medicalId,
      signatureText: `Dr. ${user.name}`,
    },
  });
}

async function upsertFixedPatientProfile(
  profile: FixedPatientProfile,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: profile.email },
  });
  await prisma.patient.upsert({
    where: { userId: user.id },
    update: { birthDate: profile.birthDate },
    create: { userId: user.id, birthDate: profile.birthDate },
  });
}

// ---------------------------------------------------------
// Generated cohorts (faker, deterministic via faker.seed)
// ---------------------------------------------------------

type UserWithDoctor = { id: string; email: string; doctor: Doctor };
type UserWithPatient = { id: string; email: string; patient: Patient };

async function seedGeneratedDoctors(
  passwordHash: string,
  count: number,
): Promise<UserWithDoctor[]> {
  const docs: UserWithDoctor[] = [];
  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const name = `${firstName} ${lastName}`;
    const slug = faker.helpers.slugify(name).toLowerCase();
    const suffix = faker.number.int({ min: 100, max: 999 });
    const email = `dr.${slug}.${suffix}@clinic.com`;
    const phone = randomPhone();
    const specialty = faker.helpers.arrayElement(SPECIALTIES);
    const medicalId = `MED-3${faker.string.numeric(4)}`;
    const signatureText = `Dr. ${name}`;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, phone, role: Role.DOCTOR },
      create: { email, passwordHash, name, phone, role: Role.DOCTOR },
    });
    const doctor = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: { specialty, medicalId, signatureText },
      create: { userId: user.id, specialty, medicalId, signatureText },
    });

    docs.push({ id: user.id, email: user.email, doctor });
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
    const slug = faker.helpers.slugify(name).toLowerCase();
    const suffix = faker.number.int({ min: 100, max: 999 });
    const email = `${slug}.${suffix}@clinic.com`;
    const phone = randomPhone();
    const birthDate = faker.date.birthdate({ min: 5, max: 85, mode: 'age' });

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, phone, role: Role.PATIENT },
      create: { email, passwordHash, name, phone, role: Role.PATIENT },
    });
    const patient = await prisma.patient.upsert({
      where: { userId: user.id },
      update: { birthDate },
      create: { userId: user.id, birthDate },
    });

    pats.push({ id: user.id, email: user.email, patient });
  }
  return pats;
}

// ---------------------------------------------------------
// Prescriptions (upsert by unique code; audit-log side-effect
// gated on absence so re-runs don't duplicate history rows)
// ---------------------------------------------------------

async function seedPrescriptions(
  doctors: ReadonlyArray<UserWithDoctor>,
  patients: ReadonlyArray<UserWithPatient>,
  count: number,
): Promise<void> {
  if (doctors.length === 0 || patients.length === 0) {
    throw new Error(
      `Cannot seed prescriptions: ${doctors.length} doctors, ${patients.length} patients available.`,
    );
  }

  for (let i = 0; i < count; i++) {
    const doctorUser = faker.helpers.arrayElement(doctors);
    const patientUser = faker.helpers.arrayElement(patients);
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
    const notes = randomNotes();
    const code = deterministicPrescriptionCode();

    const prescription = await prisma.prescription.upsert({
      where: { code },
      // Preserve existing rows untouched — operators or the app may have
      // mutated them after the first seed (e.g. flipping status).
      update: {},
      create: {
        code,
        authorId: doctorUser.doctor.id,
        patientId: patientUser.patient.id,
        status,
        consumedAt,
        expiryDate,
        notes,
        items: { create: items },
      },
    });

    // Gate audit log on the LIVE row status — `update: {}` may have preserved
    // a hand-edited status that diverges from the seed-decided one.
    if (prescription.status === PrescriptionStatus.CONSUMED) {
      const existingLog = await prisma.prescriptionAuditLog.findFirst({
        where: { prescriptionId: prescription.id },
      });
      if (!existingLog) {
        await prisma.prescriptionAuditLog.create({
          data: {
            prescriptionId: prescription.id,
            changedById: patientUser.id,
            fromStatus: PrescriptionStatus.PENDING,
            toStatus: PrescriptionStatus.CONSUMED,
            reason: 'Patient confirmed pickup at pharmacy',
          },
        });
      }
    }
  }
}

// ---------------------------------------------------------
// Main
// ---------------------------------------------------------

async function main(): Promise<void> {
  console.log('🌱 Starting idempotent seed (faker.seed=42)...');

  const saltRounds = 10;
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!defaultPassword || defaultPassword.length < 8) {
    throw new Error(
      'SEED_DEFAULT_PASSWORD env var is required (min 8 chars) and was not provided.',
    );
  }
  // NOTE: never log the password value itself — only the env var name.
  console.log('🔐 Using bcrypt hash of $SEED_DEFAULT_PASSWORD for new users.');
  const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

  // 1. Fixed users — QA contract
  for (const spec of FIXED_USERS) {
    await upsertFixedUser(spec, passwordHash);
  }
  for (const profile of FIXED_DOCTORS) {
    await upsertFixedDoctorProfile(profile);
  }
  for (const profile of FIXED_PATIENTS) {
    await upsertFixedPatientProfile(profile);
  }
  console.log(
    `✅ Fixed users upserted: ${FIXED_USERS.map(u => u.email).join(', ')}`,
  );

  // 2. Generated cohorts — strictly idempotent via upsert on email
  const generatedDoctors = await seedGeneratedDoctors(
    passwordHash,
    GENERATED_DOCTORS_COUNT,
  );
  console.log(`✅ Generated doctors upserted: ${generatedDoctors.length}`);

  const generatedPatients = await seedGeneratedPatients(
    passwordHash,
    GENERATED_PATIENTS_COUNT,
  );
  console.log(`✅ Generated patients upserted: ${generatedPatients.length}`);

  // 3. Prescriptions — upsert by deterministic code
  const fixedDoctorRows = await prisma.user.findMany({
    where: { email: { in: FIXED_DOCTORS.map(d => d.email) } },
    select: { id: true, email: true, doctor: true },
  });
  const fixedPatientRows = await prisma.user.findMany({
    where: { email: { in: FIXED_PATIENTS.map(p => p.email) } },
    select: { id: true, email: true, patient: true },
  });
  const allDoctors: UserWithDoctor[] = [
    ...fixedDoctorRows
      .filter((r): r is typeof r & { doctor: Doctor } => r.doctor !== null)
      .map(r => ({ id: r.id, email: r.email, doctor: r.doctor })),
    ...generatedDoctors,
  ];
  const allPatients: UserWithPatient[] = [
    ...fixedPatientRows
      .filter((r): r is typeof r & { patient: Patient } => r.patient !== null)
      .map(r => ({ id: r.id, email: r.email, patient: r.patient })),
    ...generatedPatients,
  ];
  await seedPrescriptions(allDoctors, allPatients, PRESCRIPTIONS_COUNT);
  console.log(`✅ Prescriptions upserted: ${PRESCRIPTIONS_COUNT}`);

  const totalUsers = await prisma.user.count();
  const totalPrescriptions = await prisma.prescription.count();
  console.log(
    `📊 Totals after seed — users: ${totalUsers}, prescriptions: ${totalPrescriptions}`,
  );
  console.log('🎉 Seeding finished successfully.');
}

main()
  .catch((err: unknown) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
