/** รูปแบบ code ของข้อมูลอ้างอิง: ตัวพิมพ์ใหญ่ ตัวเลข และ - เท่านั้น (สเปกข้อ 4.1) */
export const REFERENCE_CODE_PATTERN = /^[A-Z0-9-]+$/;
export const REFERENCE_CODE_MESSAGE =
  'code ต้องเป็นตัวพิมพ์ใหญ่ ตัวเลข และ - เท่านั้น เช่น SCI หรือ LAB-1';
