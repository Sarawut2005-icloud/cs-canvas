// Global Identity ของ Core Hub เก็บด้วยชื่อ core_user_id / coreUserId เท่านั้น
export class StudentEntity {
  coreUserId: string;   // ค่า sub จาก token
  studentCode: string;  // ข้อมูลธุรกิจของระบบย่อยเอง — ใช้ได้
  coreRole: string;
}
