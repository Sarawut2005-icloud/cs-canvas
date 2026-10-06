# csmju-core-hub

Identity provider กลางของแพลตฟอร์ม CSMJU2030 — login · ออก JWT (RS256) · เผยแพร่ JWKS ·
Subsystem Registry · Central SSO

รายละเอียดการติดตั้ง ตัวแปรแวดล้อม และ API ทั้งหมดอยู่ที่ [`backend/README.md`](backend/README.md)

---

## โครงสร้าง

```text
csmju-core-hub/
├── .github/workflows/ci.yml   เรียก core-hub-compliance.yml ของ csmju2030-standards
├── pnpm-workspace.yaml        workspace: backend (frontend เพิ่มภายหลัง)
└── backend/                   NestJS 11 + Prisma 7.9.1 + PostgreSQL
```

## คำสั่งที่ใช้บ่อย

```bash
pnpm install
pnpm --filter core-api start:dev     # รันที่ http://localhost:3000
pnpm --filter core-api test          # unit 138 เคส
pnpm --filter core-api typecheck
pnpm --filter core-api lint
```

## การตรวจตามมาตรฐานกลาง

Core Hub **ไม่ใช่ระบบย่อย** จึงใช้ชุดกฎคนละชุด — ยกเว้นเฉพาะข้อที่ขัดกับหน้าที่ของตัวเอง
(เป็นผู้ออก token · ถือ private key · เป็นหน้า login กลาง · เป็นเจ้าของตาราง `users`)
กฎที่เหลือบังคับเต็มเหมือนระบบย่อย และมี 3 ข้อที่เข้มกว่า

```bash
bash ../../csmju2030-standards/scripts/run-core-hub-checks.sh .
```

เอกสารกฎและเหตุผลรายข้อ: `csmju2030-standards/docs/core-hub-rules.md`

## สัญญาที่เปลี่ยนไม่ได้

| รายการ | ค่า |
|---|---|
| algorithm | `RS256` |
| `iss` | `core-hub` |
| `aud` | `csmju2030` |
| `kid` | `core-hub-2026` |
| อายุ access token | 15 นาที |
| JWKS | `GET /api/v1/.well-known/jwks.json` — RFC 7517 ดิบ ไม่ห่อ envelope |

การเปลี่ยนค่าเหล่านี้คือ breaking change ของทั้งแพลตฟอร์ม ต้องขึ้น major version ของมาตรฐานกลาง
