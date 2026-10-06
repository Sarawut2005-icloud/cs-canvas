// MJU SSO จำลอง — ใช้ทดสอบบนเครื่องเท่านั้น ห้ามใช้ใน production · ข้อมูลทั้งหมดเป็น mock
// POST /token.aspx {clientID, code} → profile · code ใช้ได้ครั้งเดียวเหมือนของจริง
// GET  /signin.aspx?cid=… → 302 กลับไป /auth/mju/signin?ac=<code ถัดไป> (ตั้งด้วย GET /next?profile=A)
// วิธีใช้: backend/README.md §5.7 "ทดสอบบนเครื่องด้วย MJU จำลอง"
import http from 'node:http';

const CLIENT_ID = 'testclient0000000000000001';
const WEB = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3100';
const PROFILES = {
  A: { citizenID: '1000000000001', studentCode: '9900000001', e_mail: '', titleName: 'นาย', firstName: 'ทดสอบ', lastName: 'หนึ่ง' },
  S: { citizenID: '1000000000005', studentCode: '', e_mail: 'teststaff@mju.ac.th', titleName: 'นาย', firstName: 'ทดสอบ', lastName: 'ห้า' },
};
const used = new Set();
let nextProfile = 'A';
let counter = 0;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/token.aspx') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const { clientID, code } = JSON.parse(raw);
      const profile = PROFILES[code?.[0]];
      const ok = clientID === CLIENT_ID && /^[A-Za-z0-9]{32}$/.test(code) && profile && !used.has(code);
      used.add(code);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ok ? profile : { status: 'fail', message: 'invalid grant' }));
    });
    return;
  }
  if (url.pathname === '/next') {           // เลือกโปรไฟล์ของการ login ครั้งถัดไป
    nextProfile = url.searchParams.get('profile') ?? 'A';
    res.writeHead(204).end();
    return;
  }
  if (url.pathname === '/signin.aspx') {    // ทำเหมือน MJU ตอบทันทีเพราะ login อยู่แล้ว
    counter += 1;
    const code = (nextProfile + String(counter).padStart(31, '0')).slice(0, 32);
    res.writeHead(302, { Location: `${WEB}/auth/mju/signin?ac=${code}` }).end();
    return;
  }
  if (url.pathname === '/signout.aspx') {
    res.writeHead(302, { Location: `${WEB}/auth/mju/signout` }).end();
    return;
  }
  res.writeHead(404).end();
}).listen(3510, '127.0.0.1', () => console.log('MJU SSO จำลองที่ http://127.0.0.1:3510'));
