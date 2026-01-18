/*
  Warnings:

  - You are about to drop the column `arId` on the `Consultation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Consultation" DROP CONSTRAINT "Consultation_arId_fkey";

-- AlterTable
ALTER TABLE "Consultation" DROP COLUMN "arId",
ADD COLUMN     "arNip" TEXT;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_arNip_fkey" FOREIGN KEY ("arNip") REFERENCES "User"("nip") ON DELETE SET NULL ON UPDATE CASCADE;
