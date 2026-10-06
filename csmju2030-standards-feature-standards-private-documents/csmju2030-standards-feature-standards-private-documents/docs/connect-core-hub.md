# เชื่อมระบบย่อยกับ Core Hub จริง

**เวอร์ชัน 1.0** (standards 1.7.0) · สำหรับทุกทีมที่ทำระบบย่อย

Core Hub ตัวจริงอยู่ที่ **`https://csmju2030.jowave.com`** (API ใต้ `/api/v1` · เว็บที่ `/`)
ช่วงก่อนเปิดใช้ server อยู่ใน**โหมดก่อนเปิดใช้** — ระบบย่อยรันบน `localhost` ของทีม แล้วให้ Core Hub ตัวจริงส่งผู้ใช้กลับมาที่เครื่องของทีม

- **ไม่ต้องโคลนหรือรัน Core Hub เอง** — repo ของ Core Hub มีข้อมูลนักศึกษาจริง ถ้าเคยโคลนไว้ให้ลบทิ้ง
  ([`LOCAL_INTEGRATION_GUIDE.md`](LOCAL_INTEGRATION_GUIDE.md) เป็นของทีม Core Hub เท่านั้น)
- เอกสารนี้คือขั้นตอน · กฎอยู่ใน [`auth-contract.md`](auth-contract.md) · [`subsystem-registry.md`](subsystem-registry.md) ·
  [`reference-data.md`](reference-data.md) · [`conformance.md`](conformance.md)
- ตัวอย่างที่รันได้จริง: repo `demo-student-subsystem` (ระบบจองห้อง · frontend 3201 · backend 4201)

---

## 0. ภาพรวม

```text
เบราว์เซอร์ ─► http://localhost:32xx          frontend ของทีม (Next.js) — ประตูเดียวของระบบ
                 │  /api/* · /auth/login · /auth/callback · /auth/logout  → proxy ไป backend
                 ▼
              http://127.0.0.1:42xx          backend ของทีม (NestJS)
                 │  GET /auth/login  → 302 https://csmju2030.jowave.com/sso/authorize?subsystem=<ชื่อ>&state=…
                 │                      ผู้ใช้ login ที่ Core Hub (รหัสผ่าน หรือ MJU SSO)
                 │  GET /auth/callback?access_token=…&state=…  ← Core Hub ส่งเบราว์เซอร์กลับมาที่ localhost ของทีม
                 │  ตรวจ state + token 10 ขั้น → คุกกี้ <ชื่อ>_access_token
                 ▼
              เรียกข้อมูลกลาง https://csmju2030.jowave.com/api/v1/…  จาก backend ด้วย token ของผู้ใช้
```

Core Hub เข้าถึงเครื่องของทีมไม่ได้ และไม่ต้องเข้าถึง — เบราว์เซอร์ของผู้ใช้เป็นคนพาไปกลับเอง

---

## 1. สิ่งที่ต้องมีก่อน

| ต้องมี | รายละเอียด |
|---|---|
| standards 1.7.x | `.standards-version` และ submodule `standards/` ชี้ tag เดียวกัน — วิธีเลื่อนดู [`standards-versioning.md`](standards-versioning.md) |
| พอร์ตของทีม | frontend `32xx` · backend `42xx` ตามที่ผู้ดูแล dev server กำหนดให้ (demo ใช้ 3201/4201) · ห้ามใช้ 5432 |
| endpoint auth ของ backend | `GET /auth/login` · `GET /auth/callback` · `POST /auth/logout` · `GET /api/v1/me` ตาม auth-contract ข้อ 5 — คัดลอก `backend/src/auth/` และ `backend/src/common/` จาก demo ได้ทั้งโฟลเดอร์ |
| proxy ของ frontend | ส่ง `/api/*` และ `/auth/login` `/auth/callback` `/auth/logout` ไป backend (ตัวอย่างด้านล่าง) |

```ts
// frontend/next.config.ts
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:4205";

export default {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/auth/login", destination: `${BACKEND_URL}/auth/login` },
      { source: "/auth/callback", destination: `${BACKEND_URL}/auth/callback` },
      { source: "/auth/logout", destination: `${BACKEND_URL}/auth/logout` },
    ];
  },
};
```

---

## 2. บัญชีที่ใช้

ชื่อบัญชีและรหัสได้จากผู้ดูแล dev server **ทางข้อความส่วนตัวเท่านั้น** — ห้ามใส่ใน repo ไฟล์ `.env` ที่ commit หรือกลุ่มแชต
(repo นี้เป็น public จึงไม่เขียนชื่อบัญชีไว้ที่นี่)

| บัญชี | role ใน Core Hub | ใครใช้ | ใช้ทำอะไร |
|---|---|---|---|
| บัญชีเจ้าของระบบของทีม | staff | PL ของทีมคนเดียว | ลงทะเบียนและดูแลทะเบียนระบบของทีม · ทดสอบฝั่งเจ้าหน้าที่ |
| MJU SSO ของตัวเอง | student | ทุกคนในทีม | ทดสอบฝั่งนักศึกษา — รหัสต้องอยู่ในทะเบียนบุคคลของ Core Hub |
| บัญชีทดสอบร่วม role staff | staff | ทุกทีม | ทดสอบฝั่งเจ้าหน้าที่ |
| บัญชีทดสอบร่วม role lecturer | lecturer | ทุกทีม | ทดสอบฝั่งอาจารย์ |
| บัญชีทดสอบร่วม role alumni | alumni | ทุกทีม | ทดสอบฝั่งศิษย์เก่า |
| บัญชีทดสอบร่วม role guest | guest | ทุกทีม | ทดสอบฝั่งผู้เยี่ยมชม |

บัญชีทดสอบร่วมใช้กันทุกทีม — **ห้ามเปลี่ยนรหัส** · ใส่รหัสผิด 10 ครั้งใน 15 นาที บัญชีนั้นล็อก 15 นาทีทั้งโครงการ

---

## 3. ลงทะเบียนระบบ (ครั้งเดียว — PL ของทีม)

1. login `https://csmju2030.jowave.com` ด้วยบัญชี `.admin` ของทีม → หลังบ้าน → ระบบย่อย → **ลงทะเบียนระบบย่อย**
   (`/backoffice/subsystems/new`)
2. กรอกตามตาราง แล้วส่งคำขอ — สถานะเป็น `PENDING`
3. รอ admin ระบบกลางอนุมัติและเปิดใช้งาน — ระหว่างรอ ปุ่ม login จะพาไปหน้า "ระบบนี้ยังไม่เปิดให้ใช้งาน"

| ช่อง | ค่า |
|---|---|
| ชื่อระบบ | ตรงกับ `name` ใน `subsystem.yaml` เช่น `csmju-equipment` (กฎชื่อ: subsystem-registry ข้อ 2) |
| ชื่อที่แสดง | ชื่อที่ผู้ใช้เห็นในเมนูพอร์ทัล |
| Repository | `github.com/CSMJU2030/<ชื่อ repo>` |
| Standards version | `1.0` (ตัวเลือกเดียว) |
| Callback URL | `http://localhost:<พอร์ต frontend>/auth/callback` — **พอร์ต frontend 32xx ไม่ใช่ backend** |
| Base URL | **เว้นว่าง** (server ตรวจ `localhost` ของทีมไม่ได้ ใส่ไปจะขึ้น DOWN) |
| บทบาท | ติ๊กเฉพาะ core role ที่ระบบรับ แล้วใส่ชื่อ role ของระบบ เช่น student→`STUDENT` · lecturer→`TEACHER` · staff→`OFFICER` |

- role ที่ไม่ติ๊กจะเข้าระบบไม่ได้เลย (403 ที่ Core Hub)
- ถ้าระบบมีหน้าผู้ดูแล **อย่าแมป `staff` ทั้งหมดเป็นผู้ดูแลระบบ** — ถ้าต้องการเฉพาะบางคนให้ขอสิทธิ์พิเศษรายบุคคล (subsystem-registry ข้อ 7)
- หลังอนุมัติแล้ว ชื่อ · callback · role mapping แก้ได้เฉพาะ admin ระบบกลาง — กรอกให้ถูกตั้งแต่แรก

---

## 4. ตั้งค่า `.env`

**backend** (`backend/.env` — ห้าม commit)

```env
PORT=4205
CORE_HUB_URL=https://csmju2030.jowave.com
CORE_HUB_JWKS_URL=https://csmju2030.jowave.com/api/v1/.well-known/jwks.json
CORE_HUB_WEB_URL=https://csmju2030.jowave.com
CORE_HUB_ISSUER=core-hub
CORE_HUB_AUDIENCE=csmju2030
SUBSYSTEM_ID=csmju-equipment
```

**frontend** (`frontend/.env.local` — ห้าม commit)

```env
BACKEND_URL=http://127.0.0.1:4205
SUBSYSTEM_ID=csmju-equipment
```

- เปลี่ยนตัวเลขพอร์ตและชื่อระบบเป็นของทีม · `SUBSYSTEM_ID` ทั้งสองไฟล์ต้องตรงกับชื่อในทะเบียน
- ค้นโค้ดหา `localhost:3000` · `localhost:3100` · `127.0.0.1:3100` ที่เขียนตายไว้ แล้วเปลี่ยนเป็นค่าจาก `.env`
- แก้ `.env` แล้วต้องรีสตาร์ต `pnpm dev` ทุกครั้ง

---

## 5. รันและเปิดระบบ

```bash
pnpm dev
```

เปิด **`http://localhost:<พอร์ต frontend>`** — ต้องเป็น `localhost` ตรงกับที่ลงทะเบียน ไม่ใช่ `127.0.0.1`
(คุกกี้ผูกกับชื่อ host)

---

## 6. ทดสอบ

| # | ทำ | ต้องได้ |
|---|---|---|
| 1 | กดปุ่มเข้าสู่ระบบในระบบของทีม | ไปหน้า login ของ Core Hub แล้วกลับมาหน้าเดิมในสถานะ login |
| 2 | login ที่ `https://csmju2030.jowave.com` แล้วกดเมนูระบบของทีมในพอร์ทัล | เข้าระบบของทีมได้โดยไม่ถามอะไรเพิ่ม (callback แรกไม่มี state ระบบย่อยพาไป `/auth/login` แล้วผ่านเอง) |
| 3 | ลองทุก role ที่ระบบรับ และ role ที่ไม่รับอย่างน้อยหนึ่งตัว | role ที่รับได้สิทธิ์ตามที่แมป · role ที่ไม่รับเห็น "บัญชีของคุณไม่มีสิทธิ์เข้าระบบนี้" |
| 4 | กดออกจากระบบ | ไปหน้า `/logout` ของ Core Hub |
| 5 | เปิดค้างไว้เกิน 15 นาทีแล้วกดใช้งาน | ระบบพาไป SSO ใหม่เองแล้วกลับมาหน้าเดิม |
| 6 | ค้น log ของ backend: `grep -iE "eyJ\|access_token=\|authorization:\|cookie:"` | ไม่พบอะไรเลย |
| 7 | conformance ด้วยไฟล์บัญชีนอก repo ([`conformance.md`](conformance.md)) | ผ่าน L1–L3 โดยไม่มี SKIP |

---

## 7. ใช้ข้อมูลกลาง

คณะ · สาขา · อาคาร · ห้อง · ภาคการศึกษา · รายวิชา · หลักสูตร · บุคคล **อยู่บน Core Hub แล้ว** — ห้ามสร้างตารางหรือกรอกข้อมูลเหล่านี้เอง
รายละเอียดทั้งหมดใน [`reference-data.md`](reference-data.md) · กฎสั้น ๆ:

- เรียกจาก **backend** เท่านั้น พร้อม `Authorization: Bearer <token ของผู้ใช้ที่ login อยู่>` — Core Hub ไม่เปิด CORS
- เรียกได้เฉพาะ endpoint ข้อมูลที่อนุญาต · token คือบัตรผ่านของผู้ใช้ ห้ามส่งต่อหรือ log (auth-contract ข้อ 6.1)
- ตารางของทีมเก็บแค่ `code` ของข้อมูลอ้างอิง และ `core_user_id` (`sub`) กับ `person_code` ของคน — ไม่เก็บชื่อหรืออีเมล
- ข้อมูลอ้างอิง cache ได้ (10 นาที ใช้ของเก่าเมื่อ Core Hub ล่ม) · ข้อมูลบุคคลห้าม cache
- ตัวอย่างโค้ด: `backend/src/core-hub/` ของ demo — คัดลอกทั้งโฟลเดอร์แล้วเพิ่มชุดข้อมูลที่ `reference-datasets.ts`
- ข้อมูลผิดหรือขาด แจ้งผู้ดูแล dev server — อย่าสร้างข้อมูลชุดนั้นซ้ำในระบบของทีม

---

## 8. ปัญหาที่พบบ่อย

| อาการ | สาเหตุ |
|---|---|
| "ไม่พบระบบนี้ในทะเบียนของ Core Hub" | ยังไม่ได้ลงทะเบียน · `SUBSYSTEM_ID` ไม่ตรงกับชื่อในทะเบียน |
| "ระบบนี้ยังไม่เปิดให้ใช้งาน" | ยังรออนุมัติหรือเปิดใช้งาน · ถูกระงับ |
| "บัญชีของคุณไม่มีสิทธิ์เข้าระบบนี้" | role ของบัญชีไม่ได้ติ๊กในบทบาทตอนลงทะเบียน |
| MJU SSO แล้วได้ 403 ไม่อยู่ในทะเบียน | รหัสนักศึกษายังไม่อยู่ในทะเบียนบุคคล — แจ้งผู้ดูแล dev server |
| หลัง login เจอ `Cannot GET /` | ลงทะเบียนพอร์ต backend (42xx) แทนพอร์ต frontend (32xx) |
| หลัง login เบราว์เซอร์เปิดหน้าไม่ได้ | ไม่ได้รันระบบ · รันคนละพอร์ตกับที่ลงทะเบียน |
| กลับมาแล้วเจอ 401 พร้อมปุ่ม "เข้าสู่ระบบอีกครั้ง" | คุกกี้ state หมดอายุ (อยู่ที่ Core Hub เกิน 10 นาที เช่นตั้งรหัสครั้งแรกของ MJU SSO) · เปิดด้วย `127.0.0.1` — กดปุ่มอีกครั้ง |
| กลับมาแล้วเจอ 401 ตรวจ token ไม่ผ่าน | `CORE_HUB_JWKS_URL` ยังชี้ `localhost` · ยังไม่ได้รีสตาร์ต backend |
| login แล้วคุกกี้ไม่ติด | เปิดด้วย `127.0.0.1` แต่ลงทะเบียน `localhost` (หรือกลับกัน) |
| ไม่เห็นเมนูระบบของทีมในพอร์ทัล | role ของบัญชีไม่อยู่ใน role mapping · ระบบยังไม่ `ACTIVE` |
| เรียกข้อมูลกลางแล้วติด CORS | เรียกจากหน้าเว็บ — ย้ายไปเรียกจาก backend |
| `401` จาก API ข้อมูลกลาง | token หมดอายุหรือผู้ใช้ logout แล้ว — ให้ผ่าน SSO ใหม่ · ลืมส่ง header `Authorization` |
| `403` ที่ `/api/v1/people` | role ของผู้ใช้อ่านข้อมูลบุคคลไม่ได้ (เช่นนักศึกษา) — ทดสอบด้วยบัญชีทดสอบ role staff หรือ lecturer |
| `429` | เรียกถี่เกิน — cache ข้อมูลอ้างอิง เลิกเรียกทีละแถว และรอตาม header `Retry-After` |

---

## 9. เมื่อเปิดใช้จริง

- server จะปิดโหมดก่อนเปิดใช้ — callback `http://localhost` ทุกตัวใช้ไม่ได้ทันที (ผู้ใช้เห็น "ระบบนี้ยังไม่เปิดให้ใช้งาน")
- ระบบที่ขึ้น host จริงต้องแจ้งให้ admin ระบบกลางเปลี่ยน Callback URL และ Base URL เป็น `https` ของ host นั้น
  (เจ้าของแก้เองไม่ได้หลังอนุมัติ) · ตั้ง `NODE_ENV=production` ให้คุกกี้เป็น `Secure`
- บัญชีทดสอบร่วมจะถูกลบหรือเปลี่ยนรหัส

**ความปลอดภัย:** server นี้มีข้อมูลจริง · ห้าม log token หรือ URL ของ callback · ห้าม commit `.env` ·
ห้ามส่งต่อบัญชีหรือ token ให้คนนอกโครงการ
