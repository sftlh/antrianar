-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "contactId" INTEGER;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
