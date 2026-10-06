# Authentication Contract

**เวอร์ชัน 1.2** (standards 1.7.0) · เจ้าของ: ทีม Core Hub · เอกสารนี้แทนที่ฉบับ OAuth2/Gateway เดิมทั้งฉบับ

> ฉบับนี้เขียนจาก **Core Hub ที่รันได้จริง** (`develop` ที่ขึ้น `https://csmju2030.jowave.com`)
> reference implementation คือ repo `demo-student-subsystem` (ระบบจองห้อง) ตั้งแต่ standards 1.7.0
> ขั้นตอนเชื่อมระบบย่อยกับ server จริงทีละขั้น ดู [`connect-core-hub.md`](connect-core-hub.md)

---

## 1. ภาพรวม

CSMJU2030 ใช้ **Central Authentication / SSO** — ผู้ใช้ login ที่ Core Hub ที่เดียว

```text
User
  │  login
  ▼
Core Hub  ──────────────► ออก access token (RS256) + refresh token
  │                        เผยแพร่กุญแจสาธารณะที่ JWKS
  │  SSO handoff
  ▼
Subsystem ──► ดึง JWKS ──► ตรวจลายเซ็น + claim ──► แมป role ──► ให้เข้าใช้งาน
```

ระบบย่อย **ห้าม**มีหน้า login ของตัวเอง ห้ามเก็บรหัสผ่าน และห้ามออก JWT เอง

**การตรวจ JWT เป็นหน้าที่ของระบบย่อย** — ปัจจุบันยังไม่มี API Gateway กลาง
ระบบย่อยจึงต้องตรวจเองด้วยกุญแจสาธารณะจาก JWKS ตามขั้นตอนข้อ 4

---

## 2. ค่าคงที่ของสัญญา (ห้ามเปลี่ยน)

```text
Algorithm : RS256
Issuer    : core-hub
Audience  : csmju2030
Key ID    : core-hub-2026
JWKS      : GET  {CORE_HUB_URL}/api/v1/.well-known/jwks.json
Login     : POST {CORE_HUB_URL}/api/v1/auth/login   { email, password }   ← สคริปต์และบัญชีที่มีรหัสผ่านเท่านั้น
อายุ access token  : 15 นาที (ระบบย่อยต้องปฏิเสธ token ที่อายุยาวกว่านี้ — ข้อ 4 ขั้น 9)
อายุ refresh token : 7 วัน (อยู่กับ Core Hub เท่านั้น)
```

- `CORE_HUB_URL` และ `CORE_HUB_WEB_URL` ของ server จริงคือ `https://csmju2030.jowave.com` ทั้งคู่ (API อยู่ใต้ `/api/v1`)
- ผู้ใช้ทั่วไป login ที่เว็บ Core Hub เท่านั้น — นักศึกษาและบุคลากรใช้ MJU SSO ซึ่งไม่มีรหัสผ่านใน Core Hub
  จึงใช้ `POST /auth/login` ไม่ได้

ค่าทั้งหมดอยู่ในไฟล์ [`../contracts/jwt-contract.json`](../contracts/jwt-contract.json) — ให้โค้ดอ่านจากไฟล์/env ไม่ใช่พิมพ์ค่าเอง

---

## 3. Access Token

`access_token` เป็น JWT ลงนามด้วย RS256

**Header**

```json
{ "alg": "RS256", "typ": "JWT", "kid": "core-hub-2026" }
```

**Payload**

```json
{
  "sub": "user-002",
  "email": "student@core.local",
  "role": "student",
  "sid": "e9c0…",
  "iss": "core-hub",
  "aud": "csmju2030",
  "iat": 1789027279,
  "exp": 1789028179
}
```

| Field | Type | ความหมาย |
|---|---|---|
| `sub` | string | **Global Identity** — id ผู้ใช้ของ Core Hub · ตัวตนเดียวที่ระบบย่อยเชื่อได้ · เก็บเป็น `core_user_id` ชนิด **text** ยาวไม่เกิน 64 · **ไม่ใช่ UUID เสมอไป** (นักศึกษาที่นำเข้าจาก CSV เป็น `user-<รหัสนักศึกษา>`) ห้าม parse หรือ validate เป็น UUID · ถือเป็นข้อมูลบุคคล |
| `email` | string | อีเมลของผู้ใช้ · **ใช้แสดงผลเท่านั้น ห้ามใช้เป็นกุญแจ** — บัญชี MJU SSO อาจเป็น `<รหัส>@sso.mju.local` และเปลี่ยนได้ |
| `role` | enum | role ของผู้ใช้**สำหรับระบบนี้**: `student` · `alumni` · `staff` · `lecturer` · `guest` · `admin` (ความหมายใน [`authorization.md`](authorization.md) ข้อ 2) — คือ core role ของบัญชี หรือ role ของสิทธิ์พิเศษที่อนุมัติแล้วสำหรับระบบนี้ ([`subsystem-registry.md`](subsystem-registry.md) ข้อ 5) · อ่านจาก token ทุก request ห้ามเก็บไว้ตัดสินสิทธิ์ |
| `sid` | string | session id ของ Core Hub · ใช้อ้างอิงเท่านั้น — ไม่มี endpoint ให้ระบบย่อยตรวจว่า session ยังอยู่ |
| `iss` / `aud` | string | `core-hub` / `csmju2030` |
| `iat` / `exp` | number | Unix timestamp |
| `azp` | string · **กำลังจะมี** | ชื่อระบบย่อยในทะเบียนที่ token นี้ออกให้ · Core Hub จะเริ่มใส่ใน token ที่ส่งให้ระบบย่อย · ถ้ามีต้องตรงกับชื่อระบบตัวเอง (ข้อ 4 ขั้น 10) |

ระบบย่อย **ห้าม** เปลี่ยนชื่อ field และ **ห้าม**คาดหวัง claim ที่ไม่มีในรายการนี้
(เช่น `faculty`, `username`, `department`, รหัสนักศึกษา **ไม่ได้อยู่ใน token** — ข้อมูลเหล่านี้ดึงจาก Core Hub
และเก็บเฉพาะที่อนุญาต ดู [`reference-data.md`](reference-data.md)) ·
**ห้ามปฏิเสธ token เพราะมี claim อื่นเพิ่มมา** — Core Hub เพิ่ม claim ได้โดยไม่ถือว่าผิดสัญญา

---

## 4. การตรวจสอบ token (บังคับครบ 10 ขั้น)

ระบบย่อยต้องทำครบทุกขั้นกับทุก request ที่เข้า route ที่ต้องล็อกอิน และกับ token ที่มาทาง `/auth/callback`

| # | ขั้น | ไม่ผ่าน |
|---|---|---|
| 1 | อ่าน `Authorization: Bearer <token>` (หรือคุกกี้ SSO ตามข้อ 6) | 401 |
| 2 | ถอด **header** เพื่ออ่าน `alg` และ `kid` (ยังไม่เชื่อ payload) | 401 |
| 3 | บังคับ `alg === RS256` — ปฏิเสธ `none`, `HS256` และอัลกอริทึมอื่นทั้งหมด | 401 |
| 4 | หา public key จาก JWKS ตาม `kid` | 401 |
| 5 | ตรวจลายเซ็น (ระบุ algorithm allow-list ซ้ำอีกชั้นตอน verify) | 401 |
| 6 | ตรวจ `iss` และ `aud` | 401 |
| 7 | ตรวจ `exp` (ยอมรับ clock skew ≤ 60 วินาที) | 401 |
| 8 | ต้องมี `sub` ที่ไม่ว่าง | 401 |
| 9 | **อายุ token**: ต้องมี `iat` และ `exp − iat` ไม่เกิน 900 วินาที (+60 วินาที) — กัน refresh token (อายุ 7 วัน) ถูกใช้แทน access token | 401 |
| 10 | **`azp`**: ถ้า token มี `azp` ต้องเท่ากับชื่อระบบตัวเอง (`SUBSYSTEM_ID`) — กัน token ที่ออกให้ระบบอื่นถูกนำมาใช้ที่นี่ | 401 |

ขั้น 9–10 เพิ่มใน 1.2 (standards 1.7.0) · ขั้น 10 ตอนนี้ตรวจเมื่อมี `azp` เท่านั้น เวอร์ชันถัดไปจะบังคับให้ต้องมี
หลัง Core Hub ใส่ `azp` ใน token ที่ส่งให้ระบบย่อยครบแล้ว

**ห้าม**ข้ามขั้นใดขั้นหนึ่งแม้ในโหมด development · **ห้าม**ตรวจด้วย secret/HS256 · **ห้าม**ฮาร์ดโค้ด public key
(CI กฎ `SEC-04` ตรวจข้อนี้)

### 4.1 ข้อกำหนดของ JWKS client

- **ต้อง**แคชกุญแจ ไม่ยิง Core Hub ทุก request (แนะนำ TTL 10 นาที)
- **ต้อง**เลือกกุญแจจาก `header.kid` เสมอ เพื่อรองรับการหมุนกุญแจ (`core-hub-2026` → `core-hub-2027`)
- **ต้อง**รีเฟรช JWKS **หนึ่งครั้ง**เมื่อเจอ `kid` ที่ไม่รู้จัก แล้วถ้ายังไม่เจอให้ปฏิเสธ
- **ต้อง**จำกัดอัตราการรีเฟรช (≥ 30 วินาทีต่อครั้ง) เพื่อกัน refresh loop
- **ควร**ใช้กุญแจที่แคชไว้ต่อได้เมื่อ Core Hub ล่มชั่วคราว
- **ต้อง**ปฏิเสธ JWK ที่มี private material (`d`) หรือไม่ใช่ `kty: RSA`

### 4.2 รูปแบบ JWKS

Core Hub ตอบเป็น **RFC 7517 ดิบ** — `{"keys":[...]}` ที่ระดับบนสุด ไม่มี envelope ครอบ
(endpoint นี้ถูกยกเว้นจาก response envelope ของ Core Hub โดยเจตนา เพื่อให้ library มาตรฐานทุกภาษาใช้ได้)

```json
{ "keys": [ { "kty": "RSA", "n": "...", "e": "AQAB", "kid": "core-hub-2026", "use": "sig", "alg": "RS256" } ] }
```

---

## 5. Central SSO Flow

**ทุกการเข้าสู่ระบบเริ่มที่ระบบย่อย** (`GET /auth/login`) — มีแต่ระบบย่อยที่รู้ว่าตัวเองเริ่ม
flow ไหนไว้ จึงกัน login CSRF ได้ ระบบย่อยไม่มีหน้าฟอร์มใด ๆ รหัสผ่านกรอกที่ Core Hub เท่านั้น

### เข้าจากระบบย่อย (ทางหลัก)

```text
1. เบราว์เซอร์ → ระบบย่อย  GET /auth/login?next=/courses
2. ระบบย่อยสร้าง state (สุ่ม ≥ 32 ไบต์) ตั้งคุกกี้ <ชื่อ>_sso_state = state + next
   → 302  {CORE_HUB_WEB_URL}/sso/authorize?subsystem=<ชื่อ>&state=<state>
3. เว็บ Core Hub ต่ออายุ session ให้เงียบ ๆ ถ้าทำได้ ถ้าไม่มี session พาไป /login
   (รหัสผ่าน หรือ MJU SSO) แล้วกลับมาข้อ 3 พร้อม state เดิม
4. เว็บ Core Hub เรียก  GET /api/v1/auth/sso/handoff?subsystem=&state=  (Bearer จากคุกกี้ของเว็บ)
       Core Hub ตรวจ: subsystem มีจริง → APPROVED → ACTIVE → role ของผู้ใช้สำหรับระบบนี้เป็น key ใน role mapping
       ไม่ผ่าน → หน้า /sso/error ของ Core Hub (ไม่ส่งกลับระบบย่อย จึงไม่วน — ดูข้อ 5.3)
5. เว็บ Core Hub → 302 {callback_url ที่ลงทะเบียน}?access_token=…&token_type=Bearer&expires_in=900&state=<state>
6. ระบบย่อยตรวจ state กับคุกกี้ → ตรวจ token ตามข้อ 4 ครบ 10 ขั้น → แมป role
   → ตั้งคุกกี้ <ชื่อ>_access_token = token นั้น → 302 ไปหน้า next ที่เก็บไว้
```

**login ผ่าน MJU SSO** (นักศึกษาและบุคลากร): Core Hub ให้เข้าเฉพาะคนที่อยู่ในทะเบียนบุคคลและสถานะไม่ใช่ INACTIVE —
คนที่ไม่อยู่ในทะเบียนเห็น 403 ที่ Core Hub และไม่มาถึงระบบย่อย · การ login ครั้งแรกต้องตั้งรหัสผ่านก่อน
ถ้าใช้เวลาเกิน 600 วินาที คุกกี้ state หมดอายุ callback จึงได้ 401 ตามข้อ 5.1 — ระบบย่อยต้องแสดงปุ่ม
"เข้าสู่ระบบอีกครั้ง" ให้ ไม่ใช่ JSON ดิบ

### เข้าจาก sidebar ของ Core Hub

```text
1. ผู้ใช้กดชื่อระบบใน sidebar → เว็บ Core Hub  GET /sso/authorize?subsystem=<ชื่อ>   (ไม่มี state)
2. Core Hub ส่ง callback แบบไม่มี state
3. ระบบย่อยทิ้ง token ไม่ตั้งคุกกี้ → 302 /auth/login
4. ต่อด้วย flow ด้านบนตั้งแต่ข้อ 2 — ผู้ใช้ login อยู่แล้ว ทุกขั้นผ่านไปเองโดยไม่เห็นหน้าอะไร
```

ผู้โจมตีที่ส่งลิงก์ callback พร้อม token ของตัวเองให้เหยื่อ จึงไม่มีทางทำให้เหยื่อได้ session ของผู้โจมตี
ระบบย่อยจะทิ้ง token นั้นแล้วพาเหยื่อไป login เป็นตัวเหยื่อเอง

**endpoint ฝั่ง Core Hub**

| Method & path | ใช้ทำอะไร |
|---|---|
| **เว็บ** `GET /sso/authorize?subsystem=<ชื่อ>[&state=<s>]` | ทางเข้าของเบราว์เซอร์ · ต้อง login ก่อน · เรียก handoff แล้ว 302 ไป callback · ไม่ผ่าน → `/sso/error` · **ส่ง `state` ต่อตรงตัว ห้ามสร้างเอง** |
| **เว็บ** `GET /logout` | หน้ายืนยันออกจาก Core Hub และทุกระบบย่อย · เปิดด้วย GET ต้องไม่ออกจากระบบทันที |
| **API** `GET /api/v1/auth/sso/authorize?subsystem=<name\|id>[&callback_url=][&state=]` | เหมือนกันแต่ต้องมี Bearer ซึ่งเบราว์เซอร์แนบเองไม่ได้ · ใช้กับสคริปต์ |
| **API** `GET /api/v1/auth/sso/handoff?subsystem=…[&state=]` | ตอบ JSON (`redirect_url`, `access_token`, `expires_in`) · เว็บ Core Hub ใช้ตัวนี้ |

**endpoint ฝั่งระบบย่อย** (ทุกระบบต้องมีครบ · อยู่ **นอก** prefix `/api` · public)

| Method & path | ข้อกำหนด |
|---|---|
| `GET /auth/login?next=<path>` | สร้าง state · ตั้งคุกกี้ state · 302 ไป `{CORE_HUB_WEB_URL}/sso/authorize` · ห้ามส่ง `callback_url` ไปด้วย |
| `GET /auth/callback` | ต้องตรงกับ `callback_url` ในทะเบียน · ผลลัพธ์ตามข้อ 5.1 |
| `POST /auth/logout` | ลบคุกกี้ของตัวเองทั้งสอง → `303` ไป `{CORE_HUB_WEB_URL}/logout` |
| `GET /api/v1/me` | (อยู่ใต้ `/api` ต้องมี token) ควรคืน `session.expiresAt` (ISO 8601 จาก `exp`) ให้ frontend ต่ออายุล่วงหน้าได้ |

ทุกคำตอบของ `/auth/*` **ต้อง**มี `Cache-Control: no-store`

### 5.1 กฎของ callback

| callback มาแบบ | ต้องตอบ |
|---|---|
| ไม่มี `access_token` | `400` |
| **ไม่มี `state`** (เริ่มจาก Core Hub) | ทิ้ง token · **ไม่ตั้งคุกกี้ใด ๆ** · `302 /auth/login` · ห้ามแตะคุกกี้ state (แท็บอื่นอาจกำลังรอ callback ของตัวเอง) |
| มี `state` แต่ไม่มีคุกกี้ state หรือไม่ตรงกัน | `401` · **ห้าม redirect ซ้ำ** (เบราว์เซอร์ที่ไม่เก็บคุกกี้จะวนไม่จบ) · เบราว์เซอร์ที่ขอ `text/html` ให้ได้หน้า HTML ที่มีปุ่ม "เข้าสู่ระบบอีกครั้ง" (ลิงก์ `/auth/login`) |
| token ไม่ผ่านการตรวจข้อ 4 | `401` |
| role ที่ระบบย่อยไม่รับ | `403` |
| ผ่านทุกข้อ | ตั้งคุกกี้ session แล้ว `302` ไปหน้า `next` ที่เก็บไว้ |

- ตั้งคุกกี้ลบ state ไว้**ก่อน**ตรวจ ทุกคำตอบที่มี `state` จึงเผาคุกกี้ state ทิ้งเสมอ (ใช้ได้ครั้งเดียว)
- ทุกกรณีที่ไม่สำเร็จ **ต้องไม่มี** `Set-Cookie` ของคุกกี้ session
- คุกกี้ session ชื่อ **`<ชื่อระบบ>_access_token`** (เปลี่ยน `-` เป็น `_` เช่น `csmju_equipment_access_token`)
  เป็น `HttpOnly` + `SameSite=Lax` + `Path=/` · `Secure` เมื่อ `NODE_ENV=production`
  ค่าคือ Core Hub token ตัวที่ verify แล้ว · อายุ `Max-Age` = `exp − ตอนนี้` (ไม่ยาวกว่า token)
- callback **ต้อง**มี `Referrer-Policy: no-referrer` เพิ่ม — URL มี token อยู่
- **ห้าม log URL เต็มของ `/auth/callback`** และห้าม log header `Cookie` ทั้งก้อน ให้ log ได้แค่ path —
  รวมถึง error filter และ request logger ทุกตัว: log `request.path` ไม่ใช่ `request.url`/`originalUrl`
  (demo เคยพลาดข้อนี้จนถึง 1 ต.ค. 2569 — ใครคัดลอก `all-exceptions.filter.ts` ไปก่อนหน้านั้นต้องคัดลอกใหม่)
- ระบบย่อย **ต้องไม่**ออก token หรือ session ของตัวเอง — ไม่มีตาราง session ไม่มี session id แบบสุ่ม
  session คือ Core Hub token ที่ verify แล้วเท่านั้น

### 5.2 `GET /auth/login`

- `state` สุ่มอย่างน้อย **32 ไบต์** เข้ารหัส **base64url**
- เก็บในคุกกี้ **`<ชื่อระบบ>_sso_state`** ค่า `<state>.<next แบบ base64url>` ·
  `HttpOnly` + `SameSite=Lax` + **`Path=/auth/callback`** · `Secure` เมื่อ production · อายุ**ไม่เกิน 600 วินาที**
- เทียบ state ตอน callback ด้วยการเทียบแบบ constant-time
- ชื่อคุกกี้ขึ้นต้นด้วยชื่อระบบ เพราะตอนพัฒนาทุกระบบรันบน `localhost` และคุกกี้ไม่แยกตาม port

**กฎของ `next`** — ใช้ได้เมื่อผ่านครบทุกข้อ ไม่ผ่านให้ใช้หน้า default ของระบบย่อย

1. เป็น string ยาว 1–512 ตัวอักษร
2. ขึ้นต้นด้วย `/` แต่ไม่ขึ้นต้นด้วย `//` และไม่มี `\` (เบราว์เซอร์มองว่า `/\host` เท่ากับ `//host`)
3. ไม่มีอักขระควบคุม (รหัส 0–31 และ 127)
4. แปลงด้วย `new URL(next, origin ของตัวเอง)` แล้ว origin ต้องยังเป็นของตัวเอง
5. ไม่ใช่ `/auth` หรือ path ใต้ `/auth/`

ต้องตรวจ**ซ้ำตอนใช้งาน** — ตรวจตอน `/auth/login` แล้วตรวจอีกครั้งตอน callback ก่อน redirect
เพราะค่าที่เก็บไว้กลับมาจากคุกกี้

### 5.3 เมื่อ Core Hub ไม่ส่งผู้ใช้กลับมา

Core Hub ตรวจทุกอย่าง**ก่อน**ออก token ถ้าไม่ผ่าน ผู้ใช้จะอยู่ที่หน้า `/sso/error` ของ Core Hub และไม่กลับมาที่ระบบย่อย

| Core Hub ตอบ | หน้า `/sso/error` แสดง | สาเหตุที่พบบ่อย |
|---|---|---|
| 404 | "ไม่พบระบบนี้ในทะเบียนของ Core Hub" | ยังไม่ได้ลงทะเบียน · ชื่อใน `SUBSYSTEM_ID` ไม่ตรงกับทะเบียน |
| 409 | "ระบบนี้ยังไม่เปิดให้ใช้งาน" | ยังไม่อนุมัติ · ยังไม่เปิดใช้งาน · ถูกระงับ · callback เป็น `http` แต่ server ปิดโหมดก่อนเปิดใช้แล้ว |
| 403 | "บัญชีของคุณไม่มีสิทธิ์เข้าระบบนี้" | role ของผู้ใช้ไม่อยู่ใน role mapping ของระบบนี้ |
| — | "ลิงก์เข้าระบบไม่ถูกต้อง" | ชื่อระบบผิดรูปแบบ · `state` ว่างหรือยาวเกิน 512 ตัวอักษร |
| ต่อ API ไม่ได้ | "ติดต่อ Core Hub ไม่ได้ชั่วคราว กรุณาลองใหม่" | Core Hub API ล่ม |
| 400 อื่น ๆ · 429 · 5xx | "เข้าระบบไม่สำเร็จ กรุณาลองใหม่" | callback ในทะเบียนผิดรูปแบบ · โดนจำกัดอัตรา · Core Hub ขัดข้อง |

ส่วน 401 (session ของเว็บ Core Hub ถูกยกเลิก) Core Hub ล้างคุกกี้แล้วพาไปหน้า login เอง

---

## 6. การส่ง token มาที่ระบบย่อย

รับได้ 2 ทาง และ **ตรวจเหมือนกันทั้งสองทาง**:

```http
Authorization: Bearer <access_token>                ← API / เครื่องยิงเครื่อง
Cookie: <ชื่อระบบ>_access_token=<access_token>     ← เบราว์เซอร์ที่ผ่าน SSO มาแล้ว
                                                     เช่น student_service_access_token
```

ถ้ามีทั้งคู่ ให้ `Authorization` header มาก่อน

ระบบย่อย **ห้าม**เชื่อ identity จาก request body, query string หรือ custom header
(เช่น `X-User-Id`) — ตัวตนต้องมาจาก claim ที่ผ่านการตรวจลายเซ็นแล้วเท่านั้น

ถ้ารัน Core Hub ในเครื่องด้วย (ทีม Core Hub) เบราว์เซอร์จะส่งคุกกี้ของเว็บ Core Hub (`csmju_access_token` ·
`csmju_refresh_token`) มาที่ระบบย่อยบน host เดียวกันด้วย เพราะคุกกี้ไม่แยกตาม port — ระบบย่อย **ต้องไม่**อ่านคุกกี้เหล่านั้น
และชื่อระบบย่อยจึงห้ามเป็น `csmju` เฉย ๆ

### 6.1 token คือบัตรผ่านของผู้ใช้

token ที่ระบบย่อยได้รับใช้เรียก Core Hub ในนามผู้ใช้ได้ จึงต้องดูแลเหมือนรหัสผ่าน

- เก็บได้ที่เดียวคือคุกกี้ session `HttpOnly` ตามข้อ 5.1 — ห้ามส่งให้ JavaScript ในเบราว์เซอร์ ห้ามเก็บลงฐานข้อมูล
- ห้ามส่งต่อให้ระบบอื่นหรือบริการภายนอก และห้าม log (รวม header `Authorization`)
- ใช้เรียก Core Hub จาก **backend ของระบบย่อยเท่านั้น** และเฉพาะ endpoint ข้อมูลที่อนุญาตใน
  [`reference-data.md`](reference-data.md) — Core Hub จะปฏิเสธ endpoint อื่นสำหรับ token ที่ออกให้ระบบย่อย
- Core Hub ตอบ 401 = session ของผู้ใช้จบแล้ว (logout หรือถูกยกเลิก) ให้ถือเหมือน token หมดอายุ (ข้อ 7)

---

## 7. Token หมดอายุ

- access token อายุ **15 นาที** · คุกกี้ session ของระบบย่อยหมดอายุพร้อมกัน
- เมื่อหมดอายุ API ของระบบย่อย **ต้อง**ตอบ `401` เป็น JSON พร้อม `error.code = "UNAUTHORIZED"`
  **ห้ามตอบ 302 ไป login** — `fetch` ตาม redirect ข้าม origin ไม่ได้
- refresh token **อยู่กับ Core Hub เท่านั้น** — ห้ามส่งให้ระบบย่อย ห้ามระบบย่อยเก็บหรือต่ออายุ token เอง

**Silent re-SSO** — วิธีต่ออายุโดยไม่ถามรหัสผ่านตลอดอายุ session ของ Core Hub

1. API ตอบ `401` → frontend พาทั้งหน้าไป `/auth/login?next=<path และ query ปัจจุบัน>`
2. วิ่งตาม flow ข้อ 5 เว็บ Core Hub ต่ออายุด้วย refresh token ของตัวเองแล้วส่งกลับมาเอง
3. กลับมาหน้าเดิมภายในไม่ถึง 1 วินาที

session ของ Core Hub อยู่ได้สูงสุด 7 วัน แต่บาง session จบเมื่อปิดเบราว์เซอร์ (เช่น login ผ่าน MJU SSO
หรือไม่ได้เลือกจดจำการเข้าสู่ระบบ) — หลังเปิดเบราว์เซอร์ใหม่ re-SSO จะพาไปหน้า login ของ Core Hub ซึ่งถูกต้องแล้ว

กฎของ frontend

- **ต้อง**เป็น top-level navigation (`window.location`) **ห้ามใช้ `fetch`** — ตาม redirect ไป Core Hub ไม่ได้และไม่ได้คุกกี้
- หน้าที่มีฟอร์มกรอกค้าง **ห้าม redirect ทับ** ให้ถามก่อน หรือต่ออายุล่วงหน้าตอนเปลี่ยนหน้าโดยดู `session.expiresAt` จาก `/api/v1/me`
- **กันวน:** ถ้าเพิ่งกลับจาก re-SSO ไม่ถึง 30 วินาทีแล้วยังได้ 401 อีก ให้แสดงปุ่ม "เข้าสู่ระบบอีกครั้ง" แทนการ redirect ซ้ำ
- ถ้า session ของ Core Hub หมดด้วย ผู้ใช้จะเห็นหน้า login ของ Core Hub ซึ่งถูกต้องแล้ว

**ออกจากระบบ** หมายถึงออกทั้งระบบ — `POST /auth/logout` ลบคุกกี้ของระบบย่อยแล้วพาไป `/logout` ของ Core Hub
ออกแค่ระบบย่อยไม่พอ เพราะกดเข้าใหม่ Core Hub ที่ยัง login อยู่ก็จะ SSO กลับมาทันที
ระบบย่อยอื่นที่เปิดค้างยังใช้ token เดิมได้จนหมดอายุ (ไม่เกิน 15 นาที) — Core Hub ไม่มีช่องทางแจ้งระบบย่อยว่า
session ถูกยกเลิก แต่ถ้าระบบย่อยเรียก Core Hub ด้วย token นั้นจะได้ 401 (ข้อ 6.1)

---

## 8. 401 กับ 403

| สถานะ | ใช้เมื่อ |
|---|---|
| **401 UNAUTHORIZED** | ไม่รู้ว่าเป็นใคร — ไม่มี token · token เสีย/หมดอายุ/ลายเซ็นผิด/`kid` ไม่รู้จัก |
| **403 FORBIDDEN** | รู้แล้วว่าเป็นใคร แต่ไม่มีสิทธิ์ — รวมถึง core role ที่ระบบย่อยไม่รับ |

**ห้าม**ตอบ 401 แทน 403 หรือ 404 แทน 403 (CI และ conformance ตรวจข้อนี้)

---

## 9. ข้อห้าม

```text
1. สร้างหน้า login หรือฟอร์มรหัสผ่าน · register · refresh ของตัวเอง — ยกเว้น /auth/login และ /auth/logout
   ที่เป็นแค่ตัว redirect ตามข้อ 5 (ต้องมี)
2. เก็บรหัสผ่าน หรือสร้างระบบยืนยันตัวตนที่สอง
3. ถือกุญแจส่วนตัวของ Core Hub หรือคัดลอกไฟล์ .pem เข้ามาใน repo
4. ออก JWT เอง หรือใช้ HS256 แทนสัญญา RS256
5. ยอมรับ alg=none หรืออัลกอริทึมอื่นนอกจาก RS256
6. ฮาร์ดโค้ด public key โดยไม่รองรับ kid
7. เชื่อ identity จาก body / query / custom header
8. ข้ามการตรวจ token เพื่อความสะดวก (แม้ใน dev)
9. ส่ง token ของผู้ใช้ต่อให้ระบบอื่น เก็บลงฐานข้อมูล หรือเรียก endpoint ของ Core Hub นอกรายการที่อนุญาต
10. log token · header Authorization/Cookie · URL เต็มของ /auth/callback
```

---

## 10. การเปลี่ยนสัญญา

AIE ไม่มีสิทธิ์แก้เอกสารนี้เอง

```text
AIE → PL → เจ้าของ Core Hub → อนุมัติ → แก้ auth-contract.md + contracts/*.json
    → ขึ้น VERSION → อัปเดต conformance → แจ้งทุกระบบย่อย
```

จนกว่าสัญญาใหม่จะได้รับอนุมัติ **ให้ใช้สัญญาเดิม**

---

## 11. แผนการเปลี่ยนแปลง

| เวอร์ชัน | เปลี่ยนอะไร | ผลกับระบบย่อย |
|---|---|---|
| 1.0 | RS256 + JWKS + SSO ผ่าน callback_url | — |
| 1.1 | SSO เริ่มที่ระบบย่อย + `state` · Silent re-SSO · logout ทั้งระบบ · error code 9 ค่า | เพิ่ม `/auth/login` `/auth/logout` · แก้ `/auth/callback` · เปลี่ยนชื่อคุกกี้ · ดู `CHANGELOG.md` 1.1.0 |
| **1.2** (ปัจจุบัน · standards 1.7.0) | token คือบัตรผ่านของผู้ใช้ (ข้อ 6.1) · ตรวจอายุ token · ตรวจ `azp` เมื่อมี · `role` = role สำหรับระบบนี้ | เพิ่มขั้น 9–10 ในตัวตรวจ token · หน้า "เข้าสู่ระบบอีกครั้ง" ตอน state ไม่ตรง |
| ถัดไป (หลัง Core Hub ขึ้นงานแยก token) | Core Hub ใส่ `azp` ใน token ที่ส่งให้ระบบย่อย · refresh token ใช้ `aud=core-hub-refresh` · ปฏิเสธ endpoint นอกรายการที่อนุญาต · ใช้สิทธิ์พิเศษรายบุคคลจริง | ขั้น 10 บังคับให้ต้องมี `azp` · ไม่ต้องแก้การแมป role |
| 2.0 | เปลี่ยน handoff เป็น **authorization code + PKCE** และอาจมี API Gateway | ต้องเพิ่มการแลก code ที่ token endpoint |

แผนเดิมที่จะเปลี่ยน `aud` เป็นชื่อระบบย่อยถูกแทนด้วย `azp` — `aud` คงเป็น `csmju2030` ตามสัญญา

**ข้อจำกัดที่รู้อยู่แล้วใน 1.2:** token ยังส่งผ่าน URL query ตอน callback (2.0 จะแก้) ·
จนกว่า Core Hub จะใส่ `azp` token ของระบบหนึ่งยังนำไปใช้ที่อีกระบบได้ · logout ไปถึงระบบย่อยอื่นช้าสุด 15 นาที
(ยังไม่มี back-channel logout) · ระหว่างที่ระบบย่อยบางตัวยังอยู่ที่ 1.0 การกดจาก sidebar จะออก token รอบแรกที่ถูกทิ้งไป 1 ใบ

---

## 12. Source of Truth

```text
auth-contract.md          → login / token / JWKS / SSO / callback
authorization.md          → role mapping / permission / 401-403
subsystem-registry.md     → การลงทะเบียนและ callback_url
connect-core-hub.md       → ขั้นตอนเชื่อม server จริงทีละขั้น
reference-data.md         → ข้อมูลกลางที่เรียกได้ และสิ่งที่ระบบย่อยเก็บได้
contracts/jwt-contract.json → ค่าจริงที่โค้ดและ CI อ่าน
```

หากเอกสารขัดกัน ให้ยึด `contracts/*.json` แล้วแจ้ง PL ทันที
