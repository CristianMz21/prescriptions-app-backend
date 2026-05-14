-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "medicalId" TEXT,
ADD COLUMN     "signatureImageUrl" TEXT,
ADD COLUMN     "signatureText" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "themePreference" "ThemePreference" NOT NULL DEFAULT 'SYSTEM';

-- CreateTable
CREATE TABLE "PrescriptionAuditLog" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "changedById" TEXT,
    "fromStatus" "PrescriptionStatus",
    "toStatus" "PrescriptionStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrescriptionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrescriptionAuditLog_prescriptionId_idx" ON "PrescriptionAuditLog"("prescriptionId");

-- CreateIndex
CREATE INDEX "PrescriptionAuditLog_changedById_idx" ON "PrescriptionAuditLog"("changedById");

-- CreateIndex
CREATE INDEX "PrescriptionAuditLog_createdAt_idx" ON "PrescriptionAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "PrescriptionAuditLog_toStatus_idx" ON "PrescriptionAuditLog"("toStatus");

-- CreateIndex
CREATE INDEX "Prescription_notes_idx" ON "Prescription"("notes");

-- CreateIndex
CREATE INDEX "PrescriptionItem_name_idx" ON "PrescriptionItem"("name");

-- AddForeignKey
ALTER TABLE "PrescriptionAuditLog" ADD CONSTRAINT "PrescriptionAuditLog_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionAuditLog" ADD CONSTRAINT "PrescriptionAuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
