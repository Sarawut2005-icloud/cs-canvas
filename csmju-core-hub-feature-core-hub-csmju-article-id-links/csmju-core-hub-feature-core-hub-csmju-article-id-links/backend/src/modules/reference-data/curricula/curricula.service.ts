import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import { pageArgs, toPaginated } from '../common/to-paginated';
import {
  isUniqueViolation,
  activeWhere,
  textWhere,
} from '../common/reference-helpers';
import {
  CreateCurriculumDto,
  QueryCurriculaDto,
  UpdateCurriculumDto,
} from './dto/curriculum.dto';

const SELECT = {
  code: true,
  nationalCode: true,
  nameTh: true,
  nameEn: true,
  curriculumYear: true,
  totalCredits: true,
  isActive: true,
  updatedAt: true,
  department: { select: { code: true } },
} satisfies Prisma.CurriculumSelect;

type Row = Prisma.CurriculumGetPayload<{ select: typeof SELECT }>;

export function toCurriculumItem(row: Row) {
  return {
    code: row.code,
    nationalCode: row.nationalCode,
    nameTh: row.nameTh,
    nameEn: row.nameEn,
    curriculumYear: row.curriculumYear,
    totalCredits: row.totalCredits,
    departmentCode: row.department.code,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** วิชาแบบย่อในโครงสร้าง/แผนการเรียน — ไม่มี id */
const COURSE_BRIEF = {
  code: true,
  nameTh: true,
  nameEn: true,
  credits: true,
  creditPattern: true,
} satisfies Prisma.CourseSelect;

export interface StudyPlanTerm {
  year: number;
  semester: number;
  courses: {
    code: string;
    nameTh: string;
    nameEn: string | null;
    credits: number;
    creditPattern: string | null;
    category: string;
    isRequired: boolean;
    choiceGroup: string | null;
    isCountedInPlan: boolean;
    planNote: string | null;
  }[];
  electiveSlots: {
    label: string;
    category: string;
    slotCount: number;
    creditsPerSlot: number;
    courseGroup: string | null;
  }[];
  totalCredits: number;
}

@Injectable()
export class CurriculaService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryCurriculaDto) {
    const where: Prisma.CurriculumWhereInput = {
      ...activeWhere(query),
      ...textWhere(query.q, ['code', 'nameTh', 'nameEn']),
      ...(query.departmentCode
        ? { department: { code: query.departmentCode } }
        : {}),
    };
    return toPaginated(
      query,
      this.prisma.curriculum.count({ where }),
      this.prisma.curriculum.findMany({
        where,
        select: SELECT,
        orderBy: { code: 'asc' },
        ...pageArgs(query),
      }),
      toCurriculumItem,
    );
  }

  /**
   * หลักสูตรเดียว + ชื่อปริญญา ปรัชญา วัตถุประสงค์ PLO เกณฑ์หน่วยกิต
   * (คืนแม้ปิดใช้งาน · `activeOnly` = หน้าสาธารณะ — หลักสูตรที่ปิดตอบ 404)
   */
  async get(code: string, { activeOnly = false } = {}) {
    const args = {
      select: {
        ...SELECT,
        degreeFullTh: true,
        degreeShortTh: true,
        degreeFullEn: true,
        degreeShortEn: true,
        studyDurationYears: true,
        instructionLanguage: true,
        philosophyTh: true,
        significanceTh: true,
        visionTh: true,
        missionTh: true,
        objectives: {
          select: { code: true, titleTh: true, descriptionTh: true },
          orderBy: { sortOrder: 'asc' },
        },
        learningOutcomes: {
          select: {
            code: true,
            titleTh: true,
            subtitleTh: true,
            descriptionTh: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        creditRules: {
          select: { category: true, minCredits: true },
          orderBy: { category: 'asc' },
        },
      },
    } satisfies Omit<Prisma.CurriculumFindFirstArgs, 'where'>;
    // The signed-in route keeps its unique lookup; the public one adds isActive.
    const row = activeOnly
      ? await this.prisma.curriculum.findFirst({
          ...args,
          where: { code, isActive: true },
        })
      : await this.prisma.curriculum.findUnique({ ...args, where: { code } });
    if (!row) throw new NotFoundException(`ไม่พบหลักสูตร ${code}`);
    const { objectives, learningOutcomes, creditRules, ...base } = row;
    return {
      ...toCurriculumItem(base),
      degreeFullTh: row.degreeFullTh,
      degreeShortTh: row.degreeShortTh,
      degreeFullEn: row.degreeFullEn,
      degreeShortEn: row.degreeShortEn,
      studyDurationYears: row.studyDurationYears,
      instructionLanguage: row.instructionLanguage,
      philosophyTh: row.philosophyTh,
      significanceTh: row.significanceTh,
      visionTh: row.visionTh,
      missionTh: row.missionTh,
      objectives,
      learningOutcomes,
      creditRules,
    };
  }

  private async idOf(code: string, activeOnly = false): Promise<string> {
    const cur = activeOnly
      ? await this.prisma.curriculum.findFirst({
          where: { code, isActive: true },
          select: { id: true },
        })
      : await this.prisma.curriculum.findUnique({
          where: { code },
          select: { id: true },
        });
    if (!cur) throw new NotFoundException(`ไม่พบหลักสูตร ${code}`);
    return cur.id;
  }

  /** โครงสร้างหลักสูตร: กลุ่มวิชา + วิชาในกลุ่ม + เกณฑ์หน่วยกิตต่อหมวด */
  async structure(code: string, { activeOnly = false } = {}) {
    const curriculumId = await this.idOf(code, activeOnly);
    const [groups, ungrouped, creditRules] = await Promise.all([
      this.prisma.curriculumCourseGroup.findMany({
        where: { curriculumId },
        select: {
          category: true,
          parentNameTh: true,
          nameTh: true,
          listedCredits: true,
          availableCourseCount: true,
          courses: {
            select: {
              isRequired: true,
              recommendedYear: true,
              recommendedSemester: true,
              course: { select: COURSE_BRIEF },
            },
            orderBy: { course: { code: 'asc' } },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.curriculumCourse.findMany({
        where: { curriculumId, courseGroupId: null },
        select: {
          category: true,
          isRequired: true,
          choiceGroup: true,
          recommendedYear: true,
          recommendedSemester: true,
          course: { select: COURSE_BRIEF },
        },
        orderBy: { course: { code: 'asc' } },
      }),
      this.prisma.curriculumCreditRule.findMany({
        where: { curriculumId },
        select: { category: true, minCredits: true },
        orderBy: { category: 'asc' },
      }),
    ]);

    return {
      curriculumCode: code,
      creditRules,
      groups: groups.map((g) => ({
        category: g.category,
        parentNameTh: g.parentNameTh,
        nameTh: g.nameTh,
        listedCredits: g.listedCredits,
        availableCourseCount: g.availableCourseCount,
        courses: g.courses.map((c) => ({
          ...c.course,
          isRequired: c.isRequired,
          recommendedYear: c.recommendedYear,
          recommendedSemester: c.recommendedSemester,
        })),
      })),
      /** วิชาในแผนที่ไม่อยู่ในกลุ่มใด เช่น สหกิจ / การเรียนรู้อิสระ */
      otherCourses: ungrouped.map((c) => ({
        ...c.course,
        category: c.category,
        isRequired: c.isRequired,
        choiceGroup: c.choiceGroup,
        recommendedYear: c.recommendedYear,
        recommendedSemester: c.recommendedSemester,
      })),
    };
  }

  /** แผนการเรียนแนะนำ แยกตามชั้นปี/ภาค พร้อมช่องวิชาเลือก */
  async studyPlan(code: string, { activeOnly = false } = {}) {
    const curriculumId = await this.idOf(code, activeOnly);
    const [courses, slots] = await Promise.all([
      this.prisma.curriculumCourse.findMany({
        where: {
          curriculumId,
          recommendedYear: { not: null },
          recommendedSemester: { not: null },
        },
        select: {
          category: true,
          isRequired: true,
          choiceGroup: true,
          isCountedInPlan: true,
          planNote: true,
          recommendedYear: true,
          recommendedSemester: true,
          course: { select: COURSE_BRIEF },
        },
        orderBy: { course: { code: 'asc' } },
      }),
      this.prisma.curriculumPlanSlot.findMany({
        where: { curriculumId },
        select: {
          label: true,
          category: true,
          slotCount: true,
          creditsPerSlot: true,
          recommendedYear: true,
          recommendedSemester: true,
          courseGroup: { select: { nameTh: true } },
        },
        orderBy: { label: 'asc' },
      }),
    ]);

    const terms = new Map<string, StudyPlanTerm>();
    const termOf = (year: number, semester: number): StudyPlanTerm => {
      const key = `${year}-${semester}`;
      let t = terms.get(key);
      if (!t) {
        t = { year, semester, courses: [], electiveSlots: [], totalCredits: 0 };
        terms.set(key, t);
      }
      return t;
    };

    for (const c of courses) {
      if (c.recommendedYear === null || c.recommendedSemester === null)
        continue;
      const t = termOf(c.recommendedYear, c.recommendedSemester);
      t.courses.push({
        ...c.course,
        category: c.category,
        isRequired: c.isRequired,
        choiceGroup: c.choiceGroup,
        isCountedInPlan: c.isCountedInPlan,
        planNote: c.planNote,
      });
      if (c.isCountedInPlan) t.totalCredits += c.course.credits;
    }
    for (const s of slots) {
      const t = termOf(s.recommendedYear, s.recommendedSemester);
      t.electiveSlots.push({
        label: s.label,
        category: s.category,
        slotCount: s.slotCount,
        creditsPerSlot: s.creditsPerSlot,
        courseGroup: s.courseGroup?.nameTh ?? null,
      });
      t.totalCredits += s.slotCount * s.creditsPerSlot;
    }

    const plan = [...terms.values()].sort(
      (a, b) => a.year - b.year || a.semester - b.semester,
    );
    return {
      curriculumCode: code,
      totalCredits: plan.reduce((sum, t) => sum + t.totalCredits, 0),
      terms: plan,
    };
  }

  private async departmentIdOf(departmentCode: string): Promise<string> {
    const d = await this.prisma.department.findUnique({
      where: { code: departmentCode },
      select: { id: true },
    });
    if (!d) throw new BadRequestException(`ไม่พบสาขา ${departmentCode}`);
    return d.id;
  }

  async create(dto: CreateCurriculumDto) {
    const { departmentCode, ...data } = dto;
    const departmentId = await this.departmentIdOf(departmentCode);
    try {
      return toCurriculumItem(
        await this.prisma.curriculum.create({
          data: { ...data, departmentId },
          select: SELECT,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`หลักสูตร ${dto.code} มีอยู่แล้ว`);
      throw error;
    }
  }

  async update(code: string, dto: UpdateCurriculumDto) {
    await this.idOf(code);
    const { departmentCode, ...data } = dto;
    const departmentId = departmentCode
      ? await this.departmentIdOf(departmentCode)
      : undefined;
    return toCurriculumItem(
      await this.prisma.curriculum.update({
        where: { code },
        data: { ...data, ...(departmentId ? { departmentId } : {}) },
        select: SELECT,
      }),
    );
  }
}
