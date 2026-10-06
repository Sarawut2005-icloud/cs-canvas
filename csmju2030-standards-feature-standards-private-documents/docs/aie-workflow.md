# AIE Workflow — ทำระบบย่อยตั้งแต่ศูนย์จนส่งมอบ

**เวอร์ชัน 1.2** (standards 1.8.0) · Core Hub ที่ใช้คือ server จริง `https://csmju2030.jowave.com`

> เอกสารนี้คือ**ลำดับขั้นตอน** ไม่ใช่เนื้อกฎ — แต่ละขั้นจะชี้ไปยังเอกสารที่มีรายละเอียดจริง
> อ่านครั้งเดียวจบก่อนเริ่มงาน แล้วเปิดค้างไว้ใช้เป็น checklist ระหว่างทำ

```text
0 เตรียมเครื่อง → 1 อ่านสัญญา → 2 สร้าง repo → 3 ลงทะเบียนกับ Core Hub
→ 4 คัดลอกชั้น auth → 5 ฐานข้อมูล → 6 API → 7 frontend
→ 8 ตรวจเอง 2 ชั้น → 9 เปิด PR → 10 ส่งมอบ
```

| ขั้น | ใครทำ | เสร็จเมื่อ |
|---|---|---|
| 0–1 | AIE | ต่อ Core Hub จริงได้ และรู้ว่าอะไรห้ามแก้ |
| 2–3 | AIE + DevOps + admin ระบบกลาง | repo ขึ้น GitHub และทะเบียนใน Core Hub อนุมัติและเปิดใช้งานแล้ว |
| 4–7 | AIE | ระบบทำงานจริงบนเครื่องตัวเอง |
| 8 | AIE | `run-all-checks` และ `conformance` เขียวทั้งคู่ |
| 9–10 | AIE + PL | PR ผ่าน CI และ PL รับงาน |

---

## ขั้น 0 — เตรียมเครื่อง

| ต้องมี | ตรวจด้วย |
|---|---|
| Node.js **22.x** | `node -v` |
| **pnpm** (ห้าม npm/yarn — กฎ `QA-05`) | `pnpm -v` · ติดตั้งด้วย `corepack enable pnpm` |
| PostgreSQL **16+** (หรือ Docker) | `psql --version` |
| Docker + docker compose | `docker compose version` |
| `gh` CLI (ใช้ตอนสร้าง repo) | `gh auth status` |

สิ่งที่ต้องขอจากทีมกลางก่อนเริ่ม:

| ขอจากใคร | ได้อะไร |
|---|---|
| ผู้ดูแล Dev Server | บัญชีเจ้าของระบบของทีม (role staff) และบัญชีทดสอบร่วม — ชื่อบัญชีและรหัสส่งทางข้อความส่วนตัว · พอร์ต frontend `32xx` / backend `42xx` ของทีม |
| PM / org admin | สิทธิ์ใน repo ของทีมบน GitHub (repo สร้างไว้ให้แล้ว) |
| PL | **ระดับ conformance เป้าหมาย** (L1 / L2 / L3) และขอบเขตงานของระบบย่อย |

`CORE_HUB_URL` คือ `https://csmju2030.jowave.com` — **ไม่ต้องโคลนหรือรัน Core Hub เอง**
(repo ของ Core Hub มีข้อมูลนักศึกษาจริง ถ้าเคยโคลนไว้ให้ลบทิ้ง) · ขั้นตอนเชื่อมทั้งหมดอยู่ใน [`connect-core-hub.md`](connect-core-hub.md)

ทดสอบว่าต่อ Core Hub ได้จริงก่อนเขียนโค้ดบรรทัดแรก:

```bash
export CORE_HUB_URL=https://csmju2030.jowave.com
curl -s $CORE_HUB_URL/api/v1/health
```

```bash
curl -s $CORE_HUB_URL/api/v1/.well-known/jwks.json
```

อันหลังต้องขึ้นต้นด้วย `{"keys":[` ตรง ๆ ถ้าเห็น `{"success":true,...}` แปลว่า Core Hub ตั้งค่าผิด — แจ้งผู้ดูแลก่อน อย่าเขียนโค้ดรับเคสนั้น

---

## ขั้น 1 — อ่านสัญญาก่อนเขียนโค้ด

อ่าน 5 ฉบับนี้ให้จบก่อน (ประมาณ 1–2 ชั่วโมง) ที่เหลือเปิดดูตอนต้องใช้:

| อ่านเพื่อ | ไฟล์ |
|---|---|
| ภาพรวมสถาปัตยกรรมและสถานะจริง | [`overview.md`](overview.md) |
| เชื่อมระบบย่อยกับ Core Hub จริงทีละขั้น | [`connect-core-hub.md`](connect-core-hub.md) |
| ข้อมูลกลางที่เรียกได้ และสิ่งที่ระบบย่อยเก็บได้ | [`reference-data.md`](reference-data.md) |
| JWT · JWKS · SSO · callback | [`auth-contract.md`](auth-contract.md) |
| role mapping · permission · 401 vs 403 | [`authorization.md`](authorization.md) |

**สิ่งที่เปลี่ยนไม่ได้เด็ดขาด** — ระบบย่อยต้องยอมรับตามนี้:

| | ค่า |
|---|---|
| algorithm | `RS256` |
| `iss` | `core-hub` |
| `aud` | `csmju2030` |
| `kid` | `core-hub-2026` |
| อายุ access token | 15 นาที |
| core role | `student` · `alumni` · `staff` · `lecturer` · `guest` · `admin` เท่านั้น ([`authorization.md`](authorization.md) ข้อ 2) |

**สามข้อที่ทำให้ตกทันทีโดยไม่ต้องดูอย่างอื่น**

1. มีหน้า login / endpoint `login`, `register`, `refresh` ของตัวเอง (`SEC-05`)
2. ออกหรือเซ็น JWT เอง หรือใช้ `jsonwebtoken` / `passport-jwt` แทน `jose` (`SEC-04`)
3. มีตาราง `users` ของตัวเอง — เก็บได้แค่ `core_user_id` (ค่า `sub` ชนิด text) และ `person_code` เป็น external reference (`DD-01`)

---

## ขั้น 2 — repo ของทีม (DevOps สร้างให้ ห้ามสร้างเอง)

repo ของทุกทีมสร้างไว้แล้วด้วยสคริปต์ของ DevOps — AIE แค่ clone แล้วดึง submodule:

```bash
git clone https://github.com/CSMJU2030/csmju-<slug>.git && cd csmju-<slug> && git submodule update --init standards
```

ถ้ายังไม่มี repo ให้ขอ DevOps สร้างด้วย `./new-subsystem.sh <slug> "<ชื่อภาษาไทย>"` —
`<slug>` เป็นตัวพิมพ์เล็ก/ตัวเลข/ขีดกลาง เช่น `equipment` → ได้ repo ชื่อ `csmju-equipment`

สคริปต์ของ DevOps ทำให้ครบ: สร้างไฟล์มาตรฐาน → **รัน compliance กับสิ่งที่เพิ่งสร้าง (15 ข้อ)** →
`git init -b main` + commit → `gh repo create` → เพิ่ม `standards/` เป็น submodule ที่ pin เวอร์ชันไว้ → push

สิ่งที่ได้:

```text
csmju-<slug>/
├── .github/workflows/ci.yml       เรียก reusable workflow ของ standards (ห้ามแก้)
├── .github/CODEOWNERS
├── .standards-version             เวอร์ชันมาตรฐานที่ผูกอยู่
├── standards/                     submodule (อ่านอย่างเดียว ห้ามแก้)
├── subsystem.yaml                 manifest เดียวที่ CI + conformance อ่าน
├── pnpm-workspace.yaml
├── .env.example
├── backend/src/
└── frontend/src/
```

จากนั้นแก้ `subsystem.yaml` ให้ตรงงานจริง — โดยเฉพาะ **`probes`** ซึ่ง conformance ใช้ยิงทดสอบ
(ประกาศไม่ครบ = ขึ้น `SKIP` = **ยังไม่ผ่าน**) ดู [`conformance.md`](conformance.md) ข้อ 3

> ขั้นที่ต้องให้ org admin ทำต่อ: สร้าง Team `pl-<slug>` / `aie-<slug>` — ruleset สคริปต์ตั้งให้แล้ว
> ถ้าคนรันไม่มีสิทธิ์ workflow Ruleset Sweep จะตามตั้งให้ภายในชั่วโมง

---

## ขั้น 3 — ลงทะเบียนกับ Core Hub

ระบบย่อยจะเข้าผ่าน SSO ได้ต่อเมื่อมีทะเบียนแล้ว **และ** admin ระบบกลางอนุมัติและเปิดใช้งานแล้ว

1. PL ของทีม login `https://csmju2030.jowave.com` ด้วยบัญชีเจ้าของระบบของทีม (role staff — นักศึกษาลงทะเบียนไม่ได้)
2. หลังบ้าน → ระบบย่อย → ลงทะเบียนระบบย่อย (`/backoffice/subsystems/new`) กรอกตาม [`connect-core-hub.md`](connect-core-hub.md) ข้อ 3 แล้วส่งคำขอ
3. รอ admin ระบบกลางอนุมัติและเปิดใช้งาน — ทีมทำขั้นนี้เองไม่ได้

**สามเรื่องที่พลาดกันบ่อย**

| | |
|---|---|
| Callback URL | `http://localhost:<พอร์ต frontend 32xx>/auth/callback` — ไม่ใช่พอร์ต backend · server จริงรับ `http://localhost` เพราะอยู่ในโหมดก่อนเปิดใช้ |
| บทบาท (`defaultRoleMapping`) | **key = core role ที่อนุญาตให้เข้าระบบนี้** ใครไม่อยู่ใน key นี้ Core Hub ตอบ 403 ตั้งแต่ก่อน redirect · หลังอนุมัติแล้วทีมแก้เองไม่ได้ |
| Base URL | เว้นว่างระหว่างรันบน localhost (server ตรวจเครื่องของทีมไม่ได้) |

ช่อง Standards version ในฟอร์มมีตัวเลือกเดียวคือ `1.0` (ข้อมูลประกอบ) · `requestedExceptions` ไม่บังคับ

`name` ในทะเบียนต้องตรงกับ `name` ใน `subsystem.yaml` และตรงกับ `data.service` ที่ `/api/health` ตอบ

รายละเอียด: [`subsystem-registry.md`](subsystem-registry.md)

---

## ขั้น 4 — คัดลอกชั้น auth (ห้ามเขียนเอง)

คัดลอกจาก reference implementation `demo-student-subsystem` (ตั้งแต่ standards 1.7.0 — demo ใช้ SSO 1.1)
**โดยไม่แก้ตรรกะ**: `backend/src/auth/` · `backend/src/common/` · `backend/src/core-hub/` (ตัวเรียกข้อมูลกลาง)

> ใครคัดลอก `backend/src/common/filters/all-exceptions.filter.ts` ไปก่อน 1 ต.ค. 2569 **ต้องคัดลอกใหม่** —
> ตัวเก่า log URL เต็มของ `/auth/callback` ซึ่งมี token อยู่

```text
jwks.service.ts              ดึง JWKS + cache ตาม kid
core-hub-token.verifier.ts   ตรวจ 10 ขั้นตามสัญญา (auth-contract ข้อ 4)
guards/                      CoreHubJwtGuard (401) · PermissionsGuard (403)
decorators/                  @Public · @RequirePermissions · @CurrentUser
controller ของ /auth/*       GET /auth/login · GET /auth/callback · POST /auth/logout (อยู่นอก /api prefix)
me.controller.ts             GET /api/v1/me
role-mapping.ts              ⬅ แก้ได้เฉพาะค่าในตาราง
permissions.ts               ⬅ permission ของโดเมนตัวเอง
```

ที่แก้ได้มีแค่สองไฟล์ท้าย:

- `role-mapping.ts` — ต้องตรงกับ `default_role_mapping` ในทะเบียน **เป๊ะ**
- `permissions.ts` — ใช้รูปแบบ `<resource>:<action>[:own|:any]` เช่น `equipment:read:own`

กฎ 401 vs 403 ที่ conformance จับแน่นอน:

| สถานการณ์ | ต้องตอบ |
|---|---|
| ไม่มี token / token ปลอม / หมดอายุ / `kid` ไม่ตรง | **401** |
| token ถูกต้องแต่สิทธิ์ไม่พอ | **403** (ห้ามตอบ 404 เพื่อ "ความปลอดภัย") |
| เจ้าของข้อมูลไม่ใช่ตัวเอง แต่มีสิทธิ์แค่ `:own` | **403** |

---

## ขั้น 5 — ฐานข้อมูลของตัวเอง

**ห้ามต่อฐานข้อมูลของ Core Hub หรือของระบบอื่นเด็ดขาด** (กฎ `ARC-01` — Database per Subsystem)

| กฎ | รายละเอียด |
|---|---|
| ตาราง/คอลัมน์ | `snake_case` ผ่าน `@@map` / `@map` · field ใน Prisma เป็น camelCase |
| อ้างถึงผู้ใช้ | คอลัมน์ `core_user_id` (field `coreUserId`) เท่านั้น — ห้าม `user_id`, `std_id` ฯลฯ |
| เงิน | integer (สตางค์) ห้าม float |
| ข้อมูลกลาง | คณะ · ห้อง · ภาคการศึกษา · รายวิชา · หลักสูตร **ห้ามทำตารางหรือ seed เอง** — เก็บแค่ `code` แล้วเรียกจาก Core Hub ([`reference-data.md`](reference-data.md)) |
| ข้อมูลบุคคล | เก็บ `core_user_id` (ค่า `sub` ชนิด **text** ไม่ใช่ UUID) กับ `person_code` เท่านั้น · ห้ามเก็บชื่อหรืออีเมล |
| migration | ห้ามลบ ห้าม squash · เปลี่ยนชื่อคอลัมน์ต้องใช้ `RENAME COLUMN` ไม่ใช่ drop+add |

Prisma ต้อง **pin 7.9.1 เป๊ะทั้งสามตัว** (`prisma`, `@prisma/client`, `@prisma/adapter-pg`)
และใช้แบบ driver adapter (`PrismaPg`) ตาม reference implementation

รายละเอียด: [`data-dictionary.md`](data-dictionary.md)

---

## ขั้น 6 — เขียน API ตามสัญญา

| หัวข้อ | กฎ |
|---|---|
| path | `/api/v1/<resources>` · พหูพจน์ · kebab-case |
| health | `GET /api/health` (อยู่นอก `/v1`) ตอบ `{status, service}` |
| callback | `GET /auth/callback` (อยู่นอก `/api`) |
| response | ห่อ envelope `{ success, data, meta? }` ทุก endpoint |
| error | `{ success:false, error:{ code, message } }` · `code` มาจาก **9 ค่าปิด** ใน `contracts/error-codes.json` เท่านั้น |
| pagination | `?page=1&limit=20` (ห้าม `per_page`) |
| สร้างสำเร็จ | `201` · ลบสำเร็จ `200` + `{id, deleted:true}` |
| validation ผิด | **400** `VALIDATION_ERROR` (ไม่ใช่ 422) |

รายละเอียด: [`api-conventions.md`](api-conventions.md) · รายการ error code: `contracts/error-codes.json`

---

## ขั้น 7 — frontend (ถ้ามี UI)

- **Next.js App Router 15.5+** · TypeScript · Tailwind
- **ห้ามมีหน้า login ของตัวเอง** — ผู้ใช้เข้ามาผ่าน Core Hub SSO เท่านั้น
- token เก็บใน **httpOnly cookie** เท่านั้น · ห้าม `localStorage` (`SEC-03`)
- frontend **ห้าม import Prisma / `pg` / แตะ `DATABASE_URL`** (`ARC-01`)
- ใช้ class จาก design token ใน `@theme` (เช่น `bg-primary-container`) ห้ามใส่ hex ดิบ (`UI-01`)
  — หน้าตา สี ฟอนต์ component ทั้งหมดอยู่ใน [`ui-design-system.md`](ui-design-system.md)

script `typecheck` ของ frontend ต้องเป็นแบบนี้ ไม่งั้นผ่านในเครื่องแต่**ตกบน CI**:

```json
"typecheck": "next typegen && tsc --noEmit"
```

(Next.js สร้าง type ของ route/layout ตอน dev/build เท่านั้น CI ที่ checkout ใหม่จะไม่มี
ดู [`tech-stack.md`](tech-stack.md) ข้อ 1.2.1)

**เตรียม deploy ตั้งแต่ตอนนี้** ([`deployment.md`](deployment.md)) — `frontend/Dockerfile` และ `next.config.ts` (`output: "standalone"`)
copy จาก `standards/templates/csmju-subsystem-web/` · `backend/Dockerfile` · `backend/docker/entrypoint.sh` · `.dockerignore`
และ `docker-compose.yml` copy จาก demo · CI ตรวจ `DEP-01..04` ตั้งแต่ 1.8.0

---

## ขั้น 8 — ตรวจเอง 2 ชั้นก่อนเปิด PR

CI ตรวจว่า "เขียนถูกกฎ" · conformance ตรวจว่า "ทำงานได้จริงตามสัญญา" — **ต้องผ่านทั้งคู่**

**ชั้นที่ 1 — static (เหมือน CI ทุกข้อ)**

```bash
./standards/scripts/run-all-checks.sh .
```

**ชั้นที่ 2 — runtime (ต้องรันระบบตัวเองไว้ก่อน · Core Hub คือ server จริง)**

```bash
CONFORMANCE_ACCOUNTS_FILE=~/.csmju/conformance-accounts.json node standards/conformance/run.js
```

ไฟล์บัญชีอยู่**นอก repo** (รูปแบบใน [`conformance.md`](conformance.md)) · L3 ใช้บัญชี `<repo>.admin` ของทีม ·
ต้องได้ `0 failed` และ **`SKIP` ไม่นับว่าผ่าน** — runner ตอบ NOT CONFORMANT ถ้ามี SKIP

```text
RESULT: <n> passed · 0 failed · 0 skipped
✅ CONFORMANT — csmju-equipment meets standard v1.2 L3
```

**ตรวจแบบเดียวกับ CI จริง ๆ (สำคัญ)** — CI checkout ใหม่ ไม่มีของค้างในเครื่อง:

```bash
rm -rf frontend/.next && pnpm -r lint && pnpm -r typecheck && pnpm -r test && pnpm -r build
```

ถ้าอยากชัวร์กว่านั้น clone ใหม่ลงโฟลเดอร์ว่าง แล้ว `pnpm install --frozen-lockfile` ก่อนรันชุดข้างบน
— หลายเคสที่ "ผ่านในเครื่องแต่ตกบน CI" จับได้ตรงนี้

---

## ขั้น 9 — เปิด PR

```bash
git checkout -b feature/<slug>/<เรื่องที่ทำ>
```

```bash
git commit -m "feat(<slug>): <คำอธิบาย>"
```

| กฎ | รายละเอียด |
|---|---|
| ชื่อ branch (`GH-01`) | `feature/<slug>/<เรื่อง>` ตัวพิมพ์เล็กและขีดกลางเท่านั้น |
| commit (`GH-02`) | Conventional Commits · type ได้แค่ **`feat` `fix` `chore` `refactor` `docs` `test` `ci`** (ไม่มี `build`/`perf`/`style`) |
| ห้ามแก้ (`GH-03`) | `.github/workflows/` · `CODEOWNERS` |
| `.standards-version` (`GH-04`) | เลือกเวอร์ชันชุดตรวจของ CI · submodule `standards/` ต้องชี้ tag เดียวกัน · เลื่อนเองได้ ห้ามถอย ([`standards-versioning.md`](standards-versioning.md)) |
| PR | เล็กและโฟกัสเรื่องเดียว · แนบ `REPORT.md` |

repo ที่ DevOps สร้างด้วย `new-subsystem.sh` มีไฟล์ CI ครบตั้งแต่ commit แรก — ทีมไม่ต้องเพิ่มหรือแก้ไฟล์ CI เอง

---

## ขั้น 10 — Definition of Done

- [ ] `run-all-checks.sh` ผ่านทุกข้อ
- [ ] `docker compose up -d --build` แล้ว `db` `api` `web` เป็น `healthy` และ login ผ่าน `http://localhost:32xx` ได้ ([`deployment.md`](deployment.md) ข้อ 6)
- [ ] `conformance` ได้ `0 failed` `0 skipped` ที่ระดับที่ตกลงกับ PL (รันด้วยไฟล์บัญชีนอก repo)
- [ ] เข้าระบบผ่าน SSO ได้จริงกับ server จริงทั้ง 2 ทาง — ปุ่ม login ของระบบ และเมนูในพอร์ทัล ([`connect-core-hub.md`](connect-core-hub.md) ข้อ 6)
- [ ] ค้น log แล้วไม่พบ token (`eyJ`) · `access_token=` · header `Authorization`/`Cookie`
- [ ] ทดสอบทุก core role ที่ระบบรับตาม mapping (`student` `alumni` `staff` `lecturer` `guest` `admin`) — role ที่ไม่ได้อยู่ใน mapping ต้องโดน 403
- [ ] ไม่มี `.env` / `*.pem` / `generated/` / `dist/` ใน git
- [ ] `README.md` มีคำสั่งติดตั้ง–รัน–ทดสอบ ที่ **ใช้ได้จริงทุกบรรทัด**
- [ ] `REPORT.md` แนบผลรันจริง (ไม่ใช่ "น่าจะผ่าน") ตาม [`../ai/AGENTS.md`](../ai/AGENTS.md) ข้อ 6
- [ ] PL review และรับงาน

---

## กับดักที่เจอจริงมาแล้ว

| อาการ | สาเหตุ | ทางแก้ |
|---|---|---|
| CI ตก `Cannot find name 'LayoutProps'` ทั้งที่ในเครื่องผ่าน | `.next/types` ค้างในเครื่อง แต่ CI ไม่มี | `"typecheck": "next typegen && tsc --noEmit"` |
| `pnpm install` ล้มบน CI ที่ `prisma generate` | `prisma.config.ts` ใช้ `env('DATABASE_URL')` แต่ postinstall รันก่อนมี `.env` | แนบ `datasource` เฉพาะตอนมี env จริง |
| `pnpm test` ที่รากขึ้นเขียวแต่ไม่ได้รันเทสต์เลย | `name` ใน `package.json` ที่รากซ้ำกับของ `backend/` → `--filter` ไม่ match แล้ว exit 0 | ตั้งชื่อ workspace ไม่ให้ซ้ำ (`QA-06`) |
| ระบบย่อยขึ้น 401 ทุกคำขอ | Core Hub ห่อ JWKS ด้วย envelope / cache กุญแจเก่าไว้ | JWKS ต้องเป็น `{"keys":[...]}` ดิบ · ล้าง cache แล้ว login ใหม่ |
| ลงทะเบียนแล้วแต่เข้า SSO ไม่ได้ (403) | core role ของผู้ใช้ไม่อยู่ใน key ของ `default_role_mapping` | เพิ่ม role ในทะเบียน หรือทดสอบด้วย role ที่อนุญาต |
| `callbackUrl must use HTTPS` | Core Hub ปิดโหมดก่อนเปิดใช้ (`ALLOW_LOCALHOST_CALLBACKS`) — server จริงเปิดอยู่ช่วงนี้ | แจ้งผู้ดูแล dev server |
| หลัง login เจอ `Cannot GET /` | ลงทะเบียน callback เป็นพอร์ต backend | ให้ admin แก้ callback เป็นพอร์ต frontend (32xx) |
| อาการอื่นตอนเชื่อม server จริง | — | ตาราง [`connect-core-hub.md`](connect-core-hub.md) ข้อ 8 |
| conformance ขึ้น `SKIP` หลายเคส | `probes` ใน `subsystem.yaml` ประกาศไม่ครบ | ประกาศให้ครบ — SKIP ไม่นับว่าผ่าน |

---

## ใช้ AI ช่วยเขียน

ต้องให้ AI อ่าน [`../ai/AGENTS.md`](../ai/AGENTS.md) ก่อนเสมอ แล้วสั่งงานด้วย
[`../ai/TASK_TEMPLATE.md`](../ai/TASK_TEMPLATE.md) และตรวจงานด้วย [`../ai/CHECKLIST.md`](../ai/CHECKLIST.md)

**ผลงานจาก AI ต้องผ่านเกณฑ์เดียวกับที่คนเขียน** — ขั้น 8 ไม่มีข้อยกเว้นให้ และ
"AI เขียนมาแบบนี้" ไม่ใช่เหตุผลที่รับได้ตอน review
