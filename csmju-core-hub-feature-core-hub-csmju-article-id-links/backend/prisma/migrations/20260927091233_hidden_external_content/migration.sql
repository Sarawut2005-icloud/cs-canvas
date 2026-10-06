-- CreateEnum
CREATE TYPE "ExternalContentKind" AS ENUM ('ARTICLE', 'BANNER');

-- CreateTable
CREATE TABLE "hidden_external_content" (
    "id" TEXT NOT NULL,
    "kind" "ExternalContentKind" NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hidden_by_id" TEXT NOT NULL,
    "hidden_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hidden_external_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hidden_external_content_hidden_by_id_idx" ON "hidden_external_content"("hidden_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "hidden_external_content_kind_external_id_key" ON "hidden_external_content"("kind", "external_id");

-- AddForeignKey
ALTER TABLE "hidden_external_content" ADD CONSTRAINT "hidden_external_content_hidden_by_id_fkey" FOREIGN KEY ("hidden_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
