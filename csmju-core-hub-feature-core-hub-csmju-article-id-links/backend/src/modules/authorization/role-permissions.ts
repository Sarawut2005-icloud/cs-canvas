import { UserRole } from '../users/user-role.enum';
import { Permission } from './permission.enum';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // student and alumni deliberately lack USER_READ: with it, GET /users
  // returned every account's email to any signed-in student, and user ids
  // are guessable (user-001, ...), so hiding only the list would not help.
  // A user still sees their own record through GET /auth/me.
  [UserRole.STUDENT]: [
    Permission.SYSTEM_READ,
    Permission.CONTENT_READ,
    Permission.PEOPLE_ME_READ,
    Permission.REFERENCE_READ,
    Permission.IMAGE_UPLOAD,
    Permission.IMAGE_READ_OWN,
    Permission.IMAGE_DELETE_OWN,
    Permission.NOTIFICATION_READ_OWN,
    Permission.NOTIFICATION_UPDATE_OWN,
  ],

  [UserRole.ALUMNI]: [
    Permission.SYSTEM_READ,
    Permission.CONTENT_READ,
    Permission.PEOPLE_ME_READ,
    Permission.REFERENCE_READ,
    Permission.IMAGE_UPLOAD,
    Permission.IMAGE_READ_OWN,
    Permission.IMAGE_DELETE_OWN,
    Permission.NOTIFICATION_READ_OWN,
    Permission.NOTIFICATION_UPDATE_OWN,
  ],

  [UserRole.STAFF]: [
    // Read only: changing accounts (and roles) is for admins.
    Permission.USER_READ,
    Permission.SYSTEM_READ,
    Permission.SYSTEM_MANAGE,
    Permission.CONTENT_READ,

    // Staff look after the subsystems they own. Registering a new one is
    // granted per account (subsystem:create, user_permission_grants) to each
    // team's owner account — not to every staff member (PM 2026-10-05).
    Permission.SUBSYSTEM_READ_OWN,
    Permission.SUBSYSTEM_UPDATE_OWN,
    Permission.PEOPLE_ME_READ,
    Permission.PEOPLE_READ,
    Permission.PEOPLE_CONTACT_READ,
    // Staff download the student list as CSV; lecturers do not (PM 2026-10-05).
    Permission.PEOPLE_EXPORT,
    Permission.REFERENCE_READ,

    // Staff also upload news and general images.
    Permission.IMAGE_UPLOAD,
    Permission.IMAGE_READ_OWN,
    Permission.IMAGE_DELETE_OWN,
    // Staff write announcements; removing one is left to admins.
    Permission.CONTENT_CREATE,
    Permission.CONTENT_UPDATE,
    Permission.NOTIFICATION_READ_OWN,
    Permission.NOTIFICATION_UPDATE_OWN,
  ],

  // Lecturers read the registry, write announcements and look after the
  // subsystems they own — but manage neither accounts nor the platform
  // (PM 2026-09-29). Registering one is granted per account, as for staff.
  [UserRole.LECTURER]: [
    Permission.SYSTEM_READ,
    Permission.CONTENT_READ,
    Permission.SUBSYSTEM_READ_OWN,
    Permission.SUBSYSTEM_UPDATE_OWN,
    Permission.PEOPLE_ME_READ,
    Permission.PEOPLE_READ,
    Permission.PEOPLE_CONTACT_READ,
    Permission.REFERENCE_READ,
    Permission.IMAGE_UPLOAD,
    Permission.IMAGE_READ_OWN,
    Permission.IMAGE_DELETE_OWN,
    Permission.CONTENT_CREATE,
    Permission.CONTENT_UPDATE,
    Permission.NOTIFICATION_READ_OWN,
    Permission.NOTIFICATION_UPDATE_OWN,
  ],

  // A visitor sees the portal, the announcements and the shared reference
  // data — nothing about people, and no uploads.
  [UserRole.GUEST]: [
    Permission.SYSTEM_READ,
    Permission.CONTENT_READ,
    Permission.REFERENCE_READ,
    Permission.NOTIFICATION_READ_OWN,
    Permission.NOTIFICATION_UPDATE_OWN,
  ],

  [UserRole.ADMIN]: [
    Permission.USER_READ,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.SYSTEM_READ,
    Permission.SYSTEM_MANAGE,
    Permission.SYSTEM_OPEN,
    Permission.SYSTEM_CLOSE,
    Permission.CONTENT_READ,

    // Admins review requests and decide whether a subsystem is live.
    Permission.SUBSYSTEM_READ_OWN,
    Permission.SUBSYSTEM_READ_ANY,
    Permission.SUBSYSTEM_CREATE,
    Permission.SUBSYSTEM_UPDATE_OWN,
    Permission.SUBSYSTEM_UPDATE_ANY,
    Permission.SUBSYSTEM_DELETE,
    Permission.SUBSYSTEM_REVIEW,
    Permission.SUBSYSTEM_OPERATE,
    Permission.PEOPLE_ME_READ,
    Permission.PEOPLE_READ,
    Permission.PEOPLE_CONTACT_READ,
    Permission.PEOPLE_MANAGE,
    Permission.PEOPLE_EXPORT,
    Permission.REFERENCE_READ,
    Permission.REFERENCE_MANAGE,

    // Admins see and remove any image.
    Permission.IMAGE_UPLOAD,
    Permission.IMAGE_READ_OWN,
    Permission.IMAGE_READ_ANY,
    Permission.IMAGE_DELETE_OWN,
    Permission.IMAGE_DELETE_ANY,
    Permission.CONTENT_CREATE,
    Permission.CONTENT_UPDATE,
    Permission.CONTENT_DELETE,
    Permission.CONTENT_EXTERNAL_MANAGE,
    Permission.NOTIFICATION_READ_OWN,
    Permission.NOTIFICATION_UPDATE_OWN,
  ],
};

/** True when `role` holds `permission` in the matrix above. */
export function roleHasPermission(
  role: string | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role as UserRole]?.includes(permission) ?? false;
}
