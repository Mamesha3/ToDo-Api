-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyImageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastImageResetDate" TIMESTAMP(3);
