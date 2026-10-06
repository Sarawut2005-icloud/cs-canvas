export enum Permission {
  USER_READ = 'user:read',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  SYSTEM_READ = 'system:read',
  SYSTEM_MANAGE = 'system:manage',
  SYSTEM_OPEN = 'system:open',
  SYSTEM_CLOSE = 'system:close',

  // Subsystem Registry — `:own` means `subsystem.ownerId === user.id`, which
  // the service checks against the real record (authorization.md §4).
  SUBSYSTEM_READ_OWN = 'subsystem:read:own',
  SUBSYSTEM_READ_ANY = 'subsystem:read:any',
  SUBSYSTEM_CREATE = 'subsystem:create',
  SUBSYSTEM_UPDATE_OWN = 'subsystem:update:own',
  SUBSYSTEM_UPDATE_ANY = 'subsystem:update:any',
  SUBSYSTEM_DELETE = 'subsystem:delete',
  SUBSYSTEM_REVIEW = 'subsystem:review',
  SUBSYSTEM_OPERATE = 'subsystem:operate',

  // Image store — uploading profile and general images needs only
  // `image:upload`; news images also need `content:create` (checked in the
  // service, since it depends on the category in the request body).
  IMAGE_UPLOAD = 'image:upload',
  IMAGE_READ_OWN = 'image:read:own',
  IMAGE_READ_ANY = 'image:read:any',
  IMAGE_DELETE_OWN = 'image:delete:own',
  IMAGE_DELETE_ANY = 'image:delete:any',

  // Content
  CONTENT_READ = 'content:read',
  CONTENT_CREATE = 'content:create',
  CONTENT_UPDATE = 'content:update',
  CONTENT_DELETE = 'content:delete',
  CONTENT_EXTERNAL_MANAGE = 'content:external:manage', // ซ่อน/แสดงข่าวจาก csmju.com บนหน้าแรก (admin เท่านั้น)

  // ข้อมูลบุคคล (ข้อมูลอ้างอิงใช้ REFERENCE_* ด้านล่าง)
  PEOPLE_ME_READ = 'people:me:read', // ข้อมูลของตัวเอง (/people/me) — ทุก role
  PEOPLE_READ = 'people:read', // รายชื่อบุคคลและอาจารย์ที่ปรึกษา (ไม่มีอีเมล)
  PEOPLE_CONTACT_READ = 'people:contact:read', // อีเมลมหาวิทยาลัยของบุคคลอื่น
  PEOPLE_MANAGE = 'people:manage', // นำเข้า CSV · แก้สถานะ · ผูกบัญชี (admin เท่านั้น)
  PEOPLE_EXPORT = 'people:export', // ดาวน์โหลดรายชื่อเป็น CSV (staff · admin) — ไม่มีอีเมล

  // Reference data — ใช้ร่วมกันทุกชุดข้อมูลอ้างอิง (คณะ ห้อง ภาคการศึกษา ...)
  REFERENCE_READ = 'reference:read',
  REFERENCE_MANAGE = 'reference:manage',

  // The signed-in user's own notifications — every role has them, and the
  // service scopes every query to the caller (authorization.md §4).
  NOTIFICATION_READ_OWN = 'notification:read:own',
  NOTIFICATION_UPDATE_OWN = 'notification:update:own',
}
