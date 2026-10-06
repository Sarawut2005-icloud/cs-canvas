import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const USER_ROLES = [
  'admin',
  'staff',
  'lecturer',
  'student',
  'alumni',
  'guest',
] as const;
const STUDENT_STATUSES = ['ACTIVE', 'INACTIVE', 'GRADUATED'] as const;
const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
const LIFECYCLE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

/** ทุก key มีค่าเสมอ (0 เมื่อไม่มีแถว) — frontend ไม่ต้องเช็ค undefined */
function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

/** วันที่แบบ YYYY-MM-DD (คอลัมน์ @db.Date) */
function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export interface BackofficeSummary {
  users: { byRole: Record<(typeof USER_ROLES)[number], number> };
  people: {
    students: Record<(typeof STUDENT_STATUSES)[number], number>;
    staff: number;
  };
  subsystems: {
    byApproval: Record<(typeof APPROVAL_STATUSES)[number], number>;
    byStatus: Record<(typeof LIFECYCLE_STATUSES)[number], number>;
  };
  currentTerm: { code: string; endDate: string } | null;
  news: { total: number };
}

/**
 * สรุปภาพรวมสำหรับหน้าแรกของ backoffice — ก้อนเดียว (ตัดสินใจ B7)
 * นับด้วย groupBy/count ในฐานข้อมูลทั้งหมด ไม่ดึงทั้งตารางมานับในโค้ด
 */
@Injectable()
export class BackofficeSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<BackofficeSummary> {
    const [
      usersByRoleId,
      roles,
      peopleGroups,
      approvalGroups,
      statusGroups,
      currentTerm,
      newsTotal,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['roleId'], _count: { _all: true } }),
      this.prisma.role.findMany({ select: { id: true, name: true } }),
      this.prisma.person.groupBy({
        by: ['personType', 'status'],
        _count: { _all: true },
      }),
      this.prisma.subsystem.groupBy({
        by: ['approvalStatus'],
        _count: { _all: true },
      }),
      this.prisma.subsystem.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.term.findFirst({
        where: { isCurrent: true },
        select: { code: true, endDate: true },
      }),
      this.prisma.newsArticle.count(),
    ]);

    const roleName = new Map(roles.map((r) => [r.id, r.name]));
    const byRole = zeroed(USER_ROLES);
    for (const g of usersByRoleId) {
      const name = roleName.get(g.roleId);
      if (name && name in byRole) {
        byRole[name as (typeof USER_ROLES)[number]] += g._count._all;
      }
    }

    const students = zeroed(STUDENT_STATUSES);
    let staff = 0;
    for (const g of peopleGroups) {
      if (g.personType === 'STAFF') staff += g._count._all;
      else if (g.status in students) students[g.status] += g._count._all;
    }

    const byApproval = zeroed(APPROVAL_STATUSES);
    for (const g of approvalGroups)
      byApproval[g.approvalStatus] = g._count._all;

    const byStatus = zeroed(LIFECYCLE_STATUSES);
    for (const g of statusGroups) byStatus[g.status] = g._count._all;

    return {
      users: { byRole },
      people: { students, staff },
      subsystems: { byApproval, byStatus },
      currentTerm: currentTerm
        ? { code: currentTerm.code, endDate: toDateOnly(currentTerm.endDate) }
        : null,
      news: { total: newsTotal },
    };
  }
}
