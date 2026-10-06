/**
 * parser CSV เขียนเองตามสเปก backoffice เฟส 2 ข้อ 3.1 (ห้ามเพิ่ม dependency)
 *
 * - แถวแรกเป็น header · ค่าคั่นด้วย comma
 * - ค่าที่ครอบด้วย "..." มี comma หรือขึ้นบรรทัดข้างในได้ · "" ในเครื่องหมายคำพูดคือ " ตัวเดียว
 * - ตัดช่องว่างหัวท้ายของทุกช่อง · ข้ามแถวที่ว่างทั้งแถว · รองรับทั้ง \r\n และ \n · ตัด BOM ทิ้ง
 */

export interface CsvRow {
  /** เลขบรรทัดในไฟล์ต้นฉบับ (เริ่มที่ 1 · header คือบรรทัด 1) ใช้ชี้แถวที่ผิดให้ผู้ใช้ */
  line: number;
  values: Record<string, string>;
}

export interface CsvDocument {
  headers: string[];
  rows: CsvRow[];
}

interface RawRecord {
  line: number;
  cells: string[];
}

/** แยกข้อความเป็นเรคอร์ด (ยังไม่ผูกกับ header) — เดินทีละตัวอักษรเพื่อรองรับ quote */
function tokenize(text: string): RawRecord[] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: RawRecord[] = [];

  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let sawQuoteInCell = false;

  const endCell = () => {
    cells.push(cell.trim());
    cell = '';
    sawQuoteInCell = false;
  };
  const endRecord = () => {
    endCell();
    // แถวว่างทั้งแถว (รวมแถวที่มีแต่ช่องว่าง) ข้ามไป
    if (cells.some((c) => c !== '')) records.push({ line: recordLine, cells });
    cells = [];
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      // quote เริ่มได้เฉพาะตอนช่องยังว่าง (ช่องว่างนำหน้าถูก trim ทิ้ง)
      if (cell.trim() === '' && !sawQuoteInCell) {
        cell = '';
        inQuotes = true;
        sawQuoteInCell = true;
      } else {
        cell += ch;
      }
    } else if (ch === ',') {
      endCell();
    } else if (ch === '\r') {
      // \r\n → จบเรคอร์ดที่ \n · \r เดี่ยว ๆ ถือเป็นจบเรคอร์ดเช่นกัน
      if (input[i + 1] !== '\n') {
        endRecord();
        line++;
        recordLine = line;
      }
    } else if (ch === '\n') {
      endRecord();
      line++;
      recordLine = line;
    } else {
      cell += ch;
    }
  }

  if (inQuotes) {
    throw new Error(`เครื่องหมายคำพูดไม่ปิดที่บรรทัด ${recordLine}`);
  }
  if (cell !== '' || cells.length > 0) endRecord();

  return records;
}

export function parseCsv(text: string): CsvDocument {
  const records = tokenize(text);
  if (records.length === 0) return { headers: [], rows: [] };

  const [head, ...body] = records;
  const headers = head.cells;

  const rows = body.map(({ line, cells }) => {
    const values: Record<string, string> = {};
    headers.forEach((header, i) => {
      values[header] = cells[i] ?? '';
    });
    return { line, values };
  });

  return { headers, rows };
}
