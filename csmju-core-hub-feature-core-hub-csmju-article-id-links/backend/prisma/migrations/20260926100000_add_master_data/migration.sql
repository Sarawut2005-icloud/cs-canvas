-- master-data: เพิ่มตารางข้อมูลกลาง (ไม่แตะตารางเดิมของ Core Hub)
-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('STUDENT', 'STAFF');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED');

-- CreateEnum
CREATE TYPE "StaffType" AS ENUM ('LECTURER', 'OFFICER', 'TECHNICIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('IMPORTED', 'SELF_REPORTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('REGISTERED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('LECTURE', 'LAB', 'OTHER');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('CLASSROOM', 'LAB', 'OFFICE', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "PlaceType" AS ENUM ('BUS_STOP', 'PICKUP_POINT', 'SERVICE_POINT', 'PARKING', 'OTHER');

-- CreateEnum
CREATE TYPE "CurriculumCategory" AS ENUM ('GENERAL_EDUCATION', 'CORE', 'MAJOR_REQUIRED', 'MAJOR_ELECTIVE', 'FREE_ELECTIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "InterestCategory" AS ENUM ('CAREER', 'TOPIC', 'HOBBY');

-- CreateTable
CREATE TABLE "faculties" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" TEXT NOT NULL,
    "core_user_id" TEXT,
    "person_code" TEXT NOT NULL,
    "person_type" "PersonType" NOT NULL,
    "staff_type" "StaffType",
    "academic_title" TEXT,
    "full_name_th" TEXT NOT NULL,
    "full_name_en" TEXT,
    "university_email" TEXT,
    "faculty_id" TEXT NOT NULL,
    "department_id" TEXT,
    "entry_year" INTEGER,
    "curriculum_id" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_assignments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "advisor_id" TEXT NOT NULL,
    "start_term_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "academic_year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "term_events" (
    "id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "event_code" TEXT NOT NULL,
    "parent_event_code" TEXT,
    "name_th" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "term_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "base_code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "credits" INTEGER NOT NULL,
    "credit_pattern" TEXT,
    "department_id" TEXT,
    "owner_unit_name" TEXT,
    "description_th" TEXT,
    "description_en" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_prerequisites" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "prerequisite_course_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_prerequisites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_sections" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "section_no" TEXT NOT NULL,
    "capacity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_instructors" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_schedules" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "schedule_type" "ScheduleType" NOT NULL DEFAULT 'LECTURE',
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "room_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "building_id" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "floor" INTEGER,
    "room_type" "RoomType" NOT NULL,
    "capacity" INTEGER,
    "computer_count" INTEGER,
    "is_bookable" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "places" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "place_type" "PlaceType" NOT NULL,
    "building_id" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curricula" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "curriculum_year" INTEGER NOT NULL,
    "total_credits" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_courses" (
    "id" TEXT NOT NULL,
    "curriculum_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "category" "CurriculumCategory" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "choice_group" TEXT,
    "recommended_year" INTEGER,
    "recommended_semester" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_plan_slots" (
    "id" TEXT NOT NULL,
    "curriculum_id" TEXT NOT NULL,
    "category" "CurriculumCategory" NOT NULL,
    "recommended_year" INTEGER NOT NULL,
    "recommended_semester" INTEGER NOT NULL,
    "slot_count" INTEGER NOT NULL,
    "credits_per_slot" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_plan_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_credit_rules" (
    "id" TEXT NOT NULL,
    "curriculum_id" TEXT NOT NULL,
    "category" "CurriculumCategory" NOT NULL,
    "min_credits" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_credit_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_learning_outcomes" (
    "id" TEXT NOT NULL,
    "curriculum_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description_th" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_learning_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "business_type" TEXT,
    "province" TEXT,
    "address" TEXT,
    "website" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "has_mou" BOOLEAN NOT NULL DEFAULT false,
    "is_coop_accepted" BOOLEAN NOT NULL DEFAULT false,
    "is_internship_accepted" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'REGISTERED',
    "data_source" "DataSource" NOT NULL DEFAULT 'SELF_REPORTED',
    "verified_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_hour_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_hour_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_hour_requirements" (
    "id" TEXT NOT NULL,
    "activity_hour_type_id" TEXT NOT NULL,
    "entry_year" INTEGER NOT NULL,
    "required_hours" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_hour_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interest_tags" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "category" "InterestCategory" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interest_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_interests" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "interest_tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faculties_code_key" ON "faculties"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_faculty_id_idx" ON "departments"("faculty_id");

-- CreateIndex
CREATE UNIQUE INDEX "people_core_user_id_key" ON "people"("core_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "people_person_code_key" ON "people"("person_code");

-- CreateIndex
CREATE UNIQUE INDEX "people_university_email_key" ON "people"("university_email");

-- CreateIndex
CREATE INDEX "people_person_type_status_idx" ON "people"("person_type", "status");

-- CreateIndex
CREATE INDEX "people_department_id_entry_year_idx" ON "people"("department_id", "entry_year");

-- CreateIndex
CREATE INDEX "advisor_assignments_advisor_id_idx" ON "advisor_assignments"("advisor_id");

-- CreateIndex
CREATE UNIQUE INDEX "advisor_assignments_student_id_advisor_id_key" ON "advisor_assignments"("student_id", "advisor_id");

-- CreateIndex
CREATE UNIQUE INDEX "terms_code_key" ON "terms"("code");

-- CreateIndex
CREATE UNIQUE INDEX "terms_academic_year_semester_key" ON "terms"("academic_year", "semester");

-- CreateIndex
CREATE INDEX "term_events_event_code_idx" ON "term_events"("event_code");

-- CreateIndex
CREATE UNIQUE INDEX "term_events_term_id_event_code_key" ON "term_events"("term_id", "event_code");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE INDEX "courses_base_code_idx" ON "courses"("base_code");

-- CreateIndex
CREATE UNIQUE INDEX "course_prerequisites_course_id_prerequisite_course_id_key" ON "course_prerequisites"("course_id", "prerequisite_course_id");

-- CreateIndex
CREATE INDEX "course_sections_term_id_idx" ON "course_sections"("term_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_sections_course_id_term_id_section_no_key" ON "course_sections"("course_id", "term_id", "section_no");

-- CreateIndex
CREATE INDEX "section_instructors_instructor_id_idx" ON "section_instructors"("instructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "section_instructors_section_id_instructor_id_key" ON "section_instructors"("section_id", "instructor_id");

-- CreateIndex
CREATE INDEX "section_schedules_room_id_day_of_week_idx" ON "section_schedules"("room_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_code_key" ON "buildings"("code");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");

-- CreateIndex
CREATE INDEX "rooms_building_id_idx" ON "rooms"("building_id");

-- CreateIndex
CREATE UNIQUE INDEX "places_code_key" ON "places"("code");

-- CreateIndex
CREATE INDEX "places_place_type_idx" ON "places"("place_type");

-- CreateIndex
CREATE UNIQUE INDEX "curricula_code_key" ON "curricula"("code");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_courses_curriculum_id_course_id_key" ON "curriculum_courses"("curriculum_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_plan_slots_curriculum_id_category_recommended_ye_key" ON "curriculum_plan_slots"("curriculum_id", "category", "recommended_year", "recommended_semester");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_credit_rules_curriculum_id_category_key" ON "curriculum_credit_rules"("curriculum_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_learning_outcomes_curriculum_id_code_key" ON "curriculum_learning_outcomes"("curriculum_id", "code");

-- CreateIndex
CREATE INDEX "companies_province_idx" ON "companies"("province");

-- CreateIndex
CREATE INDEX "enrollments_section_id_idx" ON "enrollments"("section_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_student_id_section_id_key" ON "enrollments"("student_id", "section_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_hour_types_code_key" ON "activity_hour_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "activity_hour_requirements_activity_hour_type_id_entry_year_key" ON "activity_hour_requirements"("activity_hour_type_id", "entry_year");

-- CreateIndex
CREATE UNIQUE INDEX "interest_tags_code_key" ON "interest_tags"("code");

-- CreateIndex
CREATE INDEX "person_interests_interest_tag_id_idx" ON "person_interests"("interest_tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "person_interests_person_id_interest_tag_id_key" ON "person_interests"("person_id", "interest_tag_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_assignments" ADD CONSTRAINT "advisor_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_assignments" ADD CONSTRAINT "advisor_assignments_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_assignments" ADD CONSTRAINT "advisor_assignments_start_term_id_fkey" FOREIGN KEY ("start_term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_events" ADD CONSTRAINT "term_events_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_prerequisite_course_id_fkey" FOREIGN KEY ("prerequisite_course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_instructors" ADD CONSTRAINT "section_instructors_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_instructors" ADD CONSTRAINT "section_instructors_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_schedules" ADD CONSTRAINT "section_schedules_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_schedules" ADD CONSTRAINT "section_schedules_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_courses_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_plan_slots" ADD CONSTRAINT "curriculum_plan_slots_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_credit_rules" ADD CONSTRAINT "curriculum_credit_rules_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_learning_outcomes" ADD CONSTRAINT "curriculum_learning_outcomes_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_hour_requirements" ADD CONSTRAINT "activity_hour_requirements_activity_hour_type_id_fkey" FOREIGN KEY ("activity_hour_type_id") REFERENCES "activity_hour_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_interests" ADD CONSTRAINT "person_interests_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_interests" ADD CONSTRAINT "person_interests_interest_tag_id_fkey" FOREIGN KEY ("interest_tag_id") REFERENCES "interest_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -- ===== กฎเพิ่มเติมที่ Prisma schema เขียนไม่ได้ (Prisma ไม่ติดตาม trigger/check จึงไม่เกิด drift) =====

-- ภาคปัจจุบันมีได้ภาคเดียว
CREATE OR REPLACE FUNCTION terms_single_current() RETURNS trigger AS $$
BEGIN
  UPDATE "terms" SET "is_current" = false WHERE "id" <> NEW."id" AND "is_current";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER terms_single_current_trg
AFTER INSERT OR UPDATE OF "is_current" ON "terms"
FOR EACH ROW WHEN (NEW."is_current") EXECUTE FUNCTION terms_single_current();

ALTER TABLE "terms" ADD CONSTRAINT "terms_semester_chk" CHECK ("semester" BETWEEN 1 AND 3);
ALTER TABLE "terms" ADD CONSTRAINT "terms_dates_chk" CHECK ("end_date" >= "start_date");
ALTER TABLE "term_events" ADD CONSTRAINT "term_events_time_chk" CHECK ("ends_at" >= "starts_at");
ALTER TABLE "section_schedules" ADD CONSTRAINT "section_schedules_day_chk" CHECK ("day_of_week" BETWEEN 1 AND 7);
ALTER TABLE "section_schedules" ADD CONSTRAINT "section_schedules_time_chk"
  CHECK ("start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "end_time" > "start_time");
ALTER TABLE "courses" ADD CONSTRAINT "courses_credits_chk" CHECK ("credits" >= 0);
ALTER TABLE "courses" ADD CONSTRAINT "courses_owner_chk" CHECK ("department_id" IS NOT NULL OR "owner_unit_name" IS NOT NULL);
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_self_chk" CHECK ("course_id" <> "prerequisite_course_id");
ALTER TABLE "people" ADD CONSTRAINT "people_staff_type_chk" CHECK ("staff_type" IS NULL OR "person_type" = 'STAFF');
ALTER TABLE "people" ADD CONSTRAINT "people_entry_year_chk" CHECK ("entry_year" IS NULL OR "entry_year" BETWEEN 2500 AND 2700);
ALTER TABLE "advisor_assignments" ADD CONSTRAINT "advisor_assignments_self_chk" CHECK ("student_id" <> "advisor_id");
ALTER TABLE "curriculum_plan_slots" ADD CONSTRAINT "curriculum_plan_slots_count_chk" CHECK ("slot_count" > 0 AND "credits_per_slot" >= 0);
ALTER TABLE "companies" ADD CONSTRAINT "companies_phone_chk" CHECK ("contact_phone" IS NULL OR "contact_phone" ~ '^[0-9+]+$');
