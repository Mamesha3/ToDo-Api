/*
  Warnings:

  - You are about to drop the column `countSmart` on the `Todo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Todo" DROP COLUMN "countSmart";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "countSmart" INTEGER NOT NULL DEFAULT 0;
