/*
  Warnings:

  - You are about to alter the column `nip` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(8)`.

*/
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "nip" SET DATA TYPE VARCHAR(8);
