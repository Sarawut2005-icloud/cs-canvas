-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "image_data" BYTEA,
ADD COLUMN     "image_type" TEXT,
ADD COLUMN     "image_updated_at" TIMESTAMP(3);
