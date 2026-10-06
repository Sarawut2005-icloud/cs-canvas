-- CreateEnum
CREATE TYPE "ImageCategory" AS ENUM ('PROFILE', 'NEWS', 'GENERAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "profile_image_id" TEXT;

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL,
    "category" "ImageCategory" NOT NULL,
    "subsystem_id" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "thumbnail_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "images_storage_path_key" ON "images"("storage_path");

-- CreateIndex
CREATE UNIQUE INDEX "images_thumbnail_path_key" ON "images"("thumbnail_path");

-- CreateIndex
CREATE INDEX "images_category_created_at_idx" ON "images"("category", "created_at");

-- CreateIndex
CREATE INDEX "images_uploaded_by_id_idx" ON "images"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "images_subsystem_id_idx" ON "images"("subsystem_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_profile_image_id_key" ON "users"("profile_image_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_profile_image_id_fkey" FOREIGN KEY ("profile_image_id") REFERENCES "images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_subsystem_id_fkey" FOREIGN KEY ("subsystem_id") REFERENCES "subsystems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

