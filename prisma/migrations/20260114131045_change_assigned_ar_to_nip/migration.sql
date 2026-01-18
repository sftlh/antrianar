/*
  Warnings:

  - You are about to drop the column `assignedArId` on the `Taxpayer` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Taxpayer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[npwp]` on the table `Taxpayer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('WAITING', 'IN_CONSULTATION', 'DONE');

-- DropForeignKey
ALTER TABLE "Taxpayer" DROP CONSTRAINT "Taxpayer_assignedArId_fkey";

-- DropIndex
DROP INDEX "Consultation_taxpayerId_key";

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "room" TEXT,
ADD COLUMN     "status" "ConsultationStatus" NOT NULL DEFAULT 'WAITING';

-- AlterTable
ALTER TABLE "Taxpayer" DROP COLUMN "assignedArId",
DROP COLUMN "status",
ADD COLUMN     "assignedArNip" TEXT;

-- DropEnum
DROP TYPE "TaxpayerStatus";

-- CreateTable
CREATE TABLE "Room" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Taxpayer_npwp_key" ON "Taxpayer"("npwp");

-- AddForeignKey
ALTER TABLE "Taxpayer" ADD CONSTRAINT "Taxpayer_assignedArNip_fkey" FOREIGN KEY ("assignedArNip") REFERENCES "User"("nip") ON DELETE SET NULL ON UPDATE CASCADE;
