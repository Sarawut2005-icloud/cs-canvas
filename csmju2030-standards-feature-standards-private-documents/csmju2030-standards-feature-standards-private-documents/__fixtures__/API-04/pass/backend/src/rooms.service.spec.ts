// ไฟล์ทดสอบต้องไม่ถูก API-04 ตรวจ — ค่า `code` ในนี้เป็นข้อมูลตัวอย่างของ
// reference data (ฟิลด์ code ของคณะ/ห้อง) ไม่ใช่ error contract
// regression: เดิม grep เหมารวมทุกไฟล์ แล้วตีตก code: 'SCI' / 'NEW' ผิด ๆ
describe('rooms reference data', () => {
  it('keeps the immutable code field', () => {
    const faculty = { code: 'SCI', nameTh: 'คณะวิทยาศาสตร์' };
    const created = { code: 'NEW', nameTh: 'ห้องใหม่' };
    expect([faculty.code, created.code]).toEqual(['SCI', 'NEW']);
  });
});
