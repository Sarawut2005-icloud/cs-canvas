import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { PeopleImportService } from './people-import.service';

interface UpsertArgs {
  where: { personCode: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

interface AccountRow {
  id: string;
  email: string;
  username: string;
  passwordHash: string | null;
  roleId: string;
}

interface ExistingUser {
  id: string;
  email: string;
  username: string | null;
}

const ACTOR: AuthenticatedUser = {
  id: 'user-001',
  email: 'admin@core.local',
  role: 'admin',
  sessionId: 'session-1',
  profileImageId: null,
};

const HEADER =
  'person_code,person_type,staff_type,full_name_th,full_name_en,university_email,entry_year,faculty_code,department_code,curriculum_code,status';

function row(
  code: string,
  overrides: Partial<Record<string, string>> = {},
): string {
  const v = {
    person_type: 'STUDENT',
    staff_type: '',
    full_name_th: `นักศึกษา ${code}`,
    full_name_en: '',
    university_email: `mju${code}@mju.ac.th`,
    entry_year: '2567',
    faculty_code: 'science',
    department_code: 'CS',
    curriculum_code: '65304010',
    status: '',
    ...overrides,
  };
  return [
    code,
    v.person_type,
    v.staff_type,
    v.full_name_th,
    v.full_name_en,
    v.university_email,
    v.entry_year,
    v.faculty_code,
    v.department_code,
    v.curriculum_code,
    v.status,
  ].join(',');
}

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join('\n') + '\n';
}

/** mock เฉพาะเมธอดที่ service เรียกใช้ (ไม่ใช้ any) */
function makeService(
  existingCodes: string[] = [],
  existingUsers: ExistingUser[] = [],
  /** personCode → core_user_id ของบุคคลที่มีอยู่แล้ว */
  linked: Record<string, string> = {},
) {
  const upsert = jest
    .fn<{ __op: 'upsert'; args: UpsertArgs }, [UpsertArgs]>()
    .mockImplementation((args) => ({ __op: 'upsert', args }));
  const createMany = jest
    .fn<{ __op: 'createMany'; data: AccountRow[] }, [{ data: AccountRow[] }]>()
    .mockImplementation(({ data }) => ({ __op: 'createMany', data }));
  const prisma = {
    faculty: {
      findMany: jest
        .fn<Promise<unknown[]>, [unknown]>()
        .mockResolvedValue([{ id: 'fac-1', code: 'science' }]),
    },
    department: {
      findMany: jest
        .fn<Promise<unknown[]>, [unknown]>()
        .mockResolvedValue([{ id: 'dep-1', code: 'CS' }]),
    },
    curriculum: {
      findMany: jest
        .fn<Promise<unknown[]>, [unknown]>()
        .mockResolvedValue([{ id: 'cur-1', code: '65304010' }]),
    },
    person: {
      findMany: jest
        .fn<Promise<unknown[]>, [{ where: Record<string, unknown> }]>()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            'personCode' in where
              ? existingCodes.map((personCode) => ({
                  personCode,
                  coreUserId: linked[personCode] ?? null,
                }))
              : [],
          ),
        ),
      upsert,
    },
    user: {
      findMany: jest
        .fn<Promise<ExistingUser[]>, [unknown]>()
        .mockResolvedValue(existingUsers),
      createMany,
      updateMany: jest
        .fn<{ __op: 'updateMany'; args: unknown }, [unknown]>()
        .mockImplementation((args) => ({ __op: 'updateMany', args })),
    },
    $transaction: jest
      .fn<Promise<unknown[]>, [unknown[]]>()
      .mockImplementation((ops) => Promise.resolve(ops)),
  };
  // UsersService ตัวจริง — กติกาบัญชีและ bcrypt ไม่แตะฐานข้อมูล
  const users = new UsersService(prisma as unknown as PrismaService);
  const service = new PeopleImportService(
    prisma as unknown as PrismaService,
    users,
  );
  return { service, prisma, upsert, createMany };
}

describe('PeopleImportService', () => {
  beforeAll(() => {
    // เงียบ log ระหว่างเทสต์ (service log แค่จำนวน ไม่มีเนื้อหาแถว)
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('dry-run: นับ toCreate/toUpdate จากรหัสที่มีอยู่แล้ว และไม่เขียนอะไร', async () => {
    const { service, prisma } = makeService(['9900000002']);
    const result = await service.import(
      { mode: 'dry-run', csv: csv(row('9900000001'), row('9900000002')) },
      ACTOR,
    );
    expect(result).toEqual({
      mode: 'dry-run',
      total: 2,
      toCreate: 1,
      toUpdate: 1,
      usersToCreate: 1,
      errors: [],
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    // resolve code อ้างอิงตารางละครั้ง ไม่ยิงต่อแถว
    expect(prisma.faculty.findMany).toHaveBeenCalledTimes(1);
  });

  it('faculty_code ที่ไม่มี → error ชี้เลขบรรทัดในไฟล์', async () => {
    const { service } = makeService();
    const result = await service.import(
      {
        mode: 'dry-run',
        csv: csv(
          row('9900000001'),
          row('9900000002', { faculty_code: 'nope-99' }),
        ),
      },
      ACTOR,
    );
    expect(result.toCreate).toBe(1);
    expect(result.errors).toEqual([
      { row: 3, message: "ไม่พบ faculty_code 'nope-99'" },
    ]);
  });

  it('person_code ซ้ำในไฟล์ → แถวหลังผิด', async () => {
    const { service } = makeService();
    const result = await service.import(
      { mode: 'dry-run', csv: csv(row('9900000001'), row('9900000001')) },
      ACTOR,
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ row: 3 });
    expect(result.errors[0].message).toContain('person_code ซ้ำกับแถว 2');
  });

  it('STAFF ไม่มี staff_type → error · STAFF ที่ถูกต้องผ่าน', async () => {
    const { service } = makeService();
    const result = await service.import(
      {
        mode: 'dry-run',
        csv: csv(
          row('teacher-a', { person_type: 'STAFF', entry_year: '' }),
          row('teacher-b', {
            person_type: 'STAFF',
            staff_type: 'LECTURER',
            entry_year: '',
          }),
        ),
      },
      ACTOR,
    );
    expect(result.toCreate).toBe(1);
    expect(result.errors).toEqual([
      { row: 2, message: 'staff_type จำเป็นเมื่อ person_type เป็น STAFF' },
    ]);
  });

  it('commit ที่มี error แม้แถวเดียว → 400 พร้อมรายการทุกแถว และไม่เปิด transaction', async () => {
    const { service, prisma } = makeService();
    const call = service.import(
      {
        mode: 'commit',
        csv: csv(row('9900000001'), row('9900000002', { entry_year: 'abc' })),
      },
      ACTOR,
    );
    await expect(call).rejects.toBeInstanceOf(BadRequestException);
    await call.catch((error: BadRequestException) => {
      const body = error.getResponse() as { message: string[] };
      expect(body.message).toEqual([
        'แถว 3: entry_year ต้องเป็นปี พ.ศ. 4 หลัก',
      ]);
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('commit ไม่มี error → transaction เดียว · update ไม่แตะ coreUserId · status ว่าง = ACTIVE', async () => {
    const { service, prisma, upsert } = makeService(['9900000002']);
    const result = await service.import(
      { mode: 'commit', csv: csv(row('9900000001'), row('9900000002')) },
      ACTOR,
    );
    expect(result).toEqual({
      mode: 'commit',
      total: 2,
      created: 1,
      updated: 1,
      usersCreated: 1,
      errors: [],
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(2);

    const args = upsert.mock.calls[0][0];
    expect(args.where).toEqual({ personCode: '9900000001' });
    expect(args.update).not.toHaveProperty('coreUserId');
    // คนที่มีอยู่แล้ว (update) ไม่ได้บัญชีใหม่ และ create ของเขาไม่ผูกบัญชี
    expect(upsert.mock.calls[1][0].create).not.toHaveProperty('coreUserId');
    expect(upsert.mock.calls[1][0].update).not.toHaveProperty('coreUserId');
    expect(args.update).toMatchObject({
      personType: 'STUDENT',
      status: 'ACTIVE',
      facultyId: 'fac-1',
      departmentId: 'dep-1',
      curriculumId: 'cur-1',
      entryYear: 2567,
    });
  });

  it('ไม่มีคอลัมน์บังคับ → 400 ทันที ก่อนอ่านฐานข้อมูล', async () => {
    const { service, prisma } = makeService();
    await expect(
      service.import(
        {
          mode: 'dry-run',
          csv: 'person_code,full_name_th\n9900000001,ทดสอบ\n',
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.faculty.findMany).not.toHaveBeenCalled();
  });

  it('university_email ที่บุคคลอื่นใช้อยู่ → error · ของตัวเอง (update) ผ่าน', async () => {
    const { service, prisma } = makeService(['9900000002']);
    prisma.person.findMany.mockImplementation(({ where }) =>
      Promise.resolve(
        'universityEmail' in where
          ? [
              {
                personCode: '9900000002',
                universityEmail: 'mju9900000002@mju.ac.th',
              },
            ]
          : [{ personCode: '9900000002' }],
      ),
    );
    const result = await service.import(
      {
        mode: 'dry-run',
        csv: csv(
          row('9900000001', { university_email: 'mju9900000002@mju.ac.th' }),
          row('9900000002', { university_email: 'other@mju.ac.th' }),
        ),
      },
      ACTOR,
    );
    expect(result.toUpdate).toBe(1);
    expect(result.errors[0]).toMatchObject({ row: 2 });
    expect(result.errors[0].message).toContain('รหัส 9900000002');
  });

  describe('สร้างบัญชีผู้ใช้ให้นักศึกษาใหม่', () => {
    it('dry-run: นับเฉพาะนักศึกษาใหม่ที่ ACTIVE และมีอีเมล · ไม่เขียนอะไร', async () => {
      const { service, prisma, createMany } = makeService(['9900000002']);
      const result = await service.import(
        {
          mode: 'dry-run',
          csv: csv(
            row('9900000001'), // ใหม่ · ACTIVE → ได้บัญชี
            row('9900000002'), // มีอยู่แล้ว → ไม่ได้
            row('9900000003', { status: 'INACTIVE' }), // ไม่ ACTIVE → ไม่ได้
            row('9900000004', { university_email: '' }), // ไม่มีอีเมล → ไม่ได้
            row('teacher-a', {
              person_type: 'STAFF',
              staff_type: 'LECTURER',
              entry_year: '',
              university_email: 'teacher-a@mju.ac.th',
            }), // อาจารย์ → ไม่ได้
          ),
        },
        ACTOR,
      );
      expect(result).toMatchObject({
        toCreate: 4,
        toUpdate: 1,
        usersToCreate: 1,
        errors: [],
      });
      expect(createMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('commit: สร้างบัญชีก่อน upsert ในธุรกรรมเดียว · ผูก coreUserId ตอน create · ไม่มีรหัสผ่าน', async () => {
      const { service, prisma, createMany, upsert } = makeService();
      const result = await service.import(
        {
          mode: 'commit',
          csv: csv(
            row('9900000001', { university_email: 'MJU9900000001@mju.ac.th' }),
            row('9900000003', { status: 'INACTIVE' }),
          ),
        },
        ACTOR,
      );
      expect(result).toMatchObject({ created: 2, usersCreated: 1 });

      expect(createMany).toHaveBeenCalledTimes(1);
      const [account] = createMany.mock.calls[0][0].data;
      expect(createMany.mock.calls[0][0].data).toHaveLength(1);
      expect(account).toMatchObject({
        id: 'user-9900000001',
        email: 'mju9900000001@mju.ac.th',
        username: 'mju9900000001@mju.ac.th',
        passwordHash: null,
        roleId: 'role-student',
      });

      // บัญชีเป็น op แรก ตามด้วย upsert ทุกแถว — ทั้งหมดใน $transaction เดียว
      const ops = prisma.$transaction.mock.calls[0][0] as { __op: string }[];
      expect(ops.map((op) => op.__op)).toEqual([
        'createMany',
        'upsert',
        'upsert',
      ]);

      const [student, inactive] = upsert.mock.calls.map((c) => c[0]);
      expect(student.create).toMatchObject({ coreUserId: 'user-9900000001' });
      expect(student.update).not.toHaveProperty('coreUserId');
      expect(inactive.create).not.toHaveProperty('coreUserId');
    });

    it('commit: บุคลากรที่ผูกบัญชีไว้ได้ role ตาม staff_type (LECTURER ⇒ lecturer · อื่น ๆ ⇒ staff)', async () => {
      const { service, prisma } = makeService(
        ['9900000005', '9900000006'],
        [],
        { '9900000005': 'user-lect', '9900000006': 'user-officer' },
      );
      await service.import(
        {
          mode: 'commit',
          csv: csv(
            row('9900000005', {
              person_type: 'STAFF',
              staff_type: 'LECTURER',
              entry_year: '',
            }),
            row('9900000006', {
              person_type: 'STAFF',
              staff_type: 'OFFICER',
              entry_year: '',
            }),
          ),
        },
        ACTOR,
      );

      const ops = prisma.$transaction.mock.calls[0][0] as {
        __op: string;
        args?: unknown;
      }[];
      const syncs = ops.filter((op) => op.__op === 'updateMany');
      expect(syncs.map((op) => op.args)).toEqual([
        {
          where: {
            id: { in: ['user-lect'] },
            roleId: {
              in: ['role-staff', 'role-lecturer'],
              not: 'role-lecturer',
            },
          },
          data: { roleId: 'role-lecturer' },
        },
        {
          where: {
            id: { in: ['user-officer'] },
            roleId: { in: ['role-staff', 'role-lecturer'], not: 'role-staff' },
          },
          data: { roleId: 'role-staff' },
        },
      ]);
    });

    it('commit: role ของบัญชีที่ผูกไว้ตามสถานะใหม่ (GRADUATED ⇒ alumni · ACTIVE ⇒ student) ในธุรกรรมเดียว', async () => {
      const { service, prisma } = makeService(
        ['9900000001', '9900000002', '9900000003'],
        [],
        {
          '9900000001': 'user-9900000001',
          '9900000002': 'user-9900000002',
          '9900000003': 'user-9900000003',
        },
      );
      await service.import(
        {
          mode: 'commit',
          csv: csv(
            row('9900000001', { status: 'GRADUATED' }),
            row('9900000002'),
            row('9900000003', { status: 'INACTIVE' }),
          ),
        },
        ACTOR,
      );

      const ops = prisma.$transaction.mock.calls[0][0] as {
        __op: string;
        args?: unknown;
      }[];
      const syncs = ops.filter((op) => op.__op === 'updateMany');
      // INACTIVE ไม่เปลี่ยน role — ถูกกันที่ login/refresh แทน
      expect(syncs.map((op) => op.args)).toEqual([
        {
          where: {
            id: { in: ['user-9900000002'] },
            roleId: {
              in: ['role-student', 'role-alumni'],
              not: 'role-student',
            },
          },
          data: { roleId: 'role-student' },
        },
        {
          where: {
            id: { in: ['user-9900000001'] },
            roleId: {
              in: ['role-student', 'role-alumni'],
              not: 'role-alumni',
            },
          },
          data: { roleId: 'role-alumni' },
        },
      ]);
    });

    it('commit ที่ไม่มีใครได้บัญชี → ไม่เรียก createMany', async () => {
      const { service, createMany } = makeService(['9900000001']);
      const result = await service.import(
        { mode: 'commit', csv: csv(row('9900000001')) },
        ACTOR,
      );
      expect(result).toMatchObject({ updated: 1, usersCreated: 0 });
      expect(createMany).not.toHaveBeenCalled();
    });

    it('อีเมลมีบัญชีผู้ใช้อยู่แล้ว → error ของแถว ไม่ผูกบัญชีคนอื่นให้', async () => {
      const { service } = makeService(
        [],
        [
          {
            id: 'user-legacy',
            email: 'MJU9900000001@mju.ac.th',
            username: null,
          },
        ],
      );
      const result = await service.import(
        { mode: 'dry-run', csv: csv(row('9900000001'), row('9900000002')) },
        ACTOR,
      );
      expect(result).toMatchObject({ toCreate: 1, usersToCreate: 1 });
      expect(result.errors).toEqual([
        {
          row: 2,
          message:
            'university_email นี้มีบัญชีผู้ใช้อยู่แล้ว สร้างบัญชีให้ไม่ได้',
        },
      ]);
    });

    it('id user-<รหัส> ถูกใช้แล้ว → error ของแถว · commit ถูกปฏิเสธทั้งไฟล์', async () => {
      const { service, prisma } = makeService(
        [],
        [
          {
            id: 'user-9900000001',
            email: 'someone@core.local',
            username: null,
          },
        ],
      );
      const call = service.import(
        { mode: 'commit', csv: csv(row('9900000001')) },
        ACTOR,
      );
      await expect(call).rejects.toBeInstanceOf(BadRequestException);
      await call.catch((error: BadRequestException) => {
        const body = error.getResponse() as { message: string[] };
        expect(body.message).toEqual([
          'แถว 2: มีบัญชีผู้ใช้ user-9900000001 อยู่แล้ว สร้างบัญชีให้ไม่ได้',
        ]);
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('error จากบัญชีเรียงตามเลขแถวรวมกับ error อื่น', async () => {
      const { service } = makeService(
        [],
        [{ id: 'x', email: 'mju9900000002@mju.ac.th', username: null }],
      );
      const result = await service.import(
        {
          mode: 'dry-run',
          csv: csv(
            row('9900000001', { entry_year: 'abc' }),
            row('9900000002'),
            row('9900000003', { faculty_code: 'nope-99' }),
          ),
        },
        ACTOR,
      );
      expect(result.errors.map((e) => e.row)).toEqual([2, 3, 4]);
    });

    it('ชนกันระหว่างตรวจกับบันทึก (P2002) → 409 ไม่มีอะไรถูกบันทึก', async () => {
      const { service, prisma } = makeService();
      prisma.$transaction.mockRejectedValueOnce(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );
      await expect(
        service.import({ mode: 'commit', csv: csv(row('9900000001')) }, ACTOR),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
