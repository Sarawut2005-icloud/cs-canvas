import { UserRole } from '../users/user-role.enum';
import { Permission } from './permission.enum';
import { ROLE_PERMISSIONS, roleHasPermission } from './role-permissions';

describe('ROLE_PERMISSIONS', () => {
  it('ทุก core role มีชุดสิทธิ์ (student · alumni · staff · lecturer · guest · admin)', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(
      Object.values(UserRole).sort(),
    );
  });

  it('lecturer: ดูข้อมูลบุคคล · เขียนประกาศ · ดูแลระบบของตัวเอง — แต่ไม่จัดการบัญชีและระบบ', () => {
    for (const p of [
      Permission.PEOPLE_READ,
      Permission.CONTENT_CREATE,
      Permission.CONTENT_UPDATE,
      Permission.SUBSYSTEM_UPDATE_OWN,
    ]) {
      expect(roleHasPermission(UserRole.LECTURER, p)).toBe(true);
    }
    for (const p of [
      Permission.USER_READ,
      Permission.USER_CREATE,
      Permission.USER_UPDATE,
      Permission.USER_DELETE,
      Permission.SYSTEM_MANAGE,
      Permission.SUBSYSTEM_REVIEW,
      Permission.SUBSYSTEM_UPDATE_ANY,
      Permission.PEOPLE_MANAGE,
      // Registering is granted per account (PM 2026-10-05).
      Permission.SUBSYSTEM_CREATE,
    ]) {
      expect(roleHasPermission(UserRole.LECTURER, p)).toBe(false);
    }
  });

  it('subsystem:create: admin by role only — staff and lecturer get it per account', () => {
    expect(roleHasPermission(UserRole.ADMIN, Permission.SUBSYSTEM_CREATE)).toBe(
      true,
    );
    for (const role of Object.values(UserRole).filter(
      (r) => r !== UserRole.ADMIN,
    )) {
      expect(roleHasPermission(role, Permission.SUBSYSTEM_CREATE)).toBe(false);
    }
  });

  it('guest: ดูพอร์ทัล ประกาศ ข้อมูลอ้างอิง และการแจ้งเตือนของตัวเองเท่านั้น', () => {
    expect([...ROLE_PERMISSIONS[UserRole.GUEST]].sort()).toEqual(
      [
        Permission.SYSTEM_READ,
        Permission.CONTENT_READ,
        Permission.REFERENCE_READ,
        Permission.NOTIFICATION_READ_OWN,
        Permission.NOTIFICATION_UPDATE_OWN,
      ].sort(),
    );
  });
});
