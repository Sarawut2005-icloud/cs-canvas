# ข้อมูลกลางจาก Core Hub — สารบัญ วิธีเรียก และสิ่งที่เก็บได้

**เวอร์ชัน 1.4** (มาตรฐาน 1.8.3) · เจ้าของข้อมูล: Core Hub · ตรวจกับโค้ด `develop` ของ Core Hub เมื่อ 1 ต.ค. 2569 (ข้อ 6 ตรวจซ้ำ 6 ต.ค.)

หน้านี้คือที่เดียวที่ระบบย่อยต้องใช้เมื่อจะดึงข้อมูลจาก Core Hub: มี endpoint อะไร ใครเรียกได้ ได้ field อะไร
เรียกอย่างไร และเก็บอะไรไว้ในฐานของตัวเองได้ · URL ของ server จริง บัญชีทดสอบ และค่า env อยู่ใน
[`connect-core-hub.md`](connect-core-hub.md)

> ถ้าหน้านี้ขัดกับระบบที่รันจริง ให้ยึดระบบจริงแล้วแจ้ง PL (หลักของ `overview.md` ข้อ 3)

---

## 1. สรุปสั้น

- เรียก Core Hub จาก **backend ของระบบย่อยเท่านั้น** ด้วย token ของผู้ใช้ที่กำลังใช้งาน และเฉพาะ endpoint ในข้อ 2
- **ข้อมูลอ้างอิง** (7 ชุด) cache รวมทุกผู้ใช้ 10 นาที และใช้ของเก่าต่อตอน Core Hub ล่ม · **ข้อมูลบุคคลห้าม cache**
- ฐานของระบบย่อยเก็บได้แค่ `core_user_id` · `person_code` · `code` ของข้อมูลอ้างอิง · `id` ของรูป —
  **ไม่เก็บชื่อ อีเมล หรือสำเนาตาราง** (ข้อ 8)
- code ไม่เปลี่ยนชื่อตั้งแต่ 1.7.0 และไม่มีการลบ — ของที่เลิกใช้เป็น `isActive: false` (ข้อ 9)
- Core Hub ตอบ `401` = ผู้ใช้ต้อง SSO ใหม่ · ล่มหรือ timeout = ใช้ cache เก่า ไม่มีก็ตอบ `503` (ข้อ 7.4)

---

## 2. endpoint ที่ระบบย่อยเรียกได้ (allowlist)

path ทั้งหมดต่อจาก `<CORE_HUB_URL>/api/v1` · "ทุก role" = `student` `alumni` `staff` `lecturer` `guest` `admin`

### 2.1 ข้อมูลอ้างอิง — `GET` เท่านั้น · สิทธิ์ `reference:read` (ทุก role)

| ชุด | list (แบ่งหน้า) | filter เฉพาะชุด | endpoint อื่นของชุด |
|---|---|---|---|
| คณะ | `/faculties` | — | `/faculties/:code` |
| สาขาวิชา | `/departments` | `facultyCode` | `/departments/:code` |
| อาคาร | `/buildings` | — | `/buildings/:code` |
| ห้อง | `/rooms` | `buildingCode` · `facultyCode` · `roomType` · `floor` | `/rooms/:code` |
| ภาคการศึกษา | `/academic-terms` | `academicYear` | `/academic-terms/:code` · `/academic-terms/current` (ยังไม่กำหนด = 404) · `/academic-terms/:code/events` (ปฏิทินการศึกษา) |
| รายวิชา | `/courses` | `baseCode` · `departmentCode` · `curriculumCode` · `q` (ค้นใน code และชื่อ ไม่สนตัวพิมพ์) | `/courses/:code` (+ อยู่หลักสูตรไหน กลุ่มไหน ปีไหน และวิชาบังคับก่อน) |
| หลักสูตร | `/curricula` | `departmentCode` | `/curricula/:code` (+ ปริญญา ปรัชญา วัตถุประสงค์ PLO เกณฑ์หน่วยกิต) · `/curricula/:code/structure` · `/curricula/:code/study-plan` |

### 2.2 ข้อมูลบุคคล — `GET` เท่านั้น (รายละเอียดข้อ 5)

| endpoint | ใครเรียกได้ (สิทธิ์) | query | ได้อะไร |
|---|---|---|---|
| `/people/me` | ทุก role ยกเว้น `guest` (`people:me:read`) | — | บุคคลที่ผูกกับบัญชีผู้เรียก · ยังไม่ผูก = `200` + `data: null` |
| `/people` | `staff` `lecturer` `admin` (`people:read`) | `personType` · `status` · `entryYear` · `departmentCode` · `q` · `page` · `limit` | รายการแบ่งหน้า เรียงตาม `personCode` |
| `/people/:personCode` | `staff` `lecturer` `admin` | — | บุคคลเดียว (ทุกสถานะ) · ไม่พบ = 404 |
| `/people/:personCode/advisors` | `staff` `lecturer` `admin` | — | array ของอาจารย์ที่ปรึกษาที่ยังมีผล (ไม่แบ่งหน้า) |
| `/people/:personCode/advisees` | `staff` `lecturer` `admin` | `status` | array ของนักศึกษาในที่ปรึกษา เรียงตาม `personCode` (ไม่แบ่งหน้า) |

### 2.3 ตัวตนและรูป

| endpoint | ใครเรียกได้ | หมายเหตุ |
|---|---|---|
| `GET /auth/me` | ทุก role | ข้อมูลบัญชีของผู้เรียก (ข้อ 5.3) |
| `POST /images` | ทุก role ยกเว้น `guest` (`image:upload`) · หมวด `NEWS` ต้องมี `content:create` (`staff` `lecturer` `admin`) | อัปโหลดรูป (ข้อ 6) |
| `GET /images` · `GET /images/:id` | ทุก role ยกเว้น `guest` — เห็นเฉพาะรูปที่ตัวเองอัป (`admin` เห็นทุกรูป) | |
| `DELETE /images/:id` | เหมือนข้างบน — ลบได้เฉพาะรูปของตัวเอง (`admin` ลบได้ทุกรูป) | |
| `GET /images/:id/file` | **สาธารณะ** ไม่ต้องมี token | ไฟล์รูปดิบ — ใช้ใน `<img src>` ได้ตรง |

### 2.4 ห้ามเรียก

ทุก endpoint ที่ไม่อยู่ในข้อ 2.1–2.3 เช่น `/auth/*` (ยกเว้น `GET /auth/me`) · `/users` · `/subsystems` ·
`/notifications` · `/people/me/schedule` · `/backoffice` · `POST`/`PATCH` ของข้อมูลอ้างอิง (งานของ admin ใน backoffice)
— `/people/me/schedule` · `/notifications` · `/users` เป็นของหน้า portal ของ Core Hub ไม่ใช่สัญญากับระบบย่อย
เปลี่ยนได้โดยไม่ประกาศ · เมื่องานฝั่ง Core Hub ขึ้นระบบ token ที่ออกให้ระบบย่อยจะได้ `403` จาก endpoint เหล่านี้

---

## 3. กติกาของ list และ detail (ข้อมูลอ้างอิงทุกชุด)

| เรื่อง | กติกา |
|---|---|
| แบ่งหน้า | `page` ≥ 1 (ค่าเริ่มต้น 1) · `limit` 1–100 (ค่าเริ่มต้น 20) · ผิดช่วงหรือไม่ใช่ตัวเลข = `400 VALIDATION_ERROR` · คำตอบมี `meta { total, page, limit, totalPages }` ชั้นบน · ไม่มีข้อมูล = `data: []` และ `totalPages: 0` |
| ที่ปิดใช้งาน | ค่าเริ่มต้นส่งเฉพาะ `isActive: true` · `includeInactive=true` ส่งทั้งหมด — **ต้องเป็นคำว่า `true` ตรงตัว** ค่าอื่น (`1` · `yes`) ถือเป็น `false` โดยไม่แจ้ง error |
| `isActive` | `isActive=true` หรือ `isActive=false` เลือกฝั่งเดียว (ส่งมาแล้ว `includeInactive` ไม่มีผล) · ค่าอื่น = 400 |
| filter | filter ที่เป็น code เทียบตรงตัว (ตัวพิมพ์ใหญ่-เล็กมีผล) · code ที่ไม่มีได้ `data: []` ไม่ใช่ 404 · `roomType` ต้องเป็นค่าใน enum (ข้อ 4.8) · `floor` · `academicYear` ต้องเป็นจำนวนเต็ม — ไม่ใช่ = 400 |
| query ที่ไม่รู้จัก | `400 VALIDATION_ERROR` ทุกตัว (เช่น `per_page` · `sort`) — ส่งเฉพาะที่ประกาศไว้ |
| ลำดับ | คงที่ เรียงตาม `code` · ยกเว้นภาคการศึกษาเรียง**ใหม่ → เก่า** (`academicYear` แล้ว `semester`) |
| detail `/:code` | คืน**แม้ `isActive: false`** (ใช้แสดงชื่อในประวัติ) · code ไม่มี = `404 NOT_FOUND` · code เทียบตรงตัว |
| ไม่แบ่งหน้า | `/academic-terms/current` (object) · `/academic-terms/:code/events` (array เรียงตามลำดับในปฏิทิน) · `/curricula/:code/structure` · `/curricula/:code/study-plan` (object) — ไม่มี `meta` · code ไม่มี = 404 |
| header | ทุก GET ตอบ `Cache-Control: private, max-age=300` · ไม่รองรับ conditional request (ไม่มี `304`) |

ข้อมูลอ้างอิงแก้ได้เฉพาะ admin ผ่าน backoffice (`reference:manage`) · **ไม่มี DELETE** ปิดใช้งานด้วย `isActive: false` ·
**แก้ `code` หลังสร้างไม่ได้**

---

## 4. field ที่ได้กลับมา (ข้อมูลอ้างอิง)

ทุกแถวทุกชุดมี 3 field นี้ และ**ไม่มี `id`** (Core Hub ไม่ส่ง id ออก):

| field | type | กติกา |
|---|---|---|
| `code` | string | ไม่ซ้ำ · ตัวพิมพ์ใหญ่ ตัวเลข และ `-` เท่านั้น (`^[A-Z0-9-]+$` ยาวไม่เกิน 50) เช่น `SCI` · `LAB-1` · `2569-1` |
| `isActive` | boolean | `false` = เลิกใช้ (แทนการลบ) |
| `updatedAt` | string | ISO 8601 UTC ลงท้าย `Z` |

ปี = พุทธศักราช · วันที่ = `YYYY-MM-DD` · เวลา = UTC (แสดงผลแปลงเป็น `Asia/Bangkok`)
ตารางข้างล่างเป็น field **เพิ่มเติม**ของแต่ละชุด (คอลัมน์ null = ค่าอาจเป็น `null`)

### 4.1 คณะ `/faculties`

| field | type | null | หมายเหตุ |
|---|---|---|---|
| `nameTh` · `nameEn` | string | — | |

### 4.2 สาขาวิชา `/departments`

| field | type | null | หมายเหตุ |
|---|---|---|---|
| `nameTh` · `nameEn` | string | — | |
| `facultyCode` | string | — | code ของคณะ — ใช้ตัวนี้อ้างอิง |
| `faculty` | object `{ code, nameTh }` | — | สำหรับแสดงผล |

### 4.3 อาคาร `/buildings`

| field | type | null | หมายเหตุ |
|---|---|---|---|
| `nameTh` | string | — | |
| `nameEn` | string | ✓ | |
| `latitude` · `longitude` | number | ✓ | |

### 4.4 ห้อง `/rooms`

| field | type | null | หมายเหตุ |
|---|---|---|---|
| `nameTh` | string | — | |
| `building` | string | — | **ชื่อ**อาคาร สำหรับแสดงผล |
| `buildingCode` | string | — | code ของอาคาร — ใช้ตัวนี้อ้างอิงและกรอง |
| `floor` | integer | ✓ | |
| `capacity` | integer | ✓ | |
| `roomType` | enum | — | ข้อ 4.8 |
| `facultyCode` | string | ✓ | |
| `photoUrl` | string | ✓ | |

### 4.5 ภาคการศึกษา `/academic-terms`

`code` = `<ปี พ.ศ.>-<ภาค>` เช่น `2569-1`

| field | type | null | หมายเหตุ |
|---|---|---|---|
| `academicYear` | integer | — | ปี พ.ศ. |
| `semester` | integer | — | `1` · `2` · `3` (3 = ภาคฤดูร้อน) |
| `startDate` · `endDate` | string | — | `YYYY-MM-DD` |
| `isCurrent` | boolean | — | มีได้ภาคเดียว (`/academic-terms/current`) |

`/academic-terms/:code/events` → array ของ `{ eventCode, parentEventCode, nameTh, startsAt, endsAt, note }` —
`startsAt`/`endsAt` เป็น ISO 8601 UTC · `parentEventCode` และ `note` เป็น `null` ได้ · ไม่มี `isActive`/`updatedAt`

### 4.6 รายวิชา `/courses`

`code` = **รหัสเต็มรวมรุ่น** เช่น `10301111-1` — รหัสเดียวกันต่างรุ่นเป็นคนละวิชา

| field | type | null | หมายเหตุ |
|---|---|---|---|
| `baseCode` | string | — | รหัสไม่รวมรุ่น · **ไม่ unique** (หลายรุ่นใช้ร่วมกัน) — ห้ามใช้อ้างอิง |
| `registrarCode` | string | ✓ | รหัสตามระบบทะเบียน |
| `nameTh` | string | — | |
| `nameEn` | string | ✓ | |
| `credits` | integer | — | |
| `creditPattern` | string | ✓ | เช่น `3(2-3-5)` |
| `lectureHours` · `labHours` · `selfStudyHours` | integer | ✓ | |
| `ownerUnitName` | string | ✓ | หน่วยงานเจ้าของวิชาที่ไม่อยู่ในระบบ |
| `categoryLabel` · `descriptionTh` | string | ✓ | |
| `departmentCode` | string | ✓ | |

`/courses/:code` เพิ่ม `curricula[]` = `{ curriculumCode, category, courseGroup, isRequired, choiceGroup, recommendedYear, recommendedSemester }`
(`courseGroup` `choiceGroup` `recommendedYear` `recommendedSemester` เป็น `null` ได้) และ `prerequisites[]` = `{ code, note }`

### 4.7 หลักสูตร `/curricula`

`code` = รหัสหลักสูตรของมหาวิทยาลัย เช่น `65304010`

| field | type | null | หมายเหตุ |
|---|---|---|---|
| `nationalCode` | string | ✓ | รหัสหลักสูตรระดับประเทศ |
| `nameTh` | string | — | |
| `nameEn` | string | ✓ | |
| `curriculumYear` | integer | — | ปี พ.ศ. ของหลักสูตร |
| `totalCredits` | integer | ✓ | |
| `departmentCode` | string | — | |

- `/curricula/:code` เพิ่ม `degreeFullTh` `degreeShortTh` `degreeFullEn` `degreeShortEn` `studyDurationYears` `instructionLanguage`
  `philosophyTh` `significanceTh` `visionTh` `missionTh` (ทุกตัว `null` ได้) · `objectives[]` `{ code, titleTh, descriptionTh }` ·
  `learningOutcomes[]` `{ code, titleTh, subtitleTh, descriptionTh }` · `creditRules[]` `{ category, minCredits }`
- `/curricula/:code/structure` → `{ curriculumCode, creditRules[], groups[], otherCourses[] }` — กลุ่มวิชาพร้อมวิชาในกลุ่ม
- `/curricula/:code/study-plan` → `{ curriculumCode, totalCredits, terms[] }` — แต่ละ term มี `year` `semester` `courses[]` `electiveSlots[]` `totalCredits`
- วิชาในสอง endpoint นี้มี `code` `nameTh` `nameEn` `credits` `creditPattern` + ตำแหน่งในหลักสูตร (`category` · `isRequired` · ...)

### 4.8 ค่า enum

| field | ค่า |
|---|---|
| `roomType` | `LECTURE` · `LAB` · `SEMINAR` · `MEETING` · `PROJECT` · `OFFICE` |
| `category` (หมวดในหลักสูตร) | `GENERAL_EDUCATION` · `CORE` · `MAJOR_REQUIRED` · `MAJOR_ELECTIVE` · `FREE_ELECTIVE` · `OTHER` |
| `personType` | `STUDENT` · `STAFF` |
| `status` (บุคคล) | `ACTIVE` · `INACTIVE` (พ้นสภาพ ลาออก ย้าย) · `GRADUATED` |
| `staffType` | `LECTURER` · `OFFICER` · `TECHNICIAN` · `OTHER` |
| `category` (รูป) | `PROFILE` · `NEWS` · `GENERAL` |

ชุดเดียวกันอยู่ใน [`../contracts/vocabulary.json`](../contracts/vocabulary.json) (`coreHubEnums`) · Core Hub เพิ่มค่าได้ —
ค่าที่ไม่รู้จักให้แสดงตามที่ได้ ห้ามพัง

---

## 5. ข้อมูลบุคคลและบัญชี — ไม่ใช่ข้อมูลอ้างอิง

ข้อมูลส่วนบุคคล สิทธิ์การเห็นไม่เท่ากันตาม role — **ห้าม cache ทุกแบบ** (ทุก route ตอบ `Cache-Control: no-store`)
และ**ห้ามเก็บชื่อ อีเมล หรือ field บุคคลอื่นลงฐานของระบบย่อย** (ข้อ 8)

### 5.1 field ของบุคคล

| field | type | null | หมายเหตุ |
|---|---|---|---|
| `personCode` | string | — | นักศึกษา = รหัสนักศึกษา · บุคลากร = ส่วนหน้าอีเมลมหาวิทยาลัย (ไม่ใช่รูปแบบ code ของข้อ 4) |
| `personType` | enum | — | `STUDENT` · `STAFF` |
| `staffType` | enum | ✓ | เฉพาะบุคลากร |
| `academicTitle` · `jobTitle` | string | ✓ | |
| `fullNameTh` | string | — | |
| `fullNameEn` | string | ✓ | |
| `universityEmail` | string | ✓ | **ส่งเฉพาะผู้เรียกที่มี `people:contact:read`** (ตอนนี้ `staff` `lecturer` `admin`) — ไม่มีสิทธิ์ field นี้จะไม่อยู่ในคำตอบ |
| `entryYear` | integer | ✓ | ปี พ.ศ. ที่เข้าศึกษา |
| `status` | enum | — | `ACTIVE` · `INACTIVE` · `GRADUATED` |
| `coreUserId` | string | ✓ | = claim `sub` ของบัญชีที่ผูกกับบุคคลนี้ · `null` = ยังไม่มีบัญชี |
| `faculty` | object `{ code, nameTh }` | — | |
| `department` | object `{ code, nameTh }` | ✓ | |
| `curriculum` | object `{ code, nameTh, curriculumYear }` | ✓ | |

### 5.2 พฤติกรรมราย endpoint

- **`/people/me`** — บุคคลที่ `coreUserId` = `sub` ของผู้เรียก ใช้อ่าน `personCode` ตอนทำรายการ (ข้อ 8) ·
  ยังไม่ผูกบัญชีกับบุคคล (เช่น บัญชีทดสอบ) = `200` + `data: null` · `guest` = `403`
  - พฤติกรรมปัจจุบัน: คืน `universityEmail` ของผู้เรียกเสมอ และมี `advisors[]` = `{ personCode, fullNameTh, universityEmail }`
    ของอาจารย์ที่ปรึกษาที่ยังมีผล — **รวมอีเมลมหาวิทยาลัยของอาจารย์** แม้ผู้เรียกไม่มี `people:contact:read`
- **`/people`** — `personType` (`STUDENT`|`STAFF` ไม่สนตัวพิมพ์) · `status` ค่าเริ่มต้น **`ACTIVE`** (`INACTIVE` · `GRADUATED` · `ALL`) ·
  `entryYear` (จำนวนเต็ม พ.ศ.) · `departmentCode` · `q` (ค้นใน `personCode` และชื่อไทย/อังกฤษ) · `page`/`limit` ตามข้อ 3 · query อื่น = 400
- **`/people/:personCode`** — ทุกสถานะ · ไม่พบ = 404 · ใช้แสดงชื่อตอนแสดงผลด้วย token ของผู้ดู
- **`/people/:personCode/advisors`** · **`/advisees`** — array ไม่มี `meta` · `advisees` รับ `status` (ค่าเริ่มต้น `ACTIVE`) · บุคคลไม่พบ = 404

### 5.3 บัญชีของผู้เรียก `GET /auth/me`

คืน `{ id, email, username, role, sessionId, profileImageId, hasPassword }` — `id` = `sub` · `username` และ `profileImageId` เป็น `null` ได้ ·
รูปโปรไฟล์คือ `GET /images/<profileImageId>/file`

- `role` ตรงนี้คือ core role ของบัญชี **ไม่ใช่** role สำหรับระบบนี้ — ตัดสินสิทธิ์จาก claim `role` ใน token เสมอ
  ([`auth-contract.md`](auth-contract.md) ข้อ 3)
- `sessionId` คือ `sid` — ห้ามเก็บและห้าม log

---

## 6. รูปภาพ `/images`

> **ใช้กับรูปที่ใครเห็นก็ได้เท่านั้น** (ข่าว · ภาพประกอบ · รูปโปรไฟล์) — ไฟล์เปิดได้โดยไม่ต้อง login (ใครมี URL ก็เปิดได้) และ cache ได้ 1 วัน
> รวมที่ Cloudflare ลบแล้วก็อาจยังเปิดได้จนหมดเวลา · Core Hub แปลงทุกรูปเป็น WebP จึงไม่ใช่ไฟล์ต้นฉบับ ·
> **บิล สลิป เอกสาร PDF รูปที่มีเลขบัญชี ชื่อ หรือข้อมูลส่วนบุคคล และไฟล์ที่ต้องเก็บต้นฉบับ ห้ามส่งมาที่นี่** —
> เก็บในฐานของระบบเองตาม [`deployment.md`](deployment.md) ข้อ 4.3

- **อัปโหลด** `POST /images` แบบ `multipart/form-data`: `file` (JPEG · PNG · WebP ไม่เกิน 10 MB — ไม่รับ SVG) ·
  `category` · `subsystem` = ชื่อระบบในทะเบียน (ป้ายกำกับ ต้อง APPROVED + ACTIVE ไม่งั้น 400)
  - ระบบย่อยใช้ `GENERAL` · `PROFILE` **เปลี่ยนรูปโปรไฟล์ของผู้ใช้ใน Core Hub ทันที** (รูปเดิมถูกลบ) · `NEWS` ต้องมี `content:create`
  - Core Hub ย่อรูปและแปลงเป็น WebP เสมอ · อัปโหลดมีเพดานเพิ่ม 60 ครั้ง/นาที ต่อ IP
- **คำตอบ** `{ id, category, url, thumbnailUrl, mimeType, sizeBytes, width, height, subsystemId, uploadedById, createdAt }` —
  `id` เป็น UUID v4 · `url` = `<CORE_HUB_URL>/api/v1/images/<id>/file` · `thumbnailUrl` = `url?size=thumb` ·
  `uploadedById` = `sub` ของผู้อัป · `subsystemId` เป็น id ภายในของ Core Hub ไม่ใช่ชื่อระบบ (`null` ได้)
- **list** `GET /images` แบ่งหน้าตามข้อ 3 + `category` · เรียงใหม่ → เก่า · เห็นเฉพาะรูปของตัวเอง (`admin` เห็นทั้งหมด)
- **get / delete** `/images/:id` — รูปของคนอื่น = 403 · ไม่มีหรือลบแล้ว = 404 · ลบ = soft delete ตอบ `{ id, deleted: true }`
- **ไฟล์** `GET /images/:id/file` สาธารณะ ส่ง bytes ดิบ (`Cache-Control: public, max-age=86400`) — เป็น URL เดียวของ Core Hub
  ที่เบราว์เซอร์เรียกตรงได้ · รูปที่ลบแล้วได้ 404 → แสดงรูปแทน
- ระบบย่อยเก็บแค่ `id` แล้วประกอบ URL ตอนแสดงผล

---

## 7. เรียก Core Hub ยังไง

### 7.1 วิธีเรียก

- **จาก backend ของระบบย่อยเท่านั้น** — Core Hub ปิด CORS เบราว์เซอร์เรียก API ตรงไม่ได้ (ยกเว้น `<img src>` ของข้อ 6) ·
  หน้าเว็บของระบบย่อยได้ข้อมูลผ่าน API ของระบบย่อยเอง เช่น demo เปิด `GET /api/v1/rooms` ที่อ่านจาก cache
- ใช้ **token ของผู้ใช้ที่ส่ง request นั้นมา** (ตัวที่ผ่านการตรวจตาม [`auth-contract.md`](auth-contract.md) ข้อ 4 แล้ว) ใน
  `Authorization: Bearer` — token เป็นบัตรผ่านของผู้ใช้ ห้ามส่งต่อ ([`auth-contract.md`](auth-contract.md) ข้อ 6.1) ·
  ไม่มี token ของระบบ จึงไม่มีงานเบื้องหลังที่ดึงข้อมูลจาก Core Hub ได้ (ดึงเมื่อมีคำขอแรกที่ต้องใช้)
- เรียกเฉพาะ allowlist ข้อ 2 · URL = `<CORE_HUB_URL>/api/v1<path>` จาก env ห้าม hardcode · timeout 5 วินาที
- อ่าน `success` · `data` · `meta` · `error.code` และ**ข้าม key ที่ไม่รู้จัก** — Core Hub ใส่ `requestId` · `timestamp` · `path` ·
  `error.statusCode` เพิ่ม ([`api-conventions.md`](api-conventions.md) ข้อ 3–4)

### 7.2 rate limit — ความหมายต่อ backend ของระบบย่อย

| ชั้น | เพดาน | นับรวมอะไร |
|---|---|---|
| ต่อ IP | 600 ครั้ง / 10 วินาที · 3,000 ครั้ง / นาที | **ทุกผู้ใช้ของ backend เดียวกัน** (ออกจาก IP เดียว) รวมเครื่องอื่นที่ออกเน็ต IP เดียวกัน |
| ต่อผู้ใช้ | 100 ครั้ง / 10 วินาที · 600 ครั้ง / นาที | ใช้ร่วมกับที่ผู้ใช้คนนั้นเปิด portal ของ Core Hub เอง |
| `POST /images` | +60 ครั้ง / นาที ต่อ IP | |

เกินเพดาน Core Hub ตอบ `429` พร้อม `Retry-After` (วินาที) — ระบบย่อยต้อง:

- **ไม่เรียกทีละแถว** — ห้ามเรียก Core Hub หนึ่งครั้งต่อหนึ่งแถวของรายการ ใช้ cache ทั้งชุด (ข้อมูลอ้างอิง) หรือแสดง `person_code` (บุคคล)
- **single-flight** — คำขอที่มาพร้อมกันตอน cache ว่างหรือหมดอายุ ต้องรอผลการดึงครั้งเดียวกัน
- **เคารพ `Retry-After`** — ไม่เรียกซ้ำก่อนครบเวลา ไม่วน retry · ระหว่างรอใช้ของเก่า
- ไม่ retry `4xx` อื่น — เรียกซ้ำก็ได้ผลเดิม

### 7.3 cache

| ข้อมูล | cache | วิธี |
|---|---|---|
| ข้อมูลอ้างอิง 7 ชุด | ✅ **รวมทุกผู้ใช้** TTL 10 นาที | ทุก role เห็นเหมือนกัน cache เดียวจึงปลอดภัย · ดึง**ทั้งชุด** `?limit=100&includeInactive=true` วนตาม `meta.totalPages` แล้วกรองในหน่วยความจำ (ได้ชื่อของ code ที่ปิดแล้วด้วย) · endpoint ย่อย (`/:code/events` · `/structure` · `/study-plan` · detail) cache ต่อ code ด้วย TTL เดียวกัน |
| ข้อมูลบุคคล `/people/*` | ❌ ห้าม | เรียกตอนใช้ด้วย token ของผู้ใช้คนนั้น แม้แต่ cache แยกรายคนก็ห้าม |
| `/auth/me` | ❌ | ข้อมูลตัวตนใช้จาก token |
| รูป | เก็บ `id` | ไฟล์เบราว์เซอร์ cache เอง 1 วัน |

กติกาของ cache ข้อมูลอ้างอิง (ตัวอย่างอยู่ใน demo `backend/src/core-hub/`: รายการชุดใน `reference-datasets.ts` ·
ตัวเรียก `reference-data.service.ts` มี `list` · `get` · `assertActive` · ใช้จริงใน `backend/src/rooms/`):

- **stale-on-error** — ดึงใหม่ไม่สำเร็จแต่มีของเก่า ใช้ของเก่าต่อ + log `core_data.refresh.failure` · คำตอบรูปแบบผิด
  (ไม่มี `success: true` · `data` ไม่ใช่ array · `meta` ไม่ครบ · แถวไม่มี `code`/`isActive`/`updatedAt`) ถือว่าล้ม ห้ามเขียนทับของดี
- ล้มแล้วรออย่างน้อย **30 วินาที** ก่อนลองใหม่ · ไม่ดึงตอนเปิดระบบ
- code ที่ยังไม่เห็นใน cache ดึงใหม่ได้หนึ่งครั้ง (ภายใต้กติกา 30 วินาที) ยังไม่เจอ = code ไม่มีจริง
- `Cache-Control: private, max-age=300` ของ Core Hub เป็นคำแนะนำสำหรับเบราว์เซอร์ — TTL ของระบบย่อยคือ 10 นาทีตามหน้านี้ ·
  ไม่ต้องส่ง `If-None-Match`/`If-Modified-Since` เพราะ Core Hub ไม่ตอบ `304`
- ข้อมูลอาจช้ากว่าต้นทางได้ไม่เกิน TTL — admin ปิดห้องแล้ว ระบบย่อยอาจยังรับห้องนั้นได้อีกไม่เกิน 10 นาที

ค่าแนะนำใน env (ชื่อตาม demo): `CORE_HUB_DATA_CACHE_TTL_MS=600000` · `CORE_HUB_DATA_MIN_REFRESH_INTERVAL_MS=30000` ·
`CORE_HUB_DATA_REQUEST_TIMEOUT_MS=5000`

### 7.4 เมื่อ Core Hub ตอบไม่ปกติ

| Core Hub ตอบ | ระบบย่อยทำ |
|---|---|
| `401` | session ของผู้ใช้ที่ Core Hub จบแล้ว → ตอบ `401 UNAUTHORIZED` ให้ frontend ของตัวเอง แล้ว frontend พาไป SSO ใหม่ (Silent re-SSO — [`auth-contract.md`](auth-contract.md) ข้อ 7) · **ไม่ใช่ 503** และไม่ retry |
| `403` | role ของผู้ใช้ไม่มีสิทธิ์นั้น (เช่น `student` เรียก `/people/:personCode`) หรือ endpoint อยู่นอก allowlist → ซ่อนความสามารถนั้นตาม role · ถ้าผู้ใช้สั่งเองตอบ `403 FORBIDDEN` · ถ้าแค่หาชื่อมาแสดง ให้แสดง code แทน |
| `404` | code หรือบุคคลไม่มี → แสดง code เดิมพร้อมข้อความ "ไม่พบในข้อมูลกลาง" ห้ามตอบ 500 |
| `400` | ระบบย่อยส่งค่าผิดเอง (query ที่ไม่รู้จัก · `limit` เกิน 100) — ตรวจค่าจากผู้ใช้ก่อนส่งต่อ (ตอบ 400 เอง) ถ้ายังเจอคือบั๊ก ให้แก้โค้ด |
| `429` | รอตาม `Retry-After` · ใช้ cache เก่า · ไม่มีของเก่า → `503 SERVICE_UNAVAILABLE` + `Retry-After` ค่าเดียวกัน |
| `5xx` · timeout · ต่อไม่ติด | ใช้ cache เก่า · ไม่มี → `503 SERVICE_UNAVAILABLE` + `Retry-After` (เช่น `30`) ตาม [`api-conventions.md`](api-conventions.md) ข้อ 4 · ข้อมูลบุคคลที่ใช้แค่แสดงชื่อ ให้แสดง `person_code` แทน |

ตัดสินจาก HTTP status — Core Hub ตอบ `5xx` ทุกแบบด้วย `error.code = "INTERNAL_ERROR"`

---

## 8. เก็บอะไรในระบบย่อย

| เก็บ | กติกา |
|---|---|
| `core_user_id` = claim `sub` | ชนิด **text** ยาวไม่เกิน 64 · **ไม่ใช่ UUID** (นักศึกษาที่นำเข้าจาก CSV เป็น `user-<รหัสนักศึกษา>` · บัญชี MJU SSO และที่ admin สร้างเป็น UUID) — ห้าม parse หรือ validate เป็น UUID · ทำ index แต่**ไม่ unique** ในตารางธุรกิจ · ถือเป็นข้อมูลบุคคล |
| `person_code` | รหัสนักศึกษา/บุคลากรจาก `GET /people/me` **ตอนเกิดรายการ** · null ได้ (`/people/me` ได้ `null` เมื่อบัญชีไม่ผูกกับบุคคล) |
| `code` ของข้อมูลอ้างอิง | code อย่างเดียว เช่น ห้อง `LAB-1` · คณะ `SCI` · ภาค `2569-1` · รายวิชา = `code` เต็มรวมรุ่น (ไม่ใช่ `baseCode`) · หลักสูตร `65304010` — คอลัมน์ตั้งชื่อ `<ชุด>_code` เช่น `room_code` |
| รูป | `id` ของรูปจาก `POST /images` — เฉพาะรูปที่เปิดสาธารณะได้ (ข้อ 6) |
| เอกสารที่ต้องตรวจสิทธิ์หรือเก็บต้นฉบับ (บิล · สลิป · PDF) | ไฟล์ในฐานของระบบเอง ตาม [`deployment.md`](deployment.md) ข้อ 4.3 |

| ห้ามเก็บ | ทำแทน |
|---|---|
| ชื่อ อีเมล และ field บุคคลอื่นทุกตัว | ดูตอนแสดงผลด้วย token ของผู้ดู (`GET /people/:personCode` — `staff` `lecturer` `admin`) หรือแสดง `person_code` · ห้าม cache |
| สำเนาตารางข้อมูลอ้างอิง · ชื่อของรายการ · `id` | cache ตามข้อ 7.3 · Core Hub ไม่ส่ง `id` ออกอยู่แล้ว |
| token · `sid` | token เป็นบัตรผ่านของผู้ใช้ ([`auth-contract.md`](auth-contract.md) ข้อ 6.1) |
| role | อ่านจาก claim `role` ทุก request |
| `email` เป็นกุญแจ | อาจเป็น `<รหัส>@sso.mju.local` และเปลี่ยนได้ — ใช้แสดงผลเท่านั้น |

```prisma
model RoomBooking {
  id         String   @id @default(uuid())
  coreUserId String   @map("core_user_id")   // sub — text ≤ 64 · ไม่ unique
  personCode String?  @map("person_code")    // จาก /people/me ตอนจอง
  roomCode   String   @map("room_code")      // code ของ Core Hub เช่น LAB-1
  termCode   String   @map("term_code")      // เช่น 2569-1
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt      @map("updated_at")

  @@index([coreUserId])
  @@index([roomCode])
  @@map("room_bookings")
}
```

- **รับข้อมูลเข้า**: code ต้องมีจริงและ `isActive: true` (ตรวจกับ cache) ไม่งั้นตอบ `400 VALIDATION_ERROR`
- **แสดงผล**: code ที่ปิดแล้วหรือหาไม่เจอ ต้องแสดงได้เสมอ (เช่น `LAB-9 (ปิดใช้งาน)` หรือแสดง code เปล่า ๆ) — ห้ามให้หน้าประวัติพัง
- ห้าม hardcode รายการข้อมูลอ้างอิง (เช่นรายชื่อคณะ) ในโค้ด — เรียก `GET /api/v1/faculties` (กฎ `DD-04`)
- ชื่อคอลัมน์และ migration ตาม [`data-dictionary.md`](data-dictionary.md) ข้อ 9

---

## 9. code ไม่เปลี่ยน

- ตั้งแต่มาตรฐาน 1.7.0 **Core Hub ไม่เปลี่ยนชื่อ code** ที่มีอยู่แล้ว (API แก้ `code` ไม่ได้อยู่แล้ว)
- ถ้าจำเป็นต้องเปลี่ยน = สร้าง code ใหม่ + ตั้ง code เดิมเป็น `isActive: false` แล้ว**ประกาศใน `CHANGELOG.md` ของมาตรฐาน**
  พร้อมรายการ เดิม → ใหม่ ให้ระบบย่อยย้ายค่าที่เก็บไว้ด้วย migration ของตัวเอง
- ก่อน 1.7.0 มีการเปลี่ยนไปแล้วสองรายการ: คณะ `science` → `SCI` และสาขา `computer-science` → `CS` —
  ระบบที่เคยเก็บค่าเดิมต้อง `UPDATE` เป็นค่าใหม่
- ไม่มีการลบ — code ที่เคยเก็บไว้ยังเปิดดูได้ที่ `/:code` เสมอ

---

## 10. อะไรเป็นข้อมูลอ้างอิงได้ และการเพิ่มชุดใหม่

ชุดข้อมูลต้องผ่าน**ครบ 6 ข้อ**ถึงจะใช้รูปแบบในหน้านี้ (cache รวมทุกผู้ใช้):

1. Core Hub เป็นเจ้าของ (ข้อมูลขององค์กรที่หลายระบบใช้ ไม่ใช่ข้อมูลธุรกิจของระบบใดระบบหนึ่ง)
2. ไม่ใช่ข้อมูลส่วนบุคคล
3. ทุก role ที่ login เห็นเหมือนกันทุกแถว
4. มี `code` ประจำแถวที่ไม่เปลี่ยน
5. เปลี่ยนไม่บ่อย (ระดับชั่วโมงหรือวัน)
6. ขนาดเล็ก (หลักพันแถวลงมา)

ไม่ผ่านข้อใดข้อหนึ่งห้ามใช้รูปแบบนี้ — ข้อมูลบุคคลจึงอยู่ข้อ 5 และห้าม cache · สถานะห้องว่าง การจอง การลงทะเบียน
ผลการเรียน ครุภัณฑ์คงเหลือ เป็นข้อมูลของระบบย่อยเจ้าของ ให้ระบบนั้นเปิด API ตาม [`api-conventions.md`](api-conventions.md) เอง
(การเรียกข้ามระบบย่อยยังไม่มีสัญญา — ดู `api-conventions.md` ข้อ 10)

**ชุดใหม่หรือ field ใหม่** Core Hub ทำตามสัญญาข้อ 3–4 แล้วประกาศในหน้านี้และ `CHANGELOG.md`:

| เปลี่ยนอะไร | ระดับ |
|---|---|
| เพิ่มชุด · เพิ่ม field · เพิ่ม filter · เพิ่มค่า enum | minor — ระบบย่อยเดิมไม่พัง (ต้องข้าม field ที่ไม่รู้จัก) |
| เปลี่ยนชื่อ/ลบ field · เปลี่ยน type | major — ประกาศล่วงหน้า |
| เปลี่ยน `code` ของแถวที่มีอยู่ | ห้าม — ใช้วิธีในข้อ 9 |
