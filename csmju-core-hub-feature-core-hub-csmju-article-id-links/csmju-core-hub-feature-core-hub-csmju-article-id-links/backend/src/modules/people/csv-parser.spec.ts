import { parseCsv } from './csv-parser';

describe('parseCsv — parser ที่เขียนเองตามสเปกข้อ 3.1', () => {
  it('header แถวแรกกลายเป็น key ของทุกแถว', () => {
    const doc = parseCsv('a,b\n1,2\n3,4\n');
    expect(doc.headers).toEqual(['a', 'b']);
    expect(doc.rows).toEqual([
      { line: 2, values: { a: '1', b: '2' } },
      { line: 3, values: { a: '3', b: '4' } },
    ]);
  });

  it('ค่า quoted มี comma และขึ้นบรรทัดข้างในได้', () => {
    const doc = parseCsv(
      'name,note\n"ใจดี, สมชาย","บรรทัด 1\nบรรทัด 2"\nx,y\n',
    );
    expect(doc.rows[0].values).toEqual({
      name: 'ใจดี, สมชาย',
      note: 'บรรทัด 1\nบรรทัด 2',
    });
    // แถวถัดไปยังชี้เลขบรรทัดในไฟล์ต้นฉบับถูก (บรรทัด 2 กิน 2 บรรทัด)
    expect(doc.rows[1].line).toBe(4);
  });

  it('"" ในเครื่องหมายคำพูดคือ " ตัวเดียว', () => {
    const doc = parseCsv('t\n"เขาพูดว่า ""สวัสดี"""\n');
    expect(doc.rows[0].values.t).toBe('เขาพูดว่า "สวัสดี"');
  });

  it('ตัดช่องว่างหัวท้ายของทุกช่อง รวม header', () => {
    const doc = parseCsv(' a , b \n 1 ,  2  \n');
    expect(doc.headers).toEqual(['a', 'b']);
    expect(doc.rows[0].values).toEqual({ a: '1', b: '2' });
  });

  it('ข้ามแถวว่างและแถวที่มีแต่ช่องว่าง แต่เลขบรรทัดยังนับตามไฟล์', () => {
    const doc = parseCsv('a,b\n\n1,2\n   \n\n3,4\n');
    expect(doc.rows.map((r) => r.line)).toEqual([3, 6]);
  });

  it('รองรับ \\r\\n และตัด BOM', () => {
    const doc = parseCsv('﻿a,b\r\n1,2\r\n3,4');
    expect(doc.headers).toEqual(['a', 'b']);
    expect(doc.rows).toHaveLength(2);
    expect(doc.rows[1].values).toEqual({ a: '3', b: '4' });
  });

  it('ช่องที่ขาดเติมเป็นค่าว่าง · ไฟล์ว่างได้ header ว่าง', () => {
    expect(parseCsv('a,b,c\n1\n').rows[0].values).toEqual({
      a: '1',
      b: '',
      c: '',
    });
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });

  it('quote ไม่ปิด → โยน error พร้อมเลขบรรทัด', () => {
    expect(() => parseCsv('a\n"ไม่ปิด\n')).toThrow('บรรทัด 2');
  });
});
