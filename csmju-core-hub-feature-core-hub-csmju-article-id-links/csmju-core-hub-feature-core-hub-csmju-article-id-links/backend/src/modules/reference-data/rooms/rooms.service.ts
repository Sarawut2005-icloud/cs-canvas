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
import { CreateRoomDto, QueryRoomsDto, UpdateRoomDto } from './dto/room.dto';

const SELECT = {
  code: true,
  nameTh: true,
  floor: true,
  capacity: true,
  roomType: true,
  facultyCode: true,
  photoUrl: true,
  isActive: true,
  updatedAt: true,
  building: { select: { code: true, nameTh: true } },
} satisfies Prisma.RoomSelect;

type Row = Prisma.RoomGetPayload<{ select: typeof SELECT }>;

export function toRoomItem(row: Row) {
  return {
    code: row.code,
    nameTh: row.nameTh,
    building: row.building.nameTh,
    buildingCode: row.building.code,
    floor: row.floor,
    capacity: row.capacity,
    roomType: row.roomType,
    facultyCode: row.facultyCode,
    photoUrl: row.photoUrl,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryRoomsDto) {
    const where: Prisma.RoomWhereInput = {
      ...activeWhere(query),
      ...textWhere(query.q, ['code', 'nameTh']),
      ...(query.facultyCode ? { facultyCode: query.facultyCode } : {}),
      ...(query.buildingCode ? { building: { code: query.buildingCode } } : {}),
      ...(query.roomType ? { roomType: query.roomType } : {}),
      ...(query.floor !== undefined ? { floor: query.floor } : {}),
    };
    return toPaginated(
      query,
      this.prisma.room.count({ where }),
      this.prisma.room.findMany({
        where,
        select: SELECT,
        orderBy: { code: 'asc' },
        ...pageArgs(query),
      }),
      toRoomItem,
    );
  }

  async get(code: string) {
    const row = await this.prisma.room.findUnique({
      where: { code },
      select: SELECT,
    });
    if (!row) throw new NotFoundException(`ไม่พบห้อง ${code}`);
    return toRoomItem(row);
  }

  private async buildingIdOf(buildingCode: string): Promise<string> {
    const b = await this.prisma.building.findUnique({
      where: { code: buildingCode },
      select: { id: true },
    });
    if (!b) throw new BadRequestException(`ไม่พบอาคาร ${buildingCode}`);
    return b.id;
  }

  private async assertFaculty(facultyCode: string | undefined): Promise<void> {
    if (!facultyCode) return;
    const f = await this.prisma.faculty.findUnique({
      where: { code: facultyCode },
      select: { code: true },
    });
    if (!f) throw new BadRequestException(`ไม่พบคณะ ${facultyCode}`);
  }

  async create(dto: CreateRoomDto) {
    const { buildingCode, ...data } = dto;
    const buildingId = await this.buildingIdOf(buildingCode);
    await this.assertFaculty(dto.facultyCode);
    try {
      return toRoomItem(
        await this.prisma.room.create({
          data: { ...data, buildingId },
          select: SELECT,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`ห้อง ${dto.code} มีอยู่แล้ว`);
      throw error;
    }
  }

  async update(code: string, dto: UpdateRoomDto) {
    await this.get(code);
    const { buildingCode, ...data } = dto;
    const buildingId = buildingCode
      ? await this.buildingIdOf(buildingCode)
      : undefined;
    await this.assertFaculty(dto.facultyCode);
    return toRoomItem(
      await this.prisma.room.update({
        where: { code },
        data: { ...data, ...(buildingId ? { buildingId } : {}) },
        select: SELECT,
      }),
    );
  }
}
