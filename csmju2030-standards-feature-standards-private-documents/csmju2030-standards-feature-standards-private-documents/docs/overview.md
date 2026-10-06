# ภาพรวมสถาปัตยกรรม CSMJU2030

**เวอร์ชันมาตรฐาน:** 1.7 (สายนิ่ง) · เอกสารนี้เป็นจุดเริ่มต้น อ่านก่อนไฟล์อื่น

---

## 1. ระบบประกอบด้วยอะไร

```text
                 ┌──────────────────────────────┐
   User ── login │          CORE HUB            │  csmju-core-hub · https://csmju2030.jowave.com
                 │  Authentication · Session    │
                 │  Core roles · RS256 JWT      │
                 │  JWKS · Subsystem Registry   │
                 │  Central SSO · ข้อมูลกลาง      │
                 └───────────────┬──────────────┘
                                 │ access token (RS256) + JWKS · API ข้อมูลกลาง
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
      ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
      │  subsystem A  │  │  subsystem B  │  │  subsystem C  │
      │ ตรวจ JWT เอง   │  │               │  │               │
      │ authz ของตัวเอง│  │               │  │               │
      │ DB ของตัวเอง   │  │               │  │               │
      └───────────────┘  └───────────────┘  └───────────────┘
```

- **1 ระบบย่อย = 1 repository = 1 ฐานข้อมูล = 1 AIE รับผิดชอบ**
- ผู้ใช้ **login ครั้งเดียว**ที่ Core Hub (รหัสผ่าน หรือ MJU SSO สำหรับนักศึกษาและบุคลากร) แล้วเข้าได้ทุกระบบย่อยที่มีสิทธิ์
- ข้อมูลกลาง (คณะ · สาขา · อาคาร · ห้อง · ภาคการศึกษา · รายวิชา · หลักสูตร · บุคคล) อยู่ที่ Core Hub ที่เดียว
  ระบบย่อยเรียกผ่าน API และเก็บแค่รหัสอ้างอิง

---

## 2. การแบ่งความรับผิดชอบ

| Core Hub เป็นเจ้าของ | ระบบย่อยเป็นเจ้าของ |
|---|---|
| การพิสูจน์ตัวตน (login / password / session / refresh) | business domain และฐานข้อมูลของตัวเอง |
| core role ของผู้ใช้ | subsystem role และ permission ของตัวเอง |
| กุญแจเซ็น JWT และ JWKS | การ **ตรวจสอบ** JWT |
| ทะเบียนระบบย่อย + `callback_url` | API และกฎธุรกิจของตัวเอง |
| ข้อมูลกลางและข้อมูลบุคคล | ข้อมูลของ domain ตัวเอง (อ้างข้อมูลกลางด้วย `code` / `core_user_id`) |
| **ใครมีสิทธิ์เข้าระบบไหน** | **เข้ามาแล้วทำอะไรได้บ้าง** |

> บรรทัดสุดท้ายคือเส้นแบ่งที่สำคัญที่สุดของมาตรฐานนี้

---

## 3. สถานะสถาปัตยกรรมปัจจุบัน (standards 1.7)

มาตรฐานนี้อธิบาย **ระบบที่มีอยู่จริงและทดสอบแล้ว** ไม่ใช่ระบบที่วางแผนไว้

| องค์ประกอบ | สถานะ |
|---|---|
| Core Hub บน server จริง `https://csmju2030.jowave.com` | ✅ ใช้งานได้ — โหมดก่อนเปิดใช้: ระบบย่อยบน `localhost` ของทีมเชื่อมได้ |
| เว็บ Core Hub: หน้า login · พอร์ทัล · หลังบ้าน · `/sso/authorize` | ✅ ใช้งานได้ |
| Central SSO 1.1 (เริ่มที่ระบบย่อย + `state` · silent re-SSO · logout ทั้งระบบ) | ✅ ใช้งานได้ |
| API ข้อมูลกลาง 7 ชุด + ข้อมูลบุคคล | ✅ ใช้งานได้ — [`reference-data.md`](reference-data.md) |
| ระบบย่อยตรวจ JWT เองผ่าน JWKS | ✅ ใช้งานได้ (reference implementation: `demo-student-subsystem`) |
| สิทธิ์พิเศษรายบุคคลใน token · token แยกรายระบบย่อย (`azp`) | 🟡 Core Hub กำลังทำ — ดูแผนใน [`auth-contract.md`](auth-contract.md) ข้อ 11 |
| API Gateway ที่ตรวจ JWT แทนระบบย่อย | ❌ **ยังไม่มี** — อย่าออกแบบโดยสมมติว่ามี |
| OAuth2 authorization code + token endpoint | ❌ ยังไม่มี (อยู่ในแผน v2.0) |

หากเอกสารใดขัดกับสภาพจริงข้างต้น ให้ยึด **สภาพจริง** และแจ้ง PL เพื่อแก้เอกสาร

---

## 4. อ่านต่อที่ไหน

| ต้องการรู้ | ไฟล์ |
|---|---|
| **เชื่อมระบบย่อยกับ Core Hub จริงทีละขั้น** | [`connect-core-hub.md`](connect-core-hub.md) |
| **ข้อมูลกลางที่เรียกได้ และสิ่งที่ระบบย่อยเก็บได้** | [`reference-data.md`](reference-data.md) |
| ลำดับงานของ AIE ตั้งแต่ศูนย์จนส่งมอบ | [`aie-workflow.md`](aie-workflow.md) |
| stack ที่บังคับใช้ + เวอร์ชัน | [`tech-stack.md`](tech-stack.md) |
| โครง repo · branch · commit | [`repo-structure.md`](repo-structure.md) · [`github-workflow.md`](github-workflow.md) |
| JWT · JWKS · SSO · callback | [`auth-contract.md`](auth-contract.md) |
| role mapping · permission · 401/403 | [`authorization.md`](authorization.md) |
| ลงทะเบียนระบบย่อยกับ Core Hub | [`subsystem-registry.md`](subsystem-registry.md) |
| รูปแบบ API · envelope · error code | [`api-conventions.md`](api-conventions.md) |
| ชื่อ field · ชื่อตาราง · migration | [`data-dictionary.md`](data-dictionary.md) |
| log ที่ต้องมี | [`logging.md`](logging.md) |
| เกณฑ์ผ่าน/ไม่ผ่าน และวิธีรัน | [`conformance.md`](conformance.md) |
| เลือกและเลื่อนเวอร์ชัน standards | [`standards-versioning.md`](standards-versioning.md) |
| ให้ AI ช่วยเขียนโค้ด | [`../ai/AGENTS.md`](../ai/AGENTS.md) |
