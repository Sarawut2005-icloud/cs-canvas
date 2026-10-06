# โครงสร้าง Repository

**เวอร์ชัน 1.0** · คู่กับ [`tech-stack.md`](tech-stack.md) ข้อ 2 และ [`github-workflow.md`](github-workflow.md)

---

## 1. repository ของโครงการ

| repository | หน้าที่ | หมายเหตุ |
|---|---|---|
| `csmju-core-hub` | Core Hub — identity · JWKS · Registry · SSO | **ห้ามแก้จากฝั่งระบบย่อย** |
| `csmju2030-standards` | มาตรฐาน + conformance + CI (repo นี้) | ระบบย่อยผูกเป็น submodule |
| `demo-student-subsystem` | **reference implementation** ที่ผ่าน conformance L3 | ใช้เป็นต้นแบบคัดลอกชั้น auth |
| `csmju-<subsystem>` | ระบบย่อยของแต่ละทีม | 1 ระบบ = 1 repo = 1 ฐานข้อมูล = 1 AIE |

การวางโฟลเดอร์ในเครื่องของทีมระบบย่อย (Core Hub ใช้ตัวจริงที่ `https://csmju2030.jowave.com` — ไม่ต้องโคลนมาไว้ในเครื่อง):

```text
csmju2030/
├── csmju2030-standards/        (ถ้าต้องการอ่านนอก submodule)
├── demo-student-subsystem/     ตัวอย่าง: frontend :3201 · backend :4201
└── csmju-<your-subsystem>/     frontend :32xx · backend :42xx (พอร์ตที่ผู้ดูแล dev server กำหนดให้)
```

frontend เป็นประตูเดียวของระบบ และ proxy `/api/*` กับ `/auth/*` ไป backend — callback ที่ลงทะเบียนจึงใช้พอร์ต frontend
([`connect-core-hub.md`](connect-core-hub.md) ข้อ 1)

---

## 2. โครงภายใน repo ของระบบย่อย

```text
csmju-<subsystem>/
├── .github/workflows/ci.yml           เรียก reusable workflow ของ standards (ห้ามแก้ — DevOps ดูแล)
├── .standards-version                 เวอร์ชันมาตรฐานที่ผูกอยู่ (เช่น 1.7.0)
├── standards/                         git submodule → csmju2030-standards
├── subsystem.yaml                     manifest เดียวที่ CI และ conformance อ่าน
├── pnpm-workspace.yaml                workspace ของ frontend + backend
├── docker-compose.yml                 db + api + web แบบเดียวกับ server (deployment.md ข้อ 6)
├── .dockerignore                      กัน **/.env* และ **/node_modules ออกจาก image (DEP-03)
│
├── backend/                           NestJS — ต้องมีทุกระบบย่อย (ARC-04)
│   ├── src/
│   │   ├── main.ts                    setGlobalPrefix('api') + ยกเว้น /auth/login · /auth/callback · /auth/logout
│   │   ├── app.module.ts
│   │   ├── auth/                      ⬅ คัดลอกจาก reference implementation (ห้ามแก้ตรรกะ)
│   │   │   ├── jwks.service.ts
│   │   │   ├── core-hub-token.verifier.ts
│   │   │   ├── guards/                CoreHubJwtGuard (401) · PermissionsGuard (403)
│   │   │   ├── decorators/            @Public · @RequirePermissions · @CurrentUser
│   │   │   ├── role-mapping.ts        ⬅ แก้ได้เฉพาะค่าในตาราง ให้ตรงกับทะเบียน
│   │   │   ├── permissions.ts         ⬅ permission ของโดเมนตัวเอง
│   │   │   ├── sso-callback.controller.ts
│   │   │   └── me.controller.ts
│   │   ├── common/                    response envelope · exception filter · DTO กลาง
│   │   ├── config/                    configuration + env validation
│   │   ├── prisma/                    PrismaService (Prisma 7 + PrismaPg adapter)
│   │   └── <domain>/                  โมดูลธุรกิจของทีม
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/                ห้ามลบ ห้าม squash
│   │   └── seed.ts
│   ├── test/
│   ├── .env.example                   `.env` ห้าม commit · DevOps ใช้เป็นรายการ env บน server
│   ├── Dockerfile                     image api — copy จาก demo (DEP-01..02)
│   ├── docker/entrypoint.sh           prisma migrate deploy แล้วค่อยเปิด server
│   └── package.json
│
└── frontend/                          Next.js (App Router) — ถ้ามี UI
    ├── src/app/
    ├── .env.example
    ├── Dockerfile                     image web — copy จาก templates/csmju-subsystem-web (DEP-01..02)
    ├── next.config.ts                 output: "standalone" (DEP-04)
    └── package.json
```

---

## 3. ไฟล์ที่ต้องมีที่ราก repo

| ไฟล์ | ทำไม |
|---|---|
| `subsystem.yaml` | CI อ่าน `name`, `public_endpoints` · conformance อ่าน `base_url`, `probes` (`standards_version` ไม่ใช้แล้วตั้งแต่ 1.5.1) |
| `.standards-version` | เลือกว่า CI ตรวจด้วย standards เวอร์ชันไหน · กฎ `GH-04` ตรวจว่า submodule ชี้ tag เดียวกัน ([`standards-versioning.md`](standards-versioning.md)) |
| `standards/` (submodule) | ดึงกฎกลางมาใช้ ไม่ต้องคัดลอกกฎเข้ามาเก็บเอง |
| `pnpm-workspace.yaml` | กฎ `QA-05` |
| `.dockerignore` | build context ของทั้งสอง image คือรากของ repo — ต้องกัน `**/.env*` และ `**/node_modules` (`DEP-03` · [`deployment.md`](deployment.md)) |
| `README.md` | วิธีติดตั้ง/รัน/ทดสอบ ที่คำสั่งใช้ได้จริงทุกบรรทัด |
| `REPORT.md` | ส่งพร้อมงาน (ดู [`../ai/AGENTS.md`](../ai/AGENTS.md) ข้อ 6) |

**ชื่อ package ในแต่ละ workspace ต้องไม่ซ้ำกัน** (`package.json` → `"name"`) — เช่น `csmju-<subsystem>`
ที่ราก · `backend` · `frontend` ถ้าชื่อซ้ำ `pnpm --filter backend test` จะไม่ match package ใดเลย
แล้วคืน exit 0 เงียบ ๆ ทำให้ script ที่รากดู "ผ่าน" ทั้งที่ไม่ได้รันอะไร (กฎ `QA-06`)

## 4. ไฟล์ที่ห้ามอยู่ใน git

```text
.env  ·  *.pem  ·  *.key  ·  node_modules/  ·  dist/  ·  generated/  ·  coverage/
package-lock.json  ·  yarn.lock        (ใช้ pnpm-lock.yaml เท่านั้น)
```

---

## 5. Branch และ commit

- branch หลักคือ `main` และต้องอยู่ในสถานะที่ conformance ผ่านเสมอ
- แตก branch: `feature/<subsystem>/<เรื่อง>` **แบบเดียว** — ตัวพิมพ์เล็ก ตัวเลข และขีดกลาง (`GH-01` ไม่รับ `fix/…` หรือ `refactor/…`
  งานแก้บั๊กก็ใช้ `feature/<subsystem>/fix-<เรื่อง>` แล้วใช้ commit type `fix`)
- commit ใช้ Conventional Commits: `feat(<subsystem>): …` — ชนิดที่อนุญาต `feat|fix|chore|refactor|docs|test|ci`
- รายละเอียดและกฎที่ CI ตรวจ ดู [`github-workflow.md`](github-workflow.md)
