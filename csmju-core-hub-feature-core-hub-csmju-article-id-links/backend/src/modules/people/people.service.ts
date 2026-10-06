import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { Paginated } from '../../common/pagination/paginated';
import {
  PERSON_STATUS_FILTERS,
  PeopleFilterDto,
  QueryPeopleDto,
} from './dto/query-people.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { syncRegistryRole, syncStaffRole } from '../users/users.service';

/** field ที่ตอบออกไป — ต้องตรงกับ type `Person` ใน frontend/app/lib/api.ts */
const PERSON_SELECT = {
  personCode: true,
  personType: true,
  staffType: true,
  academicTitle: true,
  jobTitle: true,
  fullNameTh: true,
  fullNameEn: true,
  universityEmail: true,
  entryYear: true,
  status: true,
  coreUserId: true,
  faculty: { select: { code: true, nameTh: true } },
  department: { select: { code: true, nameTh: true } },
  curriculum: { select: { code: true, nameTh: true, curriculumYear: true } },
} satisfies Prisma.PersonSelect;

/** กลุ่มเรียนพร้อมคาบ — ใช้ทั้งตารางเรียนและตารางสอน */
const SECTION_SCHEDULE_SELECT = {
  sectionNo: true,
  term: { select: { code: true } },
  course: { select: { code: true, nameTh: true, nameEn: true } },
  schedules: {
    select: {
      id: true,
      scheduleType: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      room: {
        select: {
          code: true,
          nameTh: true,
          building: { select: { nameTh: true } },
        },
      },
    },
  },
} satisfies Prisma.CourseSectionSelect;

type SectionScheduleRow = Prisma.CourseSectionGetPayload<{
  select: typeof SECTION_SCHEDULE_SELECT;
}>;

/** Whether the person takes the class or teaches it. */
export type Involvement = 'LEARN' | 'TEACH';

function toSlots(section: SectionScheduleRow, involvement: Involvement) {
  return section.schedules.map(({ room, ...slot }) => ({
    ...slot,
    involvement,
    termCode: section.term.code,
    sectionNo: section.sectionNo,
    course: section.course,
    room: room
      ? {
          code: room.code,
          nameTh: room.nameTh,
          buildingNameTh: room.building.nameTh,
        }
      : null,
  }));
}

type PersonRow = Prisma.PersonGetPayload<{ select: typeof PERSON_SELECT }>;
type StatusFilter = (typeof PERSON_STATUS_FILTERS)[number];

/** อีเมลส่งออกเฉพาะผู้ที่มีสิทธิ์ people:contact:read */
function toPerson(p: PersonRow, withContact: boolean) {
  const { universityEmail, ...rest } = p;
  return withContact ? { ...rest, universityEmail } : rest;
}

function statusWhere(status: StatusFilter): Prisma.PersonWhereInput {
  return status === 'ALL' ? {} : { status };
}

/** Prisma unique violation (P2002) */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** หัวคอลัมน์ของไฟล์ export — ไม่มีอีเมลหรือข้อมูลติดต่อ (ข้อ 2.9) */
const EXPORT_HEADER = ['รหัส', 'ชื่อ-สกุล', 'ปีที่เข้า', 'หลักสูตร', 'สถานะ'];

/** ให้ Excel เปิดไฟล์ UTF-8 แล้วอ่านภาษาไทยถูก */
const UTF8_BOM = String.fromCharCode(0xfeff);

/**
 * ค่าหนึ่งช่องของ CSV: ครอบด้วย " เมื่อมี , " หรือขึ้นบรรทัด และใส่ ' นำหน้าค่าที่ขึ้นต้นด้วย
 * = + - @ (กัน Excel ตีความเป็นสูตร — CSV injection)
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function filterWhere(query: PeopleFilterDto): Prisma.PersonWhereInput {
  const q = query.q?.trim();
  return {
    ...statusWhere(query.status),
    ...(query.personType ? { personType: query.personType } : {}),
    ...(query.entryYear !== undefined ? { entryYear: query.entryYear } : {}),
    ...(query.departmentCode
      ? { department: { code: query.departmentCode } }
      : {}),
    ...(q
      ? {
          OR: [
            { personCode: { contains: q } },
            { fullNameTh: { contains: q, mode: 'insensitive' } },
            { fullNameEn: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

/**
 * ข้อมูลบุคคล — ไม่ใช่ข้อมูลอ้างอิง จึงไม่ใช้สัญญา reference และห้าม cache
 * (SHARED_DATA_HANDOFF ข้อ 1.9 · MASTER_DATA_FOLLOWUP_HANDOFF F4/F5)
 */
@Injectable()
export class PeopleService {
  private readonly logger = new Logger(PeopleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** ข้อมูลของผู้ใช้ที่ login — ยังไม่ผูกบัญชีคืน null (200 + data: null) */
  async findMe(coreUserId: string | undefined) {
    if (!coreUserId) return null;
    const person = await this.prisma.person.findUnique({
      where: { coreUserId },
      select: {
        ...PERSON_SELECT,
        advisors: {
          where: { isActive: true },
          select: {
            advisor: {
              select: {
                personCode: true,
                fullNameTh: true,
                universityEmail: true,
              },
            },
          },
        },
      },
    });
    if (!person) return null;
    const { advisors, ...rest } = person;
    return { ...rest, advisors: advisors.map((a) => a.advisor) };
  }

  /**
   * คาบทุกคาบของภาคปัจจุบัน — นักศึกษาได้จากกลุ่มเรียนที่ลงทะเบียน
   * บุคลากรได้จากกลุ่มเรียนที่สอน (involvement: 'LEARN' | 'TEACH')
   * เรียงตามวันแล้วเวลาเริ่ม — ฝั่งหน้าเว็บเลือกคาบของวันนี้เอง
   */
  async findMySchedule(coreUserId: string | undefined) {
    if (!coreUserId) return [];
    const person = await this.prisma.person.findUnique({
      where: { coreUserId },
      select: { id: true },
    });
    if (!person) return [];

    const current = { term: { isCurrent: true } };
    const [enrolled, taught] = await Promise.all([
      this.prisma.courseSection.findMany({
        where: { ...current, enrollments: { some: { studentId: person.id } } },
        select: SECTION_SCHEDULE_SELECT,
      }),
      this.prisma.courseSection.findMany({
        where: {
          ...current,
          instructors: { some: { instructorId: person.id } },
        },
        select: SECTION_SCHEDULE_SELECT,
      }),
    ]);

    return [
      ...enrolled.map((section) => toSlots(section, 'LEARN')),
      ...taught.map((section) => toSlots(section, 'TEACH')),
    ]
      .flat()
      .sort(
        (a, b) =>
          a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
      );
  }

  async list(query: QueryPeopleDto, withContact: boolean) {
    const where = filterWhere(query);
    const [total, rows] = await Promise.all([
      this.prisma.person.count({ where }),
      this.prisma.person.findMany({
        where,
        select: PERSON_SELECT,
        orderBy: { personCode: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return Paginated.of(
      rows.map((r) => toPerson(r, withContact)),
      total,
      query.page,
      query.limit,
    );
  }

  /**
   * รายชื่อตามตัวกรองเป็น CSV (UTF-8 พร้อม BOM ให้ Excel อ่านภาษาไทยถูก)
   * log ได้แค่ผู้สั่ง จำนวนแถว และตัวกรอง — คำค้น `q` อาจเป็นชื่อหรือรหัส จึง log แค่ว่ามี/ไม่มี
   */
  async exportCsv(query: PeopleFilterDto, actorId: string | undefined) {
    const rows = await this.prisma.person.findMany({
      where: filterWhere(query),
      select: {
        personCode: true,
        fullNameTh: true,
        entryYear: true,
        status: true,
        curriculum: { select: { code: true } },
      },
      orderBy: { personCode: 'asc' },
    });

    const lines = [
      EXPORT_HEADER.map(csvCell).join(','),
      ...rows.map((p) =>
        [p.personCode, p.fullNameTh, p.entryYear, p.curriculum?.code, p.status]
          .map(csvCell)
          .join(','),
      ),
    ];

    this.logger.log(
      JSON.stringify({
        event: 'people.exported',
        actor: actorId,
        rows: rows.length,
        filters: {
          personType: query.personType ?? null,
          status: query.status,
          entryYear: query.entryYear ?? null,
          departmentCode: query.departmentCode ?? null,
          q: Boolean(query.q?.trim()),
        },
      }),
    );

    return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
  }

  async get(personCode: string, withContact: boolean) {
    const person = await this.prisma.person.findUnique({
      where: { personCode },
      select: PERSON_SELECT,
    });
    if (!person) throw new NotFoundException(`ไม่พบบุคคล ${personCode}`);
    return toPerson(person, withContact);
  }

  private async idOf(personCode: string): Promise<string> {
    const p = await this.prisma.person.findUnique({
      where: { personCode },
      select: { id: true },
    });
    if (!p) throw new NotFoundException(`ไม่พบบุคคล ${personCode}`);
    return p.id;
  }

  async advisors(personCode: string, withContact: boolean) {
    const studentId = await this.idOf(personCode);
    const rows = await this.prisma.advisorAssignment.findMany({
      where: { studentId, isActive: true },
      select: { advisor: { select: PERSON_SELECT } },
    });
    return rows.map((r) => toPerson(r.advisor, withContact));
  }

  async advisees(
    personCode: string,
    status: StatusFilter,
    withContact: boolean,
  ) {
    const advisorId = await this.idOf(personCode);
    const rows = await this.prisma.advisorAssignment.findMany({
      where: { advisorId, isActive: true, student: statusWhere(status) },
      select: { student: { select: PERSON_SELECT } },
      orderBy: { student: { personCode: 'asc' } },
    });
    return rows.map((r) => toPerson(r.student, withContact));
  }

  /** แก้สถานะ / อีเมล / ผูกบัญชี Core Hub ของบุคคล (people:manage) */
  async update(personCode: string, dto: UpdatePersonDto) {
    const person = await this.prisma.person.findUnique({
      where: { personCode },
      select: {
        id: true,
        coreUserId: true,
        personType: true,
        status: true,
        staffType: true,
      },
    });
    if (!person) throw new NotFoundException(`ไม่พบบุคคล ${personCode}`);

    const data: Prisma.PersonUncheckedUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.universityEmail !== undefined)
      data.universityEmail = dto.universityEmail.toLowerCase();

    if (dto.coreUserEmail !== undefined) {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.coreUserEmail.toLowerCase() },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('ไม่พบบัญชีผู้ใช้อีเมลนี้');

      const linked = await this.prisma.person.findUnique({
        where: { coreUserId: user.id },
        select: { personCode: true },
      });
      if (linked && linked.personCode !== personCode) {
        throw new ConflictException(
          `บัญชีนี้ผูกกับบุคคล ${linked.personCode} อยู่แล้ว`,
        );
      }
      data.coreUserId = user.id;
    }

    // role ของบัญชีตามทะเบียน (student ↔ alumni) ในธุรกรรมเดียวกับการแก้ทะเบียน
    // — ทั้งตอนเปลี่ยนสถานะ และตอนผูกบัญชีให้บุคคลที่จบแล้ว
    const accountId =
      (data.coreUserId as string | undefined) ?? person.coreUserId;
    const roleSync =
      person.personType === 'STUDENT' &&
      accountId &&
      (dto.status !== undefined || dto.coreUserEmail !== undefined)
        ? syncRegistryRole(
            this.prisma,
            [accountId],
            dto.status ?? person.status,
          )
        : // บุคลากร: ผูกบัญชีแล้ว role ตาม staff_type (อาจารย์ → lecturer)
          person.personType === 'STAFF' &&
            accountId &&
            dto.coreUserEmail !== undefined
          ? syncStaffRole(this.prisma, [accountId], person.staffType)
          : null;

    try {
      await this.prisma.$transaction([
        this.prisma.person.update({
          where: { personCode },
          data,
          select: { id: true },
        }),
        ...(roleSync ? [roleSync] : []),
      ]);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('อีเมลนี้ถูกใช้โดยบุคคลอื่นแล้ว');
      throw error;
    }

    // ผู้ที่มี people:manage เป็น admin ซึ่งเห็นอีเมลได้อยู่แล้ว
    return this.get(personCode, true);
  }
}
