import { PrismaService } from '../../database/prisma.service';
import { BackofficeSummaryService } from './backoffice-summary.service';

/** mock เฉพาะเมธอดที่ service เรียกใช้ (ไม่ใช้ any) */
function makeService() {
  const prisma = {
    user: {
      groupBy: jest.fn<Promise<unknown[]>, [unknown]>().mockResolvedValue([]),
    },
    role: {
      findMany: jest.fn<Promise<unknown[]>, [unknown]>().mockResolvedValue([]),
    },
    person: {
      groupBy: jest.fn<Promise<unknown[]>, [unknown]>().mockResolvedValue([]),
    },
    subsystem: {
      groupBy: jest.fn<Promise<unknown[]>, [unknown]>().mockResolvedValue([]),
    },
    term: {
      findFirst: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(null),
    },
    newsArticle: {
      count: jest.fn<Promise<number>, []>().mockResolvedValue(0),
    },
  };
  const service = new BackofficeSummaryService(
    prisma as unknown as PrismaService,
  );
  return { service, prisma };
}

describe('BackofficeSummaryService', () => {
  it('ฐานข้อมูลว่าง: ทุก bucket เป็น 0 และ currentTerm เป็น null', async () => {
    const { service } = makeService();
    await expect(service.summary()).resolves.toEqual({
      users: {
        byRole: {
          admin: 0,
          staff: 0,
          lecturer: 0,
          student: 0,
          alumni: 0,
          guest: 0,
        },
      },
      people: { students: { ACTIVE: 0, INACTIVE: 0, GRADUATED: 0 }, staff: 0 },
      subsystems: {
        byApproval: { PENDING: 0, APPROVED: 0, REJECTED: 0 },
        byStatus: { ACTIVE: 0, INACTIVE: 0, SUSPENDED: 0 },
      },
      currentTerm: null,
      news: { total: 0 },
    });
  });

  it('แมปผล groupBy ลงช่องที่ถูกต้อง และแปลงวันสิ้นภาคเป็น YYYY-MM-DD', async () => {
    const { service, prisma } = makeService();
    prisma.user.groupBy.mockResolvedValue([
      { roleId: 'role-admin', _count: { _all: 1 } },
      { roleId: 'role-student', _count: { _all: 3 } },
      { roleId: 'role-unknown', _count: { _all: 9 } }, // role ที่ไม่รู้จัก → ไม่นับ
    ]);
    prisma.role.findMany.mockResolvedValue([
      { id: 'role-admin', name: 'admin' },
      { id: 'role-student', name: 'student' },
    ]);
    prisma.person.groupBy.mockResolvedValue([
      { personType: 'STUDENT', status: 'ACTIVE', _count: { _all: 110 } },
      { personType: 'STUDENT', status: 'INACTIVE', _count: { _all: 10 } },
      { personType: 'STAFF', status: 'ACTIVE', _count: { _all: 12 } },
      { personType: 'STAFF', status: 'INACTIVE', _count: { _all: 3 } },
    ]);
    prisma.subsystem.groupBy
      .mockResolvedValueOnce([
        { approvalStatus: 'APPROVED', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([{ status: 'ACTIVE', _count: { _all: 1 } }]);
    prisma.term.findFirst.mockResolvedValue({
      code: '2569-1',
      endDate: new Date('2026-11-02T00:00:00.000Z'),
    });
    prisma.newsArticle.count.mockResolvedValue(8);

    const result = await service.summary();

    expect(result.users.byRole).toEqual({
      admin: 1,
      staff: 0,
      lecturer: 0,
      student: 3,
      alumni: 0,
      guest: 0,
    });
    expect(result.people).toEqual({
      students: { ACTIVE: 110, INACTIVE: 10, GRADUATED: 0 },
      staff: 15,
    });
    expect(result.subsystems).toEqual({
      byApproval: { PENDING: 0, APPROVED: 1, REJECTED: 0 },
      byStatus: { ACTIVE: 1, INACTIVE: 0, SUSPENDED: 0 },
    });
    expect(result.currentTerm).toEqual({
      code: '2569-1',
      endDate: '2026-11-02',
    });
    expect(result.news).toEqual({ total: 8 });
  });

  it('ใช้ groupBy/count เท่านั้น — ไม่ดึงทั้งตาราง', async () => {
    const { service, prisma } = makeService();
    await service.summary();
    expect(prisma.user.groupBy).toHaveBeenCalledWith({
      by: ['roleId'],
      _count: { _all: true },
    });
    expect(prisma.person.groupBy).toHaveBeenCalledWith({
      by: ['personType', 'status'],
      _count: { _all: true },
    });
    expect(prisma.subsystem.groupBy).toHaveBeenCalledTimes(2);
    expect(prisma.newsArticle.count).toHaveBeenCalledTimes(1);
  });
});
