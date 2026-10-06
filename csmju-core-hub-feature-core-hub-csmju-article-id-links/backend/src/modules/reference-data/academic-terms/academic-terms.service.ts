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
  fromDateOnly,
  isUniqueViolation,
  toDateOnly,
  activeWhere,
  textWhere,
} from '../common/reference-helpers';
import {
  CreateAcademicTermDto,
  QueryAcademicTermsDto,
  UpdateAcademicTermDto,
} from './dto/academic-term.dto';

const SELECT = {
  code: true,
  academicYear: true,
  semester: true,
  startDate: true,
  endDate: true,
  isCurrent: true,
  isActive: true,
  updatedAt: true,
} satisfies Prisma.TermSelect;

type Row = Prisma.TermGetPayload<{ select: typeof SELECT }>;

export function toTermItem(row: Row) {
  return {
    ...row,
    startDate: toDateOnly(row.startDate),
    endDate: toDateOnly(row.endDate),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** ภาคการศึกษา — เก็บในตาราง terms (มีปฏิทิน term_events ผูกอยู่) */
@Injectable()
export class AcademicTermsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryAcademicTermsDto) {
    const where: Prisma.TermWhereInput = {
      ...activeWhere(query),
      ...textWhere(query.q, ['code']),
      ...(query.academicYear !== undefined
        ? { academicYear: query.academicYear }
        : {}),
    };
    return toPaginated(
      query,
      this.prisma.term.count({ where }),
      this.prisma.term.findMany({
        where,
        select: SELECT,
        orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }],
        ...pageArgs(query),
      }),
      toTermItem,
    );
  }

  async current() {
    const row = await this.prisma.term.findFirst({
      where: { isCurrent: true },
      select: SELECT,
    });
    if (!row) throw new NotFoundException('ยังไม่ได้กำหนดภาคการศึกษาปัจจุบัน');
    return toTermItem(row);
  }

  async get(code: string) {
    const row = await this.prisma.term.findUnique({
      where: { code },
      select: SELECT,
    });
    if (!row) throw new NotFoundException(`ไม่พบภาคการศึกษา ${code}`);
    return toTermItem(row);
  }

  /** ปฏิทินของภาค (endpoint เพิ่มเติม — ประกาศไว้ใน reference-data.md) */
  async events(code: string) {
    const term = await this.prisma.term.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!term) throw new NotFoundException(`ไม่พบภาคการศึกษา ${code}`);
    const rows = await this.prisma.termEvent.findMany({
      where: { termId: term.id },
      select: {
        eventCode: true,
        parentEventCode: true,
        nameTh: true,
        startsAt: true,
        endsAt: true,
        note: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((r) => ({
      ...r,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
    }));
  }

  async create(dto: CreateAcademicTermDto) {
    if (dto.code !== `${dto.academicYear}-${dto.semester}`) {
      throw new BadRequestException(
        'code ต้องเท่ากับ <academicYear>-<semester>',
      );
    }
    if (dto.endDate < dto.startDate)
      throw new BadRequestException('endDate ต้องไม่ก่อน startDate');
    try {
      return toTermItem(
        await this.prisma.term.create({
          data: {
            code: dto.code,
            academicYear: dto.academicYear,
            semester: dto.semester,
            startDate: fromDateOnly(dto.startDate),
            endDate: fromDateOnly(dto.endDate),
          },
          select: SELECT,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`ภาคการศึกษา ${dto.code} มีอยู่แล้ว`);
      throw error;
    }
  }

  async update(code: string, dto: UpdateAcademicTermDto) {
    const existing = await this.get(code);
    const start = dto.startDate ?? existing.startDate;
    const end = dto.endDate ?? existing.endDate;
    if (end < start)
      throw new BadRequestException('endDate ต้องไม่ก่อน startDate');
    return toTermItem(
      await this.prisma.term.update({
        where: { code },
        data: {
          ...(dto.startDate ? { startDate: fromDateOnly(dto.startDate) } : {}),
          ...(dto.endDate ? { endDate: fromDateOnly(dto.endDate) } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        select: SELECT,
      }),
    );
  }

  /** ปิดภาคปัจจุบันเดิมแล้วเปิดภาคใหม่ใน transaction เดียว — มีภาคปัจจุบันได้แถวเดียวเสมอ */
  async setCurrent(code: string) {
    const target = await this.get(code);
    if (!target.isActive)
      throw new BadRequestException(`ภาคการศึกษา ${code} ถูกปิดใช้งาน`);
    const [, updated] = await this.prisma.$transaction([
      this.prisma.term.updateMany({
        where: { isCurrent: true, NOT: { code } },
        data: { isCurrent: false },
      }),
      this.prisma.term.update({
        where: { code },
        data: { isCurrent: true },
        select: SELECT,
      }),
    ]);
    return toTermItem(updated);
  }
}
