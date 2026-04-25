/*
  Warnings:

  - You are about to drop the column `published` on the `Todo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Todo" DROP COLUMN "published",
ADD COLUMN     "completed" BOOLEAN DEFAULT false;
