// Core Hub เป็นเจ้าของตาราง users — user_id คือ PK ของมันเอง ไม่ใช่ alias
// ของ Global Identity ระบบย่อยเขียนแบบนี้ไม่ได้ (DD-01)
export class UserEntity {
  user_id: string;
  email: string;
}
