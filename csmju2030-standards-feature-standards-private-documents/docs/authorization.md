# Authorization

**เวอร์ชัน 1.1** (standards 1.7.0) · คู่กับ [`auth-contract.md`](auth-contract.md)

> Authentication ตอบว่า *"นี่คือใคร"* — Authorization ตอบว่า *"คนนี้ทำอะไรได้"*
> สองเรื่องนี้ต้องแยกชั้นกันในโค้ด

---

## 1. สองชั้นของสิทธิ์

```text
Core JWT  →  Core Role  →  Subsystem Role  →  Permission  →  Business Operation
└── Core Hub ────────┘     └────────── ระบบย่อย ─────────────────────────────┘
```

| ชั้น | ใครตัดสิน | ตัดสินอะไร | ผลเมื่อไม่ผ่าน |
|---|---|---|---|
| **Layer 1** | Core Hub | ผู้ใช้คนนี้ **เข้าระบบย่อยนี้ได้ไหม** | `403` ตั้งแต่ Core Hub (ไม่ redirect) |
| **Layer 2** | ระบบย่อย | เข้ามาแล้ว **ทำอะไรได้บ้าง** | `403` จากระบบย่อย |

---

## 2. Core role (Layer 1)

ค่าปิด 6 ค่า ห้ามเพิ่มเอง (`lecturer` กับ `guest` เพิ่มใน 1.6.0 · สาย 1.0.x ตั้งแต่ 1.0.6):

```text
student · alumni · staff · lecturer · guest · admin
```

| core role | คือใคร | Core Hub ให้ role นี้เมื่อ |
|---|---|---|
| `student` | นักศึกษาปัจจุบัน | เข้าด้วย MJU SSO และอยู่ในทะเบียนเป็น `STUDENT` สถานะ `ACTIVE` |
| `alumni` | ศิษย์เก่า | `STUDENT` สถานะ `GRADUATED` |
| `staff` | บุคลากรที่**ไม่ใช่**อาจารย์ | `STAFF` ที่ `staff_type` ไม่ใช่ `LECTURER` |
| `lecturer` | อาจารย์ | `STAFF` ที่ `staff_type` = `LECTURER` |
| `guest` | ผู้เยี่ยมชม | admin ของ Core Hub สร้างบัญชีให้ (ไม่ผ่าน MJU SSO) |
| `admin` | ผู้ดูแลระบบกลาง | admin ของ Core Hub กำหนด |

มาจาก claim `role` ใน token เท่านั้น — เป็น role ของผู้ใช้**สำหรับระบบนี้**: core role ของบัญชี
หรือ role ของสิทธิ์พิเศษที่อนุมัติแล้ว (ข้อ 7) · อ่านจาก token ทุก request ห้ามเก็บไว้ตัดสินสิทธิ์ครั้งต่อไป

- **admin ของระบบย่อยไม่ใช่ core role** — บัญชีเจ้าของระบบในทะเบียน (role `staff` หรือ `lecturer` เช่น
  บัญชีเจ้าของระบบที่ทีมได้รับ) มีสิทธิ์แค่ยื่นและแก้ทะเบียนของตัวเอง ([`subsystem-registry.md`](subsystem-registry.md) ข้อ 1)
  ส่วนสิทธิ์ภายในระบบย่อยให้ผ่าน role mapping (ข้อ 3) หรือสิทธิ์พิเศษรายบุคคล (ข้อ 7)
- ระบบย่อยที่ยังไม่ได้ใส่ `lecturer` / `guest` ใน mapping ไม่ต้องแก้อะไร ผู้ใช้ role นั้นได้ `403` ตามข้อ 3

---

## 3. Role mapping

ระบบย่อย **ต้อง**แปลง core role เป็น role ของตัวเองด้วยตารางที่ประกาศไว้ชัดเจน
และ **ต้อง**ประกาศตารางเดียวกันนี้ใน Subsystem Registry (`default_role_mapping`)

```ts
// ตัวอย่างจาก reference implementation (ระบบจองห้อง)
export const CORE_ROLE_TO_SUBSYSTEM_ROLE = {
  student:  'STUDENT',
  alumni:   'ALUMNI',
  staff:    'STAFF',
  lecturer: 'STAFF',    // อาจารย์ใช้สิทธิ์ชุดเดียวกับเจ้าหน้าที่ในระบบนี้
  guest:    'ALUMNI',   // ผู้เยี่ยมชมดูได้อย่างเดียว
  admin:    'ADMIN',
} as const;
```

- ชื่อ subsystem role ตั้งเองได้ (เช่น ระบบครุภัณฑ์แมป `student → USER`)
- core role ที่ **ไม่มี**ในตาราง = เข้าระบบนี้ไม่ได้ → ตอบ **`403`** (ไม่ใช่ 401)
- **key ของ `default_role_mapping` มีผลบังคับ**: Core Hub ใช้เป็นรายชื่อ role ที่เข้าได้ ตรวจตั้งแต่ก่อน redirect
  ถ้าลืมใส่ role ใด ผู้ใช้ role นั้นจะโดน `403` ที่ Core Hub ทันที · ต้องมีอย่างน้อย 1 key เป็นตัวพิมพ์เล็กตรงตัว
- **value ในทะเบียนเป็นเอกสาร** — Core Hub ไม่ส่งไปใน token ระบบย่อยต้องแมปเองด้วยตารางในโค้ด
  และตารางในโค้ด **ต้องตรงกับ**ทะเบียนเสมอ (ผู้รีวิวตรวจข้อนี้ด้วยตา)
- **อย่าแมป `staff` ทั้งหมดเป็นผู้ดูแลระบบย่อย** — ถ้าผู้ดูแลเป็นแค่บางคน ให้ใช้สิทธิ์พิเศษรายบุคคล (ข้อ 7)

---

## 4. Permission (Layer 2)

รูปแบบชื่อบังคับ:

```text
<resource>:<action>[:own|:any]

student:read:own · student:read:any · course:create · course:delete
enrollment:update:own · equipment:borrow:any
```

- `:own` = ทำได้เฉพาะข้อมูลของตัวเอง · `:any` = ทำได้กับข้อมูลของทุกคน
- นิยาม "ของตัวเอง" มาตรฐาน: **`record.core_user_id === token.sub`**
- guard ตรวจว่ามี permission อย่างน้อยหนึ่งข้อ จากนั้น **service ต้องตรวจ ownership กับข้อมูลจริงอีกชั้น**

```ts
@RequirePermissions(Permission.STUDENT_READ_ANY, Permission.STUDENT_READ_OWN)
@Get(':id')
findOne(@CurrentUser() user, @Param('id') id) {
  return this.students.findOne(user, id);   // ← service ตรวจ ownership ต่อ
}
```

---

## 5. ข้อห้าม

```text
1. ใช้ role === 'admin' เป็นสถาปัตยกรรมสิทธิ์  (ต้องมีชั้น permission จริง)
2. ตรวจ :own แค่ใน guard โดยไม่ดูข้อมูลจริงในชั้น service
3. ตอบ 401 เมื่อสิทธิ์ไม่พอ  (ต้องเป็น 403)
4. ตอบ 404 แทน 403 เพื่อ "ซ่อนข้อมูล"  (มาตรฐานนี้บังคับ 403)
5. อ่าน role จาก body / query / custom header
```

---

## 6. ตัวอย่างเมทริกซ์ (จาก reference implementation)

| Permission | STUDENT | ALUMNI | STAFF | ADMIN |
|---|:-:|:-:|:-:|:-:|
| `student:read:own` | ✅ | ✅ | ✅ | ✅ |
| `student:read:any` | — | — | ✅ | ✅ |
| `student:create` | — | — | ✅ | ✅ |
| `course:read` | ✅ | ✅ | ✅ | ✅ |
| `course:create` / `course:update` | — | — | ✅ | ✅ |
| `course:delete` | — | — | **—** | ✅ |
| `enrollment:create:own` | ✅ | — | ✅ | ✅ |
| `enrollment:update:any` | — | — | ✅ | ✅ |

แต่ละระบบย่อยกำหนดเมทริกซ์ของตัวเอง แต่ **ต้อง**เขียนไว้ในที่เดียว (`src/auth/permissions.ts`)
และ **ต้อง**มี unit test อย่างน้อย 1 เคสของ `403`

---

## 7. Subsystem Exception

กรณีต้องให้สิทธิ์พิเศษรายบุคคล (เช่น นักศึกษาคนหนึ่งเป็นผู้ช่วยแล็บ) ให้ขอผ่าน Registry
ไม่ใช่ฮาร์ดโค้ดใน subsystem — ดู [`subsystem-registry.md`](subsystem-registry.md) ข้อ 7

- เมื่ออนุมัติแล้ว Core Hub ใส่ role ของสิทธิ์พิเศษเป็น `role` ใน token ที่ออกให้ระบบนี้
  ระบบย่อยแมปด้วยตารางข้อ 3 ตามปกติ ไม่ต้องมีโค้ดพิเศษ
- **ตอนนี้ยังไม่มีผล** — Core Hub บันทึกและอนุมัติได้แล้ว แต่จะเริ่มใส่ role ลง token เมื่อขึ้นงานแยก token ของระบบย่อย
  (CHANGELOG ของ standards จะแจ้ง) · ระหว่างนี้ห้ามเขียนรายชื่อผู้ใช้ตายตัวในโค้ดแทน
