// ดึงรายชื่อคณะจาก API กลาง ไม่ hardcode — data-dictionary.md ข้อ 3
export async function getFaculties() {
  const res = await fetch('/v1/faculties');
  return res.json();
}
