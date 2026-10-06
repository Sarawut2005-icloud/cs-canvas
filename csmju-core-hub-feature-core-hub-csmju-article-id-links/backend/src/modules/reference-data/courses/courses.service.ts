import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import { pageArgs, toPaginated } from '../common/to-paginated';
import { isUniqueViolation, activeWhere } from '../common/reference-helpers';
import {
  CreateCourseDto,
  QueryCoursesDto,
  UpdateCourseDto,
} from './dto/course.dto';

const SELECT = {
  code: true,
  baseCode: true,
  registrarCode: true,
  nameTh: true,
  nameEn: true,
  credits: true,
  creditPattern: true,
  lectureHours: true,
  labHours: true,
  selfStudyHours: true,
  ownerUnitName: true,
  categoryLabel: true,
  descriptionTh: true,
  isActive: true,
  updatedAt: true,
  department: { select: { code: true } },
} satisfies Prisma.CourseSelect;

type Row = Prisma.CourseGetPayload<{ select: typeof SELECT }>;

export function toCourseItem(row: Row) {
  return {
    code: row.code,
    baseCode: row.baseCode,
    registrarCode: row.registrarCode,
    nameTh: row.nameTh,
    nameEn: row.nameEn,
    credits: row.credits,
    creditPattern: row.creditPattern,
    lectureHours: row.lectureHours,
    labHours: row.labHours,
    selfStudyHours: row.selfStudyHours,
    ownerUnitName: row.ownerUnitName,
    categoryLabel: row.categoryLabel,
    descriptionTh: row.descriptionTh,
    departmentCode: row.department?.code ?? null,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryCoursesDto) {
    const q = query.q?.trim();
    const where: Prisma.CourseWhereInput = {
      ...activeWhere(query),
      ...(query.baseCode ? { baseCode: query.baseCode } : {}),
      ...(query.departmentCode
        ? { department: { code: query.departmentCode } }
        : {}),
      ...(query.curriculumCode
        ? {
            curriculumCourses: {
              some: { curriculum: { code: query.curriculumCode } },
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { nameTh: { contains: q, mode: 'insensitive' } },
              { nameEn: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return toPaginated(
      query,
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        select: SELECT,
        orderBy: { code: 'asc' },
        ...pageArgs(query),
      }),
      toCourseItem,
    );
  }

  /** รายวิชาเดียว + อยู่ในหลักสูตรไหน กลุ่มไหน ปีไหน + วิชาบังคับก่อน (คืนแม้ปิดใช้งาน) */
  async get(code: string) {
    const row = await this.prisma.course.findUnique({
      where: { code },
      select: {
        ...SELECT,
        curriculumCourses: {
          select: {
            category: true,
            isRequired: true,
            choiceGroup: true,
            recommendedYear: true,
            recommendedSemester: true,
            curriculum: { select: { code: true } },
            courseGroup: { select: { nameTh: true } },
          },
        },
        prerequisites: {
          select: {
            note: true,
            prerequisiteCourse: { select: { code: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException(`ไม่พบรายวิชา ${code}`);
    const { curriculumCourses, prerequisites, ...course } = row;
    return {
      ...toCourseItem(course),
      curricula: curriculumCourses.map((cc) => ({
        curriculumCode: cc.curriculum.code,
        category: cc.category,
        courseGroup: cc.courseGroup?.nameTh ?? null,
        isRequired: cc.isRequired,
        choiceGroup: cc.choiceGroup,
        recommendedYear: cc.recommendedYear,
        recommendedSemester: cc.recommendedSemester,
      })),
      prerequisites: prerequisites.map((p) => ({
        code: p.prerequisiteCourse.code,
        note: p.note,
      })),
    };
  }

  private async assertExists(code: string): Promise<void> {
    const row = await this.prisma.course.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!row) throw new NotFoundException(`ไม่พบรายวิชา ${code}`);
  }

  private async departmentIdOf(departmentCode: string): Promise<string> {
    const d = await this.prisma.department.findUnique({
      where: { code: departmentCode },
      select: { id: true },
    });
    if (!d) throw new BadRequestException(`ไม่พบสาขา ${departmentCode}`);
    return d.id;
  }

  async create(dto: CreateCourseDto) {
    const { departmentCode, ...data } = dto;
    const departmentId = departmentCode
      ? await this.departmentIdOf(departmentCode)
      : undefined;
    try {
      return toCourseItem(
        await this.prisma.course.create({
          data: { ...data, ...(departmentId ? { departmentId } : {}) },
          select: SELECT,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`รายวิชา ${dto.code} มีอยู่แล้ว`);
      throw error;
    }
  }

  async update(code: string, dto: UpdateCourseDto) {
    await this.assertExists(code);
    const { departmentCode, ...data } = dto;
    const departmentId = departmentCode
      ? await this.departmentIdOf(departmentCode)
      : undefined;
    return toCourseItem(
      await this.prisma.course.update({
        where: { code },
        data: { ...data, ...(departmentId ? { departmentId } : {}) },
        select: SELECT,
      }),
    );
  }
}
