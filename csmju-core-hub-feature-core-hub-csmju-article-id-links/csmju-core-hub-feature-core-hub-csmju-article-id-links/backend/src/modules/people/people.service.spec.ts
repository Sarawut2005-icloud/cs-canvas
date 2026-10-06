import 'reflect-metadata';
import {
  ConflictException,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { Paginated } from '../../common/pagination/paginated';
import { PeopleService, csvCell } from './people.service';
import { PeopleController } from './people.controller';
import { ExportPeopleDto, QueryPeopleDto } from './dto/query-people.dto';
import { PERMISSIONS_KEY } from '../authorization/permissions.decorator';
import { Permission } from '../authorization/permission.enum';
import { roleHasPermission } from '../authorization/role-permissions';
import { SUBSYSTEM_TOKEN_ALLOWED_KEY } from '../auth/decorators/subsystem-token-allowed.decorator';

interface FindUniqueArgs {
  where: { personCode?: string; coreUserId?: string; email?: string };
  select?: Record<string, unknown>;
}

interface WhereArgs {
  where: Record<string, unknown>;
}

// ข้อมูลสมมติ (mock) เท่านั้น
const PERSON = {
  personCode: '9900000001',
  personType: 'STUDENT',
  fullNameTh: 'นักศึกษา ทดสอบ',
  jobTitle: null,
  universityEmail: 'mock@example.test',
  status: 'ACTIVE',
};

const QUERY: QueryPeopleDto = { page: 1, limit: 20, status: 'ACTIVE' };

function makeService() {
  const prisma = {
    person: {
      count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(0),
      findMany: jest
        .fn<Promise<unknown[]>, [WhereArgs]>()
        .mockResolvedValue([]),
      findUnique: jest
        .fn<Promise<unknown>, [FindUniqueArgs]>()
        .mockResolvedValue(null),
      update: jest
        .fn<Promise<unknown>, [{ data: Record<string, unknown> }]>()
        .mockResolvedValue({ id: 'p-1' }),
    },
    user: {
      findUnique: jest.fn<Promise<unknown>, [FindUniqueArgs]>(),
      updateMany: jest
        .fn<Promise<{ count: number }>, [unknown]>()
        .mockResolvedValue({ count: 1 }),
    },
    $transaction: jest
      .fn<Promise<unknown[]>, [Promise<unknown>[]]>()
      .mockImplementation((ops) => Promise.all(ops)),
    advisorAssignment: {
      findMany: jest
        .fn<Promise<unknown[]>, [WhereArgs]>()
        .mockResolvedValue([]),
    },
  };
  return {
    service: new PeopleService(prisma as unknown as PrismaService),
    prisma,
  };
}

/**
 * findUnique ถูกเรียกสามแบบใน update(): หาบุคคล (select มี id) · หาคนที่ผูกบัญชีนั้น (where coreUserId)
 * · อ่านข้อมูลเต็มตอนท้าย
 */
function personLookups(
  prisma: ReturnType<typeof makeService>['prisma'],
  opts: {
    exists?: boolean;
    linkedTo?: string | null;
    coreUserId?: string | null;
    status?: string;
    personType?: string;
    staffType?: string | null;
  } = {},
) {
  prisma.person.findUnique.mockImplementation((args) => {
    if (args.where.coreUserId) {
      return Promise.resolve(
        opts.linkedTo ? { personCode: opts.linkedTo } : null,
      );
    }
    if (opts.exists === false) return Promise.resolve(null);
    if (args.select && 'id' in args.select) {
      return Promise.resolve({
        id: 'p-1',
        coreUserId: opts.coreUserId ?? null,
        personType: opts.personType ?? 'STUDENT',
        staffType: opts.staffType ?? null,
        status: opts.status ?? 'ACTIVE',
      });
    }
    return Promise.resolve(PERSON);
  });
}

describe('PeopleService (อ่านข้อมูล)', () => {
  it('/people/me: ยังไม่ผูกบัญชี หรือไม่มี id ใน token → null (200 + data: null)', async () => {
    const { service } = makeService();
    await expect(service.findMe('user-999')).resolves.toBeNull();
    await expect(service.findMe(undefined)).resolves.toBeNull();
  });

  it('/people/me: ผูกแล้วคืนข้อมูลพร้อมอาจารย์ที่ปรึกษา', async () => {
    const { service, prisma } = makeService();
    prisma.person.findUnique.mockResolvedValue({
      ...PERSON,
      advisors: [
        {
          advisor: {
            personCode: 'mock-advisor',
            fullNameTh: 'อาจารย์ ทดสอบ',
            universityEmail: null,
          },
        },
      ],
    });
    const me = await service.findMe('user-001');
    expect(me?.advisors).toEqual([
      {
        personCode: 'mock-advisor',
        fullNameTh: 'อาจารย์ ทดสอบ',
        universityEmail: null,
      },
    ]);
  });

  it('รายชื่อคืนผ่าน Paginated (meta ชั้นบน) และแสดงเฉพาะ ACTIVE เป็นค่าเริ่มต้น', async () => {
    const { service, prisma } = makeService();
    prisma.person.count.mockResolvedValue(45);
    const page = await service.list(QUERY, false);
    expect(page).toBeInstanceOf(Paginated);
    expect(page.meta).toEqual({ total: 45, page: 1, limit: 20, totalPages: 3 });
    expect(prisma.person.findMany.mock.calls[0][0].where.status).toBe('ACTIVE');
    await service.list({ ...QUERY, status: 'ALL' }, false);
    expect(
      prisma.person.findMany.mock.calls[1][0].where.status,
    ).toBeUndefined();
  });

  it('ซ่อนอีเมลเมื่อไม่มีสิทธิ์ people:contact:read · jobTitle ส่งออกเสมอ', async () => {
    const { service, prisma } = makeService();
    prisma.person.findUnique.mockResolvedValue(PERSON);
    const hidden = await service.get('9900000001', false);
    expect(hidden).not.toHaveProperty('universityEmail');
    expect(hidden).toHaveProperty('jobTitle');
    expect(await service.get('9900000001', true)).toHaveProperty(
      'universityEmail',
      'mock@example.test',
    );
  });

  it('รหัสบุคคลที่ไม่มีตอบ 404', async () => {
    const { service } = makeService();
    await expect(service.get('NOPE', false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.advisees('NOPE', 'ACTIVE', false),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('QueryPeopleDto: รับตัวพิมพ์เล็ก · ปฏิเสธค่าที่ไม่รู้จักและ limit เกิน 100', async () => {
    const ok = plainToInstance(QueryPeopleDto, {
      personType: 'student',
      status: 'all',
    });
    expect(ok).toMatchObject({
      personType: 'STUDENT',
      status: 'ALL',
      page: 1,
      limit: 20,
    });
    expect(await validate(ok)).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(QueryPeopleDto, { personType: 'teacher' }),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(QueryPeopleDto, { limit: '500' })))
        .length,
    ).toBeGreaterThan(0);
  });

  it('route me และ import ประกาศก่อน :personCode', () => {
    const methods = Object.getOwnPropertyNames(PeopleController.prototype);
    expect(methods.indexOf('me')).toBeLessThan(methods.indexOf('get'));
    expect(methods.indexOf('import')).toBeLessThan(methods.indexOf('get'));
    expect(methods.indexOf('export')).toBeLessThan(methods.indexOf('get'));
  });
});

describe('PeopleService.update (PATCH /people/:personCode)', () => {
  it('ไม่พบบุคคล → 404', async () => {
    const { service, prisma } = makeService();
    personLookups(prisma, { exists: false });
    await expect(
      service.update('0000', { status: 'INACTIVE' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.person.update).not.toHaveBeenCalled();
  });

  it('แก้สถานะแล้วคืนข้อมูลบุคคลพร้อมอีเมล', async () => {
    const { service, prisma } = makeService();
    personLookups(prisma);
    await expect(
      service.update('9900000001', { status: 'GRADUATED' }),
    ).resolves.toEqual(PERSON);
    expect(prisma.person.update.mock.calls[0][0].data).toEqual({
      status: 'GRADUATED',
    });
  });

  it('นักศึกษาที่ผูกบัญชี: GRADUATED ⇒ alumni ในธุรกรรมเดียวกับการแก้ทะเบียน · ไม่แตะ staff/admin', async () => {
    const { service, prisma } = makeService();
    personLookups(prisma, { coreUserId: 'user-9900000001' });
    await service.update('9900000001', { status: 'GRADUATED' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['user-9900000001'] },
        roleId: { in: ['role-student', 'role-alumni'], not: 'role-alumni' },
      },
      data: { roleId: 'role-alumni' },
    });
  });

  it('กลับเป็น ACTIVE ⇒ student · INACTIVE ไม่เปลี่ยน role · ไม่มีบัญชีไม่เรียก', async () => {
    const { service, prisma } = makeService();
    personLookups(prisma, {
      coreUserId: 'user-9900000001',
      status: 'GRADUATED',
    });
    await service.update('9900000001', { status: 'ACTIVE' });
    expect(prisma.user.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { roleId: 'role-student' } }),
    );

    prisma.user.updateMany.mockClear();
    await service.update('9900000001', { status: 'INACTIVE' });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();

    personLookups(prisma);
    await service.update('9900000001', { status: 'GRADUATED' });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('ผูกบัญชีให้นักศึกษาที่จบแล้ว → บัญชีนั้นเป็น alumni', async () => {
    const { service, prisma } = makeService();
    personLookups(prisma, { status: 'GRADUATED' });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-002' });
    await service.update('9900000001', { coreUserEmail: 'student@core.local' });
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['user-002'] } }) as unknown,
        data: { roleId: 'role-alumni' },
      }),
    );
  });

  it('ผูกบัญชีให้อาจารย์ (staff_type LECTURER) → บัญชีนั้นเป็น lecturer', async () => {
    const { service, prisma } = makeService();
    personLookups(prisma, { personType: 'STAFF', staffType: 'LECTURER' });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-003' });
    await service.update('9900000005', { coreUserEmail: 'staff@core.local' });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['user-003'] },
        roleId: { in: ['role-staff', 'role-lecturer'], not: 'role-lecturer' },
      },
      data: { roleId: 'role-lecturer' },
    });
  });

  it('coreUserEmail ที่ไม่มีในตาราง users → 404', async () => {
    const { service, prisma } = makeService();
    personLookups(prisma);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.update('9900000001', { coreUserEmail: 'nobody@core.local' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('บัญชีที่ผูกกับคนอื่นอยู่แล้ว → 409 · ผูกกับตัวเองซ้ำได้', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-002' });
    personLookups(prisma, { linkedTo: '9900000009' });
    await expect(
      service.update('9900000001', { coreUserEmail: 'student@core.local' }),
    ).rejects.toBeInstanceOf(ConflictException);

    personLookups(prisma, { linkedTo: '9900000001' });
    await expect(
      service.update('9900000001', { coreUserEmail: 'student@core.local' }),
    ).resolves.toEqual(PERSON);
    expect(prisma.person.update.mock.calls[0][0].data).toEqual({
      coreUserId: 'user-002',
    });
  });

  it('universityEmail ชนกับคนอื่น (P2002) → 409', async () => {
    const { service, prisma } = makeService();
    personLookups(prisma);
    prisma.person.update.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.update('9900000001', { universityEmail: 'taken@mju.ac.th' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PeopleService.findMySchedule (GET /people/me/schedule)', () => {
  it('คืน [] เมื่อยังไม่ผูกบัญชีกับบุคคล', async () => {
    const { service } = makeService();
    await expect(service.findMySchedule('user-999')).resolves.toEqual([]);
    await expect(service.findMySchedule(undefined)).resolves.toEqual([]);
  });

  it('รวมคาบที่เรียนและคาบที่สอนของภาคปัจจุบัน เรียงตามวันและเวลาเริ่ม', async () => {
    const { service, prisma } = makeService();
    prisma.person.findUnique.mockResolvedValue({ id: 'p-1' });
    const section = (code: string, slots: unknown[]) => ({
      sectionNo: '1',
      term: { code: '2569-1' },
      course: { code, nameTh: `วิชา ${code}`, nameEn: null },
      schedules: slots,
    });
    const findMany = jest
      .fn()
      // ลงทะเบียนเรียน
      .mockResolvedValueOnce([
        section('A', [
          {
            id: 's-2',
            scheduleType: 'LAB',
            dayOfWeek: 2,
            startTime: '13:00',
            endTime: '16:00',
            room: {
              code: 'R1',
              nameTh: 'ห้อง 1',
              building: { nameTh: 'อาคาร ก' },
            },
          },
        ]),
      ])
      // สอน
      .mockResolvedValueOnce([
        section('B', [
          {
            id: 's-1',
            scheduleType: 'LECTURE',
            dayOfWeek: 2,
            startTime: '09:00',
            endTime: '12:00',
            room: null,
          },
        ]),
      ]);
    (prisma as unknown as Record<string, unknown>).courseSection = {
      findMany,
    };

    const schedule = await service.findMySchedule('user-001');

    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          term: { isCurrent: true },
          enrollments: { some: { studentId: 'p-1' } },
        },
      }),
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          term: { isCurrent: true },
          instructors: { some: { instructorId: 'p-1' } },
        },
      }),
    );
    expect(schedule.map((s) => [s.id, s.involvement])).toEqual([
      ['s-1', 'TEACH'],
      ['s-2', 'LEARN'],
    ]);
    expect(schedule[1]).toMatchObject({
      termCode: '2569-1',
      room: { code: 'R1', nameTh: 'ห้อง 1', buildingNameTh: 'อาคาร ก' },
    });
    expect(schedule[0].room).toBeNull();
  });
});

describe('GET /people/export (ข้อ 2.9)', () => {
  const EXPORT_ROWS = [
    {
      personCode: '9900000001',
      fullNameTh: 'นักศึกษา ทดสอบ',
      entryYear: 2567,
      status: 'ACTIVE',
      curriculum: { code: 'MOCK-CUR' },
    },
    {
      personCode: '9900000002',
      fullNameTh: '=HYPERLINK("x"), สมมติ',
      entryYear: null,
      status: 'GRADUATED',
      curriculum: null,
    },
  ];
  const FILTER: ExportPeopleDto = {
    personType: 'STUDENT',
    status: 'ALL',
    entryYear: 2567,
  };

  afterEach(() => jest.restoreAllMocks());

  it('ได้เฉพาะ 5 คอลัมน์ (ไม่มีอีเมล) · UTF-8 BOM · ตามตัวกรองเดียวกับ list · ไม่แบ่งหน้า', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const { service, prisma } = makeService();
    prisma.person.findMany.mockResolvedValue(EXPORT_ROWS);

    const csv = await service.exportCsv(FILTER, 'user-staff');

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trimEnd().split(String.fromCharCode(13, 10));
    expect(lines).toEqual([
      'รหัส,ชื่อ-สกุล,ปีที่เข้า,หลักสูตร,สถานะ',
      '9900000001,นักศึกษา ทดสอบ,2567,MOCK-CUR,ACTIVE',
      `9900000002,"'=HYPERLINK(""x""), สมมติ",,,GRADUATED`,
    ]);
    expect(csv).not.toContain('@');

    const args = prisma.person.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
      skip?: number;
      take?: number;
    };
    expect(args.where).toMatchObject({
      personType: 'STUDENT',
      entryYear: 2567,
    });
    expect(args.where.status).toBeUndefined(); // ALL
    expect(args.select.universityEmail).toBeUndefined();
    expect(args.skip).toBeUndefined();
    expect(args.take).toBeUndefined();
  });

  it('log people.exported มีผู้สั่ง จำนวนแถว ตัวกรอง — ไม่มีชื่อ รหัส หรือคำค้น', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const { service, prisma } = makeService();
    prisma.person.findMany.mockResolvedValue(EXPORT_ROWS);

    await service.exportCsv({ ...FILTER, q: '9900000001' }, 'user-staff');

    const line = String(log.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(line)).toEqual({
      event: 'people.exported',
      actor: 'user-staff',
      rows: 2,
      filters: {
        personType: 'STUDENT',
        status: 'ALL',
        entryYear: 2567,
        departmentCode: null,
        q: true,
      },
    });
    expect(line).not.toContain('9900000001');
    expect(line).not.toContain('ทดสอบ');
  });

  it('csvCell: ครอบค่าที่มี , " และขึ้นบรรทัด · กันสูตร Excel', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(2567)).toBe('2567');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('+66')).toBe("'+66");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });

  it('สิทธิ์ people:export เฉพาะ staff และ admin · ไม่อยู่ใน allowlist ของ token ระบบย่อย', () => {
    const handler = Object.getOwnPropertyDescriptor(
      PeopleController.prototype,
      'export',
    )?.value as object;
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      Permission.PEOPLE_EXPORT,
    ]);
    expect(
      Reflect.getMetadata(SUBSYSTEM_TOKEN_ALLOWED_KEY, handler),
    ).toBeUndefined();
    for (const role of ['staff', 'admin'])
      expect(roleHasPermission(role, Permission.PEOPLE_EXPORT)).toBe(true);
    for (const role of ['lecturer', 'student', 'alumni', 'guest'])
      expect(roleHasPermission(role, Permission.PEOPLE_EXPORT)).toBe(false);
  });

  it('controller ตอบไฟล์ text/csv ดิบ (StreamableFile — ไม่ห่อ envelope)', async () => {
    const people = {
      exportCsv: jest.fn().mockResolvedValue('csv'),
    } as unknown as PeopleService;
    const controller = new PeopleController(people, {} as never);
    const file = await controller.export(FILTER, {
      id: 'user-staff',
      role: 'staff',
    } as never);
    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.getHeaders().type).toBe('text/csv; charset=utf-8');
    expect(file.getHeaders().disposition).toContain('attachment');
  });
});
