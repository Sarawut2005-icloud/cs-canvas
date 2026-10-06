// ประกาศ code นอกรายการไว้ใน ErrorCode แล้วใช้ผ่าน ErrorCode.RATE_LIMITED
// ไม่มี code ที่เขียนเป็นข้อความตรง ๆ ตรงจุดที่สร้าง response — ตัวตรวจ
// เดิมที่ดูแค่รูปนั้นจึงปล่อยผ่าน ต้องตก
export const ErrorCode = {
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export function rateLimited() {
  return { success: false, error: { code: ErrorCode.RATE_LIMITED, message: 'slow down' } };
}
