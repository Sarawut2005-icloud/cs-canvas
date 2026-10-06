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
  CreateDepartmentDto,
  QueryDepartmentsDto,
  UpdateDepartmentDto,
} from './dto/department.dto';

const SELECT = {
  code: true,
  nameTh: true,
  nameEn: true,
  isActive: true,
  updatedAt: true,
  faculty: { select: { code: true, nameTh: true } },
} satisfies Prisma.DepartmentSelect;

type Row = Prisma.DepartmentGetPayload<{ select: typeof SELECT }>;

export function toDepartmentItem(row: Row) {
  return {
    code: row.code,
    nameTh: row.nameTh,
    nameEn: row.nameEn,
    facultyCode: row.faculty.code,
    faculty: { code: row.faculty.code, nameTh: row.faculty.nameTh },
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryDepartmentsDto) {
    const where: Prisma.DepartmentWhereInput = {
      ...activeWhere(query),
      ...textWhere(query.q, ['code', 'nameTh', 'nameEn']),
      ...(query.facultyCode ? { faculty: { code: query.facultyCode } } : {}),
    };
    return toPaginated(
      query,
      this.prisma.department.count({ where }),
      this.prisma.department.findMany({
        where,
        select: SELECT,
        orderBy: { code: 'asc' },
        ...pageArgs(query),
      }),
      toDepartmentItem,
    );
  }

  async get(code: string) {
    const row = await this.prisma.department.findUnique({
      where: { code },
      select: SELECT,
    });
    if (!row) throw new NotFoundException(`ไม่พบสาขา ${code}`);
    return toDepartmentItem(row);
  }

  private async facultyIdOf(facultyCode: string): Promise<string> {
    const f = await this.prisma.faculty.findUnique({
      where: { code: facultyCode },
      select: { id: true },
    });
    if (!f) throw new BadRequestException(`ไม่พบคณะ ${facultyCode}`);
    return f.id;
  }

  async create(dto: CreateDepartmentDto) {
    const { facultyCode, ...data } = dto;
    const facultyId = await this.facultyIdOf(facultyCode);
    try {
      return toDepartmentItem(
        await this.prisma.department.create({
          data: { ...data, facultyId },
          select: SELECT,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`สาขา ${dto.code} มีอยู่แล้ว`);
      throw error;
    }
  }

  async update(code: string, dto: UpdateDepartmentDto) {
    await this.get(code);
    const { facultyCode, ...data } = dto;
    const facultyId = facultyCode
      ? await this.facultyIdOf(facultyCode)
      : undefined;
    return toDepartmentItem(
      await this.prisma.department.update({
        where: { code },
        data: { ...data, ...(facultyId ? { facultyId } : {}) },
        select: SELECT,
      }),
    );
  }
}
