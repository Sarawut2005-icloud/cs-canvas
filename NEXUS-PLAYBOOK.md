# คู่มือทำระบบย่อยให้ผ่านมาตรฐาน PM: สรุปจากที่ csmju-nexus ทำผ่านจริง

> **ผลของ nexus:**
> - conformance 1.7.1 กับ Core Hub จริง **69 passed · 0 failed · 0 skipped**
> - CI ของ org ผ่าน **8/8** · PR #5–#11 merge เข้า `CSMJU2030/csmju-nexus` ครบ
>
> **โค้ดต้นแบบที่ดูได้:**
> - `C:\Users\User\nexus-dev`: worktree ของ org repo (main ล่าสุดต้อง `git fetch org`)
> - หรือ `https://github.com/CSMJU2030/csmju-nexus` (public)
> - **ห้ามใช้ `C:\Users\User\cs-nexus` เป็นต้นแบบ** เพราะเป็น repo ส่วนตัวรุ่นเก่า (ยังมีเอกสารภายใน)
>
> ทำตามลำดับข้างล่างทีละขั้น **ห้ามข้ามขั้น** เพราะขั้นหลังต้องใช้ผลของขั้นก่อน

---

## ขั้น 0: เตรียมก่อนเขียนโค้ด

1. **clone repo ของ org ที่ DevOps สร้างไว้** (ห้ามสร้าง repo เอง):
   ```
   git clone https://github.com/CSMJU2030/csmju-<ระบบ>.git
   cd csmju-<ระบบ>
   git submodule update --init standards
   cat .standards-version          # ต้องตรงกับ tag ของ submodule
   git -C standards describe --tags
   ```
   - ถ้ายังเป็น 1.7.0 ให้ทำ **PR bump เป็น v1.7.1 ก่อน** แยก PR (nexus #6):
     - แก้ `.standards-version` และ `git -C standards checkout v1.7.1`
     - commit `chore(<ระบบ>): bump standards to v1.7.1`
2. **อ่านเอกสาร:** `standards/docs/overview.md` → `auth-contract.md` → `api-conventions.md` → `data-dictionary.md` → `connect-core-hub.md` → `conformance.md` → `ai/AGENTS.md`
3. **เช็ก Core Hub จริง:**
   - `https://csmju2030.jowave.com/api/v1/health` ต้องได้ 200
   - `/api/v1/.well-known/jwks.json` ต้องขึ้นต้นด้วย `{"keys":[`
4. **ฐานข้อมูล:** Postgres ใน Docker แยกของระบบนี้ ใช้พอร์ตอื่นที่ไม่ใช่ 5432 (nexus ใช้ 55432)
   - backend มี `docker-compose.yml` และคำสั่ง `pnpm db:up`
5. **Git hook:** repo ของ org มี `.githooks/pre-push` ให้รัน `git config core.hooksPath .githooks`
   - ห้ามใช้ `--no-verify`

## ขั้น 1: โครง workspace (ลอก nexus)

```
package.json          # root: "packageManager": "pnpm@12.6.0", scripts รวม
pnpm-workspace.yaml   # packages: frontend, backend
backend/              # NestJS
frontend/             # Next.js 16 App Router
subsystem.yaml        # manifest (LF เท่านั้น)
openapi.json?         # อยู่ที่ backend/openapi.json
REPORT.md             # ส่งงาน (ขั้น 9)
```

**ไฟล์ที่ควรลอกจาก nexus:**

| ไฟล์ใน nexus | ใช้ทำอะไร | ต้องแก้อะไร |
|---|---|---|
| `backend/package.json` (scripts) | `postinstall: prisma generate`, `lint: eslint src test`, `test: vitest run`, `openapi`, `openapi:check`, `typecheck` | ชื่อและ dependency ตามระบบ |
| `backend/eslint.config.mjs` | ESLint ที่อยู่ใน whitelist (ห้ามใช้ oxlint) | ไม่ต้องแก้ |
| `backend/prisma.config.ts` | config ของ Prisma 7 | ไม่ต้องแก้ |
| `backend/src/main.ts`, `bootstrap.ts`, `openapi.ts` | บูต Nest + swagger | ชื่อระบบและพอร์ต |
| `backend/src/scripts/write-openapi.ts`, `check-openapi.ts` | สร้างและตรวจ `openapi.json` | ต้องมีบรรทัด `process.env.DATABASE_URL ??= 'postgresql://localhost:5432/openapi_placeholder';` |
| `backend/src/health/` | `GET /api/health` → `{status, service}` | `service` = ชื่อระบบ |
| `backend/src/common/http/` | envelope + exception filter (9 error codes, `Retry-After`) | ไม่ต้องแก้ |
| `backend/src/common/prisma/` | PrismaService + `PrismaPg` | ไม่ต้องแก้ |
| `backend/src/common/storage/` + `modules/assets` | อัปโหลดลงดิสก์ + signed URL (ใช้แทน S3/MinIO) | ขนาดไฟล์และชนิดไฟล์ |
| `frontend/next.config.ts` | rewrite `/api/*` + `/auth/login`, `/auth/callback`, `/auth/logout` ไป backend + `turbopack.root` | พอร์ต backend |
| `frontend/src/lib/csmju/api.ts`, `session.tsx`, `roles.ts` | fetch envelope, 401 → re-SSO, กันวน, logout ด้วยฟอร์ม POST | ชื่อ key ของ sessionStorage |
| `frontend/vitest.config.mts` + `vitest.setup.ts` | ต้องมี `process.env.TZ = 'Asia/Bangkok'` | ไม่ต้องแก้ |
| `frontend/src/app/layout.tsx` + `src/app/fonts/` | ฟอนต์ใน repo ผ่าน `next/font/local` + ไฟล์ OFL | ไม่ต้องแก้ |

## ขั้น 2: ชั้น auth (SSO 1.1) · ลอกทั้งโฟลเดอร์ ห้ามแก้ตรรกะ

**ลอก `backend/src/auth/` ของ nexus มาทั้งโฟลเดอร์:**
- `sso.controller.ts`, `sso-session.ts`, `next-path.ts`
- `core-hub-token.verifier.ts`, `jwks.service.ts`, `core-hub-jwt.guard.ts`
- `current-user.decorator.ts`, `me.controller.ts`, `role-mapping.ts`
- `auth-events.ts`, `auth.config.ts`, `auth.module.ts` + spec

**แก้เฉพาะ 2 อย่าง:**
1. **ชื่อคุกกี้:** `csmju_nexus_sso_state` → `csmju_<ระบบ>_sso_state` และ `csmju_nexus_access_token` → `csmju_<ระบบ>_access_token`
2. **`role-mapping.ts`:** ให้ตรงกับ `default_role_mapping` ใน `subsystem.yaml` **เป๊ะ**

**สิ่งที่ห้ามทำ:**
- **ห้ามแก้ `me.controller.ts` และตัวตรวจ token หลังจากนี้** (`ai/AGENTS.md` ข้อ 2)
  - nexus เคยต้องการให้ `/me` สร้างโปรไฟล์ เลยย้ายไปเรียก `GET /api/v1/subsystem-members/me` จากหน้าบ้านหลัง `/me` สำเร็จแทน
- **ห้ามมีหน้า login หรือช่องรหัสผ่าน** และห้ามเก็บอีเมล ชื่อจริง หรือ core role ลงฐาน
  - เก็บได้แค่ `core_user_id` (`sub`)
  - ชื่อที่แสดงให้ cache จากส่วนหน้าของอีเมลในตาราง `profile_cache` แบบ nexus
- **token ห้ามอยู่ใน localStorage/sessionStorage** · อยู่ในคุกกี้ HttpOnly เท่านั้น

**env ของ backend** (`.env` ห้าม commit · มี `.env.example` ที่ใส่แค่ชื่อตัวแปร):
```
DATABASE_URL=postgresql://...:55xxx/...
PORT=42xx
CORE_HUB_URL=https://csmju2030.jowave.com
CORE_HUB_WEB_URL=https://csmju2030.jowave.com
CORE_HUB_JWKS_URL=https://csmju2030.jowave.com/api/v1/.well-known/jwks.json
CORE_HUB_ISSUER=core-hub
CORE_HUB_AUDIENCE=csmju2030
SUBSYSTEM_ID=csmju-<ระบบ>
LOCAL_STORAGE_SECRET=<openssl rand -hex 32>
```

**env ของ frontend** (`frontend/.env.local`):
```
BACKEND_URL=http://127.0.0.1:42xx
NEXT_PUBLIC_API_URL=/api/v1
NEXT_PUBLIC_CORE_HUB_WEB_URL=https://csmju2030.jowave.com
```

## ขั้น 3: `subsystem.yaml` (บันทึกเป็น **LF** · ห้ามมีข้อความหลายบรรทัดและ flow mapping)

ดู `subsystem.yaml` ของ nexus เป็นแบบ โดยมีหลักดังนี้:
- `name: csmju-<ระบบ>` ต้องตรงกับทะเบียน, `SUBSYSTEM_ID` และ `service` ของ `/api/health`
- `conformance_level: L3` (มีหน้าเว็บ) · **ห้ามมี `standards_version`** (deprecated) · ห้ามมี `test_accounts`
- `base_url: http://localhost:32xx` ต้องเป็น **localhost ไม่ใช่ 127.0.0.1** เพราะคุกกี้แยกตาม host
- `core_hub_url` / `core_hub_web_url`: `https://csmju2030.jowave.com` · `callback_path: /auth/callback`
- `public_endpoints` มีแค่ 4 เส้น: `GET /api/health`, `GET /auth/login`, `GET /auth/callback`, `POST /auth/logout`
- `default_role_mapping` 6 role · nexus ใช้ student/alumni/guest→GUEST, staff/lecturer→EDITOR, admin→ADMIN
- `probes` **ต้องประกาศครบ** ไม่อย่างนั้นจะขึ้น SKIP ซึ่งนับเป็นไม่ผ่าน:
  - `collection`: list endpoint จริงของระบบ
  - `not_found`: path ที่ใช้ UUID v4 ที่ไม่มีอยู่จริง
  - `invalid_id`: path ที่ id ไม่ใช่ UUID
  - `create`: การเขียนที่ `denied_role` **ถูกห้ามจริงตามการออกแบบ**
    - nexus ใช้สร้างห้อง COURSE ที่ทำได้แค่ staff
    - `denied_role: guest` เพราะ server จริงไม่มีบัญชีรหัสผ่านของ student
    - `valid_body` ต้องใช้ key ที่เป็นคำเดียว เพราะ runner แปลง snake_case เป็น camelCase ทั้งก้อน
    - ห้ามเลือก action ที่นักศึกษาทำได้ตามปกติ (nexus เคยใช้สร้างโพสต์แล้ว L2-12 ตก)
- `owners: { pl: "@csmju2030/pl-<ระบบ>", aie: "@csmju2030/aie-<ระบบ>" }`
- **repo เป็น public:** ห้ามใส่ coreUserId จริง ชื่อจริง หรือรหัสนักศึกษา

## ขั้น 4: ลงทะเบียนกับ Core Hub จริง (PL ทำ)

1. PL ล็อกอิน `https://csmju2030.jowave.com/backoffice` ด้วยบัญชีเจ้าของระบบของทีม (role staff · รหัสอยู่ในไฟล์ private ของ PL นอก repo)
2. ลงทะเบียนระบบ:
   - name `csmju-<ระบบ>`
   - Callback URL `http://localhost:32xx/auth/callback`
   - Base URL `http://localhost:32xx`
   - role mapping ตาม yaml
3. รอให้สถานะเป็น **APPROVED / ACTIVE** ถ้ายังไม่เป็น `sso/handoff` จะตอบ 409
4. **ทดสอบ:** เปิด `http://localhost:32xx` (**ห้ามใช้ 127.0.0.1**) → ระบบพาไป Core Hub → ล็อกอินแล้วต้องกลับมาหน้าเดิม

## ขั้น 5: API และข้อมูล (สิ่งที่ CI ตรวจ)

**API**
- path `/api/v1/<พหูพจน์-kebab>` · ห้ามมีกริยาใน path · path param เป็น UUID v4 (ไม่ใช่ → 400) · ใส่ `ParseUUIDPipe` ทุกตัว
- **JSON เป็น camelCase ทั้งหมด** (nexus แปลงทั้งระบบใน commit `515b7f5`)
  - envelope `{success, data, meta}` · list ต้องมี `meta {total,page,limit,totalPages}` · ใช้ `?page=&limit=`
- สร้าง → 201 · ลบ → 200 `{id, deleted:true}` · validation ผิด → 400 · error code มีได้แค่ 9 ค่า
- ใช้ `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`
- **`openapi.json` ต้องตรงกับโค้ด** ทุกครั้งที่แก้ endpoint ให้รัน `pnpm --filter backend openapi` แล้ว commit ไฟล์ด้วย
  - ถ้ามีสอง PR แก้ openapi พร้อมกันจะชนกัน ต้อง merge ทีละ PR

**Prisma**
- pin `prisma`, `@prisma/client`, `@prisma/adapter-pg` เป็น **7.9.1 ห้ามมี `^`** · generator `prisma-client`
- ตารางเป็น plural snake_case (`@@map`) · คอลัมน์ snake_case (`@map`) · field camelCase · enum PascalCase ค่า UPPER_SNAKE
- **relation ย้อนกลับที่ชื่อเป็น camelCase** ต้องใส่ `@relation("ชื่อ")` ทั้งสองฝั่ง ไม่งั้น DD-03 ตก
- อ้างผู้ใช้ด้วย `coreUserId` → คอลัมน์ `core_user_id` **ห้ามตั้งชื่อ userId**
- **ห้ามมีตารางหรือ seed ของคณะ วิชา หรือภาคการศึกษา** (DD-04) · เก็บแค่ `code`
- migration ใช้ `prisma migrate deploy` เท่านั้น · **ห้าม `migrate reset`** (ข้อมูลหาย) · ห้ามลบหรือ squash migration

**Logging**
- log แค่ path เป็น JSON บรรทัดเดียว · ห้าม log URL ของ `/auth/callback` (มี token) · ห้าม log header Cookie/Authorization

## ขั้น 6: Dependency (ARC-02 · ตีตกทันที)

- **ก่อน `pnpm add` ทุกครั้ง** ให้เปิด `standards/allowed-deps.json` (หรือไฟล์ whitelist ใน submodule) ดูก่อน
- **1.7.1 อนุญาตเพิ่มแล้ว:** `socket.io`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io-client`, `@testing-library/jest-dom`, `@testing-library/user-event` (dev)
- **nexus เคยต้องถอดออก 9 ตัว:** shadcn, radix ×2, class-variance-authority, clsx, tailwind-merge, tw-animate-css, framer-motion และ oxlint (เปลี่ยนเป็น ESLint) แล้วเขียนแทนเอง
- **ถ้าจำเป็นจริง** (เช่น `konva` ของ canvas) ให้ยื่นขอข้อยกเว้น:
  1. เปิด Issue ใน `CSMJU2030/csmju2030-standards` ด้วยฟอร์ม "ขอข้อยกเว้นมาตรฐาน" (nexus #40 คือแบบ)
     - ใส่เหตุผล ทางเลือกที่ลองแล้ว scope (package.json ไหน) และวันหมดอายุ
  2. PL comment รับรอง
  3. PM/DevOps อนุมัติ แล้ว DevOps เพิ่ม `.compliance-exceptions.yml` เอง
     - **ทีมห้ามสร้างหรือแก้ไฟล์นี้** เพราะ CODEOWNERS เป็น devops
  - **ระหว่างรอ อย่าเพิ่ง push dependency นั้นเข้า PR** ไม่อย่างนั้น CI แดงค้าง

## ขั้น 7: ตรวจในเครื่องก่อน push (ต้องเขียวทั้งหมด)

```
pnpm install --frozen-lockfile
bash standards/scripts/run-all-checks.sh .            # 19 ข้อ
rm -rf frontend/.next && pnpm -r typecheck
pnpm -r lint
pnpm -r test                                          # frontend ใส่ CI=true ด้วย
pnpm --filter backend test:e2e                        # ต้องรัน DB ก่อน
pnpm -r build                                         # next build + nest build (QA-04)
CONFORMANCE_ACCOUNTS_FILE=$HOME/.csmju/conformance-accounts.json node standards/conformance/run.js
#   ต้องได้ "N passed · 0 failed · 0 skipped" + ✅ CONFORMANT
```

**ข้อควรรู้**
- **GH-02 ตกในเครื่องแต่ CI ผ่าน:** เกิดจาก commit เก่าบน main ที่ squash ไว้ไม่ตรงรูปแบบ CI ตรวจเฉพาะ commit ใน PR
- **conformance ใช้บัญชีจริง:**
  - ล็อกอินบัญชีละครั้ง **ห้ามลองซ้ำ** เพราะผิด 10 ครั้งใน 15 นาทีบัญชีถูกล็อก
  - ไฟล์บัญชีอยู่ `~/.csmju/` นอก repo · ห้ามพิมพ์รหัสหรืออีเมลออก log
- **server ที่ต้องรันค้างบน Windows:** ใช้ PowerShell `Start-Process` (Bash background ถูก kill)
- **ทดสอบในเบราว์เซอร์จริงทุกหน้า** ด้วยบัญชี owner/staff/guest กับ Core Hub จริง
  - nexus เจอบั๊กที่เทสต์ไม่จับหลายตัวจากขั้นนี้ เช่น ชื่อเป็น UUID และสิทธิ์ guest

## ขั้น 8: CI ของ org (8 ด่าน) และสาเหตุที่ nexus เคยตก

| ด่าน | nexus ตกเพราะ | แก้โดย |
|---|---|---|
| Code Quality: build (QA-04) | `next/font/google` ดาวน์โหลดฟอนต์บน CI ไม่ได้ | ใช้ `next/font/local` + ไฟล์ฟอนต์ใน repo |
| Code Quality: test (QA-03) | เทสต์ที่ขึ้นกับเวลา (CI ใช้ UTC) | `process.env.TZ='Asia/Bangkok'` ใน vitest config |
| Code Quality: test (QA-03) | เทสต์ที่รอ `setTimeout` จริง ผ่านบน Windows แต่ตกบน Linux | mock ให้ตอบทันที อย่าพึ่งเวลา |
| Code Quality: install/build | Prisma Client ไม่ถูกสร้าง และสคริปต์ openapi ไม่มี `DATABASE_URL` | `postinstall: prisma generate` + fallback `DATABASE_URL` ในสคริปต์ |
| Code Quality: test | เทสต์ที่ผ่านบ้างตกบ้าง (Esc ของเมนู) | แก้บั๊กจริง (ฟัง keydown ที่ document) ไม่ใช่ re-run |
| Security & Stack Scan (ARC-02) | dependency นอก whitelist | ถอดออก หรือขอข้อยกเว้น (ขั้น 6) |
| Data Dictionary (DD-03) | relation ย้อนกลับไม่มีชื่อ | `@relation("ชื่อ")` |
| API Contract Sync | `openapi.json` ไม่ตรงกับโค้ด | `pnpm --filter backend openapi` แล้ว commit |

## ขั้น 9: Git, PR และการ merge

- **branch:** `feature/<ระบบ>/<เรื่อง>` หรือ `fix/<ระบบ>/<เรื่อง>` · แยก PR ละเรื่อง แตก branch จาก `origin/main` ล่าสุด
- **commit:** `feat|fix|chore|docs|test|refactor(<ระบบ>): ข้อความ` ท้าย commit มี `Co-Authored-By: Claude ...`
- **ใครทำอะไร:**
  - **AIE เจ้าของโปรเจกต์:** push และเปิด PR ด้วยบัญชีตัวเอง
  - **PL:** approve
  - **Claude:** ห้าม push เอง ให้คำสั่งกับ PL
- **กติกาของ GitHub ที่ต้องรู้:**
  - คนเปิด PR approve PR ตัวเองไม่ได้ (nexus PR #7 ต้องปิดแล้วให้ AIE เปิดใหม่ #8)
  - approve ของคนที่ push ล่าสุดไม่นับ → **ถ้าขึ้น "out-of-date" ให้ AIE กด Update branch** (PL อย่ากดเอง)
  - "Merging was blocked due to rule violation" = CI ยังไม่จบ ยังไม่ approve หรือ branch ยังไม่อัปเดต
- **Squash and merge:** **แก้ title ให้เป็น `type(<ระบบ>): …` ก่อนกด Confirm ทุกครั้ง** เพราะ title อัตโนมัติของ GitHub ไม่ตรงรูปแบบ แล้วกด Delete branch
- **หลาย PR ที่แก้ `openapi.json`:** merge ทีละอัน และ Update branch ก่อนอันถัดไป

## ขั้น 10: ส่งงาน (`REPORT.md` ที่ราก repo · ดู nexus PR #8)

ใช้รูปแบบใน `standards/ai/AGENTS.md` ข้อ 6:
- ผลรัน `run-all-checks` และ conformance (10 บรรทัดสุดท้ายของจริง)
- ไฟล์ที่สร้างหรือแก้
- ชั้น auth ที่คัดลอกมา (คัดลอกจาก / แก้ไข)
- ตาราง role mapping
- ข้อสมมติที่ตั้งเอง
- สิ่งที่ยังทำไม่ได้

**Definition of Done**
- checks ผ่านและ conformance 0/0
- SSO ใช้ได้ทั้งจากปุ่มของระบบและจากเมนูในพอร์ทัล
- ค้น log แล้วไม่เจอ `eyJ` หรือ `access_token=`
- ทดสอบครบทุก role ที่ทำได้
- ไม่มี `.env`, `*.pem`, `generated/`, `dist/` ใน git

## สิ่งที่ PM ตอบแล้ว (ใช้ได้กับทุกระบบ)

- **design-system:** ยังไม่บังคับ ใช้ UI ที่ทำเองต่อได้ (DS-22 ไม่อยู่ใน CI) แต่สีต้องเป็น CSS variable หรือ token (UI-01) และห้ามมี hex ดิบ
- **NestJS 12 / TypeScript 6:** ใช้ได้
- **ขึ้น host จริง:** เป็นงานของ PM
  - ตอนเปิดใช้จริงต้องเปลี่ยน callback และ Base URL เป็น https และตั้ง `NODE_ENV=production` (`connect-core-hub.md` ข้อ 9)
