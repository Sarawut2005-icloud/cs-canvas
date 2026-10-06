# ui-design-system.md

**เวอร์ชัน:** 1.3.2
**ดูแลโดย:** PM1 (Design System & Frontend Experience) — *ปรับหมายเลข PM ตามการแบ่งงานจริงของทีม*
**บังคับใช้กับ:** ทุก frontend ของระบบย่อยทั้ง 37 ระบบ ที่ plug เข้ากับ `csmju-core`
**Stack บังคับ:** Next.js (frontend) · NestJS (backend) · PostgreSQL (database) · Tailwind CSS
**เอกสารที่ต้องอ่านคู่กัน:** `auth-contract.md` (PM2) · `api-conventions.md` (PM3) · `data-dictionary.md` (PM3)
**Package:** `@csmju2030/design-system` (npm, private registry ของ org) — ⚠️ **ยังไม่ประกาศใช้** (v1.3.0 ที่มีอยู่ขัดกับมาตรฐานนี้ ห้ามใช้) ระหว่างนี้ให้ใช้ [`templates/csmju-subsystem-web/`](../templates/csmju-subsystem-web/) แทน (ดูข้อ 17.0)
**หมายเหตุ:** ไฟล์นี้เป็นฉบับรวม — แทนที่ `ui-design-system.md` + `ui-prompt-template.md` เดิม (ใช้ไฟล์เดียวจบ)
**Repo:** `github.com/csmju2030/csmju2030-standards`
**แหล่งอ้างอิงหน้าตาจริง (source of truth):** `csmju-core-hub/frontend` — token อยู่ที่ `app/globals.css` (`@theme` ของ Tailwind v4), class ปุ่ม/input/การ์ด/ตาราง อยู่ที่ `app/backoffice/_components/ui.ts` ถ้าเอกสารนี้กับโค้ดไม่ตรงกัน ให้ถือโค้ดเป็นหลักแล้วแก้เอกสาร

> **เจตนาของเอกสารนี้**
> ระบบย่อย 37 ระบบ พัฒนาโดย AIE 37 คน (1 คน : 1 ระบบ) ที่ใช้ AI คนละตัว คนละรุ่น คนละ prompt
> ถ้าไม่ล็อกมาตรฐานหน้าจอไว้ ผู้ใช้คนเดียวกันจะเจอปุ่ม "บันทึก" 50 แบบ สีน้ำเงิน 50 เฉด และ error message 50 สำนวน ในระบบที่ควรเป็น "แอปเดียวกัน"
> เอกสารนี้คือ **สัญญาฝั่งหน้าจอ (UI contract)** — เทียบเท่ากับที่ `auth-contract.md` ล็อกเรื่อง token และ `api-conventions.md` ล็อกเรื่อง API
> **หลักคิด:** ล็อกสิ่งที่ผู้ใช้ "รู้สึกได้ข้ามระบบ" (สี ฟอนต์ ระยะห่าง โครงหน้าจอ ข้อความ สถานะ) แต่ปล่อยอิสระเต็มที่กับสิ่งที่เป็น "ตรรกะเฉพาะระบบ" (จะมีกี่หน้า จัดเรียงข้อมูลยังไง ใช้ chart แบบไหน)

---

## วิธีใช้ไฟล์นี้ (ใครอ่านส่วนไหน)

ไฟล์เดียวแต่มี 3 กลุ่มผู้อ่าน อ่านเฉพาะส่วนของตัวเองก็พอ ไม่ต้องอ่านทั้งหมดทุกคน

| คุณคือ | อ่านส่วนไหน | ใช้ตอนไหน |
|---|---|---|
| **PM / ผู้บริหารโครงการ** | ข้อ 0 (10 กฎเหล็ก) · ข้อ 1 (ขอบเขต) · ข้อ 17 (กระบวนการ) · ข้อ 19.1 (วิเคราะห์ mockup) | ตอนพรีเซนต์และตอนตัดสินคำขอเปลี่ยนมาตรฐาน |
| **PL (หัวหน้าทีม)** | ทั้งไฟล์ โดยเฉพาะข้อ 17 (review gate) · ข้อ 18 (Definition of Done + PR checklist) | ตอนรีวิวงาน AIE ในทีม 3–4 คน |
| **AIE (ผู้พัฒนา)** | ข้อ 0 · 3–16 (มาตรฐานทางเทคนิค) · ข้อ 18 (checklist) · **ข้อ 20 (ชุดคำสั่งสำหรับป้อน AI)** | ก่อนเริ่มงานทุกครั้ง |
| **AI ที่ AIE ใช้** | **ข้อ 20.1** คัดลอกไปวางเป็นข้อความแรก + แนบไฟล์นี้ทั้งไฟล์ | ทุกครั้งที่เปิดแชตใหม่ |

**ลำดับการทำงานจริงของ AIE ต่อ 1 หน้าจอ:**

```
1. ดึงมาตรฐานล่าสุด (ข้อ 17.3)
2. เปิดแชตใหม่กับ AI → วางบล็อก 20.1 + แนบไฟล์นี้
3. กรอกเทมเพลต 20.2 (ชื่อหน้า/สิทธิ์/endpoint/ฟิลด์) → ส่งให้ AI
4. AI สร้างโค้ด → สั่งให้ AI ตรวจตัวเองด้วยเทมเพลต 20.3
5. AIE ทดสอบเองตามข้อ 20.4 (AI ทำแทนไม่ได้)
6. ตรวจ checklist ข้อ 18.2 → เปิด PR → PL รีวิวตามข้อ 17.1
```

---

## สารบัญ

| ส่วน | หัวข้อ | ระดับบังคับ |
|---|---|---|
| 0 | สรุปสำหรับนำเสนอ — 10 กฎเหล็ก | — |
| 1 | ขอบเขต: อะไรล็อก / อะไรอิสระ | 🔴 บังคับ |
| 2 | หลักการออกแบบ & ลำดับการตัดสินใจ | 🟡 แนวทาง |
| 3 | Design Tokens (สี ฟอนต์ ระยะห่าง ฯลฯ) | 🔴 บังคับ |
| 4 | Typography ภาษาไทย (สำคัญที่สุดและพลาดบ่อยที่สุด) | 🔴 บังคับ |
| 5 | Layout, Grid และ App Shell | 🔴 บังคับ |
| 6 | Responsive & Touch | 🔴 บังคับ |
| 7 | Component Library (รายการ + สเปค) | 🔴 บังคับ |
| 8 | Pattern มาตรฐาน (ฟอร์ม ตาราง modal ฯลฯ) | 🟡 แนวทาง + 🔴 บางข้อ |
| 9 | สถานะหน้าจอ: loading / empty / error (ผูกกับ api-conventions) | 🔴 บังคับ |
| 10 | UI ตามสิทธิ์ Layer 1 / Layer 2 | 🔴 บังคับ |
| 11 | Microcopy & รูปแบบข้อมูลภาษาไทย | 🔴 บังคับ |
| 12 | Accessibility (WCAG 2.1 AA) | 🔴 บังคับ |
| 13 | Dark mode | 🟢 ทางเลือก |
| 14 | Icon & รูปภาพ | 🟡 แนวทาง |
| 15 | Performance budget | 🔴 บังคับ |
| 16 | Stack (Next.js/NestJS/PostgreSQL), โครงสร้างโค้ด + ข้อห้าม | 🔴 บังคับ |
| 17 | กระบวนการ: review gate, CI, versioning, ขอของใหม่ | 🔴 บังคับ |
| 18 | Definition of Done + PR Checklist | 🔴 บังคับ |
| 19 | ภาคผนวก: วิเคราะห์หน้าจอตัวอย่าง + Changelog | — |
| 20 | **ภาคผนวก ก: ชุดคำสั่งสำหรับป้อนให้ AI** (AIE ใช้ทุกวัน) | 🔴 บังคับ |

**คำอธิบายสัญลักษณ์**
🔴 **บังคับ** = CI ตรวจ / PL reject PR ได้ทันที
🟡 **แนวทาง** = ถ้าไม่ทำตามต้องเขียนเหตุผลใน PR description
🟢 **ทางเลือก** = ทำหรือไม่ทำก็ได้

---

## 0. สรุปสำหรับนำเสนอ — 10 กฎเหล็ก

> สไลด์เดียวจบ ถ้าจำได้ 10 ข้อนี้ ระบบย่อยจะผ่าน review เกิน 80%

1. **ห้ามพิมพ์ค่าสีเป็นตัวเลขดิบ** — ใช้ token (Tailwind class ที่มาจาก `@theme`) เท่านั้น (`text-primary-container` ไม่ใช่ `text-[#2154D9]`)
2. **Stack ล็อกไว้แล้ว: Next.js (App Router) + Tailwind + NestJS + PostgreSQL** และ **ห้ามลง UI library อื่น** — ห้าม MUI / Ant Design / Bootstrap / Chakra (ยกเว้นได้รับอนุมัติจาก PM เป็นลายลักษณ์อักษร) · **จัดสไตล์ด้วย Tailwind CSS เท่านั้น** (ดูข้อ 16.0)
3. **ห้ามสร้างหน้า Login เอง** — redirect ไป Core ตาม `auth-contract.md` ข้อ 1 เสมอ
4. **ทุกหน้าต้องอยู่ใน `<CsmjuAppShell>`** — header, ปุ่มกลับ Dashboard, เมนูผู้ใช้ มาจากส่วนกลาง ห้ามวาดเอง
5. **ฟอนต์ไทยต้องมาก่อน** — line-height ขั้นต่ำ 1.6 สำหรับเนื้อความ, ห้าม `letter-spacing` ติดลบกับข้อความไทย, ห้ามใช้ตัวพิมพ์ใหญ่ทั้งหมด (`uppercase`) กับภาษาไทย
6. **ระยะห่างใช้ scale ของ Tailwind (หน่วยละ 4px) เท่านั้น** — ห้ามใช้ค่า arbitrary เช่น `p-[15px]`
7. **ทุกหน้าจอต้องมี 4 สถานะครบ** — loading (skeleton) / empty / error / success ขาดข้อใดข้อหนึ่ง = ไม่ผ่าน Definition of Done
8. **error.code จาก API ต้อง map เป็น UI ตามตารางข้อ 9** ห้ามคิดข้อความ error เอง ห้ามโชว์ stack trace
9. **สิทธิ์ที่ไม่มี = ซ่อน, สิทธิ์ที่มีแต่ทำไม่ได้ตอนนี้ = disable + บอกเหตุผล** (ข้อ 10)
10. **ทุกอย่างต้องใช้ได้ด้วยคีย์บอร์ดและอ่านออกบนมือถือ 360px** — เป็นเกณฑ์ผ่าน/ไม่ผ่าน ไม่ใช่ "ทำเพิ่มถ้ามีเวลา"

**ประโยคสำหรับพรีเซนต์:**
> "เราไม่ได้ทำ 37 เว็บไซต์ เราทำ 1 แอปที่มี 37 โมดูล — ผู้ใช้ต้องไม่รู้สึกว่าข้ามไปอีกเว็บหนึ่ง"

---

## 1. ขอบเขต: อะไรล็อก / อะไรอิสระ

ความยืดหยุ่นคือเป้าหมายของโครงการ ดังนั้นต้องชัดว่าล็อกตรงไหน

| หัวข้อ | ล็อกโดยส่วนกลาง | อิสระของ AIE |
|---|---|---|
| สี / ฟอนต์ / spacing / radius | 🔴 ล็อกทั้งหมด | ไม่มี |
| Header, เมนูผู้ใช้, ปุ่มกลับ Dashboard, การแจ้งเตือน | 🔴 ล็อก (มาจาก `<CsmjuAppShell>`) | ไม่มี |
| Login / Logout / 401 refresh flow | 🔴 ล็อก (Core + component มาตรฐาน) | ไม่มี |
| Component พื้นฐาน (ปุ่ม ฟอร์ม ตาราง modal toast badge) | 🔴 ล็อก | เลือกใช้ตัวไหน จัดเรียงยังไง |
| โครงหน้า (container width, grid, breakpoint) | 🔴 ล็อก | จำนวนคอลัมน์ในแต่ละหน้า |
| ข้อความมาตรฐาน (ปุ่ม, error, ยืนยันการลบ) | 🔴 ล็อก | ข้อความเฉพาะโดเมนของระบบตัวเอง |
| รูปแบบวันที่/เงิน/ตัวเลข | 🔴 ล็อก (util จาก package) | ไม่มี |
| จำนวนหน้า, flow การทำงาน, ชื่อเมนูภายในระบบย่อย | — | 🟢 อิสระเต็มที่ |
| Chart / visualization / แผนที่ | — | 🟢 อิสระ (แต่ใช้ palette จาก token) |
| Framework / Stack | 🔴 ล็อก: **Next.js + Tailwind + NestJS + PostgreSQL** | เลือกเวอร์ชัน minor, เลือก library เสริมได้ |
| State management, data fetching library | — | 🟢 อิสระเต็มที่ |
| Business logic ทั้งหมด | — | 🟢 อิสระเต็มที่ |

> **หลักตัดสินเวลาเถียงกัน:** ถ้าผู้ใช้ 1 คนเปิดระบบย่อย 3 ระบบในวันเดียวแล้ว "รู้สึกสะดุด" → เรื่องนั้นต้องล็อก ถ้ารู้สึกแค่ "ระบบนี้มีฟีเจอร์ต่างจากระบบนั้น" → เรื่องนั้นอิสระ

---

## 2. หลักการออกแบบ & ลำดับการตัดสินใจ

### 2.1 ตัวตนทางสายตา (Visual Identity)

**Modern Institutionalism** — ความน่าเชื่อถือแบบมหาวิทยาลัย + ความสะอาดแบบเครื่องมือสมัยใหม่

ระบบต้องให้ความรู้สึก: *สงบ · น่าเชื่อถือ · ฉลาด · เป็นวิชาการ · ใช้ง่าย*
ระบบต้อง **ไม่** ให้ความรู้สึก: SaaS dashboard ทั่วไป · เว็บราชการยุคเก่า · startup landing page · เว็บเกม

**ลายเซ็นของแบรนด์ (ใช้ได้ และใช้เฉพาะที่ระบุ):**
- `brand-gradient` (น้ำเงินกรมท่า → น้ำเงิน, 135°) — sidebar, แผงแบรนด์หน้า Login, พื้นหลังรูปปกข่าวที่ยังไม่มีรูป, จุด timeline ที่ active
- `btn-gradient` (น้ำเงิน → ฟ้า, 90°) — ปุ่มหลัก และกล่องไอคอนของการ์ดสถิติที่ต้องการเน้น
- `glow-circle` (วงแสงเบลอ) — แผงแบรนด์หน้า Login เท่านั้น
- `backdrop-blur-sm` — ปุ่มบนพื้นเข้ม (เช่น ปุ่มออกจากระบบใน sidebar) เท่านั้น
- Entrance animation `fade-slide-up` + `stagger-1..3` — ตอนหน้าโหลดเท่านั้น

**ห้ามใช้:** gradient อื่นนอกจาก 2 ตัวข้างบน · สี neon · เงาหนา · glassmorphism บนพื้นสว่าง · animation วนซ้ำ (ยกเว้น loading) · ไอคอนหลากสี · emoji ในหน้าจอระบบ · รูป stock ทั่วไป

### 2.2 หลักการ 7 ข้อ

1. **ความชัดเจนมาก่อนความสวย** — ถ้าต้องเลือกอย่างใดอย่างหนึ่ง เลือกชัดเจน
2. **หนึ่งหน้าจอ หนึ่งงานหลัก** — ต้องตอบได้ว่า "ผู้ใช้มาหน้านี้เพื่อทำอะไร" ในประโยคเดียว
3. **ใช้ที่ว่างแทนเส้นและเงา** — แยกส่วนด้วย spacing ก่อน แล้วค่อยใช้ border สุดท้ายค่อยใช้ shadow
4. **สม่ำเสมอสำคัญกว่าสร้างสรรค์** — ปุ่มลบต้องอยู่ที่เดิม สีเดิม ข้อความเดิม ทุกระบบ
5. **สถานะต้องพูดได้** — ระบบต้องบอกเสมอว่ากำลังทำอะไร สำเร็จไหม ผิดตรงไหน แก้ยังไง
6. **มือถือคือพลเมืองชั้นหนึ่ง** — นักศึกษาส่วนใหญ่เปิดจากมือถือ ออกแบบ mobile-first
7. **เข้าถึงได้คือข้อกำหนด ไม่ใช่ของแถม** — เป็นสถาบันการศึกษาของรัฐ มีภาระผูกพันเรื่องนี้

### 2.3 ลำดับการตัดสินใจเมื่อไม่แน่ใจ

```
1. ชัดเจน (Clarity)
2. เข้าถึงได้ (Accessibility)
3. ใช้งานง่าย (Usability)
4. สม่ำเสมอกับระบบอื่น (Consistency)
5. น่าเชื่อถือแบบวิชาการ (Credibility)
6. ความประณีตทางสายตา (Polish)
7. การตกแต่ง (Decoration)  ← มาท้ายสุดเสมอ
```

---

## 3. Design Tokens

> **กฎเหล็ก:** ทุกสีใน className ต้องมาจาก token ห้ามพิมพ์ hex ดิบ (`bg-[#2154D9]`, `border-[#3B80F2]`)
> CI (`UI-01`) จะ scan หา hex code ทั้ง `frontend/` ยกเว้นไฟล์ token กลาง (`globals.css` และโฟลเดอร์ `csmju/` จาก template) และ **fail build**

ปัจจุบัน token ถูกประกาศใน `app/globals.css` ด้วย `@theme` ของ **Tailwind CSS v4** (ไม่มี `tailwind.config.js`) ชื่อ token ใช้ระบบ role ของ Material 3 (`primary`, `primary-container`, `on-surface`, …) และ Tailwind จะสร้าง utility ให้อัตโนมัติ เช่น `--color-primary-container` → `bg-primary-container`, `text-primary-container`, `border-primary-container`

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-primary-container: #2154d9;
  /* ... ดูตารางด้านล่าง */
}
```

> เมื่อแยกออกเป็น package `@csmju2030/design-system` แล้ว ไฟล์ `styles.css` ของ package ต้องประกาศ `@theme` ชุดเดียวกันนี้ทุกตัว (ชื่อและค่าเดิม) เพื่อให้ class ในทุกระบบย่อยใช้ได้เหมือนเดิม

### 3.1 สี (Color)

**Brand**

| Token (Tailwind) | ค่า | ใช้กับ |
|---|---|---|
| `primary-container` | `#2154D9` | **สีน้ำเงินหลักของ UI** — tab ที่เลือก, ตัวเลขสถิติ, ลิงก์ "ดูทั้งหมด", ไอคอนเน้น, hover ของปุ่มไอคอน, avatar, เส้นหัว section |
| `primary` | `#003CB4` | ลิงก์ในหน้า Login, ตัวอักษรบน chip eyebrow, checkbox ที่ติ๊กแล้ว |
| `tertiary` | `#003DAF` | (สำรอง ยังไม่ใช้) |
| `primary-fixed` | `#DCE1FF` | ข้อความรองบนพื้น `brand-gradient` |
| `on-primary-container` | `#D2DAFF` | ข้อความบนพื้น `primary-container` แบบจาง |
| `on-primary` | `#FFFFFF` | ข้อความบนปุ่มหลัก / พื้นเข้ม |
| `secondary` | `#4E5D87` | metadata (วันที่, trend ใต้ตัวเลข), ลิงก์ footer ฝั่ง Portal |

**พื้นผิว soft (tint ของ `primary-container`)** — ใช้ opacity modifier แทนการสร้าง token ใหม่

| Class | ใช้กับ |
|---|---|
| `bg-primary-container/10` + `text-primary-container` | กล่องไอคอนในการ์ดสถิติ, tag หมวดหมู่ที่เน้น, badge สถานะ info, chip ตัวนับใน tab ที่เลือก, ปุ่ม tonal |
| `bg-primary-container/20` | hover ของปุ่ม tonal |

**Gradient ของแบรนด์** (ประกาศเป็น class ใน `globals.css` — ห้ามเขียน gradient ใหม่เอง)

| Class | ค่า | ใช้กับ |
|---|---|---|
| `brand-gradient` | `linear-gradient(135deg, #16264D 0%, #0D4FA8 100%)` | sidebar, แผงแบรนด์หน้า Login, รูปปกข่าว placeholder |
| `btn-gradient` / `bg-btn-gradient` | `linear-gradient(90deg, #2154D9 0%, #3B80F2 100%)` | ปุ่มหลัก / กล่องไอคอนการ์ดสถิติที่เน้น |
| `text-gradient` | gradient เดียวกับ `btn-gradient` บนตัวอักษร | ชื่อแอป "CSMJU Portal" บน header มือถือของ BackOffice |

**สีประกอบแบรนด์ (Brand accents)**

| Token (Tailwind) | ค่า | ใช้กับ |
|---|---|---|
| `accent` | `#3B80F2` | ปลาย `btn-gradient`, ขอบ focus ของ input, เส้น active ของเมนู BackOffice, วงแสงหน้า Login |
| `brand-navy` | `#16264D` | ต้น `brand-gradient`, หัว footer Portal |
| `brand-blue` | `#0D4FA8` | ปลาย `brand-gradient` |
| `brand-amber` | `#F59E0B` | วงแสงสีทองในแผงแบรนด์หน้า Login เท่านั้น |
| `sso` / `sso-container` | `#2D8A61` / `#E8F5EE` | ปุ่มเข้าสู่ระบบด้วย SSO และข้อความแจ้งส่งอีเมลสำเร็จในหน้า Login เท่านั้น |

**พื้นผิว (Surface)**

| Token (Tailwind) | ค่า | ใช้กับ |
|---|---|---|
| `background` | `#F8F9FA` | พื้นหลังหน้า (page background) |
| `surface` | `#F8F9FA` | หัวตาราง, ช่องค้นหาบน header, hover แถวตาราง (`surface/50`) |
| `surface-container-lowest` | `#FFFFFF` | การ์ด, ตาราง, modal, input, header, footer Portal |
| `surface-container-low` | `#F3F4F5` | footer BackOffice |
| `surface-container` | `#EDEEEF` | วงกลมไอคอน Quick Access, เส้น timeline |
| `surface-container-high` | `#E7E8E9` | (สำรอง) |
| `surface-container-highest` | `#E1E3E4` | (สำรอง) |
| `surface-variant` | `#E1E3E4` | เส้นขอบการ์ดฝั่ง Portal, พื้น badge/tag สีเทา, hover ของปุ่มไอคอน (`surface-variant/50`) |
| `surface-dim` | `#D9DADB` | (สำรอง) |
| overlay | `bg-black/40` | scrim หลัง modal และ drawer มือถือ |

**ข้อความ**

| Token (Tailwind) | ค่า | contrast บนขาว | ใช้กับ |
|---|---|---|---|
| `on-surface` | `#191C1D` | ≈17.1:1 | หัวเรื่อง, ข้อมูลหลักในตาราง, label ของฟิลด์ |
| `on-surface-variant` | `#434654` | ≈9.4:1 | คำอธิบายใต้หัวหน้า, เนื้อความรอง, หัวคอลัมน์ตาราง |
| `secondary` | `#4E5D87` | ≈6.5:1 | metadata, วันที่ |
| `outline` | `#747686` | ≈4.5:1 (≈4.3:1 บน `background`) | ไอคอนเฉยๆ, placeholder (`outline/70`), สถานะ "สิ้นสุด" (**ห้ามใช้กับข้อความ < 14px บนพื้น `background`**) |

**เส้นขอบ**

| Token (Tailwind) | ค่า | ใช้กับ |
|---|---|---|
| `outline-variant` | `#C4C5D7` | ขอบ input, ขอบปุ่มรอง, ขอบ checkbox |
| `outline-variant/40` | — | ขอบการ์ด/ตาราง และเส้นคั่นแถวฝั่ง BackOffice |
| `outline-variant/30` | — | ขอบการ์ดหน้า Login, เส้นคั่น "หรือ", ขอบบน footer BackOffice |
| `surface-variant` | `#E1E3E4` | ขอบการ์ด/header/footer ฝั่ง Portal |

**สถานะ (Semantic)** — ตรงกับ `TONE_STYLES` ใน `app/backoffice/_components/StatusBadge.tsx`

| tone | พื้น badge | ตัวอักษร | จุดสี | ใช้เมื่อ |
|---|---|---|---|---|
| `success` (เขียว) | `bg-success/10` | `text-emerald-700` `#047857` (≈5.5:1) | `bg-success` `#10B981` | สำเร็จ, "ใช้งาน", "กำลังศึกษา" |
| `info` (น้ำเงิน) | `bg-primary-container/10` | `text-primary-container` `#2154D9` | `bg-primary-container` | สถานะกลางๆ, คำแนะนำ |
| `warning` (ส้ม) | `bg-amber-100` `#FEF3C7` | `text-amber-800` `#92400E` (≈6.4:1) | `bg-amber-500` `#F59E0B` | ต้องตรวจสอบ, ใกล้หมดเวลา |
| `error` (แดง) | `bg-error-container` `#FFDAD6` | `text-on-error-container` `#93000A` (≈7.2:1) | `bg-error` `#BA1A1A` | error, การลบ, ข้อความเตือนใน modal |
| `neutral` (เทา) | `bg-surface-variant` | `text-on-surface-variant` | `bg-outline` | ไม่ระบุสถานะ, สิ้นสุด |

Token ของสถานะใน `@theme`: `success` `#10B981` · `error` `#BA1A1A` · `error-container` `#FFDAD6` · `on-error-container` `#93000A` (สีส้มและ emerald ยังใช้ palette มาตรฐานของ Tailwind)

ข้อความแจ้งผลแบบ inline:
- ผิดพลาด: `rounded-lg bg-error-container px-4 py-3 text-on-error-container`
- สำเร็จ: `rounded-lg bg-sso-container px-4 py-3 text-sso` (หน้า Login)

**สีเขียว (`success`) ใช้เมื่อไหร่:** 🔴 ใช้เฉพาะหน้าจอที่ **แสดงสถานะ** (เช่น ใช้งาน / กำลังศึกษา / พร้อมให้ยืม) หรือ **แสดงความเปลี่ยนแปลง** (เช่น trend `+12%` ใต้ตัวเลขสถิติ) เท่านั้น ❌ ห้ามใช้เป็นสีตกแต่ง, สีปุ่ม, สีหัวข้อ หรือสีเน้นทั่วไป — หน้าจอที่ไม่มีสถานะหรือความเปลี่ยนแปลงไม่ต้องใช้สีเขียวเลย

เมื่อใช้ ให้แยกตามหน้าที่:
- จุดสี / ไอคอน (เช่น ลูกศร trend, จุดหน้า badge) → `bg-success` / `text-success` ได้
- ตัวอักษร (เช่น "ใช้งาน", "+12%") → `text-emerald-700` และต้องมีจุดสีหรือไอคอนกำกับเสมอ

> ⚠️ **ข้อควรระวัง contrast:** `success` `#10B981` บนพื้นขาวมี contrast เพียง ~2.5:1 → **ไม่ผ่าน WCAG AA สำหรับตัวอักษร** จึงต้องใช้ `text-emerald-700` (≈5.5:1) กับข้อความตามกฎข้างบน
> เช่นเดียวกับข้อความสีขาวบนปลาย gradient `#3B80F2` (~3.8:1) — ปุ่มหลักจึงต้องใช้ตัวอักษร 14px น้ำหนัก 600 ขึ้นไปเสมอ และข้อความเขียว `#2D8A61` บน `#E8F5EE` (~3.8:1) ต้องไม่เล็กกว่า 16px

**กฎการใช้สี**

- ปุ่ม gradient ใช้กับ "การกระทำหลัก 1 อย่างต่อพื้นที่" เท่านั้น — มีปุ่ม gradient 5 ปุ่มในหน้าเดียว = ไม่มีปุ่มไหนสำคัญ
- ห้ามสื่อความหมายด้วยสีอย่างเดียว ต้องมีไอคอนหรือข้อความกำกับเสมอ (badge สถานะมีจุดสี + ข้อความ)
- ห้ามใช้สีนอกรายการนี้ ยกเว้น chart (ดูข้อ 3.8)

> ✅ ไม่มี hex ดิบใน `className` แล้ว — gradient, focus ring, checkbox และ `input-error` ใน `globals.css` อ้างอิง `var(--color-*)` ทั้งหมด (สีโปร่งใสใช้ `color-mix(in srgb, var(--color-accent) 20%, transparent)`)

### 3.2 Spacing

ใช้ scale ของ Tailwind (1 หน่วย = 4px) — ค่าที่ใช้จริงในเว็บ:

| Class | ค่า | ใช้กับ |
|---|---|---|
| `1` / `1.5` | 4px / 6px | ช่องไฟไอคอน↔ข้อความในลิงก์/badge, padding ปุ่มไอคอน (`p-1.5`) |
| `2` / `2.5` | 8px / 10px | label↔input (`space-y-2`), padding แนวตั้งของปุ่ม/input (`py-2.5`), padding กล่องไอคอน |
| `3` | 12px | padding แนวนอนของ input (`px-3`), ระยะระหว่างปุ่มใน modal (`gap-3`), ระยะเมนู |
| `4` | 16px | padding ปุ่ม (`px-4`), ระยะระหว่างฟิลด์ (`space-y-4`), padding ข้างจอมือถือ |
| `5` | 20px | padding แนวตั้งของหัวการ์ด (`py-5`), ระยะระหว่างฟิลด์หน้า Login |
| `6` | 24px | **padding การ์ด/modal มาตรฐาน** (`p-6`), padding เซลล์ตาราง (`px-6`), gap การ์ดในกริด |
| `8` | 32px | ระยะระหว่าง block หลักในหน้า (`space-y-8`, `gap-8`) |
| `10` | 40px | ระยะใต้หัวหน้า Dashboard (`mb-10`) |
| `12` | 48px | padding หน้าบน desktop (`md:p-12` / `md:px-12`), padding footer Portal |

**กฎ:** ห้ามใช้ค่า arbitrary (`p-[15px]`, `gap-[7px]`) — ถ้า scale ไม่มีค่าที่ต้องการ ให้เลือกค่าที่ใกล้ที่สุด

### 3.3 Border Radius

| Class | ค่า | ใช้กับ |
|---|---|---|
| `rounded` (custom) | 4px | checkbox |
| `rounded-lg` | 8px | **ปุ่ม, input, select**, กล่องไอคอนในการ์ดสถิติ, การ์ด timeline, กล่องข้อความแจ้งเตือน inline |
| `rounded-r-lg` | 8px (ขวา) | เมนู sidebar ฝั่ง Portal |
| `rounded-xl` | 12px | **การ์ดมาตรฐาน, modal**, การ์ดสถิติ, การ์ดข่าว, การ์ด Quick Access, การ์ดฟอร์ม Login, กรอบโลโก้ใน sidebar |
| `rounded-full` | 9999px | badge สถานะ, tag หมวดหมู่, chip eyebrow, ตัวนับใน tab, avatar, จุดสถานะ, ปุ่มไอคอนบน header, ช่องค้นหาบน header, กรอบโลโก้วงกลม |

> ❌ ห้ามใช้ `rounded-full` กับปุ่มที่มีข้อความ — ปุ่มข้อความใช้ `rounded-lg` เสมอ

### 3.4 Elevation (เงา)

| Class | ใช้กับ |
|---|---|
| `shadow-sm` | **การ์ดมาตรฐาน**, header BackOffice, กรอบโลโก้, ปุ่มไอคอนวงกลม |
| `hover:shadow-md` | การ์ดที่กดได้ (การ์ดสถิติ, ข่าว, Quick Access) |
| `shadow-md` (+ `hover:shadow-lg` ในหน้า Login) | ปุ่มหลัก (gradient) |
| `shadow-[0_4px_12px_rgba(33,84,217,0.1)]` | การ์ดฟอร์ม Login (เงาอมน้ำเงิน) |
| `shadow-xl` | modal, sidebar, แผงแบรนด์หน้า Login |

การ์ดมาตรฐาน (`cardClass` ใน `ui.ts`) = `overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm`

### 3.5 Z-index

ใช้ scale ของ Tailwind (`z-10` … `z-40`) ห้ามใส่ `z-[9999]`

| ชั้น | Portal | BackOffice |
|---|---|---|
| header (sticky) | `z-20` | `z-10` |
| scrim ของ drawer มือถือ | `z-30` | `z-20` |
| sidebar / drawer | `z-40` | `z-30` |
| modal + overlay | — | `z-40` |

> 📝 ค่าระหว่าง 2 shell ยังไม่เท่ากัน และ sidebar ของ Portal (`z-40`) อยู่ชั้นเดียวกับ modal — เมื่อรวมเป็น AppShell เดียวให้ใช้ชุดของ BackOffice และให้ toast ใช้ `z-50`

### 3.6 Motion

| ค่า | ใช้กับ |
|---|---|
| 150ms `ease-out` / `ease-in-out` | hover/active ของปุ่มหลัก, focus ของ input, สี (`transition-colors`) |
| 200ms | เมนู sidebar, checkbox |
| 250ms `ease-out` | เส้นใต้ของลิงก์ `link-hover` |
| 300ms `ease-out` | drawer มือถือ, scrim, `fade-slide-up` |
| 400ms | `shake-anim` เมื่อกรอกผิด |
| 480ms `cubic-bezier(.4,0,.2,1)` | สลับแผง Login ↔ ลืมรหัสผ่าน |
| stagger 80 / 160 / 240ms | `stagger-1` / `stagger-2` / `stagger-3` |

Animation มาตรฐานที่มีใน `globals.css`: `fade-slide-up` (เข้าจากล่าง 8px) · `shake-anim` (input ผิด) · `dots` (loading ในปุ่ม) · `pop` (checkbox) · `link-hover` (เส้นใต้วิ่ง)

**กฎ:**
- animate เฉพาะ `opacity` และ `transform` เป็นหลัก
- ❌ ห้ามใช้ `transition: all` / `transition-all` ในงานใหม่ (โค้ดเดิมยังมีใน `.btn-gradient`, `.input-field`, เมนู sidebar — ให้เปลี่ยนเป็นรายการ property ที่ต้องการ)
- ห้ามมี animation ที่วนซ้ำไม่จบ ยกเว้น loading indicator
- **ต้อง** รองรับ `prefers-reduced-motion: reduce` — `globals.css` ลด duration ของ `.panel-anim`, `.form-section-anim`, `.btn-gradient`, `.input-field`, `.fade-slide-up` เหลือ 1ms และทำให้ `.dots` ช้าลง; animation ใหม่ทุกตัวต้องเพิ่มเข้าไปใน media query นี้ด้วย

### 3.7 Breakpoints

ใช้ breakpoint มาตรฐานของ Tailwind

| ชื่อ | ค่า | ใช้จริงในเว็บ |
|---|---|---|
| `base` | 0–767px | มือถือ (ออกแบบที่ **360px** เป็นค่าอ้างอิง) — sidebar เป็น drawer |
| `sm` | ≥640px | (ยังไม่ใช้) |
| `md` | ≥768px | **จุดเปลี่ยนหลัก** — sidebar แสดงถาวร, padding หน้า 48px, กริด 2–4 คอลัมน์, ฟิลเตอร์เป็นแถวเดียว |
| `lg` | ≥1024px | (ยังไม่ใช้) |
| `xl` | ≥1280px | Dashboard นักศึกษาเป็น 3 คอลัมน์ (เนื้อหาหลัก 2 + คอลัมน์ข้าง 1) |

**Container:** ความกว้างเนื้อหาสูงสุด `1280px` (`max-w-[1280px]`) จัดกึ่งกลาง + padding ข้าง `16px` (base) → `48px` (md+)

### 3.8 Palette สำหรับ Chart (ใช้เฉพาะกราฟ)

เรียงตามลำดับ ห้ามสลับ ห้ามเพิ่มเอง (ถ้าต้องการเกิน 6 ชุด ให้จัดกลุ่มข้อมูลใหม่แทน) — สีแรกตรงกับ `primary-container`

```
1 #2154D9   2 #0EA5E9   3 #14B8A6   4 #8B5CF6   5 #F59E0B   6 #747686
```

กราฟทุกอันต้องมี label ข้อความกำกับ ไม่พึ่งสีอย่างเดียว และต้องมี pattern/เส้นประสำรองเมื่อพิมพ์ขาวดำ

---

## 4. Typography — ภาษาไทยต้องมาก่อน

> **นี่คือส่วนที่ AI ทำพลาดบ่อยที่สุด** เพราะ AI มักเลือกฟอนต์ตามความสวยแบบภาษาอังกฤษ (Plus Jakarta Sans, Inter) ซึ่ง **ไม่มีอักขระภาษาไทย** ผลคือ browser fallback ไปฟอนต์ระบบ ทำให้หน้าจอไทยของแต่ละระบบย่อยหน้าตาไม่เหมือนกันเลย ทั้งที่ config เหมือนกัน

### 4.1 ฟอนต์มาตรฐาน

| บทบาท | Class | ฟอนต์ | น้ำหนักที่โหลด |
|---|---|---|---|
| หัวเรื่อง / ตัวเลขสถิติ (Display) | `font-display` | `Plus Jakarta Sans` (ละติน) | 400, 600, 700, 800 |
| เนื้อความ / UI (Body — ค่าเริ่มต้นของ `body`) | `font-body` | `Noto Sans Thai` (subset `thai` + `latin`) | 400, 500, 600, 700 |

```css
/* app/globals.css — @theme */
--font-display: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;
--font-body:    var(--font-noto-thai), ui-sans-serif, system-ui, sans-serif;
```

```ts
// app/layout.tsx
import { Plus_Jakarta_Sans, Noto_Sans_Thai } from "next/font/google";
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const notoSansThai = Noto_Sans_Thai({ variable: "--font-noto-thai", subsets: ["latin", "thai"], weight: ["400", "500", "600", "700"] });
// <html lang="th" className={`${jakarta.variable} ${notoSansThai.variable} h-full antialiased`}>
```

> ⚠️ **จุดที่ต้องแก้ในโค้ด:** `Plus Jakarta Sans` ไม่มีอักขระไทย แต่ stack ของ `--font-display` ไม่มี `Noto Sans Thai` ต่อท้าย → หัวเรื่องภาษาไทยที่ใช้ `font-display` (เช่น "ประกาศล่าสุด") จะ fallback ไปฟอนต์ระบบ และหน้าตาต่างกันในแต่ละเครื่อง ให้เปลี่ยนเป็น
> `--font-display: var(--font-jakarta), var(--font-noto-thai), ui-sans-serif, system-ui, sans-serif;`

**บังคับ:**
- 🔴 โหลดฟอนต์ผ่าน `next/font` เท่านั้น (`next/font/google` หรือ `next/font/local`) — `next/font` จะ self-host ไฟล์ฟอนต์ตอน build และเสิร์ฟจากโดเมนเดียวกับเว็บ เบราว์เซอร์ไม่ยิง request ไป Google ❌ ห้ามใส่ `<link>` ไป `fonts.googleapis.com` หรือ `@import url(...)` จาก CDN
- 🔴 ใช้ `font-display: swap` (ค่าเริ่มต้นของ `next/font`)
- 🔴 ห้ามใช้ faux bold — ใช้เฉพาะน้ำหนักที่โหลดไว้ในตารางข้างบน

### 4.2 Type Scale

ประกาศใน `@theme` เป็น `--text-*` → ใช้ผ่าน class `text-<ชื่อ>` (ได้ทั้งขนาด, line-height, น้ำหนัก, letter-spacing ในตัว)

| Class | ขนาด | line-height | น้ำหนัก | letter-spacing | ใช้กับ |
|---|---|---|---|---|---|
| `text-display-lg` | 48px | 1.2 | 800 | -0.02em | ตัวเลขในการ์ดสถิติ (ตัวเลข/อังกฤษเท่านั้น) |
| `text-headline-lg` | 32px | 1.3 | 700 | — | ชื่อหน้า (PageHeader) — มือถือใช้ 24px (`text-[24px] font-bold leading-[1.3] md:text-headline-lg`) |
| `text-headline-md` | 24px | 1.4 | 600 | — | ชื่อ section, หัวการ์ด, ชื่อ modal, หัวฟอร์ม Login |
| `text-body-lg` | 18px | 1.6 | 400 | — | คำทักทาย/คำอธิบายเด่น, ข้อความบนแผงแบรนด์ |
| `text-body-md` | 16px | 1.6 | 400 | — | **ค่าเริ่มต้นของเนื้อความ**, input, เซลล์ตาราง, คำอธิบายใต้ชื่อหน้า |
| `text-label-md` | 14px | 1.2 | 600 | 0.01em | ปุ่ม, label ของฟิลด์, เมนู, หัวคอลัมน์ตาราง, tab |
| `text-label-sm` | 12px | 16px | 600 | — | badge สถานะ, tag, trend ใต้ตัวเลข, ลิงก์ footer BackOffice |
| `text-caption` | 12px | 1.2 | 400 | — | วันที่ของข่าว, ชื่อเมนูภาษาอังกฤษใน sidebar, copyright |

> ใช้ `font-display` คู่กับ `text-display-lg` / `text-headline-*` เสมอ ส่วนข้อความอื่นใช้ `font-body` (ค่าเริ่มต้น)

### 4.3 กฎภาษาไทยที่ต้องท่องให้ขึ้นใจ

1. 🔴 **line-height ขั้นต่ำ 1.6** สำหรับเนื้อความไทยหลายบรรทัด (`text-body-*` ตั้งไว้แล้ว) — `text-label-*` / `text-caption` (1.2) ใช้ได้เฉพาะข้อความบรรทัดเดียว เช่น ปุ่ม, label, badge ❌ ห้ามใช้กับย่อหน้า
2. 🔴 **ห้าม `letter-spacing` ค่าติดลบ** กับข้อความไทย — `text-display-lg` (-0.02em) จึงใช้ได้กับตัวเลข/อังกฤษเท่านั้น
3. 🔴 **ห้าม `uppercase` / `tracking-wider` / `tracking-widest`** กับข้อความไทย (โค้ดปัจจุบันยังมีที่ chip "ระบบแผนกวิชาการ" และเส้นคั่น "หรือ" ในหน้า Login — ต้องเอาออก)
4. 🔴 **ขนาดตัวอักษรไทยขั้นต่ำ 14px** สำหรับเนื้อความ — 12px (`text-label-sm`, `text-caption`) ใช้ได้เฉพาะ badge, tag, วันที่ และ metadata สั้นๆ
5. 🔴 **ห้าม `word-break: break-all`** กับข้อความไทย จะตัดกลางคำ/กลางสระ — ใช้ `word-break: normal; overflow-wrap: break-word;`
6. 🟡 ตั้ง `lang="th"` ที่ `<html>` (ทำแล้วใน `app/layout.tsx`) และใส่ `lang="en"` ครอบเฉพาะข้อความอังกฤษยาวๆ
7. 🟡 หลีกเลี่ยงการจัดข้อความไทยแบบ `justify`
8. 🟡 ความยาวบรรทัดที่อ่านสบาย: **60–75 ตัวอักษร** (`max-w-prose` / `max-w-md`) สำหรับบทความ/ประกาศ
9. 🔴 ตัวเลขทุกที่ที่เป็นคอลัมน์หรือสถิติ ต้องใช้ `tabular-nums`

```css
/* base ใน app/globals.css + app/layout.tsx */
body {
  background: var(--color-background);
  color: var(--color-on-surface);
  font-family: var(--font-body);
}
/* <html lang="th" class="... antialiased"> */
```

---

## 5. Layout, Grid และ App Shell

### 5.1 โครงหน้าจอบังคับ (App Shell)

ทุกหน้าของทุกระบบย่อย **ต้อง** ถูกครอบด้วย `<CsmjuAppShell>` จาก design system

> **สถานะปัจจุบัน:** ใน `csmju-core-hub/frontend` ยังเป็น 2 shell แยกกัน คือ `app/(portal)/PortalShell.tsx` (นักศึกษา) และ `app/backoffice/BackofficeShell.tsx` (ผู้ดูแล) — `<CsmjuAppShell>` ต้องให้หน้าตาตามสเปคด้านล่างซึ่งสรุปจาก 2 ไฟล์นี้ (ใช้แบบ BackOffice เป็นหลัก)

```tsx
import { CsmjuAppShell } from "@csmju2030/design-system";

export default function Layout({ children }) {
  return (
    <CsmjuAppShell
      subsystemName="csmju-equipment"        // ต้องตรงกับ subsystem.yaml
      displayName="ระบบครุภัณฑ์"              // ตาม data-dictionary §4
      nav={[
        { label: "ภาพรวม", labelEn: "Overview", href: "/", icon: "dashboard" },
        { label: "รายการครุภัณฑ์", labelEn: "Items", href: "/equipment-items", icon: "inventory" },
        { label: "การยืม-คืน", labelEn: "Borrow", href: "/borrow-records", icon: "swap" },
      ]}
    >
      {children}
    </CsmjuAppShell>
  );
}
```

**หน้าตาของ AppShell (ห้ามทำเอง ห้าม override):**

| องค์ประกอบ | สเปค (ตามเว็บปัจจุบัน) |
|---|---|
| Sidebar | กว้าง `256px` (`w-64`) พื้น `brand-gradient` + `shadow-xl` ตรึงซ้าย เต็มความสูง (`h-dvh`) |
| โลโก้ | โลโก้ CSMJU บนกรอบขาว (`rounded-xl bg-white p-4 shadow-sm`) ด้านบนของ sidebar |
| ปุ่มกลับ CSMJU Portal | ใต้โลโก้ (เหนือปุ่มหลัก): ลิงก์ `<a>` ไป `CORE_HUB_WEB_URL` (env · ห้าม hardcode) ไอคอน `ArrowBackIcon` + "กลับ CSMJU Portal" `text-white/80 hover:bg-white/10` · มีทุกระบบ — ส่ง `coreHubUrl` ให้ `CsmjuAppShell` |
| ปุ่มหลักของระบบ (ถ้ามี) | ปุ่ม gradient เต็มความกว้างใต้โลโก้ เช่น "+ สร้างประกาศใหม่" |
| เมนู | ไอคอน 20px + ชื่อไทย (`text-label-md`) + ชื่ออังกฤษจาง (`text-caption text-white/50`) · ปกติ `text-white/70` hover `bg-white/5 text-white` · active `border-l-4 border-accent bg-white/10 text-white` + `aria-current="page"` |
| ปุ่มออกจากระบบ | ล่างสุดของ sidebar: `rounded-lg border border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20` + ไอคอน logout · เป็น**ฟอร์ม `POST /auth/logout`** ของระบบนี้ ไม่ใช่ลิงก์ (`auth-contract.md` ข้อ 5) · เมนูด้านบนเลื่อนได้ในตัว (`overflow-y-auto`) ให้ปุ่มนี้อยู่ในจอเสมอ |
| Top bar | สูง `64px` (`h-16`) พื้นขาว `border-b border-surface-variant shadow-sm` sticky บนสุด |
| ค้นหา (desktop) | กลาง top bar กว้างสูงสุด `max-w-md` ทรง `rounded-full` พื้น `surface` + ไอคอนแว่นขยายซ้าย |
| แจ้งเตือน | ปุ่มไอคอนวงกลม + จุดแดง `h-2 w-2 bg-error` มุมขวาบนเมื่อมีรายการใหม่ |
| เมนูผู้ใช้ | avatar วงกลม `h-9 w-9 bg-primary-container text-white` แสดงอักษรย่อ + ชื่อบทบาท (desktop) |
| มือถือ (<768px) | sidebar กลายเป็น drawer เลื่อนจากซ้าย (300ms) + scrim `bg-black/40` · top bar มีปุ่ม ☰ + ชื่อแอป `text-gradient` |
| พื้นที่เนื้อหา | `max-w-[1280px] mx-auto` padding `16px` → `48px` (md) ระยะระหว่าง block `32px` (`space-y-8`) |
| Footer | เส้นบน + ข้อความ copyright ซ้าย + ลิงก์ (ติดต่อเรา · นโยบายความเป็นส่วนตัว · ทำเนียบบุคลากร · ปฏิทินการศึกษา) ขวา |
| 401 handling | ดักจับ token หมดอายุ → refresh เงียบ → ถ้าไม่สำเร็จ redirect ไป Core (ตาม `auth-contract.md` §6) |
| Toast container | จุดแสดง toast มาตรฐาน *(ยังไม่มีในเว็บปัจจุบัน)* |
| Error boundary | จับ error ที่หลุดมาแล้วแสดงหน้า error มาตรฐาน *(ยังไม่มี)* |
| Skip link | "ข้ามไปยังเนื้อหาหลัก" สำหรับผู้ใช้คีย์บอร์ด *(ยังไม่มี)* |
| Breadcrumb | *(ยังไม่มีในเว็บปัจจุบัน — ใช้ชื่อหน้าใน PageHeader แทน)* |

> **ความต่างของ Portal (นักศึกษา) ที่ยังไม่รวม:** โลโก้เป็นวงกลม · active ใช้ `border-white` และมุม `rounded-r-lg` · top bar แสดงเฉพาะมือถือ (desktop ใช้ปุ่มไอคอนวงกลมข้างชื่อหน้าแทน) · footer พื้นขาวมีหัวข้อ "Computer Science, Maejo University"

> **เหตุผลที่ต้องบังคับ:** ปุ่ม "ออกจากระบบ" และ "กลับหน้าหลัก" ต้องอยู่ตำแหน่งเดิมทั้ง 37 ระบบ ไม่งั้นผู้ใช้จะหลงทางทุกครั้งที่เปลี่ยนระบบ และถ้าแต่ละระบบเขียน 401 handling เอง จะเกิดปัญหาตรงตามที่ `auth-contract.md` เตือนไว้ (บางระบบเด้ง login ถี่เกินไป บางระบบไม่เด้งเลยจนกลายเป็นช่องโหว่)

### 5.2 โครงเนื้อหาภายในหน้า

```
┌────────────┬─────────────────────────────────────┐
│            │  Top bar (สูง 64px — ค้นหา/แจ้งเตือน/ผู้ใช้) │
│  Sidebar   ├─────────────────────────────────────┤
│  256px     │  PageHeader (ชื่อหน้า + คำอธิบาย)      │
│  brand-    │  ─────────────────────────────────── │
│  gradient  │  เนื้อหาของระบบย่อย                    │
│            │  (max-width 1280px, gap 32px)        │
│            ├─────────────────────────────────────┤
│ [ออกจากระบบ]│  Footer                              │
└────────────┴─────────────────────────────────────┘
```

- Sidebar กว้าง `256px` (ไม่มีโหมด collapse — มือถือเป็น drawer)
- ระยะห่างระหว่าง block หลัก `32px` · padding หน้า `48px` (desktop)
- PageHeader (`app/backoffice/_components/PageHeader.tsx`): ชื่อหน้า `font-display text-headline-lg text-on-surface` + คำอธิบาย 1 บรรทัด `text-body-md text-on-surface-variant` + `fade-slide-up` · ปุ่ม action หลักของหน้าวางชิดขวาในแถบเครื่องมือของการ์ด (ข้างช่องค้นหา/ตัวกรอง)
- หัว section ฝั่ง Portal: `border-l-4 border-primary-container pl-3 font-display text-headline-md` + ลิงก์ "ดูทั้งหมด" ชิดขวา

### 5.3 Grid

- ใช้ CSS Grid / Flexbox เท่านั้น ❌ ห้ามคำนวณ layout ด้วย JavaScript
- gap ของการ์ดในกริด `24px` (`gap-6`) · ระหว่างคอลัมน์ใหญ่ `32px` (`gap-8`) · Quick Access `16px` (`gap-4`)
- การ์ดสถิติ: 1 คอลัมน์ (base) → 3 (md)
- การ์ดข่าว: 1 → 2 (md)
- Quick Access: 2 → 4 (md)
- Dashboard: 1 คอลัมน์ → 3 คอลัมน์ (xl, เนื้อหาหลัก `col-span-2` + คอลัมน์ข้าง 1)

---

## 6. Responsive & Touch

### 6.1 กฎบังคับ

| กฎ | ค่า |
|---|---|
| ความกว้างอ้างอิงต่ำสุดที่ต้องไม่พัง | **360px** |
| พื้นที่กดขั้นต่ำ (touch target) | **44 × 44px** (รวม padding) และห่างกันอย่างน้อย 8px |
| font-size ของ `<input>` บนมือถือ | **≥16px** (ถ้าเล็กกว่านี้ iOS Safari จะซูมหน้าจออัตโนมัติ) |
| Horizontal scroll ของทั้งหน้า | ❌ ห้ามมีเด็ดขาด (ยกเว้นในกล่องตารางที่ตั้งใจให้เลื่อน) |
| Safe area (iPhone มีรอยบาก) | ต้องใช้ `env(safe-area-inset-*)` กับแถบล่างที่ fixed |

### 6.2 พฤติกรรมการปรับตัว

| ส่วน | Mobile (<768) | Tablet / Desktop (≥768) |
|---|---|---|
| Sidebar | Drawer เลื่อนจากซ้าย (เปิดด้วยปุ่ม ☰, ปิดด้วย ✕ / แตะ scrim / เลือกเมนู) | แสดงถาวร 256px |
| Top bar | ปุ่ม ☰ + ชื่อแอป + แจ้งเตือน/ผู้ใช้ | ช่องค้นหากลาง + แจ้งเตือน/ผู้ใช้ |
| ตาราง | เลื่อนแนวนอนภายในการ์ด (`overflow-x-auto`) + `whitespace-nowrap` ในคอลัมน์สั้น | ตารางเต็ม |
| แถบค้นหา/ตัวกรอง | ซ้อนเป็นแนวตั้ง (`flex-col`) ปุ่มเพิ่มอยู่ล่างสุด | แถวเดียว (`md:flex-row`) ตัวกรองกว้าง `md:w-48` |
| ฟอร์ม | 1 คอลัมน์ | 1 คอลัมน์ (ใน modal) |
| Modal | กึ่งกลาง padding รอบ `16px` เต็มความกว้างที่เหลือ | กึ่งกลาง `max-w-md` (448px) |
| Padding หน้า | `16px` | `48px` |

> 🟡 **แนะนำ:** ตารางข้อมูลบนมือถือ ให้แปลงเป็นการ์ด (แต่ละแถว = 1 การ์ด แสดง 3–4 ฟิลด์สำคัญ + ปุ่มดูรายละเอียด) ดีกว่าบังคับให้ผู้ใช้เลื่อนซ้ายขวา — component `<DataTable responsive="cards">` รองรับให้แล้ว

### 6.3 ต้องทดสอบจริงก่อนส่ง PR

ทดสอบอย่างน้อย: **360×640 (Android ทั่วไป) · 390×844 (iPhone) · 768×1024 (iPad แนวตั้ง) · 1280×800 · 1920×1080** และทดสอบ **แนวนอนบน tablet** ด้วย

---

## 7. Component Library

> **กฎ:** ถ้ามี component ในรายการนี้แล้ว **ห้ามเขียนเอง** ห้าม copy โค้ดมาแก้ใน repo ตัวเอง (fork = หนี้ทางเทคนิคที่อัปเดตตามส่วนกลางไม่ได้)
> ถ้าของที่มีไม่พอใช้ → ทำตามกระบวนการข้อ 17.4 (ขอ component ใหม่)

### 7.1 รายการ component (v1.0.0)

**Layout**
`CsmjuAppShell` · `Container` · `PageHeader` · `Section` · `Card` · `Grid` · `Divider` · `Breadcrumb`

**Action**
`Button` · `IconButton` · `Link` · `ButtonGroup` · `DropdownMenu`

**Form**
`FormField` (wrapper: label + hint + error) · `TextInput` · `TextArea` · `Select` · `MultiSelect` · `Checkbox` · `Radio` · `Switch` · `DatePicker` (พ.ศ.) · `TimePicker` · `FileUpload` · `SearchInput` · `NumberInput`

**Data display**
`DataTable` · `Pagination` · `StatCard` · `Badge` · `StatusDot` · `Tag` · `Avatar` · `EmptyState` · `Timeline` · `DescriptionList` · `Tabs` · `Accordion`

**Feedback**
`Toast` · `Alert` (inline) · `Modal` · `ConfirmDialog` · `Drawer` · `Skeleton` · `Spinner` · `ProgressBar` · `Tooltip` · `ErrorState`

**Auth/Permission**
`Can` (แสดงตามสิทธิ์) · `RoleBadge` · `UserMenu` · `RequireRole`

**Utility (ไม่ใช่ UI แต่บังคับใช้)**
`formatDate` · `formatDateTime` · `formatMoney` · `formatNumber` · `useApi` (ห่อ envelope + error mapping ให้แล้ว)

### 7.2 สเปค `Button` (ตัวอย่างมาตรฐานที่ทุก component ต้องมีระดับนี้)

class ที่ใช้จริงอยู่ใน `app/backoffice/_components/ui.ts` — ห้ามเขียน class ปุ่มเองในหน้า ให้ import ค่าคงที่เหล่านี้

| variant | ค่าคงที่ใน `ui.ts` | หน้าตา | ใช้เมื่อ | จำนวนต่อพื้นที่ |
|---|---|---|---|---|
| `primary` | `primaryButtonClass` | `btn-gradient` (น้ำเงิน→ฟ้า) ตัวอักษรขาว `shadow-md` · hover ขยาย `scale(1.02)` + เลื่อน gradient · active `scale(.98)` | การกระทำหลัก (บันทึก, + เพิ่ม…, เข้าสู่ระบบ) | **สูงสุด 1** |
| `secondary` | `secondaryButtonClass` | พื้นโปร่งใส ขอบ `outline-variant` ตัวอักษร `on-surface-variant` · hover `bg-surface-variant/50` | ยกเลิก, การกระทำรอง | ไม่จำกัด |
| `danger` | `dangerButtonClass` | พื้น `error` ตัวอักษรขาว · hover `opacity-90` | ยืนยันการลบใน ConfirmDialog | เท่าที่จำเป็น |
| `tonal` | — (ยังเป็นค่าดิบใน Dashboard) | `bg-primary-container/10 text-primary-container` · hover `/20` | ลิงก์ที่ต้องการน้ำหนักระดับปุ่ม เช่น "ดูตารางสอนแบบเต็ม" | ไม่จำกัด |
| `on-dark` | — (ใน shell) | `border-white/25 bg-white/10 text-white backdrop-blur-sm` · hover `bg-white/20` | ปุ่มบนพื้น `brand-gradient` เช่น ออกจากระบบ | — |
| `link` | — | `text-primary-container` + `hover:underline` (ในหน้า Login ใช้ `link-hover text-primary` = เส้นใต้วิ่ง) | "ดูทั้งหมด", ลิงก์นำทาง | — |
| `icon` | `iconButtonClass` / `iconDangerButtonClass` | ไอคอน 20px สี `outline` padding `6px` · hover `text-primary-container` (แก้ไข) หรือ `text-error` (ลบ) | ปุ่มจัดการในแถวตาราง | — |
| `icon-round` | — (ใน shell) | `rounded-full p-2` ไอคอน 24px · hover `bg-surface-variant/50` | แจ้งเตือน, เมนูผู้ใช้, ☰ | — |

**ร่วมกันทุกปุ่มข้อความ:** `rounded-lg` · `text-label-md` (14px/600) · ไอคอนนำหน้า 16px (`h-4 w-4`) ห่าง `gap-2`

| size | padding | สูงโดยประมาณ | ใช้ที่ |
|---|---|---|---|
| ปกติ | `px-4 py-2.5` | ~37px | ปุ่มในการ์ด, modal, ฟอร์ม |
| ใหญ่ | `py-3` เต็มความกว้าง (`w-full`) | ~41px | ปุ่มหน้า Login, ปุ่มใน sidebar |

> ⚠️ ความสูงทั้งสองขนาดยังต่ำกว่า touch target 44px (ข้อ 6.1) — บนมือถือให้เพิ่มเป็น `py-3.5` หรือ `min-h-11`

**สถานะที่ต้องมีครบทุกปุ่ม (ขาดข้อใดข้อหนึ่ง = ไม่ผ่าน review):**
`default` · `hover` · `active` · `focus-visible` (วงแหวน 2px + offset 2px — **ยังไม่มีใน `ui.ts` ต้องเพิ่ม** `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container`) · `disabled` (`disabled:opacity-40 disabled:cursor-not-allowed`) · `loading` (เพิ่ม class `btn-loading` → ข้อความ `.btn-text` จางหายและแสดงจุด 3 จุด `.dots` เด้ง + `aria-busy="true"` + กดซ้ำไม่ได้)

```tsx
<button type="submit" className={`${primaryButtonClass} relative ${loading ? "btn-loading" : ""}`} aria-busy={loading}>
  <span className="btn-text flex items-center gap-2">เข้าสู่ระบบ</span>
  <span className="dots" aria-hidden><span /><span /><span /></span>
</button>
```

**ลำดับปุ่มในกลุ่ม:** ชิดขวา (`flex justify-end gap-3`) · ปุ่มรอง/ยกเลิกอยู่ซ้าย ปุ่มหลัก/อันตรายอยู่ขวาสุด → `[ยกเลิก] [บันทึก]` · `[ยกเลิก] [ลบ]`

**กฎการเขียนข้อความบนปุ่ม:** ใช้คำกริยาที่บอกผลลัพธ์ — "บันทึกการเปลี่ยนแปลง" ไม่ใช่ "ตกลง" · "ยืมครุภัณฑ์" ไม่ใช่ "ส่ง"

### 7.2.1 สเปค component อื่นที่มีในเว็บแล้ว

| Component | ไฟล์ / class | สเปค |
|---|---|---|
| **Input / Select** | `inputClass` | `w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-md` · placeholder `outline/70` · focus ขอบ `#3B80F2` + วงแหวน `0 0 0 3px rgba(59,128,242,.2)` · error เพิ่ม `input-error` (ขอบ/ตัวอักษร `error` + วงแหวนแดง) และ `shake-anim` · มีไอคอนนำหน้าให้เพิ่ม `pl-10` และวางไอคอน 20px สี `outline` ที่ `left-3` |
| **Label** | — | `text-label-md text-on-surface` อยู่เหนือ input ห่าง `8px` (`space-y-2` / `gap-2`) |
| **Checkbox** | `.custom-checkbox` | 16×16px มุม 4px ขอบ `outline-variant` · ติ๊กแล้วพื้น `primary` + เครื่องหมายขาว + animation `pop` |
| **Card** | `cardClass` | `rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm` · หัวการ์ด `px-6 py-5 border-b border-outline-variant/40` + ชื่อ `font-display text-headline-md` |
| **StatCard** | `app/backoffice/page.tsx` | การ์ดมาตรฐาน สูง `160px` (`h-40`) `p-6` · label `text-label-md on-surface-variant` ซ้ายบน · กล่องไอคอน `rounded-lg p-2.5 bg-primary-container/10 text-primary-container` ขวาบน (เน้น = `bg-btn-gradient text-white`) · ตัวเลข `font-display text-display-lg text-primary-container` + `tabular-nums` (ยังไม่มีในโค้ด ต้องเพิ่ม) · trend `text-label-sm text-secondary` |
| **Badge สถานะ** | `StatusBadge.tsx` | `inline-flex rounded-full px-2.5 py-1 text-label-sm` + จุดสี `h-2 w-2 rounded-full` ด้านหน้า · สีตาม tone ในข้อ 3.1 |
| **Tag หมวดหมู่** | — | เหมือน badge แต่ไม่มีจุด · เน้น `bg-primary-container/10 text-primary-container` / ปกติ `bg-surface-variant text-on-surface-variant` · บนรูปปก `bg-primary-container text-white text-caption font-semibold px-3` |
| **Tabs** | `Tabs.tsx` | แถบ `border-b border-outline-variant/40` · tab `px-4 py-3 text-label-md border-b-2` · เลือก `border-primary-container text-primary-container` · ไม่เลือก `text-on-surface-variant hover:text-on-surface` · ตัวนับ pill `rounded-full px-2 py-0.5 text-label-sm` · `role="tablist"` / `role="tab"` / `aria-selected` |
| **Modal** | `Modal.tsx` | scrim `bg-black/40` · กล่อง `max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-xl fade-slide-up` · หัว `font-display text-headline-md` + ปุ่ม ✕ (`aria-label="ปิด"`) ขวาบน · ปิดด้วย `Esc` / คลิก scrim |
| **ConfirmDeleteModal** | `Modal.tsx` | ข้อความ `text-body-md on-surface-variant` (ชื่อรายการเป็น `<strong class="text-on-surface">`) · ถ้าลบไม่ได้แสดงกล่อง `bg-error-container text-on-error-container` + ปุ่มลบ disabled · ปุ่ม `[ยกเลิก] [ลบ]` |
| **Avatar** | shell | วงกลม `h-9 w-9 bg-primary-container text-white text-label-md` อักษรย่อ + ขอบ `outline-variant/50` |
| **Quick Access tile** | `app/(portal)/page.tsx` | `rounded-xl border border-surface-variant bg-surface-container-lowest p-6` จัดกึ่งกลาง · วงกลมไอคอน `h-12 w-12 bg-surface-container text-primary-container` · hover ขอบ `primary-container` + `shadow-md` |
| **Timeline (ตารางเรียน)** | `app/(portal)/page.tsx` | จุด 24px ขอบขาว 4px (ปัจจุบัน = `brand-gradient` + จุดขาว) · เส้นเชื่อม `surface-container` 2px · การ์ดย่อย `rounded-lg p-4` รายการที่ผ่านไป `opacity-80` |

### 7.3 กฎร่วมของทุก component

1. ทุก component ต้องรับ `className` เพื่อปรับ layout ได้ แต่ **ห้ามใช้ override สี/ฟอนต์/radius**
2. ทุก component ที่โต้ตอบได้ต้องมี `focus-visible` ที่มองเห็น
3. ทุก component ที่รับข้อมูล async ต้องมี prop `loading` และ `error`
4. ห้ามใส่ margin ไว้ในตัว component เอง (ให้ parent จัดการระยะห่าง)
5. ทุก component ต้องรองรับ `ref` และ props ของ HTML element เดิม

---

## 8. Pattern มาตรฐาน

### 8.1 ฟอร์ม

- 🔴 ทุก input ต้องมี `<label>` ที่มองเห็นได้ **ห้ามใช้ placeholder แทน label** (พอพิมพ์แล้ว label หายไป ผู้ใช้ลืมว่าช่องนี้คืออะไร และ screen reader อ่านไม่ได้)
- 🔴 ฟิลด์บังคับ ทำเครื่องหมาย `*` + `aria-required="true"` และเขียนกำกับหัวฟอร์มว่า "ช่องที่มี * จำเป็นต้องกรอก"
- 🔴 ฟอร์ม 1 คอลัมน์เป็นค่าเริ่มต้น (2 คอลัมน์เฉพาะฟิลด์สั้นที่สัมพันธ์กัน เช่น ชื่อ/นามสกุล, วันเริ่ม/วันสิ้นสุด)
- 🔴 Validate ตอน `blur` (ออกจากช่อง) ไม่ใช่ตอนพิมพ์ทุกตัวอักษร; validate ทั้งฟอร์มตอนกดส่ง
- 🔴 error ของฟิลด์ต้องอยู่ **ใต้ฟิลด์นั้น** สีแดง + ไอคอน + ผูกด้วย `aria-describedby`
- 🔴 กดส่งแล้วมี error → เลื่อนหน้าจอไปที่ฟิลด์ผิดตัวแรก + `focus()` ให้อัตโนมัติ + ประกาศจำนวน error ผ่าน `aria-live`
- 🔴 ปุ่มส่งอยู่ **ล่างขวา** ของฟอร์มเสมอ (`flex justify-end gap-3 pt-2` → `[ยกเลิก] [บันทึก]`) ทุกระบบต้องเรียงลำดับเหมือนกัน
- ระยะระหว่างฟิลด์ `16px` (`space-y-4`) · label↔input `8px` · error ของทั้งฟอร์มแสดงเหนือแถวปุ่มด้วย `text-label-sm text-error`
- 🟡 ฟอร์มยาว > 8 ฟิลด์ → แบ่งเป็นกลุ่มด้วย `<fieldset>` + `<legend>`
- 🟡 ถ้ามีข้อมูลที่ยังไม่บันทึกแล้วผู้ใช้จะออกจากหน้า → ต้องเตือน

### 8.2 ตาราง (DataTable)

- ตารางอยู่ในการ์ดมาตรฐาน (`cardClass`) · แถบเครื่องมือด้านบน `px-6 py-5 border-b` = ช่องค้นหา (ไอคอนแว่นขยาย) + ตัวกรอง (select `md:w-48`) + ปุ่มหลัก "+ เพิ่ม…" ชิดขวา
- `<table class="w-full border-collapse text-left">` ห่อด้วย `overflow-x-auto`
- หัวตาราง: แถว `border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant` · เซลล์ `thClass` = `px-6 py-4 font-semibold whitespace-nowrap`
- แถว: `border-b border-outline-variant/40 last:border-0` · hover `bg-surface/50` · เนื้อหา `text-body-md` · เซลล์ `tdClass` = `px-6 py-4` (สูงประมาณ 58px)
- คอลัมน์แรก (ชื่อ/รหัส) `font-medium text-on-surface` · คอลัมน์รอง `text-on-surface-variant`
- คอลัมน์ตัวเลข/เงิน/รหัสชิดขวาหรือใช้ `tabular-nums`
- คอลัมน์ "จัดการ" อยู่ขวาสุดเสมอ (`text-right`) ใช้ `iconButtonClass` (แก้ไข) / `iconDangerButtonClass` (ลบ) + `aria-label` ที่ระบุชื่อรายการ เช่น `แก้ไข ${title}`
- ไม่พบข้อมูล: แถวเดียว `colSpan` เต็ม `px-6 py-12 text-center text-on-surface-variant`
- 🔴 ทุกตารางต้องมี: pagination (default 20/หน้า ตาม `api-conventions.md` §5), ช่องค้นหา, สถานะว่าง, สถานะ loading (skeleton แถว)
- 🔴 การเรียงลำดับต้องส่งไปให้ backend ไม่ใช่เรียงในหน้าเว็บ (ไม่งั้นเรียงผิดเมื่อมีหลายหน้า)
- 🟡 เลือกได้หลายแถว → แสดงแถบ action ลอยด้านล่างพร้อมจำนวนที่เลือก

### 8.3 Modal / Dialog

- ใช้เมื่อ: ยืนยันการกระทำ, ฟอร์มสั้น (≤5 ฟิลด์), ดูรายละเอียดย่อ
- ❌ ห้ามใช้กับ: ฟอร์มยาว, flow หลายขั้นตอน, เนื้อหาที่ควรมี URL ของตัวเอง
- หน้าตา: ดู `Modal` ในข้อ 7.2.1 (กว้างสูงสุด 448px, `rounded-xl`, `p-6`, `shadow-xl`, scrim `bg-black/40`)
- 🔴 ต้อง: กัก focus ไว้ในกล่อง (focus trap), ปิดด้วย `Esc`, คืน focus กลับจุดเดิมเมื่อปิด, `role="dialog"` + `aria-modal="true"` + `aria-labelledby` — `Modal.tsx` ปัจจุบันมี `Esc` + role/aria ครบแล้ว **แต่ยังไม่มี focus trap และไม่คืน focus** ต้องเพิ่ม
- 🔴 การลบต้องใช้ `ConfirmDialog` เสมอ และข้อความยืนยันต้องระบุ **ชื่อของสิ่งที่จะลบ** และผลที่ตามมา

```
ลบครุภัณฑ์ "โปรเจกเตอร์ EPSON EB-2250U"?
รายการนี้จะถูกลบถาวร ประวัติการยืมที่เกี่ยวข้อง 12 รายการจะยังคงอยู่
[ยกเลิก]  [ลบครุภัณฑ์]   ← ปุ่มยืนยันเป็น danger และเขียนคำกริยาจริง ไม่ใช่ "ตกลง"
```

### 8.4 การแจ้งผลลัพธ์: เลือกให้ถูกที่

| สถานการณ์ | ใช้ | ตำแหน่ง | ระยะเวลา |
|---|---|---|---|
| บันทึกสำเร็จ | Toast (success) | มุมขวาบน (desktop) / บนสุด (mobile) | 4 วินาที |
| ผิดพลาดของทั้งฟอร์ม | Alert inline | บนสุดของฟอร์ม | ค้างไว้ |
| ผิดพลาดของฟิลด์เดียว | ข้อความใต้ฟิลด์ | ใต้ฟิลด์ | จนกว่าจะแก้ |
| ผิดพลาดของทั้งหน้า | ErrorState | แทนที่เนื้อหา | ค้างไว้ + ปุ่มลองใหม่ |
| ต้องการการตัดสินใจ | ConfirmDialog | กลางจอ | จนกว่าจะเลือก |

🔴 Toast ต้องมี `role="status"` (สำเร็จ) หรือ `role="alert"` (ผิดพลาด) และ **ห้ามใช้ toast แจ้ง error ที่ผู้ใช้ต้องแก้ไข** (มันหายไปก่อนที่ผู้ใช้จะอ่านจบ)

---

## 9. สถานะหน้าจอ: Loading / Empty / Error

> ส่วนนี้เชื่อมกับ `api-conventions.md` §4 โดยตรง — **AI ที่พัฒนาระบบย่อยต้อง map error.code เป็น UI ตามตารางนี้เท่านั้น ห้ามคิดเอง**

### 9.1 Loading

| ระยะเวลา | สิ่งที่แสดง |
|---|---|
| < 300ms | ไม่ต้องแสดงอะไร (การกระพริบทำให้รู้สึกช้ากว่าเดิม) |
| 300ms – 3s | **Skeleton** ที่มีรูปร่างใกล้เคียงเนื้อหาจริง (❌ ไม่ใช่ spinner กลางจอ) |
| > 3s | Skeleton + ข้อความ "กำลังโหลดข้อมูล..." |
| การกระทำในปุ่ม | ปุ่มเข้าสถานะ `loading` (ห้าม disable ทั้งหน้า) |

### 9.2 Empty State (บังคับทุกที่ที่แสดงรายการ)

ต้องมี 3 องค์ประกอบ: **ไอคอน/ภาพเบาๆ + อธิบายว่าทำไมว่าง + ปุ่มทางออก**

```
[ไอคอนกล่องเปล่า]
ยังไม่มีรายการครุภัณฑ์
เริ่มต้นด้วยการเพิ่มครุภัณฑ์ชิ้นแรกของภาควิชา
[+ เพิ่มครุภัณฑ์]
```

แยกให้ชัดระหว่าง **"ยังไม่มีข้อมูล"** (ชวนให้สร้าง) กับ **"ค้นหาแล้วไม่พบ"** (ชวนให้ล้างตัวกรอง) — เป็นคนละข้อความ

### 9.3 ตาราง Mapping จาก `error.code` → UI (🔴 บังคับ)

| `error.code` | HTTP | UI ที่ต้องแสดง | ข้อความมาตรฐาน (ไทย) |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | **ห้ามแสดงอะไรให้ผู้ใช้เห็น** — AppShell จะ refresh token เงียบๆ ก่อน ถ้าไม่สำเร็จจึง redirect ไปหน้า login ของ Core | (ไม่มี — ผู้ใช้ไม่ควรรู้ตัว) |
| `FORBIDDEN` | 403 | หน้า/การ์ด "ไม่มีสิทธิ์" + ปุ่ม "กลับหน้าหลัก" + ลิงก์ "ขอสิทธิ์เข้าใช้งาน" | "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบย่อยนี้" |
| `NOT_FOUND` | 404 | EmptyState (ไม่ใช่ error สีแดง) + ปุ่มย้อนกลับ | "ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง" |
| `VALIDATION_ERROR` | 422 | ข้อความใต้ฟิลด์ที่ระบุใน `error.details.field` + เลื่อนไปหาฟิลด์นั้น | ใช้ `error.message` จาก API โดยตรง (backend เขียนมาเป็นไทยแล้ว) |
| `CONFLICT` | 409 | Alert inline หรือ Modal อธิบายความขัดแย้ง + ทางเลือกถัดไป | "ข้อมูลถูกแก้ไขโดยผู้ใช้อื่นแล้ว กรุณารีเฟรชและลองใหม่" / กรณีของถูกยืม: "ครุภัณฑ์นี้ถูกยืมไปแล้ว" |
| `INTERNAL_ERROR` | 500 | ErrorState เต็มพื้นที่ + ปุ่ม "ลองอีกครั้ง" + รหัสอ้างอิง (request id) | "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง หากยังพบปัญหา กรุณาแจ้งผู้ดูแลระบบพร้อมรหัส: XXXX" |
| ไม่มีเน็ต / timeout | — | Alert + ปุ่มลองใหม่ | "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง" |
| Rate limit | 429 | Alert + บอกเวลาที่ลองได้อีกครั้ง (จาก header `X-RateLimit-Reset`) | "มีการใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" |

**ข้อห้ามเด็ดขาด:** ❌ แสดง stack trace, ชื่อฟิลด์ในฐานข้อมูล, SQL, ชื่อ service ภายใน, หรือข้อความภาษาอังกฤษดิบจาก exception ให้ผู้ใช้เห็น

### 9.4 หลักการเขียนข้อความ error

ข้อความ error ที่ดีมี 3 ส่วน: **เกิดอะไรขึ้น → ทำไม → ต้องทำอะไรต่อ**

| ❌ ไม่เอา | ✅ เอาแบบนี้ |
|---|---|
| "เกิดข้อผิดพลาด" | "บันทึกไม่สำเร็จ เพราะรหัสครุภัณฑ์นี้มีอยู่แล้ว กรุณาใช้รหัสอื่น" |
| "Invalid input" | "วันที่คืนต้องอยู่หลังวันที่ยืม" |
| "ขออภัยค่ะ ระบบมีปัญหานิดหน่อยนะคะ 🥺" | "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง" |

น้ำเสียง: สุภาพ ตรงไปตรงมา ไม่ขอโทษพร่ำเพรื่อ ไม่โทษผู้ใช้ ไม่ใช้ emoji

---

## 10. UI ตามสิทธิ์ Layer 1 / Layer 2

> อ้างอิง `auth-contract.md` §5 — gateway ส่ง `X-User-Id`, `X-Layer1-Role`, `X-Faculty` มาให้ backend
> **ฝั่ง frontend ห้ามตัดสินใจเรื่องความปลอดภัยเอง** — UI ทำหน้าที่แค่ "ไม่แสดงสิ่งที่ผู้ใช้ทำไม่ได้" เพื่อประสบการณ์ที่ดี ส่วนการบังคับสิทธิ์จริงต้องอยู่ที่ backend เสมอ

### 10.1 ซ่อน (hide) หรือ ปิดใช้งาน (disable)?

| สถานการณ์ | ทำอย่างไร |
|---|---|
| ผู้ใช้ **ไม่มีสิทธิ์** ในฟีเจอร์นั้นเลย (เช่น Guest เห็นปุ่ม "ลบครุภัณฑ์") | **ซ่อน** — การแสดงสิ่งที่กดไม่ได้ตลอดกาลสร้างความสับสน |
| ผู้ใช้ **มีสิทธิ์** แต่ทำไม่ได้ในสถานะปัจจุบัน (เช่น ยืมของที่ถูกยืมอยู่) | **disable + tooltip บอกเหตุผล** |
| ทั้งหน้าที่ผู้ใช้เข้าไม่ได้ | หน้า 403 ตามข้อ 9.3 |
| ระบบย่อยทั้งระบบที่ผู้ใช้ไม่มีสิทธิ์ | ไม่แสดงไอคอนบน Dashboard ของ Core (Core จัดการให้) |

### 10.2 การใช้งานในโค้ด

```tsx
import { Can, useCsmjuUser } from "@csmju2030/design-system";

const { username, layer1Role, layer2Role, faculty } = useCsmjuUser();
// layer2Role มาจาก API ของระบบย่อยเอง (ตาม data-dictionary §2)

<Can role={["admin", "editor"]}>
  <Button variant="primary">เพิ่มครุภัณฑ์</Button>
</Can>

<Button
  variant="secondary"
  disabled={item.status !== "available"}
  disabledReason="ครุภัณฑ์นี้ถูกยืมอยู่ กำหนดคืน 20 ส.ค. 2569"
>
  ยืมครุภัณฑ์
</Button>
```

🔴 `disabled` ต้องมาคู่กับ `disabledReason` เสมอ (component จะ render เป็น tooltip + `aria-describedby` ให้) — ปุ่มที่กดไม่ได้โดยไม่บอกเหตุผลคือบั๊กด้าน UX

### 10.3 การแสดงบทบาทผู้ใช้

- ใช้ `<RoleBadge>` เท่านั้น เพื่อให้สีและคำเรียกตรงกันทุกระบบ
- คำเรียกภาษาไทยมาตรฐานของ `layer1_role` (🔴 ห้ามแปลเอง):

| ค่า | คำที่แสดง |
|---|---|
| `student` | นักศึกษา |
| `alumni` | ศิษย์เก่า |
| `staff` | บุคลากร/อาจารย์ |
| `admin` | ผู้ดูแลระบบ |

- ถ้าผู้ใช้มีสิทธิ์ Layer 2 ที่สูงกว่าปกติในระบบย่อยนั้น ให้แสดง badge กำกับในหน้าแรกของระบบย่อย เช่น `นักศึกษา · ผู้ดูแลระบบครุภัณฑ์` เพื่อให้ผู้ใช้เข้าใจว่าทำไมตนเองเห็นเมนูมากกว่าเพื่อน

---

## 11. Microcopy & รูปแบบข้อมูลภาษาไทย

### 11.1 น้ำเสียง

สุภาพแบบมืออาชีพ · กระชับ · เป็นกลาง · ไม่ใช้คำราชการเยิ่นเย้อ · ไม่ใช้ภาษาการตลาด · ไม่ใช้ emoji · ไม่ใช้ครับ/ค่ะ ในข้อความระบบ (ใช้ได้เฉพาะข้อความต้อนรับ)

### 11.2 คำมาตรฐาน (🔴 ห้ามใช้คำอื่น)

| การกระทำ | คำที่ใช้ | ห้ามใช้ |
|---|---|---|
| บันทึกข้อมูล | บันทึก | เซฟ, ยืนยัน, ตกลง, Submit |
| ยกเลิกการกระทำ | ยกเลิก | ปิด, ย้อนกลับ, ไม่ |
| ลบถาวร | ลบ | นำออก, ทิ้ง |
| เพิ่มรายการใหม่ | เพิ่ม… / สร้าง… | New, Add |
| แก้ไข | แก้ไข | อัปเดต, Edit |
| ค้นหา | ค้นหา | Search, หา |
| ตัวกรอง | ตัวกรอง | ฟิลเตอร์, Filter |
| ล้างตัวกรอง | ล้างตัวกรอง | รีเซ็ต |
| ออกจากระบบ | ออกจากระบบ | Logout, ล็อกเอาต์ |
| ดูรายละเอียด | ดูรายละเอียด | รายละเอียด, More |
| ส่งคำขอ | ส่งคำขอ | ขอ, Request |

### 11.3 รูปแบบวันที่ / เวลา / ตัวเลข / เงิน (🔴 บังคับใช้ util)

> **สำคัญ:** `data-dictionary.md` §5 กำหนดรูปแบบ **สำหรับส่งข้อมูล** (ISO 8601, เงินเป็นสตางค์)
> เอกสารนี้กำหนดรูปแบบ **สำหรับแสดงผล** ห้ามแปลงเอง ต้องเรียก util จาก package เท่านั้น

| ประเภท | ค่าจาก API | แสดงผล | ฟังก์ชัน |
|---|---|---|---|
| วันที่ (มาตรฐาน) | `2026-08-11` | `11 ส.ค. 2569` | `formatDate(v)` |
| วันที่ (เต็ม) | `2026-08-11` | `11 สิงหาคม 2569` | `formatDate(v, "long")` |
| วันที่+เวลา | `2026-08-11T09:30:00+07:00` | `11 ส.ค. 2569 09:30 น.` | `formatDateTime(v)` |
| เวลาอย่างเดียว | — | `09:30 น.` | `formatTime(v)` |
| เวลาสัมพัทธ์ | — | `3 ชั่วโมงที่แล้ว` (ใช้เฉพาะ ≤7 วัน) | `formatRelative(v)` |
| เงิน | `15000` (สตางค์) | `150.00 บาท` | `formatMoney(v)` |
| จำนวน | `2450` | `2,450` | `formatNumber(v)` |
| เบอร์โทร | `"0812345678"` | `081-234-5678` | `formatPhone(v)` |

**กฎ พ.ศ./ค.ศ.:** แสดงผล **พ.ศ. เป็นค่าเริ่มต้น** ทุกที่ · ส่งข้อมูล **ค.ศ. (ISO) เสมอ**
🔴 ห้ามปนกันในหน้าเดียว (ตัวอย่างหน้าจอที่ส่งมามีปัญหานี้ — ดูภาคผนวก 19.1)
🔴 timezone ตรึงที่ `Asia/Bangkok` เสมอ ห้ามใช้ timezone ของเครื่องผู้ใช้

### 11.4 หัวข้อหน้าและ title ของแท็บ

```
<ชื่อหน้า> · <ชื่อระบบย่อย> · CSMJU
เช่น: รายการครุภัณฑ์ · ระบบครุภัณฑ์ · CSMJU
```

---

## 12. Accessibility (WCAG 2.1 ระดับ AA)

> เป็นสถาบันการศึกษาของรัฐ — เรื่องนี้เป็นข้อกำหนด ไม่ใช่ทางเลือก และ CI จะตรวจอัตโนมัติ

### 12.1 ข้อบังคับ

1. **HTML เชิงความหมาย** — `<button>` สำหรับการกระทำ, `<a>` สำหรับการนำทาง ❌ ห้ามใช้ `<div onClick>`
2. **โครงสร้างหัวเรื่อง** — `h1` หนึ่งตัวต่อหน้า ไล่ระดับตามลำดับ ห้ามข้าม (h1 → h3 ไม่ได้)
3. **Landmark** — `<header> <nav> <main> <footer>` และ `<main id="main">` สำหรับ skip link
4. **Contrast** — ข้อความปกติ ≥ 4.5:1 · ข้อความใหญ่ (≥18.66px bold / 24px) ≥ 3:1 · ขอบของ UI component ≥ 3:1
5. **Focus** — ทุกอย่างที่ interact ได้ต้องมี focus ที่มองเห็น ❌ ห้าม `outline: none` โดยไม่มีของแทน
6. **Keyboard** — ใช้งานได้ครบทุกฟังก์ชันโดยไม่ใช้เมาส์ · ลำดับ Tab ตรงกับลำดับสายตา · ไม่มี keyboard trap (ยกเว้น modal ที่ตั้งใจ)
7. **Label** — ทุก input มี label · ปุ่มไอคอนล้วนมี `aria-label`
8. **รูปภาพ** — มี `alt` ที่มีความหมาย · รูปตกแต่งใช้ `alt=""` + `aria-hidden="true"`
9. **ห้ามสื่อความหมายด้วยสีอย่างเดียว** — สถานะต้องมีข้อความ/ไอคอนกำกับ
10. **เนื้อหาที่เปลี่ยนแบบ async** ต้องประกาศผ่าน `aria-live="polite"` (หรือ `assertive` สำหรับ error)
11. **ซูม 200%** แล้วต้องยังใช้งานได้ ไม่มีเนื้อหาหาย
12. **เคารพ `prefers-reduced-motion`**

### 12.2 วิธีทดสอบก่อนส่ง PR (ทำจริง 5 นาที)

- [ ] กด `Tab` ตั้งแต่บนสุดจนล่างสุด — เห็นกรอบ focus ทุกจุด ลำดับสมเหตุสมผล
- [ ] ทำงานหลักของหน้าให้จบโดยไม่แตะเมาส์
- [ ] ซูมเบราว์เซอร์ 200% — ไม่มีอะไรทับหรือหาย
- [ ] รัน Lighthouse Accessibility → ต้อง **≥ 95**
- [ ] รัน axe DevTools → ต้อง **0 critical / 0 serious**
- [ ] เปิด screen reader (NVDA/VoiceOver) อ่านหน้า form 1 หน้า ฟังว่าเข้าใจได้ไหม

---

## 13. Dark mode 🟢

Light mode คือประสบการณ์หลัก dark mode เป็นทางเลือก (Phase 2) — **เว็บปัจจุบันยังไม่มี dark mode** ค่าด้านล่างเป็นร่างเดิม ต้องทบทวนให้เข้ากับ palette ปัจจุบัน (`primary-container` `#2154D9`) ก่อนใช้จริง และต้องประกาศเป็น token ชื่อเดียวกับข้อ 3.1

| Token | ค่า |
|---|---|
| canvas | `#0B1220` |
| surface | `#111C2E` |
| surface-muted | `#1A2740` |
| border | `#243449` |
| text | `#F8FAFC` |
| text-body | `#CBD5E1` |
| text-muted | `#94A3B8` |
| primary | `#60A5FA` (สว่างขึ้นเพื่อ contrast) |
| primary-soft | `#132C4D` |

❌ ห้ามกลับสีทุกอย่างแบบอัตโนมัติ (`filter: invert`) · ❌ ห้ามใช้ดำสนิท `#000000` · เงาใน dark mode ต้องลดลงและใช้เส้นขอบแทน

---

## 14. Icon & รูปภาพ

**ไอคอน:** ใช้ชุดไอคอนกลางใน `app/components/icons.tsx` (inline SVG, `viewBox 0 0 24 24`, `stroke="currentColor"`, `strokeWidth 1.8`, ปลายเส้นมน, ตั้งชื่อตาม Material Symbols เช่น `EditIcon`, `DeleteIcon`, `NotificationsIcon`) — ถ้าต้องการไอคอนใหม่ให้เพิ่มในไฟล์นี้ด้วยสไตล์เดียวกัน · หรือใช้ `lucide-react` แทนทั้งระบบ (อนุญาตตั้งแต่ 1.2.1 · ตั้ง `strokeWidth={1.8}` ให้เส้นเท่าชุดกลาง) · ขนาด `16 / 20 / 24px` (`h-4` / `h-5` / `h-6`) · สีตาม `currentColor` · ห้ามผสมสองชุดในระบบเดียวกัน และห้ามใช้ชุดอื่นนอกจากสองชุดนี้ · ห้ามใช้ไอคอนตกแต่งที่ไม่มีความหมาย · ไอคอนล้วนต้องมี `aria-label` · ไอคอนประกอบข้อความใช้ `aria-hidden="true"`

**รูปภาพ:**
- อัตราส่วนมาตรฐาน: `16:9` (ข่าว/แบนเนอร์) · `4:3` (กิจกรรม) · `1:1` (avatar)
- ฟอร์แมต WebP/AVIF พร้อม fallback · lazy load ทุกภาพที่อยู่ใต้ fold · ต้องระบุ `width`/`height` เพื่อกัน layout shift
- ใช้ภาพจริงของ ม.แม่โจ้ / ห้องแล็บ / กิจกรรมภาควิชา ❌ หลีกเลี่ยงภาพ stock องค์กรทั่วไป
- Avatar ที่ไม่มีรูป → แสดงอักษรย่อสีขาวบนพื้น `primary-container`
- รูปปกข่าวที่ยังไม่มีรูป → พื้น `brand-gradient` + ไอคอน `text-white/25` สูง `192px` (`h-48`)

### 14.1 โลโก้ CSMJU

**ไฟล์ปัจจุบัน:** `public/csmju-logo.png` — โลโก้เต็ม (สัญลักษณ์ C + ตัวอักษร "COMPUTER SCIENCE / Maejo University") PNG พื้นโปร่งใส 8192×5789px (~435KB) สีน้ำเงินบนพื้นโปร่งใส

**ระบบย่อยไม่ต้องใส่โลโก้เอง** — โลโก้อยู่ใน `<CsmjuAppShell>` (sidebar) และหน้า Login ของ Core อยู่แล้ว ระบบย่อยจะใช้โลโก้เฉพาะกรณีพิเศษ เช่น หน้าพิมพ์เอกสาร/ใบรับรอง/รายงาน PDF

**การแจกจ่าย (แผน):**
1. PM เก็บไฟล์ต้นฉบับไว้ที่ repo มาตรฐาน `csmju2030-standards/assets/brand/` (ไฟล์ vector `.svg` / `.ai` จากผู้ออกแบบ + PNG ที่ export แล้ว)
2. ใส่ไฟล์ที่ใช้บนเว็บไว้ใน package `@csmju2030/design-system/assets/logo/` และมี component `<CsmjuLogo variant="full | mark" tone="color | white" />` ให้เรียกใช้ — ห้ามระบบย่อย copy ไฟล์โลโก้ไปเก็บใน `public/` ของตัวเอง (พอโลโก้เปลี่ยนจะไม่ตรงกันทั้ง 37 ระบบ)
3. ระหว่างที่ package ยังไม่พร้อม ให้ดาวน์โหลดจาก `csmju-core-hub/frontend/public/csmju-logo.png` และแสดงผ่าน `next/image` ตามตัวอย่างด้านล่าง

**ชุดไฟล์ที่ต้องมี** (🟡 ยังไม่มี ต้องขอจากผู้ออกแบบ)

| ไฟล์ | ใช้เมื่อ |
|---|---|
| `csmju-logo-full.svg` | โลโก้เต็ม — ความกว้างแสดงผล ≥ 120px (sidebar, หน้า Login, เอกสารพิมพ์) |
| `csmju-logo-mark.svg` | เฉพาะสัญลักษณ์ C — ขนาดเล็กกว่า 120px (header มือถือ, กรอบวงกลม, favicon) เพราะตัวอักษรในโลโก้เต็มจะอ่านไม่ออก |
| `csmju-logo-white.svg` | สีขาวล้วน — วางบนพื้นเข้มโดยไม่ต้องมีกรอบขาว |
| `favicon.ico` / `icon.png` 512px | favicon และไอคอนแอป (ทำจาก mark) |

**กฎการใช้**
- 🔴 ขนาดแสดงผลขั้นต่ำของโลโก้เต็ม **120px** กว้าง · เล็กกว่านี้ใช้ mark เท่านั้น
- 🔴 บนพื้น `brand-gradient` หรือพื้นเข้ม → วางบนกรอบขาว (`rounded-xl bg-white p-4 shadow-sm`) หรือใช้ไฟล์สีขาว ❌ ห้ามวางโลโก้สีน้ำเงินบนพื้นน้ำเงินตรงๆ
- 🔴 เว้นที่ว่างรอบโลโก้อย่างน้อยเท่ากับความสูงของตัวอักษร "C" เล็ก (ประมาณ 1/4 ของความสูงโลโก้)
- ❌ ห้ามยืด/บีบสัดส่วน (ใช้ `object-contain` + `h-auto` เสมอ) · ห้ามเปลี่ยนสี · ห้ามใส่เงา/ขอบ/effect · ห้ามหมุน · ห้ามครอบตัดบางส่วนของโลโก้เต็ม
- ❌ ห้ามใส่โลโก้เต็มในกรอบวงกลมขนาดเล็ก (เช่น 48px) — ตัวอักษรจะเล็กจนอ่านไม่ออก ให้ใช้ mark แทน
- 🔴 `alt` มาตรฐาน: `"โลโก้ สาขาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยแม่โจ้"` (ถ้ามีชื่อระบบเป็นข้อความข้างโลโก้แล้ว ใช้ `alt=""`)

ใช้ component `CsmjuLogo` (`app/components/CsmjuLogo.tsx`) — ห้ามเรียก `<Image src="/csmju-logo.png">` เองในหน้า

```tsx
import { CsmjuLogo } from "@/csmju"; // ใน core hub: "@/app/components/CsmjuLogo" · อนาคต: "@csmju2030/design-system"

<CsmjuLogo />                          // พื้นสว่าง กว้าง 120px
<CsmjuLogo width={200} />              // ใหญ่ขึ้นได้ (เล็กกว่า 120px ไม่ได้ — component ปัดขึ้นให้)
<CsmjuLogo framed priority />          // บนพื้น brand-gradient/พื้นเข้ม → กรอบขาวอัตโนมัติ (แบบ sidebar BackOffice)
<CsmjuLogo decorative />               // มีชื่อระบบเป็นข้อความข้างโลโก้แล้ว → alt=""
```

| prop | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `width` | `120` | ความกว้างแสดงผล (px) ต่ำสุด 120 |
| `framed` | `false` | ครอบกรอบขาว `rounded-xl bg-white p-4 shadow-sm` |
| `decorative` | `false` | ตั้ง `alt=""` |
| `priority` | `false` | โหลดก่อน (ใช้เมื่อโลโก้อยู่ใน viewport แรก) |
| `className` | — | ปรับ layout เท่านั้น ห้ามใช้เปลี่ยนสี/ขนาดให้ต่ำกว่า 120px |

เมื่อได้ไฟล์ mark / white แล้ว ให้เพิ่ม prop `variant="full | mark"` และ `tone="color | white"` ใน component นี้ที่เดียว

> 📝 ไฟล์ PNG ปัจจุบันใหญ่เกินจำเป็น (8192px) — `next/image` ย่อให้ตอนเสิร์ฟได้ แต่ควร export ใหม่ที่กว้างไม่เกิน 1024px หรือเป็น SVG ก่อนแจกจ่าย และตอนนี้ sidebar ฝั่ง Portal / header มือถือ / หน้า Login ยังใส่โลโก้เต็มในกรอบ 32–48px ซึ่งผิดกฎขนาดขั้นต่ำ — เปลี่ยนเป็น mark เมื่อได้ไฟล์แล้ว

---

## 15. Performance Budget 🔴

วัดที่ **มือถือระดับกลาง + เครือข่าย 4G**

| ตัวชี้วัด | เกณฑ์ผ่าน |
|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5 วินาที |
| CLS (Cumulative Layout Shift) | ≤ 0.1 |
| INP (Interaction to Next Paint) | ≤ 200ms |
| JS bundle (แรกเข้า, gzip) | ≤ 250KB ต่อระบบย่อย |
| ฟอนต์ | ≤ 4 ไฟล์ / ≤ 200KB |
| Lighthouse Performance | ≥ 85 |
| Lighthouse Accessibility | ≥ 95 |

วิธีทำให้ผ่าน: code splitting ตาม route · `next/image` หรือเทียบเท่า · ไม่ import ทั้ง library เมื่อใช้ฟังก์ชันเดียว · ระบุขนาดภาพเสมอ · ใช้ skeleton ที่มีขนาดเท่าเนื้อหาจริงเพื่อกัน CLS

---

## 16. โครงสร้างโค้ด + ข้อห้าม

### 16.0 Stack บังคับของโครงการ 🔴

| ชั้น | เทคโนโลยี | หมายเหตุ |
|---|---|---|
| Frontend | **Next.js (App Router)** + TypeScript + Tailwind CSS | ห้ามใช้ Vite/Nuxt/CRA — CI ตรวจจาก `next.config` |
| Styling | **Tailwind CSS v4 เท่านั้น** | ใช้ utility class ใน `className` เป็นหลัก · CSS เขียนเองได้เฉพาะ class กลางใน `globals.css` (เช่น `btn-gradient`, `input-field`, `fade-slide-up`) ❌ ห้าม CSS Modules, Sass/SCSS, styled-components, Emotion, CSS-in-JS อื่น และ inline `style` สำหรับสี/ฟอนต์ |
| Backend | **NestJS** (TypeScript) | ต้องเปิด API ตาม `api-conventions.md` |
| Database | **PostgreSQL** | frontend **ห้าม** ต่อฐานข้อมูลตรง ต้องผ่าน API ของ NestJS เท่านั้น |
| Design system | `@csmju2030/design-system` | เป็น React component สำหรับ Next.js โดยเฉพาะ |

**เหตุผลที่ล็อก stack:** เมื่อทั้ง 37 ระบบใช้ชุดเดียวกัน design system ตัวเดียวใช้ได้ทุกที่, template repo ตัวเดียวใช้ได้ทุกที่, PL คนหนึ่งรีวิวได้ทุกระบบในทีม, และ AIE ที่ติดปัญหาสามารถถามเพื่อนอีก 36 คนได้เพราะเจอเรื่องเดียวกัน

> **สิ่งที่ยังอิสระ:** ORM (Prisma / TypeORM), data fetching (TanStack Query / SWR / fetch ตรง), state (Zustand / Context), form (React Hook Form / อื่นๆ), testing framework — เลือกได้ตามถนัด

### 16.1 โครงสร้างโปรเจกต์ (🔴 โครงหลัก / 🟡 รายละเอียดภายใน)

ระบบย่อย 1 ระบบ = 1 repo ที่มี `frontend/` + `backend/` (pnpm workspace) — โครงเต็มของทั้ง repo และฝั่ง `backend/` ดู [`repo-structure.md`](repo-structure.md) ข้อ 2 ด้านล่างนี้ขยายเฉพาะส่วนที่เกี่ยวกับหน้าจอ

```
csmju-<subsystem-name>/
├── subsystem.yaml              # 🔴 manifest (auth-contract §4, api-conventions §7)
├── standards/                  # 🔴 git submodule → csmju2030-standards
├── frontend/                   # Next.js — CI สแกนทั้งโฟลเดอร์นี้ (UI-01..04, SEC-03, ARC-01)
│   └── src/
│       ├── app/
│       │   ├── globals.css     # 🔴 token (@theme) จาก template — ห้ามแก้ (ข้อ 17.0)
│       │   ├── layout.tsx      # 🔴 ครอบด้วย <CsmjuAppShell> ที่นี่ที่เดียว
│       │   ├── page.tsx
│       │   ├── loading.tsx     # 🔴 skeleton
│       │   ├── error.tsx       # 🔴 ErrorState
│       │   ├── not-found.tsx   # 🔴 EmptyState
│       │   └── <resource>/     # โฟลเดอร์ = kebab-case ตรงกับ path ของ API
│       ├── csmju/              # 🔴 ของกลางจาก template (ช่วงเปลี่ยนผ่าน ข้อ 17.0) — ห้ามแก้
│       ├── components/
│       │   ├── features/       # component เฉพาะโดเมนของระบบนี้
│       │   └── shared/         # ใช้ซ้ำภายในระบบนี้
│       └── lib/
│           ├── api.ts          # ห่อ fetch + envelope + error mapping
│           └── permissions.ts  # mapping Layer 2 ของระบบนี้
└── backend/                    # NestJS — ดู repo-structure.md
    └── src/
        ├── main.ts
        ├── auth/               # คัดลอกจาก reference implementation
        ├── common/             # envelope, exception filter, DTO กลาง
        └── <domain>/           # controller + service + dto
```

> ใช้ `src/` ตามโครงนี้ — สคริปต์ตรวจ `DD-01` `DD-02` `DD-04` `DD-05` สแกนเฉพาะ `frontend/src` ถ้าวางโค้ดไว้นอก `src/` กฎเหล่านี้จะไม่ถูกตรวจ

> ❌ **ห้ามมีโฟลเดอร์ `components/ui/`** ที่สร้าง Button/Card/Modal ของตัวเอง — นั่นคือสัญญาณว่ากำลัง fork design system

### 16.1.1 กฎเฉพาะ Next.js (🔴)

| หัวข้อ | กฎ |
|---|---|
| Router | ใช้ **App Router** เท่านั้น (ห้าม Pages Router) เพื่อให้ `loading.tsx` / `error.tsx` ใช้แทน 3 สถานะบังคับได้ |
| `layout.tsx` ราก | เรียก `<CsmjuAppShell>` ที่นี่ที่เดียว ห้ามเรียกซ้ำในหน้าลูก |
| `loading.tsx` | ต้องเป็น **Skeleton จาก design system** ที่มีรูปร่างใกล้เคียงเนื้อหาจริง ❌ ห้ามเป็น spinner กลางจอ |
| `error.tsx` | ต้องเป็น `<ErrorState>` + ปุ่ม `retry()` ("ลองอีกครั้ง") — Next.js 16 ใช้ `retry` แทน `reset` ❌ ห้ามแสดง `error.message` ดิบ |
| `not-found.tsx` | ต้องเป็น `<EmptyState>` ไม่ใช่หน้า error สีแดง |
| Server / Client Component | เป็น Server Component เป็นค่าเริ่มต้น · ใส่ `"use client"` เฉพาะไฟล์ที่มี state/event จริง ❌ ห้ามใส่ที่ `layout.tsx` ราก |
| ฟอนต์ | ใช้ `next/font/google` หรือ `next/font/local` (ทั้งคู่ self-host ตอน build) ประกาศใน `app/layout.tsx` ที่เดียว ❌ ห้าม `<link>` ไป Google Fonts CDN |
| รูปภาพ | ใช้ `next/image` พร้อม `width`/`height` หรือ `fill`+`sizes` เสมอ (กัน CLS) |
| นำทาง | ใช้ `next/link` ❌ ห้ามใช้ `router.push` ใน `onClick` ของ `<div>` |
| metadata | ทุก route ต้อง export `metadata` ตามรูปแบบข้อ 11.4 |
| env | ค่าที่ขึ้นต้น `NEXT_PUBLIC_*` = เปิดเผยต่อสาธารณะ ❌ ห้ามใส่ `client_secret` หรือ token ใดๆ ในนั้นเด็ดขาด |
| `dynamic` / cache | ข้อมูลที่ขึ้นกับตัวตนผู้ใช้ต้อง `export const dynamic = "force-dynamic"` ❌ ห้าม cache หน้าที่มีข้อมูลส่วนบุคคล |

### 16.1.2 กฎฝั่ง NestJS ที่กระทบหน้าจอโดยตรง (🔴)

*(รายละเอียด API เต็มอยู่ใน `api-conventions.md` ส่วนนี้ระบุเฉพาะจุดที่ frontend พึ่งพา)*

1. ใช้ **global `TransformInterceptor`** ห่อ response ทุกตัวเป็น `{ success, data, meta }` — ห้ามให้ controller ส่ง object ดิบ
2. ใช้ **global `HttpExceptionFilter`** แปลง exception เป็น `{ success:false, error:{ code, message, details } }` โดย `code` ต้องอยู่ในรายการมาตรฐาน 6 ค่า
3. `ValidationPipe` + `class-validator` ต้องตั้งค่าให้ error ออกมาเป็น `VALIDATION_ERROR` พร้อม `details.field` เป็นชื่อฟิลด์เดียว — เพราะ **หน้าจอใช้ค่านี้ในการ focus ไปยังช่องที่ผิดโดยตรง** (ข้อ 9.3) ถ้าไม่ส่ง `details.field` มา frontend จะแสดง error ใต้ฟิลด์ไม่ได้
4. ข้อความใน `error.message` ต้องเป็น **ภาษาไทยที่ผู้ใช้อ่านรู้เรื่อง** เพราะ frontend แสดงตรงๆ ❌ ห้ามส่งข้อความ default ของ class-validator (`quantity must be a positive number`)
5. ชื่อคอลัมน์ใน PostgreSQL เป็น `snake_case` (ผ่าน `@map`/`@@map`) ส่วน field ใน DTO และ JSON เป็น `camelCase` ตาม `api-conventions.md` และ `data-dictionary.md` — frontend ใช้ชื่อตามที่ API ส่งมาตรง ๆ ไม่ต้องเขียน mapper
6. ผู้ใช้ต้องอ่านจาก header `X-User-Id` / `X-Layer1-Role` ที่ gateway แนบมา (`auth-contract.md` §5) ❌ ห้ามรับ `username` จาก body หรือ query ที่ frontend ส่งมา (ปลอมได้)
7. ต้องมี `/health` และประกาศ `public_endpoints` ใน `subsystem.yaml`

### 16.2 ข้อห้ามเด็ดขาด (พบใน PR = reject ทันที)

1. ❌ พิมพ์ hex สี, ค่า px ของ spacing/radius, ค่า ms ของ transition ลงในโค้ดโดยตรง
2. ❌ ติดตั้ง UI library อื่น (MUI, Ant Design, Bootstrap, Chakra, DaisyUI, shadcn ที่ copy เข้ามาเอง)
3. ❌ สร้างหน้า login / ฟอร์ม username-password ในระบบย่อย
4. ❌ เก็บ `access_token` ใน `localStorage` (ตามที่ Core กำหนด — ใช้กลไกของ AppShell เท่านั้น)
5. ❌ hardcode `client_secret` หรือ URL ของ API ในโค้ด (ใช้ env var)
6. ❌ hardcode รายการคณะ (backend ต้องเรียก `GET /api/v1/faculties` ของ Core Hub ตาม `reference-data.md` — หน้าเว็บเรียกผ่าน API ของระบบย่อยเอง)
7. ❌ เขียน 401/refresh logic เอง
8. ❌ ใช้ `!important` (ยกเว้นใน media query ของ reduced-motion)
9. ❌ ใช้ inline `style={{...}}` สำหรับสี/ฟอนต์ (ใช้ได้เฉพาะค่าที่คำนวณตอน runtime เช่น ความสูงกราฟ)
10. ❌ ใช้ `<div onClick>` แทนปุ่ม
11. ❌ ตั้งชื่อฟิลด์ในหน้าเว็บไม่ตรงกับ `data-dictionary.md` (เช่นเรียก `student_id` แทน `username`)
12. ❌ แก้ไฟล์ใน `node_modules/@csmju2030/*`
13. ❌ โหลดฟอนต์หรือ script จาก CDN ภายนอกด้วย `<link>`/`<script>` (`next/font/google` ใช้ได้ เพราะ self-host ตอน build)
14. ❌ ใส่ emoji ในหน้าจอระบบ
15. ❌ ใช้ Pages Router, Vite, Nuxt หรือ framework อื่นนอกจาก Next.js App Router
16. ❌ ต่อ PostgreSQL จากฝั่ง Next.js โดยตรง (ต้องผ่าน API ของ NestJS เท่านั้น)
17. ❌ ใส่ความลับใดๆ ในตัวแปรที่ขึ้นต้นด้วย `NEXT_PUBLIC_`
18. ❌ ให้ ORM แปลงชื่อฟิลด์เป็น camelCase ตอนส่ง response

---

## 17. กระบวนการทำงาน

### 17.0 ช่วงเปลี่ยนผ่าน: ยังไม่ประกาศใช้ package `@csmju2030/design-system` 🔴

**`@csmju2030/design-system` คืออะไร:** ชื่อ **npm package** ที่วางแผนไว้ให้เป็นที่รวม UI กลาง (token สี/ฟอนต์, `CsmjuAppShell`, `CsmjuLogo`, ปุ่ม, Modal, ไอคอน ฯลฯ) ให้ทั้ง 37 ระบบติดตั้งแล้วอัปเดตพร้อมกัน — **ยังไม่ประกาศใช้** ทุกที่ในเอกสารนี้ที่อ้างถึง package นี้, `npx create-csmju-subsystem` หรือ `npx csmju-check-standards` คือแผนในอนาคต

> ⚠️ repo `CSMJU2030/design-system` มี **v1.3.0** (7 ก.ย. 2569) อยู่ใน GitHub Packages แต่สร้างตามเอกสารนี้ก่อนเวอร์ชัน 1.3.0 จึง**ขัดกับมาตรฐานปัจจุบัน**:
> สีหลัก `#004C99` (ปัจจุบัน `primary-container` `#2154D9`) · กฎ `DS-08` ห้าม `next/font/google` (ข้อ 4.1 ให้ใช้ `next/font`) ·
> `CsmjuAppShell` / `createCsmjuAuthRoutes` เรียก `/oauth/token` ซึ่ง Core Hub ไม่มี และเก็บ refresh token ในระบบย่อย (ผิด `auth-contract.md` ข้อ 2 และ 7) · แบ่งหน้าด้วย `per_page` (ผิด `api-conventions.md`) — **ห้ามใช้** ระบบที่ติดตั้งไปแล้วให้ถอดออก

**ระหว่างนี้ให้ใช้ template [`templates/csmju-subsystem-web/`](../templates/csmju-subsystem-web/) ของ repo มาตรฐานนี้** — มากับ submodule `standards/` ของทุกระบบ
(ตรงกับเวอร์ชันใน `.standards-version` เสมอ ไม่ต้องขอสิทธิ์ repo อื่น) · มีของกลางชุดเดียวกับหน้าเว็บ Core Hub ในโฟลเดอร์ `src/csmju/` ·
ปุ่มออกจากระบบเป็นฟอร์ม `POST /auth/logout` และ `next.config.ts` ส่ง `/api/*` กับ `/auth/*` ไป backend ตาม `auth-contract.md` ข้อ 5 แล้ว

| ในเอกสารเขียนว่า | ช่วงนี้ให้ใช้ |
|---|---|
| `npm install @csmju2030/design-system` | ระบบใหม่ — จากรากของ repo ระบบย่อย: `cp -R standards/templates/csmju-subsystem-web/. frontend/` แล้ว `pnpm install` · ระบบที่มี `frontend/` แล้ว — copy เฉพาะ `src/csmju/`, `src/app/globals.css`, `public/csmju-logo.png` แล้วต่อเข้ากับของเดิมตาม `README.md` ของ template (ห้ามทับ `package.json` / `next.config.ts` ทั้งไฟล์ · ห้ามใช้ `npm` เพราะจะได้ `package-lock.json` ซึ่งผิด `QA-05`) |
| `npx create-csmju-subsystem …` | copy template (ข้างบน) |
| `import { … } from "@csmju2030/design-system"` | `import { … } from "@/csmju"` |
| `import "@csmju2030/design-system/styles.css"` | มีแล้วใน `src/app/globals.css` ของ template |
| `@csmju2030/design-system/icons` | `import { EditIcon, … } from "@/csmju"` |
| `npm update @csmju2030/design-system` | เลื่อน `standards/` ตาม [`standards-versioning.md`](standards-versioning.md) แล้ว copy `src/csmju/`, `src/app/globals.css`, `public/csmju-logo.png` จาก `standards/templates/csmju-subsystem-web/` ทับของเดิมใน `frontend/` (ห้าม merge ทีละบรรทัด) |

**ของที่มีใน `@/csmju` แล้ว:** `CsmjuAppShell` · `CsmjuLogo` · `PageHeader` · `Modal` · `ConfirmDeleteModal` · `Tabs` · `StatusBadge` · ไอคอนทั้งหมด · class ใน `ui.ts` (`primaryButtonClass`, `secondaryButtonClass`, `dangerButtonClass`, `inputClass`, `cardClass`, `thClass`, `tdClass`, `iconButtonClass`, `iconDangerButtonClass`) และตัวอย่าง `loading.tsx` / `error.tsx` / `not-found.tsx` ใน `src/app/`

**ของในข้อ 7.1 ที่ยังไม่มี** (เช่น `DataTable`, `Toast`, `EmptyState`, `FormField`, `DatePicker`, `Can`, `formatDate`): ให้ประกอบในโฟลเดอร์ `components/` ของระบบตัวเองจาก class ใน `ui.ts` + token เท่านั้น ถือเป็น local component ชั่วคราว (ระบุใน `subsystem.yaml` → `local_components`) และส่งคำขอตามข้อ 17.4 เพื่อให้ PM ย้ายเข้าส่วนกลาง

**กฎ:**
- ❌ ห้ามแก้ไฟล์ใน `src/csmju/` และ `src/app/globals.css` ในระบบย่อย (เท่ากับการ fork design system) — ต้องแก้ที่ `templates/csmju-subsystem-web/` ของ repo มาตรฐานผ่าน PR แล้วแจกจ่ายในเวอร์ชันถัดไป
- ❌ ห้ามติดตั้งหรือ import `@csmju2030/design-system` จนกว่า PM จะประกาศใช้
- เมื่อ package พร้อม: ลบโฟลเดอร์ `src/csmju/` แล้วเปลี่ยน `from "@/csmju"` เป็น `from "@csmju2030/design-system"` ทั้งโปรเจกต์ (template ตั้งชื่อ export ให้ตรงกันไว้แล้ว)

**ขั้นตอนของ AIE ช่วงนี้:**
1. copy template → แก้พอร์ตใน `package.json` และ `BACKEND_URL` ใน `.env` → แก้ `TODO` ใน `src/app/layout.tsx` (ชื่อระบบ, เมนู, ผู้ใช้จาก `GET /api/v1/me`)
2. เปิดแชต AI ใหม่ → วาง system prompt ข้อ 20.1 + แนบเอกสารนี้ (Claude Code / Cursor / Copilot อ่าน `AGENTS.md` ของ template ให้อัตโนมัติ)
3. สั่งงานทีละหน้าด้วยข้อ 20.2 → ตรวจด้วยข้อ 20.3 ก่อนเปิด PR

### 17.1 Design Review Gates (PL เป็นผู้ตรวจ)

| Gate | เมื่อไหร่ | ส่งอะไร | ผู้อนุมัติ |
|---|---|---|---|
| **G0 — Scoping** | ก่อนเริ่มเขียนโค้ด | รายการหน้าจอทั้งหมด + user flow หลัก + ระบุว่าใครเห็นอะไร (Layer 2 mapping) | PL |
| **G1 — Wireframe** | ก่อนลงสี | โครงหน้าจอหลัก 3 หน้า (ทั้ง desktop + mobile) วาดมือ/Figma/HTML ก็ได้ | PL |
| **G2 — Token compliance** | PR แรก | หน้าจอจริง + ผล CI ผ่าน | PL + CI |
| **G3 — A11y & Responsive** | ก่อน merge เข้า main | ผล Lighthouse + axe + ภาพหน้าจอ 360px/768px/1280px | PL |
| **G4 — Sign-off** | ก่อนขึ้น production | ตรวจครบ Definition of Done (ข้อ 18) | PL + PM |

### 17.2 CI ตรวจอัตโนมัติทุก PR

```yaml
# .github/workflows/ui-compliance.yml (จาก template ส่วนกลาง)
jobs:
  ui-compliance:
    steps:
      - next build             # ต้อง build ผ่านโดยไม่มี type error (strict mode)
      - csmju-ui-lint          # ตรวจ hex/px ดิบ, ตรวจว่ามี AppShell, ตรวจ import จาก UI lib ต้องห้าม,
                               # ตรวจว่ามี loading.tsx / error.tsx / not-found.tsx ครบทุก route segment,
                               # ตรวจว่าไม่มี <link> ไป fonts.googleapis.com และไม่มีความลับใน NEXT_PUBLIC_*
      - eslint-jsx-a11y        # ตรวจ accessibility ระดับโค้ด
      - lighthouse-ci          # Performance ≥85, A11y ≥95
      - axe-ci                 # 0 critical / 0 serious
      - standards-version-check # เทียบ standards_version ใน subsystem.yaml กับเวอร์ชันล่าสุด
```

**นโยบายเวอร์ชัน:** ถ้า `standards_version` ในระบบย่อยตามหลังเวอร์ชันปัจจุบันเกิน **1 minor version** → CI ขึ้นคำเตือน · ตามหลังเกิน **1 major version** → CI fail และห้าม deploy ขึ้น production

### 17.3 ขั้นตอนที่ AIE ต้องทำ *ทุกครั้ง* ก่อนเริ่มงาน

```bash
# 0. เริ่มระบบใหม่จาก template ส่วนกลางเท่านั้น (ครั้งแรกครั้งเดียว)
npx create-csmju-subsystem csmju-<ชื่อระบบ>   # ได้ Next.js + NestJS + design system + CI มาครบ

# 1. ให้ standards/ ตรงกับเวอร์ชันใน .standards-version เสมอ (ห้ามข้าม · ห้ามใส่ --remote)
git submodule update --init standards/
npm update @csmju2030/design-system

# 2. เช็คว่าเวอร์ชันตรงกับที่ประกาศใน subsystem.yaml ไหม
npx csmju-check-standards

# 3. อ่าน CHANGELOG ของ design system (เฉพาะส่วนที่ใหม่กว่าเวอร์ชันเดิม)
cat standards/CHANGELOG.md

# 4. ป้อน ui-design-system.md (system prompt ข้อ 20.1) ให้ AI ของตัวเองอ่านก่อนสั่งงาน
# 5. เริ่มพัฒนาใน feature branch
git checkout -b feature/equipment/borrow-return-ui
```

### 17.4 ขอ component / token ใหม่ (เมื่อของที่มีไม่พอ)

เดินตามแบบเดียวกับ `data-dictionary.md` §7:

1. AIE เขียนคำขอ: **ปัญหาที่เจอ → หน้าจอที่ต้องการ → เหตุผลว่าทำไมของเดิมไม่พอ → ภาพร่าง** ส่งให้ PL
2. PL กลั่นกรอง: ใช้ของเดิมประกอบกันได้ไหม? มีระบบอื่นเจอปัญหาเดียวกันไหม?
3. PL ส่งต่อ PM (design system) ผ่าน issue template `component-request`
4. PM ตัดสิน 3 ทาง:
   - **เข้าส่วนกลาง** → PM ทำใน design system ปล่อยเป็น minor version + แจ้งทุก repo
   - **ทำเองในระบบย่อยได้** → อนุมัติเป็น local component พร้อมข้อจำกัด (ต้องใช้ token ส่วนกลาง)
   - **ไม่อนุมัติ** → แนะนำวิธีใช้ของเดิมแทน
5. **SLA: PM ตอบภายใน 3 วันทำการ** (ห้ามให้ AIE รอจนงานค้าง — ถ้าเกิน SLA ให้ทำเป็น local component ไปก่อนแล้วค่อยรวมทีหลัง)

### 17.5 การอัปเดตเวอร์ชันมาตรฐาน (semver)

| ประเภท | ตัวอย่าง | ระบบย่อยต้องทำอะไร |
|---|---|---|
| **PATCH** (1.0.x) | แก้บั๊ก, แก้สีให้ contrast ผ่าน | `npm update` ก็จบ |
| **MINOR** (1.x.0) | เพิ่ม component/token ใหม่ | อัปเดตเมื่อสะดวก ภายใน 1 sprint |
| **MAJOR** (x.0.0) | เปลี่ยน API ของ component, ลบ token | PM ต้องประกาศล่วงหน้า ≥ 2 สัปดาห์ + มี migration guide + ของเดิมต้อง deprecated (ยังใช้ได้แต่ขึ้นคำเตือน) อย่างน้อย 1 minor cycle ก่อนลบจริง |

ทุกการเปลี่ยนแปลงต้องบันทึกใน `CHANGELOG.md` และแจ้งผ่านช่องทาง PL → AIE

---

## 18. Definition of Done + PR Checklist

### 18.1 หน้าจอ 1 หน้าจะถือว่า "เสร็จ" เมื่อ

- [ ] มีครบทั้ง 4 สถานะ: loading (skeleton) / empty / error / success
- [ ] ใช้งานได้จริงบนความกว้าง 360px โดยไม่มี horizontal scroll
- [ ] ใช้งานได้ครบด้วยคีย์บอร์ดอย่างเดียว
- [ ] ทุกปุ่ม/ลิงก์มีสถานะ hover / focus / active / disabled
- [ ] ทุกข้อความเป็นภาษาไทยตามคำมาตรฐานข้อ 11.2
- [ ] วันที่/เงิน/ตัวเลข ผ่าน util เท่านั้น
- [ ] error ทุกเคส map ตามตารางข้อ 9.3
- [ ] สิทธิ์ Layer 2 ถูกซ่อน/disable ถูกต้องตามข้อ 10
- [ ] Lighthouse A11y ≥ 95, Performance ≥ 85
- [ ] มีภาพหน้าจอ 3 ขนาดแนบใน PR

### 18.2 Checklist ก่อนขอ merge PR (AIE ตรวจเองก่อนส่ง PL)

- [ ] `npm update @csmju2030/design-system` แล้ว และ `standards_version` ใน `subsystem.yaml` ตรงกับเวอร์ชันจริง
- [ ] ไม่มี hex สี (`[#...]`) / ค่า arbitrary ของ spacing ในโค้ด (grep เองรอบหนึ่ง)
- [ ] ไม่มี UI library / CSS-in-JS อื่นใน `package.json` และโหลดฟอนต์ผ่าน `next/font` เท่านั้น
- [ ] ทุก route segment มี `loading.tsx` / `error.tsx` / `not-found.tsx` ครบ
- [ ] `next build` ผ่านโดยไม่มี type error และไม่มี warning เรื่อง Client Component ที่ไม่จำเป็น
- [ ] ไม่มีความลับในตัวแปร `NEXT_PUBLIC_*` และไม่มีการต่อ PostgreSQL จากฝั่ง Next.js
- [ ] ทุกหน้าอยู่ใน `<CsmjuAppShell>`
- [ ] ไม่มีหน้า login / ไม่มี logic refresh token ที่เขียนเอง
- [ ] ทุก input มี `<label>` ที่มองเห็นได้
- [ ] ทุก `IconButton` มี `aria-label`
- [ ] ทุก `disabled` มี `disabledReason`
- [ ] เนื้อความไทยใช้ `text-body-*` (line-height 1.6) และไม่มี `letter-spacing` ติดลบ / `uppercase` กับข้อความไทย
- [ ] ทดสอบจริงบน Chrome + Safari (iOS) + Android อย่างน้อยอย่างละ 1 เครื่อง
- [ ] CI สีเขียวทุกข้อ
- [ ] แนบภาพหน้าจอ mobile / tablet / desktop ใน PR description

---

## 19. ภาคผนวก

### 19.1 วิเคราะห์หน้าจอตัวอย่างที่มีอยู่ (สำหรับใช้ประกอบการนำเสนอ)

ทีมได้จัดทำ mockup ไว้ 3 หน้า (Login, Student Dashboard, Admin Panel) ทิศทางภาพรวม **ถูกต้องและใช้เป็นต้นแบบได้** แต่มีประเด็นที่ต้องแก้ก่อนยกเป็นมาตรฐาน:

| # | สิ่งที่พบ | ทำไมต้องแก้ | การแก้ | สถานะในเว็บปัจจุบัน |
|---|---|---|---|---|
| 1 | หน้า Dashboard แสดง "15 พ.ย. 2024" แต่หน้า Admin แสดง "15 ต.ค. 2567" | ปน ค.ศ./พ.ศ. ในระบบเดียวกัน ผู้ใช้สับสนเรื่องปีทันที | บังคับ `formatDate()` ทุกที่ แสดง พ.ศ. เสมอ (ข้อ 11.3) | ✅ วันที่เป็น พ.ศ. ทั้งสองหน้าแล้ว (แต่ footer ยังเป็น "© 2026") |
| 2 | Footer เขียน "University Department of Excellence" | เป็น placeholder ภาษาอังกฤษที่ไม่ใช่ชื่อจริงของหน่วยงาน | ใช้ชื่อจริง: สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ + ปีปัจจุบัน (footer มาจาก AppShell) | 🟡 เป็น "Computer Science, Maejo University" แล้ว แต่ยังเป็นภาษาอังกฤษ |
| 3 | หน้า Login มีฟอร์ม username/password อยู่ในระบบย่อย | ขัดกับ `auth-contract.md` §1 โดยตรง | หน้านี้เป็นของ **Core เท่านั้น** (login.csmju2030.ac.th) ระบบย่อยห้ามลอกไปทำ | ✅ หน้า Login อยู่ใน core hub |
| 4 | ปุ่ม "New Announcement" เป็นภาษาอังกฤษ ปนกับเมนู Overview/Students/Faculty/News/Settings | ผู้ใช้หลักเป็นนักศึกษาไทย ปนภาษาไม่มีหลักเกณฑ์ | เมนูและปุ่มเป็นภาษาไทย | ✅ ปุ่ม "สร้างประกาศใหม่" · เมนูไทยตัวหลัก + อังกฤษตัวเล็กจาง |
| 5 | ตัวเลขสถิติ (2,450 / 185 / 12) ยังไม่ระบุ `tabular-nums` | ตัวเลขจะขยับเวลาค่าเปลี่ยน | ใช้ `<StatCard>` ซึ่งตั้ง `tabular-nums` ให้แล้ว | ❌ ยังไม่มี |
| 6 | การ์ดสถิติใบที่ 3 ใช้พื้นน้ำเงินเข้มขณะที่อีก 2 ใบเป็นสีขาว | ถ้าไม่มีเหตุผลเชิงความหมาย จะกลายเป็นการเน้นแบบสุ่ม | ใช้พื้นเน้นเฉพาะการ์ดที่ "ต้องการการดำเนินการ" และต้องมีข้อความบอกเหตุผล | ✅ เน้นเฉพาะกล่องไอคอน + ข้อความ "ต้องการการตรวจสอบ 2 รายการ" |
| 7 | ไอคอนแก้ไข/ลบ ในตารางเป็นไอคอนล้วน | screen reader อ่านไม่ออก | เพิ่ม `aria-label="แก้ไขประกาศ ..."` (ระบุชื่อรายการด้วย) | ✅ มี `aria-label` พร้อมชื่อรายการ |

> ประโยคสรุปสำหรับสไลด์: *"mockup สวยแล้ว แต่ยังไม่ใช่ระบบ — สิ่งที่ทำให้ 37 ระบบเป็นแอปเดียวกันคือกฎ ไม่ใช่ภาพ"*

### 19.2 ตัวอย่าง `subsystem.yaml` ส่วนที่เกี่ยวกับ UI

```yaml
name: csmju-equipment
display_name: "ระบบครุภัณฑ์"
owner: 6xxxxxxxx-somchai
standards_version: "1.1.0"        # เวอร์ชันของ ui-design-system.md ที่พัฒนาตาม
stack:
  frontend: "next@15"
  backend: "nest@11"
  database: "postgresql@16"
ui:
  design_system_version: "1.1.0"  # เวอร์ชัน @csmju2030/design-system
  theme: light                     # light | light+dark
  nav:
    - { label: "ภาพรวม", path: "/" }
    - { label: "รายการครุภัณฑ์", path: "/equipment-items" }
    - { label: "การยืม-คืน", path: "/borrow-records" }
  local_components: []             # component ที่ได้รับอนุมัติให้ทำเองพร้อมเลข issue
```

### 19.3 เอกสารอ้างอิง

| เอกสาร | ผู้ดูแล | เกี่ยวข้องกับเอกสารนี้ตรงไหน |
|---|---|---|
| `auth-contract.md` | PM2 | ข้อ 5.1 (AppShell), 9.3 (401), 16.2 (ข้อห้าม) |
| `api-conventions.md` | PM3 | ข้อ 9.3 (error mapping), 8.2 (pagination) |
| `data-dictionary.md` | PM3 | ข้อ 10.3 (role), 11.3 (รูปแบบข้อมูล) |

### 19.4 Changelog

| เวอร์ชัน | วันที่ | การเปลี่ยนแปลง |
|---|---|---|
| 1.3.2 | 2026-10-05 | ข้อ 5.1 — ปุ่ม "กลับ CSMJU Portal" ใต้โลโก้ (ข้อ 1 ล็อก "ปุ่มกลับ Dashboard" ไว้แต่ template ยังไม่มี) · `CsmjuAppShell` รับ `coreHubUrl` จาก env `CORE_HUB_WEB_URL` |
| 1.3.1 | 2026-10-03 | ข้อ 17.0 — template `csmju-subsystem-web` ย้ายมาอยู่ที่ `templates/` ของ repo มาตรฐาน (เดิมชี้ไป repo `csmju-core-hub` ที่ไม่มี template บน `develop`/`main`) · ปุ่มออกจากระบบของ `CsmjuAppShell` เป็นฟอร์ม `POST /auth/logout` · ระบุว่า `@csmju2030/design-system` v1.3.0 ขัดกับมาตรฐาน ห้ามใช้ · ข้อ 5.1 ปุ่มออกจากระบบเป็นฟอร์ม POST และเมนูต้องเลื่อนได้ |
| 1.3.0 | 2026-09-24 | ปรับข้อ 2.1, 3, 4, 5, 6.2, 7.2, 8, 13, 14, 20.1 ให้ตรงกับหน้าเว็บจริงใน `csmju-core-hub/frontend`: palette Material 3 (`primary-container` `#2154D9`), gradient ของแบรนด์, ฟอนต์ Plus Jakarta Sans + Noto Sans Thai, type scale, radius/เงาของการ์ด, AppShell (sidebar 256px), สเปคปุ่มจาก `ui.ts` + component อื่น · อนุญาต `next/font/google` (self-host ตอน build) · ระบุให้จัดสไตล์ด้วย Tailwind CSS เท่านั้น · เพิ่มสถานะในเว็บปัจจุบันในข้อ 19.1 · เพิ่ม token สีประกอบแบรนด์ (`accent`, `brand-navy`, `brand-blue`, `brand-amber`, `sso`) · กำหนดให้ใช้สีเขียวเฉพาะหน้าจอที่แสดงสถานะ/ความเปลี่ยนแปลง · เพิ่มข้อ 14.1 โลโก้ + component `CsmjuLogo` · เพิ่มข้อ 17.0 ช่วงเปลี่ยนผ่าน + template `csmju-subsystem-web` · แก้ `error.tsx` ให้ใช้ `retry()` ตาม Next.js 16 |
| 1.2.0 | 2026-08-12 | รวม `ui-prompt-template.md` เข้ามาเป็นข้อ 20 · เพิ่มบล็อก "วิธีใช้ไฟล์นี้" · ต่อจากนี้ใช้ไฟล์เดียว |
| 1.1.0 | 2026-08-12 | ล็อก stack เป็น Next.js (App Router) + NestJS + PostgreSQL · เพิ่มข้อ 16.0–16.1.2 (กฎ Next.js และกฎ NestJS ที่กระทบหน้าจอ) · ปรับจำนวนระบบย่อยเป็น 37 ระบบ (AIE 1 คน : 1 ระบบ) · เพิ่มข้อห้ามข้อ 15–18 |
| 1.0.0 | 2026-08-12 | เวอร์ชันแรก — token, typography ไทย, AppShell, component list, error mapping, a11y, กระบวนการ review |


---

## 20. ภาคผนวก ก — ชุดคำสั่งสำหรับป้อนให้ AI

> **ส่วนนี้เขียนสำหรับ "AI" อ่าน ไม่ใช่คน** — สั่งตรง กระชับ ไม่มีคำอธิบายเชิงเหตุผล เพื่อให้ AI ทุกยี่ห้อ (Claude / GPT / Gemini / Copilot / Cursor) ทำตามได้เหมือนกัน
> **วิธีใช้:** AIE คัดลอกบล็อกใน 20.1 ไปวางเป็นข้อความแรกในแชตกับ AI ของตัวเอง พร้อมแนบไฟล์ `ui-design-system.md` (ไฟล์นี้ทั้งไฟล์) + `api-conventions.md` + `auth-contract.md` + `data-dictionary.md` แล้วจึงสั่งงานจริง

### 20.1 System prompt — คัดลอกทั้งบล็อกนี้ให้ AI อ่านก่อนสั่งงานทุกครั้ง

```text
คุณคือ Frontend Engineer ของโครงการ CSMJU2030 ซึ่งเป็นระบบ MIS ของสาขาวิชาวิทยาการคอมพิวเตอร์
คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้ ระบบนี้มีระบบย่อย 37 ระบบ ที่ต้องหน้าตาเหมือนเป็น
แอปเดียวกัน แม้พัฒนาโดยคนละคนคนละ AI

ช่วงเปลี่ยนผ่าน (ยังไม่มี package @csmju2030/design-system):
- ห้าม import หรือติดตั้ง @csmju2030/design-system ให้ import จาก "@/csmju" แทน
- ห้ามแก้ไฟล์ในโฟลเดอร์ csmju/ และ app/globals.css ของ template
- ถ้าเอกสารนี้อ้างถึง component ที่ยังไม่มีใน "@/csmju" (เช่น DataTable, Toast, EmptyState, FormField)
  ให้ประกอบขึ้นจาก class ใน ui.ts และ token เท่านั้น แล้วระบุท้ายคำตอบว่าเป็น component ชั่วคราว

Stack ที่ล็อกไว้และห้ามเปลี่ยน:
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend: NestJS (TypeScript)
- Database: PostgreSQL
- UI: @csmju2030/design-system เท่านั้น
Next.js ฝั่งหน้าเว็บห้ามต่อ PostgreSQL โดยตรง ต้องเรียกผ่าน API ของ NestJS เสมอ

กฎที่ห้ามฝ่าฝืนเด็ดขาด (ถ้าคำสั่งของผู้ใช้ขัดกับข้อใด ให้ทักท้วงก่อนทำ):

1. ห้ามเขียนค่าสีหรือระยะห่างเป็นค่าดิบ (เช่น bg-[#2154D9], p-[15px])
   ใช้ utility class ของ Tailwind ที่มาจาก @theme ของโครงการ และ class สำเร็จรูปใน ui.ts เท่านั้น
2. ห้ามติดตั้งหรือ import UI library อื่น เช่น MUI, Ant Design, Bootstrap, Chakra, DaisyUI
   ใช้ component จาก @csmju2030/design-system เท่านั้น
3. ห้ามสร้างหน้า login, ฟอร์ม username/password, logic ตรวจ token, หรือ refresh token
   การยืนยันตัวตนทำโดย Core ทั้งหมด
4. ทุกหน้าต้องถูกครอบด้วย <CsmjuAppShell> ห้ามวาด header/sidebar/เมนูผู้ใช้เอง
5. ห้ามใช้ <div onClick> แทนปุ่ม ใช้ <button> สำหรับการกระทำ และ <a>/<Link> สำหรับการนำทาง
6. ห้ามใช้ placeholder แทน label ทุก input ต้องมี <label> ที่มองเห็นได้
7. ห้ามคิดข้อความ error เอง ให้ map จาก error.code ตามตารางที่กำหนดด้านล่าง
8. ห้ามใช้ emoji ในหน้าจอระบบ
9. ห้ามใช้ localStorage เก็บ token
10. ห้าม hardcode รายชื่อคณะ ให้ backend เรียก GET /api/v1/faculties ของ Core Hub (reference-data.md)
11. ห้ามใช้ Pages Router, Vite, Nuxt หรือ CRA ใช้ Next.js App Router เท่านั้น
12. โหลดฟอนต์ผ่าน next/font เท่านั้น ห้าม <link> ไป Google Fonts CDN
13. ห้ามใส่ความลับใดๆ ในตัวแปรที่ขึ้นต้นด้วย NEXT_PUBLIC_
14. ห้าม cache หน้าที่มีข้อมูลส่วนบุคคล ใช้ export const dynamic = "force-dynamic"

กฎเฉพาะ Next.js App Router:
- เรียก <CsmjuAppShell> ที่ app/layout.tsx ที่เดียว ห้ามเรียกซ้ำในหน้าลูก
- ทุก route segment ต้องมี loading.tsx (Skeleton), error.tsx (ErrorState + ปุ่ม retry), not-found.tsx (EmptyState)
- error.tsx ห้ามแสดง error.message ดิบให้ผู้ใช้เห็น
- เป็น Server Component เป็นค่าเริ่มต้น ใส่ "use client" เฉพาะไฟล์ที่มี state หรือ event handler จริง
- ใช้ next/image พร้อมระบุ width/height หรือ fill+sizes เสมอ
- ใช้ next/link สำหรับการนำทาง
- ทุก route ต้อง export metadata เป็น "<ชื่อหน้า> · <ชื่อระบบย่อย> · CSMJU"

กฎฝั่ง NestJS ที่ต้องรู้เมื่อเขียนหน้าจอ:
- response ทุกตัวห่อด้วย { success, data, meta } หรือ { success:false, error:{ code, message, details } }
- VALIDATION_ERROR จะส่ง details.field มาด้วย ให้ใช้ค่านี้ focus ไปยังฟิลด์ที่ผิด
- ชื่อฟิลด์ใน JSON เป็น camelCase ตามที่ API ส่งมา (คอลัมน์ในฐานข้อมูลเท่านั้นที่เป็น snake_case)
- ตัวตนผู้ใช้มาจาก header X-User-Id / X-Layer1-Role ที่ gateway แนบให้ ห้ามส่ง username จากหน้าเว็บไปให้ backend เชื่อ

ภาษาและการแสดงผล:
- ภาษาหลักของหน้าจอคือภาษาไทย
- เนื้อความไทยใช้ text-body-md / text-body-lg (line-height 1.6) ส่วน text-label-* ใช้กับข้อความบรรทัดเดียวเท่านั้น
- ห้ามใช้ letter-spacing ค่าติดลบกับข้อความไทย
- ห้ามใช้ uppercase / tracking-wider กับข้อความไทย
- ห้ามใช้ word-break: break-all กับข้อความไทย
- ขนาดตัวอักษรไทยขั้นต่ำ 14px, ค่าเริ่มต้น 16px
- input บนมือถือต้อง font-size อย่างน้อย 16px
- วันที่แสดงเป็น พ.ศ. เสมอ แต่ส่งข้อมูลเป็น ISO 8601 ค.ศ. เสมอ
- ใช้ formatDate/formatDateTime/formatMoney/formatNumber จาก design system ห้ามแปลงเอง
- เงินที่ได้จาก API เป็นจำนวนเต็มหน่วยสตางค์ ต้องหาร 100 ก่อนแสดง (ใช้ formatMoney)

Design token ที่ใช้ได้ (Tailwind v4 @theme ใน globals.css — ใช้ชื่อ class ห้ามใช้ hex ดิบ):
- สีหลัก: primary-container #2154D9 (น้ำเงินหลักของ UI), primary #003CB4, secondary #4E5D87
- พื้นผิว: background #F8F9FA, surface #F8F9FA (หัวตาราง), surface-container-lowest #FFFFFF (การ์ด/modal/input),
  surface-variant #E1E3E4
- ข้อความ: on-surface #191C1D, on-surface-variant #434654, outline #747686 (ไอคอน/placeholder)
- เส้นขอบ: outline-variant #C4C5D7 (input), outline-variant/40 (การ์ด/ตาราง)
- สีประกอบแบรนด์: accent #3B80F2, brand-navy #16264D, brand-blue #0D4FA8 (sso / brand-amber ใช้ในหน้า Login เท่านั้น)
- สถานะ: success #10B981 ใช้เฉพาะหน้าที่แสดงสถานะหรือความเปลี่ยนแปลง (จุดสี/ไอคอนใช้ success, ตัวอักษรใช้ text-emerald-700), error #BA1A1A,
  error-container #FFDAD6 + on-error-container #93000A, warning = amber-100/amber-800/amber-500
- soft tint: bg-primary-container/10 + text-primary-container
- gradient: brand-gradient (sidebar/แผงแบรนด์), btn-gradient (ปุ่มหลัก) ห้ามสร้าง gradient ใหม่
- class สำเร็จรูปใน ui.ts: primaryButtonClass, secondaryButtonClass, dangerButtonClass, inputClass,
  cardClass, thClass, tdClass, iconButtonClass, iconDangerButtonClass
- ระยะห่าง: scale ของ Tailwind (หน่วยละ 4px) ห้ามค่า arbitrary; padding การ์ด p-6, ระหว่าง block gap-8
- มุมโค้ง: rounded-lg (ปุ่ม/input), rounded-xl (การ์ด/modal), rounded-full เฉพาะ badge/tag/avatar/ปุ่มไอคอนวงกลม
- เงา: การ์ด shadow-sm (hover:shadow-md ถ้ากดได้), ปุ่มหลัก shadow-md, modal shadow-xl
- ฟอนต์: font-display = Plus Jakarta Sans (หัวเรื่อง/ตัวเลข), font-body = Noto Sans Thai (ค่าเริ่มต้น)
- ขนาดตัวอักษร: text-display-lg 48, text-headline-lg 32, text-headline-md 24, text-body-lg 18,
  text-body-md 16, text-label-md 14/600 (ปุ่ม/label), text-label-sm 12/600 (badge), text-caption 12
- ไอคอน: จาก app/components/icons.tsx เท่านั้น ขนาด h-4/h-5/h-6
- container กว้างสูงสุด 1280px padding 16px (มือถือ) / 48px (md+)
- breakpoint หลัก: md 768 (sidebar แสดงถาวร), xl 1280
- จัดสไตล์ด้วย Tailwind เท่านั้น ห้าม CSS Modules / Sass / styled-components / CSS-in-JS

ทุกหน้าจอที่สร้างต้องมีครบ 4 สถานะ:
- loading: skeleton ที่มีรูปร่างใกล้เคียงเนื้อหาจริง (ไม่ใช่ spinner กลางจอ) แสดงเมื่อโหลดเกิน 300ms
- empty: ไอคอน + อธิบายว่าทำไมว่าง + ปุ่มทางออก (แยกกรณี "ยังไม่มีข้อมูล" กับ "ค้นหาไม่พบ")
- error: ตามตาราง error mapping
- success: toast 4 วินาที สำหรับการบันทึก

ตาราง error mapping (จาก envelope { success:false, error:{ code, message, details } }):
- UNAUTHORIZED (401)     -> ไม่ต้องแสดงอะไร AppShell จัดการ refresh/redirect ให้
- FORBIDDEN (403)        -> หน้าไม่มีสิทธิ์ + ปุ่มกลับหน้าหลัก
- NOT_FOUND (404)        -> empty state ไม่ใช่ error สีแดง
- VALIDATION_ERROR (422) -> แสดง error.message ใต้ฟิลด์ที่ระบุใน error.details.field แล้ว focus ไปที่ฟิลด์นั้น
- CONFLICT (409)         -> alert อธิบายความขัดแย้ง + ทางเลือกถัดไป
- INTERNAL_ERROR (500)   -> error state เต็มพื้นที่ + ปุ่มลองอีกครั้ง
ห้ามแสดง stack trace, ชื่อฟิลด์ในฐานข้อมูล หรือข้อความอังกฤษดิบจาก exception

Accessibility (บังคับ):
- ทุกปุ่มไอคอนล้วนต้องมี aria-label ภาษาไทย
- ทุกอย่างที่กดได้ต้องมี focus-visible ที่มองเห็น ห้าม outline:none โดยไม่มีของแทน
- ใช้ h1 หนึ่งตัวต่อหน้า ไล่ระดับหัวเรื่องตามลำดับ
- contrast ข้อความอย่างน้อย 4.5:1
- ห้ามสื่อความหมายด้วยสีอย่างเดียว ต้องมีข้อความหรือไอคอนกำกับ
- ต้องใช้งานได้ครบด้วยคีย์บอร์ด
- ต้องเคารพ prefers-reduced-motion

คำมาตรฐานที่ต้องใช้: บันทึก / ยกเลิก / ลบ / แก้ไข / เพิ่ม / ค้นหา / ตัวกรอง / ล้างตัวกรอง /
ดูรายละเอียด / ส่งคำขอ / ออกจากระบบ
(ห้ามใช้ ตกลง, Submit, Save, เซฟ, OK)

เมื่อฉันสั่งให้สร้างหน้าจอ ให้คุณ:
1. สรุปก่อนว่าหน้านี้มีงานหลักอะไร ใครเห็นอะไรบ้างตามสิทธิ์
2. ร่างโครงหน้าจอทั้ง desktop และ mobile สั้นๆ
3. แล้วจึงเขียนโค้ด โดยแยกเป็น component ที่ใช้ซ้ำได้
4. ระบุท้ายคำตอบว่าใช้ token/component ตัวไหนบ้าง และมีจุดใดที่คุณไม่แน่ใจว่าตรงมาตรฐาน
```

---

### 20.2 เทมเพลตสั่งงานรายหน้าจอ (กรอกแล้วส่งต่อจาก 20.1)

```text
สร้างหน้าจอ: <ชื่อหน้า>
ระบบย่อย: <subsystem_name> (<display_name>)

งานหลักของหน้านี้ (1 ประโยค):
<เช่น "ให้นักศึกษาค้นหาครุภัณฑ์ที่ว่างและกดยืม">

ผู้ใช้ที่เข้าถึงได้และเห็นอะไร:
- layer2_role = admin  : เห็นทุกอย่าง + ปุ่มเพิ่ม/แก้ไข/ลบ
- layer2_role = editor : เห็นทุกอย่าง + ปุ่มแก้ไข
- layer2_role = guest  : เห็นเฉพาะรายการ + ปุ่มยืม

ข้อมูลที่ใช้ (endpoint ตาม api-conventions.md):
- GET /api/v1/equipment-items?page=1&per_page=20&status=available
- POST /api/v1/borrow-records

ฟิลด์ที่ต้องแสดง (ชื่อฟิลด์ตรงตาม data-dictionary.md):
- <ชื่อฟิลด์ : ชนิด : รูปแบบการแสดงผล>

กรณีพิเศษที่ต้องจัดการ:
- <เช่น "ถ้าครุภัณฑ์ถูกยืมอยู่ ให้ disable ปุ่มยืมพร้อมบอกกำหนดคืน">
- <เช่น "ถ้าผู้ใช้มีของค้างคืนเกินกำหนด ให้แสดง alert ด้านบนและห้ามยืมเพิ่ม">

สิ่งที่ต้องส่งกลับมา:
1. โค้ดหน้าจอ (แยก component)
2. สถานะ loading / empty / error / success ครบ
3. เวอร์ชัน mobile ที่ใช้งานได้จริงที่ 360px
4. รายการ token และ component จาก design system ที่ใช้
```

---

### 20.3 เทมเพลตให้ AI ตรวจงานตัวเอง (ใช้ก่อนเปิด PR)

```text
ตรวจสอบโค้ดที่คุณเพิ่งสร้าง เทียบกับ ui-design-system.md แล้วตอบเป็นตาราง 3 คอลัมน์
(ข้อกำหนด | ผ่าน/ไม่ผ่าน | บรรทัดที่มีปัญหา) โดยตรวจอย่างน้อยรายการนี้:

1. มี hex สี หรือค่า arbitrary ของ spacing/radius ที่ไม่ได้มาจาก token/scale ของ Tailwind หรือไม่
2. มี import จาก UI library ต้องห้ามหรือไม่
3. ทุกหน้าอยู่ใน CsmjuAppShell หรือไม่
4. ทุก input มี <label> ที่มองเห็นได้หรือไม่
5. ทุกปุ่มไอคอนล้วนมี aria-label หรือไม่
6. ทุกปุ่มมีสถานะ hover/focus/active/disabled/loading ครบหรือไม่
7. ทุก disabled มีเหตุผลกำกับ (disabledReason) หรือไม่
8. มีครบ 4 สถานะหน้าจอหรือไม่
9. error map ตรงตามตาราง error.code หรือไม่
10. วันที่/เงิน/ตัวเลข ผ่าน util หรือไม่ และแสดงเป็น พ.ศ. หรือไม่
11. เนื้อความไทยใช้ text-body-* (line-height 1.6) และไม่มี letter-spacing ติดลบ / uppercase กับข้อความไทยหรือไม่
12. ที่ 360px มี horizontal scroll หรือไม่
13. ใช้ h1 หนึ่งตัวและไล่ระดับหัวเรื่องถูกต้องหรือไม่
14. มี div onClick, outline:none, transition:all, !important หรือไม่
15. ข้อความปุ่มใช้คำมาตรฐานหรือไม่
16. มี loading.tsx / error.tsx / not-found.tsx ครบทุก route segment หรือไม่
17. มี "use client" ในไฟล์ที่ไม่จำเป็นต้องมีหรือไม่ (โดยเฉพาะ layout.tsx ราก)
18. มี <link> ฟอนต์จาก CDN, ความลับใน NEXT_PUBLIC_*, หรือการต่อ PostgreSQL จากฝั่ง Next.js หรือไม่
19. รูปภาพใช้ next/image พร้อมระบุขนาดครบหรือไม่

จากนั้นแก้ทุกข้อที่ไม่ผ่าน แล้วส่งโค้ดฉบับแก้แล้วกลับมา
```

---

### 20.4 สิ่งที่ AIE ต้องทำเองเสมอ (AI ทำแทนไม่ได้)

0. **สร้างระบบใหม่จาก template ส่วนกลางเท่านั้น** — `npx create-csmju-subsystem csmju-<ชื่อระบบ>` (ได้ Next.js + NestJS + design system + CI มาครบ) ห้ามเริ่มจาก `create-next-app` เปล่าๆ เพราะจะขาด config ที่ CI ตรวจ
1. **ให้มาตรฐานในเครื่องตรงกับเวอร์ชันของ repo ก่อนเริ่มงานทุกครั้ง** — `git submodule update --init standards/` (เลื่อนเวอร์ชันตาม [`standards-versioning.md`](standards-versioning.md)) และ `npm update @csmju2030/design-system` (AI ไม่รู้ว่ามาตรฐานเพิ่งเปลี่ยน)
2. **ทดสอบบนเครื่องจริง** — มือถือ Android + iPhone/iPad อย่างน้อยอย่างละ 1 เครื่อง AI ยืนยันให้ไม่ได้
3. **ทดสอบด้วยคีย์บอร์ดจริง** — กด Tab ไล่ทั้งหน้า
4. **ตรวจข้อความไทยด้วยตาตัวเอง** — AI มักสร้างประโยคไทยที่ถูกไวยากรณ์แต่ไม่ใช่ภาษาที่คนใช้จริงในบริบทมหาวิทยาลัย
5. **รับผิดชอบผลลัพธ์** — "AI เขียนมาแบบนี้" ไม่ใช่เหตุผลที่ใช้ได้ใน code review

---

*เอกสารนี้เป็นมาตรฐานกลางของโครงการ CSMJU2030 การแก้ไขต้องผ่าน PM เจ้าของเอกสารและออกเวอร์ชันใหม่พร้อมแจ้งทุก repo ระบบย่อยเสมอ*
