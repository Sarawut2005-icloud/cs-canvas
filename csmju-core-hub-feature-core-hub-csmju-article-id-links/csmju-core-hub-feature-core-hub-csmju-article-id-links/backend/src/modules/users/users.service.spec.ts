import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import {
  ALUMNI_ROLE_ID,
  LECTURER_ROLE_ID,
  STAFF_ROLE_ID,
  STUDENT_ROLE_ID,
  UsersService,
  registryRoleId,
  staffRoleId,
  studentUserId,
  syncRegistryRole,
  syncStaffRole,
} from './users.service';

describe('UsersService — บัญชีนักศึกษา', () => {
  const service = new UsersService({} as unknown as PrismaService);

  it('id ใช้รหัสนักศึกษาเต็ม', () => {
    expect(studentUserId('9900000001')).toBe('user-9900000001');
  });

  it('prepareStudentAccounts: email = username (ตัวพิมพ์เล็ก) · role student · ไม่มีรหัสผ่าน', () => {
    const [account] = service.prepareStudentAccounts([
      { personCode: '9900000001', email: 'MJU9900000001@mju.ac.th' },
    ]);

    expect(account).toEqual({
      id: 'user-9900000001',
      email: 'mju9900000001@mju.ac.th',
      username: 'mju9900000001@mju.ac.th',
      passwordHash: null,
      roleId: STUDENT_ROLE_ID,
    });
  });

  it('ไม่แตะฐานข้อมูล', () => {
    // prisma เป็น object ว่าง — ถ้าเรียกอะไรจะพังทันที
    expect(service.prepareStudentAccounts([])).toEqual([]);
  });
});

describe('role ตามทะเบียน', () => {
  it('ACTIVE ⇒ student · GRADUATED ⇒ alumni · INACTIVE ไม่เปลี่ยน', () => {
    expect(registryRoleId('ACTIVE')).toBe(STUDENT_ROLE_ID);
    expect(registryRoleId('GRADUATED')).toBe(ALUMNI_ROLE_ID);
    expect(registryRoleId('INACTIVE')).toBeNull();
  });

  it('แตะเฉพาะบัญชี student/alumni — staff/admin ไม่ถูกแตะ', () => {
    const updateMany = jest.fn().mockReturnValue('query');
    const db = { user: { updateMany } } as unknown as PrismaService;

    expect(syncRegistryRole(db, ['user-1'], 'GRADUATED')).toBe('query');
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['user-1'] },
        roleId: { in: [STUDENT_ROLE_ID, ALUMNI_ROLE_ID], not: ALUMNI_ROLE_ID },
      },
      data: { roleId: ALUMNI_ROLE_ID },
    });
  });

  it('INACTIVE หรือไม่มีบัญชี → ไม่มีคำสั่ง', () => {
    const updateMany = jest.fn();
    const db = { user: { updateMany } } as unknown as PrismaService;
    expect(syncRegistryRole(db, ['user-1'], 'INACTIVE')).toBeNull();
    expect(syncRegistryRole(db, [], 'ACTIVE')).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe('role ของบุคลากรตามทะเบียน (standards 1.6.0)', () => {
  it('LECTURER ⇒ lecturer · OFFICER/TECHNICIAN/OTHER/ไม่ระบุ ⇒ staff', () => {
    expect(staffRoleId('LECTURER')).toBe(LECTURER_ROLE_ID);
    for (const type of ['OFFICER', 'TECHNICIAN', 'OTHER', null]) {
      expect(staffRoleId(type)).toBe(STAFF_ROLE_ID);
    }
  });

  it('แตะเฉพาะบัญชี staff/lecturer — admin และ role อื่นไม่ถูกแตะ', () => {
    const updateMany = jest.fn().mockReturnValue('query');
    const db = { user: { updateMany } } as unknown as PrismaService;

    expect(syncStaffRole(db, ['user-9'], 'LECTURER')).toBe('query');
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['user-9'] },
        roleId: {
          in: [STAFF_ROLE_ID, LECTURER_ROLE_ID],
          not: LECTURER_ROLE_ID,
        },
      },
      data: { roleId: LECTURER_ROLE_ID },
    });
  });

  it('ไม่มีบัญชี → ไม่มีคำสั่ง', () => {
    const updateMany = jest.fn();
    const db = { user: { updateMany } } as unknown as PrismaService;
    expect(syncStaffRole(db, [], 'LECTURER')).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe('UsersService.changePassword', () => {
  const CURRENT = 'OldPass2026';
  const NEXT = 'MyNewPass2026';

  /** mock เฉพาะที่ changePassword ใช้ — ธุรกรรมเรียก callback ด้วย tx ตัวเดียวกัน */
  async function makeService(
    opts: { userExists?: boolean; updateCount?: number } = {},
  ) {
    const storedHash = await bcrypt.hash(CURRENT, 4);
    const tx = {
      user: {
        updateMany: jest
          .fn<Promise<{ count: number }>, [unknown]>()
          .mockResolvedValue({ count: opts.updateCount ?? 1 }),
      },
      session: {
        updateMany: jest
          .fn<Promise<{ count: number }>, [unknown]>()
          .mockResolvedValue({ count: 3 }),
      },
    };
    const prisma = {
      user: {
        findUnique: jest
          .fn<Promise<{ passwordHash: string } | null>, [unknown]>()
          .mockResolvedValue(
            opts.userExists === false ? null : { passwordHash: storedHash },
          ),
      },
      $transaction: jest
        .fn<Promise<unknown>, [(t: typeof tx) => Promise<unknown>]>()
        .mockImplementation((cb) => cb(tx)),
    };
    const service = new UsersService(prisma as unknown as PrismaService);
    return { service, prisma, tx, storedHash };
  }

  it('สำเร็จ: hash ใหม่ (cost 12) · ยกเลิก session ทุกตัวในธุรกรรมเดียว', async () => {
    const { service, prisma, tx, storedHash } = await makeService();

    await expect(
      service.changePassword('user-1', CURRENT, NEXT),
    ).resolves.toEqual({ ok: true, revokedSessions: 3 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const updateArgs = tx.user.updateMany.mock.calls[0][0] as {
      where: { id: string; passwordHash: string };
      data: { passwordHash: string };
    };
    // เขียนเฉพาะเมื่อ hash ยังเป็นตัวเดิม
    expect(updateArgs.where).toEqual({
      id: 'user-1',
      passwordHash: storedHash,
    });
    expect(updateArgs.data.passwordHash).toMatch(/^\$2b\$12\$/);
    await expect(
      bcrypt.compare(NEXT, updateArgs.data.passwordHash),
    ).resolves.toBe(true);

    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: expect.any(Date) as Date },
    });
  });

  it('รหัสปัจจุบันผิด → wrong-current-password และไม่เขียนอะไร', async () => {
    const { service, prisma } = await makeService();
    await expect(
      service.changePassword('user-1', 'WrongPass1', NEXT),
    ).resolves.toEqual({ ok: false, reason: 'wrong-current-password' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('รหัสปัจจุบันผิด ตรวจก่อนกติกา — ไม่บอกกติกาให้คนที่ไม่รู้รหัส', async () => {
    const { service } = await makeService();
    await expect(
      service.changePassword('user-1', 'WrongPass1', 'x'),
    ).resolves.toEqual({ ok: false, reason: 'wrong-current-password' });
  });

  it('รหัสใหม่ผิดกติกา → 400 พร้อมรายการ และไม่เขียนอะไร', async () => {
    const { service, prisma } = await makeService();
    const call = service.changePassword('user-1', CURRENT, 'short');
    await expect(call).rejects.toBeInstanceOf(BadRequestException);
    await call.catch((error: BadRequestException) => {
      const body = error.getResponse() as { message: string[] };
      expect(body.message).toEqual([
        'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร',
        'รหัสผ่านต้องมีตัวพิมพ์ใหญ่ (A–Z) อย่างน้อย 1 ตัว',
      ]);
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('รหัสใหม่ซ้ำรหัสปัจจุบัน → 400', async () => {
    const { service, prisma } = await makeService();
    // CURRENT เป็นรูปแบบเริ่มต้นด้วย จึงผิดสองข้อ
    const call = service.changePassword('user-1', CURRENT, CURRENT);
    await expect(call).rejects.toBeInstanceOf(BadRequestException);
    await call.catch((error: BadRequestException) => {
      const body = error.getResponse() as { message: string[] };
      expect(body.message).toContain(
        'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน',
      );
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('มีคำขออื่นเปลี่ยนตัดหน้า (hash ไม่ตรงแล้ว) → 409 ไม่ยกเลิก session', async () => {
    const { service, tx } = await makeService({ updateCount: 0 });
    await expect(
      service.changePassword('user-1', CURRENT, NEXT),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });

  it('ไม่พบผู้ใช้ → 404', async () => {
    const { service } = await makeService({ userExists: false });
    await expect(
      service.changePassword('user-x', CURRENT, NEXT),
    ).rejects.toThrow('User not found');
  });

  it('บัญชียังไม่มีรหัสผ่าน (MJU SSO) → 400 และไม่เขียนอะไร', async () => {
    const { service, prisma } = await makeService();
    prisma.user.findUnique.mockResolvedValue({
      passwordHash: null,
    } as unknown as { passwordHash: string });
    await expect(
      service.changePassword('user-1', CURRENT, NEXT),
    ).rejects.toThrow('บัญชีนี้ยังไม่มีรหัสผ่าน ให้ตั้งผ่าน MJU SSO');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('UsersService.setPassword', () => {
  const NEXT = 'MyNewPass2026';

  function makeService(updateCount = 1) {
    const tx = {
      user: {
        updateMany: jest
          .fn<Promise<{ count: number }>, [unknown]>()
          .mockResolvedValue({ count: updateCount }),
      },
      session: {
        updateMany: jest
          .fn<Promise<{ count: number }>, [unknown]>()
          .mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      $transaction: jest
        .fn<Promise<unknown>, [(t: typeof tx) => Promise<unknown>]>()
        .mockImplementation((cb) => cb(tx)),
    };
    const service = new UsersService(prisma as unknown as PrismaService);
    return { service, prisma, tx };
  }

  it('สำเร็จ: hash ใหม่ (cost 12) · ยกเลิก session อื่น แต่คง session ปัจจุบัน', async () => {
    const { service, tx } = makeService();
    await expect(
      service.setPassword('user-1', 'session-now', NEXT, null),
    ).resolves.toBe(2);

    const updateArgs = tx.user.updateMany.mock.calls[0][0] as {
      where: { id: string; passwordHash: string | null };
      data: { passwordHash: string };
    };
    // เขียนเฉพาะเมื่อ hash ยังเป็นค่าที่ผู้เรียกใช้ตัดสิน (ที่นี่ = ยังไม่มีรหัส)
    expect(updateArgs.where).toEqual({ id: 'user-1', passwordHash: null });
    expect(updateArgs.data.passwordHash).toMatch(/^\$2b\$12\$/);
    await expect(
      bcrypt.compare(NEXT, updateArgs.data.passwordHash),
    ).resolves.toBe(true);

    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: 'ACTIVE',
        id: { not: 'session-now' },
      },
      data: { status: 'REVOKED', revokedAt: expect.any(Date) as Date },
    });
  });

  it('รหัสไม่ผ่านกติกา → 400 และไม่เขียนอะไร', async () => {
    const { service, prisma } = makeService();
    await expect(
      service.setPassword('user-1', 'session-now', 'short', null),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('hash เปลี่ยนไประหว่างนั้น → 409 ไม่ยกเลิก session', async () => {
    const { service, tx } = makeService(0);
    await expect(
      service.setPassword('user-1', 'session-now', NEXT, '$2b$12$old'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });
});

describe('UsersService.findAll (?q=)', () => {
  function makeService() {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new UsersService({
      user: { findMany },
    } as unknown as PrismaService);
    return { service, findMany };
  }

  it('lists every account without q', async () => {
    const { service, findMany } = makeService();
    await service.findAll();
    const args = (
      findMany.mock.calls as { where?: unknown; take?: number }[][]
    )[0][0];
    expect(args.where).toBeUndefined();
    expect(args.take).toBeUndefined();
  });

  it('narrows to e-mail or username containing q, at most 20', async () => {
    const { service, findMany } = makeService();
    await service.findAll('  Admin ');
    const args = (
      findMany.mock.calls as { where?: unknown; take?: number }[][]
    )[0][0];
    expect(args.where).toEqual({
      OR: [
        { email: { contains: 'Admin', mode: 'insensitive' } },
        { username: { contains: 'Admin', mode: 'insensitive' } },
      ],
    });
    expect(args.take).toBe(20);
  });
});
