-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "taxpayerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "scanKTP" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "Taxpayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
