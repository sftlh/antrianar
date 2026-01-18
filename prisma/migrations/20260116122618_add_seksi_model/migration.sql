-- AlterTable
ALTER TABLE "User" ADD COLUMN     "seksiId" INTEGER;

-- CreateTable
CREATE TABLE "Seksi" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seksi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Seksi_name_key" ON "Seksi"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_seksiId_fkey" FOREIGN KEY ("seksiId") REFERENCES "Seksi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
