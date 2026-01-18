-- CreateEnum
CREATE TYPE "Role" AS ENUM ('AR', 'KEPALA_KANTOR', 'KEPALA_SEKSI', 'ADMIN', 'PELAKSANA');

-- CreateEnum
CREATE TYPE "TaxpayerStatus" AS ENUM ('WAITING', 'IN_CONSULTATION', 'DONE');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "nip" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Taxpayer" (
    "id" SERIAL NOT NULL,
    "npwp" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TaxpayerStatus" NOT NULL DEFAULT 'WAITING',
    "assignedArId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Taxpayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" SERIAL NOT NULL,
    "taxpayerId" INTEGER NOT NULL,
    "arId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_nip_key" ON "User"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_taxpayerId_key" ON "Consultation"("taxpayerId");

-- AddForeignKey
ALTER TABLE "Taxpayer" ADD CONSTRAINT "Taxpayer_assignedArId_fkey" FOREIGN KEY ("assignedArId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "Taxpayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_arId_fkey" FOREIGN KEY ("arId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
