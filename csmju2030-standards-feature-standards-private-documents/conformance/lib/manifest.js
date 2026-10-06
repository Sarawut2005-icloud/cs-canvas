'use strict';
/**
 * Manifest loader for the conformance runner.
 *
 * แหล่งเดียวของข้อมูลระบบย่อยคือ `subsystem.yaml` ที่รากของ repo (ไฟล์เดียวกับที่
 * CI ใช้) รองรับ `.json` ด้วยเพื่อความสะดวกในการทดสอบ
 *
 * ตัวอ่าน YAML ในไฟล์นี้รองรับ subset ที่มาตรฐานใช้เท่านั้น:
 *   - block mapping ซ้อนกันได้ (ใช้ indent 2 ช่อง)
 *   - list ของ scalar (`- GET /api/health`)
 *   - scalar เป็น string / number / boolean / null
 *   - comment ขึ้นต้นด้วย `#`
 * ไม่รองรับ: flow mapping (`{a: 1}`), multi-line string, anchor
 *
 * บัญชีทดสอบไม่อยู่ใน manifest (ตั้งแต่ standards 1.7.0) — manifest ที่ยังมี
 * `test_accounts` ถูกปฏิเสธทันที ดู lib/accounts.js
 */
const fs = require('node:fs');
const path = require('node:path');

function parseScalar(raw) {
  const value = raw.trim();

  if (value === '' || value === '~' || value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;

  const unquoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
      ? value.slice(1, -1)
      : value;

  if (unquoted === value && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);

  return unquoted;
}

/** YAML subset → plain object. โยน error พร้อมเลขบรรทัดเมื่อรูปแบบไม่รองรับ */
function parseYaml(text) {
  const root = {};
  const stack = [{ indent: -1, node: root }];

  // \r\n ด้วย: บน Windows ที่ตั้ง core.autocrlf=true ไฟล์ใน working tree เป็น CRLF
  // ถ้าตัดแค่ \n จะเหลือ \r ท้ายบรรทัด regex ตัดคอมเมนต์ (`.*$`) จับไม่ติด
  // แล้วคอมเมนต์บรรทัดแรกจะถูกมองเป็น "ไม่ใช่ key: value"
  text.split(/\r?\n/).forEach((rawLine, index) => {
    const withoutComment = rawLine.replace(/\s+#.*$/, '').replace(/^\s*#.*$/, '');
    if (withoutComment.trim() === '') return;

    const indent = withoutComment.length - withoutComment.trimStart().length;
    const line = withoutComment.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();

    const parent = stack[stack.length - 1].node;

    if (line.startsWith('- ')) {
      if (!Array.isArray(parent.__list)) parent.__list = [];
      parent.__list.push(parseScalar(line.slice(2)));
      return;
    }

    const separator = line.indexOf(':');
    if (separator === -1) {
      throw new Error(`subsystem manifest: บรรทัดที่ ${index + 1} ไม่ใช่ "key: value"`);
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (value === '') {
      const child = {};
      parent[key] = child;
      stack.push({ indent, node: child });
    } else {
      parent[key] = parseScalar(value);
    }
  });

  // แปลง node ที่เก็บ list ให้เป็น array จริง
  const collapse = (node) => {
    if (node === null || typeof node !== 'object') return node;
    if (Array.isArray(node.__list)) return node.__list;

    for (const [key, value] of Object.entries(node)) node[key] = collapse(value);
    return node;
  };

  return collapse(root);
}

const camel = (key) => key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

/** snake_case ทั้งก้อน → camelCase (ให้โค้ดฝั่ง runner อ่านง่าย) */
function camelizeDeep(value) {
  if (Array.isArray(value)) return value.map(camelizeDeep);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [camel(key), camelizeDeep(item)]),
  );
}

const DEFAULT_MANIFESTS = ['subsystem.yaml', 'subsystem.yml', 'csmju-subsystem.json'];

function resolveManifestPath(explicitPath) {
  if (explicitPath) {
    if (!fs.existsSync(explicitPath)) throw new Error(`ไม่พบ manifest: ${explicitPath}`);
    return explicitPath;
  }

  return DEFAULT_MANIFESTS.find((candidate) => fs.existsSync(candidate)) ?? null;
}

/**
 * อ่าน manifest แล้วคืนค่าเป็น camelCase
 * `name` (ตาม subsystem.yaml) ถูกแมปเป็น `subsystemId` ที่ runner ใช้
 * `core_hub_web_url` กลายเป็น `coreHubWebUrl` — เว็บของ Core Hub ที่ L3 ใช้ตรวจ
 * ว่า /auth/login ส่งเบราว์เซอร์ไปถูกที่ (run.js รับ `--core-hub-web` ทับได้)
 */
function loadManifest(explicitPath) {
  const manifestPath = resolveManifestPath(explicitPath);
  if (!manifestPath) return { manifest: {}, manifestPath: null };

  const raw = fs.readFileSync(manifestPath, 'utf8');
  const parsed = path.extname(manifestPath) === '.json' ? JSON.parse(raw) : parseYaml(raw);
  const manifest = camelizeDeep(parsed);

  // รหัสผ่านใน repo = รั่วไปกับทุก clone และ fork · ไม่แสดงค่าที่พบ
  if (Object.prototype.hasOwnProperty.call(manifest, 'testAccounts')) {
    throw new Error(
      `${path.basename(manifestPath)} มี test_accounts — runner ไม่อ่านบัญชีจาก manifest แล้ว (standards 1.7.0) ` +
        'และรหัสผ่านต้องไม่อยู่ใน repo\n' +
        `  ลบ test_accounts ออกจาก ${manifestPath} (ถ้าเคย commit รหัสจริงไป ให้แจ้งผู้ดูแลเปลี่ยนรหัส)\n` +
        '  แล้วใส่บัญชีในไฟล์นอก repo ที่ CONFORMANCE_ACCOUNTS_FILE ชี้ — ดู docs/conformance.md ข้อ 2.1',
    );
  }

  if (!manifest.subsystemId && manifest.name) manifest.subsystemId = manifest.name;
  if (!manifest.level && manifest.conformanceLevel) manifest.level = manifest.conformanceLevel;

  return { manifest, manifestPath: path.resolve(manifestPath) };
}

module.exports = { loadManifest, parseYaml };
