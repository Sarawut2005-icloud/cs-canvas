'use strict';
/**
 * Core Hub test accounts for the conformance runner (standards 1.7.0).
 *
 * บัญชีมาจากไฟล์ JSON นอก repo ที่ env CONFORMANCE_ACCOUNTS_FILE ชี้เท่านั้น
 *
 *   { "owner": { "email": "...", "password": "..." }, "staff": { ... }, "lecturer": { ... } }
 *
 * คีย์คือ core role (admin · student · staff · alumni · lecturer · guest) และ `owner`
 * — บัญชีที่ลงทะเบียนระบบ ใช้อ่านทะเบียนใน L3 เมื่อไม่มี admin · role ที่ไม่มีบัญชี
 * = เคสที่ต้องใช้ role นั้นขึ้น SKIP
 *
 * ไม่มีไฟล์: ใช้บัญชี seed ได้เฉพาะ Core Hub ในเครื่อง (localhost · 127.0.0.1 · [::1])
 * Core Hub อื่นหยุดก่อน login บัญชีใด ๆ
 *
 * login บัญชีละครั้งต่อการรัน และไม่ลองซ้ำเมื่อไม่ผ่าน (รวม 429): Core Hub ล็อกอีเมล
 * หลังผิด 10 ครั้งใน 15 นาที และบัญชีทดสอบบน server จริงใช้ร่วมกันทุกทีม
 * ไม่พิมพ์รหัสผ่านหรือ token ในทุกกรณี
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { call, redact } = require('./harness');
const { decodeJwt } = require('./tokens');

const ACCOUNTS_ENV = 'CONFORMANCE_ACCOUNTS_FILE';

/** Core roles, in the order the runner reports them. */
const ROLES = ['admin', 'student', 'staff', 'alumni', 'lecturer', 'guest'];

/** Not a role: the account that registered the subsystem (reads the registry in L3). */
const OWNER = 'owner';

/** Seeded by Core Hub's prisma/seed.ts in development only — never on a server. */
const LOCAL_SEED_ACCOUNTS = {
  admin: { email: 'admin@core.local', password: 'password1' },
  student: { email: 'student@core.local', password: 'password2' },
  staff: { email: 'staff@core.local', password: 'password3' },
  alumni: { email: 'alumni@core.local', password: 'password4' },
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** True only for a Core Hub on this machine: localhost, 127.0.0.1 or [::1]. */
function isLocalCoreHub(url) {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function realpath(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

/** Nearest folder at or above `start` that holds `.git` (a git work tree), or null. */
function workTreeOf(start) {
  let dir = path.resolve(start);

  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return realpath(dir);
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Work trees an accounts file must stay out of: the manifest's, the cwd's, the runner's. */
function repoRootsFor({ manifestPath, cwd = process.cwd(), runnerDir }) {
  const starts = [manifestPath ? path.dirname(manifestPath) : null, cwd, runnerDir];
  return [...new Set(starts.filter(Boolean).map(workTreeOf).filter(Boolean))];
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

function expandHome(target) {
  if (target === '~') return os.homedir();
  if (target.startsWith('~/') || target.startsWith('~\\')) {
    return path.join(os.homedir(), target.slice(2));
  }
  return target;
}

/** File text without a BOM; Windows editors write UTF-8 with BOM or UTF-16 LE. */
function readText(file) {
  const bytes = fs.readFileSync(file);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.toString('utf16le').slice(1);
  return bytes.toString('utf8').replace(/^﻿/, '');
}

function readAccountsFile(rawPath, repoRoots) {
  const resolved = path.resolve(expandHome(rawPath));
  let file;

  try {
    file = fs.realpathSync(resolved);
  } catch {
    throw new Error(`${ACCOUNTS_ENV}: ไม่พบไฟล์ ${resolved}`);
  }

  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error(`${ACCOUNTS_ENV}: ${file} ไม่ใช่ไฟล์`);

  // ใน repo = commit ได้ด้วย git add -A หรือ -f แม้จะอยู่ใน .gitignore
  const root = repoRoots.find((candidate) => isInside(candidate, file));
  if (root) {
    throw new Error(
      `${ACCOUNTS_ENV}: ${file} อยู่ใน repo (${root}) — ไฟล์บัญชีต้องอยู่นอก repo เสมอ ` +
        'แม้จะอยู่ใน .gitignore\n' +
        '  ย้ายไปไว้เช่น ~/.csmju/conformance-accounts.json แล้ว chmod 600',
    );
  }

  let text;
  try {
    text = readText(file);
  } catch (error) {
    throw new Error(`${ACCOUNTS_ENV}: อ่าน ${file} ไม่ได้ (${error.code ?? error.message})`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // ข้อความ error ของ JSON.parse ยกเนื้อไฟล์บางส่วนมาด้วย ซึ่งอาจเป็นรหัสผ่าน จึงไม่แสดง
    throw new Error(`${ACCOUNTS_ENV}: ${file} ไม่ใช่ JSON ที่ถูกต้อง (ไม่แสดงเนื้อหาเพื่อไม่ให้รหัสผ่านหลุด)`);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `${ACCOUNTS_ENV}: ${file} ต้องเป็น object ที่คีย์เป็นชื่อ role หรือ owner — ดู docs/conformance.md ข้อ 2.1`,
    );
  }

  const known = [OWNER, ...ROLES];
  const accounts = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (!known.includes(key)) {
      throw new Error(`${ACCOUNTS_ENV}: ไม่รู้จักคีย์ "${key.slice(0, 40)}" — ใช้ได้เฉพาะ ${known.join(' · ')}`);
    }

    const valid =
      value !== null &&
      typeof value === 'object' &&
      typeof value.email === 'string' &&
      value.email.trim() !== '' &&
      typeof value.password === 'string' &&
      value.password !== '';

    if (!valid) {
      throw new Error(`${ACCOUNTS_ENV}: บัญชี "${key}" ต้องมี email และ password เป็นข้อความที่ไม่ว่าง`);
    }

    accounts[key] = { email: value.email.trim(), password: value.password };
  }

  // login ได้ครั้งเดียวต่ออีเมล — อีเมลเดียวกันจึงต้องมีรหัสเดียว
  const firstKeyOf = new Map();
  for (const [key, account] of Object.entries(accounts)) {
    const email = account.email.toLowerCase();
    const first = firstKeyOf.get(email);

    if (first === undefined) {
      firstKeyOf.set(email, key);
    } else if (accounts[first].password !== account.password) {
      throw new Error(
        `${ACCOUNTS_ENV}: "${first}" กับ "${key}" ใช้อีเมลเดียวกันแต่รหัสผ่านไม่ตรงกัน — แก้ให้ตรงกันก่อนรัน`,
      );
    }
  }

  const warnings = [];
  if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
    warnings.push(`${file} ให้ผู้ใช้อื่นอ่านได้ — chmod 600 ${file}`);
  }

  return { file, accounts, warnings };
}

/**
 * Where this run's accounts come from. Throws — before any login — when there
 * is no usable source.
 */
function resolveAccounts({ coreHubUrl, env = process.env, repoRoots = [] }) {
  const configured = (env[ACCOUNTS_ENV] ?? '').trim();

  if (configured) {
    return { source: 'file', ...readAccountsFile(configured, repoRoots) };
  }

  if (isLocalCoreHub(coreHubUrl)) {
    return { source: 'local-seed', accounts: { ...LOCAL_SEED_ACCOUNTS }, warnings: [] };
  }

  throw new Error(
    `ไม่ได้ตั้ง ${ACCOUNTS_ENV} — core_hub_url (${coreHubUrl}) ไม่ใช่ Core Hub ในเครื่อง ` +
      'จึงไม่มีบัญชี seed ให้ใช้ runner หยุดก่อน login บัญชีใด ๆ\n' +
      '  ใส่บัญชีในไฟล์ JSON นอก repo (เช่น ~/.csmju/conformance-accounts.json · chmod 600) แล้วรัน\n' +
      `    ${ACCOUNTS_ENV}=~/.csmju/conformance-accounts.json node standards/conformance/run.js\n` +
      '  รูปแบบไฟล์: docs/conformance.md ข้อ 2.1',
  );
}

/** Why a login gave no token, in words a team can act on. Never the password. */
function loginProblem(response) {
  const { status } = response;

  if (status === 0) return `เชื่อมต่อ Core Hub ไม่ได้ (${response.error})`;
  if (status >= 300 && status < 400) {
    return (
      `Core Hub ตอบ ${status} ไปที่ ${redact(response.location ?? '(ไม่มี Location)')} — ` +
      'แก้ core_hub_url ให้เป็น origin ของ Core Hub (runner ไม่ตาม redirect เพื่อไม่ส่งรหัสผ่านซ้ำ)'
    );
  }
  if (status === 401) return '401 อีเมลหรือรหัสผ่านไม่ถูก';
  if (status === 403) return '403 Core Hub ปฏิเสธบัญชีนี้ (เช่น บุคคลที่ผูกไว้เป็น INACTIVE)';
  if (status === 429) {
    const wait = response.headers.get('retry-after');
    return `429 อีเมลนี้ถูกล็อกหรือเรียกถี่เกิน — ${wait ? `รอ ${wait} วินาที` : 'รอสักครู่'}ก่อนรันใหม่`;
  }
  if (response.ok) return `${status} แต่ไม่มี access_token ในคำตอบ`;
  return `HTTP ${status}`;
}

/** One POST /auth/login: no 429 retry, no redirect follow (either would send the password again). */
async function loginOnce(coreHubUrl, account) {
  const response = await call(`${coreHubUrl}/api/v1/auth/login`, {
    method: 'POST',
    json: { email: account.email, password: account.password },
    noRetry: true,
  });

  const body = response.body ?? {};
  const token = body.data?.access_token ?? body.access_token ?? null;

  if (response.ok && typeof token === 'string' && token.split('.').length === 3) return { token };
  return { token: null, problem: loginProblem(response) };
}

function roleOf(token) {
  try {
    return decodeJwt(token).payload.role;
  } catch {
    return undefined;
  }
}

/**
 * Logs each account in once — one request per distinct email, whatever Core Hub
 * answers. A role account must get a token of that role, otherwise its checks
 * would test the wrong role.
 */
async function loginAll(coreHubUrl, accounts, login = loginOnce) {
  const byEmail = new Map();
  const tokens = {};
  const failures = [];
  let ownerToken = null;

  for (const key of [...ROLES, OWNER]) {
    const account = accounts[key];
    if (!account) continue;

    const email = account.email.toLowerCase();
    if (!byEmail.has(email)) byEmail.set(email, await login(coreHubUrl, account));
    const { token, problem } = byEmail.get(email);

    if (!token) {
      failures.push({ key, problem });
    } else if (key === OWNER) {
      ownerToken = token;
    } else if (roleOf(token) !== key) {
      failures.push({ key, problem: `token เป็น role "${roleOf(token)}" ไม่ใช่ "${key}" — ใส่บัญชีให้ตรง role` });
    } else {
      tokens[key] = token;
    }
  }

  return { tokens, ownerToken, failures, attempts: byEmail.size };
}

module.exports = {
  ACCOUNTS_ENV,
  LOCAL_SEED_ACCOUNTS,
  OWNER,
  ROLES,
  isLocalCoreHub,
  loginAll,
  repoRootsFor,
  resolveAccounts,
  workTreeOf,
};
