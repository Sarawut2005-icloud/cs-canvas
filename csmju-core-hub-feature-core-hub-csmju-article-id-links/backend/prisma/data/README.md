# ข้อมูลกลาง — reference data และข้อมูลบุคคล

> ⚠️ **ไฟล์ `master-data.sql` มีข้อมูลจริงของนักศึกษาและบุคลากร**
> repo นี้เป็น **private** เพราะไฟล์นี้ — **ห้ามเปลี่ยน repo เป็น public และห้ามคัดลอกไฟล์นี้ไป repo อื่น**
> ห้ามคัดลอกชื่อ รหัส หรืออีเมลจริงไปไว้ใน commit message, PR, log หรือรายงาน
> ข้อมูลบุคคลรอบถัดไปให้เข้าผ่านปุ่ม "นำเข้าข้อมูล CSV" หรือ "เพิ่มนักศึกษา/บุคลากร" ในหน้านักศึกษาและหน้าบุคลากรของ backoffice ไม่ต้องแก้ไฟล์นี้อีก

> 🛑 **โครงสร้างหลักสูตรและแผนการเรียน: หน้าเว็บคือข้อมูลหลัก (PM 5 ต.ค. 2569)**
> ตั้งแต่เปิดให้ admin แก้ในหลังบ้าน (ข้อมูลอ้างอิง → หลักสูตร → แท็บ "โครงสร้างหลักสูตร" / "แผนการศึกษา")
> **ห้ามรันส่วนหลักสูตรของ `master-data.sql` ซ้ำบน server** — คำสั่งเป็น upsert จะทับค่าที่แก้ในหน้าเว็บ
> และใส่รายการที่ลบไปแล้วกลับมา ตารางที่โดน: `curricula` · `curriculum_course_groups` · `curriculum_courses` ·
> `curriculum_plan_slots` · `curriculum_credit_rules` · `curriculum_objectives` · `curriculum_learning_outcomes`
> server ที่มีข้อมูลแล้วห้ามรันทั้งไฟล์ซ้ำ (ไฟล์มีส่วนหลักสูตรอยู่ข้างใน) — ไฟล์นี้ใช้ตั้งฐานใหม่บนเครื่องตัวเองเท่านั้น

สารบัญชุดข้อมูลฉบับทางการที่ระบบย่อยใช้อ้างอิงอยู่ที่ `csmju2030-standards/docs/reference-data.md`
ไฟล์นี้คือวิธีรัน Core Hub พร้อมข้อมูล และรายละเอียดฝั่ง Core Hub

---

## 1. รันบนเครื่องตัวเอง

```bash
cd backend
pnpm install
pnpm prisma migrate deploy
pnpm build                                                 # seed ถูก compile ไปที่ dist/prisma/seed.js
pnpm prisma db seed                                        # role · สิทธิ์ · บัญชีทดสอบ
pnpm prisma db execute --file prisma/data/master-data.sql  # ข้อมูลกลางทั้งหมด
pnpm start:dev
```

- **รันซ้ำได้บนเครื่องตัวเอง:** ทุกคำสั่งเป็น upsert ไม่เกิดข้อมูลซ้ำ · มีฉบับใหม่ให้ `git pull` แล้วรัน 4 บรรทัดหลังอีกครั้ง —
  **แต่ห้ามรัน `master-data.sql` ซ้ำบน server** เพราะจะทับโครงสร้างหลักสูตรที่แก้ในหน้าเว็บ (ดูคำเตือนด้านบน)
- **ไม่แตะการผูกบัญชี:** `people.core_user_id` ที่ผูกไว้แล้วจะคงเดิม
- **เวลาเก็บเป็น UTC** — API ส่ง ISO 8601 ลงท้าย `Z` ระบบย่อยต้องแปลงเป็น `Asia/Bangkok` ตอนแสดงผล ·
  migration `20260929000000_database_timezone_utc` ตั้งเขตเวลาของฐานเป็น UTC ให้
  (แก้ปัญหา `@prisma/adapter-pg` อ่าน `timestamptz` ผิดบน PostgreSQL ของ Windows)
- ฐานที่เคยรันข้อมูลชุดเดิมไว้แล้ว: `migrate deploy` จะรัน `20260930120000_master_data_followup` ให้เอง —
  ลบตาราง `enrollments` · เปลี่ยนสิทธิ์ `master-data:read` เป็น `people:me:read` · เปลี่ยนรหัสภาค `computer-science` เป็น `CS`

### 1.1 บัญชีทดสอบ (ใช้บนเครื่องตัวเองเท่านั้น)

`admin@core.local` · `student@core.local` · `staff@core.local` · `alumni@core.local` — รหัสผ่านอยู่ใน `prisma/seed.ts`

### 1.2 ลองเรียก

```bash
# 1) login — token อยู่ที่ data.access_token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@core.local","password":"<รหัสผ่านใน seed.ts>"}'

# 2) ห้องแล็บทั้งหมด
curl "http://localhost:3000/api/v1/rooms?roomType=LAB" \
  -H "Authorization: Bearer <data.access_token>"
```

---

## 2. ชุดข้อมูลและ endpoint

### 2.1 Reference data — สัญญาเดียวกันทุกชุด (ข้อ 3)

| ชุดข้อมูล | path | ตัวกรองเพิ่ม | endpoint พิเศษ | ตัวอย่าง `code` |
|---|---|---|---|---|
| คณะ | `/api/v1/faculties` | — | — | `SCI` |
| สาขาวิชา | `/api/v1/departments` | `facultyCode` | — | `CS` |
| อาคาร | `/api/v1/buildings` | — | — | — |
| ห้อง | `/api/v1/rooms` | `buildingCode` · `facultyCode` · `roomType` · `floor` | — | `LAB-1` |
| ภาคการศึกษา | `/api/v1/academic-terms` | `academicYear` | `GET /academic-terms/current` (404 ถ้ายังไม่กำหนด) · `GET /academic-terms/:code/events` (ปฏิทิน เรียงตาม `sortOrder`) | `2569-1` |
| รายวิชา | `/api/v1/courses` | `baseCode` · `departmentCode` · `curriculumCode` · `q` (ค้นรหัส/ชื่อ) | `GET /courses/:code` บอกด้วยว่าวิชาอยู่หลักสูตรไหน กลุ่มไหน ปีไหน และวิชาบังคับก่อน | — |
| หลักสูตร | `/api/v1/curricula` | `departmentCode` | `GET /curricula/:code` (ปริญญา ปรัชญา วัตถุประสงค์ PLO เกณฑ์หน่วยกิต) · `GET /curricula/:code/structure` · `GET /curricula/:code/study-plan` | `65304010` |

`roomType`: `LECTURE` · `LAB` · `SEMINAR` · `MEETING` · `PROJECT` · `OFFICE`
รหัสหลักสูตร: `65304010` (หลักสูตร 2565 — รุ่น 67) · `25700131103057` (หลักสูตร 2570 — ใช้รหัส สกอ. ชั่วคราว)

สิทธิ์: อ่านทุกชุด = `reference:read` (ทุก role ที่ login) · สร้าง/แก้ = `reference:manage` (admin)

แก้โครงสร้างและแผนการเรียนของหลักสูตร (`reference:manage` · หน้าหลังบ้านเท่านั้น — token ของระบบย่อยได้ 403):
`GET|POST /curricula/:code/course-groups` · `PATCH|DELETE /curricula/:code/course-groups/:groupId` ·
`GET|POST /curricula/:code/courses` · `PATCH|DELETE /curricula/:code/courses/:courseCode` ·
`PUT|DELETE /curricula/:code/credit-rules/:category` ·
`GET|POST /curricula/:code/plan-slots` · `PATCH|DELETE /curricula/:code/plan-slots/:slotId`
— รายการในโครงสร้างลบได้ (ไม่ใช่ข้อมูลอ้างอิงที่ระบบย่อยเก็บ code) · กลุ่มวิชาที่ยังมีรายวิชาหรือช่องในแผนลบไม่ได้ (409)

### 2.2 ข้อมูลบุคคล — `/api/v1/people` (ไม่ใช่ reference data)

| endpoint | ได้อะไร | สิทธิ์ |
|---|---|---|
| `GET /api/v1/people/me` | ข้อมูลของผู้ใช้ที่ login + อาจารย์ที่ปรึกษา · **ยังไม่ผูกบัญชี = `200` + `data: null`** | `people:me:read` (ทุก role) |
| `GET /api/v1/people` | รายชื่อ · กรองด้วย `personType` · `status` (ค่าเริ่มต้น `ACTIVE`, `ALL` = ทุกสถานะ) · `entryYear` · `departmentCode` · `q` | `people:read` (staff · admin) |
| `GET /api/v1/people/:personCode` | บุคคลเดียว | `people:read` |
| `GET /api/v1/people/:personCode/advisors` | อาจารย์ที่ปรึกษาของนักศึกษา | `people:read` |
| `GET /api/v1/people/:personCode/advisees` | นักศึกษาในที่ปรึกษา (ค่าเริ่มต้นเฉพาะที่ยังศึกษาอยู่ · `status=ALL` ทั้งหมด) | `people:read` |
| `POST /api/v1/people/import` | นำเข้า CSV (`mode: dry-run` / `commit`) — ฟอร์ม "เพิ่มนักศึกษา/บุคลากร" ในหลังบ้านก็ส่งเข้าที่นี่ | `people:manage` (admin) |
| `GET /api/v1/people/export` | รายชื่อตามตัวกรองเดียวกับ list เป็น `text/csv` (รหัส · ชื่อ-สกุล · ปีที่เข้า · หลักสูตร · สถานะ — ไม่มีอีเมล) · ไม่ห่อ envelope | `people:export` (staff · admin) |
| `PATCH /api/v1/people/:personCode` | แก้สถานะ · อีเมล · ผูกบัญชี Core Hub | `people:manage` (admin) |

- แบ่งหน้าแบบเดียวกับ reference data: `page` · `limit` (≤ 100) · `meta` อยู่ชั้นบน
- อีเมลของคนอื่น (`universityEmail`) ส่งเฉพาะผู้เรียกที่มี `people:contact:read` (staff · admin)
- ทุก route ตอบ `Cache-Control: no-store` — **ระบบย่อยห้าม cache ข้อมูลบุคคล** เรียกตรงเฉพาะตอนใช้

---

## 3. สัญญากลาง

### 3.1 รูปแบบคำตอบของ reference data

```json
{
  "success": true,
  "data": [
    { "code": "LAB-1", "nameTh": "ห้องปฏิบัติการคอมพิวเตอร์ 1 (Lab 1)", "isActive": true, "updatedAt": "2026-09-26T08:53:52.136Z" }
  ],
  "meta": { "total": 6, "page": 1, "limit": 20, "totalPages": 1 },
  "requestId": "…",
  "timestamp": "…"
}
```

| กฎ | รายละเอียด |
|---|---|
| query | `page` (เริ่ม 1) · `limit` (ค่าเริ่มต้น 20 สูงสุด 100 — เกินตอบ 400) · `includeInactive=true` |
| รายการ | คืนเฉพาะ `isActive: true` ยกเว้นส่ง `includeInactive=true` |
| รายการเดียว `/:code` | คืนได้แม้ปิดใช้งานแล้ว (ใช้แสดงชื่อในประวัติเก่า) · ไม่พบตอบ 404 |
| `code` | ตัวพิมพ์ใหญ่ ตัวเลข `-` เท่านั้น · **ไม่เปลี่ยนตลอดอายุ** · PATCH แนบ `code` มาตอบ 400 |
| `id` | ไม่ส่งให้ระบบย่อย ใช้ `code` แทนเสมอ |
| วันที่ | `YYYY-MM-DD` เช่น `startDate: "2026-06-29"` |
| วันเวลา | ISO 8601 **UTC ลงท้าย `Z`** เช่น `updatedAt` · `startsAt` |
| cache | header `Cache-Control: private, max-age=300` |
| ลบ | ไม่มี DELETE — ข้อมูลที่เลิกใช้จะถูกปิด (`isActive: false`) |

### 3.2 Error

ทุก error ตอบ `{ "success": false, "error": { "code": "…", "message": "…", "details": [...] } }`

| สถานะ | `error.code` | เมื่อไร |
|---|---|---|
| 400 | `VALIDATION_ERROR` | query/body ผิด เช่น `limit=500` · `roomType=KITCHEN` · PATCH แนบ `code` |
| 401 | `UNAUTHORIZED` | ไม่มี token หรือหมดอายุ |
| 403 | `FORBIDDEN` | role ไม่มีสิทธิ์ เช่น นักศึกษาเรียก `/people` |
| 404 | `NOT_FOUND` | ไม่พบ `code` / `personCode` |
| 409 | `CONFLICT` | สร้างด้วย `code` ที่มีอยู่แล้ว |
| 429 | `TOO_MANY_REQUESTS` | ยิงเกินเพดาน rate limit — รอตาม header `Retry-After` (วินาที) |

---

## 4. ข้อมูลในไฟล์ และสถานะ API

| ชุดข้อมูล | จำนวน | API |
|---|---|---|
| คณะ | 1 | ✅ `/api/v1/faculties` |
| สาขา | 1 | ✅ `/api/v1/departments` |
| อาคาร | 3 | ✅ `/api/v1/buildings` |
| ห้อง | 9 | ✅ `/api/v1/rooms` |
| ภาคการศึกษา + ปฏิทิน | 3 / 76 | ✅ `/api/v1/academic-terms` · `/:code/events` |
| รายวิชา | 253 (เปิดใช้งาน 221) | ✅ `/api/v1/courses` |
| หลักสูตร + กลุ่มวิชา + วิชาในหลักสูตร + ช่องวิชาเลือก + PLO + วัตถุประสงค์ + เกณฑ์หน่วยกิต | 2 / 28 / 182 / 17 / 9 / 8 / 10 | ✅ `/api/v1/curricula` · `/:code/structure` · `/:code/study-plan` |
| บุคคล (นักศึกษารุ่น 67 · อาจารย์ · เจ้าหน้าที่) + อาจารย์ที่ปรึกษา | 135 (120 / 10 / 5) · 120 คู่ | ✅ `/api/v1/people` · `/me` · `/:personCode/advisors` · `/:personCode/advisees` |
| ข่าว (`news_articles`) | 8 | ⬜ ยังไม่มี API |
| โปรเจกต์นักศึกษา (`student_projects*`) | 1 | ⬜ ยังไม่มี API |
| ลิงก์ (`related_links`) | 25 | ⬜ ยังไม่มี API |
| ตัวเลขเด่น / ประวัติสาขา (`department_*`) | 7 / 10 | ⬜ ยังไม่มี API |
| กลุ่มเรียน / ตารางสอน (`course_sections` `section_*`) | 0 | ⬜ ยังไม่มี API · ยังไม่มีข้อมูล |
| จุดสำคัญ (`places`) · สถานประกอบการ (`companies`) | 0 | ⬜ ยังไม่มี API · ยังไม่มีข้อมูล |
| ชั่วโมงกิจกรรม (`activity_*`) · ความสนใจ (`interest_tags` `person_interests`) | 0 | ⬜ ยังไม่มี API · ยังไม่มีข้อมูล |

ไม่มีการลงทะเบียนเรียน (`enrollments`) — เป็นข้อมูลของระบบวิชาการ ไม่ใช่ของ Core Hub (SHARED_DATA ข้อ 2)

ที่มา: เว็บสาขา gates.csmju.com (ดึง 25 ก.ย. 2569) · reg.mju.ac.th · edu.mju.ac.th · รายชื่อนักศึกษาและอาจารย์ที่ปรึกษารุ่น 67

---

## 5. ใช้ในระบบย่อย

ตัวเรียก API ต้นแบบอยู่ใน `demo-student-subsystem` branch `feature/demo/reference-data-client` (`9ebfb5f`) —
**ยังไม่ merge เข้า main ของ demo** · คัดลอกโฟลเดอร์ `backend/src/core-hub/` ทั้งโฟลเดอร์ แล้วแก้ 3 จุด:

| ไฟล์ | เพิ่ม |
|---|---|
| `src/auth/guards/core-hub-jwt.guard.ts` | หลังตรวจ token ผ่าน: `request.coreHubAccessToken = token;` |
| `src/config/configuration.ts` | ใต้ `coreHub`: `dataCacheTtlMs` · `dataMinRefreshIntervalMs` · `dataRequestTimeoutMs` |
| `.env.example` / `.env` | `CORE_HUB_DATA_CACHE_TTL_MS=600000` · `CORE_HUB_DATA_MIN_REFRESH_INTERVAL_MS=30000` · `CORE_HUB_DATA_REQUEST_TIMEOUT_MS=5000` |

แล้ว import `CoreHubModule` ใน module ที่ต้องใช้ · ตัวเรียกจัดการให้แล้ว: cache 10 นาที · คำขอพร้อมกันยิง Core Hub ครั้งเดียว ·
timeout 5 วินาที · Core Hub ล่มใช้ข้อมูลเก่าต่อ (ไม่มีข้อมูลเก่าตอบ 503) · ไม่ log token

```ts
import { Room, AcademicTerm } from '../core-hub/reference-data.types';

const token = request.coreHubAccessToken!;
const labs = await this.refData.list<Room>('rooms', token, (r) => r.roomType === 'LAB');
const current = (await this.refData.list<AcademicTerm>('academic-terms', token)).find((t) => t.isCurrent);
await this.refData.assertActive('rooms', dto.roomCode, token);   // code ต้องมีจริงและเปิดใช้งาน ไม่งั้น 400
const room = await this.refData.get<Room>('rooms', booking.roomCode, token);
const roomName = room?.nameTh ?? booking.roomCode;               // คืนได้แม้ห้องถูกปิดไปแล้ว
```

ข้อมูลบุคคลไม่อยู่ในตัวเรียกกลาง ให้เรียก `fetch` พร้อม `Authorization: Bearer <token>` ตรง ๆ และ**ไม่ cache**

**เก็บอะไรในฐานข้อมูลของตัวเอง:** เก็บแค่ `code` (เช่น `roomCode` · `termCode`) ไม่เก็บชื่อ — ชื่อเปลี่ยนได้ ให้ดึงตอนแสดงผล

**แสดงเวลาเป็นเวลาไทย:** `new Date(event.startsAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })`

---

## 6. ผูกบัญชี Core Hub กับบุคคล (สำหรับ `/people/me`)

`GET /api/v1/people/me` คืน `data: null` จนกว่าบุคคลนั้นจะผูกกับบัญชี Core Hub

- **ทางหลัก:** admin ผูกในหน้า backoffice "ข้อมูลกลาง" (`PATCH /api/v1/people/:personCode` ด้วย `coreUserEmail`)
- **ช่วงพัฒนาบนเครื่องตัวเอง** ผูกด้วย SQL ได้:

```sql
UPDATE people
SET core_user_id = (SELECT id FROM users WHERE email = '<อีเมลของคุณ>')
WHERE person_code = '<รหัสของคุณ>';
```

อย่าผูกบัญชีทดสอบใน `seed.ts` (รหัสผ่านอยู่ในโค้ด) กับบุคคลจริง

---

## 7. ทำ / ห้ามทำ (สำหรับระบบย่อย)

| ✅ ทำ | ❌ ห้ามทำ |
|---|---|
| ดึงข้อมูลกลางผ่าน API ของ Core Hub | ต่อฐานข้อมูลของ Core Hub ตรง (CI ตรวจ Database Isolation) |
| เก็บแค่ `code` ในตารางของตัวเอง | สร้างตาราง `faculties` `rooms` `terms` `students` ของตัวเองซ้ำ |
| ใช้ตัวเรียก API จาก demo (มี cache) | ยิง Core Hub ทุกคำขอโดยไม่มี cache |
| ตรวจ `code` ด้วย `assertActive` ก่อนบันทึก | hardcode รายชื่อคณะ/ห้อง/ภาคไว้ในโค้ด |
| เก็บข้อมูลเฉพาะระบบเอง เช่น ห้องไหนเปิดให้จอง รายการจอง | คัดลอกชื่อ อีเมล หรือข้อมูลบุคคลไปเก็บถาวร |
| แปลงเวลาเป็น `Asia/Bangkok` ตอนแสดงผล | log access token หรือ header `Authorization` |

---

## 8. แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `401` ทุกคำขอ | token หมดอายุ (15 นาที) — login ใหม่ |
| `403` ที่ `/people` | role ไม่มีสิทธิ์ `people:read` — ใช้บัญชี staff หรือ admin |
| `/people/me` ได้ `data: null` | บัญชียังไม่ผูกกับบุคคล — ดูข้อ 6 |
| `404` ที่ `/api/v1/master-data/...` | endpoint ชุดเดิมถูกลบแล้ว — ใช้ path ในข้อ 2 |
| `pnpm prisma db seed` บอกว่าไม่พบไฟล์ | ยังไม่ได้ `pnpm build` (seed รันจาก `dist/`) |
| เวลาคลาด 7 ชั่วโมง | ยังไม่ได้รัน migration timezone หรือยังไม่ restart Core Hub หลัง migrate |
| ได้ข้อมูลว่าง | ยังไม่ได้รัน `prisma db execute --file prisma/data/master-data.sql` |
| ระบบย่อยได้ `503` | Core Hub ปิดอยู่และยังไม่เคยดึงข้อมูลสำเร็จ — เปิด Core Hub แล้วลองใหม่ |
| ได้ `429` | ยิงเกินเพดาน — รอตาม `Retry-After` · ใช้ cache ของตัวเรียก API |
| รหัสคณะเป็น `science` | ฐานเก่าก่อน migration `20260928000000_reference_data` — รัน `migrate deploy` (รหัสใหม่คือ `SCI`) |
| รหัสภาคเป็น `computer-science` | ฐานเก่าก่อน migration `20260930120000_master_data_followup` — รัน `migrate deploy` (รหัสใหม่คือ `CS`) |
| ห้อง `CLASSROOM` หายไป | เปลี่ยนเป็น `LECTURE` ตามสเปก |
