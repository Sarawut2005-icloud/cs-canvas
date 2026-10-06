import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CurriculumCategory,
  Prisma,
} from '../../../../generated/prisma/client';
import { isUniqueViolation } from '../common/reference-helpers';
import {
  AddCurriculumCourseDto,
  CreateCourseGroupDto,
  CreatePlanSlotDto,
  CURRICULUM_CATEGORIES,
  PutCreditRuleDto,
  UpdateCourseGroupDto,
  UpdateCurriculumCourseDto,
  UpdatePlanSlotDto,
} from './dto/curriculum-structure.dto';

const GROUP_SELECT = {
  id: true,
  category: true,
  parentNameTh: true,
  nameTh: true,
  listedCredits: true,
  availableCourseCount: true,
  sortOrder: true,
} satisfies Prisma.CurriculumCourseGroupSelect;

const COURSE_SELECT = {
  category: true,
  courseGroupId: true,
  isRequired: true,
  choiceGroup: true,
  isCountedInPlan: true,
  planNote: true,
  recommendedYear: true,
  recommendedSemester: true,
  course: {
    select: {
      code: true,
      nameTh: true,
      nameEn: true,
      credits: true,
      creditPattern: true,
    },
  },
} satisfies Prisma.CurriculumCourseSelect;

const SLOT_SELECT = {
  id: true,
  category: true,
  recommendedYear: true,
  recommendedSemester: true,
  slotCount: true,
  creditsPerSlot: true,
  label: true,
  courseGroupId: true,
  note: true,
} satisfies Prisma.CurriculumPlanSlotSelect;

type CourseRow = Prisma.CurriculumCourseGetPayload<{
  select: typeof COURSE_SELECT;
}>;

/** รายวิชาในหลักสูตรแบบแบน — `courseCode` เป็นคีย์ (ไม่ซ้ำในหลักสูตรเดียวกัน) */
function toCourseItem({ course, ...rest }: CourseRow) {
  return {
    courseCode: course.code,
    nameTh: course.nameTh,
    nameEn: course.nameEn,
    credits: course.credits,
    creditPattern: course.creditPattern,
    ...rest,
  };
}

/** ตัดค่า null ของ field ที่ฐานข้อมูลห้ามว่าง (PATCH ส่ง null มา = ไม่แก้) */
function withoutNulls<T extends object>(data: T, keys: (keyof T)[]): T {
  const copy = { ...data };
  for (const key of keys) if (copy[key] === null) delete copy[key];
  return copy;
}

/**
 * โครงสร้างหลักสูตร (กลุ่มวิชา · รายวิชา · เกณฑ์หน่วยกิต) และช่องวิชาเลือกในแผนการเรียน
 * — ฝั่งเขียนของหน้าหลังบ้าน (`reference:manage`) · ฝั่งอ่านของระบบย่อยยังเป็น
 * `GET /curricula/:code/structure` และ `/study-plan` ใน CurriculaService
 *
 * หลังเปิดให้แก้ที่นี่ หน้าเว็บคือข้อมูลหลัก — ห้ามรันส่วนหลักสูตรของ master-data.sql ซ้ำ
 * (backend/prisma/data/README.md)
 */
@Injectable()
export class CurriculumStructureService {
  constructor(private readonly prisma: PrismaService) {}

  private async curriculumIdOf(code: string): Promise<string> {
    const cur = await this.prisma.curriculum.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!cur) throw new NotFoundException(`ไม่พบหลักสูตร ${code}`);
    return cur.id;
  }

  /** กลุ่มวิชาต้องอยู่ในหลักสูตรเดียวกัน — กันผูกกลุ่มของหลักสูตรอื่น */
  private async assertGroupIn(
    curriculumId: string,
    groupId: string | null | undefined,
  ) {
    if (!groupId) return;
    const group = await this.prisma.curriculumCourseGroup.findFirst({
      where: { id: groupId, curriculumId },
      select: { id: true },
    });
    if (!group)
      throw new BadRequestException('ไม่พบกลุ่มวิชานี้ในหลักสูตรเดียวกัน');
  }

  /** ปีและภาคในแผนต้องมาคู่กัน (ทั้งคู่ หรือว่างทั้งคู่) */
  private assertYearPair(year: number | null, semester: number | null) {
    if ((year === null) !== (semester === null))
      throw new BadRequestException(
        'ต้องระบุชั้นปีและภาคเรียนในแผนคู่กัน หรือเว้นว่างทั้งคู่',
      );
  }

  // ---------- กลุ่มวิชา ----------

  async listGroups(code: string) {
    const curriculumId = await this.curriculumIdOf(code);
    const groups = await this.prisma.curriculumCourseGroup.findMany({
      where: { curriculumId },
      select: { ...GROUP_SELECT, _count: { select: { courses: true } } },
      orderBy: [{ sortOrder: 'asc' }, { nameTh: 'asc' }],
    });
    return groups.map(({ _count, ...g }) => ({
      ...g,
      courseCount: _count.courses,
    }));
  }

  async createGroup(code: string, dto: CreateCourseGroupDto) {
    const curriculumId = await this.curriculumIdOf(code);
    try {
      return await this.prisma.curriculumCourseGroup.create({
        data: { ...dto, curriculumId },
        select: GROUP_SELECT,
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`มีกลุ่มวิชา "${dto.nameTh}" อยู่แล้ว`);
      throw error;
    }
  }

  private async groupIdIn(curriculumId: string, groupId: string) {
    const group = await this.prisma.curriculumCourseGroup.findFirst({
      where: { id: groupId, curriculumId },
      select: { id: true, nameTh: true },
    });
    if (!group) throw new NotFoundException('ไม่พบกลุ่มวิชานี้');
    return group;
  }

  async updateGroup(code: string, groupId: string, dto: UpdateCourseGroupDto) {
    const curriculumId = await this.curriculumIdOf(code);
    await this.groupIdIn(curriculumId, groupId);
    const data = withoutNulls(dto, ['category', 'parentNameTh', 'nameTh']);
    try {
      return await this.prisma.curriculumCourseGroup.update({
        where: { id: groupId },
        data,
        select: GROUP_SELECT,
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`มีกลุ่มวิชา "${dto.nameTh}" อยู่แล้ว`);
      throw error;
    }
  }

  /** ลบได้เฉพาะกลุ่มที่ไม่มีรายวิชาและช่องวิชาเลือกผูกอยู่ — ไม่ย้ายรายวิชาให้เงียบ ๆ */
  async deleteGroup(code: string, groupId: string) {
    const curriculumId = await this.curriculumIdOf(code);
    const group = await this.groupIdIn(curriculumId, groupId);
    const [courses, slots] = await Promise.all([
      this.prisma.curriculumCourse.count({ where: { courseGroupId: groupId } }),
      this.prisma.curriculumPlanSlot.count({
        where: { courseGroupId: groupId },
      }),
    ]);
    if (courses > 0 || slots > 0)
      throw new ConflictException(
        `กลุ่มวิชา "${group.nameTh}" ยังมีรายวิชา ${courses} วิชาและช่องในแผน ${slots} ช่อง — ย้ายหรือลบออกก่อน`,
      );
    await this.prisma.curriculumCourseGroup.delete({ where: { id: groupId } });
    return { id: groupId, deleted: true };
  }

  // ---------- รายวิชาในหลักสูตร ----------

  async listCourses(code: string) {
    const curriculumId = await this.curriculumIdOf(code);
    const rows = await this.prisma.curriculumCourse.findMany({
      where: { curriculumId },
      select: COURSE_SELECT,
      orderBy: { course: { code: 'asc' } },
    });
    return rows.map(toCourseItem);
  }

  private async courseOf(curriculumId: string, courseCode: string) {
    const row = await this.prisma.curriculumCourse.findFirst({
      where: { curriculumId, course: { code: courseCode } },
      select: {
        id: true,
        recommendedYear: true,
        recommendedSemester: true,
      },
    });
    if (!row)
      throw new NotFoundException(`ไม่พบรายวิชา ${courseCode} ในหลักสูตรนี้`);
    return row;
  }

  async addCourse(code: string, dto: AddCurriculumCourseDto) {
    const curriculumId = await this.curriculumIdOf(code);
    const { courseCode, ...fields } = dto;
    const course = await this.prisma.course.findUnique({
      where: { code: courseCode },
      select: { id: true },
    });
    if (!course) throw new BadRequestException(`ไม่พบรายวิชา ${courseCode}`);
    await this.assertGroupIn(curriculumId, fields.courseGroupId);
    this.assertYearPair(
      fields.recommendedYear ?? null,
      fields.recommendedSemester ?? null,
    );

    const data = withoutNulls(fields, ['isRequired', 'isCountedInPlan']);
    try {
      return toCourseItem(
        await this.prisma.curriculumCourse.create({
          data: { ...data, curriculumId, courseId: course.id },
          select: COURSE_SELECT,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(
          `รายวิชา ${courseCode} อยู่ในหลักสูตรนี้แล้ว`,
        );
      throw error;
    }
  }

  async updateCourse(
    code: string,
    courseCode: string,
    dto: UpdateCurriculumCourseDto,
  ) {
    const curriculumId = await this.curriculumIdOf(code);
    const row = await this.courseOf(curriculumId, courseCode);
    await this.assertGroupIn(curriculumId, dto.courseGroupId);
    this.assertYearPair(
      dto.recommendedYear !== undefined
        ? dto.recommendedYear
        : row.recommendedYear,
      dto.recommendedSemester !== undefined
        ? dto.recommendedSemester
        : row.recommendedSemester,
    );
    const data = withoutNulls(dto, [
      'category',
      'isRequired',
      'isCountedInPlan',
    ]);
    return toCourseItem(
      await this.prisma.curriculumCourse.update({
        where: { id: row.id },
        data,
        select: COURSE_SELECT,
      }),
    );
  }

  async removeCourse(code: string, courseCode: string) {
    const curriculumId = await this.curriculumIdOf(code);
    const row = await this.courseOf(curriculumId, courseCode);
    await this.prisma.curriculumCourse.delete({ where: { id: row.id } });
    return { courseCode, deleted: true };
  }

  // ---------- เกณฑ์หน่วยกิตต่อหมวด ----------

  private categoryOf(raw: string): CurriculumCategory {
    const category = raw.toUpperCase() as CurriculumCategory;
    if (!CURRICULUM_CATEGORIES.includes(category))
      throw new BadRequestException(
        `หมวดต้องเป็น ${CURRICULUM_CATEGORIES.join(' / ')}`,
      );
    return category;
  }

  /** สร้างหรือแก้เกณฑ์ของหมวด (หนึ่งหมวดมีเกณฑ์เดียว) */
  async putCreditRule(
    code: string,
    rawCategory: string,
    dto: PutCreditRuleDto,
  ) {
    const category = this.categoryOf(rawCategory);
    const curriculumId = await this.curriculumIdOf(code);
    return this.prisma.curriculumCreditRule.upsert({
      where: { curriculumId_category: { curriculumId, category } },
      create: { curriculumId, category, minCredits: dto.minCredits },
      update: { minCredits: dto.minCredits },
      select: { category: true, minCredits: true },
    });
  }

  async deleteCreditRule(code: string, rawCategory: string) {
    const category = this.categoryOf(rawCategory);
    const curriculumId = await this.curriculumIdOf(code);
    const { count } = await this.prisma.curriculumCreditRule.deleteMany({
      where: { curriculumId, category },
    });
    if (count === 0)
      throw new NotFoundException('หลักสูตรนี้ไม่มีเกณฑ์หน่วยกิตของหมวดนี้');
    return { category, deleted: true };
  }

  // ---------- ช่องวิชาเลือกในแผนการเรียน ----------

  async listPlanSlots(code: string) {
    const curriculumId = await this.curriculumIdOf(code);
    return this.prisma.curriculumPlanSlot.findMany({
      where: { curriculumId },
      select: SLOT_SELECT,
      orderBy: [
        { recommendedYear: 'asc' },
        { recommendedSemester: 'asc' },
        { label: 'asc' },
      ],
    });
  }

  private slotConflict(error: unknown): never {
    if (isUniqueViolation(error))
      throw new ConflictException(
        'ภาคเรียนนี้มีช่องวิชาเลือกชื่อนี้อยู่แล้ว กรุณาใช้ชื่ออื่น',
      );
    throw error;
  }

  async createPlanSlot(code: string, dto: CreatePlanSlotDto) {
    const curriculumId = await this.curriculumIdOf(code);
    await this.assertGroupIn(curriculumId, dto.courseGroupId);
    try {
      return await this.prisma.curriculumPlanSlot.create({
        data: { ...dto, curriculumId },
        select: SLOT_SELECT,
      });
    } catch (error) {
      this.slotConflict(error);
    }
  }

  private async slotIdIn(curriculumId: string, slotId: string) {
    const slot = await this.prisma.curriculumPlanSlot.findFirst({
      where: { id: slotId, curriculumId },
      select: { id: true },
    });
    if (!slot) throw new NotFoundException('ไม่พบช่องวิชาเลือกนี้');
  }

  async updatePlanSlot(code: string, slotId: string, dto: UpdatePlanSlotDto) {
    const curriculumId = await this.curriculumIdOf(code);
    await this.slotIdIn(curriculumId, slotId);
    await this.assertGroupIn(curriculumId, dto.courseGroupId);
    const data = withoutNulls(dto, [
      'category',
      'recommendedYear',
      'recommendedSemester',
      'slotCount',
      'creditsPerSlot',
      'label',
    ]);
    try {
      return await this.prisma.curriculumPlanSlot.update({
        where: { id: slotId },
        data,
        select: SLOT_SELECT,
      });
    } catch (error) {
      this.slotConflict(error);
    }
  }

  async deletePlanSlot(code: string, slotId: string) {
    const curriculumId = await this.curriculumIdOf(code);
    await this.slotIdIn(curriculumId, slotId);
    await this.prisma.curriculumPlanSlot.delete({ where: { id: slotId } });
    return { id: slotId, deleted: true };
  }
}
