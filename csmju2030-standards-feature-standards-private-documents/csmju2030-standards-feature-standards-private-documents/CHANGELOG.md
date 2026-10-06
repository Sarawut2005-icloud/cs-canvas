# Changelog

รูปแบบเวอร์ชัน: เอกสารมาตรฐานใช้ `MAJOR.MINOR` (เช่น `1.0`) · repo และ git tag ใช้ semver (`1.0.0`)
ระบบย่อยเลือกเวอร์ชันใน `.standards-version` และเลื่อนเองได้ตั้งแต่ 1.5.1 ([`docs/standards-versioning.md`](docs/standards-versioning.md))

---

## 1.8.3 — 2026-10-06

เอกสารอย่างเดียว — ตอบรายงานของ `csmju-branch-finance-transparency` (LINE และไฟล์ PDF) · ไม่มีตัวตรวจใหม่

- **`docs/deployment.md` 1.3 ข้อ 4.3 ใหม่ — เอกสารที่ผู้ใช้อัปโหลด (บิล · สลิป · PDF)** เก็บในฐานข้อมูลของระบบเอง:
  ตรวจชนิดจาก byte ต้นไฟล์ · ไม่เกิน 10 MB (ตัดตั้งแต่ตอนรับ · ตอบ `400 VALIDATION_ERROR`) · เก็บต้นฉบับพร้อม `sha256` · แยกตารางไฟล์ ·
  เปิดผ่าน api ที่ตรวจสิทธิ์ทุกครั้ง (`attachment` · `nosniff` · `private, no-store`) · เกิน 1 GB ต้องตกลงกับ DevOps · ตัวอย่าง Prisma model
- **ข้อ 3.4 แก้ข้อความของ 1.8.0** ที่เขียนกว้างเกินว่า "ไฟล์ที่ผู้ใช้อัปโหลดเก็บผ่าน Core Hub" — แยกเป็นรูปที่ใครเห็นก็ได้ → Core Hub `/images` ·
  เอกสารที่ต้องตรวจสิทธิ์หรือเก็บต้นฉบับ → ฐานของระบบเอง (ข้อ 4.3)
- `docs/reference-data.md` 1.4 ข้อ 6 — คำเตือนว่า `/images` ใช้กับรูปที่ใครเห็นก็ได้เท่านั้น: ไฟล์เปิดได้โดยไม่ login ·
  `Cache-Control: public, max-age=86400` (ลบแล้วอาจยังเปิดได้ถึง 1 วันรวมที่ Cloudflare) · แปลงเป็น WebP — ตรวจกับโค้ด
  `images.controller.ts` ของ Core Hub `develop` · ข้อ 8 เพิ่มแถวเอกสาร
- `ai/AGENTS.md` — กับดัก 2 แถว: อัปโหลดบิล/สลิป/PDF ไป `/images` หรือเขียนลงดิสก์ · ผูก LINE/แชตให้สร้างรายการแทนผู้ใช้ (auth-contract ข้อ 9)

**ใครต้องทำอะไร:** ระบบที่รับเอกสารการเงินหรือเอกสารที่มีข้อมูลส่วนบุคคลแล้วส่งไป `/images` ให้ย้ายมาเก็บในฐานของตัวเองตามข้อ 4.3 ·
ระบบที่ใช้ `/images` กับรูปข่าวหรือภาพประกอบใช้ต่อได้ตามเดิม

---

## 1.8.2 — 2026-10-06

เอกสารอย่างเดียว — ไม่มีกฎหรือตัวตรวจที่เข้มขึ้น ไม่ต้องเลื่อนเวอร์ชันก็อ่านได้บน GitHub

- `docs/deployment.md` 1.2
  - **ข้อ 8 ใหม่ — ระบบที่ต้องรันโค้ดของผู้ใช้** (ตอบคำถามของ `csmju-coding-arena`): ห้าม mount `/var/run/docker.sock` ·
    docker-socket-proxy · Docker-in-Docker แบบ privileged · รันโค้ดใน api ตรง ๆ · ทางที่ใช้คือ Docker แบบ rootless ของ user `judge`
    ที่ server เตรียมให้ผ่าน `DOCKER_HOST` (ระบบยังเป็น web + api) · flag ขั้นต่ำของ container ที่รันโค้ด · การทดสอบในเครื่อง ·
    ต้องให้ PM อนุมัติก่อนเปิดใช้
  - **ข้อ 6.1 ใหม่ — ในเครื่องต่างจาก server ตรงไหน** (CPU · role ของฐานข้อมูล · env · URL · RAM · เน็ต · callback)
  - ข้อ 3.4 — ห้ามสร้าง URL เต็มจาก request (`new URL(path, request.url)` · Host header) และห้ามฝัง `localhost` · ห้ามรันโค้ดผู้ใช้ใน api
  - ข้อ 4.1 — role บน server ไม่ใช่ superuser: `CREATE EXTENSION` ตกบน server · ใช้ `gen_random_uuid()` ที่มีในตัว
  - ข้อ 6 และ 7 — compose ในเครื่องจำกัด RAM เท่า server และหมุน log · compose บน server หมุน log (`max-size: 10m` · `max-file: 3`)
- `ai/AGENTS.md` — กับดัก 2 แถว: `docker.sock` / รันโค้ดผู้ใช้ด้วย `child_process` · `CREATE EXTENSION` / URL เต็มจาก request
- **แก้ข้อมูลใน 1.8.1:** ที่เขียนว่า "ทั้ง 37 repo มี `backend/Dockerfile` และ `frontend/Dockerfile` อยู่แล้ว" ผิด — สคริปต์สำรวจนับไฟล์ที่ไม่มีเป็นมี ·
  ข้อมูลจริง ณ 6 ต.ค.: ไม่มี Dockerfile เลย 23 repo · มีแค่ `backend/Dockerfile` 8 repo · มีทั้งสอง 6 repo · ใน 14 repo ที่มี `backend/Dockerfile`
  มี 6 repo ที่ copy ตัวเก่าของ demo ซึ่ง build ไม่ผ่าน — เหตุผลของ 1.8.1 (build เฉพาะ repo ที่ถึง 1.8.0) ยังเหมือนเดิม

**ใครต้องทำอะไร:** ทีมที่รันโค้ดของผู้ใช้อ่านข้อ 8 · ทุกทีมอ่านข้อ 6.1 ก่อนทดสอบ Docker · ทีมที่ copy `docker-compose.yml` ของ demo ไปแล้ว
เพิ่ม `mem_limit` และ `logging` ตาม demo (หลัง PR ของ demo merge)

---

## 1.8.1 — 2026-10-06

แก้ workflow build image ก่อนวางในทุก repo — ทั้ง 37 repo มี `backend/Dockerfile` และ `frontend/Dockerfile` อยู่แล้ว
แต่เขียนก่อนมีข้อกำหนด (ใช้ standalone 2 repo · ตั้ง user ที่ไม่ใช่ root 2 repo · 6 repo copy Dockerfile ตัวเก่าของ demo ที่ build ไม่ผ่าน)
ถ้าวาง `images.yml` ของ 1.8.0 ทุก repo จะ build ทันทีที่ merge ครั้งถัดไป ส่วนใหญ่จะตก ทั้งที่ทีมยังไม่ได้เลื่อนเวอร์ชัน

- `.github/workflows/subsystem-images.yml` — job ใหม่ **Plan** อ่าน `.standards-version` ก่อน: **build เฉพาะ repo ที่อยู่ 1.8.0 ขึ้นไป**
  (Dockerfile ผ่าน `DEP-01..04` แล้ว) · ต่ำกว่านั้นข้ามพร้อมแจ้งเตือน ไม่ตก และไม่รัน job build เลย (ประหยัดนาที Actions) ·
  เลือก image จาก Dockerfile ที่มีจริงใน job เดียว · `actions/checkout@v5` (Node 24 — แก้คำเตือน Node 20 deprecated)
- `templates/images.yml` — build เฉพาะ push เข้า `main` (server ดึง `:main`) · branch อื่นสั่งเองได้ด้วย Run workflow · ปักหมุด `@v1.8.1`
- `org-settings/add-image-workflow.sh` · `new-subsystem.sh` · `docs/deployment.md` 1.1 ข้อ 5 และ 7 — ข้อความตามพฤติกรรมใหม่
- ตรวจแล้ว: logic ของ Plan กับ 9 กรณี (1.8.0 · 1.8.1 · 1.10.0 build · 1.7.4 · 1.0.0 · ไม่มีไฟล์ · ค่าเสีย ข้าม · มีแค่ backend · ไม่มี Dockerfile)

**ใครต้องทำอะไร:** ทีมไม่ต้องทำอะไร · **DevOps:** รัน `add-image-workflow.sh v1.8.1` (ย้าย demo จาก `@v1.8.0` และวางให้ repo ที่เหลือ)
— repo ที่ยังไม่ถึง 1.8.0 จะเริ่มได้ image เองเมื่อทีมเลื่อนเวอร์ชัน

---

## 1.8.0 — 2026-10-06

เตรียมทุกระบบย่อยขึ้น server กลาง (เครื่องเดียวกับ Core Hub) — ทีมเตรียม image ใน repo ได้ตั้งแต่ตอนนี้
ส่วนชื่อ subdomain และ spec เครื่องรออาจารย์อนุมัติ

- **เอกสารใหม่ [`docs/deployment.md`](docs/deployment.md)** — ระบบละ 2 image (`web` Next.js :3000 · `api` NestJS :4000) ·
  ชื่อเว็บ `<ชื่อในทะเบียน>.jowave.com` (แผน) และเหตุผลที่ห้ามแยกด้วย path · `BACKEND_URL` ถูกฝังตอน `next build`
  จึงต้อง build ด้วย `http://api:4000` · ฐานข้อมูลเป็น PostgreSQL ตัวกลาง ระบบละ database + role · env ที่ server ส่งให้ ·
  ทดสอบในเครื่องด้วย `docker compose` · งานของ DevOps ทั้งครั้งเดียวและต่อระบบ
- **กฎใหม่ `DEP-01..04`** (`scripts/check-deploy-ready.sh` · job Security & Stack Scan ไม่ต้องแก้ workflow หรือ ruleset):
  - `DEP-01` มี `backend/Dockerfile` และ `frontend/Dockerfile` (เมื่อมี `frontend/package.json`)
  - `DEP-02` stage สุดท้ายของ Dockerfile ตั้ง `USER` ที่ไม่ใช่ root — `USER` ใน build stage ไม่ตามมา
  - `DEP-03` `.dockerignore` ที่รากกัน `**/.env*` และ `**/node_modules` — `.env` เฉย ๆ กันแค่ที่ราก ไม่กัน `backend/.env`
  - `DEP-04` `frontend/next.config.*` ตั้ง `output: "standalone"`
  - ข้ามเมื่อ repo เพิ่ง scaffold · profile `core-hub` ยกเว้น (Core Hub build จาก `deploy/`) · fixture 7 ชุด + 2 assertion ของ profile ·
    self-test 114/114 บน bash 3.2
- **build image บน GitHub เก็บที่ ghcr.io** — reusable workflow ใหม่ `.github/workflows/subsystem-images.yml` และ
  [`templates/images.yml`](templates/images.yml) ที่ DevOps วางในทุก repo: push เข้า `main`/`develop` แล้วได้
  `ghcr.io/csmju2030/<repo>-api` และ `-web` (tag ชื่อ branch และ `sha-<commit>`) · ใช้แค่ `actions/checkout` + docker CLI
  จึงไม่ต้องแก้ allow-list ของ Actions · ยังไม่มี Dockerfile ก็ข้ามพร้อมแจ้งเตือน ไม่ตก · วางด้วย
  [`org-settings/add-image-workflow.sh`](org-settings/add-image-workflow.sh) · `new-subsystem.sh` สร้าง `images.yml` และ `.dockerignore` ให้ repo ใหม่
- **template หน้าเว็บ** — เพิ่ม [`Dockerfile`](templates/csmju-subsystem-web/Dockerfile) (multi-stage · user `node` · healthcheck ·
  สร้าง `public/` ให้เองเมื่อไม่มี) · `next.config.ts` ตั้ง `output: "standalone"` + `outputFileTracingRoot` · README หัวข้อ Deploy
- อัปเดต `tech-stack.md` ข้อ 1.1 · `repo-structure.md` · `aie-workflow.md` 1.2 (ขั้น 7 และ Definition of Done) · `ai/AGENTS.md`
  (กับดัก 3 แถว + คำสั่ง `docker compose`) · `ci-compliance-spec.md` ข้อ 7.1 และ 7.3 · `core-hub-rules.md` · `standards-versioning.md` ข้อ 5.4 ·
  `org-settings-checklist.md` (Package creation)
- ตรวจแล้ว: image ของ template build และรันได้ (healthy · user `node` · rewrites ชี้ `http://api:4000`) · demo build ทั้ง `api` และ `web`
  แล้วรันครบ `db` + `api` + `web` แบบ read-only ไม่มี capability — migration ผ่าน · `/api/*` ผ่าน web ถึง api · `/auth/login` พาไป Core Hub ·
  RAM web ~40 MB · api ~85 MB · คำสั่ง build/push ของ workflow ทดสอบกับ registry ในเครื่อง ได้ tag ครบและ cache ใช้ซ้ำได้

**ใครต้องทำอะไร:** ทีมที่เลื่อนเป็น `1.8.0` ต้องผ่าน `DEP-01..04` — copy `frontend/Dockerfile` และแก้ `next.config.ts` ตาม template ·
copy `backend/Dockerfile` · `backend/docker/entrypoint.sh` · `.dockerignore` · `docker-compose.yml` จาก demo ·
จำกัด connection ด้วย `DATABASE_POOL_MAX` (deployment.md ข้อ 4.1) · ทีมที่ยังอยู่ 1.7.x ยังไม่โดนตรวจ ·
**DevOps:** ตั้ง Package creation แล้วรัน `add-image-workflow.sh v1.8.0` หลังติด tag

---

## 1.7.4 — 2026-10-05

- `templates/csmju-subsystem-web/package.json` — `next` และ `eslint-config-next` จาก `16.3.4` เป็น `16.3.6` ตาม Dependabot security update
  (branch `dependabot/npm_and_yarn/templates/csmju-subsystem-web/next-16.3.6`) · ตรวจแล้ว: `typecheck` · `lint` · `build` · `UI-01` · `ARC-02/03` ผ่าน · หน้า template รันได้บน 16.3.6

**ใครต้องทำอะไร:** ระบบที่สร้าง `frontend/` จาก template หรือใช้ Next.js `16.3.4` (รวม demo และ Core Hub) ให้เลื่อน `next`
และ `eslint-config-next` เป็น `16.3.6` ใน `frontend/package.json` แล้ว `pnpm install` · ไม่มีกฎหรือตัวตรวจที่เข้มขึ้น

---

## 1.7.3 — 2026-10-05

- **ปุ่ม "กลับ CSMJU Portal"** ใน `CsmjuAppShell` ของ [`templates/csmju-subsystem-web/`](templates/csmju-subsystem-web/) —
  `ui-design-system.md` ข้อ 1 ล็อก "ปุ่มกลับ Dashboard" ไว้ใน AppShell แต่ template 1.7.2 ยังไม่มี · prop ใหม่ `coreHubUrl` (ไม่ส่ง = ไม่แสดง) ·
  `src/app/layout.tsx` ส่งค่าจาก env `CORE_HUB_WEB_URL` · เพิ่มใน `.env.example` และ README · ไอคอน `ArrowBackIcon` จากชุดกลาง
- `docs/ui-design-system.md` 1.3.2 — ข้อ 5.1 เพิ่มแถวปุ่มนี้
- ตรวจแล้ว: template `typecheck` · `lint` · `build` ผ่าน · `UI-01` ผ่าน · ปุ่มพาไป `CORE_HUB_WEB_URL` · ไม่ตั้ง env ไม่แสดงปุ่ม

**ใครต้องทำอะไร:** ไม่มีกฎหรือตัวตรวจที่เข้มขึ้น · ระบบที่ใช้ template แล้ว: เลื่อนเป็น `1.7.3` → copy `src/csmju/` ทับ →
ส่ง `coreHubUrl={process.env.CORE_HUB_WEB_URL}` ให้ `CsmjuAppShell` และใส่ `CORE_HUB_WEB_URL` ใน `.env` ของ frontend ·
ระบบที่ทำ Shell เอง ให้เพิ่มลิงก์เดียวกันตามข้อ 5.1 (ตัวอย่างใน demo)

---

## 1.7.2 — 2026-10-03

- **template หน้าเว็บ [`templates/csmju-subsystem-web/`](templates/csmju-subsystem-web/)** — ย้ายมาจาก repo `csmju-core-hub`
  (branch `feature/frontend` ของ Xo, `73ae729`) ที่ `ui-design-system.md` ข้อ 17.0 ชี้ไปแต่ไม่มีบน `develop`/`main` และทีมไม่มีสิทธิ์อ่าน ·
  ตอนนี้มากับ submodule `standards/` ของทุกระบบ ตรงกับ `.standards-version`
  - **ออกจากระบบเป็นฟอร์ม `POST /auth/logout`** ใน `CsmjuAppShell` (เดิมเป็นลิงก์ `logoutHref` ซึ่งไม่ถึง route ตาม `auth-contract.md` ข้อ 5) · ตัด prop `logoutHref`
  - `next.config.ts` ส่ง `/api/*` `/auth/login` `/auth/callback` `/auth/logout` ไป backend (`BACKEND_URL`) แบบเดียวกับ demo · เพิ่ม `.env.example`
  - โครง `src/` ตามข้อ 16.1 (alias `@/*` → `./src/*`) · `package.json` ชื่อ `frontend` มี `typecheck` · `--font-display` ต่อด้วย Noto Sans Thai ตามข้อ 4.1 ·
    เมนูใน sidebar เลื่อนได้โดยปุ่มออกจากระบบอยู่ในจอเสมอ · `.gitignore` ไม่ซ่อน `.env.example`
  - ตัด `design-system.md` (สำเนาเอกสารรุ่นเก่า) — `AGENTS.md` และ `README.md` ชี้ไป `standards/docs/ui-design-system.md` · README มีวิธีใช้ทั้งระบบใหม่และระบบที่มี `frontend/` แล้ว
  - ตรวจแล้ว: `pnpm install` · `typecheck` · `lint` · `build` ผ่าน · `UI-01` `SEC-03` `SEC-04/05` `ARC-01` `ARC-02/03` `SEC-01/02` ผ่าน ·
    ตัวตรวจของระบบย่อยไม่สแกน `standards/` จึงไม่กระทบ CI ของทีมใด
- `docs/ui-design-system.md` 1.3.1 — ข้อ 17.0 ชี้ไป template ใหม่ และระบุว่า `@csmju2030/design-system` **v1.3.0 ขัดกับมาตรฐาน ห้ามใช้**
  (สี `#004C99` · ห้าม `next/font` · auth ผ่าน `/oauth/token` ที่ Core Hub ไม่มี · `per_page`) · ข้อ 5.1 ปุ่มออกจากระบบเป็นฟอร์ม POST และเมนูเลื่อนได้

**ใครต้องทำอะไร:** ไม่มีกฎหรือตัวตรวจที่เข้มขึ้น · ระบบที่ติดตั้ง `@csmju2030/design-system` ไปแล้วให้ถอดออกแล้วใช้ template นี้แทน
(ตอบคำถามของ csmju-internship-directory) · ระบบที่ copy template จาก `csmju-core-hub` ไปแล้วให้ copy `src/csmju/` ใหม่ทับ
เพื่อได้ปุ่มออกจากระบบแบบ POST

---

## 1.7.1 — 2026-10-03

- `scripts/lib/allowed-deps.json` — อนุญาต realtime และเครื่องมือเทสต์หน้าเว็บ (PM/DevOps อนุมัติ 3 ต.ค. ตามคำขอของทีม csmju-nexus · standards#40):
  - `allowed_backend`: `socket.io` · `@nestjs/websockets` · `@nestjs/platform-socket.io` (MIT)
  - `allowed_frontend`: `socket.io-client` (MIT)
  - `allowed_dev_tooling`: `@testing-library/jest-dom` · `@testing-library/user-event` (MIT) — คู่ของ `@testing-library/react`
    ใช้ได้เฉพาะ `devDependencies` · อยู่ใน `dependencies` ยังตก `ARC-02`
- `docs/tech-stack.md` ข้อ 1.2 · 1.3 · 1.4.3 (ใหม่) · `ci-compliance-spec.md` ข้อ 7.3 — อัปเดตให้ตรงกับ whitelist
  พร้อมข้อกำหนด: `@nestjs/websockets` ใช้ major เดียวกับ NestJS · ตรวจ token ตอน handshake ด้วยตัวตรวจเดียวกับ REST · token ของ socket อยู่ใต้ `auth-contract.md` ข้อ 6.1
- fixture `__fixtures__/ARC-02-REALTIME` + `scripts/self-test.sh` — 6 ตัวใหม่ผ่าน · เครื่องมือเทสต์ใน `dependencies` ถูกตีตก
- **ฟอร์ม issue "ขอข้อยกเว้นมาตรฐาน"** (`.github/ISSUE_TEMPLATE/compliance-exception.yml`) — template ที่ `ci-compliance-spec.md` ข้อ 11
  อ้างถึงแต่ยังไม่เคยมี · ถามรหัสกฎ · `scope` · เหตุผล · ทางเลือกที่ลองแล้ว · ผลกระทบ · `expires` · ร่างรายการใน `.compliance-exceptions.yml` ·
  เตือนว่า repo เป็น public · ไม่เปลี่ยนกฎหรือตัวตรวจ

**ใครต้องทำอะไร:** ไม่มีกฎที่เข้มขึ้น · ระบบย่อยที่จะใช้แพ็กเกจเหล่านี้ให้เลื่อน `.standards-version` และ submodule `standards`
เป็น `1.7.1` (`docs/standards-versioning.md` ข้อ 2) · csmju-nexus เลื่อนแล้วลบรายการ `ARC-02` ของ standards#40 ออกจาก
`.compliance-exceptions.yml` ได้ · ระบบย่อยอื่นไม่ต้องทำอะไร

---

## 1.7.0 — 2026-10-01 · สายนิ่ง

สายที่ทุกทีมใช้ ตรงกับ Core Hub `develop` ที่ขึ้น `https://csmju2030.jowave.com` (PM ตัดสิน 1 ต.ค.) ·
**สาย 1.0.x ปิดแล้ว** — `1.0.6` เป็นตัวสุดท้าย ไม่ backport อีก

- **สายเดียวสำหรับทุกทีม** — README · `standards-versioning.md` ข้อ 2.5 (เลือก 1.7.x · สาย 1.0.x ปิด) · ข้อ 2.6 ใหม่
  (ย้ายจาก 1.0.x ทีละข้อ · PR ต้องให้ DevOps/PM approve เพราะแก้ `subsystem.yaml`) · ข้อ 5.3 (`MIN_VERSION` จะขึ้นเป็น `1.7.0` ในวันที่ PL ประกาศ)
- **เอกสารใหม่ [`docs/connect-core-hub.md`](docs/connect-core-hub.md)** — เชื่อม server จริงทีละขั้น: บัญชี · ลงทะเบียนในหลังบ้าน ·
  `.env` · proxy ของ frontend (พอร์ต 32xx/42xx) · ทดสอบ 7 ข้อ · ตารางปัญหาที่พบบ่อย · สิ่งที่เปลี่ยนตอนเปิดใช้จริง
- **สัญญา auth 1.2** (`auth-contract.md` · `contracts/jwt-contract.json`)
  - ตรวจ token **10 ขั้น**: ขั้น 9 อายุ token (`exp − iat` ≤ 900 + 60 วินาที — กัน refresh token ถูกใช้แทน) · ขั้น 10 `azp` ต้องเป็นชื่อระบบตัวเองเมื่อมี
  - ข้อ 6.1 **token คือบัตรผ่านของผู้ใช้** — ห้ามส่งต่อ เก็บลงฐาน หรือ log · เรียก Core Hub ได้เฉพาะ endpoint ใน `reference-data.md` ข้อ 2
  - `sub` เป็น string ทึบยาวไม่เกิน 64 **ไม่ใช่ UUID เสมอไป** · `email` ไม่ใช่กุญแจ · `role` คือ role สำหรับระบบนี้ · ห้ามปฏิเสธ token เพราะมี claim เพิ่ม
  - ข้อ 5.3 ผู้ใช้เห็นอะไรที่ `/sso/error` · เส้นทาง MJU SSO · callback ที่ state ไม่ตรงให้หน้า "เข้าสู่ระบบอีกครั้ง"
  - แผนถัดไป: Core Hub ใส่ `azp` · refresh token ใช้ `aud=core-hub-refresh` · ปฏิเสธ endpoint นอกรายการที่อนุญาต · สิทธิ์พิเศษมีผลจริง —
    ใช้ `azp` แทนแผนเดิมที่จะเปลี่ยน `aud`
- **ทะเบียนระบบย่อย 1.1** (`subsystem-registry.md` · `authorization.md` 1.1) — ใครทำอะไร (นักศึกษาลงทะเบียนไม่ได้ · ไม่ต้องส่ง `owner`) ·
  ฟอร์มหลังบ้าน · กฎชื่อ `^[a-z0-9]+(-[a-z0-9]+)*$` ยาว 1–64 · role mapping (key = role ที่เข้าได้ · value เป็นเอกสาร) · callback ใช้พอร์ต frontend ·
  โหมดก่อนเปิดใช้ · วงจรชีวิตครบ (reject · resubmit · suspend) · หน้า Monitor · สิทธิ์พิเศษรายบุคคล (มีผลเมื่อ Core Hub ขึ้นงาน)
- **ข้อมูลกลาง** (`reference-data.md` 1.3 · `data-dictionary.md` 1.1 · `api-conventions.md` 1.2)
  - endpoint ที่เรียกได้ (allowlist) · field ของทุกชุด · กติกา list/detail · rate limit · cache · ทำอะไรเมื่อ Core Hub ตอบไม่ปกติ
  - **สิ่งที่ระบบย่อยเก็บได้**: `core_user_id` (text) + `person_code` จาก `/people/me` · `code` ของข้อมูลอ้างอิง · `id` ของรูป — **ไม่เก็บชื่อหรืออีเมล**
  - code ไม่เปลี่ยนตั้งแต่ 1.7.0 (`science`→`SCI` และ `computer-science`→`CS` เกิดก่อนหน้านี้แล้ว)
  - `data-dictionary.md` เลิกให้เก็บชื่อ/คณะเองและเลิกชี้ `GET /users/:id` · `api-conventions.md` เลิกอ้าง SDK ที่ไม่มีอยู่ ใช้ชั้น auth ของ demo แทน
- **contracts และ schemas** — `vocabulary.json` 1.1 (6 role · คุกกี้ `<ชื่อ>_access_token` · pnpm · enum ของ Core Hub) ·
  `log-events.json` 1.1 (`token_lifetime_exceeded` · `invalid_azp` · ห้าม log URL ที่มี query และข้อมูลบุคคล) ·
  schema `common` · `department` · `role` · `user` ตรงกับ API จริง ·
  `subsystem.schema.json` (กฎชื่อ · `base_url` บังคับ · `core_hub_web_url` บังคับเมื่อ L3 · ห้าม `test_accounts` · role 6 ค่า)
- **conformance** (`conformance/` · `docs/conformance.md` 1.2)
  - บัญชีอ่านจาก `CONFORMANCE_ACCOUNTS_FILE` (ไฟล์ JSON นอก repo) · บัญชี seed ใช้ได้เฉพาะ Core Hub ในเครื่อง · ไม่มีไฟล์แล้วชี้ server อื่น = หยุดก่อนยิงคำขอใด ๆ
  - login ครั้งเดียวต่อบัญชี ไม่ retry (Core Hub ล็อกบัญชีเมื่อผิด 10 ครั้งใน 15 นาที) · `test_accounts` ใน `subsystem.yaml` = หยุดทันที
  - L3 อ่านทะเบียนด้วยบัญชีเจ้าของผ่าน `GET /api/v1/subsystems?q=` เมื่อไม่มี admin · ทดสอบ `lecturer` และ `guest`
  - **มี SKIP = NOT CONFORMANT** (exit 1) · template `conformance-nightly.yml` รับ secret `CONFORMANCE_ACCOUNTS_JSON`
- **logging 1.1** — ตรงกับ `log-events.json` · logger และ error filter log แค่ path
- **onboarding** — `overview` · `aie-workflow` (ลงทะเบียนผ่านหลังบ้าน · DoD) · `LOCAL_INTEGRATION_GUIDE` เป็นของทีม Core Hub เท่านั้น ·
  `ai/AGENTS.md` เพิ่มข้อที่ agent มักทำผิด 12 แถว · `ai/CHECKLIST.md` · `ai/TASK_TEMPLATE.md` · `repo-structure` (branch `feature/…` แบบเดียว · พอร์ต) ·
  `tech-stack` · `core-hub-rules` · `github-workflow` · `ui-design-system` (JSON เป็น camelCase) · PR template และ `ci-compliance-spec` (error code 9 ค่า · `core_user_id`)
- **`new-subsystem.sh`** — เช็กว่ามี tag ของ `VERSION` ก่อนสร้างอะไรบน GitHub · ไม่แก้เลข pin ของ `ci.yml` แล้ว (sed เดิมทำงานต่างกันบน macOS กับ GNU) ·
  `.env.example` ชี้ server จริงและใส่ชื่อระบบให้ · บอกให้ทีมแทนพอร์ต 32xx/42xx
- `scripts/check-no-hardcoded-faculty.sh` (`DD-04`) — ข้อความชี้ `GET /api/v1/faculties` และ `reference-data.md` (ตรรกะไม่เปลี่ยน)
- `STANDARDS_ENTRY_REF` เป็น `v1.7.0` ตามขั้นออกเวอร์ชัน (ตัวกลางไม่เปลี่ยน — repo ที่ปัก `@v1.5.2` ไม่ต้องย้าย)

**ใครต้องทำอะไร**
- **ทุกทีม:** เลื่อน `.standards-version` และ submodule เป็น `1.7.0` (`standards-versioning.md` ข้อ 2.2) — ทีมสาย 1.0.x ทำตามข้อ 2.6
- **ทีมที่คัดลอก `src/common/filters/all-exceptions.filter.ts` ของ demo ก่อน 1 ต.ค. 2569:** คัดลอกใหม่ — ตัวเก่า log URL ของ callback ที่มี token
- **ตัวตรวจ token:** เพิ่มขั้น 9–10 · `core_user_id` ที่เคยตั้งเป็น UUID ต้องเขียน migration เป็น text · เลิกเก็บชื่อ/อีเมล (เก็บ `person_code`)
- **conformance:** ย้ายบัญชีออกจาก `subsystem.yaml` ไปไฟล์นอก repo · ใช้ `denied_role` ที่มีบัญชีรหัสผ่าน (เช่น `guest`) · DevOps ตั้ง secret ถ้าใช้ nightly

---

## 1.6.1 — 2026-09-30

- **`docs/reference-data.md` ตรงกับ Core Hub ที่รันจริง** (เวอร์ชันเอกสาร 1.2 · PM สั่ง 29 ก.ย.)
  - ทุกชุดข้อมูลเป็น ✅ — endpoint อยู่บน `develop` ของ `csmju-core-hub` แล้ว (เดิมยังเขียนว่า "รอ merge")
  - เพิ่ม filter/endpoint ที่มีจริง: รายวิชา `curriculumCode` · `q` · `GET /courses/:code` · หลักสูตร `GET /curricula/:code` ·
    `GET /academic-terms/current` ตอบ 404 เมื่อยังไม่กำหนด · รายการ `roomType`
  - ข้อมูลบุคคล: `people:read` และ `people:contact:read` เป็นของ `staff` · `lecturer` · `admin` (เดิมเขียนแค่ staff/admin ก่อนมี `lecturer` ใน 1.6.0) ·
    `/people/me` ใช้ได้ทุก role ยกเว้น `guest`
  - เขียนให้ชัด: เรียกจาก backend ด้วย token ของผู้ใช้ (Core Hub ไม่เปิด CORS) · ห้ามสร้างตารางของชุดข้อมูลเหล่านี้ซ้ำ ·
    reference implementation ชี้โฟลเดอร์ `backend/src/core-hub/` ของ demo ซึ่งตอนนี้ใช้ห้องของ Core Hub จริง
- `STANDARDS_ENTRY_REF` เป็น `v1.6.1` ตามขั้นออกเวอร์ชัน

**ใครต้องทำอะไร:** ไม่มี — เอกสารอย่างเดียว ไม่มีกฎหรือสคริปต์เปลี่ยน

---

## 1.6.0 — 2026-09-29

- **core role ใหม่ 2 ค่า** (PM ตัดสิน 29 ก.ย.): `lecturer` (อาจารย์) · `guest` (ผู้เยี่ยมชม) —
  enum เป็น `student` · `alumni` · `staff` · `lecturer` · `guest` · `admin`
  - `staff` หมายถึงบุคลากรที่ไม่ใช่อาจารย์ · Core Hub ให้ `lecturer` กับบุคลากรที่ `staff_type` = `LECTURER` ตอนเข้า MJU SSO ·
    `guest` สร้างโดย admin ของ Core Hub เท่านั้น
  - admin ของระบบย่อยไม่ใช่ core role — เจ้าของในทะเบียน + role mapping หรือสิทธิ์พิเศษรายบุคคล (`authorization.md` ข้อ 2)
  - แก้: `contracts/jwt-contract.json` · `contracts/openapi.yaml` · `auth-contract.md` · `authorization.md` ข้อ 2 ·
    `data-dictionary.md` · `aie-workflow.md` · `ci-compliance-spec.md` (`DD-02`)
- `scripts/check-field-aliases.sh` (`DD-02`) รับ `lecturer` / `guest` · fixture `DD-02-ROLES` + `scripts/self-test.sh`
- `STANDARDS_ENTRY_REF` เป็น `v1.6.0` ตามขั้นออกเวอร์ชัน (ตัวกลางไม่เปลี่ยน — repo ที่ปัก `@v1.5.2` ไม่ต้องย้าย)

**ใครต้องทำอะไร:** ไม่มีกฎที่เข้มขึ้น · ระบบย่อยที่ยังไม่ map role ใหม่ ผู้ใช้ role นั้นได้ `403` ตามเดิม ·
ระบบที่จะรองรับอาจารย์/ผู้เยี่ยมชม: เลื่อน `.standards-version` (1.6.0 · สาย 1.0.x: 1.0.6) แล้วเพิ่ม role ใน mapping ทั้งในโค้ดและในทะเบียน ·
Core Hub ต้องขึ้นเวอร์ชันที่รองรับ role ใหม่ก่อนจึงจะมีผู้ใช้ role นี้

เป็น minor เพราะเพิ่มค่าใน enum โดยไม่มี repo ใดตก

---

## 1.5.2 — 2026-09-29

- **ตัวกลางถูกปักหมุดจริงแล้ว** — `subsystem-compliance.yml` และ `core-hub-compliance.yml` ดึง `csmju2030-standards`
  ด้วย `ref: ${{ github.job_workflow_sha }}` มาตั้งแต่ 1.0.0 แต่ค่านี้**ว่างเสมอ**ใน workflow ที่ถูกเรียก
  checkout ที่ไม่มี ref จึงได้ `main` มาแทนโดยไม่เตือน (ยืนยันจาก log ของ csmju-attendance-checker PR #2 29 ก.ย.) ผลคือ
  - ทุก repo ถูกตรวจด้วยสคริปต์บน `main` ไม่ใช่ tag ที่ `ci.yml` ปักไว้ · กฎใหม่มีผลกับทุกทีมทันทีที่ merge
  - `GH-04` เทียบ `.standards-version` (1.0.0) กับ `VERSION` ของ `main` จึงตก**ทุก PR ของทุกระบบย่อย**
    ตั้งแต่ `main` เลื่อนจาก 1.0.0 (attendance-checker #2 · demo-student-subsystem #5)
  - ใน 1.5.1 การเลือกชุดตรวจตาม `.standards-version` ทำงานถูก แต่ตัวกลาง (`GH-03` · `GH-04` · `run-job.sh`) ยังมาจาก `main`
- แก้: workflow ทั้งสองตัวมี `STANDARDS_ENTRY_REF: v1.5.2` (tag ของไฟล์เอง) แล้วทุก job ดึงจากค่านี้ ·
  `scripts/self-test.sh` ตกถ้าค่านี้ไม่ตรงกับ `VERSION` · ถ้า checkout ตัวไหนไม่ใช้ค่านี้ · หรือยังใช้ `github.job_workflow_sha` ·
  `self-test.yml` รันเมื่อแก้ `VERSION` หรือ `core-hub-compliance.yml` ด้วย
- `org-settings/migrate-ci-entry.sh` — ไม่ยอมย้ายไป tag ที่ยังไม่ปักตัวกลาง (1.5.1 ลงไป) · รันซ้ำได้ (ข้าม repo ที่ย้ายแล้ว ·
  ใช้ PR ย้ายที่เปิดค้างต่อ)
- `docs/standards-versioning.md` ข้อ 2.5 (ใหม่) — ตารางเลือกเวอร์ชันตาม library ที่ต้องใช้ · ข้อ 5.1 เพิ่มขั้นแก้ `STANDARDS_ENTRY_REF` ·
  `ci.yml` pin ด้วย tag เท่านั้น (commit SHA ใช้ไม่ได้แล้ว)

**ใครต้องทำอะไร:** **DevOps** ย้าย repo ด้วย `migrate-ci-entry.sh v1.5.2` (ข้าม 1.5.1) — ทุกระบบย่อยจะหายตก `GH-04`
และถูกตรวจด้วยเวอร์ชันใน `.standards-version` จริง · **ทีม** ที่ใช้ library ใหม่กว่า 1.0.0 (ซึ่งผ่านอยู่เพราะถูกตรวจด้วย `main`)
จะเริ่มตก `ARC-02` หลังย้าย ให้เลื่อนเวอร์ชันตาม `standards-versioning.md` ข้อ 2.5 · **Core Hub** ยังถูกตรวจด้วย `main`
จนกว่าจะเลื่อน pin ใน `ci.yml` เป็น `@v1.5.2`

เป็น patch เพราะแก้บั๊ก ไม่มีกฎของโค้ดที่เข้มขึ้น

---

## 1.5.1 — 2026-09-29

- **ทีมเลื่อนเวอร์ชัน standards เองได้** ([`docs/standards-versioning.md`](docs/standards-versioning.md)) — ก่อนหน้านี้ PR เลื่อนเวอร์ชันต้องแก้ `ci.yml`
  กับ submodule `standards` ซึ่ง `GH-03` ตกทุกกรณี และ CODEOWNERS ให้ DevOps เป็นเจ้าของ จึง merge เองไม่ได้
  (PR เลื่อนเป็น 1.5.0 ของทีม gamification-knowledge ติดข้อนี้ 29 ก.ย.)
  - tag ใน `ci.yml` ปักหมุดแค่ตัวกลาง ชุดตรวจมาจากเวอร์ชันใน `.standards-version` · ทีมแก้ `.standards-version` กับ submodule แล้ว PL approve ก็ merge ได้
  - `scripts/select-standards-version.sh` ใหม่ (`GH-04`) — ทุก job อ่าน `.standards-version` แล้วสลับชุดตรวจไปที่ tag นั้น ·
    ตกเมื่อไม่ใช่ `X.Y.Z` · ไม่มี tag · ต่ำกว่า `MIN_VERSION` · ต่ำกว่าที่ branch ปลายทางใช้ (ห้ามถอย) ·
    อ่านไฟล์ที่ Windows เขียนได้ (CRLF · BOM · UTF-16 จาก PowerShell)
  - `scripts/run-job.sh` + `scripts/lib/jobs.tsv` ใหม่ — รายการเช็คของแต่ละ job ย้ายจาก workflow มาอยู่ในไฟล์นี้ ·
    เช็คที่เวอร์ชันที่เลือกยังไม่มีจะข้าม · `GH-03` และ `GH-04` มาจากตัวกลางเสมอ เลือกเวอร์ชันเก่าเพื่อเลี่ยงไม่ได้
  - `MIN_VERSION` ใหม่ (`1.0.0`) — DevOps ยกเลขบน `main` เมื่อต้องการบังคับเวอร์ชันขั้นต่ำ
  - `scripts/check-ci-untouched.sh` (`GH-03`) — submodule `standards` ไม่อยู่ในรายการห้ามแก้แล้ว ·
    `scripts/check-submodule-pointer.sh` (`GH-04`) — ตรวจว่า submodule ชี้ commit ของ tag เดียวกับ `.standards-version`
  - `templates/ci.yml` ปักที่ `@v1.5.1` · `templates/CODEOWNERS` เอา `/standards` ออก ·
    `subsystem.yaml` ไม่ต้องมี `standards_version` แล้ว (schema ยังรับ)
  - `org-settings/migrate-ci-entry.sh` ใหม่ — ย้าย `ci.yml` และ CODEOWNERS ของ repo เดิมครั้งเดียว (dry run เป็นค่าเริ่มต้น)
- เอกสารเลิกสั่ง `git submodule update --remote standards/` (`README.md` · `github-workflow.md` · `ui-design-system.md` ·
  `ci-compliance-spec.md` · PR template) เพราะเลื่อน submodule ไป `main` ซึ่งไม่ใช่ tag ที่ `.standards-version` ระบุ · ใช้ `--init` แทน
- `scripts/self-test.sh` — ทดสอบการเลือกเวอร์ชัน · ขั้นต่ำ · ห้ามถอย · submodule · ไฟล์จาก Windows · รายการเช็คของ `run-job.sh`

**ใครต้องทำอะไร:** **DevOps** ติด tag แล้วรัน `org-settings/migrate-ci-entry.sh v1.5.1` ย้าย repo เดิมครั้งเดียว
(PR ตก `GH-03` โดยตั้งใจ merge แบบ bypass) · **ทีม** หลังย้ายแล้ว ชุดตรวจยังเป็นเวอร์ชันเดิมจนกว่าจะเลื่อนเอง ·
PR เลื่อนเวอร์ชันที่แก้ `ci.yml` เองให้ปิด แล้วเลื่อนใหม่ตาม `standards-versioning.md` ข้อ 2

เป็น patch ตามที่ตกลง เพราะไม่มีกฎของโค้ดที่เข้มขึ้น · กฎ `GH-04` เปลี่ยนความหมาย: เดิมตรวจว่าตรงกับเวอร์ชันที่ปักหมุด ตอนนี้ตรวจว่าเลือกเวอร์ชันที่ใช้ได้

---

## 1.5.0 — 2026-09-28

- **`ARC-04` ใหม่** (`scripts/check-backend-nestjs.sh`) — ระบบย่อยต้องมี backend NestJS ใน `backend/`:
  `@nestjs/core` ใน `dependencies` และ `backend/src/main.ts` เริ่มด้วย `NestFactory` · PM ยืนยัน 28 ก.ย. ว่าคงหลักเดิม
  Next.js ทำหน้าเว็บเท่านั้น (route handler ส่งต่อคำขอไป backend ได้ แต่ข้อมูลและ logic อยู่ที่ backend) ·
  ก่อนหน้านี้ repo ที่ไม่มี `backend/` ผ่าน CI เพราะตัวตรวจฝั่ง backend ทุกตัว (`API-*` `SEC-04/05` `DD-*`) ข้ามเมื่อไม่มีโค้ด ·
  repo ที่เพิ่ง scaffold (ยังไม่มี `package.json` ใน `frontend/` และ `backend/`) ข้าม · ไม่อยู่ในโปรไฟล์ core-hub
  - เพิ่มใน `run-all-checks.sh` และ `subsystem-compliance.yml` (job Security & Stack Scan) · `ci-compliance-spec.md` ข้อ 7.1 ·
    `tech-stack.md` ข้อ 1.3 · `repo-structure.md` · fixture `ARC-04` · `ARC-04-NOTNEST` · `ARC-04-SCAFFOLD`
- `scripts/check-authorized-deps.sh` (`ARC-02`) · `scripts/check-qa.sh` (`QA-06`) — รองรับ `jq.exe` บน Windows (Git Bash)
  ซึ่งจบทุกบรรทัดด้วย CR: `"true\r"` ไม่เคยเท่ากับ `"true"` จึงตกหลอก**ทุก** dependency แม้แต่ `next` `react` `@nestjs/common`
  (ทีม lost-and-found รายงาน 28 ก.ย.) · ครอบ `jq` ให้ตัด `\r` ออกและคงรหัสจบของ jq ไว้ · CI บน Linux ไม่เปลี่ยน
- `scripts/self-test.sh` — ชุดทดสอบ jq จำลองที่ตอบแบบ CRLF: fixture pass ของ `ARC-02` / `QA-06` ต้องยังผ่าน และ fail ต้องยังตก

**ใครต้องทำอะไร:** **เข้มขึ้น 1 ข้อ** — ระบบย่อยที่มีแต่ Next.js ไม่มี backend NestJS จะตก `ARC-04` เมื่อเลื่อนเป็น 1.5.0 (สาย 1.0.x: 1.0.5) ·
ระบบที่ไม่มีข้อมูลของตัวเองแต่ต้อง login ใช้ backend บาง ๆ ตามโครงของ demo (auth · common · health) ·
AIE ที่รันตัวตรวจบน Windows ได้ `ARC-02` ตรงกับ CI แล้ว

เป็น minor เพราะมีกฎที่เข้มขึ้น (`ARC-04`) · ไม่มี tag 1.4.1 บน `main` — การแก้ jq รวมอยู่ในรุ่นนี้

---

## 1.4.0 — 2026-09-28

- `scripts/check-ui-tokens.sh` (`UI-01`) และ `scripts/check-authorized-deps.sh` (`ARC-02`) **อ่าน `.compliance-exceptions.yml`**
  ตาม `ci-compliance-spec.md` ข้อ 11.1 แล้ว — ก่อนหน้านี้กระบวนการยกเว้นมีแค่ในเอกสาร ต่อให้ DevOps อนุมัติ CI ก็ยังตก
  - `UI-01`: `scope` เป็นไฟล์ หรือโฟลเดอร์ที่ลงท้ายด้วย `/` · ไฟล์อื่นตรวจตามปกติ
  - `ARC-02`: ต้องระบุ `package.json` + `dependency` · ไม่ยกเว้น `ARC-03`
  - exception ที่ไม่มี `issue` / `scope: "*"` / หมดอายุ ไม่มีผล · exception ที่มีผลขึ้น warning ทุกครั้ง
  - ตัวอ่านอยู่ที่ `scripts/lib/exceptions.sh` (bash ล้วน รันบน bash 3.2 ได้)
- `docs/tech-stack.md` ข้อ 1.1 — pnpm เลขเดียวทั้งโครงการ: **`12.3.4`** ตรงกับ Core Hub และ demo · `new-subsystem.sh` เคยใส่ `9.15.9` ลง `packageManager` ของ repo ใหม่
- fixture `UI-01-EXC` · `UI-01-EXC-EXPIRED` · `ARC-02-EXC` + `scripts/self-test.sh`

**ใครต้องทำอะไร:** ไม่มีกฎที่เข้มขึ้น · ระบบย่อยที่ได้รับอนุมัติข้อยกเว้น (เช่น ภาพของเกม · แพ็กเกจที่ใช้ร่วมกันในรีโปเดียวกัน)
ให้ DevOps/PM เพิ่มรายการใน `.compliance-exceptions.yml` ของ repo นั้น (มี `issue` และ `expires` เสมอ) แล้วเลื่อน pin เป็น 1.4.0 (สาย 1.0.x ใช้ 1.0.3) ·
repo ที่ยังใช้ pnpm รุ่นอื่นให้ตั้ง `packageManager` เป็น `pnpm@12.3.4` แล้วรัน `pnpm install` ใหม่หนึ่งครั้ง

เป็น minor เพราะ CI ทำได้มากขึ้น (อ่านข้อยกเว้น) โดยไม่มี repo ใดตกเพิ่ม

---

## 1.3.0 — 2026-09-28

- `scripts/check-authorized-deps.sh` (`ARC-02`) — แก้ `dev_tooling_patterns` ที่ตรงกับ**ทุก** devDependency
  ใน `select($d | test(.))` ตัว `.` คือชื่อ package เอง ชื่อจึงถูกใช้เป็น regex ของตัวมันเองและตรงเสมอ
  pattern `^@types/` ไม่เคยถูกใช้จริง · ผลคือ devDependency ใดก็ผ่าน รวมถึงไลบรารีนอก whitelist
  (เช่น `react-leaflet`) ที่ย้ายไปไว้ใน `devDependencies` ทั้งที่ Next ยัง bundle ขึ้น production ·
  เป็นมาตั้งแต่ 1.0.0 · แก้เป็น `.[] as $p | select($d | test($p))`
- `scripts/lib/allowed-deps.json` — เพิ่ม 7 ตัวใน `allowed_dev_tooling` ที่ผ่านมาได้เพราะบั๊กข้างบน
  และเป็นเครื่องมือจาก scaffold มาตรฐานของ Next/Nest ไม่ใช่การเลือกสถาปัตยกรรม:
  `eslint-config-next` · `@eslint/eslintrc` · `eslint-config-prettier` ·
  `eslint-plugin-prettier` · `globals` · `source-map-support` · `ts-loader`
  (`@tailwindcss/postcss` อยู่ในรายการแล้วตั้งแต่ 1.2.1)
- `docs/tech-stack.md` ข้อ 1.4 — อธิบายการตรวจ `devDependencies`
- fixture `__fixtures__/ARC-02-DEV-UNLISTED` + `scripts/self-test.sh` — pass: tooling ของ Next 16 +
  Tailwind v4 และ Nest 11 · fail: `react-leaflet` ใน `devDependencies` (สคริปต์เดิมปล่อยผ่าน)

เป็น minor เพราะ `ARC-02` เข้มขึ้นกับ `devDependencies` · แต่การปิดช่องของบั๊กไม่ทำให้ repo ใดตกเพิ่ม
(ตรวจ Core Hub และทุก branch ของระบบย่อยใน org ที่มี `package.json` ณ 28 ก.ย. — ผลเหมือนเดิมทุกตัว)

**ใครต้องทำอะไร:** ระบบย่อยที่มีแพ็กเกจนอก whitelist อยู่ใน `devDependencies` จะตกที่ `ARC-02` เมื่อเลื่อนเป็น 1.3.0 —
ต้องเปิด issue ขอเพิ่มเข้า whitelist หรือเอาออก · Core Hub เลื่อน pin ใน `ci.yml` เป็น `@v1.3.0`

---

## 1.2.1 — 2026-09-28

- `scripts/lib/allowed-deps.json` — อนุญาต frontend เพิ่ม 4 ตัว (PM อนุมัติ 28 ก.ย. ตามคำขอของทีมระบบย่อย):
  `lucide-react` (ไอคอน · ISC) · `leaflet` (แผนที่ · BSD-2-Clause) · `qrcode.react` (QR · ISC) ·
  `@tailwindcss/postcss` (Tailwind v4 · MIT — อยู่ทั้ง `allowed_frontend` และ `allowed_dev_tooling` แบบเดียวกับ `tailwindcss`)
- **`react-leaflet` ไม่อนุญาต** — ใช้ license Hippocratic-2.1 ซึ่งไม่ผ่าน OSI · ให้เรียก `leaflet` ตรง ๆ
  (ตัวอย่าง client component ใน `docs/tech-stack.md` ข้อ 1.4.2)
- `docs/tech-stack.md` ข้อ 1.2 และ 1.4.2 (ใหม่) · `ci-compliance-spec.md` ข้อ 7.3 — อัปเดตให้ตรงกับ whitelist
  พร้อมข้อกำหนดแผนที่ (แสดง attribution ของ OpenStreetMap · เพิ่มโดเมน tile ใน CSP) และ QR (ใส่ได้เฉพาะข้อมูลสาธารณะ)
- `docs/ui-design-system.md` ข้อ 14 — ระบบย่อยใช้ `lucide-react` แทนชุดไอคอนกลาง `icons.tsx` ได้ทั้งระบบ แต่ห้ามผสมสองชุด
- fixture `__fixtures__/ARC-02-MAP` + `scripts/self-test.sh` — 4 ตัวใหม่ผ่าน · `react-leaflet` ถูกตีตก

whitelist ชุดเดียวกันออกให้สาย 1.0.x เป็น **1.0.2** ด้วย (ดูหัวข้อ 1.0.2 ด้านล่าง)

**ใครต้องทำอะไร:** ไม่มีกฎที่เข้มขึ้น · ระบบย่อยที่ผูก 1.1.0 ขึ้นไปและจะใช้แพ็กเกจเหล่านี้ให้ขอ PL เลื่อนเป็น 1.2.1
(pin ใน `ci.yml` · submodule `standards` · `.standards-version` · `standards_version` ใน `subsystem.yaml`) ·
ระบบย่อยที่ทดสอบกับ Core Hub `main` ใช้ 1.0.2 · ระบบย่อยอื่นไม่ต้องทำอะไร

---

## 1.2.0 — 2026-09-27

- `scripts/lib/allowed-deps.json` — เพิ่ม `sharp` ใน `allowed_core_hub` สำหรับบริการเก็บรูปกลางของ Core Hub
  (ตรวจ ย่อ และแปลงรูปเป็น WebP) · เพิ่มเฉพาะ profile `core-hub` ระบบย่อยยังใช้ไม่ได้ ต้องเก็บรูปผ่าน Core Hub
- `docs/core-hub-rules.md` §6 (ใหม่) — `GET /api/v1/images/:id/file` ส่งไฟล์ดิบไม่ห่อ envelope และไม่ต้องมี JWT
  เพราะ `<img>` แนบ token ไม่ได้ พร้อมเงื่อนไขที่ต้องคงไว้ · หัวข้อเดิม §6–§8 เลื่อนเป็น §7–§9
- `docs/core-hub-rules.md` §6 — เงื่อนไขเรื่อง cache: `max-age` (และ `s-maxage`) ไม่เกิน 1 วัน และห้าม `immutable`
  เบราว์เซอร์และ proxy ไม่ถาม server อีกจนกว่า cache หมดอายุ ถ้า cache นานกว่านี้ รูปที่ลบแล้วจะยังแสดงอยู่
  และข้อ "ลบแล้วต้องตอบ `404` ทันที" ก็ไม่มีผลจริง
- fixture `__fixtures__/PROFILE-CORE-HUB-SHARP` + assertion ใน `scripts/self-test.sh` ยืนยันว่า `sharp`
  ผ่านเฉพาะ profile `core-hub` และยังถูกตีตกใน profile `subsystem`

เป็น minor เพราะเป็นการ**เพิ่ม**ข้อยกเว้น (§8 ของ `core-hub-rules.md`)

**ใครต้องทำอะไร:** ระบบย่อยไม่ต้องทำอะไร · Core Hub เลื่อน pin ใน `ci.yml` เป็น `@v1.2.0` ·
branch `feature/core-hub/image-storage` ต้องแก้ `Cache-Control` ให้ตรง §6 ก่อน merge

---

## 1.1.1 — 2026-09-27

- `scripts/check-api-conventions.sh` (`API-02`..`API-07`) และ `scripts/check-no-jwt-verify.sh` (`SEC-04`/`SEC-05`) —
  หาไฟล์ `.ts` ตัวแรกด้วย `find … -print -quit` แทน `find … | head -1`
  ภายใต้ `set -o pipefail` ถ้า `head` ปิดท่อก่อน `find` เขียนเสร็จ `find` จะโดน SIGPIPE (exit 141)
  แล้ว `set -e` ทำให้สคริปต์จบเงียบ ๆ โดยไม่พิมพ์ว่าตกเพราะอะไร · เจอจริงบน CI ของ Core Hub
  (PR `feature/core-hub/rate-limit` ตกที่ "API Contract" หลังรายชื่อไฟล์ใน `backend/src` ยาวเกิน buffer ของ Linux ราว 7 KB)
  ผลเป็นแบบสุ่ม ผ่านบ้างตกบ้าง และบน Mac แทบไม่เจอ ระบบย่อยทุกตัวจะเจอเมื่อโค้ดโตขึ้น
- `self-test.sh` เพิ่ม 2 กรณีที่สร้าง backend 1,800 ไฟล์ตอนรัน ให้รายชื่อยาวเกินความจุของท่อ — สคริปต์เดิมตก exit 141 ทุกครั้ง

**ใครต้องทำอะไร:** ไม่มีกฎเปลี่ยน · repo ที่ CI ตกที่ "API Contract" หรือ "Security & Stack Scan" โดยไม่มีข้อความ ❌
(log จบที่ `exit code 141`) ให้เลื่อน pin ใน `ci.yml` และ `.standards-version` เป็น 1.1.1 · ระหว่างรอ กด Re-run failed jobs ได้

---

## 1.1.0 — 2026-09-27

Central SSO ที่ใช้ได้จริงจากเบราว์เซอร์ · Silent re-SSO · error code 9 ค่า — ตาม `SSO_FIX_HANDOFF.md` ข้อ 7
และกติกา branch `develop` เป็นที่รวมงานก่อนขึ้น `main` — `docs/github-workflow.md` ข้อ 1.5

**ทำไม:** ใน 1.0 ระบบย่อยส่งเบราว์เซอร์ไป `sso/authorize` ของ **API** ซึ่งต้องมี Bearer ที่เบราว์เซอร์แนบไม่ได้
จึงได้ 401 เสมอ · callback ที่ Core Hub เริ่มเองกัน login CSRF ไม่ได้ · token อายุ 15 นาทีทำให้ผู้ใช้หลุดบ่อย
จนมีระบบย่อยไปทำ session ของตัวเอง (ขัดข้อ 5.1 และทำให้ถอนสิทธิ์ช้าถึง 8 ชั่วโมง) ·
และระบบที่ต้องตอบ 429/503 ไม่มี error code ให้ใช้

### สัญญา

- `docs/auth-contract.md` ข้อ 5 เขียนใหม่ — **ทุก sign-in เริ่มที่ `GET /auth/login` ของระบบย่อย**
  ซึ่งสร้าง `state` แล้วส่งไป**เว็บ**ของ Core Hub `/sso/authorize` · flow จาก sidebar · endpoint ทั้งสองฝั่ง
- ข้อ 5.1 — callback 3 แบบ: ไม่มี state → ทิ้ง token แล้ว `302 /auth/login` · state ไม่ตรง → `401` ไม่ redirect ·
  ผ่าน → คุกกี้ session แล้วไปหน้า `next` · ไม่สำเร็จต้องไม่มีคุกกี้ session · `no-store` · `no-referrer` ·
  ห้าม log URL เต็มของ callback
- ข้อ 5.2 (ใหม่) — state ≥ 32 ไบต์ base64url · คุกกี้ `<ชื่อ>_sso_state` `Path=/auth/callback` ไม่เกิน 600 วินาที ·
  กฎของ `next` 5 ข้อ ตรวจซ้ำตอนใช้
- ข้อ 6 — คุกกี้ session ชื่อ `<ชื่อ>_access_token` (เดิม `core_hub_access_token` ที่ชนกันบน localhost)
- ข้อ 7 — Silent re-SSO: API ตอบ 401 JSON · frontend navigate ทั้งหน้าไป `/auth/login?next=` ·
  ห้าม redirect ทับฟอร์ม · กันวน 30 วินาที · logout หมายถึงออกทั้งระบบ
- ข้อ 9 — `/auth/login` และ `/auth/logout` เป็นข้อยกเว้นที่ต้องมี (redirect เท่านั้น ไม่มีฟอร์ม)
- ข้อ 11 — 1.1 ส่งมอบแล้ว · `aud` แยกตามระบบย่อยย้ายไปเวอร์ชันถัดไป
- `contracts/error-codes.json` — เพิ่ม `TOO_MANY_REQUESTS` (429) และ `SERVICE_UNAVAILABLE` (503)
  ทั้งคู่ต้องมี `Retry-After` · 503 ใช้เมื่อสิ่งที่พึ่งพาไม่พร้อมชั่วคราว ห้ามใช้แทน 500 ของบั๊ก
  (`docs/api-conventions.md` ข้อ 4 · endpoint นอก `/api/v1` เป็น 4 path)
- `contracts/jwt-contract.json` ก้อน `sso` (path ทั้งหมด · suffix ของคุกกี้ · `stateTtlMaxSec`)
- `contracts/openapi.yaml` — `/auth/login` · `/auth/logout` · callback ตอบ 302/400/401/403 ·
  `session.expiresAt` ใน `/api/v1/me` · error enum 9 ค่า
- `contracts/log-events.json` — reason `sso_restart_without_state` `sso_state_missing` `sso_state_mismatch` ·
  เพิ่ม URL เต็มของ callback และ header `Cookie` ทั้งก้อนเข้า `mustNeverLog`
- `schemas/subsystem.schema.json` — `core_hub_web_url` (ไม่บังคับ แต่ L3-16 ต้องใช้)

### ตัวตรวจ

- `API-04` (`scripts/check-api-conventions.sh`) — อ่านรายการจาก `contracts/error-codes.json` แทนการเขียนไว้ในสคริปต์ ·
  ตรวจค่าที่ประกาศใน `ErrorCode` (object · enum · type) ด้วย ไม่ใช่แค่รูป `code: '…'` ·
  ถ้าไม่มี node จะอ่านรายการด้วย grep และข้ามเฉพาะส่วน `ErrorCode` · fixture ใหม่ `__fixtures__/API-04`
- `API-04` **เลิกตรวจไฟล์ทดสอบ** (`*.spec.ts` · `test/`) — ค่า `code:` ในไฟล์ทดสอบเป็นข้อมูลตัวอย่าง
  เช่น `code: 'SCI'` ของ reference data ไม่ใช่ error contract (เดิมตีตก false positive จนระบบที่ทำถูกต้อง
  merge ไม่ได้) · fixture pass เพิ่ม `rooms.service.spec.ts` เป็น regression
- ตัวสแกน `ErrorCode` ย้ายไปเป็นไฟล์ `scripts/lib/api04-errorcode-scan.js` — heredoc ที่ซ้อนใน
  command substitution ทำให้ **bash 3.2 ของ macOS parse ทั้งสคริปต์ไม่ผ่าน** ทีมที่ใช้ Mac
  จะรันตัวตรวจในเครื่องไม่ได้เลย (CI บน Linux ไม่เจอ)

### conformance

- L3 เริ่มที่ `/auth/login` แล้วเล่นบทเว็บของ Core Hub · ข้อใหม่ **L3-16 – L3-22**
  (login → เว็บ Core Hub · คุกกี้ state · callback ไม่มี state · state ไม่มีคุกกี้ · state สลับกัน ·
  `next=//evil` · logout) · รวม **62 → 69 ข้อ** · รายละเอียดใน `docs/conformance.md`
- อ่าน `Set-Cookie` ทุกตัวแล้วหาตามชื่อ (callback ตั้ง 2 คุกกี้) · รับ `--core-hub-web`
- เจอ `429` ที่ `Retry-After` ≤ 5 วินาที รอแล้วลองใหม่ 1 ครั้ง · บรรทัดสรุปแสดง `retries: N`
- สถานะ `WARN` ที่ไม่ทำให้ตก · error code นอก `error-codes.json` เป็น WARN (เวอร์ชันถัดไปเป็น FAIL)
- ตัวอ่าน `subsystem.yaml` รับ CRLF — เดิมบน Windows ที่ `core.autocrlf=true` คอมเมนต์บรรทัดแรกทำให้ runner หยุดทันที
- ผลกับ reference implementation (demo-student-subsystem `feature/student-service/silent-sso`):
  `RESULT: 69 passed · 0 failed · 0 skipped · 0 warnings · retries: 0` ด้วยค่า rate limit แบบ default ·
  ส่วน demo `main` (มาตรฐาน 1.0) ตก 9 ข้อที่ L3 ชุดใหม่ ตามที่ควรเป็น

### เอกสารอื่น

- `docs/reference-data.md` (ใหม่) — สารบัญชุดข้อมูลอ้างอิงกลาง + สัญญากลางโดยย่อ + เส้นแบ่งชัดว่า
  ข้อมูลบุคคล (`/api/v1/people`) ไม่ใช่ reference data ห้าม cache (หน้าที่ค้างจาก `SHARED_DATA_HANDOFF` ข้อ 7.1)
- `docs/LOCAL_INTEGRATION_GUIDE.md` — แทนฉบับเก่าด้วยร่างล่าสุดของ PL (25 ก.ย.) จะตามแก้ส่วน SSO
  เมื่องานฝั่ง demo ส่งมอบ

- `ai/AGENTS.md` เพิ่ม 4 ข้อใน "สิ่งที่ agent มักทำผิด" · `docs/subsystem-registry.md` หมายเหตุเรื่อง `callback_url` ·
  `templates/subsystem.yaml` · `docs/repo-structure.md` · ข้อความที่ยังเขียนว่า "7 ค่า"

### branch `develop`

- `docs/github-workflow.md` ข้อ 1.5 (ใหม่) — repo ที่มีหลายคนทำพร้อมกันหรือมี dev server ใช้ branch หลัก 2 ตัว
  คือ `develop` รวมงานแล้วทดสอบบน dev server และ `main` เป็น production · Core Hub ต้องใช้ · ระบบย่อยเลือกใช้ได้ ·
  repo มาตรฐานไม่ใช้เพราะ tag ทำหน้าที่เป็น release อยู่แล้ว
  feature PR เข้า `develop` แบบ squash · PR `develop` → `main` และ `main` → `develop` ใช้ merge commit
  เพราะถ้า squash แล้ว `main` กับ `develop` จะแยกประวัติกัน · ข้อ 1.1, 1.2, 1.4, 3 และ system prompt ข้อ 5 ปรับให้ตรงกัน
- `GH-01` (`scripts/check-branch-name.sh`) — ยอมรับ PR `develop` → `main` และ `main` → `develop`
  โดยดู base จาก `GITHUB_BASE_REF` (หรือ argument ที่ 3) ส่วนชื่ออื่นยังต้องเป็น `feature/<subsystem>/<เรื่อง>`
  และการตรวจในเครื่องที่ไม่มี base ยังให้ `develop` กับ `main` ไม่ผ่านเหมือนเดิม · `self-test.sh` เพิ่ม 6 กรณี
- `templates/ci.yml` · ตัวอย่างใน `ci-compliance-spec.md` ข้อ 6.2 และ `core-hub-rules.md` ข้อ 6 — รัน CI กับ PR ที่เข้า `develop` ด้วย
  (repo ที่ไม่มี `develop` ไม่มีผลอะไร)
- `ci-compliance-spec.md` ข้อ 4.1–4.2 และ `org-settings/` — เลิกบังคับ linear history บน `main` ของระบบย่อย เพราะ PR release ต้องเป็น merge commit
  ส่วน feature PR ยังเป็น squash โดยคุมที่ merge method ของ repo · repo ที่ใช้ `develop` ต้องเปิด merge commit
  และตั้ง `develop` เป็น default branch ก่อน merge PR release ครั้งแรก (ไม่งั้น "Automatically delete head branches" จะลบ `develop`)
  · ruleset ชื่อ branch ยกเว้น `refs/heads/develop` เพิ่มจาก `refs/heads/main` · `apply-rulesets.sh` ยอมรับ default branch เป็น `develop`

### ที่ค้างจาก `main` และออกพร้อมเวอร์ชันนี้

- `scripts/check-ui-tokens.sh` (`UI-01`..`UI-04`) — สแกนทั้ง `frontend/` แทน `frontend/src`
  เดิมถ้า Next.js วาง `app/` ไว้ที่ราก `frontend/` สคริปต์จะไม่เจอไฟล์ไหนเลยแล้วผ่านเฉย ๆ
  (fixture ใหม่ `__fixtures__/UI-01-NOSRC`) · ยกเว้นไฟล์ token กลาง `globals.css` และ `csmju/`
  จาก template ซึ่งประกาศสีเป็น hex โดยตั้งใจ — เดิม `globals.css` ใต้ `src/` ทำให้ `UI-01` ตกเอง
- ข้อความ `UI-01` และ `SEC-03` ชี้ไป `ui-design-system.md` แทน `ui-prompt-template.md`
  ที่ถูกรวมเข้าไปแล้ว (เช่นเดียวกับตารางกฎใน `ci-compliance-spec.md` ข้อ 7)
- ชื่อ token: เลิกใช้ `--csmju-*` ใน `aie-workflow.md`, `ci-compliance-spec.md`,
  `templates/pull_request_template.md` ให้ตรงกับ `ui-design-system.md` ข้อ 3
  (Tailwind v4 `@theme` เช่น `bg-primary-container`)
- `ui-design-system.md` ข้อ 16.1 — ใช้ `frontend/` + `backend/` ตาม `repo-structure.md`
  (เดิมเขียน `web/` + `api/`) · ข้อ 17.0 — ระบุว่า template `csmju-subsystem-web` อยู่ใน repo
  `csmju-core-hub` และให้ copy ลง `frontend/` ด้วย `pnpm` แทนการแยก repo `-web` ด้วย `npm`

### ระบบย่อยต้องทำอะไรเมื่อเลื่อนมา 1.1

1. เพิ่ม `GET /auth/login` · แก้ `GET /auth/callback` ตาม auth-contract ข้อ 5.1 · เพิ่ม `POST /auth/logout`
   (คัดลอกจาก demo-student-subsystem ได้) · ถ้ามี session ของตัวเองให้เลิกใช้
2. เปลี่ยนชื่อคุกกี้เป็น `<ชื่อ>_access_token` (และคุกกี้ state `<ชื่อ>_sso_state`)
3. เพิ่ม `CORE_HUB_WEB_URL` ใน `.env` และ `core_hub_web_url` ใน `subsystem.yaml` ·
   เพิ่ม `/auth/login` `/auth/logout` ใน `public_endpoints`
4. frontend: ใช้ตัวจับ 401 และ re-SSO จาก template (`SSO_FIX_HANDOFF.md` ข้อ 8)
5. ถ้าตอบ 429 หรือ 503 ให้ใช้ code ใหม่พร้อม `Retry-After`
6. ขอ PL เลื่อน submodule · pin ใน `ci.yml` · `.standards-version` · `standards_version` เป็น `1.1.0`
7. `UI-01`..`UI-04` ตรวจทั้ง `frontend/` แล้ว ถ้ามีสี hex นอก `globals.css` และ `csmju/` จะตก ต้องเปลี่ยนเป็น token ก่อนเลื่อน
   (Core Hub ยกเว้น `UI-01`..`UI-04` อยู่แล้ว)
8. ถ้าจะใช้ `develop` ให้ทำ "ตั้งค่าครั้งแรก" ใน github-workflow.md ข้อ 1.5 · Core Hub ต้องเลื่อนเป็น 1.1.0 ก่อนเปิด PR release ครั้งแรก
   ไม่งั้น `GH-01` ของ 1.0.x จะตีตก PR `develop` → `main`
9. repo ที่มี ruleset อยู่แล้วจะยังใช้ชุดเดิม เพราะ sweep สร้างเฉพาะตัวที่ขาดและไม่ทับของเดิม (org-settings-checklist.md)
   DevOps ต้องรัน `org-settings/apply-rulesets.sh repo <ชื่อ repo>` ให้แต่ละ repo ที่จะใช้ `develop`

Core Hub ยังรับระบบย่อย 1.0 อยู่ (กดจาก sidebar แล้วเข้าได้เหมือนเดิม) แต่ละทีมจึงเลื่อนตามจังหวะของตัวเองได้

---

## 1.0.5 — 2026-09-28

ออกจาก tag `v1.0.4` โดยตรง — `ARC-04` (ต้องมี backend NestJS) แบบเดียวกับ 1.5.0 · รายละเอียดใน `CHANGELOG.md` ของ tag `v1.0.5`

---

## 1.0.4 — 2026-09-28

ออกจาก tag `v1.0.3` โดยตรง — `jq.exe` บน Windows แบบเดียวกับ 1.4.1 · รายละเอียดใน `CHANGELOG.md` ของ tag `v1.0.4`

---

## 1.0.3 — 2026-09-28

ออกจาก tag `v1.0.2` โดยตรง (commit ไม่อยู่บน `main`) — `UI-01` / `ARC-02` อ่าน `.compliance-exceptions.yml`
และ pnpm `12.3.4` ใน `tech-stack.md` เหมือน 1.4.0 · รายละเอียดเต็มอยู่ใน `CHANGELOG.md` ของ tag `v1.0.3`

---

## 1.0.2 — 2026-09-28

ออกจาก tag `v1.0.1` โดยตรง (commit ไม่อยู่บน `main`) สำหรับระบบย่อยที่ทดสอบกับ Core Hub `main` ซึ่งยังเป็น SSO 1.0

- whitelist 4 ตัวชุดเดียวกับ 1.2.1 · `react-leaflet` ไม่อนุญาต
- `UI-01`..`UI-04` ใช้ตัว scan ของ 1.1.0 (ตรวจทั้ง `frontend/` · ยกเว้น `globals.css` และ `csmju/`) เพื่อให้ย้ายไป Tailwind v4 ได้
- การแก้ SIGPIPE ของ 1.1.1 ใน `check-api-conventions.sh` · `check-no-jwt-verify.sh`

รายละเอียดเต็มอยู่ใน `CHANGELOG.md` ของ tag `v1.0.2`

---

## 1.0.1 — 2026-09-26

- `scripts/lib/allowed-deps.json` — เพิ่ม `@nestjs/schedule` ใน `allowed_backend` สำหรับงานตั้งเวลา (scheduled job)
  มาจากคำขอของทีม CampusShare ที่มีงานตั้งเวลา 3 งาน (ยกเลิกคำขอยืมที่เจ้าของไม่ตอบ · ติดธงคำขอที่เกินกำหนดคืน ·
  เก็บ listing ที่ไม่มีความเคลื่อนไหวเกิน 180 วัน) เลือกเพิ่มเข้า whitelist แทนการทำ exception รายทีม
  เพราะเป็นแพ็กเกจทางการของ NestJS และระบบย่อยอื่นน่าจะต้องใช้งานแบบเดียวกัน
- `docs/tech-stack.md` ข้อ 1.4.1 (ใหม่) — กติกาของงานตั้งเวลา 3 ข้อ: รันซ้ำได้โดยไม่เสียหาย · ระบุ time zone ·
  ถ้ารันหลาย instance ให้ใช้ advisory lock ของ PostgreSQL
- fixture `__fixtures__/ARC-02-03/pass` ใช้ `@nestjs/schedule` เพื่อพิสูจน์ว่า `ARC-02` ยอมรับ

ออกจาก tag `v1.0.0` โดยตรง จึง**ไม่รวม**งานที่ค้างอยู่บน `main` หลัง 1.0.0 (เช่น `UI-01`..`UI-04` ที่ตรวจทั้ง `frontend/`)
งานเหล่านั้นจะออกในเวอร์ชันถัดไป

**ระบบย่อยต้องทำอะไร:** ถ้าต้องใช้ `@nestjs/schedule` ให้ขอ PL เลื่อนเป็น 1.0.1 ได้แก่ pin ใน `ci.yml` · submodule `standards` ·
`.standards-version` · `standards_version` ใน `subsystem.yaml` · ระบบย่อยอื่นไม่ต้องทำอะไร

---

## Errata ของ 1.0.0 — 2026-09-23

แก้เอกสารเท่านั้น ไม่มีการเปลี่ยนกฎหรือสคริปต์ตรวจ จึงไม่ขึ้นเวอร์ชัน
(`VERSION` ยังเป็น `1.0.0` ระบบย่อยไม่ต้องเลื่อน `.standards-version`)

- `tech-stack.md` ข้อ 1.2.1 (ใหม่) — `typecheck` ของ frontend ต้องเป็น
  `next typegen && tsc --noEmit` ไม่ใช่ `tsc --noEmit` เฉย ๆ
  Next.js สร้าง type ของ route/layout (`LayoutProps`, `PageProps`) ตอน dev/build
  เท่านั้น สคริปต์แบบเดิมจึงผ่านในเครื่อง (มี `.next/` ค้าง) แต่ตกบน CI ที่ checkout
  ใหม่ด้วย `TS2304: Cannot find name 'LayoutProps'` — เจอจริงตอนทำ frontend ของ Core Hub
- `tech-stack.md` ข้อ 1.2 — ระบุ Next.js เป็น `15.5+` เพราะ `next typegen` เพิ่งมีในเวอร์ชันนั้น
- `ai/AGENTS.md` — เพิ่มลงตาราง "สิ่งที่ agent มักทำผิด" และเพิ่มคำสั่ง
  `rm -rf frontend/.next && pnpm -r typecheck` ในชุดคำสั่งที่ต้องรันก่อนส่งงาน

---

## 1.0.0 — 2026-09-11

**เวอร์ชันแรกที่ประกาศใช้จริง** — เริ่มนับใหม่ที่ 1.0.0

> เวอร์ชัน 1.0.0–1.3.0 ก่อนหน้านี้เป็นช่วงเตรียมการ ยังไม่เคยส่งมอบให้ทีม AIE ทีมใดใช้งาน
> และยังไม่มีระบบย่อยใดผูกอยู่ จึงยกเลิกประวัติเดิมทั้งหมดแล้วเริ่มนับใหม่
> ไม่ถือเป็น breaking change เพราะไม่มีผู้ใช้เดิม

### ที่มาของเนื้อหา

มาตรฐานฉบับนี้เขียนจาก **ระบบที่ทำงานได้จริงและผ่านการทดสอบแล้ว** ไม่ใช่จากการออกแบบล่วงหน้า:

| อ้างอิงจาก | สถานะ |
|---|---|
| `csmju-core-hub` | Core Hub จริง — login · RS256 · JWKS · Subsystem Registry · Central SSO (unit 35 เคส) |
| `demo-student-subsystem` | reference implementation — unit 77 · e2e 70 · integration 13 · conformance 62/62 |

ทุกข้อกำหนดในเอกสารนี้มีโค้ดที่ทำได้จริงรองรับ และมีชุดทดสอบที่ยิงระบบจริงเป็นตัวพิสูจน์

### สัญญาการยืนยันตัวตน (`docs/auth-contract.md` — เขียนใหม่ทั้งฉบับ)

- Core Hub ออก JWT **RS256** · `iss=core-hub` · `aud=csmju2030` · `kid=core-hub-2026` · อายุ 15 นาที
- เผยแพร่กุญแจสาธารณะที่ `/api/v1/.well-known/jwks.json` แบบ **RFC 7517 ดิบ**
- **ระบบย่อยเป็นผู้ตรวจ JWT เอง** ผ่าน JWKS (8 ขั้น) — ยังไม่มี API Gateway ในสถาปัตยกรรมปัจจุบัน
- Central SSO: `GET /api/v1/auth/sso/authorize` → 302 ไปยัง `callback_url` ที่ลงทะเบียนไว้เท่านั้น
- ระบบย่อยรับที่ `GET /auth/callback` แล้วตั้งคุกกี้ HttpOnly ของตัวเอง

### สิทธิ์ (`docs/authorization.md` — ใหม่)

- Core Hub ตัดสิน *ใครเข้าระบบไหนได้* (ตรวจ core role กับ `default_role_mapping` ก่อน redirect)
- ระบบย่อยตัดสิน *เข้ามาแล้วทำอะไรได้* ผ่านชั้น permission `resource:action[:own|:any]`
- แยก `401` (ไม่รู้ว่าใคร) กับ `403` (รู้แล้วแต่สิทธิ์ไม่พอ) อย่างเคร่งครัด

### สัญญา API (`docs/api-conventions.md`)

- pagination เป็น `?page=1&limit=20` (จากเดิม `per_page`)
- `VALIDATION_ERROR` คืน **400** (จากเดิม 422) ให้ตรงกับพฤติกรรม `ValidationPipe` ของ NestJS
- field ใน JSON เป็น `camelCase` · ฐานข้อมูลเป็น `snake_case` (แยกชั้นกันชัดเจน)
- เพิ่มกฎ URL: resource เป็นพหูพจน์ `kebab-case` · `POST`→201 · `DELETE`→200 + `{id, deleted:true}`

### ฐานข้อมูล (`docs/data-dictionary.md`)

- ตาราง/คอลัมน์เป็น `snake_case` ผ่าน `@map`/`@@map` · field ใน Prisma เป็น `camelCase`
- ห้ามลบหรือ squash migration · เปลี่ยนชื่อคอลัมน์ต้องใช้ `RENAME COLUMN` ไม่ใช่ drop+add

### Tech stack (`docs/tech-stack.md`)

- ระบุเวอร์ชันที่ใช้จริง: Node 22 · NestJS 11 · TypeScript 5.9 · **Prisma 7.9.1 (pin)** · PostgreSQL 16+
- แก้ whitelist ที่ทำให้ Prisma 7 ใช้ไม่ได้ — เพิ่ม `@prisma/adapter-pg`, `pg`, `jose`, `dotenv`

### เครื่องมือใหม่

- `conformance/` — ชุดทดสอบ **runtime** แบบ black-box ไม่มี dependency (L1 32 · L2 47 · L3 62 เคส)
- `contracts/` — สัญญาที่เครื่องอ่านได้ (JWT · error code · vocabulary · log event · OpenAPI)
- `ai/` — `AGENTS.md`, `TASK_TEMPLATE.md`, `CHECKLIST.md` สำหรับสั่งงาน AI ให้ได้ผลตรงกันข้ามโมเดล

### Profile `core-hub` (`docs/core-hub-rules.md` — ใหม่)

- `csmju-core-hub` ไม่ใช่ระบบย่อย จึงมี workflow แยก `core-hub-compliance.yml` ที่ตั้ง `CSMJU_PROFILE=core-hub`
- ยกเว้นเฉพาะกฎที่ขัดกับหน้าที่ของมันเอง: `SEC-04` `SEC-05` `GH-03` `GH-04` `API-01` `API-06` `UI-01..04`
  · `DD-01` ถูกข้ามในสคริปต์ · `ARC-02` ขยาย whitelist ด้วยคีย์ `allowed_core_hub`
- กฎที่เหลือ 19 ข้อยังบังคับเต็มเหมือนระบบย่อย และมี 3 ข้อที่เข้มกว่า (JWKS ดิบ · สัญญา JWT ห้ามเปลี่ยน · ตรวจ `callback_url`)
- self-test ยืนยันทั้งสองทิศทาง: fixture เดียวกันต้องตกใน profile `subsystem` และผ่านใน `core-hub`
  รวมถึงยืนยันว่าค่าเริ่มต้นคือ `subsystem` และ workflow ของระบบย่อยไม่ส่ง profile นี้ (45 assertions)

### กฎใหม่

- `QA-06` — ชื่อ package ในแต่ละ workspace ต้องไม่ซ้ำ และ `--filter <name>` ใน script ที่รากต้องชี้ไปยัง
  package ที่มีอยู่จริง มิฉะนั้น pnpm จะไม่รันอะไรเลยแต่คืน exit 0 ทำให้ script ที่รากดูเหมือนผ่าน
  (พบจริงใน `demo-student-subsystem` — root กับ backend ตั้งชื่อซ้ำกัน `pnpm test` ที่รากจึงไม่ได้รันเทสต์)

### แก้บั๊กในเครื่องมือตรวจเอง

- `API-02` เคยตีตกชื่อ path parameter แบบ camelCase (`:exceptionId`) ทั้งที่ URL จริงยังเป็น kebab-case
- `pnpm/action-setup` ฮาร์ดโค้ด `version: 9` ซึ่งชนกับ `packageManager` ใน `package.json` ของ repo ที่เรียก
- `node_version` ค่าเริ่มต้นเป็น `20` ทั้งที่ `tech-stack.md` ล็อก Node 22
- `run-all-checks.sh` ใช้ associative array ซึ่ง bash 3.2 (ค่าเริ่มต้นของ macOS) ไม่รองรับ

### กฎ CI ที่แก้ให้ตรงกับสถาปัตยกรรมจริง

| รหัส | เดิม | ใหม่ |
|---|---|---|
| `SEC-04` | ห้ามระบบย่อย verify JWT เอง | **ต้อง** verify ด้วย JWKS + `kid` · ห้าม HS256 / secret / กุญแจฮาร์ดโค้ด |
| `DD-03` | บังคับ `snake_case` กับ field ใน TypeScript | บังคับกับ **ฐานข้อมูล** เท่านั้น (`@map`) · JSON/TS ยังเป็น camelCase |
| `ARC-02` | whitelist ไม่มี dependency ที่ Prisma 7 ต้องใช้ | เพิ่มให้ครบ |
| `API-*` | `per_page` · `VALIDATION_ERROR` = 422 | `limit` · 400 |
