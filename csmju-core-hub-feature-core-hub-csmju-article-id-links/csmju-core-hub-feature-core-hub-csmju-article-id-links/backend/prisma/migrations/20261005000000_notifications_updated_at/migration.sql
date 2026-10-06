-- Every table carries created_at and updated_at (data-dictionary.md §9.1).
ALTER TABLE "notifications" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
