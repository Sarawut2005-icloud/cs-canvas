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
  CreateBuildingDto,
  QueryBuildingsDto,
  UpdateBuildingDto,
} from './dto/building.dto';

const SELECT = {
  code: true,
  nameTh: true,
  nameEn: true,
  latitude: true,
  longitude: true,
  isActive: true,
  updatedAt: true,
} satisfies Prisma.BuildingSelect;

type Row = Prisma.BuildingGetPayload<{ select: typeof SELECT }>;

export function toBuildingItem(row: Row) {
  return { ...row, updatedAt: row.updatedAt.toISOString() };
}

@Injectable()
export class BuildingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryBuildingsDto) {
    const where: Prisma.BuildingWhereInput = {
      ...activeWhere(query),
      ...textWhere(query.q, ['code', 'nameTh', 'nameEn']),
    };
    return toPaginated(
      query,
      this.prisma.building.count({ where }),
      this.prisma.building.findMany({
        where,
        select: SELECT,
        orderBy: { code: 'asc' },
        ...pageArgs(query),
      }),
      toBuildingItem,
    );
  }

  async get(code: string) {
    const row = await this.prisma.building.findUnique({
      where: { code },
      select: SELECT,
    });
    if (!row) throw new NotFoundException(`ไม่พบอาคาร ${code}`);
    return toBuildingItem(row);
  }

  async create(dto: CreateBuildingDto) {
    try {
      return toBuildingItem(
        await this.prisma.building.create({ data: dto, select: SELECT }),
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`อาคาร ${dto.code} มีอยู่แล้ว`);
      throw error;
    }
  }

  async update(code: string, dto: UpdateBuildingDto) {
    await this.get(code);
    return toBuildingItem(
      await this.prisma.building.update({
        where: { code },
        data: dto,
        select: SELECT,
      }),
    );
  }
}
