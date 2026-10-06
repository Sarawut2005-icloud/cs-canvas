#!/usr/bin/env node
'use strict';
/**
 * API-04 (ข): สแกนค่าที่ประกาศในบล็อก `ErrorCode` (const/enum/type) ว่าอยู่ใน
 * รายการมาตรฐานหรือไม่ — การประกาศมักกินหลายบรรทัด grep ทีละบรรทัดมองไม่เห็น
 *
 * อยู่เป็นไฟล์แยก ไม่ฝังใน check-api-conventions.sh เพราะ heredoc ซ้อนใน $( )
 * ทำให้ bash 3.2 ของ macOS (ตัว default ทุกเครื่อง Mac) parse ทั้งสคริปต์ไม่ผ่าน
 *
 * ไฟล์ทดสอบ (*.spec.ts และโฟลเดอร์ test/) ไม่ถูกสแกน — ค่า code ในนั้นเป็น
 * ข้อมูลตัวอย่าง เช่น code: 'SCI' ของ reference data ไม่ใช่ error contract
 *
 * ใช้: node api04-errorcode-scan.js "CODE_A|CODE_B|..." <root>
 * ออก: บรรทัด "ไฟล์:บรรทัด: ข้อความ" ต่อหนึ่งค่าที่นอกมาตรฐาน (ว่าง = สะอาด)
 */
const fs = require('fs');

const allowed = new Set((process.argv[2] ?? '').split('|'));
const root = process.argv[3] ?? 'backend/src';
const found = [];

const DECLARATIONS = [
  /\b(?:const|let|var)\s+ErrorCode\b[^=]*=\s*\{([\s\S]*?)\}/g,
  /\benum\s+ErrorCode\s*\{([\s\S]*?)\}/g,
  /\btype\s+ErrorCode\s*=([\s\S]*?);/g,
];

const scan = (file) => {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of DECLARATIONS) {
    for (const match of text.matchAll(pattern)) {
      const bodyStart = match.index + match[0].indexOf(match[1]);
      for (const literal of match[1].matchAll(/['"]([A-Z][A-Z0-9_]*)['"]/g)) {
        if (allowed.has(literal[1])) continue;
        const line = text.slice(0, bodyStart + literal.index).split('\n').length;
        found.push(`${file}:${line}: ErrorCode มีค่า '${literal[1]}'`);
      }
    }
  }
};

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'test') continue;
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) scan(full);
  }
};

walk(root);
process.stdout.write(found.join('\n'));
