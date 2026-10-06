import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PersonStatus, StaffType } from '../../../generated/prisma/client';
import * as bcrypt from 'bcrypt';
import crypto from 'crypto';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { passwordPolicyViolations } from './password-policy';
import { UserRole } from './user-role.enum';
import { Permission } from '../authorization/permission.enum';
import {
  GRANTABLE_PERMISSIONS,
  effectivePermissions,
  isGrantablePermission,
} from '../authorization/permission-grants';

/** Who is changing an account — the subset of the authenticated user needed. */
export interface UserActor {
  id: string;
  role: string;
}

/**
 * กติกาบัญชีนักศึกษาที่ระบบสร้างให้อัตโนมัติ (CSV import) — แก้ที่นี่ที่เดียว
 *
 * id `user-<รหัสนักศึกษา>` · email = username = อีเมลมหาวิทยาลัย · role student
 * ไม่มีรหัสผ่าน (`password_hash = null`) — นักศึกษาเข้าครั้งแรกด้วย MJU SSO
 * แล้วตั้งรหัสเองที่ POST /auth/password/set
 */
export const STUDENT_ROLE_ID = 'role-student';
export const ALUMNI_ROLE_ID = 'role-alumni';
export const STAFF_ROLE_ID = 'role-staff';
export const LECTURER_ROLE_ID = 'role-lecturer';

export function studentUserId(personCode: string): string {
  return `user-${personCode}`;
}

/**
 * role ตามสถานะในทะเบียน — เฉพาะ student ↔ alumni
 * สถานะอื่น (INACTIVE) ไม่เปลี่ยน role: คนที่พ้นสภาพถูกกันที่ login/refresh แทน
 */
export function registryRoleId(status: PersonStatus): string | null {
  if (status === PersonStatus.ACTIVE) return STUDENT_ROLE_ID;
  if (status === PersonStatus.GRADUATED) return ALUMNI_ROLE_ID;
  return null;
}

/**
 * ปรับ role ของบัญชีที่ผูกกับนักศึกษาให้ตรงทะเบียน แตะเฉพาะบัญชีที่เป็น
 * student/alumni อยู่แล้ว — staff/admin ไม่ถูกแตะเด็ดขาด
 * คืน PrismaPromise ให้ผู้เรียกใส่ในธุรกรรมเดียวกับการแก้ทะเบียน
 */
export function syncRegistryRole(
  db: Pick<PrismaService, 'user'>,
  userIds: string[],
  status: PersonStatus,
) {
  const roleId = registryRoleId(status);
  if (!roleId || userIds.length === 0) return null;
  return db.user.updateMany({
    where: {
      id: { in: userIds },
      roleId: { in: [STUDENT_ROLE_ID, ALUMNI_ROLE_ID], not: roleId },
    },
    data: { roleId },
  });
}

/**
 * role ของบุคลากรตามทะเบียน — อาจารย์ (`LECTURER`) ได้ lecturer ที่เหลือได้ staff
 * (staff หมายถึงบุคลากรที่ไม่ใช่อาจารย์ — standards 1.6.0)
 */
export function staffRoleId(staffType: string | null): string {
  return staffType === StaffType.LECTURER ? LECTURER_ROLE_ID : STAFF_ROLE_ID;
}

/**
 * ปรับ role ของบัญชีที่ผูกกับบุคลากรให้ตรงทะเบียน แตะเฉพาะบัญชีที่เป็น
 * staff/lecturer อยู่แล้ว — admin และ role อื่นไม่ถูกแตะ
 * คืน PrismaPromise ให้ผู้เรียกใส่ในธุรกรรมเดียวกับการแก้ทะเบียน
 */
export function syncStaffRole(
  db: Pick<PrismaService, 'user'>,
  userIds: string[],
  staffType: string | null,
) {
  if (userIds.length === 0) return null;
  const roleId = staffRoleId(staffType);
  return db.user.updateMany({
    where: {
      id: { in: userIds },
      roleId: { in: [STAFF_ROLE_ID, LECTURER_ROLE_ID], not: roleId },
    },
    data: { roleId },
  });
}

/** cost เดียวกับ create/update ของ UsersService */
const PASSWORD_BCRYPT_COST = 12;

export type ChangePasswordResult =
  | { ok: true; revokedSessions: number }
  | { ok: false; reason: 'wrong-current-password' };

export interface StudentAccount {
  id: string;
  email: string;
  username: string;
  passwordHash: null;
  roleId: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Most accounts a `q` search returns. */
  static readonly SEARCH_LIMIT = 20;

  /**
   * Every account, newest first. `q` narrows to accounts whose e-mail or
   * username contains it (case-insensitive), at most SEARCH_LIMIT of them.
   */
  async findAll(q?: string) {
    const text = q?.trim().slice(0, 100);
    return this.prisma.user.findMany({
      ...(text
        ? {
            where: {
              OR: [
                { email: { contains: text, mode: 'insensitive' as const } },
                { username: { contains: text, mode: 'insensitive' as const } },
              ],
            },
            take: UsersService.SEARCH_LIMIT,
          }
        : {}),
      select: {
        username: true,
        id: true,

        email: true,

        role: {
          select: {
            id: true,

            name: true,
          },
        },

        // Per-account grants, for the switches on the users page.
        permissionGrants: { select: { permission: true } },

        createdAt: true,

        updatedAt: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /** Role permissions plus per-account grants (GET /auth/me). */
  effectivePermissions(user: { id: string; role: string }) {
    return effectivePermissions(this.prisma, user);
  }

  /**
   * Gives one account a grantable permission (admin). Idempotent: granting
   * again keeps the first grant. Logged with ids only — no e-mail.
   */
  async grantPermission(userId: string, permission: string, actor: UserActor) {
    const grantable = this.assertGrantable(permission);
    await this.assertUserExists(userId);

    const grant = await this.prisma.userPermissionGrant.upsert({
      where: { userId_permission: { userId, permission: grantable } },
      create: { userId, permission: grantable, grantedById: actor.id },
      update: {},
      select: { permission: true, grantedById: true, createdAt: true },
    });

    this.logger.log(
      JSON.stringify({
        event: 'user.permission_granted',
        sub: userId,
        permission: grantable,
        actor: actor.id,
      }),
    );

    return { userId, granted: true, ...grant };
  }

  /** Takes a grant back (admin). Revoking one that is not there is a no-op. */
  async revokePermission(userId: string, permission: string, actor: UserActor) {
    const grantable = this.assertGrantable(permission);
    await this.assertUserExists(userId);

    const removed = await this.prisma.userPermissionGrant.deleteMany({
      where: { userId, permission: grantable },
    });

    this.logger.log(
      JSON.stringify({
        event: 'user.permission_revoked',
        sub: userId,
        permission: grantable,
        actor: actor.id,
        removed: removed.count,
      }),
    );

    return { userId, permission: grantable, granted: false };
  }

  private assertGrantable(permission: string): Permission {
    if (!isGrantablePermission(permission)) {
      throw new BadRequestException([
        `permission must be one of ${GRANTABLE_PERMISSIONS.join(', ')}`,
      ]);
    }
    return permission;
  }

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        role: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        username: true,
        email: true,
        profileImageId: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(dto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const role = await this.prisma.role.findUnique({
      where: {
        name: dto.role,
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    return this.prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: dto.email,
        passwordHash,
        roleId: role.id,
      },
      select: {
        id: true,
        email: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * เตรียมแถว users ของนักศึกษา — ยังไม่เขียนฐานข้อมูล ผู้เรียกเขียนใน transaction ของตัวเอง
   * ไม่มีรหัสผ่านเริ่มต้น: รหัสที่เดาได้จากรหัสนักศึกษาทำให้ใครก็เข้าบัญชีคนอื่นได้
   */
  prepareStudentAccounts(
    students: { personCode: string; email: string }[],
  ): StudentAccount[] {
    return students.map(({ personCode, email }) => {
      const normalized = email.toLowerCase();
      return {
        id: studentUserId(personCode),
        email: normalized,
        username: normalized,
        passwordHash: null,
        roleId: STUDENT_ROLE_ID,
      };
    });
  }

  /** hash ปัจจุบันของบัญชี (null = ยังไม่มีรหัสผ่าน) · undefined = ไม่พบบัญชี */
  async findPasswordHash(userId: string): Promise<string | null | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    return user ? user.passwordHash : undefined;
  }

  /** สถานะในทะเบียนของบุคคลที่ผูกกับบัญชีนี้ · null = บัญชีไม่ผูกบุคคล (seed, admin สร้าง) */
  async linkedPersonStatus(userId: string): Promise<PersonStatus | null> {
    const person = await this.prisma.person.findUnique({
      where: { coreUserId: userId },
      select: { status: true },
    });
    return person?.status ?? null;
  }

  /**
   * ตั้งรหัสผ่านโดยไม่ต้องรู้รหัสเดิม — ผู้เรียก (AuthService.setPassword)
   * ตรวจแล้วว่าเข้ากรณีที่อนุญาต
   *
   * รหัสใหม่ผิดกติกา → 400 พร้อมรายการข้อที่ไม่ผ่าน
   * สำเร็จ → เปลี่ยน hash และยกเลิก session อื่นทั้งหมด แต่คง `keepSessionId` ไว้
   * (ผู้ใช้เพิ่งยืนยันตัวตนกับ MJU — ไม่ต้อง login ซ้ำ) ในธุรกรรมเดียว
   * `currentHash` คือ hash ที่ผู้เรียกใช้ตัดสิน — ถ้าเปลี่ยนไประหว่างนั้นจะไม่เขียนทับ
   */
  async setPassword(
    userId: string,
    keepSessionId: string,
    newPassword: string,
    currentHash: string | null,
  ): Promise<number> {
    const problems = passwordPolicyViolations(newPassword);
    if (problems.length > 0) {
      throw new BadRequestException({ message: problems });
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_BCRYPT_COST);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: userId, passwordHash: currentHash },
        data: { passwordHash },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'รหัสผ่านถูกเปลี่ยนไปแล้วระหว่างนี้ กรุณาลองใหม่',
        );
      }

      const revoked = await tx.session.updateMany({
        where: { userId, status: 'ACTIVE', id: { not: keepSessionId } },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      return revoked.count;
    });
  }

  /**
   * ผู้ใช้เปลี่ยนรหัสผ่านของตัวเอง
   *
   * รหัสปัจจุบันผิด → คืน `wrong-current-password` ให้ผู้เรียกนับเข้า lockout
   * รหัสใหม่ผิดกติกา → 400 พร้อมรายการข้อที่ไม่ผ่าน
   * สำเร็จ → เปลี่ยน hash และยกเลิก session ทุกตัวของผู้ใช้ (รวมเครื่องที่ใช้อยู่)
   * ในธุรกรรมเดียว ถ้าพังจะไม่มีกรณีรหัสเปลี่ยนแล้วแต่เครื่องอื่นยังค้างอยู่
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('User not found');
    // บัญชีจาก MJU SSO ยังไม่มีรหัสผ่านให้เทียบ — ไม่ใช่การเดารหัส จึงไม่นับ lockout
    if (!user.passwordHash) {
      throw new BadRequestException(
        'บัญชีนี้ยังไม่มีรหัสผ่าน ให้ตั้งผ่าน MJU SSO',
      );
    }
    const currentHash = user.passwordHash;

    if (!(await bcrypt.compare(currentPassword, currentHash))) {
      return { ok: false, reason: 'wrong-current-password' };
    }

    const problems = passwordPolicyViolations(newPassword);
    if (await bcrypt.compare(newPassword, currentHash)) {
      problems.push('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน');
    }
    if (problems.length > 0) {
      throw new BadRequestException({ message: problems });
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_BCRYPT_COST);

    return this.prisma.$transaction(async (tx) => {
      // เทียบกับ hash เดิมด้วย — มีอีกคำขอเปลี่ยนตัดหน้าไปแล้วจะไม่เขียนทับ
      const updated = await tx.user.updateMany({
        where: { id: userId, passwordHash: currentHash },
        data: { passwordHash },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'รหัสผ่านถูกเปลี่ยนไปแล้วระหว่างนี้ กรุณาเข้าสู่ระบบใหม่',
        );
      }

      const revoked = await tx.session.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      return { ok: true as const, revokedSessions: revoked.count };
    });
  }

  /**
   * แก้บัญชีผ่านหลังบ้าน (`PATCH /users/update/:id`) — ด่านที่สองหลัง
   * PermissionsGuard (`user:update`) เผื่อวันหน้ามี role อื่นได้สิทธิ์นี้:
   *
   *   - เปลี่ยน role ได้เฉพาะ admin และห้ามเปลี่ยน role ของตัวเอง
   *   - ผู้ที่ไม่ใช่ admin แก้บัญชี admin ไม่ได้ (email · รหัสผ่าน · role)
   *   - ห้ามลด admin คนสุดท้ายของระบบ
   *   - รหัสผ่านใหม่ต้องผ่านกติกาเดียวกับการเปลี่ยนรหัสเอง
   *   - เปลี่ยน role หรือรหัสผ่านแล้ว session ทุกตัวของบัญชีนั้นถูกยกเลิก
   *     ในธุรกรรมเดียวกัน — สิทธิ์เก่าจึงไม่ค้างอยู่ใน token ที่ออกไปแล้ว
   *
   * log มีแค่เหตุการณ์ · id · role — ห้ามมีรหัสผ่าน
   */
  async update(id: string, dto: UpdateUserDto, actor: UserActor) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      include: { role: { select: { name: true } } },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Role names are plain strings in the database and on the actor.
    const admin: string = UserRole.ADMIN;
    const actorIsAdmin = actor.role === admin;
    const targetIsAdmin = existingUser.role.name === admin;
    const requestedRole: string | undefined = dto.role;
    const roleChange =
      requestedRole !== undefined && requestedRole !== existingUser.role.name
        ? { from: existingUser.role.name, to: dto.role }
        : null;

    if (targetIsAdmin && !actorIsAdmin) {
      this.refuse(actor, id, 'target-is-admin');
      throw new ForbiddenException(
        'Only an administrator can change an administrator account',
      );
    }

    if (roleChange && !actorIsAdmin) {
      this.refuse(actor, id, 'role-change-not-admin');
      throw new ForbiddenException('Only an administrator can change roles');
    }

    if (roleChange && id === actor.id) {
      this.refuse(actor, id, 'own-role');
      throw new ForbiddenException('You cannot change your own role');
    }

    if (dto.email && dto.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: {
          email: dto.email,
        },
      });

      if (emailExists) {
        throw new ConflictException('Email already exists');
      }
    }

    const data: {
      email?: string;
      passwordHash?: string;
      roleId?: string;
    } = {};

    if (dto.email) {
      data.email = dto.email;
    }

    if (dto.password) {
      const problems = passwordPolicyViolations(dto.password);
      if (problems.length > 0) {
        throw new BadRequestException({ message: problems });
      }
      data.passwordHash = await bcrypt.hash(dto.password, PASSWORD_BCRYPT_COST);
    }

    if (roleChange) {
      const role = await this.prisma.role.findUnique({
        where: {
          name: roleChange.to,
        },
      });

      if (!role) {
        throw new NotFoundException('Role not found');
      }

      data.roleId = role.id;
    }

    const revokeSessions =
      roleChange !== null || data.passwordHash !== undefined;

    const { user, revokedSessions } = await this.prisma.$transaction(
      async (tx) => {
        // Counted inside the transaction, so two admins demoting each other
        // at once cannot both pass on a stale count.
        if (roleChange && roleChange.from === admin) {
          const admins = await tx.user.count({
            where: { role: { name: UserRole.ADMIN } },
          });
          if (admins <= 1) {
            throw new ConflictException('Cannot remove the last administrator');
          }
        }

        const user = await tx.user.update({
          where: { id },
          data,
          select: {
            id: true,
            email: true,
            role: { select: { id: true, name: true } },
            createdAt: true,
            updatedAt: true,
          },
        });

        const revoked = revokeSessions
          ? await tx.session.updateMany({
              where: { userId: id, status: 'ACTIVE' },
              data: { status: 'REVOKED', revokedAt: new Date() },
            })
          : { count: 0 };

        return { user, revokedSessions: revoked.count };
      },
    );

    if (roleChange) {
      this.logger.log(
        JSON.stringify({
          event: 'user.role_changed',
          actor: actor.id,
          target: id,
          from: roleChange.from,
          to: roleChange.to,
          revokedSessions,
        }),
      );
    }
    if (data.passwordHash !== undefined) {
      this.logger.log(
        JSON.stringify({
          event: 'user.password_reset_by_admin',
          actor: actor.id,
          target: id,
          revokedSessions,
        }),
      );
    }

    return user;
  }

  private refuse(actor: UserActor, target: string, reason: string): void {
    this.logger.warn(
      JSON.stringify({
        event: 'user.update_refused',
        actor: actor.id,
        actorRole: actor.role,
        target,
        reason,
      }),
    );
  }

  async remove(id: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.session.deleteMany({
      where: {
        userId: id,
      },
    });

    await this.prisma.user.delete({
      where: {
        id,
      },
    });

    return {
      message: 'User deleted successfully',
    };
  }
}
