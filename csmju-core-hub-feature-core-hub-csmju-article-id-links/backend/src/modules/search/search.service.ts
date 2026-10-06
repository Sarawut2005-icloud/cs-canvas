import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { Permission } from '../authorization/permission.enum';
import { roleHasPermission } from '../authorization/role-permissions';

/** Who is searching — the subset of the authenticated user the rules need. */
export interface SearchActor {
  id: string;
  role: string;
}

/** Most hits per group; reference data per dataset. */
const PER_GROUP = 5;
const PER_DATASET = 3;

const contains = (q: string) => ({
  contains: q,
  mode: 'insensitive' as const,
});

type ReferenceRow = { code: string; nameTh?: string; isActive: boolean };

/**
 * One backoffice search across every group, in a single request: the
 * header search used to make about a dozen calls per query and could hit
 * the per-user rate limit. Each group is searched only when the actor holds
 * the permission its own list endpoint requires, so nothing is found that
 * the role could not read anyway; a group they may not read is left out of
 * the answer, not returned empty.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  private can(actor: SearchActor, permission: Permission): boolean {
    return roleHasPermission(actor.role, permission);
  }

  async search(rawQuery: string, actor: SearchActor) {
    const q = rawQuery.trim().slice(0, 100);
    if (q.length < 2) return {};

    const people = this.can(actor, Permission.PEOPLE_READ)
      ? this.prisma.person.findMany({
          where: {
            OR: [
              { personCode: contains(q) },
              { fullNameTh: contains(q) },
              { fullNameEn: contains(q) },
            ],
          },
          select: {
            personCode: true,
            personType: true,
            academicTitle: true,
            fullNameTh: true,
          },
          orderBy: { personCode: 'asc' },
          take: PER_GROUP,
        })
      : null;

    const anySubsystem = this.can(actor, Permission.SUBSYSTEM_READ_ANY);
    const subsystems =
      anySubsystem || this.can(actor, Permission.SUBSYSTEM_READ_OWN)
        ? this.prisma.subsystem.findMany({
            where: {
              ...(anySubsystem ? {} : { ownerId: actor.id }),
              OR: [{ name: contains(q) }, { displayName: contains(q) }],
            },
            select: { id: true, name: true, displayName: true },
            orderBy: { displayName: 'asc' },
            take: PER_GROUP,
          })
        : null;

    const announcements = this.can(actor, Permission.CONTENT_UPDATE)
      ? this.prisma.announcement.findMany({
          where: { OR: [{ title: contains(q) }, { content: contains(q) }] },
          select: { id: true, title: true, category: true, isPublished: true },
          orderBy: { updatedAt: 'desc' },
          take: PER_GROUP,
        })
      : null;

    const reference = this.can(actor, Permission.REFERENCE_READ)
      ? this.reference(q)
      : null;

    const users = this.can(actor, Permission.USER_READ)
      ? this.prisma.user.findMany({
          where: { OR: [{ email: contains(q) }, { username: contains(q) }] },
          select: {
            email: true,
            username: true,
            role: { select: { name: true } },
          },
          orderBy: { email: 'asc' },
          take: PER_GROUP,
        })
      : null;

    const [p, s, a, r, u] = await Promise.all([
      people,
      subsystems,
      announcements,
      reference,
      users,
    ]);

    return {
      ...(p && { people: p }),
      ...(s && { subsystems: s }),
      ...(a && { announcements: a }),
      ...(r && { reference: r }),
      ...(u && {
        users: u.map(({ role, ...rest }) => ({ ...rest, role: role.name })),
      }),
    };
  }

  /** Every reference dataset, active and disabled rows, by code or name. */
  private async reference(q: string) {
    const named = {
      OR: [
        { code: contains(q) },
        { nameTh: contains(q) },
        { nameEn: contains(q) },
      ],
    };
    const select = { code: true, nameTh: true, isActive: true } as const;
    const page = { take: PER_DATASET, orderBy: { code: 'asc' as const } };

    const [
      faculties,
      departments,
      buildings,
      rooms,
      terms,
      courses,
      curricula,
    ] = await Promise.all([
      this.prisma.faculty.findMany({ where: named, select, ...page }),
      this.prisma.department.findMany({ where: named, select, ...page }),
      this.prisma.building.findMany({ where: named, select, ...page }),
      this.prisma.room.findMany({
        where: { OR: [{ code: contains(q) }, { nameTh: contains(q) }] },
        select,
        ...page,
      }),
      this.prisma.term.findMany({
        where: { code: contains(q) },
        select: { code: true, isActive: true },
        ...page,
      }),
      this.prisma.course.findMany({ where: named, select, ...page }),
      this.prisma.curriculum.findMany({ where: named, select, ...page }),
    ]);

    const tag = (dataset: string, rows: ReferenceRow[]) =>
      rows.map((row) => ({
        dataset,
        code: row.code,
        nameTh: row.nameTh ?? null,
        isActive: row.isActive,
      }));

    return [
      ...tag('faculties', faculties),
      ...tag('departments', departments),
      ...tag('buildings', buildings),
      ...tag('rooms', rooms),
      ...tag('academic-terms', terms),
      ...tag('courses', courses),
      ...tag('curricula', curricula),
    ];
  }
}
