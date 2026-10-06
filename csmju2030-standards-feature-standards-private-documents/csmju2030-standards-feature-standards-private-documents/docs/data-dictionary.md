# CSMJU2030 — Data Dictionary & Schemas

**เวอร์ชัน 1.1** (มาตรฐาน 1.7.0) · ขอบเขต: ชื่อและชนิดข้อมูล**ฝั่งระบบย่อย** ·
ข้อมูลที่ Core Hub ส่งให้ (endpoint · field · สิทธิ์ · cache) อยู่ใน [`reference-data.md`](reference-data.md) ที่เดียว ·
ประวัติการเปลี่ยนแปลงอยู่ใน [`../CHANGELOG.md`](../CHANGELOG.md)

## 1. ข้อมูลที่มาจาก Core Hub

### 1.1 ใน access token (ใช้ได้ทันที)

| claim | ชื่อในระบบย่อย (DB / TS) | ความหมาย |
|---|---|---|
| `sub` | `core_user_id` / `coreUserId` | **Global Identity** — id ผู้ใช้ของ Core Hub · string ทึบยาวไม่เกิน 64 **ไม่ใช่ UUID เสมอไป** (นักศึกษาที่นำเข้าจาก CSV เป็น `user-<รหัสนักศึกษา>`) |
| `email` | — | แสดงผลเท่านั้น **ห้ามใช้เป็นกุญแจ** (อาจเป็น `<รหัส>@sso.mju.local` และเปลี่ยนได้) |
| `role` | `coreRole` (ตัวแปรในโค้ด) | core role 6 ค่า (ข้อ 4) — role ของผู้ใช้สำหรับระบบนี้ อ่านจาก token ทุก request **ไม่เก็บ** |
| `sid` | — | session id ของ Core Hub — **ห้ามเก็บ** |

claim ทั้งหมดและการตรวจ token อยู่ใน [`auth-contract.md`](auth-contract.md) ข้อ 3–4 และ [`../contracts/jwt-contract.json`](../contracts/jwt-contract.json)

### 1.2 สิ่งที่ไม่อยู่ใน token

```text
ชื่อ · รหัสนักศึกษา · username · faculty · department · สถานะนักศึกษา
```

ข้อมูลเหล่านี้ Core Hub มีและเปิดผ่าน API (`/people/me` · `/people/:personCode` · ข้อมูลอ้างอิง 7 ชุด) —
**ห้ามคาดหวังจาก token และห้ามเก็บสำเนาไว้เอง** ดูว่าเรียกอะไรได้และเก็บอะไรได้ใน [`reference-data.md`](reference-data.md) ข้อ 2 และ 8

## 2. Core Rules

- ใช้ชื่อ field ตามมาตรฐานนี้
- Shared Data มี Source of Truth เดียวคือ Core Hub — ระบบย่อยอ่านผ่าน API เท่านั้น ห้ามต่อฐานของ Core Hub (`ARC-01`)
- Subsystem ห้ามแก้ข้อมูลที่ Core เป็นเจ้าของ
- Local Data อยู่ใน Schema ของ Subsystem
- ห้ามสร้าง field ซ้ำความหมายกับ Shared Data — อ้างถึงด้วย `core_user_id` · `person_code` · `code` เท่านั้น
- Shared Contract เปลี่ยนได้ผ่าน Change Process เท่านั้น
- Breaking Change → Major Version

## 3. Identity และ code ที่ระบบย่อยเก็บได้

ระบบย่อย **ห้าม**สร้างตาราง user หรือตารางบุคคลของตัวเองที่ซ้ำกับ Core Hub และ **ห้าม**เก็บรหัสผ่าน
ให้เก็บเพียงค่าอ้างอิงในตารางธุรกิจของตัวเอง (ตาราง เก็บ / ห้ามเก็บ ฉบับเต็มอยู่ใน [`reference-data.md`](reference-data.md) ข้อ 8):

```yaml
CoreIdentityReference:        # คอลัมน์ในตารางธุรกิจของระบบย่อย
  core_user_id:
    type: text                # ยาวไม่เกิน 64 · ไม่ใช่ UUID — ห้าม parse หรือ validate เป็น UUID
    unique: false             # ทำ index · ผู้ใช้หนึ่งคนมีได้หลายแถว
    source: Core (JWT claim `sub`)
    writable: false           # ระบบย่อยห้ามแก้ค่านี้เอง
    personal_data: true
  person_code:
    type: text
    required: false           # /people/me ได้ null เมื่อบัญชีไม่ผูกกับบุคคล
    source: Core (GET /api/v1/people/me → personCode ตอนเกิดรายการ)
    writable: false

ReferenceCode:                # <ชุด>_code เช่น room_code · faculty_code · term_code · course_code
  type: text
  source: Core (code ของข้อมูลอ้างอิง)
  writable: false
  rule: เก็บ code อย่างเดียว — ไม่เก็บชื่อ ไม่เก็บ id · รายวิชาใช้ code เต็มรวมรุ่น ไม่ใช่ baseCode

CoreImageReference:
  image_id:
    type: text                # id ของรูปจาก POST /api/v1/images
    source: Core
```

```prisma
model BorrowRecord {
  id         String   @id @default(uuid())
  coreUserId String   @map("core_user_id")   // ค่า sub จาก token — ไม่ unique
  personCode String?  @map("person_code")    // จาก /people/me ตอนยืม
  roomCode   String   @map("room_code")      // code ของ Core Hub
  // ...ข้อมูลธุรกิจของระบบย่อยเอง
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt      @map("updated_at")

  @@index([coreUserId])
  @@map("borrow_records")
}
```

**ห้าม hardcode รายการข้อมูลอ้างอิง** (รายชื่อคณะ ห้อง ภาคการศึกษา ฯลฯ) ในโค้ด — เรียก `GET /api/v1/faculties`
และชุดอื่นตาม [`reference-data.md`](reference-data.md) (กฎ `DD-04`)

## 4. Role Schema

```yaml
CoreRole:                    # claim `role` ใน access token (Layer 1)
  type: enum
  source: Core Hub
  values: [student, alumni, staff, lecturer, guest, admin]

SubsystemRole:               # role ภายในระบบย่อย (Layer 2) — แต่ละระบบตั้งเอง
  type: string
  scope: subsystem
  example: [STUDENT, ALUMNI, STAFF, LECTURER, ADMIN, USER]

RoleMapping:                 # ประกาศทั้งใน Registry (default_role_mapping) และในโค้ดระบบย่อย
  core_role: CoreRole
  subsystem_role: SubsystemRole

RoleException:               # ขอผ่าน backoffice ของ Core Hub เท่านั้น ห้าม hardcode รายชื่อผู้ใช้
  username: string           # field ของคำขอใน Core Hub (ไม่ใช่คอลัมน์ของระบบย่อย)
  subsystem_role: SubsystemRole
  approval_required: true
```

> key ของ `default_role_mapping` ในทะเบียน = รายชื่อ core role ที่เข้าระบบนั้นได้
> Core Hub ใช้ตรวจตั้งแต่ก่อน redirect (ดู [`authorization.md`](authorization.md) ข้อ 3) ·
> สิทธิ์พิเศษที่อนุมัติแล้วจะมาทาง claim `role` ของ token เมื่องานฝั่ง Core Hub ขึ้นระบบ
> ([`subsystem-registry.md`](subsystem-registry.md) ข้อ 5) — ระบบย่อยแปลง `role` ด้วยโค้ดเดิม ไม่ต้องแก้

## 5. รูปแบบข้อมูลกลาง (Common Schema)

```yaml
Date:
  format: YYYY-MM-DD

DateTime:
  format: ISO 8601
  timezone: required         # ส่งออกเป็น UTC ลงท้าย Z

Year:
  calendar: พุทธศักราช        # เช่น academicYear · entryYear · code ภาค 2569-1

Money:
  type: integer
  unit: satang
  float: forbidden

Phone:
  type: string
  format: no-hyphen

Boolean:
  values: [true, false]

Visibility:
  values: [public, internal, private]
```

## 6. ข้อมูลของ Core Hub (คณะ · สาขา · อาคาร · ห้อง · ภาค · รายวิชา · หลักสูตร · บุคคล · รูป)

ระบบย่อย**ไม่มีตาราง**ของข้อมูลเหล่านี้ — endpoint · field (camelCase) · enum · สิทธิ์ · cache อยู่ใน
[`reference-data.md`](reference-data.md) ที่เดียว · ทุกแถวของข้อมูลอ้างอิงมี `code` · `isActive` · `updatedAt` และไม่มี `id`
(ตัวอย่างเป็น JSON Schema: [`../schemas/department.schema.json`](../schemas/department.schema.json))

## 7. Subsystem Schema

ทะเบียนระบบย่อย (field · การอนุมัติ · สถานะ · role mapping) อยู่ใน [`subsystem-registry.md`](subsystem-registry.md)
และ `subsystem.yaml` ตรวจด้วย [`../schemas/subsystem.schema.json`](../schemas/subsystem.schema.json) — เอกสารนี้ไม่ทำซ้ำ

```yaml
approval_status: [PENDING, APPROVED, REJECTED]
status: [INACTIVE, ACTIVE, SUSPENDED]      # SSO ได้เมื่อ APPROVED + ACTIVE
name: ^[a-z0-9]+(-[a-z0-9]+)*$            # 1–64 ตัว · ตรงกับ subsystem.yaml และ SUBSYSTEM_ID
```

## 8. Table / Schema Boundary

```text
Core Hub  (อ่านผ่าน API เท่านั้น — reference-data.md)
├── บัญชีผู้ใช้ · บุคคล         → ระบบย่อยเก็บแค่ core_user_id · person_code
├── ข้อมูลอ้างอิง 7 ชุด         → เก็บแค่ code
└── รูปภาพ                    → เก็บแค่ id

Subsystem  (ฐานของตัวเอง <subsystem>_db)
└── local tables / schemas ที่อ้างถึงค่าข้างบน
```

ตัวอย่าง Local Data:

```text
equipment_id
serial_number
purchase_date
```

Local Data ไม่ต้องเพิ่มใน Data Dictionary กลาง เว้นแต่มีความจำเป็นต้องใช้ร่วมกันหลาย Subsystem

## 9. Naming

### 9.1 กฎรวม

```text
ตาราง           : plural snake_case      (students, borrow_records)
คอลัมน์          : snake_case             (student_code, created_at)
field ใน Prisma  : camelCase              (studentCode, createdAt)
field ใน JSON    : camelCase              (studentCode, createdAt)
enum ใน Prisma   : PascalCase  ค่า UPPER_SNAKE_CASE   (enum BorrowStatus { BORROWED })
boolean          : ขึ้นต้น is_ หรือ has_  (is_active, has_returned)
primary key      : id (UUID v4) — ของตารางตัวเอง
foreign key      : <entity>_id            (student_id, course_id)
อ้างข้อมูลกลาง     : core_user_id · person_code · <ชุด>_code (room_code) · image_id
timestamp        : created_at, updated_at (ทุกตาราง)
ชื่อ database    : <subsystem>_db
date             : YYYY-MM-DD
datetime         : ISO 8601 UTC ลงท้าย Z
```

ฐานข้อมูลเป็น `snake_case` ส่วนโค้ดเป็น `camelCase` — เชื่อมกันด้วย `@map` / `@@map`
ไม่ใช่การตั้งชื่อสองแบบมั่ว ๆ แต่เป็นการแยกชั้น **DB ↔ application** อย่างตั้งใจ

```prisma
model Enrollment {
  id         String   @id @default(uuid())
  coreUserId String   @map("core_user_id")   // ไม่ unique
  personCode String?  @map("person_code")
  courseCode String   @map("course_code")    // code เต็มรวมรุ่น เช่น 10301111-1
  termCode   String   @map("term_code")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt      @map("updated_at")

  @@index([coreUserId])
  @@map("enrollments")
}
```

### 9.2 ห้ามสร้าง alias ของ Global Identity

Global Identity คือค่า `sub` จาก token · ในระบบย่อยต้องตั้งชื่อว่า **`core_user_id` / `coreUserId`** เท่านั้น
ชื่อต่อไปนี้ห้ามใช้เรียกค่านี้ (กฎ `DD-01`):

```text
user_id · userId · user_code · userCode · std_id · stdId · username
```

> หมายเหตุ: รหัสนักศึกษา/บุคลากรที่อ่านจาก `/people/me` ให้ตั้งชื่อ **`person_code` / `personCode`** (ตรงกับ field ของ Core Hub)
> ชื่ออย่าง `student_code` · `studentId` ไม่ผิดกฎ `DD-01` แต่ห้ามใช้แทน `core_user_id`
> เพราะ Global Identity ในสถาปัตยกรรมนี้คือ `sub` ไม่ใช่รหัสนักศึกษา

### 9.3 Migration

- ใช้ Prisma Migrate และ commit `prisma/migrations/` เข้า git
- **ห้าม**ลบหรือ squash migration เดิม — ประวัติต้องรันบนฐานข้อมูลเปล่าได้เสมอ
- เปลี่ยนชื่อคอลัมน์ **ต้อง**เขียน `ALTER TABLE … RENAME COLUMN` เอง พร้อม rename index/constraint
  เพราะ `prisma migrate dev` จะสร้างเป็น drop + add ซึ่งทำให้ **ข้อมูลหาย**
- หลังแก้ schema ต้องตรวจว่าไม่มี drift:

```bash
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
# ต้องได้: No difference detected.
```

## 10. Source of Truth

```text
Core
 ↓
API / Service Contract   (reference-data.md)
 ↓
Subsystem
```

| Data | Source of Truth | Subsystem เก็บ | Subsystem Write |
|---|---|---|---|
| User Identity (`sub`) | Core | `core_user_id` | No |
| รหัสบุคคล | Core (`/people/me`) | `person_code` | No |
| ชื่อ · อีเมล · คณะ/สาขาของบุคคล | Core (`/people`) | ไม่เก็บ — ดูตอนแสดงผล | No |
| ข้อมูลอ้างอิง (คณะ ห้อง ภาค ...) | Core | `code` เท่านั้น | No |
| Layer 1 Role | Core | ไม่เก็บ — อ่านจาก token | No |
| Layer 2 Role | Subsystem | ✓ | Yes |
| ข้อมูลธุรกิจของระบบ | Subsystem | ✓ | Yes |

## 11. Change Process

```text
Request
 ↓
PM Review
 ↓
Shared / Local
 ├─ Local → Subsystem Schema
 └─ Shared → Data Dictionary + Schema
                    ↓
                 Version
                    ↓
                 Changelog
```

## 12. Versioning

```text
MAJOR.MINOR.PATCH
```

- PATCH → ไม่เปลี่ยน Contract
- MINOR → เพิ่มแบบไม่ทำลายของเดิม
- MAJOR → Breaking Change

## 13. `schemas/`

```text
schemas/
├── user.schema.json         ← GET /api/v1/auth/me (บัญชีของผู้เรียก)
├── role.schema.json         ← core role 6 ค่า
├── department.schema.json   ← สาขาจาก GET /api/v1/departments
├── subsystem.schema.json    ← subsystem.yaml
└── common.schema.json       ← envelope ของคำตอบ + error code 9 ค่า
```

ไฟล์เป็น JSON Schema (`.json`) แบบ camelCase ตรงกับ API จริง · ไม่มีสคริปต์ CI หรือ conformance อ่านไฟล์ใดนอกจาก
`subsystem.schema.json` (ที่ `templates/subsystem.yaml` อ้าง) — ถ้าขัดกับระบบที่รันจริงให้ยึดระบบจริงแล้วแจ้ง PL

## 14. Integration Boundary

```text
auth-contract.md
→ Authentication / Authorization

reference-data.md
→ ข้อมูลจาก Core Hub · สิ่งที่ระบบย่อยเก็บได้

data-dictionary.md
→ ชื่อและชนิดข้อมูลฝั่งระบบย่อย

schemas/
→ Data Structure / Validation

api-conventions.md
→ API Contract

ui-design-system.md
→ UI / UX
```

## 15. Completion

```text
[ ] Shared Table กำหนดแล้ว
[ ] Shared Field กำหนดแล้ว
[ ] Type / Required / Enum กำหนดแล้ว
[ ] Source of Truth กำหนดแล้ว
[ ] Read / Write กำหนดแล้ว
[ ] User Schema กำหนดแล้ว
[ ] Role Schema กำหนดแล้ว
[ ] อ้างข้อมูลกลางด้วย code (reference-data.md) กำหนดแล้ว
[ ] Common Schema กำหนดแล้ว
[ ] Subsystem Schema กำหนดแล้ว
[ ] Change / Versioning กำหนดแล้ว
```
