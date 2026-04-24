-- AlterTable
ALTER TABLE "users" ADD COLUMN     "graphBubbleThreshold" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "graphMode" TEXT;
