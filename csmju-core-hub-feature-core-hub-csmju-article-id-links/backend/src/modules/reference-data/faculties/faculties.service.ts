import {
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
  CreateFacultyDto,
  QueryFacultiesDto,
  UpdateFacultyDto,
} from './dto/faculty.dto';

const SELECT = {
  code: true,
  nameTh: true,
  nameEn: true,
  isActive: true,
  updatedAt: true,
} satisfies Prisma.FacultySelect;

type Row = Prisma.FacultyGetPayload<{ select: typeof SELECT }>;

export function toFacultyItem(row: Row) {
  return { ...row, updatedAt: row.updatedAt.toISOString() };
}

@Injectable()
export class FacultiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryFacultiesDto) {
    const where: Prisma.FacultyWhereInput = {
      ...activeWhere(query),
      ...textWhere(query.q, ['code', 'nameTh', 'nameEn']),
    };
    return toPaginated(
      query,
      this.prisma.faculty.count({ where }),
      this.prisma.faculty.findMany({
        where,
        select: SELECT,
        orderBy: { code: 'asc' },
        ...pageArgs(query),
      }),
      toFacultyItem,
    );
  }

  async get(code: string) {
    const row = await this.prisma.faculty.findUnique({
      where: { code },
      select: SELECT,
    });
    if (!row) throw new NotFoundException(`ไม่พบคณะ ${code}`);
    return toFacultyItem(row);
  }

  async create(dto: CreateFacultyDto) {
    try {
      return toFacultyItem(
        await this.prisma.faculty.create({ data: dto, select: SELECT }),
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`คณะ ${dto.code} มีอยู่แล้ว`);
      throw error;
    }
  }

  async update(code: string, dto: UpdateFacultyDto) {
    await this.get(code);
    return toFacultyItem(
      await this.prisma.faculty.update({
        where: { code },
        data: dto,
        select: SELECT,
      }),
    );
  }
}
