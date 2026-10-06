# CSMJU2030 Core Hub (`core-api`)

**ศูนย์กลางการยืนยันตัวตนของแพลตฟอร์ม CSMJU2030** — ออก access token แบบ RS256, เผยแพร่กุญแจสาธารณะผ่าน JWKS,
เก็บทะเบียน subsystem และทำ Central SSO ให้ subsystem ของทีมอื่นเข้าใช้งานโดยผู้ใช้ล็อกอินครั้งเดียว

| | |
|---|---|
| เวอร์ชัน | **1.0.0** (มาตรฐานที่ยึด: CSMJU2030 Subsystem Standard **v1.0**) |
| พอร์ต | `3000` |
| ฐานข้อมูล | PostgreSQL — `core_hub` (ของ Core Hub เท่านั้น) |
| repo ที่เกี่ยวข้อง | `demo-student-subsystem` (reference implementation) · `csmju2030-subsystem-standard` (มาตรฐาน + conformance) |

```text
User ── login ──► Core Hub ── RS256 access token + JWKS ──► Subsystem ต่าง ๆ
                     │
                     ├── Authentication / Session / Refresh
                     ├── Core roles + Permissions
                     ├── Subsystem Registry (+ callback_url, role mapping)
                     └── Central SSO handoff
```

> Core Hub เป็นผู้ให้ identity **เพียงรายเดียว** — subsystem ห้ามมีระบบ login ของตัวเอง
> รายละเอียดข้อบังคับฝั่ง subsystem อยู่ใน `csmju2030-subsystem-standard/STANDARD.md`

---

## 1. Tech stack

| ชั้น | เทคโนโลยี | เวอร์ชันที่ใช้จริง |
|---|---|---|
| Runtime | Node.js | 22.x |
| ภาษา | TypeScript | 5.9 |
| Framework | NestJS (platform-express) | 11 |
| Config | @nestjs/config | 4.0.4 |
| ORM | Prisma + @prisma/client + @prisma/adapter-pg | **7.9.1 (pin ทั้งสามตัว)** |
| Driver | pg | 8.23 |
| ฐานข้อมูล | PostgreSQL | 16+ |
| Auth | @nestjs/jwt · passport-jwt · bcrypt | 11 / 4 / 6 |
| Validation | class-validator · class-transformer | 0.15 / 0.5 |
| ทดสอบ | Jest · ts-jest · supertest | 30 / 29.4 / 7 |

---

## 2. การติดตั้งและรัน

```bash
cd core-api/backend

cp .env.example .env          # ⚠️ ต้องทำก่อน npm install (Prisma 7 อ่าน DATABASE_URL ตอน generate)
npm install
```

### 2.1 กุญแจ RSA (จำเป็น — ไม่มีแล้วระบบจะไม่สตาร์ต)

`keys/jwt-private.pem` ถูก **gitignore** ไว้ (มีเฉพาะ `keys/jwt-public.pem` ใน git)
ถ้า clone มาใหม่ให้ขอไฟล์จากทีม หรือสร้างคู่ใหม่ทั้งคู่:

```bash
mkdir -p keys
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out keys/jwt-private.pem
openssl rsa -in keys/jwt-private.pem -pubout -out keys/jwt-public.pem
```

> ⚠️ ถ้าสร้างกุญแจใหม่ **ต้องสร้างทั้งคู่พร้อมกัน** (private + public) ไม่งั้น JWKS จะเผยแพร่กุญแจที่ไม่ตรงกับที่ใช้เซ็น
> และ token เดิมทั้งหมดจะใช้ไม่ได้ทันที · `kid` ยังเป็น `core-hub-2026` เหมือนเดิม

### 2.2 ฐานข้อมูลและข้อมูลตั้งต้น

```bash
npx prisma migrate deploy     # หรือ migrate dev ถ้า DB ยังว่าง
npm run build                 # ต้อง build ก่อน seed
node dist/prisma/seed.js      # roles + permissions + users + demo subsystem (ไม่ใช่ production)
```

> ⚠️ **อย่าใช้** `npx ts-node prisma/seed.ts` — จะล้มด้วย `Cannot find module './internal/class.js'`
> เพราะ Prisma 7 generate client ออกมาเป็นไฟล์ `.ts` ที่ ts-node โหมด CJS resolve ไม่ได้

### 2.3 สตาร์ต

```bash
npm run start:dev             # build + watch  → http://localhost:3000
# หรือรันไฟล์ที่ build แล้ว
node dist/src/main.js
```

ตรวจว่าขึ้นแล้ว:

```bash
curl -s http://localhost:3000/api/v1/health | jq .
curl -s http://localhost:3000/api/v1/.well-known/jwks.json | jq '.keys[0] | {kid, kty, alg}'
```

> ⚠️ `npm run start:prod` ใน `package.json` ชี้ไปที่ `dist/main` ซึ่ง **ไม่มีจริง** (ไฟล์อยู่ที่ `dist/src/main.js`) — ใช้คำสั่งด้านบนแทน

### 2.4 ขึ้น server (dev server · production)

ตอน development ไม่ต้องตั้งสองค่านี้ แต่บน server ต้องตั้งทั้งคู่ เพราะบริการเก็บรูป (§5.6) ขึ้นกับทั้งสองค่า

**`PUBLIC_URL`** — origin ที่เบราว์เซอร์และ backend ของระบบย่อยใช้เรียก API นี้จริง เช่น `https://core.example.ac.th`
(ไม่มี `/api/v1` ต่อท้าย · ถ้า proxy เติม path prefix ให้ใส่ prefix นั้นด้วย)

- `url` และ `thumbnailUrl` ของรูปสร้างจากค่านี้ ถ้าว่าง จะใช้ protocol และ `Host` ของ request แทน
  ซึ่งหลัง reverse proxy มักเป็น host ภายใน (เช่น `127.0.0.1:3000` ที่ frontend ใช้ผ่าน `BACKEND_API_URL`)
  หรือเป็น `http` ทั้งที่หน้าเว็บเป็น `https` (ถ้าไม่ได้ตั้ง `TRUST_PROXY`) รูปจะแสดงไม่ขึ้น
- DB เก็บแค่ id ของรูป URL สร้างใหม่ทุก response จึงเปลี่ยน `PUBLIC_URL` ทีหลังได้ ·
  ระบบย่อยจึงควรเก็บ `id` ไม่ใช่ URL เต็ม
- proxy ข้างหน้าต้อง:
  - ส่ง `GET /api/v1/images/:id/file` ผ่านโดยไม่ต้อง login (`<img>` แนบ token ไม่ได้)
  - รับ body ได้อย่างน้อย 10 MB สำหรับ `POST /api/v1/images` (nginx ตั้งไว้แค่ 1 MB ต้องตั้ง `client_max_body_size 11m`)
  - ไม่ตั้ง cache ของ `…/file` ให้นานกว่า 1 วัน (`core-hub-rules.md` §6)

**`UPLOAD_DIR`** — ใช้ path เต็มบนดิสก์ที่ไม่หายตอน deploy ใหม่ เช่น `/var/lib/core-hub/uploads`

- ใน Docker ต้อง mount เป็น volume · ห้ามอยู่ใต้โฟลเดอร์ build (`dist/`) หรือโฟลเดอร์ของ release
- process ต้องเขียนได้ · โฟลเดอร์ย่อย (`profiles/2026-09/…`) ระบบสร้างเอง
- รันหลาย instance ต้องชี้ไปที่โฟลเดอร์เดียวกัน (volume หรือ NFS เดียวกัน) เพราะ instance ไหนก็อาจต้องส่งไฟล์รูปใดก็ได้ ·
  งานล้างรูปตอนตี 3 รันทุก instance แต่มี advisory lock ของ Postgres ให้ทำแค่ตัวเดียว
- สำรองพร้อมกับฐานข้อมูล · ถ้า DB มีแถวแต่ไม่มีไฟล์ `GET …/file` จะตอบ `404`
- `storage_path` ใน DB เป็น path สัมพัทธ์กับ `UPLOAD_DIR` จึงย้ายโฟลเดอร์ได้โดยแก้แค่ env

ตรวจหลังขึ้น server:

```bash
curl -s -F category=GENERAL -F file=@test.jpg -H "Authorization: Bearer $TOKEN" \
  https://core.example.ac.th/api/v1/images | jq -r .data.url
# → ต้องขึ้นต้นด้วย PUBLIC_URL · เปิด URL นั้นโดยไม่ login ต้องได้รูป
```

---

## 3. Environment variables

ดู [`.env.example`](./.env.example)

| ตัวแปร | ความหมาย |
|---|---|
| `PORT` | พอร์ตของ Core Hub (3000) |
| `DATABASE_URL` | ฐานข้อมูล `core_hub` |
| `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` | คู่กุญแจ RS256 |
| `JWT_EXPIRES_IN` | อายุ access token (`15m`) |
| `JWT_REFRESH_EXPIRES_IN` | อายุ refresh token (`7d`) |
| `JWT_SECRET` | ค่าตกค้างจากรุ่นก่อน — **โค้ดปัจจุบันไม่ได้ใช้** |
| `UPLOAD_DIR` | โฟลเดอร์เก็บไฟล์รูป (`uploads`) — ใน Docker ต้อง mount เป็น volume · บน server ดู §2.4 |
| `PUBLIC_URL` | origin สาธารณะของ API ใช้สร้าง URL รูป — ว่างได้ตอน dev (ใช้ host ของ request) · บน server ต้องตั้ง ดู §2.4 |
| `ALLOW_LOCALHOST_CALLBACKS` | `true` (สตริงนี้เท่านั้น) = production รับ callback/base URL `http://localhost` · ใช้ช่วงก่อนเปิดใช้เท่านั้น — ปิดแล้วลงทะเบียนได้ `400` และ SSO ไป callback `http://` ที่ลงทะเบียนไว้ได้ `409` ทันที · ไม่ใช่ production ไม่สนใจค่านี้ · API log เตือนตอนสตาร์ตเมื่อเปิดใน production |
| `STANDARDS_TAGS_URL` | URL "list tags" ของ csmju2030-standards (`https://api.github.com/repos/CSMJU2030/csmju2030-standards/tags?per_page=100`) — รายการ `standardsVersion` ที่เลือกได้ · cache 1 ชั่วโมง · ว่าง = ไม่ดึง ใช้ fallback อย่างเดียว |
| `STANDARDS_VERSIONS_FALLBACK` | ใช้เมื่อยังดึง tag ไม่ได้เลยสักครั้ง เช่น `1.7.4,1.7.3,1.7.2,1.0.6` (คั่นด้วย `,` · ไม่ต้องมี `v`) |
| `STANDARDS_TAGS_TOKEN` | ไม่บังคับ — bearer token ถ้าวันหน้า repo standards เป็น private · ไม่ถูก log |
| `IMAGE_PURGE_AFTER_DAYS` | รูปที่ลบแล้วเก็บไว้กี่วันก่อนลบไฟล์และแถวทิ้งถาวร (`30`) |
| `MJU_CLIENT_ID` | clientID ของ MJU SSO ที่มหาวิทยาลัยออกให้ — ว่าง = ปิด MJU SSO · frontend ต้องตั้งค่าเดียวกัน (§5.7) |
| `MJU_SUBJECT_SECRET` | กุญแจ HMAC ของ `users.mju_subject` 32 ตัวขึ้นไป (`openssl rand -hex 32`) — **ห้ามเปลี่ยนหลังใช้งานจริง** ไม่งั้นบัญชีที่ผูก MJU ไว้จะจับคู่ไม่เจอ |
| `MJU_SSO_TOKEN_URL` | ค่าเริ่มต้น `https://sso.mju.ac.th/token.aspx` |

ค่าที่ **ตรึงไว้ในโค้ด** (ไม่ได้อ่านจาก env) และถือเป็นสัญญากับทุก subsystem:

```text
algorithm = RS256      issuer = core-hub      audience = csmju2030      kid = core-hub-2026
```

---

## 4. สัญญา Token (subsystem ทุกตัวยึดตามนี้)

payload ของ access token:

```json
{
  "sub": "user-002",
  "email": "student@core.local",
  "role": "student",
  "sid": "<session id>",
  "iss": "core-hub",
  "aud": "csmju2030",
  "iat": 1789027279,
  "exp": 1789028179
}
```

`role` เป็นหนึ่งใน `student` · `alumni` · `staff` (บุคลากรที่**ไม่ใช่**อาจารย์) · `lecturer` (อาจารย์) · `guest` (ผู้เยี่ยมชม) · `admin` —
`lecturer` กับ `guest` เพิ่มใน standards 1.6.0 (สาย 1.0.x: 1.0.6) · ระบบย่อยที่ไม่ได้ใส่ role ใน mapping ตอบ `403` ให้ role นั้น

JWKS ที่ `/api/v1/.well-known/jwks.json` เป็น **RFC 7517 ดิบ** — `{"keys":[...]}` ที่ระดับบนสุด
(endpoint นี้ถูกยกเว้นจาก response envelope ของ Core Hub โดยตั้งใจ เพื่อให้ library มาตรฐานทุกตัวใช้ได้)

```jsonc
// ทุก endpoint อื่นถูกห่อด้วย envelope นี้
{ "success": true, "data": {...}, "requestId": "...", "timestamp": "..." }
{ "success": false, "error": { "statusCode": 403, "message": "..." }, "path": "...", "timestamp": "..." }
```

---

## 5. API

prefix `/api` + URI versioning (`defaultVersion = 1`) → ทุกเส้นทางขึ้นต้นด้วย `/api/v1`

### 5.1 Authentication

| Method & path | Guard | ใช้ทำอะไร |
|---|---|---|
| `POST /api/v1/auth/login` | — | `{email, password}` → `access_token` + `refresh_token` · บัญชีที่ผูกกับบุคคล `INACTIVE` → 403 |
| `POST /api/v1/auth/refresh` | — | `{refresh_token}` → คู่ token ใหม่ (มี reuse detection) · บุคคล `INACTIVE` → 403 และเพิกถอน session นั้น |
| `GET /api/v1/auth/me` | JWT | ข้อมูลผู้ใช้ปัจจุบัน + `hasPassword` (มีรหัสผ่านของ Core Hub หรือยัง — ไม่ส่ง hash) + `permissions` (สิทธิ์จริง = role + รายบัญชี — หน้าเว็บใช้ซ่อนเมนูเท่านั้น backend ยังตรวจเองทุก request) |
| `POST /api/v1/auth/mju/callback` | — | `{code}` (ค่า `ac` ที่ MJU SSO ส่งมา) → คู่ token แบบเดียวกับ login + `password_set` · ดู §5.7 |
| `POST /api/v1/auth/logout` | JWT | เพิกถอน session ปัจจุบัน |
| `POST /api/v1/auth/logout-all` | JWT | เพิกถอนทุก session ของผู้ใช้ |
| `POST /api/v1/auth/change-password` | JWT | `{currentPassword, newPassword}` → เปลี่ยนรหัสของตัวเอง แล้วเพิกถอน**ทุก** session รวมเครื่องที่เรียก (ต้อง login ใหม่) · บัญชียังไม่มีรหัส → 400 |
| `POST /api/v1/auth/password/set` | JWT | `{newPassword}` → ตั้งรหัส**โดยไม่ต้องรู้รหัสเดิม** เฉพาะบัญชีที่ยังไม่มีรหัส หรือ session ที่เปิดด้วย MJU SSO ไม่เกิน 10 นาที (นอกนั้น 403) · เพิกถอน session อื่นทั้งหมด แต่คง session ที่เรียก · ดู §5.7 |
| `GET /api/v1/.well-known/jwks.json` | — | กุญแจสาธารณะ (RFC 7517) |

**กติการหัสผ่านใหม่** (`src/modules/users/password-policy.ts`): ยาว 8–64 ตัวอักษร (ไม่เกิน 72 byte) ·
มีตัวพิมพ์ใหญ่ A–Z อย่างน้อย 1 ตัว · ไม่ซ้ำรหัสปัจจุบัน (เฉพาะ change-password) · ไม่ใช่รูปแบบที่เดาได้ (ข้อความตอบกลับเป็นกลาง ๆ)
ใช้กับทั้ง `change-password` และ `password/set` · รหัสปัจจุบันที่ผิดนับรวมกับ lockout ของ login (ต่ออีเมล 10 ครั้ง / 15 นาที) ·
ทั้งสองเส้นมีเพดาน `RATE_LIMIT_CHANGE_PASSWORD` ต่อ IP · หน้าเว็บ: `/account/password` (เปลี่ยน — ปุ่ม "เปลี่ยนรหัสผ่าน" เหนือ
"ออกจากระบบ" ทั้งพอร์ทัลและ backoffice) และ `/account/password/setup` (ตั้งครั้งแรก / ลืมรหัส)

### 5.2 Central SSO

| Method & path | Guard | ใช้ทำอะไร |
|---|---|---|
| `GET /api/v1/auth/sso/authorize?subsystem=<name\|id>[&callback_url=][&state=]` | JWT | ตรวจ registry + สิทธิ์เข้าระบบ + callback → **302** ไป callback ที่ลงทะเบียนไว้ |
| `GET /api/v1/auth/sso/handoff?subsystem=…` | JWT | เหมือนด้านบนแต่คืน JSON (`redirect_url`, `access_token`, `expires_in`) สำหรับ frontend/สคริปต์ |

ลำดับการตรวจก่อนออก token: `subsystem มีจริง (404)` → `APPROVED (409)` → `ACTIVE (409)` → `core role อยู่ใน defaultRoleMapping (403)` → `callback_url ตรงกับที่ลงทะเบียน (400)`

### 5.3 Subsystem Registry

ทุกเส้นทางต้องมี JWT และ **ทุกเส้นทางประกาศ permission** (`PermissionsGuard`) — ไม่มี route ไหนเปิดให้ผู้ใช้ที่ login แล้วทุกคน

| Method & path | permission | ใช้ทำอะไร |
|---|---|---|
| `POST /api/v1/subsystems` | `subsystem:create` (admin · หรือบัญชีที่ได้สิทธิ์รายบัญชี) | ส่งคำขอขึ้นระบบ (`owner` ไม่บังคับ — ค่าเริ่มต้นคือผู้เรียก) · `standardsVersion` ต้องอยู่ในรายการ `standards-versions` |
| `GET /api/v1/subsystems/standards-versions` | `subsystem:create` หรือ `update:own\|any` | `{ versions, source }` — tag จริงของ csmju2030-standards ใหม่ → เก่า ไม่มี `v` (`source`: `github` · `cache` · `fallback`) |
| `GET /api/v1/subsystems/change-requests?status=&page=&limit=` | `subsystem:review` | คำขอแก้ไขรวมทุกระบบ (หน้า "คำขอ") |
| `GET /api/v1/subsystems?approvalStatus=&status=&q=&page=&limit=` | `subsystem:read:own\|any` | รายการแบบแบ่งหน้า (มี `meta`) — staff เห็นเฉพาะของตัวเอง |
| `GET /api/v1/subsystems/summary` | `subsystem:read:own\|any` | จำนวนแยกตามสถานะ |
| `GET /api/v1/subsystems/directory` | `system:read` | ระบบที่เปิดใช้งานและ role ของผู้เรียกเข้าได้ (เมนูใน portal) |
| `GET /api/v1/subsystems/all` | `subsystem:read:any` | ทะเบียนทั้งหมด รูปแบบเดิม — **conformance `L3-01..05` อ่าน endpoint นี้** |
| `GET /api/v1/subsystems/:id` | `subsystem:read:own\|any` | รายละเอียด + owner + exceptions + ประวัติ (`events`) |
| `PATCH /api/v1/subsystems/:id` | `subsystem:update:own\|any` | แก้ไข (ดูกฎหลังอนุมัติด้านล่าง) |
| `POST /api/v1/subsystems/:id/change-requests` | `subsystem:update:own\|any` | เจ้าของยื่นคำขอแก้ `callbackUrl` · `baseUrl` (`""` = ลบ) · `defaultRoleMapping` ของระบบที่อนุมัติแล้ว → `PENDING` · ค้างได้ 1 รายการ (ยื่นซ้ำ `409`) |
| `GET /api/v1/subsystems/:id/change-requests` | `subsystem:read:own\|any` | คำขอแก้ไขของระบบนี้ ใหม่ → เก่า (แบ่งหน้า) |
| `POST /api/v1/subsystems/:id/change-requests/:requestId/approve` | `subsystem:review` | ตรวจกฎ URL/การแมปซ้ำ แล้วใช้ค่าใหม่ทุกช่องทันที (transaction เดียวกับ event) |
| `POST /api/v1/subsystems/:id/change-requests/:requestId/reject` | `subsystem:review` | body `{ reason }` **บังคับ** · ค่าในทะเบียนไม่เปลี่ยน |
| `POST /api/v1/subsystems/:id/change-requests/:requestId/cancel` | `subsystem:update:own\|any` | เจ้าของ (หรือผู้ยื่น) ยกเลิกคำขอที่ค้าง |
| `GET /api/v1/subsystems/:id/history?page=&limit=` | `subsystem:read:own\|any` | ประวัติ ใหม่ → เก่า: ใคร · เมื่อไร · `action` · `reason` · `changes` |
| `DELETE /api/v1/subsystems/:id` | `subsystem:delete` | ลบ — ระบบที่ `ACTIVE` ลบไม่ได้ (`409`) · คืน `{ id, deleted: true }` |
| `POST /api/v1/subsystems/:id/approve` | `subsystem:review` | `PENDING` → `APPROVED` |
| `POST /api/v1/subsystems/:id/reject` | `subsystem:review` | `PENDING` → `REJECTED` · body `{ reason }` **บังคับ** |
| `POST /api/v1/subsystems/:id/resubmit` | `subsystem:update:own\|any` | `REJECTED` → `PENDING` |
| `POST /api/v1/subsystems/:id/activate` | `subsystem:operate` | → `ACTIVE` |
| `POST /api/v1/subsystems/:id/deactivate` | `subsystem:operate` | `ACTIVE` → `INACTIVE` · body `{ reason? }` |
| `POST /api/v1/subsystems/:id/suspend` | `subsystem:operate` | `ACTIVE` → `SUSPENDED` · body `{ reason }` **บังคับ** |
| `GET`/`PATCH /api/v1/subsystems/:id/role-mapping` | read / update `:own\|any` | ตาราง core role → subsystem role |
| `POST`/`GET /api/v1/subsystems/:id/exceptions` | update / read `:own\|any` | คำขอสิทธิ์พิเศษรายบุคคล |
| `POST /api/v1/subsystems/:id/exceptions/:exceptionId/approve` · `/reject` | `subsystem:review` | ตัดสินคำขอสิทธิ์พิเศษ |
| `GET /api/v1/subsystem-exceptions?status=REQUESTED` | `subsystem:review` | คิวคำขอสิทธิ์พิเศษรวมทุกระบบ |

**ใครได้ permission อะไร** (`src/modules/authorization/role-permissions.ts` + seed):
staff/lecturer = `read:own` `update:own` · admin = ทั้งหมด · student/alumni/guest = ไม่มี (ใช้ได้แค่ `directory`)

**ลงทะเบียนระบบย่อยได้ = รายบัญชี** (PM 5 ต.ค. 2569): `subsystem:create` ไม่อยู่ใน role staff/lecturer แล้ว — admin เปิดให้ทีละบัญชีที่หน้า
"บัญชีผู้ใช้" (`PUT`/`DELETE /api/v1/users/:id/permissions/subsystem:create`) เก็บในตาราง `user_permission_grants` ·
`PermissionsGuard` ใช้สิทธิ์ของ role **รวมกับ** สิทธิ์รายบัญชี (ค้นฐานเฉพาะเมื่อ role ไม่พอและสิทธิ์ที่ขาดอยู่ใน `GRANTABLE_PERMISSIONS`) ·
ไม่ใส่ลง token — ถอนแล้วมีผลทันที · migration `20261006000011_user_permission_grants` ให้สิทธิ์กับทุกบัญชีที่เป็นเจ้าของระบบอยู่แล้ว

**`:own`** = `subsystem.ownerId === ผู้เรียก` — ตรวจใน service กับข้อมูลจริง และตอบ **`403`** (ไม่ใช่ `404`) ตาม `authorization.md` ข้อ 5

**หลังอนุมัติแล้ว** เจ้าของแก้ `callbackUrl` · `baseUrl` · `defaultRoleMapping` ตรง ๆ ไม่ได้ (`403` บอกให้ยื่นคำขอแก้ไข) —
ยื่น **คำขอแก้ไข** แล้ว admin อนุมัติ (ค่าใหม่มีผลทั้งชุดทันที) หรือปฏิเสธพร้อมเหตุผล · ระหว่างรอระบบยังใช้ค่าเดิม ·
**ไม่ต้องลงทะเบียนใหม่** — `name` (= `azp` ใน token) สิทธิ์พิเศษ และประวัติอยู่ที่รายการเดิม · `name` เปลี่ยนได้เฉพาะ admin
(ทีมต้องแก้ `SUBSYSTEM_ID` พร้อมกัน) · `displayName` · `repo` · `standardsVersion` เจ้าของแก้ได้ทันที · ส่งค่าเดิมกลับมาไม่นับว่าแก้

**ทุกการเปลี่ยนแปลงถูกบันทึก** ในตาราง `subsystem_events` (ใคร · ทำอะไร · เหตุผล · เมื่อไร) พร้อม `changes`
= `{ "<field>": { "from": …, "to": … } }` เฉพาะช่องที่เปลี่ยน — ทั้งแก้ตรง ยื่น/อนุมัติ/ปฏิเสธ/ยกเลิกคำขอ และ admin แก้

**`standardsVersion`** เก็บแบบไม่มี `v` (เช่น `1.7.2`) · สร้าง/แก้ต้องเป็นค่าในรายการ `standards-versions` ไม่งั้น `400 VALIDATION_ERROR` ·
ค่าเดิมในฐานที่ไม่อยู่ในรายการแล้ว (เช่น `1.0`) บันทึกทับด้วยค่าเดิมได้ · backend ดึง tag จาก GitHub เอง (timeout 5 วินาที · cache 1 ชั่วโมง ·
ดึงไม่ได้ใช้ cache ล่าสุด · ไม่เคยดึงได้ใช้ `STANDARDS_VERSIONS_FALLBACK`) — เบราว์เซอร์ไม่เรียก GitHub

**กฎของ `callback_url` และ `base_url`**: ต้องเป็น absolute URL · `https` เท่านั้น ยกเว้น `localhost` / `127.0.0.1` / `[::1]`
เมื่อไม่ใช่ production หรือเมื่อตั้ง `ALLOW_LOCALHOST_CALLBACKS=true` · กฎเดียวกันตรวจซ้ำตอน `sso/authorize` —
callback ที่ลงทะเบียนไว้แต่ไม่ผ่านกฎแล้ว (เช่นปิด flag) ได้ `409` ก่อนออก token ·
ค่าที่ client ส่งมาที่ `sso/authorize` ต้องตรงกับที่ลงทะเบียนแบบเป๊ะ ไม่งั้น `400` (กัน open redirect)

**`defaultRoleMapping` มีผลบังคับ** — key ของมันคือรายชื่อ core role ที่เข้าระบบนั้นได้
เช่น `{"admin":"ADMIN","staff":"STAFF","student":"USER"}` แปลว่า `alumni` จะถูกปฏิเสธด้วย `403` ตั้งแต่ Core Hub

error ทุกตัวมี `error.code` จากรายการปิด 7 ค่า (`contracts/error-codes.json`) และ `error.details[]` เมื่อ validation ไม่ผ่าน

### 5.4 Users / Sessions

| Method & path | Guard | หมายเหตุ |
|---|---|---|
| `GET /api/v1/users` · `GET /api/v1/users/:id` | JWT + Permissions | ต้องมี permission ที่กำหนดในแต่ละ route |
| `POST /api/v1/users/add-user` · `PATCH /api/v1/users/update/:id` · `DELETE /api/v1/users/delete/:id` | JWT + Permissions | |
| `PUT`/`DELETE /api/v1/users/:id/permissions/:permission` | JWT + `user:update` (admin) | ให้/ถอนสิทธิ์รายบัญชี — ตอนนี้ได้เฉพาะ `subsystem:create` (อื่น ๆ `400`) · log `user.permission_granted` / `user.permission_revoked` ด้วย id เท่านั้น |
| `GET /api/v1/sessions` | JWT | session ของตัวเอง |
| `DELETE /api/v1/sessions/all` · `DELETE /api/v1/sessions/:id` | JWT | เพิกถอน session |

### 5.5 Health และ route ทดสอบสิทธิ์

| Path | หมายเหตุ |
|---|---|
| `GET /api/v1/health` · `/health/live` · `/health/ready` | ตรวจสถานะระบบ |
| `GET /api/v1/auth/admin-test` · `/staff-test` · `/system-manage-test` · `/system-management-test` | route สำหรับสาธิต RolesGuard / PermissionsGuard |

### 5.6 รูปภาพ (บริการเก็บรูปกลาง)

| Method & path | permission | ใช้ทำอะไร |
|---|---|---|
| `POST /api/v1/images` | `image:upload` (+ `content:create` ถ้าเป็น `NEWS`) | อัปโหลด multipart: `file` + `category` (`PROFILE`/`NEWS`/`GENERAL`) + `subsystem?` → `201` |
| `GET /api/v1/images?category=&page=&limit=` | `image:read:own\|any` | รายการแบบแบ่งหน้า — คนที่ไม่มี `:any` เห็นเฉพาะที่ตัวเองอัป |
| `GET /api/v1/images/:id` | `image:read:own\|any` | ข้อมูลของรูป |
| `DELETE /api/v1/images/:id` | `image:delete:own\|any` | ลบแบบ soft delete · คืน `{ id, deleted: true }` · ถ้าเป็นรูปโปรไฟล์ของใครจะถูกถอดออก |
| `GET /api/v1/images/:id/file[?size=thumb]` | — (**สาธารณะ**) | ไฟล์รูป WebP ดิบ ไม่ห่อ envelope ใช้ใน `<img src>` ได้ตรง ๆ |

**ใครได้อะไร:** ทุก role อัปรูป `PROFILE`/`GENERAL` และจัดการรูปของตัวเองได้ · staff และ admin อัปรูป `NEWS` ได้ (`content:create`) ·
admin ดูและลบรูปของทุกคนได้ (`image:read:any` `image:delete:any`)

**ย่อรูปอัตโนมัติ** — รับ jpg · png · webp ไม่เกิน 10 MB · jpg ไม่เกิน 200 ล้านพิกเซล (libvips ย่อระหว่างถอดรหัส จึงใช้หน่วยความจำน้อย) png/webp ไม่เกิน 40 ล้านพิกเซล แล้วเก็บเป็น WebP (คุณภาพ 80)

| ประเภท | ย่อเหลือไม่เกิน | thumbnail (`?size=thumb`) |
|---|---|---|
| `PROFILE` | 512×512 ครอปเป็นจัตุรัสจากกลางภาพ | ไม่มี (ได้รูปเต็ม) |
| `NEWS` | กว้าง 1920px คงสัดส่วน | กว้าง 400px |
| `GENERAL` | ด้านยาว 1920px คงสัดส่วน | กว้าง 400px |

- ตรวจชนิดไฟล์จาก magic bytes ไม่เชื่อนามสกุลหรือ Content-Type · **ไม่รับ SVG และ GIF**
- หมุนตาม EXIF แล้ว**ลบ EXIF ทิ้งทั้งหมด** (รวมพิกัด GPS จากมือถือ) · รูปเล็กกว่ากำหนดไม่ถูกขยาย
- ไฟล์ไม่ผ่าน → `400 VALIDATION_ERROR` พร้อม `error.details`
- `subsystem` ต้องเป็นชื่อระบบย่อยที่ `APPROVED` และ `ACTIVE` เหมือนเงื่อนไขของ SSO · ระบบที่รออนุมัติ ถูกปฏิเสธ ปิดอยู่ หรือถูกระงับตอบ `400` ·
  เป็นแค่ป้ายบอกว่ารูปมาจากระบบไหน ใครก็ใส่ได้ **ห้ามใช้ตัดสินสิทธิ์**
- อัปโหลดได้ไม่เกิน 60 ครั้ง/นาทีต่อ IP (`RATE_LIMIT_IMAGE_UPLOAD_*`) นอกเหนือจากเพดานรวมของแอป · เกินแล้วตอบ `429` พร้อม `Retry-After`
- ชื่อไฟล์คือ UUID ของรูป เก็บที่ `<UPLOAD_DIR>/<profiles|news|general>/<YYYY-MM>/<id>.webp` (+ `<id>.thumb.webp`) ·
  response ไม่มี path ภายใน server
- อัปรูปโปรไฟล์ใหม่ → เป็นรูปปัจจุบันใน `users.profile_image_id` (เห็นใน `GET /auth/me` เป็น `profileImageId`) และรูปโปรไฟล์เก่าถูก soft delete
- `GET …/file` ตอบ `Cache-Control: public, max-age=86400` (ไม่ใส่ `immutable`) เพื่อให้รูปที่ลบแล้วหลุดจาก cache ภายใน 1 วัน ·
  รูปที่ลบแล้วตอบ `404` · เปิดสาธารณะตามข้อยกเว้นใน `core-hub-rules.md` §6 ของ standards
- ทุกคืนตี 3 (เวลาไทย) งาน `ImagePurgeService` ลบไฟล์และแถวของรูปที่ลบไปแล้วเกิน `IMAGE_PURGE_AFTER_DAYS` วัน (default 30) ·
  ระหว่างนั้นยังกู้แถวคืนเองใน DB ได้ · รันทีละ 200 รูปด้วย `DELETE … RETURNING` คำสั่งเดียวต่อ transaction
  และถือ `pg_try_advisory_xact_lock(4801)` ไว้ (`tech-stack.md` §1.4.1)
  ถ้ารันหลาย instance จะมีตัวเดียวที่ทำ ที่เหลือข้ามไป

**ระบบย่อยเรียกใช้อย่างไร**

1. backend ของระบบย่อยรับไฟล์จากผู้ใช้ แล้วส่งต่อไป Core Hub พร้อม token ของผู้ใช้คนนั้น (รูปจะเป็นของผู้ใช้ ไม่ใช่ของระบบ)
2. เก็บแค่ `id` (uuid) ในฐานข้อมูลของตัวเอง — ไม่ต้องเก็บ URL เพราะสร้างจาก id ได้
3. แสดงผลด้วย `<img src="https://<core-hub>/api/v1/images/<id>/file">` (หน้ารายการใช้ `?size=thumb`)

```ts
// NestJS ในระบบย่อย — ส่งไฟล์ที่ผู้ใช้อัปโหลดต่อไป Core Hub
const form = new FormData();
form.append('category', 'NEWS');
form.append('subsystem', 'news-service'); // ชื่อที่ลงทะเบียนไว้ ไม่บังคับ
form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);

const res = await fetch(`${CORE_HUB_URL}/api/v1/images`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${userAccessToken}` },
  body: form,
});
const { data } = await res.json(); // { id, url, thumbnailUrl, width, height, ... }
await this.prisma.news.update({ where: { id: newsId }, data: { imageId: data.id } });
```

```bash
# ทดสอบด้วย curl
curl -F category=PROFILE -F file=@me.jpg -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/images
```

### 5.6.1 หลักสูตรสำหรับหน้าเว็บสาธารณะ (ไม่ต้อง login)

| Method & path | Guard | ใช้ทำอะไร |
|---|---|---|
| `GET /api/v1/public/curricula[?page&limit&departmentCode]` | — (**สาธารณะ**) | รายการหลักสูตรที่ `isActive` เท่านั้น |
| `GET /api/v1/public/curricula/:code` | — (**สาธารณะ**) | รายละเอียดหลักสูตร · ปิดใช้งาน/ไม่มี → `404` |
| `GET /api/v1/public/curricula/:code/structure` | — (**สาธารณะ**) | โครงสร้างหลักสูตร |
| `GET /api/v1/public/curricula/:code/study-plan` | — (**สาธารณะ**) | แผนการศึกษาปี 1–4 |

- ใช้กับหน้า "หลักสูตร" ของเว็บสาธารณะ (PM ตัดสิน 5 ต.ค. 2569) · อ่านอย่างเดียว · ตอบรูปแบบเดียวกับ `/curricula`
- `includeInactive` / `isActive` ส่งมาไม่ได้ (`400`) · `:code` ต้องตรง `^[A-Z0-9-]{1,50}$` ไม่งั้น `400`
- อยู่ใต้ rate limit ต่อ IP ชั้นเดียวกับทุก route · `Cache-Control: public, max-age=300`
- **`/curricula` เดิมยังต้อง login** ตามสัญญาข้อมูลอ้างอิง — endpoint นี้เป็นประตูแยกที่แคบกว่า ไม่ได้เปิด `/curricula` เป็นสาธารณะ

### 5.7 เข้าสู่ระบบด้วย MJU SSO (sso.mju.ac.th)

ใช้ควบคู่กับรหัสผ่านของ Core Hub · **Core Hub ยังเป็นผู้ออก token รายเดียว** — คนที่เข้าผ่าน MJU ได้ access/refresh
token RS256 ชุดเดียวกับคนที่ใช้รหัสผ่าน ระบบย่อยจึงไม่ต้องแก้อะไร

```text
/login ──กดปุ่ม──► GET /auth/mju/login[?next=…]           (frontend: ตั้งคุกกี้ csmju_mju_login อายุ 10 นาที)
          ──302──► https://sso.mju.ac.th/signin.aspx?cid=<MJU_CLIENT_ID>
                     │ ผู้ใช้ login ที่ MJU (Microsoft 365 · ThaID · รหัสผ่าน · MJU Mobile App)
          ◄──302── GET /auth/mju/signin?ac=<code 32 ตัว>        (callback ที่ลงทะเบียนกับ clientID)
frontend ──POST /api/v1/auth/mju/callback {code}──► Core API ──POST token.aspx {clientID, code}──► MJU
          ◄── คู่ token ─────────────────────────────── Core API ◄── profile JSON ─────────────────┘
          ──303──► next (ถ้ามี) หรือหน้าแรกของ role    (cookie httpOnly แบบ login ปกติ + csmju_auth_provider=mju)
```

- **ไม่มีคุกกี้ `csmju_mju_login` ตอน callback** (ลิงก์จากที่อื่น หรือเริ่ม login จากหน้าของ MJU เอง) → ทิ้ง code
  แล้วเริ่มใหม่ที่ `/auth/mju/login` · MJU ไม่มี `state` คุกกี้นี้จึงเป็นตัวกัน login-CSRF และพา `next` (เช่น `/sso/authorize` ของระบบย่อย) กลับมาด้วย
- **Logout:** `POST /api/auth/logout` ล้าง cookie + เพิกถอน session ก่อน ถ้าเป็น session จาก MJU จะตอบ
  `data.redirect = signout.aspx?cid=…` ให้เบราว์เซอร์ไปต่อ แล้ว MJU ส่งกลับมาที่ `/auth/mju/signout`
- **callback ที่ลงทะเบียนกับมหาวิทยาลัย** (ผูกกับ clientID — เปลี่ยนโดเมนต้องแจ้งมหาวิทยาลัย):
  `https://<โดเมน>/auth/mju/signin` (มี alias `/auth/mju/callback`) และ `https://<โดเมน>/auth/mju/signout` ·
  ตอนนี้ลงทะเบียนไว้ที่ `csmju2030.jowave.com` · เครื่อง dev ต้องขอ clientID แยกที่ callback ชี้ `localhost`
- **ตั้งค่า:** backend `MJU_CLIENT_ID` · `MJU_SUBJECT_SECRET` · `MJU_SSO_TOKEN_URL` (§3) · frontend `MJU_CLIENT_ID` ·
  `MJU_SSO_SIGNIN_URL` · `MJU_SSO_SIGNOUT_URL` (`frontend/.env.example`)

**สัญญาของ token.aspx** (จาก sample PHP ของมหาวิทยาลัย): `ac` ตรง `^[A-Za-z0-9]{32}$` · ใช้ได้ครั้งเดียว ·
แลกด้วย `POST` JSON `{clientID, code}` · สำเร็จเมื่อคำตอบมี `citizenID` ไม่ว่าง · code ผิด/หมดอายุตอบ HTTP 200
`{"status":"fail","message":"invalid grant"}` · field ที่ได้จริง (ยืนยัน 28/09/2026 บัญชีนักศึกษา): `citizenID course courseID
division divisionID e_mail faculty facultyID firstName firstNameEn humanID lastName lastNameEn name nationID personID
personnelPhoto pictureUrl position section sectionID studentCode studentID titleName titleNameEn` — **`e_mail` ว่างสำหรับนักศึกษา**

**จับคู่บัญชี (`MjuSsoService`) — เข้าได้เฉพาะคนที่อยู่ในทะเบียนบุคคล** (PM ตัดสิน 28/09/2026)

1. `users.mju_subject` ตรง → บัญชีเดิม
2. อีเมลจาก MJU ตรงกับ `users.email` → ผูกบัญชีนั้น (staff/admin — นักศึกษาไม่มีอีเมลจาก MJU)
3. หาในทะเบียน `people` ด้วย `person_code` = `studentCode` (นักศึกษา) หรือ `university_email` = อีเมล (บุคลากร)
   - ไม่พบ หรือ `status = INACTIVE` → **403** ไม่สร้างอะไร (หน้า login แสดง "ยังไม่มีสิทธิ์ใช้ CSMJU2030")
   - มี `core_user_id` แล้ว (เช่น บัญชีที่ import จาก CSV) → ผูกบัญชีนั้น **ไม่สร้างบัญชีซ้ำ**
   - ยังไม่มีบัญชี → สร้างใหม่ `password_hash = null` (login ด้วยรหัสผ่านไม่ได้) แล้วตั้ง `people.core_user_id` ·
     role จากทะเบียน: `STAFF` + `LECTURER` ⇒ `lecturer` · `STAFF` อื่น ⇒ `staff` · `STUDENT` + `GRADUATED` ⇒ `alumni` · `STUDENT` ⇒ `student` · **ไม่มีทางได้ `admin` อัตโนมัติ**
   - อีเมล login: ของ MJU → ของทะเบียน → `<studentCode>@sso.mju.local` · `username` = `studentCode`
- บัญชีที่ผูกกับคนที่ภายหลังเป็น `INACTIVE` เข้าผ่าน MJU ไม่ได้อีก · บัญชีที่ผูก MJU คนอื่นอยู่แล้ว → 409

**ความเป็นส่วนตัว:** `mju_subject = HMAC-SHA256(citizenID, MJU_SUBJECT_SECRET)` — **ไม่เก็บเลขบัตรประชาชน** · log มีแค่ชื่อ event
และ *ชื่อ* field ของ profile ไม่มีค่า · code ไม่ถูก log หรือสะท้อนกลับ · แลก code ฝั่ง server เท่านั้น (ตรวจ TLS · `redirect: manual` ·
timeout 15 วินาที · ไม่ retry) · rate limit `mjuCallback` 60 ครั้ง/นาที/IP เท่า login (ห้องแล็บออกเน็ต IP เดียว)

**รหัสผ่านของ Core Hub หลังเข้าด้วย MJU SSO** (PM ตัดสิน 28/09/2026 · ไม่มีระบบส่งอีเมล)

- **ตั้งครั้งแรก:** บัญชีที่ยังไม่มีรหัส (สร้างจาก MJU SSO หรือ CSV import) — callback ตอบ `password_set: false` →
  `/auth/mju/signin` พาไป `/account/password/setup?next=<next เดิม>` · ระหว่างยังไม่ตั้ง layout ของพอร์ทัล/backoffice
  พาไปหน้านี้ (อ่าน `hasPassword` จาก `/auth/me` — เป็นแค่ UX ข้ามได้ก็แค่ยังไม่มีรหัส) · ตั้งเสร็จไป `next` หรือหน้าแรกของ role
  โดยไม่ต้อง login ซ้ำ · หน้า setup แสดงอีเมลที่ใช้ login ด้วยรหัสผ่าน (บางบัญชีเป็น `<รหัส>@sso.mju.local`)
- **ลืมรหัส:** ปุ่มบนหน้า login → `/auth/mju/login?next=/account/password/setup?reset=1` → ยืนยันกับ MJU → ตั้งรหัสใหม่
  โดยไม่ต้องรู้รหัสเดิม · ได้เฉพาะ session ที่ `sessions.auth_method = MJU_SSO` และ `created_at` ไม่เกิน **10 นาที**
  (refresh หมุน token บนแถวเดิม `created_at` จึงคือเวลาที่ login) · เกินแล้ว 403 → หน้า setup ให้ยืนยันกับ MJU ใหม่
- วิธี login ไม่อยู่ใน JWT (สัญญาห้ามแก้) — เก็บที่แถว session ซึ่ง token อ้างถึงด้วย `sid`
- **CSV import ไม่ตั้งรหัสเริ่มต้นแล้ว** (`password_hash = null`) และ migration `20261002000001_clear_initial_passwords`
  ล้างรหัส `CSMJU@…` ของบัญชีที่ import ไปแล้ว (id `user-<รหัส>` ที่ผูกกับนักศึกษาในทะเบียน) และยกเลิก session ที่เปิดอยู่ของบัญชีเหล่านั้น
  (session ที่เปิดด้วยการเดา `CSMJU@…` ต้องไม่อยู่รอดไปตั้งรหัสแทนเจ้าของ) · ต้องขึ้นพร้อม `change-password`
- **role ตามทะเบียน:** เปลี่ยน `status` ผ่าน `PATCH /people/:personCode` หรือ CSV import → บัญชีที่เป็น `student`/`alumni`
  อยู่แล้วได้ `GRADUATED` ⇒ `alumni` · `ACTIVE` ⇒ `student` (staff/admin ไม่ถูกแตะ · token ใหม่ได้ role ใหม่ภายใน 15 นาทีตอน refresh)

**ทดสอบบนเครื่องด้วย MJU จำลอง** (clientID จริงผูก callback กับโดเมนที่ลงทะเบียนไว้ — ใช้บนเครื่องไม่ได้):

```bash
node backend/scripts/mju-fake-sso.mjs        # http://127.0.0.1:3510 · ข้อมูล mock เท่านั้น ห้ามใช้ใน production
curl "http://127.0.0.1:3510/next?profile=A"  # เลือกโปรไฟล์ของการ login ครั้งถัดไป (A = นักศึกษา 9900000001, S = บุคลากร)
```

ตั้ง backend `MJU_CLIENT_ID=testclient0000000000000001` · `MJU_SSO_TOKEN_URL=http://127.0.0.1:3510/token.aspx` ·
frontend `MJU_CLIENT_ID` ค่าเดียวกัน · `MJU_SSO_SIGNIN_URL=http://127.0.0.1:3510/signin.aspx` ·
`MJU_SSO_SIGNOUT_URL=http://127.0.0.1:3510/signout.aspx` (frontend ไม่ได้รันที่ `127.0.0.1:3100` → ตั้ง `WEB_ORIGIN` ให้สคริปต์)
แล้วเพิ่มบุคคล mock ที่ `person_code` ตรงกับโปรไฟล์ลงทะเบียนของฐานทดสอบ

**ทดสอบ:** unit `pnpm --filter core-api test -- mju-sso` · ของจริงต้องใช้บัญชี MJU: กดปุ่มที่ `/login` แล้วดู log
`mju_sso.profile_received` · `/login?sso_error=invalid` แปลว่า MJU ส่งกลับมาโดยไม่มี `ac` (callback ที่ลงทะเบียนอาจไม่ตรง)

---

## 6. ฐานข้อมูล

ชื่อตารางและคอลัมน์เป็น **snake_case** ผ่าน `@map` / `@@map` ตามมาตรฐาน

```text
users ──< sessions
  │
  └──> roles ──< role_permissions >── permissions
             
subsystems ──< subsystem_exceptions

users ──< images (uploaded_by_id)      users.profile_image_id ──> images
subsystems ──< images (subsystem_id)
```

| Model | ตาราง | สาระสำคัญ |
|---|---|---|
| `User` | `users` | `id`, `username?`, `email`, `password_hash?` (ว่าง = เข้าได้ทาง MJU SSO เท่านั้น), `mju_subject?`, `role_id` |
| `Session` | `sessions` | `status` (`ACTIVE`/`REVOKED`), `auth_method` (`PASSWORD`/`MJU_SSO` — วิธีที่เปิด session · `created_at` = เวลาที่ login), `expires_at`, hash ของ refresh token |
| `Role` / `Permission` / `RolePermission` | — | RBAC ของ Core Hub |
| `Subsystem` | `subsystems` | `name`, `display_name`, `owner_id`, `repo`, `standards_version`, `default_role_mapping`, `callback_url`, `approval_status`, `status` |
| `SubsystemException` | `subsystem_exceptions` | คำขอสิทธิ์พิเศษรายบุคคล |
| `SubsystemEvent` | `subsystem_events` | ประวัติ: `actor_id`, `action`, `reason?`, `changes?` (`{ field: { from, to } }`) |
| `SubsystemChangeRequest` | `subsystem_change_requests` | คำขอแก้ไขช่องที่ล็อกหลังอนุมัติ: `changes` (ค่าใหม่), `status` (`PENDING`/`APPROVED`/`REJECTED`/`CANCELLED`), `reason?`, `reviewed_by_id?` |
| `UserPermissionGrant` | `user_permission_grants` | สิทธิ์รายบัญชีเพิ่มจาก role: `user_id`, `permission`, `granted_by_id?` (ว่าง = migration ให้) · unique(`user_id`, `permission`) |
| `Image` | `images` | `category`, `subsystem_id?`, `uploaded_by_id`, `mime_type`, `size_bytes`, `width`, `height`, `storage_path`, `thumbnail_path?`, `deleted_at?` — ไฟล์อยู่บนดิสก์ ตารางเก็บแค่ข้อมูลของรูป |

migration อยู่ใน `prisma/migrations/` — **ห้ามลบหรือ squash** และต้องรันบนฐานข้อมูลเปล่าได้เสมอ

---

## 7. ข้อมูล seed

**ผู้ใช้ (สำหรับ development เท่านั้น)**

| email | password | id | username | role |
|---|---|---|---|---|
| `admin@core.local` | `password1` | `user-001` | `admin` | admin |
| `student@core.local` | `password2` | `user-002` | `student` | student |
| `staff@core.local` | `password3` | `user-003` | `staff` | staff |
| `alumni@core.local` | `password4` | `user-004` | `alumni` | alumni |

`username` คือค่าที่ Subsystem Registry ใช้อ้างถึงคน (`owner`, คำขอสิทธิ์พิเศษ)

**สิทธิ์ต่อ role**

| role | permissions |
|---|---|
| `admin` | ทุก permission |
| `staff` (เจ้าหน้าที่ ไม่ใช่อาจารย์) | `user:read` (ดูอย่างเดียว — แก้บัญชีและเปลี่ยน role เป็นของ admin) `system:read` `system:manage` · `subsystem:read:own` `update:own` (ลงทะเบียนใหม่ได้เมื่อ admin ให้ `subsystem:create` รายบัญชี) · `people:read` `people:contact:read` `people:me:read` · `content:read` `create` `update` · `reference:read` · `image:*:own` |
| `lecturer` (อาจารย์) | เหมือน staff **ยกเว้น** `user:read` `system:manage` — ดูข้อมูลบุคคล เขียนประกาศ ดูแลระบบของตัวเอง แต่ไม่จัดการบัญชีและระบบ |
| `student` / `alumni` | `system:read` `content:read` `people:me:read` `reference:read` · `image:*:own` |
| `guest` (ผู้เยี่ยมชม) | `system:read` `content:read` `reference:read` — สร้างโดย admin เท่านั้น |

role ของบุคลากรตามทะเบียน: `STAFF` ที่ `staff_type` = `LECTURER` ได้ `lecturer` ที่เหลือได้ `staff` — ทั้งตอนสร้างบัญชีจาก MJU SSO,
ตอนผูกบัญชีที่หน้าบุคคล และตอน CSV import (แตะเฉพาะบัญชีที่เป็น staff/lecturer อยู่แล้ว) · migration `20261003000000_lecturer_guest_roles`
ย้ายบัญชี staff ที่ผูกกับอาจารย์ในทะเบียนไปเป็น `lecturer` ครั้งเดียว

**Subsystem ที่ลงทะเบียนให้อัตโนมัติ** — เฉพาะเมื่อไม่ใช่ production · `NODE_ENV=production` ไม่สร้างและไม่แก้แถวนี้
(แถวที่ seed รุ่นเก่าสร้างไว้แล้วบน server ให้ปิดใช้งานในหลังบ้าน)

| name | callback_url | สถานะ | role mapping |
|---|---|---|---|
| `student-service` | `http://localhost:3001/auth/callback` | APPROVED + ACTIVE | student→STUDENT · alumni→ALUMNI · staff→STAFF · admin→ADMIN |

---

## 8. การทดสอบ

```bash
npx tsc --noEmit      # ต้องไม่มี output
npm run build         # ต้องสำเร็จ
npm test              # → Tests: 138 passed / Test Suites: 5 passed
```

| ไฟล์ | ครอบคลุม | เคส |
|---|---|---|
| `src/modules/auth/sso.service.spec.ts` | central SSO: callback จาก registry, ปฏิเสธ callback ข้ามโดเมน/มี query แปลก/scheme ผิด, subsystem ไม่ approved/ไม่ active, สิทธิ์เข้าถึงตาม core role, `state`, payload + `kid` | 24 |
| `src/modules/subsystems/subsystems.service.spec.ts` | กฎ `callback_url`: localhost เฉพาะ dev, http สาธารณะถูกปฏิเสธ, production ต้อง https, ตรวจตอน update | 10 |
| `src/modules/subsystems/subsystems.rules.spec.ts` | owner จาก JWT · `:own` ตอบ 403 · ล็อกฟิลด์หลังอนุมัติ · reject/resubmit/suspend + ประวัติ · ลบระบบที่ ACTIVE ไม่ได้ · directory | 21 |
| `src/modules/subsystems/subsystems.permissions.spec.ts` | ตาราง route × role ของ `PermissionsGuard` — ทุก route ต้องประกาศ permission | 82 |
| `src/app.controller.spec.ts` | scaffold เดิม | 1 |

> ⚠️ `npm run test:e2e` **ยังใช้ไม่ได้** — เป็นไฟล์ scaffold เริ่มต้นของ NestJS และติดปัญหา
> `@nestjs/mapped-types` v12 เป็น ESM-only ทำให้ jest แบบ CJS พาร์สไม่ผ่าน

**ทดสอบร่วมกับ subsystem** (ต้องรัน Core Hub + demo พร้อมกัน):

```bash
# จากโฟลเดอร์ csmju2030-subsystem-standard
node conformance/run.js --manifest fixtures/demo-student-subsystem.manifest.json
# → 62 passed · 0 failed  ✅ CONFORMANT

# หรือคู่มือทดสอบสองระบบแบบละเอียด
demo-student-subsystem/docs/TESTING_GUIDE.md
```

---

## 9. ตัวอย่างการใช้งาน

```bash
CORE=http://localhost:3000

# 1) login
TOKEN=$(curl -s -X POST $CORE/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@core.local","password":"password2"}' | jq -r '.data.access_token')

# 2) ตัวตนปัจจุบัน
curl -s $CORE/api/v1/auth/me -H "Authorization: Bearer $TOKEN" | jq .data

# 3) เริ่ม SSO เข้า subsystem (ได้ 302 ไป callback ที่ลงทะเบียนไว้)
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  "$CORE/api/v1/auth/sso/authorize?subsystem=student-service" -H "Authorization: Bearer $TOKEN"

# 4) ลงทะเบียน subsystem ใหม่
curl -s -X POST $CORE/api/v1/subsystems -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{
    "name": "equipment-service",
    "displayName": "ระบบครุภัณฑ์",
    "owner": "admin",
    "repo": "csmju-equipment",
    "standardsVersion": "1.0",
    "defaultRoleMapping": { "admin": "ADMIN", "staff": "STAFF", "student": "USER" },
    "requestedExceptions": [],
    "callbackUrl": "http://localhost:3002/auth/callback"
  }' | jq '.data | {id, name, approvalStatus, status}'
```

---

## 10. ความปลอดภัย

- กุญแจส่วนตัว (`keys/jwt-private.pem`) **ห้ามออกจาก Core Hub** และห้าม commit — subsystem ได้แค่กุญแจสาธารณะผ่าน JWKS
- รหัสผ่านเก็บเป็น bcrypt hash เท่านั้น — เปลี่ยนรหัสแล้วเปลี่ยน hash และเพิกถอนทุก session ในธุรกรรมเดียว
- refresh token เก็บเป็น hash ในตาราง `sessions` และมี **reuse detection** (ถ้าถูกใช้ซ้ำจะเพิกถอน session ทันที)
- ทุก session ตรวจสถานะและวันหมดอายุที่ `JwtStrategy` ทุก request
- ไม่คืน stack trace ออกไปใน response (`HttpExceptionFilter`)
- `callback_url` ต้องตรงกับที่ลงทะเบียนเป๊ะ เพื่อกัน open redirect
- รูปที่อัปโหลดถูกตรวจจาก magic bytes และเข้ารหัสใหม่เป็น WebP ทุกไฟล์ (ไม่รับ SVG · ลบ EXIF) · จำกัดจำนวนพิกเซลตามชนิดไฟล์ (jpg 200 ล้าน · png/webp 40 ล้าน) กัน decompression bomb

---

## 11. ข้อจำกัดที่รู้อยู่แล้ว

| # | เรื่อง | หมายเหตุ |
|---|---|---|
| 1 | `npm run start:prod` ชี้ path ผิด | ใช้ `node dist/src/main.js` |
| 2 | `npm run test:e2e` ใช้ไม่ได้ | scaffold เดิม + `@nestjs/mapped-types` เป็น ESM-only |
| 3 | seed ผ่าน ts-node ไม่ได้ | ใช้ `node dist/prisma/seed.js` |
| 4 | `JWT_SECRET` ไม่ถูกใช้แล้ว | โทเคนเซ็นด้วย RS256 key |
| 5 | `aud` เป็น `csmju2030` ค่าเดียวทุก subsystem | token ที่ออกให้ระบบหนึ่งใช้กับอีกระบบได้ → แผน v1.1 จะผูก `aud` กับชื่อ subsystem |
| 6 | `sso/authorize` รับเฉพาะ Bearer header | เบราว์เซอร์ยัง navigate มาตรง ๆ ไม่ได้ (ต้องมี session cookie) — เป็นงานของ Phase 4 |
| 7 | ยังไม่มี SSO logout | logout ที่ Core Hub แล้ว token ที่ subsystem ถืออยู่ยังใช้ได้จนหมดอายุ |
| 8 | handoff ส่ง token ผ่าน URL query | แผน v2.0 จะเปลี่ยนเป็น authorization code + PKCE |

---

## 12. เอกสารที่เกี่ยวข้อง

| เอกสาร | เนื้อหา |
|---|---|
| `csmju2030-subsystem-standard/STANDARD.md` | มาตรฐานที่ subsystem ทุกตัวต้องทำตาม (v1.0) |
| `csmju2030-subsystem-standard/conformance/` | ชุดทดสอบตัดสินว่า subsystem ผ่านหรือไม่ |
| `demo-student-subsystem/README.md` | reference implementation ที่ผ่าน L3 |
| `demo-student-subsystem/docs/TESTING_GUIDE.md` | คู่มือทดสอบสองระบบร่วมกัน |
