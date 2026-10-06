-- master-data v0.6: ข้อมูลจากเว็บสาขา (เพิ่มคอลัมน์/ตาราง, ไม่แตะตาราง Core Hub)
-- CreateEnum
CREATE TYPE "HighlightKind" AS ENUM ('STATISTIC', 'MILESTONE');

-- DropIndex
DROP INDEX "curriculum_plan_slots_curriculum_id_category_recommended_ye_key";

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "address" TEXT,
ADD COLUMN     "description_th" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "map_url" TEXT,
ADD COLUMN     "office_phone" TEXT,
ADD COLUMN     "office_phone_note" TEXT,
ADD COLUMN     "official_name_th" TEXT;

-- AlterTable
ALTER TABLE "people" ADD COLUMN     "biography" TEXT,
ADD COLUMN     "education" TEXT,
ADD COLUMN     "experience" TEXT,
ADD COLUMN     "expertise" TEXT,
ADD COLUMN     "job_title" TEXT,
ADD COLUMN     "office_phone" TEXT,
ADD COLUMN     "office_phone_ext" TEXT,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "research" TEXT;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "category_label" TEXT,
ADD COLUMN     "lab_hours" INTEGER,
ADD COLUMN     "lecture_hours" INTEGER,
ADD COLUMN     "registrar_code" TEXT,
ADD COLUMN     "self_study_hours" INTEGER;

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "photo_url" TEXT;

-- AlterTable
ALTER TABLE "curricula" ADD COLUMN     "degree_full_en" TEXT,
ADD COLUMN     "degree_full_th" TEXT,
ADD COLUMN     "degree_short_en" TEXT,
ADD COLUMN     "degree_short_th" TEXT,
ADD COLUMN     "instruction_language" TEXT,
ADD COLUMN     "mission_th" TEXT,
ADD COLUMN     "national_code" TEXT,
ADD COLUMN     "philosophy_th" TEXT,
ADD COLUMN     "significance_th" TEXT,
ADD COLUMN     "study_duration_years" INTEGER,
ADD COLUMN     "vision_th" TEXT;

-- AlterTable
ALTER TABLE "curriculum_courses" ADD COLUMN     "course_group_id" TEXT,
ADD COLUMN     "is_counted_in_plan" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "plan_note" TEXT;

-- AlterTable
ALTER TABLE "curriculum_plan_slots" ADD COLUMN     "course_group_id" TEXT,
ADD COLUMN     "label" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "curriculum_learning_outcomes" ADD COLUMN     "subtitle_th" TEXT,
ADD COLUMN     "title_th" TEXT;

-- CreateTable
CREATE TABLE "curriculum_course_groups" (
    "id" TEXT NOT NULL,
    "curriculum_id" TEXT NOT NULL,
    "category" "CurriculumCategory" NOT NULL,
    "parent_name_th" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "listed_credits" INTEGER,
    "available_course_count" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_course_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_objectives" (
    "id" TEXT NOT NULL,
    "curriculum_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title_th" TEXT NOT NULL,
    "description_th" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_highlights" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "kind" "HighlightKind" NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_histories" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "period_label" TEXT NOT NULL,
    "academic_year" INTEGER,
    "description_th" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_articles" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "published_on" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "external_url" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "academic_year" INTEGER,
    "description" TEXT,
    "advisor_id" TEXT,
    "advisor_name_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "person_id" TEXT,
    "full_name_th" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "related_links" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "link_type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "related_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_course_groups_curriculum_id_name_th_key" ON "curriculum_course_groups"("curriculum_id", "name_th");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_objectives_curriculum_id_code_key" ON "curriculum_objectives"("curriculum_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "department_highlights_department_id_kind_label_key" ON "department_highlights"("department_id", "kind", "label");

-- CreateIndex
CREATE UNIQUE INDEX "department_histories_department_id_period_label_key" ON "department_histories"("department_id", "period_label");

-- CreateIndex
CREATE INDEX "news_articles_published_on_idx" ON "news_articles"("published_on");

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_department_id_published_on_title_key" ON "news_articles"("department_id", "published_on", "title");

-- CreateIndex
CREATE UNIQUE INDEX "student_projects_code_key" ON "student_projects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "student_project_members_project_id_full_name_th_key" ON "student_project_members"("project_id", "full_name_th");

-- CreateIndex
CREATE UNIQUE INDEX "related_links_department_id_name_url_key" ON "related_links"("department_id", "name", "url");

-- CreateIndex
CREATE UNIQUE INDEX "courses_registrar_code_key" ON "courses"("registrar_code");

-- CreateIndex
CREATE UNIQUE INDEX "curricula_national_code_key" ON "curricula"("national_code");

-- CreateIndex
CREATE INDEX "curriculum_courses_course_group_id_idx" ON "curriculum_courses"("course_group_id");

-- CreateIndex
CREATE INDEX "curriculum_plan_slots_course_group_id_idx" ON "curriculum_plan_slots"("course_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_plan_slots_curriculum_id_recommended_year_recomm_key" ON "curriculum_plan_slots"("curriculum_id", "recommended_year", "recommended_semester", "label");

-- AddForeignKey
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_courses_course_group_id_fkey" FOREIGN KEY ("course_group_id") REFERENCES "curriculum_course_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_plan_slots" ADD CONSTRAINT "curriculum_plan_slots_course_group_id_fkey" FOREIGN KEY ("course_group_id") REFERENCES "curriculum_course_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_course_groups" ADD CONSTRAINT "curriculum_course_groups_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_objectives" ADD CONSTRAINT "curriculum_objectives_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_highlights" ADD CONSTRAINT "department_highlights_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_histories" ADD CONSTRAINT "department_histories_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_projects" ADD CONSTRAINT "student_projects_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_projects" ADD CONSTRAINT "student_projects_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_project_members" ADD CONSTRAINT "student_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "student_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_project_members" ADD CONSTRAINT "student_project_members_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "related_links" ADD CONSTRAINT "related_links_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
