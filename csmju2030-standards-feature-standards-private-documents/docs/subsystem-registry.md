# Subsystem Registry

**เวอร์ชัน 1.1** (standards 1.7.0) · ทะเบียนระบบย่อยที่ Core Hub ดูแล

ระบบย่อยจะทำ SSO ได้ก็ต่อเมื่อ **ลงทะเบียนแล้ว + อนุมัติแล้ว + เปิดใช้งานแล้ว** เท่านั้น
ขั้นตอนทีละขั้นกับ server จริง (`https://csmju2030.jowave.com`) ดู [`connect-core-hub.md`](connect-core-hub.md)

---

## 1. ใครทำอะไร

| งาน | ใคร | สิทธิ์ใน Core Hub |
|---|---|---|
| ลงทะเบียน · แก้ข้อมูลระบบของตัวเองก่อนอนุมัติ · ยื่นสิทธิ์พิเศษ · ส่งคำขออีกครั้งหลังถูกปฏิเสธ | **เจ้าของระบบ** — บัญชี role `staff` หรือ `lecturer` · ทีม AIE ใช้บัญชีเจ้าของระบบ (role staff) ที่ผู้ดูแล dev server ส่งให้ | `subsystem:create` · `subsystem:read:own` · `subsystem:update:own` |
| อนุมัติ / ปฏิเสธ ทั้งคำขอลงทะเบียนและสิทธิ์พิเศษ | admin ระบบกลาง | `subsystem:review` |
| เปิดใช้ · ปิดใช้ · ระงับ | admin ระบบกลาง | `subsystem:operate` |
| ลบทะเบียน | admin ระบบกลาง | `subsystem:delete` |
| แก้ `name` · `callbackUrl` · `baseUrl` · role mapping **หลังอนุมัติแล้ว** | admin ระบบกลางเท่านั้น (เจ้าของขอผ่าน PL) | `subsystem:update:any` |

- **นักศึกษา (role `student`) ลงทะเบียนไม่ได้และเข้าหลังบ้านไม่ได้**
- ผู้ลงทะเบียนเป็นเจ้าของระบบโดยอัตโนมัติ — **ไม่ต้องส่ง `owner`** (ระบุคนอื่นเป็นเจ้าของได้เฉพาะ admin ไม่งั้นได้ 403)

---

## 2. ลงทะเบียน

ทางหลักคือหลังบ้านของ Core Hub: `/backoffice/subsystems/new` (login ด้วยบัญชีเจ้าของระบบ) → ส่งคำขอ → รอ admin อนุมัติ

| ช่องในฟอร์ม | field ของ API | กฎ |
|---|---|---|
| ชื่อระบบ | `name` | `^[a-z0-9]+(-[a-z0-9]+)*$` ยาว 1–64 ตัว เช่น `csmju-equipment` · ห้ามเป็น `csmju` เฉย ๆ (ชนกับคุกกี้ของ Core Hub) · ต้องตรงกับ `name` ใน `subsystem.yaml` · `SUBSYSTEM_ID` ของ backend และ frontend · `data.service` ของ `/api/health` |
| ชื่อที่แสดง | `displayName` | ชื่อที่ผู้ใช้เห็นในเมนูพอร์ทัล |
| Repository | `repo` | เช่น `github.com/CSMJU2030/csmju-equipment` |
| Standards version | `standardsVersion` | หลังบ้านมีตัวเลือกเดียวคือ `1.0` — เป็นข้อมูลประกอบ ไม่มีใครอ่าน · เวอร์ชันจริงอยู่ที่ `.standards-version` ของ repo |
| Callback URL | `callbackUrl` | ข้อ 4 |
| Base URL | `baseUrl` (ไม่บังคับ) | ข้อ 6 · **ระหว่างรันบน localhost ให้เว้นว่าง** |
| บทบาท | `defaultRoleMapping` | ข้อ 3 |
| คำขอสิทธิ์พิเศษ | `requestedExceptions` (ไม่บังคับ) | ข้อ 7 |

ชื่อระบบที่มีขีดติดกัน (`a--b`) หรือลงท้ายด้วยขีด (`x-`) Core Hub ยังรับตอนลงทะเบียน แต่หน้า `/sso/authorize` ไม่รับ
ระบบนั้นจะ login ไม่ได้เลย — ใช้กฎในตารางเสมอ

ทางเดียวกันผ่าน API (สำหรับสคริปต์):

```bash
POST {CORE_HUB_URL}/api/v1/subsystems      # Bearer ของบัญชีเจ้าของระบบ
Content-Type: application/json

{
  "name": "csmju-equipment",
  "displayName": "ระบบครุภัณฑ์",
  "repo": "github.com/CSMJU2030/csmju-equipment",
  "standardsVersion": "1.0",
  "defaultRoleMapping": { "student": "STUDENT", "staff": "STAFF", "lecturer": "STAFF" },
  "callbackUrl": "http://localhost:3205/auth/callback"
}
```

---

## 3. Role mapping

- **key คือรายชื่อ core role ที่เข้าระบบนี้ได้** — เขียนเป็นตัวพิมพ์เล็กตรงตัว: `student` · `alumni` · `staff` · `lecturer` · `guest` · `admin`
  role ที่ไม่อยู่ใน key Core Hub ตอบ 403 ตั้งแต่ก่อนออก token และไม่แสดงระบบนี้ในเมนูพอร์ทัลของคนนั้น
- ต้องมีอย่างน้อย 1 key — mapping ว่าง `{}` ตอนนี้ SSO ไม่กั้นใครเลยแต่เมนูพอร์ทัลกลับไม่แสดงให้ใคร (Core Hub จะเปลี่ยนเป็นปฏิเสธ)
- **value เป็นเอกสารเท่านั้น** — Core Hub ไม่ส่ง value ไปใน token · token มีแค่ `role` แล้วระบบย่อยแมปเองในโค้ด
  ([`authorization.md`](authorization.md) ข้อ 3) โดยต้องแมปตรงกับที่ลงทะเบียน

---

## 4. กฎของ `callback_url`

| กฎ | รายละเอียด |
|---|---|
| ต้องเป็น absolute URL | มี scheme เสมอ |
| ต้องเป็น `https` | ยกเว้น `http://localhost` · `127.0.0.1` เมื่อ Core Hub ไม่ใช่ production **หรือ**เปิดโหมดก่อนเปิดใช้ (`ALLOW_LOCALHOST_CALLBACKS=true`) — server จริงเปิดโหมดนี้อยู่ |
| ใช้พอร์ตของ **frontend** | ระบบย่อยใช้ frontend เป็นประตูเดียว (พอร์ต 32xx) แล้ว proxy `/auth/*` ไป backend (42xx) — ลงทะเบียนพอร์ต backend แล้วหลัง login จะเจอหน้า `Cannot GET /` |
| ต้องตรงกับ URL จริงของระบบย่อย | conformance `L3-04` ตรวจข้อนี้ · เปิดแอปด้วย host เดียวกับที่ลงทะเบียน (`localhost` ≠ `127.0.0.1` สำหรับคุกกี้) |
| path มาตรฐาน | `/auth/callback` (นอก prefix `/api`) |
| ถ้า client ส่ง `callback_url` มาด้วย | ต้องตรงกับที่ลงทะเบียน ไม่งั้น `400` |
| ห้าม | ยอมรับ callback ที่ client กำหนดเอง (open redirect) |

`callback_url` เป็นค่าเดียวที่ต้องลงทะเบียน ส่วน `/auth/login` และ `/auth/logout` มาตรฐานกำหนด path ไว้แล้ว
([auth-contract](auth-contract.md) ข้อ 5) · **ห้ามลงทะเบียน `/auth/login` เป็น `callback_url`** — มันส่งเบราว์เซอร์กลับไป Core Hub ทำให้วนไม่จบ

**ตอนเปิดใช้จริง** server จะปิดโหมดก่อนเปิดใช้ callback ที่เป็น `http` ทุกตัวจะเข้าไม่ได้ทันที
(ผู้ใช้เห็น "ระบบนี้ยังไม่เปิดให้ใช้งาน") — ระบบที่ deploy แล้วต้องให้ admin เปลี่ยน callback เป็น `https` ของ host จริงก่อนวันนั้น

Core Hub ตรวจตามลำดับนี้ก่อนออก token ([auth-contract](auth-contract.md) ข้อ 5.3 บอกว่าผู้ใช้เห็นอะไร):

```text
subsystem มีจริง (404) → APPROVED (409) → ACTIVE (409)
   → role ของผู้ใช้เป็น key ใน role mapping (403) → callback ถูกต้องตามกฎ (400 / 409) → 302
```

---

## 5. วงจรชีวิต

```text
ยื่นคำขอ ─────────────► approvalStatus=PENDING  · status=INACTIVE
PENDING  ─ approve ───► APPROVED   (หลังบ้านติ๊ก "เปิดใช้งานทันทีหลังอนุมัติ" ได้)
PENDING  ─ reject ────► REJECTED   (ต้องมีเหตุผล · เจ้าของเห็นเหตุผล)
REJECTED ─ resubmit ──► PENDING    (เจ้าของแก้แล้วส่งใหม่)
APPROVED + INACTIVE/SUSPENDED ─ activate ─► ACTIVE   ← SSO ใช้ได้เมื่อถึงขั้นนี้
ACTIVE   ─ deactivate ► INACTIVE   (เหตุผลไม่บังคับ)
ACTIVE   ─ suspend ───► SUSPENDED  (ต้องมีเหตุผล)
```

Core Hub ทำ SSO ให้เฉพาะ `approvalStatus = APPROVED` **และ** `status = ACTIVE` · สถานะอื่นตอบ `409`
การอนุมัติย้อนกลับไม่ได้ และลบทะเบียนได้เฉพาะตอนที่ไม่ ACTIVE

| Method & path | ใคร | body |
|---|---|---|
| `POST /api/v1/subsystems/:id/approve` | admin | — |
| `POST /api/v1/subsystems/:id/reject` | admin | `{ "reason": "..." }` |
| `POST /api/v1/subsystems/:id/resubmit` | เจ้าของ | — |
| `POST /api/v1/subsystems/:id/activate` | admin | — |
| `POST /api/v1/subsystems/:id/deactivate` | admin | `{ "reason": "..." }` (ไม่บังคับ) |
| `POST /api/v1/subsystems/:id/suspend` | admin | `{ "reason": "..." }` |
| `DELETE /api/v1/subsystems/:id` | admin | — |

---

## 6. ดูทะเบียนและหน้า Monitor

| Method & path | ใช้ทำอะไร |
|---|---|
| `GET /api/v1/subsystems` | รายการแบบแบ่งหน้า · เจ้าของเห็นเฉพาะระบบของตัวเอง admin เห็นทั้งหมด · กรองด้วย `approvalStatus` `status` `q` |
| `GET /api/v1/subsystems/all` | รายการทั้งหมด (admin) |
| `GET /api/v1/subsystems/:id` | รายตัว |
| `PATCH /api/v1/subsystems/:id` | แก้ข้อมูล — หลังอนุมัติ `name` `callbackUrl` `baseUrl` role mapping แก้ได้เฉพาะ admin |
| `GET` / `PATCH /api/v1/subsystems/:id/role-mapping` | ดู/แก้ role mapping |
| `GET /api/v1/subsystems/:id/health` | ผลตรวจล่าสุดของหน้า Monitor |

**หน้า Monitor** ให้ **server ของ Core Hub** เรียก `<baseUrl>/api/health` (timeout 3 วินาที)

| ผล | เมื่อ |
|---|---|
| `UP` | ได้ HTTP 200 และมี `data.service` เป็น string (ชื่อไม่ตรงทะเบียนเป็นแค่คำเตือน) |
| `DOWN` | ต่อไม่ได้ · เกินเวลา · ไม่ใช่ 200 · ได้ redirect · ไม่มี `service` |
| `NO_BASE_URL` | ไม่ได้ใส่ Base URL |

`baseUrl` ที่เป็น `localhost` จะขึ้น `DOWN` เสมอ เพราะ server เรียกเครื่องของตัวเอง ไม่ใช่เครื่องของทีม —
ใส่ Base URL เมื่อระบบขึ้น host จริงแล้วเท่านั้น

---

## 7. Subsystem Exception (สิทธิ์พิเศษรายบุคคล)

ใช้เมื่อผู้ใช้บางคนต้องมี role ในระบบนี้ต่างจาก core role ของเขา เช่น นักศึกษาที่เป็นผู้ช่วยแล็บต้องได้ `staff` ในระบบครุภัณฑ์

```bash
POST /api/v1/subsystems/:id/exceptions      { "username": "...", "role": "staff", "reason": "..." }   # เจ้าของระบบ
GET  /api/v1/subsystems/:id/exceptions
POST /api/v1/subsystems/:id/exceptions/:exceptionId/approve   # หรือ /reject — admin
```

- `username` คือ username ใน Core Hub (บัญชี MJU SSO ใช้รหัสนักศึกษาหรือรหัสบุคลากร)
- `role` ต้องเป็น 1 ใน 6 core role และเป็น key ใน role mapping ของระบบนี้
- ยื่นได้จากหน้ารายละเอียดของระบบในหลังบ้าน หรือพร้อมคำขอลงทะเบียน
- **ผลเมื่ออนุมัติ:** Core Hub ใส่ role ของสิทธิ์พิเศษเป็น `role` ใน token ที่ออกให้ระบบนี้
  ([auth-contract](auth-contract.md) ข้อ 3) และแสดงระบบนี้ในเมนูพอร์ทัลของคนนั้น —
  ระบบย่อยแมป role ด้วยโค้ดเดิม ไม่ต้องแก้ · ระบบอื่นและสิทธิ์ใน Core Hub ของคนนั้นไม่เปลี่ยน
- **สถานะตอนนี้:** Core Hub บันทึกคำขอและผลอนุมัติได้แล้ว แต่ยังไม่ใส่ role ลงใน token — จะมีผลเมื่อ Core Hub
  ขึ้นงานแยก token ของระบบย่อย (CHANGELOG ของ standards จะแจ้ง) · ระหว่างนี้**ห้าม**ฮาร์ดโค้ดรายชื่อผู้ใช้ในโค้ดของระบบย่อยแทน

---

## 8. `subsystem.yaml` ใน repo ของระบบย่อย

ประกาศค่าเดียวกับทะเบียน (`name` · callback) ไว้ที่รากของ repo — CI และ conformance อ่านไฟล์นี้
ตัวอย่างเต็มอยู่ที่ [`../templates/subsystem.yaml`](../templates/subsystem.yaml) · schema:
[`../schemas/subsystem.schema.json`](../schemas/subsystem.schema.json)

```yaml
name: csmju-equipment
conformance_level: L3                          # เวอร์ชัน standards อยู่ใน .standards-version

base_url: http://localhost:3205                # frontend ของระบบย่อย (พอร์ต 32xx)
core_hub_url: https://csmju2030.jowave.com     # API ของ Core Hub (server จริง)
core_hub_web_url: https://csmju2030.jowave.com # เว็บของ Core Hub ที่ /auth/login ส่งเบราว์เซอร์ไป
callback_path: /auth/callback

public_endpoints:
  - GET /api/health
  - GET /auth/login
  - GET /auth/callback
  - POST /auth/logout
```

**ห้ามใส่บัญชีหรือรหัสผ่านใดๆ ในไฟล์นี้** — conformance อ่านบัญชีจากไฟล์นอก repo ([`conformance.md`](conformance.md))
