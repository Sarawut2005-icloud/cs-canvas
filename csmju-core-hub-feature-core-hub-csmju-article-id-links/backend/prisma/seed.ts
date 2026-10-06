import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const roles = [
  {
    id: 'role-student',
    name: 'student',
  },
  {
    id: 'role-alumni',
    name: 'alumni',
  },
  {
    id: 'role-staff',
    name: 'staff',
  },
  {
    id: 'role-lecturer',
    name: 'lecturer',
  },
  {
    id: 'role-guest',
    name: 'guest',
  },
  {
    id: 'role-admin',
    name: 'admin',
  },
];

const permissions = [
  {
    id: 'permission-user-read',
    name: 'user:read',
    description: 'Read user information',
  },
  {
    id: 'permission-user-create',
    name: 'user:create',
    description: 'Create users',
  },
  {
    id: 'permission-user-update',
    name: 'user:update',
    description: 'Update users',
  },
  {
    id: 'permission-user-delete',
    name: 'user:delete',
    description: 'Delete users',
  },
  {
    id: 'permission-system-read',
    name: 'system:read',
    description: 'Read system information',
  },
  {
    id: 'permission-system-manage',
    name: 'system:manage',
    description: 'Manage systems',
  },
  {
    id: 'permission-system-open',
    name: 'system:open',
    description: 'Open systems',
  },
  {
    id: 'permission-system-close',
    name: 'system:close',
    description: 'Close systems',
  },
  {
    id: 'permission-subsystem-read-own',
    name: 'subsystem:read:own',
    description: 'Read subsystems the user owns',
  },
  {
    id: 'permission-subsystem-read-any',
    name: 'subsystem:read:any',
    description: 'Read every subsystem in the registry',
  },
  {
    id: 'permission-subsystem-create',
    name: 'subsystem:create',
    description: 'Submit a subsystem registration request',
  },
  {
    id: 'permission-subsystem-update-own',
    name: 'subsystem:update:own',
    description: 'Edit subsystems the user owns',
  },
  {
    id: 'permission-subsystem-update-any',
    name: 'subsystem:update:any',
    description: 'Edit any subsystem, including security-sensitive fields',
  },
  {
    id: 'permission-subsystem-delete',
    name: 'subsystem:delete',
    description: 'Delete a subsystem from the registry',
  },
  {
    id: 'permission-subsystem-review',
    name: 'subsystem:review',
    description: 'Approve or reject subsystems and exception requests',
  },
  {
    id: 'permission-subsystem-operate',
    name: 'subsystem:operate',
    description: 'Activate, deactivate or suspend subsystems',
  },
  // ข้อมูลบุคคล / Reference data — ต้องตรงกับ ROLE_PERMISSIONS ในโค้ด
  // id เปลี่ยนจาก permission-master-data-read ใน migration 20260930120000_master_data_followup
  {
    id: 'permission-people-me-read',
    name: 'people:me:read',
    description: 'Read own person profile (/people/me)',
  },
  {
    id: 'permission-people-read',
    name: 'people:read',
    description: 'Read people directory and advisors',
  },
  {
    id: 'permission-people-contact-read',
    name: 'people:contact:read',
    description: 'Read university email of other people',
  },
  {
    id: 'permission-reference-read',
    name: 'reference:read',
    description:
      'Read shared reference data (faculties, rooms, academic terms, ...)',
  },
  {
    id: 'permission-reference-manage',
    name: 'reference:manage',
    description: 'Create and update shared reference data',
  },
  {
    id: 'permission-people-manage',
    name: 'people:manage',
    description: 'Import people from CSV, change status, link core accounts',
  },
  {
    id: 'permission-people-export',
    name: 'people:export',
    description: 'Download the people list as CSV (no contact details)',
  },
  // Content — every role reads news; staff and admins write announcements
  {
    id: 'permission-content-read',
    name: 'content:read',
    description: 'Read published news and announcements',
  },
  // Image store
  {
    id: 'permission-image-upload',
    name: 'image:upload',
    description: 'Upload images (profile and general images need nothing more)',
  },
  {
    id: 'permission-image-read-own',
    name: 'image:read:own',
    description: 'List and read images the user uploaded',
  },
  {
    id: 'permission-image-read-any',
    name: 'image:read:any',
    description: 'List and read every image',
  },
  {
    id: 'permission-image-delete-own',
    name: 'image:delete:own',
    description: 'Delete images the user uploaded',
  },
  {
    id: 'permission-image-delete-any',
    name: 'image:delete:any',
    description: 'Delete any image',
  },
  {
    id: 'permission-content-create',
    name: 'content:create',
    description: 'Create announcements and upload news images',
  },
  {
    id: 'permission-content-update',
    name: 'content:update',
    description: 'Edit and publish announcements',
  },
  {
    id: 'permission-content-delete',
    name: 'content:delete',
    description: 'Delete announcements',
  },
  {
    id: 'permission-content-external-manage',
    name: 'content:external:manage',
    description: 'Hide or show csmju.com news and banners on the front page',
  },
  {
    id: 'permission-notification-read-own',
    name: 'notification:read:own',
    description: 'Read your own notifications',
  },
  {
    id: 'permission-notification-update-own',
    name: 'notification:update:own',
    description: 'Mark your own notifications read',
  },
];

const rolePermissions = {
  student: [
    'system:read',
    'content:read',
    'people:me:read',
    'reference:read',
    'image:upload',
    'image:read:own',
    'image:delete:own',
    'notification:read:own',
    'notification:update:own',
  ],

  alumni: [
    'system:read',
    'content:read',
    'people:me:read',
    'reference:read',
    'image:upload',
    'image:read:own',
    'image:delete:own',
    'notification:read:own',
    'notification:update:own',
  ],

  staff: [
    'user:read',
    'system:read',
    'system:manage',
    'content:read',
    'subsystem:read:own',
    'subsystem:update:own',
    'people:me:read',
    'people:read',
    'people:contact:read',
    'people:export',
    'reference:read',
    'image:upload',
    'image:read:own',
    'image:delete:own',
    'content:create',
    'content:update',
    'notification:read:own',
    'notification:update:own',
  ],

  lecturer: [
    'system:read',
    'content:read',
    'subsystem:read:own',
    'subsystem:update:own',
    'people:me:read',
    'people:read',
    'people:contact:read',
    'reference:read',
    'image:upload',
    'image:read:own',
    'image:delete:own',
    'content:create',
    'content:update',
    'notification:read:own',
    'notification:update:own',
  ],

  guest: [
    'system:read',
    'content:read',
    'reference:read',
    'notification:read:own',
    'notification:update:own',
  ],

  admin: [
    'user:read',
    'user:create',
    'user:update',
    'user:delete',
    'system:read',
    'system:manage',
    'system:open',
    'system:close',
    'content:read',
    'subsystem:read:own',
    'subsystem:read:any',
    'subsystem:create',
    'subsystem:update:own',
    'subsystem:update:any',
    'subsystem:delete',
    'subsystem:review',
    'subsystem:operate',
    'people:me:read',
    'people:read',
    'people:contact:read',
    'people:manage',
    'people:export',
    'reference:read',
    'reference:manage',
    'image:upload',
    'image:read:own',
    'image:read:any',
    'image:delete:own',
    'image:delete:any',
    'content:create',
    'content:update',
    'content:delete',
    'content:external:manage',
    'notification:read:own',
    'notification:update:own',
  ],
};

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Password for a seeded account.
 *
 * Development keeps the well-known `password1`..`password4` from the README.
 * Production must supply `SEED_<ROLE>_PASSWORD` — the defaults are printed in
 * a public repository, so seeding them on a reachable server would hand the
 * admin account to anyone who reads the docs.
 */
function seedPassword(envName: string, devDefault: string): string {
  const fromEnv = process.env[envName];

  if (fromEnv && fromEnv.length >= 12) return fromEnv;

  if (isProduction) {
    throw new Error(
      `${envName} must be set (at least 12 characters) when NODE_ENV=production`,
    );
  }

  return devDefault;
}

// `username` is how the Subsystem Registry refers to people (`owner`,
// exception requests) — see data-dictionary.md §7. Without it registering a
// subsystem fails with "Subsystem owner not found".
//
// These are the README's sign-in accounts for a local machine. Production
// never gets them (see `seededUsers`): on a live server they are real logins
// with test names, and a seed that ran on every start brought back any that
// an admin had deleted. Passwords are read only for the accounts actually
// seeded, so production needs no SEED_* value for accounts it never creates.
const TEST_USERS = [
  {
    id: 'user-001',
    username: 'admin',
    email: 'admin@core.local',
    passwordEnv: 'SEED_ADMIN_PASSWORD',
    devPassword: 'password1',
    roleId: 'role-admin',
  },
  {
    id: 'user-002',
    username: 'student',
    email: 'student@core.local',
    passwordEnv: 'SEED_STUDENT_PASSWORD',
    devPassword: 'password2',
    roleId: 'role-student',
  },
  {
    id: 'user-003',
    username: 'staff',
    email: 'staff@core.local',
    passwordEnv: 'SEED_STAFF_PASSWORD',
    devPassword: 'password3',
    roleId: 'role-staff',
  },
  {
    id: 'user-004',
    username: 'alumni',
    email: 'alumni@core.local',
    passwordEnv: 'SEED_ALUMNI_PASSWORD',
    devPassword: 'password4',
    roleId: 'role-alumni',
  },
];

type TestUser = (typeof TEST_USERS)[number];

/**
 * The accounts this run seeds. Development: all four test accounts.
 * Production: none, except on a database with no administrator at all (the
 * very first start), which gets the bootstrap admin so someone can sign in
 * and create the real accounts. Once any admin exists the seed leaves the
 * users table alone — it neither updates nor recreates a test account.
 */
async function seededUsers(): Promise<TestUser[]> {
  if (!isProduction) return TEST_USERS;

  const admins = await prisma.user.count({
    where: { role: { name: 'admin' } },
  });
  return admins === 0
    ? TEST_USERS.filter((user) => user.roleId === 'role-admin')
    : [];
}

async function main() {
  console.log('Seeding database...');

  // Roles
  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        id: role.id,
      },
      update: {
        name: role.name,
      },
      create: role,
    });
  }

  // Permissions
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        id: permission.id,
      },
      update: {
        name: permission.name,
        description: permission.description,
      },
      create: permission,
    });
  }

  // Role -> Permission
  for (const role of roles) {
    const permissionNames =
      rolePermissions[role.name as keyof typeof rolePermissions];

    for (const permissionName of permissionNames) {
      const permission = await prisma.permission.findUnique({
        where: {
          name: permissionName,
        },
      });

      if (!permission) {
        throw new Error(`Permission not found: ${permissionName}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }

    // A permission taken away from a role (e.g. staff losing user:update)
    // must leave the table too — upsert alone only ever adds.
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permission: { name: { notIn: [...permissionNames] } },
      },
    });
  }

  // Users. A re-run never overwrites a password: an admin who changed theirs
  // through the API must not be reset to the seed value by the next deploy.
  // Set SEED_RESET_PASSWORDS=true to force the seed passwords back on.
  const resetPasswords = process.env.SEED_RESET_PASSWORDS === 'true';

  for (const { passwordEnv, devPassword, ...user } of await seededUsers()) {
    const passwordHash = await bcrypt.hash(
      seedPassword(passwordEnv, devPassword),
      12,
    );

    await prisma.user.upsert({
      where: {
        id: user.id,
      },
      update: {
        username: user.username,
        email: user.email,
        ...(resetPasswords && { passwordHash }),
        roleId: user.roleId,
      },
      create: {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordHash,
        roleId: user.roleId,
      },
    });
  }

  // Registered subsystems (Subsystem Registry).
  //
  // The Demo Student Subsystem is registered as an approved + active subsystem
  // so the central SSO flow has a callback URL on file on a local machine.
  // Production skips it (`subsystems` below): there its callback is
  // http://localhost:3001 of whoever clicks the menu, and since the container
  // seeds on every start, the upsert would put the menu back — and reactivate
  // it — on each restart. Production leaves the registry to the backoffice
  // and does not touch a row an older seed already created.
  const demoSubsystems = [
    {
      id: 'subsystem-student-service',
      name: 'student-service',
      displayName: 'CSMJU Student Service',
      ownerId: 'user-001',
      repo: 'demo-student-subsystem',
      standardsVersion: '1.0',
      defaultRoleMapping: {
        student: 'STUDENT',
        alumni: 'ALUMNI',
        staff: 'STAFF',
        admin: 'ADMIN',
      },
      callbackUrl:
        process.env.STUDENT_SERVICE_CALLBACK_URL ??
        'http://localhost:3001/auth/callback',
      // Where the backoffice Monitor probes `<baseUrl>/api/health`.
      baseUrl: process.env.STUDENT_SERVICE_BASE_URL ?? 'http://localhost:3001',
      approvalStatus: 'APPROVED' as const,
      status: 'ACTIVE' as const,
    },
  ];

  const subsystems = isProduction ? [] : demoSubsystems;

  for (const subsystem of subsystems) {
    await prisma.subsystem.upsert({
      where: { name: subsystem.name },
      update: {
        displayName: subsystem.displayName,
        ownerId: subsystem.ownerId,
        repo: subsystem.repo,
        standardsVersion: subsystem.standardsVersion,
        defaultRoleMapping: subsystem.defaultRoleMapping,
        callbackUrl: subsystem.callbackUrl,
        baseUrl: subsystem.baseUrl,
        approvalStatus: subsystem.approvalStatus,
        status: subsystem.status,
      },
      create: subsystem,
    });
  }

  // Sample announcements for the backoffice. `update: {}` keeps edits made
  // through the UI when the seed is run again. Local machines only: on the
  // live portal they read as real news, and their author is the test admin.
  const sampleAnnouncements = [
    {
      id: 'announcement-registration-2-2569',
      title: 'กำหนดการลงทะเบียนเรียน ภาคเรียนที่ 2/2569',
      content:
        'นักศึกษาลงทะเบียนเรียนผ่านระบบบริการการศึกษา ตามกำหนดการที่มหาวิทยาลัยประกาศ',
      category: 'วิชาการ',
      isPublished: true,
      publishedAt: new Date('2026-09-15T02:00:00Z'),
      authorId: 'user-001',
    },
    {
      id: 'announcement-scholarship-2569',
      title: 'รับสมัครทุนการศึกษา ประเภทเรียนดี',
      content:
        'นักศึกษาที่มีผลการเรียนเฉลี่ยสะสมตั้งแต่ 3.25 ขึ้นไป สามารถยื่นใบสมัครได้ที่สำนักงานสาขา',
      category: 'ทุนการศึกษา',
      isPublished: true,
      publishedAt: new Date('2026-09-10T02:00:00Z'),
      authorId: 'user-001',
    },
    {
      id: 'announcement-holiday-2569',
      title: 'งดการเรียนการสอนวันหยุดนักขัตฤกษ์',
      content:
        'งดการเรียนการสอนทุกรายวิชาในวันหยุดนักขัตฤกษ์ตามปฏิทินมหาวิทยาลัย',
      category: 'ทั่วไป',
      isPublished: false,
      publishedAt: new Date('2026-09-01T02:00:00Z'),
      authorId: 'user-001',
    },
  ];

  const announcements = isProduction ? [] : sampleAnnouncements;

  for (const announcement of announcements) {
    await prisma.announcement.upsert({
      where: { id: announcement.id },
      update: {},
      create: announcement,
    });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
