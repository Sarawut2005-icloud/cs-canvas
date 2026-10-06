# ทดสอบเชื่อม 3 ระบบบนเครื่องตัวเอง

**Core Hub · demo-student-subsystem · ระบบย่อยของทีมตัวเอง** — รองรับทั้ง macOS และ Windows

> ⚠️ **เอกสารนี้สำหรับทีม Core Hub เท่านั้น** (คนที่ต้องรัน Core Hub ในเครื่อง)
> **ทีมระบบย่อย (AIE) ห้ามทำตามเอกสารนี้** — ให้เชื่อมกับ Core Hub จริงที่ `https://csmju2030.jowave.com`
> ตาม [`connect-core-hub.md`](connect-core-hub.md) · ห้ามโคลนหรือ seed `csmju-core-hub` เพราะมีข้อมูลนักศึกษาจริง
>
> เขียนไว้ตอน standards v1.0.0 (25 ก.ย. 2569) สิ่งที่เปลี่ยนไปตั้งแต่นั้น:
> demo ปัจจุบันชื่อ `csmju-demo-subsystem` (frontend 3201 · backend 4201 · SSO 1.1) ส่วน seed ของ Core Hub ในเครื่องยังลงทะเบียน
> `student-service` ที่พอร์ต 3001 ตามตัวอย่างด้านล่าง · ลงทะเบียนผ่านหลังบ้านด้วยบัญชี staff/lecturer และ admin อนุมัติ
> ([`subsystem-registry.md`](subsystem-registry.md)) · conformance อ่านบัญชีจากไฟล์นอก repo ([`conformance.md`](conformance.md))
>
> ร่างตัวอย่าง — อ้างอิง `csmju2030-standards` v1.0.0 และ `main` ของทุก repo ณ 25 ก.ย. 2569
> ตัวอย่างทั้งเอกสารใช้ระบบย่อยชื่อ **`equipment`** (repo `csmju-equipment`) ให้เปลี่ยนเป็นชื่อของทีมตัวเอง

---

## อ่านก่อน: วิธีอ่านคำสั่งในเอกสารนี้

ทุกคำสั่งเขียนแบบนี้:

```text
csmju-core-hub/backend >> pnpm start:dev
```

| ส่วน | ความหมาย |
|---|---|
| `csmju-core-hub/backend` | **โฟลเดอร์ที่ต้องอยู่ก่อนรัน** นับจากโฟลเดอร์ `csmju2030/` |
| `>>` | ตัวคั่น — **ไม่ต้องพิมพ์** |
| `pnpm start:dev` | คำสั่งที่พิมพ์จริง |

ถ้าเป็นโฟลเดอร์ `csmju2030/` เองจะเขียนว่า `csmju2030 >>`

### เข้าไปอยู่ในโฟลเดอร์ที่ถูกต้อง

**วิธีที่ง่ายที่สุด (VS Code):** เปิดโฟลเดอร์ `csmju2030` ใน VS Code → **คลิกขวา**ที่โฟลเดอร์ที่ต้องการ →
**Open in Integrated Terminal** จะได้ terminal ที่อยู่ในโฟลเดอร์นั้นทันที

**หรือพิมพ์ `cd` เอง** (ใช้ได้ทั้ง mac และ Windows):

```text
csmju2030 >> cd csmju-core-hub/backend
```

**ไม่แน่ใจว่าอยู่ที่ไหน** — สองคำสั่งนี้ใช้ได้ทุกระบบ:

| คำสั่ง | ได้อะไร |
|---|---|
| `pwd` | บอกว่าตอนนี้อยู่โฟลเดอร์ไหน |
| `pnpm run` | แสดงรายการคำสั่ง pnpm ที่ใช้ได้**ในโฟลเดอร์นี้** — ถ้าไม่เห็นคำสั่งที่จะรัน แปลว่าอยู่ผิดที่ |

ถ้าอยู่ผิดโฟลเดอร์ pnpm จะตอบแบบนี้:

```text
Error: ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL
  × Command "start:dev" not found
```

### ใช้ terminal ตัวไหน

| | macOS | Windows |
|---|---|---|
| ข้อ 1–6.3 และ 6.5 (ติดตั้ง · ตั้งค่า · รันระบบ) | Terminal | **PowerShell หรือ Git Bash ก็ได้** |
| ข้อ 6.1 · 6.4 · 7 (สคริปต์ `.sh` และทดสอบด้วย `curl`) | Terminal | **Git Bash เท่านั้น** 🪟 |

Git Bash มาพร้อม [Git for Windows](https://git-scm.com/download/win) — ใน VS Code เลือกได้ที่ลูกศรข้างปุ่ม `+` ของ terminal → **Git Bash**
ส่วนที่ต้องใช้ Git Bash จะมีป้าย 🪟 กำกับไว้

---

## 0. ภาพรวม — จะได้อะไรเมื่อทำจบ

```text
                     ┌──────────────────────────────┐
  เบราว์เซอร์ ──────▶│ Core Hub frontend    :3100    │
                     │ Core Hub backend     :3000    │── JWKS ──┬──────────────┐
                     └──────────────┬───────────────┘          │              │
                                    │ SSO 302 + token          ▼              ▼
                                    ├──────────────▶ demo-student-subsystem  csmju-equipment
                                    │                backend :3001           backend :3002
                                    │                     │                       │
                     PostgreSQL :5432 ── core_hub    demo_student_db         equipment_db
```

### พอร์ตที่ใช้

| พอร์ต | ระบบ | โฟลเดอร์ที่รัน |
|---|---|---|
| **3000** | Core Hub backend (API · JWKS · SSO) | `csmju-core-hub/backend` |
| **3100** | Core Hub frontend (หน้า login · เมนูระบบย่อย) | `csmju-core-hub/frontend` |
| **3001** | demo-student-subsystem | `demo-student-subsystem/backend` |
| **3002** | ระบบย่อยของทีมตัวเอง | `csmju-equipment/backend` |
| **5432** | PostgreSQL — 3 ฐานข้อมูลแยกกัน | — |

> **3001 ห้ามให้อย่างอื่นใช้** — เป็น `callback_url` ที่ Core Hub ลงทะเบียนให้ demo ไว้ตั้งแต่ seed
> ทีมถัดไปใช้ 3003, 3004, … ตามลำดับ

ต้องเปิด **4 terminal** ค้างไว้พร้อมกัน — หนึ่งตัวต่อหนึ่งพอร์ต (3000 · 3100 · 3001 · 3002)

---

## 1. เตรียมเครื่อง

| ต้องมี | ตรวจด้วย | macOS | Windows |
|---|---|---|---|
| Node.js **22.x** | `node -v` | nodejs.org หรือ `brew install node@22` | nodejs.org (ตัวติดตั้ง .msi) |
| **pnpm** | `pnpm -v` | `corepack enable pnpm` | `corepack enable pnpm` (เปิด PowerShell แบบ Run as Administrator) |
| PostgreSQL **16+** | `psql --version` | `brew install postgresql@16` | ตัวติดตั้งจาก postgresql.org — **จำรหัสผ่านของ user `postgres` ที่ตั้งตอนติดตั้งไว้** |
| git | `git --version` | มากับ Xcode Command Line Tools | Git for Windows (ได้ Git Bash มาด้วย) |
| `gh` (ไม่บังคับ) | `gh auth status` | `brew install gh` | `winget install GitHub.cli` |

> ไม่ต้องมี `openssl` · `rsync` · `python3` · `createdb` — เอกสารนี้ใช้ `node` ทำแทนทั้งหมด จึงได้ผลเหมือนกันทุกระบบ

---

## 2. Clone และจัดโครงสร้างโฟลเดอร์

มาตรฐานกำหนดให้ **ทุก repo อยู่ระดับเดียวกันในโฟลเดอร์เดียว** (`repo-structure.md` ข้อ 1)
สคริปต์หลายตัวอ้าง path แบบ `../csmju2030-standards` ถ้าวางผิดที่จะรันไม่ได้

เลือกที่เก็บงานก่อน (เช่น `Documents`) แล้วสร้างโฟลเดอร์ `csmju2030`:

```text
(ที่เก็บงาน) >> mkdir csmju2030
(ที่เก็บงาน) >> cd csmju2030
```

```text
csmju2030 >> git clone https://github.com/CSMJU2030/csmju2030-standards.git
csmju2030 >> git clone https://github.com/CSMJU2030/csmju-core-hub.git
csmju2030 >> git clone --recurse-submodules https://github.com/CSMJU2030/demo-student-subsystem.git
```

> **`--recurse-submodules` จำเป็นสำหรับ demo** — โฟลเดอร์ `standards/` ข้างในเป็น submodule
> ถ้าลืมจะได้โฟลเดอร์ว่าง แก้ทีหลังได้ด้วย:
>
> ```text
> demo-student-subsystem >> git submodule update --init --recursive
> ```

ผลที่ต้องได้:

```text
csmju2030/
├── csmju2030-standards/
├── csmju-core-hub/
│   ├── backend/          :3000
│   └── frontend/         :3100
├── demo-student-subsystem/
│   ├── backend/          :3001
│   └── standards/        (submodule → v1.0.0)
└── csmju-equipment/      (สร้างในข้อ 6)
```

---

## 3. ฐานข้อมูล — ไม่ต้องสร้างเอง

**หนึ่งระบบ = หนึ่งฐานข้อมูล** ห้ามใช้ร่วมกัน (กฎ `ARC-01`) แต่**ไม่ต้องสั่งสร้างเอง** —
คำสั่ง `pnpm exec prisma migrate deploy` ในข้อ 4–6 จะสร้างฐานข้อมูลให้ถ้ายังไม่มี

สิ่งที่ต้องมีแค่อย่างเดียว คือ **PostgreSQL เปิดอยู่** และรู้ user/รหัสผ่านที่จะใส่ใน `DATABASE_URL`:

| | macOS (Homebrew) | Windows (ตัวติดตั้ง) |
|---|---|---|
| user | ชื่อ user ของเครื่อง (ไม่มีรหัสผ่าน) | `postgres` |
| รหัสผ่าน | — | ที่ตั้งไว้ตอนติดตั้ง |
| ตัวอย่าง `DATABASE_URL` | `postgresql://mac@localhost:5432/core_hub` | `postgresql://postgres:<รหัสผ่าน>@localhost:5432/core_hub` |

> user ต้องมีสิทธิ์สร้างฐานข้อมูล — user `postgres` และ user ของ Homebrew มีสิทธิ์นี้อยู่แล้ว
>
> ใช้ Docker แทนได้ — `demo-student-subsystem` มี `docker-compose.yml` ที่เปิด PostgreSQL ไว้ที่พอร์ต **5433**
> ถ้าใช้แบบนั้น ให้ใส่ `:5433` ใน `DATABASE_URL` ของ demo ในข้อ 5

---

## 4. Core Hub — :3000 และ :3100

### 4.1 สร้างคู่กุญแจ RSA (ครั้งเดียว)

กุญแจส่วนตัว**ไม่ได้อยู่ใน git** ถ้าไม่สร้าง backend จะล้มตอนเปิดด้วย `ENOENT: keys/jwt-private.pem`

```text
csmju-core-hub/backend >> mkdir keys
```

คำสั่งยาวแต่พิมพ์บรรทัดเดียว (คัดลอกไปวางได้เลย ใช้ได้ทั้ง mac และ Windows):

```text
csmju-core-hub/backend >> node -e "const {generateKeyPairSync}=require('crypto');const fs=require('fs');const k=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});fs.writeFileSync('keys/jwt-private.pem',k.privateKey);fs.writeFileSync('keys/jwt-public.pem',k.publicKey);console.log('created keys/jwt-private.pem and keys/jwt-public.pem')"
```

ต้องขึ้นว่า `created keys/jwt-private.pem and keys/jwt-public.pem`

> ได้ไฟล์แบบเดียวกับ `openssl genpkey` ทุกประการ (PKCS#8 + SPKI, RSA 2048) — ถ้าเครื่องมี openssl ก็ใช้ได้เหมือนกัน

### 4.2 ตั้งค่า environment

```text
csmju-core-hub/backend >> cp .env.example .env
```

เปิดไฟล์ `csmju-core-hub/backend/.env` แล้วแก้บรรทัดนี้ให้ตรงกับเครื่องตัวเอง (ดูตารางในข้อ 3):

```bash
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/core_hub"
```

**`NODE_ENV` ต้องเป็น `development`** (ค่าเริ่มต้นเป็นแบบนี้อยู่แล้ว) — ถ้าเป็น `production`
Core Hub จะปฏิเสธ `callback_url` ที่เป็น `http://localhost` และจะลงทะเบียนระบบย่อยในข้อ 6 ไม่ได้

```text
csmju-core-hub/frontend >> cp .env.example .env
```

(ค่าในนั้นใช้ได้เลย: `BACKEND_API_URL=http://127.0.0.1:3000/api/v1` · `PORT=3100`)

### 4.3 ติดตั้ง · สร้างตาราง · ใส่ข้อมูลเริ่มต้น

**ติดตั้งที่รากของ repo** (ครั้งเดียวได้ทั้ง backend และ frontend):

```text
csmju-core-hub >> pnpm install
```

**สร้างฐานข้อมูลและตาราง** (สร้าง `core_hub` ให้เองถ้ายังไม่มี):

```text
csmju-core-hub/backend >> pnpm exec prisma migrate deploy
```

ต้องจบด้วย `All migrations have been successfully applied.`

**ใส่ข้อมูลเริ่มต้น** — ต้อง build ก่อน แล้วรัน seed จากไฟล์ที่ build แล้ว:

```text
csmju-core-hub/backend >> pnpm build
csmju-core-hub/backend >> node dist/prisma/seed.js
```

> อย่าใช้ `ts-node prisma/seed.ts` — จะล้มด้วย `Cannot find module './internal/class.js'`

seed จะสร้างผู้ใช้ทดสอบ 4 คน และลงทะเบียน `student-service` (demo) ไว้ให้แล้ว:

| email | password | role |
|---|---|---|
| `admin@core.local` | `password1` | admin |
| `student@core.local` | `password2` | student |
| `staff@core.local` | `password3` | staff |
| `alumni@core.local` | `password4` | alumni |

บัญชีชุดนี้**ต้องตรงกับ** `csmju2030-standards/fixtures/dev-accounts.json` เพราะ conformance ใช้ login ตอนทดสอบ

### 4.4 รัน (2 terminal)

**Terminal 1 — backend :3000**

```text
csmju-core-hub/backend >> pnpm start:dev
```

**Terminal 2 — frontend :3100**

```text
csmju-core-hub/frontend >> pnpm dev
```

> ทางลัด: `csmju-core-hub >> pnpm dev` เปิดทั้งสองฝั่งใน terminal เดียว แต่ log จะปนกันอ่านยาก — ครั้งแรกแนะนำแยก terminal

### 4.5 ตรวจว่าใช้ได้ — เปิดในเบราว์เซอร์

| เปิดลิงก์นี้ | ต้องเห็น |
|---|---|
| http://localhost:3000/api/v1/health | `"status":"ok"` |
| http://localhost:3000/api/v1/.well-known/jwks.json | **ขึ้นต้นด้วย `{"keys":[`** ตรง ๆ |
| http://127.0.0.1:3100 | หน้า login → เข้าด้วย `admin@core.local` / `password1` ได้ |

> ถ้า JWKS ขึ้นต้นด้วย `{"success":true,"data":...}` แปลว่าผิด — ระบบย่อยทุกตัวจะตอบ 401

---

## 5. demo-student-subsystem — :3001

```text
demo-student-subsystem/backend >> cp .env.example .env
```

เปิด `demo-student-subsystem/backend/.env` แล้วแก้ `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/demo_student_db
```

> ค่าเริ่มต้นใน `.env.example` เป็นพอร์ต **5433** (สำหรับ Docker) ถ้าใช้ PostgreSQL ในเครื่องต้องเปลี่ยนเป็น **5432**

ค่า `CORE_HUB_URL=http://localhost:3000` และ `PORT=3001` ใช้ได้เลย ไม่ต้องแก้

```text
demo-student-subsystem >> pnpm install
demo-student-subsystem/backend >> pnpm exec prisma migrate deploy
```

**Terminal 3 — demo :3001**

```text
demo-student-subsystem/backend >> pnpm start:dev
```

เปิด http://localhost:3001/api/health — ต้องได้ `"service":"student-service"` ซึ่งตรงกับชื่อในทะเบียนของ Core Hub

---

## 6. ระบบย่อยของทีมตัวเอง — :3002

### 6.1 สร้าง repo ด้วยสคริปต์ของมาตรฐาน 🪟

> 🪟 Windows ใช้ **Git Bash** — สคริปต์นี้เป็น `.sh`

**ต้องรันจากโฟลเดอร์ `csmju2030`** — สคริปต์สร้างโฟลเดอร์ใหม่ไว้ในที่ที่สั่งรัน จะได้วางถูกที่ทันที

```text
csmju2030 >> ./csmju2030-standards/new-subsystem.sh equipment "ระบบครุภัณฑ์"
```

สคริปต์สร้างไฟล์มาตรฐาน → **ตรวจ compliance กับสิ่งที่เพิ่งสร้าง 15 ข้อ** → `git init` + commit แรก → สร้าง repo บน GitHub → ผูก `standards/`

| มี `gh` | ไม่มี `gh` |
|---|---|
| ทำครบทุกขั้น | สคริปต์หยุดที่ `gh repo create` — ไฟล์และ commit แรกสร้างเสร็จแล้ว แต่**ยังไม่มี submodule** |

ถ้าไม่มี `gh` ให้ผูก submodule เอง (ทดสอบในเครื่องได้โดยไม่ต้องมี repo บน GitHub):

```text
csmju-equipment >> git submodule add https://github.com/CSMJU2030/csmju2030-standards.git standards
csmju-equipment/standards >> git checkout -q v1.0.0
csmju-equipment >> git add .gitmodules standards
csmju-equipment >> git commit -m "chore(equipment): pin standards submodule at v1.0.0"
```

### 6.2 วางโค้ดเริ่มต้น (เร็วที่สุดสำหรับทดสอบการเชื่อมต่อ)

สคริปต์ให้แค่โครงเปล่า (`backend/src/.gitkeep`) — วิธีที่เร็วและถูกต้องตามมาตรฐานคือ**ตั้งต้นจาก demo**
เพราะชั้น auth ต้องคัดลอกจาก reference implementation อยู่แล้ว (`aie-workflow.md` ขั้น 4)

**คัดลอก backend ของ demo** (ไม่เอา `node_modules` · `dist` · `generated` · `.env` มาด้วย):

```text
csmju-equipment >> node -e "const fs=require('fs'),path=require('path');const skip=['node_modules','dist','generated','.env'];fs.cpSync('../demo-student-subsystem/backend','backend',{recursive:true,filter:(s)=>!skip.includes(path.basename(s))});console.log('copied backend')"
```

ต้องขึ้นว่า `copied backend`

**คัดลอกไฟล์ที่รากของ demo มาอีก 2 ไฟล์:**

```text
csmju-equipment >> cp ../demo-student-subsystem/package.json .
csmju-equipment >> cp ../demo-student-subsystem/pnpm-workspace.yaml .
```

> ได้ทั้งโค้ด ชั้น auth และ schema ของ demo (ตาราง students) มาเป็นจุดตั้งต้น — พอทดสอบการเชื่อมต่อผ่านแล้ว
> ค่อยเปลี่ยน schema/API เป็นของโดเมนตัวเอง **โดยไม่แตะไฟล์ใน `backend/src/auth/`** ยกเว้น `role-mapping.ts` กับ `permissions.ts`

**แก้ 4 ไฟล์ให้เป็นของระบบตัวเอง:**

`csmju-equipment/package.json` — เปลี่ยน `name` ให้ไม่ซ้ำกับ `backend` (ไม่งั้นโดนกฎ `QA-06`):

```json
"name": "csmju-equipment"
```

`csmju-equipment/pnpm-workspace.yaml` — ไม่ต้องแก้ แต่**ต้องมีส่วน `allowBuilds`** ติดมาด้วย ไม่งั้น pnpm บล็อก postinstall ของ Prisma

`csmju-equipment/subsystem.yaml` — แก้เฉพาะส่วนหัว เก็บ `probes` ของ demo ไว้ (ใช้ได้เพราะโค้ดเป็นชุดเดียวกัน):

```yaml
name: csmju-equipment
base_url: http://localhost:3002
display_name: "ระบบครุภัณฑ์"
repo: github.com/CSMJU2030/csmju-equipment
```

`csmju-equipment/backend/src/auth/role-mapping.ts` — ต้อง**ตรงกับ** `defaultRoleMapping` ที่จะลงทะเบียนในข้อ 6.4 เป๊ะ

### 6.3 ตั้งค่า environment

```text
csmju-equipment/backend >> cp .env.example .env
```

เปิด `csmju-equipment/backend/.env` แล้วแก้ 4 บรรทัด:

```bash
PORT=3002
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/equipment_db
SUBSYSTEM_ID=csmju-equipment
SUBSYSTEM_NAME=ระบบครุภัณฑ์
```

`SUBSYSTEM_ID` ต้องตรงกัน**สามที่**: ไฟล์นี้ · `name` ใน `subsystem.yaml` · ชื่อในทะเบียน Core Hub

```text
csmju-equipment >> pnpm install
csmju-equipment/backend >> pnpm exec prisma migrate deploy
```

### 6.4 ลงทะเบียนกับ Core Hub 🪟

> 🪟 Windows ใช้ **Git Bash** — ใช้ `curl` และตัวแปรแบบ bash
> คำสั่งในข้อนี้**รันจากโฟลเดอร์ไหนก็ได้** และต้องรันใน terminal เดียวกันทั้งหมด (ตัวแปร `TOKEN` อยู่แค่ใน terminal นั้น)

**ขอ token ของ admin:**

```text
csmju2030 >> TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@core.local","password":"password1"}' | node -e "let s='';process.stdin.on('data',(d)=>s+=d).on('end',()=>console.log(JSON.parse(s).data.access_token))")
```

**สร้างทะเบียน** — ตัวอย่างนี้ตั้งใจ**ไม่ใส่ `alumni`** เพื่อใช้ทดสอบกรณีโดนปฏิเสธในข้อ 7

```text
csmju2030 >> curl -s -X POST http://localhost:3000/api/v1/subsystems -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"csmju-equipment","displayName":"ระบบครุภัณฑ์","owner":"admin","repo":"CSMJU2030/csmju-equipment","standardsVersion":"1.0.0","callbackUrl":"http://localhost:3002/auth/callback","defaultRoleMapping":{"student":"STUDENT","staff":"STAFF","admin":"ADMIN"},"requestedExceptions":[]}'
```

จด `"id"` ที่ได้กลับมา แล้ว approve + activate (เปลี่ยน `<ID>` เป็นค่านั้น):

```text
csmju2030 >> curl -s -X POST http://localhost:3000/api/v1/subsystems/<ID>/approve -H "Authorization: Bearer $TOKEN"
csmju2030 >> curl -s -X POST http://localhost:3000/api/v1/subsystems/<ID>/activate -H "Authorization: Bearer $TOKEN"
```

| พลาดบ่อย | ผล |
|---|---|
| ไม่ส่ง `requestedExceptions` | ได้ — ฟิลด์นี้ไม่บังคับแล้ว (Core Hub develop) |
| `callbackUrl` ไม่ใช่ URL เต็ม | 400 — ต้องมี `http://` |
| ลืม approve หรือ activate | เข้า SSO ไม่ได้ และไม่ขึ้นในเมนูของ Core Hub |
| ปิด terminal แล้วเปิดใหม่ | `$TOKEN` หาย ได้ 401 — ขอ token ใหม่ (อายุ 15 นาทีด้วย) |

> seed ของ Core Hub ลงทะเบียนให้แค่ `student-service` — ฐานข้อมูลใหม่จะไม่ชนชื่อ
> แต่ถ้าใช้ฐานข้อมูลเก่าที่เคยมีชื่อนี้อยู่ จะได้ `409 Subsystem name already exists`
> ให้แก้ของเดิมด้วย `PATCH /api/v1/subsystems/<ID>` ส่ง `{"callbackUrl":"http://localhost:3002/auth/callback"}` แทน

### 6.5 รัน

**Terminal 4 — ระบบตัวเอง :3002**

```text
csmju-equipment/backend >> pnpm start:dev
```

เปิด http://localhost:3002/api/health — ต้องได้ `"service":"csmju-equipment"`

---

## 7. ทดสอบการเชื่อมต่อ 🪟

> 🪟 Windows ใช้ **Git Bash** ทั้งข้อนี้ · คำสั่งรันจากโฟลเดอร์ไหนก็ได้ ยกเว้นที่ระบุไว้
> ต้องเปิดครบทั้ง 4 ระบบ (ข้อ 4.4 · 5 · 6.5) ก่อนเริ่ม

**เตรียมตัวช่วย** — สร้างคำสั่ง `login` แล้วขอ token ของ 3 บทบาทเก็บไว้ (รันใน terminal เดียวกับที่จะทดสอบ):

```text
csmju2030 >> login() { curl -s -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$1@core.local\",\"password\":\"$2\"}" | node -e "let s='';process.stdin.on('data',(d)=>s+=d).on('end',()=>console.log(JSON.parse(s).data.access_token))"; }
csmju2030 >> ADMIN=$(login admin password1)
csmju2030 >> STUDENT=$(login student password2)
csmju2030 >> ALUMNI=$(login alumni password4)
```

### ตารางทดสอบ

| # | ทดสอบ | คำสั่ง | ผลที่ต้องได้ |
|---|---|---|---|
| T1 | JWKS เป็นรูปแบบดิบ | `curl -s localhost:3000/api/v1/.well-known/jwks.json` | ขึ้นต้น `{"keys":[` |
| T2 | demo รับ token ของ Core Hub | `curl -s localhost:3001/api/v1/me -H "Authorization: Bearer $STUDENT"` | `"subsystemRole":"STUDENT"` |
| T3 | ระบบตัวเองรับ token เดียวกัน | `curl -s localhost:3002/api/v1/me -H "Authorization: Bearer $STUDENT"` | `"subsystemRole":"STUDENT"` |
| T4 | ไม่มี token | `curl -s -o /dev/null -w '%{http_code}' localhost:3002/api/v1/me` | `401` |
| T5 | token ปลอม | `curl -s -o /dev/null -w '%{http_code}' localhost:3002/api/v1/me -H "Authorization: Bearer abc.def.ghi"` | `401` |
| T6 | SSO ไป demo | `curl -s -D - -o /dev/null "localhost:3000/api/v1/auth/sso/authorize?subsystem=student-service&state=t6" -H "Authorization: Bearer $ADMIN" \| grep -i location` | `Location: http://localhost:3001/auth/callback?...` |
| T7 | SSO ไประบบตัวเอง | เหมือน T6 แต่ `subsystem=csmju-equipment` | `Location: http://localhost:3002/auth/callback?...` |
| T8 | **บทบาทที่ไม่ได้รับอนุญาต** | `curl -s -o /dev/null -w '%{http_code}' "localhost:3000/api/v1/auth/sso/authorize?subsystem=csmju-equipment&state=t8" -H "Authorization: Bearer $ALUMNI"` | **`403`** — Core Hub ปฏิเสธก่อนส่งต่อ |
| T9 | alumni ยังเข้า demo ได้ | เหมือน T8 แต่ `subsystem=student-service` | `302` — เพราะ demo อนุญาต alumni |

T8 กับ T9 รวมกันคือหลักฐานว่า**สิทธิ์ถูกตัดสินที่ Core Hub ตามทะเบียน** — ผู้ใช้คนเดียวกัน เข้าระบบหนึ่งได้ อีกระบบไม่ได้

### ทดสอบผ่านหน้าเว็บ (ไม่ต้องใช้ terminal)

1. เปิด http://127.0.0.1:3100 → login `admin@core.local`
2. แถบซ้ายหัวข้อ **"ระบบย่อย"** ต้องมี **CSMJU Student Service** และ **ระบบครุภัณฑ์**
3. กด **ระบบครุภัณฑ์** → เด้งไป `localhost:3002/auth/callback` และได้ `"subsystemRole":"ADMIN"`
4. ออกจากระบบ → login ใหม่เป็น `alumni@core.local`
5. แถบซ้ายต้อง**เหลือแค่ CSMJU Student Service** — ระบบครุภัณฑ์หายไปเพราะไม่ได้อนุญาต alumni

### ตรวจตามมาตรฐาน

**ตรวจกฎทั้งหมด** 🪟 (Git Bash):

```text
csmju-equipment >> ./standards/scripts/run-all-checks.sh .
```

> กฎ `ARC-02` ต้องใช้โปรแกรม `jq` — ถ้าไม่มีจะขึ้น `ข้ามการตรวจ (ไม่พบ jq)` ซึ่ง**ในเครื่องยอมได้** เพราะ CI มี jq และตรวจให้จริง
> อยากตรวจครบในเครื่อง: macOS `brew install jq` · Windows `winget install jqlang.jq`

**conformance** — ใช้ได้ทั้ง PowerShell และ Git Bash:

```text
csmju-equipment >> node standards/conformance/run.js --level L1
csmju-equipment >> node standards/conformance/run.js
```

ผลสุดท้ายที่ต้องได้:

```text
RESULT: <n> passed · 0 failed · 0 skipped      (จำนวนข้อขึ้นกับเวอร์ชันของ standards)
✅ CONFORMANT — csmju-equipment meets standard v1.0 L3
```

**`SKIP` ไม่นับว่าผ่าน** — แปลว่า `probes` ใน `subsystem.yaml` ประกาศไม่ครบ

---

## 8. ปิดระบบ

กด `Ctrl + C` ในแต่ละ terminal ถ้าปิดแล้วพอร์ตยังค้าง:

| | macOS / Git Bash บน mac | Windows (PowerShell) |
|---|---|---|
| ดูว่าใครใช้พอร์ต 3002 | `lsof -nP -iTCP:3002 -sTCP:LISTEN` | `netstat -ano \| findstr :3002` |
| ปิด | `kill <PID>` | `taskkill /PID <PID> /F` |

`<PID>` คือตัวเลขที่ได้จากคำสั่งแถวบน — ดูให้แน่ใจก่อนว่าเป็นโปรแกรมที่ตั้งใจจะปิด

---

## 9. แก้ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| `Command "start:dev" not found` | **อยู่ผิดโฟลเดอร์** | `pwd` ดูว่าอยู่ไหน · `pnpm run` ดูว่าโฟลเดอร์นี้มีคำสั่งอะไร · เทียบกับ path หน้า `>>` |
| `ENOENT: keys/jwt-private.pem` | ยังไม่สร้างกุญแจ หรือสร้างผิดโฟลเดอร์ | ทำข้อ 4.1 ใน `csmju-core-hub/backend` |
| `EADDRINUSE :3001` | Core Hub frontend รุ่นเก่ายังจองพอร์ต 3001 | frontend ต้องอยู่ 3100 · ปิดตัวที่ค้างด้วยข้อ 8 |
| demo ต่อฐานข้อมูลไม่ได้ | `.env.example` ของ demo ชี้พอร์ต 5433 | เปลี่ยนเป็น 5432 ถ้าใช้ PostgreSQL ในเครื่อง |
| `password authentication failed` | user/รหัสผ่านใน `DATABASE_URL` ผิด | Windows ใช้ user `postgres` + รหัสที่ตั้งตอนติดตั้ง (ข้อ 3) |
| `permission denied to create database` | user ใน `DATABASE_URL` ไม่มีสิทธิ์สร้างฐานข้อมูล | ใช้ user `postgres` หรือให้ผู้ดูแลเครื่องสร้างฐานข้อมูลให้ก่อน |
| `pnpm install` ล้มที่ `prisma generate` | ใช้ repo รุ่นเก่า | `git pull` ให้ได้ `main` ล่าสุด |
| `ERR_PNPM_IGNORED_BUILDS` | `pnpm-workspace.yaml` ไม่มี `allowBuilds` | คัดลอกไฟล์นั้นจาก demo (ข้อ 6.2) |
| `pnpm` ไม่รู้จักบน Windows | ยังไม่ได้เปิด corepack | PowerShell แบบ Run as Administrator → `corepack enable pnpm` แล้วเปิด terminal ใหม่ |
| `./...sh: command not found` หรือเปิดเป็นไฟล์ | รันสคริปต์ `.sh` ใน PowerShell | เปลี่ยนไปใช้ Git Bash |
| `curl` ใน PowerShell ตอบเป็นตารางแปลก ๆ | PowerShell แปลง `curl` เป็นคำสั่งของตัวเอง | ข้อ 6.4 และ 7 ใช้ Git Bash |
| ระบบย่อยตอบ 401 ทุกคำขอ | JWKS ถูกห่อ envelope หรือสร้างกุญแจใหม่ทับ | ตรวจ T1 · login ใหม่ · รีสตาร์ตระบบย่อยเพื่อล้าง cache กุญแจ |
| `callbackUrl must use HTTPS` | Core Hub ตั้ง `NODE_ENV=production` โดยไม่เปิดโหมดก่อนเปิดใช้ | ในเครื่องใช้ `development` · บน server ใช้ `ALLOW_LOCALHOST_CALLBACKS=true` |
| SSO ได้ 403 ทั้งที่ลงทะเบียนแล้ว | role ไม่อยู่ใน `defaultRoleMapping` หรือยังไม่ approve/activate | ตรวจทะเบียนด้วย `GET /api/v1/subsystems/all` |
| ระบบย่อยไม่ขึ้นในเมนู Core Hub | เหมือนข้อบน — เมนูกรองด้วยกฎเดียวกับ SSO | เหมือนข้อบน |
| `standards/` ว่าง | clone โดยไม่ใส่ `--recurse-submodules` | ข้อ 2 · `git submodule update --init --recursive` |
| conformance ขึ้น SKIP | `probes` ไม่ครบ | ประกาศให้ครบใน `subsystem.yaml` |
| `pnpm test` ที่รากผ่านแต่ไม่มีเทสต์รันเลย | `name` ของ `package.json` ที่รากซ้ำกับ `backend` | ตั้งชื่อไม่ให้ซ้ำ (กฎ `QA-06`) |

---

## 10. เช็คลิสต์ผ่าน

- [ ] โฟลเดอร์จัดตามข้อ 2 · `demo-student-subsystem/standards/` ไม่ว่าง
- [ ] 3 ฐานข้อมูลแยกกัน (สร้างอัตโนมัติจาก `migrate deploy`)
- [ ] 4 พอร์ตเปิดครบ: 3000 · 3100 · 3001 · 3002
- [ ] T1–T9 ผ่านทั้งหมด
- [ ] หน้าเว็บ: admin เห็น 2 ระบบ · alumni เห็น 1 ระบบ
- [ ] `run-all-checks.sh` ผ่านทุกข้อในระบบตัวเอง
- [ ] conformance L3 ได้ `0 failed · 0 skipped`

---

**อ่านต่อ:** `csmju2030-standards/docs/aie-workflow.md` (ลำดับงานทั้งหมดจนส่งมอบ) ·
`auth-contract.md` (สัญญา JWT/SSO) · `subsystem-registry.md` (ทะเบียนฉบับละเอียด) · `conformance.md` (เกณฑ์ผ่าน)

---

## ภาคผนวก ก — ทำไมต้องใช้ pnpm และ npx ใช้ได้มั้ย

ทุกคำสั่งในเอกสารนี้ใช้ `pnpm` ไม่ใช่ `npm` — กฎ `QA-05` ของ CI บังคับกับทุก repo ในโครงการ
รวมถึงระบบย่อยของทุกทีม

### npm ไม่ได้แย่ — แต่ห้ามใช้ปนกัน

แต่ละตัวมีไฟล์ล็อกเวอร์ชัน (lockfile) ของตัวเอง:

| ตัว | lockfile |
|---|---|
| npm | `package-lock.json` |
| pnpm | `pnpm-lock.yaml` |

CI ติดตั้งด้วย `pnpm install --frozen-lockfile` คือ**ติดตั้งตาม `pnpm-lock.yaml` เป๊ะ ห้ามเปลี่ยน**
ถ้าใครใช้ `npm install` เพิ่ม package ไฟล์ที่เปลี่ยนคือ `package-lock.json` แต่ `pnpm-lock.yaml` ไม่เปลี่ยน
ผลคือเครื่องเขากับ CI ได้คนละเวอร์ชัน — ต้นเหตุของอาการ "เครื่องผมรันได้นะ"

ถ้าเผลอพิมพ์ `npm install` ในโปรเจกต์นี้ มันจะไม่อ่าน `pnpm-workspace.yaml` จึง**ไม่ติดตั้ง dependency ของ
`backend/` และ `frontend/` เลย** และได้ `package-lock.json` งอกออกมาให้ CI ตีตก

### ทำไมเลือก pnpm — 4 เหตุผลที่เจอจริงในโครงการนี้

**1. จับ dependency ที่ไม่ได้ประกาศไว้**

npm วาง package ทุกตัวแบนราบใน `node_modules` โค้ดจึง import สิ่งที่ไม่ได้เขียนไว้ใน `package.json` ได้โดยไม่รู้ตัว
pnpm อนุญาตเฉพาะที่ประกาศไว้จริง

> **เคสจริง:** Core Hub เคยมี `import type { SignOptions } from 'jsonwebtoken'` ทั้งที่ `jsonwebtoken` ไม่อยู่ใน
> `package.json` — npm ปล่อยผ่านเพราะ `@nestjs/jwt` ลากมาให้ พอย้ายมา pnpm typecheck พังทันที
> ถ้าไม่ย้าย วันที่ `@nestjs/jwt` เลิกใช้ `jsonwebtoken` ระบบจะพังโดยไม่มีใครรู้สาเหตุ

**2. ประหยัดดิสก์**

pnpm เก็บ package แต่ละเวอร์ชันไว้**ชุดเดียว**ใน store กลาง แล้วลิงก์เข้าแต่ละโปรเจกต์ ส่วน npm คัดลอกเต็มทุกโปรเจกต์
เอกสารนี้มี 3–4 repo ที่ใช้ dependency แทบชุดเดียวกัน ถ้าเป็น npm จะกินพื้นที่เป็นหลายเท่า

**3. บล็อกสคริปต์อันตรายตอนติดตั้ง**

pnpm 10+ ไม่ให้ dependency รันสคริปต์ตอนติดตั้ง (`postinstall`) ยกเว้นตัวที่อนุญาตไว้ใน `allowBuilds`
ของ `pnpm-workspace.yaml` เช่น `prisma` และ `bcrypt` — กันกรณี package ในสายการพึ่งพาถูกแฮ็กแล้วฝังโค้ดไว้
npm รันให้ทั้งหมดโดยไม่ถาม

error `ERR_PNPM_IGNORED_BUILDS` ในข้อ 9 คือกลไกนี้ทำงานอยู่ ไม่ใช่บั๊ก

**4. monorepo และเวอร์ชันตรงกันทุกเครื่อง**

แต่ละ repo มี `backend/` และ `frontend/` อยู่ด้วยกัน และ `package.json` ล็อก `"packageManager": "pnpm@12.3.4"` ไว้ —
สั่ง `corepack enable pnpm` แล้วทุกคนรวมถึง CI ได้ pnpm เวอร์ชันเดียวกัน

### แล้ว npx ล่ะ

**npx ไม่ได้ติดตั้ง dependency ของโปรเจกต์** — มันแค่**รันคำสั่ง** CLI ของ package เช่น `npx prisma generate`
จึงไม่ผิดกฎ `QA-05` (ไม่สร้าง lockfile) และในโปรเจกต์ pnpm ก็รันได้ เพราะมันหาคำสั่งใน `node_modules/.bin` ก่อน

**จุดอันตรายมีข้อเดียว:** ถ้าหาในเครื่องไม่เจอ npx จะ**ดาวน์โหลดเวอร์ชันล่าสุดมารันเงียบ ๆ**
เช่นได้ Prisma 7.10 ทั้งที่มาตรฐานล็อกไว้ 7.9.1 — แล้ว migration อาจทำงานต่างจากที่ทดสอบไว้

**หลักจำ:** เครื่องมือในโปรเจกต์ → `pnpm exec` (ไม่มีก็ error ไม่แอบดาวน์โหลด) ·
เครื่องมือใช้ครั้งเดียว → `pnpm dlx` · `npx` ใช้ได้แต่ต้องรู้ว่าอาจดึงเวอร์ชันอื่นมา

> ถ้าเห็น `npx prisma migrate deploy` ใน `backend/docker/entrypoint.sh` ของบาง repo ไม่ต้องตกใจ —
> ใน Docker image ติดตั้ง prisma เวอร์ชันที่ล็อกไว้แล้ว npx จึงใช้ตัวในเครื่องเสมอ

---

## ภาคผนวก ข — ตารางคำสั่งสำหรับ dev

### วิธีอ่านตาราง

| คอลัมน์ | ความหมาย |
|---|---|
| **รันที่** | โฟลเดอร์ที่ต้องอยู่ก่อนรัน — `ราก` = รากของ repo (โฟลเดอร์ที่มี `pnpm-workspace.yaml`) · `backend` / `frontend` = โฟลเดอร์ย่อยนั้นของ repo |
| **npm / npx** | มีไว้เทียบให้คนที่คุ้นกับ npm — **ในโครงการนี้ใช้คอลัมน์ pnpm** |
| **pnpm** | คำสั่งที่ใช้จริง |

ช่องที่เป็น `—` คือคำสั่งที่ไม่เกี่ยวกับ package manager ใช้เหมือนกันทุกคน · ป้าย 🪟 = บน Windows ต้องใช้ Git Bash

> **เห็น `--filter` ในเอกสารอื่น?** เช่น `pnpm --filter backend start:dev` — คือการสั่งจากรากของ repo
> โดยระบุโฟลเดอร์ ได้ผล**เหมือนกับ** เข้าไปที่ `backend` แล้วพิมพ์ `pnpm start:dev` เป๊ะ ใช้แบบที่ถนัดได้เลย
> (ชื่อที่ใช้กับ `--filter`: backend ของ Core Hub คือ `core-api` · ของ demo และของทีมคือ `backend` · frontend คือ `frontend`)

### เตรียมเครื่อง

| อยากทำอะไร | รันที่ | npm / npx | pnpm | หมายเหตุ |
|---|---|---|---|---|
| เปิดใช้ pnpm | ที่ไหนก็ได้ | — | `corepack enable pnpm` | corepack มากับ Node 22 · Windows ต้องเปิด PowerShell แบบ Administrator |
| ดูเวอร์ชัน | ที่ไหนก็ได้ | `npm -v` | `pnpm -v` | ต้องได้ 12.x |
| ดูว่าอยู่โฟลเดอร์ไหน | ที่ไหนก็ได้ | — | `pwd` | ใช้ได้ทั้ง mac · PowerShell · Git Bash |
| ดูว่าโฟลเดอร์นี้มีคำสั่งอะไร | ที่ไหนก็ได้ | `npm run` | `pnpm run` | ไม่เห็นคำสั่งที่จะรัน = อยู่ผิดที่ |

### ติดตั้งและจัดการ dependency

| อยากทำอะไร | รันที่ | npm / npx | pnpm | หมายเหตุ |
|---|---|---|---|---|
| ติดตั้งทั้งโปรเจกต์ | ราก | `npm install` | `pnpm install` | `prisma generate` รันตามให้เอง |
| ติดตั้งแบบเดียวกับ CI | ราก | `npm ci` | `pnpm install --frozen-lockfile` | ห้ามแก้ lockfile — ใช้ตรวจก่อนเปิด PR |
| เพิ่ม package | `backend` | `npm install zod` | `pnpm add zod` | ต้องอยู่ใน whitelist ไม่งั้นโดน `ARC-02` |
| เพิ่ม dev dependency | `backend` | `npm install -D x` | `pnpm add -D x` | |
| เพิ่มเครื่องมือที่ใช้ทั้ง repo | ราก | `npm install -D x` | `pnpm add -Dw x` | `-w` = ติดตั้งที่รากของ workspace |
| ลบ package | `backend` | `npm uninstall x` | `pnpm remove x` | |
| อัปเดต package ตัวเดียว | `backend` | `npm update x` | `pnpm update x` | **ห้ามอัปเดต Prisma** — ล็อก 7.9.1 เป๊ะทั้งสามตัว |
| ดูว่าอะไรตกรุ่น | ราก | `npm outdated` | `pnpm outdated -r` | |
| ดูว่าติดตั้งอะไรไว้ | ราก | `npm ls` | `pnpm list -r --depth 0` | |
| ดูว่าใครลาก package นี้มา | ราก | `npm explain x` | `pnpm why x` | ใช้ไล่ dependency ที่ไม่ได้ประกาศไว้ |
| อนุญาตให้ package รันสคริปต์ตอนติดตั้ง | ราก | — | `pnpm approve-builds` | เขียนลง `allowBuilds` · ใช้เมื่อเจอ `ERR_PNPM_IGNORED_BUILDS` |
| คืนพื้นที่ดิสก์ | ที่ไหนก็ได้ | — | `pnpm store prune` | ลบ package ใน store ที่ไม่มีโปรเจกต์ไหนใช้แล้ว |

### รันระบบ

| อยากทำอะไร | รันที่ | npm / npx | pnpm | หมายเหตุ |
|---|---|---|---|---|
| Core Hub backend | `csmju-core-hub/backend` | `npm run start:dev` | `pnpm start:dev` | :3000 |
| Core Hub frontend | `csmju-core-hub/frontend` | `npm run dev` | `pnpm dev` | :3100 |
| Core Hub ทั้งสองฝั่งพร้อมกัน | `csmju-core-hub` | — | `pnpm dev` | log ปนกันใน terminal เดียว |
| demo | `demo-student-subsystem/backend` | `npm run start:dev` | `pnpm start:dev` | :3001 |
| ระบบของทีม | `csmju-equipment/backend` | `npm run start:dev` | `pnpm start:dev` | :3002 |
| build | `backend` หรือ `frontend` | `npm run build` | `pnpm build` | |
| build ทุกโฟลเดอร์ | ราก | `npm run build --workspaces` | `pnpm -r build` | `-r` = ทุก workspace |

### ตรวจคุณภาพโค้ด

| อยากทำอะไร | รันที่ | npm / npx | pnpm | หมายเหตุ |
|---|---|---|---|---|
| lint | `backend` | `npm run lint` | `pnpm lint` | `QA-01` |
| แก้ lint อัตโนมัติ | `csmju-core-hub/backend` | `npm run lint:fix` | `pnpm lint:fix` | มีเฉพาะ Core Hub · CI ไม่แก้ให้ |
| ตรวจ type | `backend` หรือ `frontend` | `npm run typecheck` | `pnpm typecheck` | `QA-02` · frontend ต้องเป็น `next typegen && tsc --noEmit` |
| unit test | `backend` | `npm test` | `pnpm test` | `QA-03` |
| unit test แบบเฝ้าไฟล์ | `backend` | `npm run test:watch` | `pnpm test:watch` | รันใหม่ทุกครั้งที่บันทึกไฟล์ |
| ดู coverage | `backend` | `npm run test:cov` | `pnpm test:cov` | |
| e2e test | `backend` | `npm run test:e2e` | `pnpm test:e2e` | ต้องมีฐานข้อมูล |
| integration test ของ demo | `demo-student-subsystem/backend` | `npm run test:integration` | `pnpm test:integration` | ต้องเปิด Core Hub ไว้ ไม่งั้นเคสจะถูกข้าม |
| ตรวจทุกโฟลเดอร์ในครั้งเดียว | ราก | `npm run lint --workspaces` | `pnpm -r lint` · `pnpm -r typecheck` · `pnpm -r test` · `pnpm -r build` | **ตรวจแบบเดียวกับ CI** — ลบ `frontend/.next` ก่อน ไม่งั้นผ่านหลอก |

### Prisma และฐานข้อมูล

| อยากทำอะไร | รันที่ | npm / npx | pnpm | หมายเหตุ |
|---|---|---|---|---|
| สร้างฐานข้อมูล + ตารางตาม migration | `backend` | `npx prisma migrate deploy` | `pnpm exec prisma migrate deploy` | สร้างฐานข้อมูลให้เองถ้ายังไม่มี |
| สร้าง Prisma client | `backend` | `npx prisma generate` | `pnpm exec prisma generate` | ปกติไม่ต้องสั่ง — `pnpm install` ทำให้แล้ว |
| สร้าง migration ใหม่หลังแก้ schema | `backend` | `npx prisma migrate dev --name add_x` | `pnpm exec prisma migrate dev --name add_x` | ใช้ตอน dev เท่านั้น · **เปลี่ยนชื่อคอลัมน์ต้องเขียน `RENAME COLUMN` เอง** ไม่งั้นข้อมูลหาย |
| ดูสถานะ migration | `backend` | `npx prisma migrate status` | `pnpm exec prisma migrate status` | |
| ล้างฐานข้อมูลทั้งหมด | `backend` | `npx prisma migrate reset` | `pnpm exec prisma migrate reset` | ⚠️ **ข้อมูลหายหมด** ใช้กับเครื่อง dev เท่านั้น |
| เปิดหน้าจัดการข้อมูล | `backend` | `npx prisma studio` | `pnpm exec prisma studio` | :5555 · **ห้ามเปิดออกอินเทอร์เน็ต** |
| seed ของ Core Hub | `csmju-core-hub/backend` | — | `pnpm build` แล้ว `node dist/prisma/seed.js` | ต้อง build ก่อน · ห้ามใช้ `ts-node` |
| seed ของ demo | `demo-student-subsystem/backend` | `npm run prisma:seed` | `pnpm prisma:seed` | ข้อมูลตัวอย่าง — ไม่จำเป็นต่อการทดสอบเชื่อมต่อ |

### เครื่องมือที่ใช้ครั้งเดียว

| อยากทำอะไร | รันที่ | npm / npx | pnpm | หมายเหตุ |
|---|---|---|---|---|
| สร้าง type ของ route (Next.js) | `frontend` | `npx next typegen` | `pnpm exec next typegen` | `pnpm typecheck` เรียกให้อยู่แล้ว |
| สร้างแอป Next.js ใหม่ | ราก | `npx create-next-app@latest frontend` | `pnpm dlx create-next-app@latest frontend` | ใช้ตอนเริ่ม frontend ของทีม · ต้องเป็น 15.5+ |
| สร้าง backend ใหม่ด้วย Nest CLI | ราก | `npx @nestjs/cli new backend` | `pnpm dlx @nestjs/cli new backend` | **ไม่แนะนำ** — ตั้งต้นจาก demo แทน (ข้อ 6.2) |

### มาตรฐานและ conformance

| อยากทำอะไร | รันที่ | npm / npx | pnpm | หมายเหตุ |
|---|---|---|---|---|
| สร้าง repo ระบบย่อยใหม่ 🪟 | `csmju2030` | — | `./csmju2030-standards/new-subsystem.sh <slug> "<ชื่อ>"` | |
| ตรวจตามกฎ (ระบบย่อย) 🪟 | ราก | — | `./standards/scripts/run-all-checks.sh .` | ตัวเดียวกับที่ CI ใช้ · ไม่มี `jq` จะข้าม `ARC-02` |
| ตรวจตามกฎ (Core Hub) 🪟 | `csmju-core-hub` | `npm run checks` | `pnpm checks` | ต้องมี `csmju2030-standards` อยู่ข้าง ๆ |
| conformance ระดับเดียว | ราก | — | `node standards/conformance/run.js --level L1` | ไล่ทีละระดับ L1 → L2 → L3 |
| conformance ตามที่ประกาศไว้ | ราก | — | `node standards/conformance/run.js` | อ่านระดับจาก `subsystem.yaml` |
| conformance ออกเป็นไฟล์ | ราก | — | `node standards/conformance/run.js --json` | ได้ `conformance-report.json` แนบ PR |
| ดึง submodule `standards/` | ราก | — | `git submodule update --init --recursive` | ใช้เมื่อโฟลเดอร์ `standards/` ว่าง |
| ดูว่าผูกมาตรฐานเวอร์ชันไหน | ราก | — | `git submodule status` | ต้องตรงกับ `.standards-version` |

### git ตามมาตรฐาน

| อยากทำอะไร | รันที่ | npm / npx | pnpm | หมายเหตุ |
|---|---|---|---|---|
| แตก branch ใหม่ | ราก | — | `git checkout -b feature/<slug>/<เรื่อง>` | `GH-01` · ตัวพิมพ์เล็กและขีดกลางเท่านั้น |
| commit | ราก | — | `git commit -m "feat(<slug>): <คำอธิบาย>"` | `GH-02` · type ได้แค่ `feat` `fix` `chore` `refactor` `docs` `test` `ci` |
| ดึงของใหม่จาก main | ราก | — | `git fetch origin` แล้ว `git merge origin/main` | ทำก่อนเปิด PR ทุกครั้ง |
| push branch | ราก | — | `git push -u origin feature/<slug>/<เรื่อง>` | แล้วเปิด PR บน GitHub |

### พอร์ตและ process

| อยากทำอะไร | รันที่ | macOS | Windows (PowerShell) | หมายเหตุ |
|---|---|---|---|---|
| ดูว่าพอร์ตไหนเปิดอยู่ | ที่ไหนก็ได้ | `lsof -nP -iTCP -sTCP:LISTEN` | `netstat -ano \| findstr LISTENING` | |
| ดูว่าใครใช้พอร์ตนี้ | ที่ไหนก็ได้ | `lsof -nP -iTCP:3002 -sTCP:LISTEN` | `netstat -ano \| findstr :3002` | ได้เลข PID |
| ปิด process ที่ค้างพอร์ต | ที่ไหนก็ได้ | `kill <PID>` | `taskkill /PID <PID> /F` | ดูก่อนว่าใช่ตัวที่ตั้งใจจะปิด |
