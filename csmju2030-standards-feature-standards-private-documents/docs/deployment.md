# Deployment — ขึ้นระบบย่อยบน server

**เวอร์ชัน 1.3** (standards 1.8.3) · ตัวตรวจ `DEP-01..04` · image สร้างด้วย `subsystem-images.yml`

ทุกระบบย่อยจะขึ้น server กลางของรายวิชา (เครื่องเดียวกับ Core Hub `https://csmju2030.jowave.com`)
เอกสารนี้บอกว่า**ทีมต้องเตรียมอะไรใน repo** (ข้อ 3–4, 6) และ**DevOps ทำอะไรบน server** (ข้อ 5, 7)

> **สถานะ:** spec เครื่องและชื่อ subdomain (ข้อ 2) **รออาจารย์อนุมัติ** — แต่ส่วนของทีมทำได้ตั้งแต่ตอนนี้
> และ CI ตรวจ `DEP-01..04` ตั้งแต่ทีมเลื่อนเป็น 1.8.0 · ตัวอย่างที่ผ่านครบ: `demo-student-subsystem`

---

## 1. ภาพรวม

```text
ผู้ใช้ ─https─► Cloudflare ─► Apache (server) ─► <ระบบ>-web  Next.js :3000 ─► <ระบบ>-api  NestJS :4000 ─► PostgreSQL กลาง
                                                  (เปิดผ่าน Apache)            (ไม่เปิดออกนอก)              (ฐานของระบบเอง)
```

แต่ละระบบ = **2 image** ที่ GitHub Actions build จาก repo ของทีมแล้วเก็บไว้ที่ GitHub Container Registry (ghcr.io)
server แค่ดึง image ไปรัน — **ไม่ build บน server** (การ build Next.js ใช้ RAM ราว 1.2 GB ต่อครั้ง)
ฐานข้อมูลไม่ใช่ image ของทีม: DevOps สร้างฐานให้ใน PostgreSQL ตัวกลาง (ข้อ 4)

| ใคร | ทำอะไร |
|---|---|
| ทีม (AIE · PL) | `frontend/Dockerfile` · `backend/Dockerfile` · `.dockerignore` · Next.js standalone · จำกัด connection · ทดสอบด้วย `docker compose` ในเครื่อง (ข้อ 3, 4, 6) |
| DevOps | วาง `images.yml` ในทุก repo · สร้างฐาน + role · compose และ Apache บน server · token สำหรับดึง image (ข้อ 5, 7) |
| PL | ขอ admin ระบบกลางเปลี่ยน callback เป็น `https` ก่อนวันเปิดใช้ (ข้อ 2) |

---

## 2. ชื่อเว็บของแต่ละระบบ (รออนุมัติ)

- **แผน:** `https://<ชื่อในทะเบียน>.jowave.com` เช่น `https://csmju-quiz.jowave.com` — เป็นชื่อชั้นเดียว
  เพราะใบรับรอง https ของ Cloudflare ครอบแค่ `*.jowave.com` (ชื่อสองชั้นอย่าง `quiz.csmju2030.jowave.com` เบราว์เซอร์จะเตือนว่าไม่ปลอดภัย)
- **ห้ามแยกระบบด้วย path** เช่น `csmju2030.jowave.com/quiz` — `/auth/login` `/auth/callback` `/auth/logout`
  ต้องอยู่ที่รากของ origin ([auth-contract](auth-contract.md) ข้อ 5) และเบราว์เซอร์กั้นความปลอดภัยตาม origin ไม่ใช่ตาม path:
  ระบบที่อยู่ origin เดียวกันอ่านหน้าและเรียก API ของกันได้ และได้คุกกี้ของ Core Hub ไปด้วย
- ชื่อในทะเบียน (`name` · [subsystem-registry](subsystem-registry.md) ข้อ 2) จะกลายเป็น subdomain — ใช้ได้ไม่เกิน **63 ตัวอักษร**
- **ตอนเปิดใช้จริง** server ปิดโหมดก่อนเปิดใช้ callback ที่เป็น `http://localhost` ใช้ไม่ได้ทันที —
  PL ขอ admin เปลี่ยน callback เป็น `https://<ชื่อ>.jowave.com/auth/callback` ก่อนวันนั้น ([subsystem-registry](subsystem-registry.md) ข้อ 4)

---

## 3. image ของระบบ (`DEP-01..04`)

### 3.1 สองตัวต่อระบบ

| | web | api |
|---|---|---|
| Dockerfile | `frontend/Dockerfile` — copy จาก [`templates/csmju-subsystem-web/`](../templates/csmju-subsystem-web/) | `backend/Dockerfile` + `backend/docker/entrypoint.sh` — copy จาก `demo-student-subsystem` |
| build context | **รากของ repo** (`docker build -f frontend/Dockerfile .`) | **รากของ repo** (`docker build -f backend/Dockerfile .`) |
| ชื่อ service ใน compose | **`web`** | **`api`** |
| พอร์ตใน container | `3000` | `4000` (env `PORT`) |
| ผู้ใช้ | `node` | `node` |
| ตอนสตาร์ต | `node frontend/server.js` | `prisma migrate deploy` แล้ว `node dist/src/main.js` |
| health | รับการเชื่อมต่อที่ `3000` | `GET /api/health` ตอบ 200 (`API-05`) |
| ออกสู่ภายนอก | ผ่าน Apache เท่านั้น | ไม่เปิด — web ส่ง `/api/*` และ `/auth/*` มาให้ |

พอร์ต `32xx` / `42xx` ของทีมใช้ตอน dev บนเครื่องเดียวเท่านั้น ใน container ทุกระบบใช้ `3000` / `4000` เหมือนกัน
เพราะแต่ละระบบอยู่ใน network ของตัวเอง

build context เป็นรากของ repo เพราะ pnpm เก็บ `pnpm-lock.yaml` ไว้ที่ราก — Dockerfile ทั้งสองตัว copy lockfile
แล้วติดตั้งเฉพาะ package ของตัวเอง (`--filter frontend...` / `--filter backend...`)

### 3.2 `BACKEND_URL` ถูกฝังตอน build

`rewrites()` ใน `next.config.ts` ถูกคำนวณตอน `next build` แล้วฝังลงไฟล์ build —
**ตั้ง `BACKEND_URL` ตอนรัน container แล้วไม่มีผล** (ทดสอบแล้ว: image ยังส่งไปที่ค่าตอน build)

Dockerfile ของ template จึง build ด้วย `BACKEND_URL=http://api:4000` ซึ่งคือ service `api` ใน compose ของระบบเดียวกัน
**ห้ามเปลี่ยนชื่อ service `api` หรือพอร์ต `4000`** · ตอน dev ค่ายังมาจาก `.env.local` (`http://127.0.0.1:42xx`) เหมือนเดิม

หน้าที่ prerender ตอน build (หน้าที่ไม่อ่านคุกกี้) ก็ใช้ `CORE_HUB_WEB_URL` ตอน build เหมือนกัน —
Dockerfile ใส่ค่า server จริงไว้ให้แล้ว (ปุ่ม "กลับ CSMJU Portal")

### 3.3 กฎที่ CI ตรวจ

| รหัส | กฎ | ทำไม |
|---|---|---|
| `DEP-01` | มี `backend/Dockerfile` · และ `frontend/Dockerfile` เมื่อมี `frontend/package.json` | GitHub Actions build image จากไฟล์นี้ (ข้อ 5) |
| `DEP-02` | **stage สุดท้าย**ของ Dockerfile ตั้ง `USER` ที่ไม่ใช่ `root` / `0` | ถ้าโค้ดมีช่องโหว่ ผู้บุกรุกไม่ได้สิทธิ์ root ใน container · `USER` ใน stage ก่อนหน้า**ไม่ตามมา** |
| `DEP-03` | `.dockerignore` ที่รากกัน `**/.env*` (หรือ `**/.env` + `**/.env.*`) และ `**/node_modules` | `.env` มี secret — ติดใน image เท่ากับทุกคนที่ดึง image อ่านได้ · `node_modules` ของ macOS/Windows ใช้บน Linux ไม่ได้ · ต้องมี `**/` เพราะ `.env` เฉย ๆ กันแค่ที่ราก ไม่กัน `backend/.env` |
| `DEP-04` | `frontend/next.config.*` ตั้ง `output: "standalone"` | image มีแค่ server ที่ trace แล้ว (~290 MB) และ Dockerfile copy `.next/standalone` |

ข้ามทั้งหมดเมื่อ repo เพิ่ง scaffold (ยังไม่มี `package.json` ทั้งสองฝั่ง) · ระบบที่ไม่มี UI ต้องมีแค่ `backend/Dockerfile`

### 3.4 ต้องทำตามแม้ไม่มีตัวตรวจ

- **ไม่มี secret ใน Dockerfile** (`ARG` / `ENV`) — ค่าทุกอย่างมาจาก env ตอนรัน (ข้อ 4.2)
- **ระบบไฟล์ของ container อ่านอย่างเดียว** — เขียนได้แค่ `/tmp` (ข้อมูลหายเมื่อ container เริ่มใหม่) · ทดสอบด้วย compose ของ demo ซึ่งล็อกแบบเดียวกับ server ·
  ไฟล์ที่ผู้ใช้อัปโหลดเก็บได้ 2 ที่ตามชนิด:
  - **รูปที่ใครเห็นก็ได้** (ข่าว · ภาพประกอบ) → Core Hub `POST /images` ([reference-data](reference-data.md) ข้อ 6) — เปิดได้โดยไม่ login และถูกแปลงเป็น WebP
  - **เอกสารที่ต้องตรวจสิทธิ์หรือเก็บต้นฉบับ** (บิล · สลิป · PDF · ไฟล์ที่มีข้อมูลส่วนบุคคล) → ฐานข้อมูลของระบบเอง (ข้อ 4.3)
- **log ออก stdout เท่านั้น** ([logging](logging.md)) — ห้ามเขียนไฟล์ log
- **ห้าม `chown -R` ทั้งโฟลเดอร์แอป** — Docker เก็บไฟล์ทุกไฟล์ซ้ำอีกชั้น image โตเท่าตัว (user `node` อ่านไฟล์ของ root ได้อยู่แล้ว)
- **ลบ store และ cache ของ pnpm ใน `RUN` เดียวกับ `pnpm install`** — ไม่งั้นติดไปใน image อีกหลายร้อย MB (ดู `backend/Dockerfile` ของ demo)
- **อย่าใส่ `--ignore-scripts` ตอนติดตั้งของ runtime** — `@prisma/engines` ต้องดาวน์โหลด engine ที่ `prisma migrate deploy` ใช้ตอนนั้น
  ถ้าข้าม container จะพยายามดาวน์โหลดตอนสตาร์ตแล้วพัง
- **ตอนสตาร์ตห้าม** `prisma migrate dev` · `prisma db push` · seed ข้อมูลตัวอย่าง — ใช้ `prisma migrate deploy` เท่านั้น
- งานตั้งเวลาต้องระบุ `timeZone: 'Asia/Bangkok'` ([tech-stack](tech-stack.md) ข้อ 1.4.1)
- **ห้ามสร้าง URL เต็มจาก request** (`new URL(path, request.url)` · `request.headers.host` · `req.protocol`) — ในเครื่องได้
  `http://localhost:32xx` แต่บน server request ผ่าน Cloudflare และ Apache มา จะได้ host หรือ `http` ผิด · redirect ภายในระบบใช้ path
  (`/bookings`) · ลิงก์ไป Core Hub ใช้ `CORE_HUB_WEB_URL` · ห้ามฝัง `localhost` ในโค้ด
- **ไม่รันโค้ดที่ผู้ใช้ส่งมา** ใน api — ถ้าระบบต้องทำ (ตัวตรวจโค้ด) ทำตามข้อ 8 เท่านั้น

---

## 4. ฐานข้อมูลและ env ตอนรัน

### 4.1 ฐานข้อมูล

- **PostgreSQL 16 ตัวกลาง** บน server (แยกจากฐานของ Core Hub) — DevOps สร้าง **database + role ระบบละ 1 ชุด**
  role เป็นเจ้าของ database ของตัวเองและเข้าฐานอื่นไม่ได้ จึงยังเป็น "1 ระบบ = 1 ฐานข้อมูล" ตามเดิม
- migration รันเองตอน api สตาร์ต (`prisma migrate deploy` ใน `entrypoint.sh`) · migration ที่ขึ้น server แล้วห้ามแก้หรือลบ
- **role ของระบบไม่ใช่ superuser** — migration ที่มี `CREATE EXTENSION` (เช่น `uuid-ossp` · `pg_trgm` · `citext`) ผ่านในเครื่อง
  (user `postgres`) แต่**ตกบน server** · ใช้ของที่มีในตัว PostgreSQL 16 แทน (`gen_random_uuid()` ไม่ต้องใช้ extension ·
  `@default(uuid())` ของ Prisma สร้างค่าฝั่งแอป) · ถ้าจำเป็นจริงให้ขอ DevOps ติดตั้งให้ก่อน แล้วเขียน `CREATE EXTENSION IF NOT EXISTS`
- **จำกัด connection ต่อระบบ** ด้วย env `DATABASE_POOL_MAX` (ค่าเริ่มต้น `5`) — `pg` เปิดได้ 10 เส้นต่อระบบโดยค่าเริ่มต้น
  37 ระบบจะต้องใช้ 370 เส้น ซึ่งเกินที่ PostgreSQL รับได้ · ทำแบบ demo (`backend/src/prisma/prisma.service.ts`):

```ts
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX) || 5,
});
```

### 4.2 env ที่ server ส่งให้

**api**

| env | ค่าบน server | หมายเหตุ |
|---|---|---|
| `NODE_ENV` | `production` | คุกกี้เป็น `Secure` · backend ตรวจ env เข้มขึ้น |
| `PORT` | `4000` | |
| `DATABASE_URL` | DevOps กำหนด | ฐานของระบบเองเท่านั้น |
| `DATABASE_POOL_MAX` | `5` | ข้อ 4.1 |
| `CORE_HUB_URL` · `CORE_HUB_JWKS_URL` · `CORE_HUB_WEB_URL` | `https://csmju2030.jowave.com` (JWKS: `…/api/v1/.well-known/jwks.json`) | [connect-core-hub](connect-core-hub.md) ข้อ 4 |
| `CORE_HUB_ISSUER` · `CORE_HUB_AUDIENCE` | `core-hub` · `csmju2030` | ค่าตายตัวของสัญญา |
| `SUBSYSTEM_ID` | ชื่อในทะเบียน | |
| `TZ` | `Asia/Bangkok` | |
| ค่าของทีมเอง | ตามที่ทีมแจ้ง | ต้องมีใน `backend/.env.example` · ค่าลับส่งให้ DevOps ทางข้อความส่วนตัว ห้าม commit |

**web** — `CORE_HUB_WEB_URL` · `SUBSYSTEM_ID` · `TZ` (`BACKEND_URL` ฝังใน image แล้ว ข้อ 3.2)

DevOps ใช้ `backend/.env.example` เป็นรายการ env ของระบบ — env ที่ไม่อยู่ในไฟล์นั้นจะไม่ถูกตั้งบน server

### 4.3 เอกสารที่ผู้ใช้อัปโหลด (บิล · สลิป · PDF)

เอกสารที่ต้องตรวจสิทธิ์ก่อนเปิด หรือต้องเก็บไฟล์ต้นฉบับไว้เป็นหลักฐาน เก็บในฐานข้อมูลของระบบเอง —
ห้ามใช้บริการรูปของ Core Hub (เปิดสาธารณะ · cache 1 วัน · แปลงไฟล์) และห้ามเขียนลงดิสก์ของ container (อ่านอย่างเดียว · หายเมื่อเริ่มใหม่)

| เรื่อง | กติกา |
|---|---|
| ชนิดไฟล์ | กำหนดรายการที่รับ (เช่น PDF · JPEG · PNG · WebP) และ**ตรวจจาก byte ต้นไฟล์** (`%PDF-` · `FF D8 FF` · `89 50 4E 47` · `RIFF…WEBP`) — ห้ามเชื่อชื่อไฟล์หรือ `Content-Type` ที่ส่งมา · ไม่รับ SVG · HTML |
| ขนาด | ไม่เกิน **10 MB** ต่อไฟล์ — ตั้ง `limits.fileSize` ที่ตัวรับ multipart ให้ตัดตั้งแต่ตอนรับ ไม่ใช่ตรวจหลังรับครบ · ไฟล์เกินหรือชนิดไม่ตรงตอบ `400 VALIDATION_ERROR` (enum ปิดใน `contracts/error-codes.json` ไม่มี 413) · ทดสอบไฟล์ขนาดใกล้เพดานผ่านหน้าเว็บด้วย `docker compose` เพราะคำขอวิ่งผ่าน rewrites ของ Next.js ก่อนถึง api |
| ต้นฉบับ | เก็บ bytes ตามที่อัปโหลด ไม่ย่อ ไม่แปลง · เก็บ `sha256` ไว้พิสูจน์ว่าไม่ถูกแก้ |
| ตาราง | แยกตารางไฟล์ออกจากตารางธุรกิจ (คอลัมน์ `Bytes` ของ Prisma) — query รายการทั่วไปต้องไม่ดึงคอลัมน์ไฟล์มาด้วย |
| เปิดดู | ส่งผ่าน api ที่**ตรวจสิทธิ์ทุกครั้ง** · `Content-Type` จากชนิดที่ตรวจได้ตอนรับ · `Content-Disposition: attachment` · `X-Content-Type-Options: nosniff` · `Cache-Control: private, no-store` |
| ลบ | ตามกติกาธุรกิจของระบบ — เอกสารการเงินควร soft delete หรือห้ามลบหลังอนุมัติ · บันทึกว่าใครลบ |
| ปริมาณ | ประเมินขนาดรวมต่อปีแจ้ง DevOps · เกิน **1 GB** ต้องตกลงกับ DevOps ก่อน (ฐานข้อมูลใช้ร่วมกันและ backup ทั้งก้อน) |

```prisma
model Attachment {
  id                   String   @id @default(uuid())
  mimeType             String   @map("mime_type")          // จากการตรวจ byte ต้นไฟล์
  sizeBytes            Int      @map("size_bytes")
  sha256               String   @map("sha256") @db.Char(64)
  content              Bytes    @map("content")            // ไฟล์ต้นฉบับ
  uploadedByCoreUserId String   @map("uploaded_by_core_user_id") @db.VarChar(64)
  createdAt            DateTime @default(now()) @map("created_at")

  @@map("attachments")
}
```

---

## 5. image บน GitHub Container Registry

ทุกครั้งที่ push เข้า `main` workflow `.github/workflows/images.yml` ของ repo
(DevOps วางให้ ทีมแก้ไม่ได้ — `GH-03`) เรียก `subsystem-images.yml` ของ standards ซึ่ง build แล้ว push:

| image | จาก | tag |
|---|---|---|
| `ghcr.io/csmju2030/<repo>-api` | `backend/Dockerfile` | `main` · `sha-<commit 7 ตัว>` |
| `ghcr.io/csmju2030/<repo>-web` | `frontend/Dockerfile` | เหมือนกัน |

- **build เมื่อ `.standards-version` เป็น 1.8.0 ขึ้นไปเท่านั้น** — แปลว่า Dockerfile ผ่าน `DEP-01..04` แล้ว ·
  ก่อนหน้านั้น workflow แค่ตรวจเวอร์ชัน (job **Plan**) แล้วข้ามพร้อมแจ้งเตือน ไม่ตก · Dockerfile ที่เขียนก่อนมีข้อกำหนดนี้
  (พอร์ตอื่น · รันเป็น root · ไม่ใช่ standalone) จึงไม่ถูก build ไปจนกว่าทีมจะแก้แล้วเลื่อนเวอร์ชัน
- ยังไม่มี Dockerfile → ข้าม image นั้นพร้อมแจ้งเตือน ไม่ตก
- build เฉพาะ `main` (server ดึง `:main`) · branch อื่นสั่งเองได้ที่ **Actions → Images → Run workflow** ได้ tag ตามชื่อ branch
- image เป็น **private** ตาม repo · server ดึงด้วย token อ่านอย่างเดียว (ข้อ 7)
- ดูผลที่แท็บ **Actions → Images** ของ repo · build ตกให้แก้ใน repo แล้ว merge ใหม่
- **ย้อนเวอร์ชัน:** DevOps ชี้ compose ไปที่ tag `sha-…` ของ commit ก่อนหน้าแล้ว `docker compose up -d`

---

## 6. ทดสอบในเครื่องก่อนเปิด PR

ใช้ `docker-compose.yml` แบบของ demo: service `db` · `api` · `web` (ชื่อต้องตรง ข้อ 3.1) ·
web เปิดที่ `127.0.0.1:<พอร์ต frontend ของทีม>:3000` เพื่อให้ callback `http://localhost:32xx/auth/callback` ที่ลงทะเบียนไว้ยังใช้ได้ ·
api และ web ล็อกแบบเดียวกับ server (`read_only` · `cap_drop: [ALL]` · `no-new-privileges`) ·
จำกัด RAM เท่ากับ server (`mem_limit` api `512m` · web `384m`) และหมุน log (`max-size: 10m` · `max-file: 3`)

```bash
docker compose up -d --build        # build ทั้งสอง image แล้วรัน db + api + web
docker compose ps                   # ทั้งสามต้อง healthy
docker compose logs api             # ต้องเห็น migration ผ่าน และ subsystem.started
docker stats --no-stream            # ดู RAM
docker compose down                 # หยุด (ข้อมูลยังอยู่ใน volume)
```

- [ ] `./standards/scripts/run-all-checks.sh .` ผ่าน รวม `DEP`
- [ ] `docker compose ps` — `db` `api` `web` เป็น `healthy` ทั้งหมด
- [ ] เปิด `http://localhost:32xx` แล้ว login ผ่าน Core Hub กลับมาได้ (ใช้ Chrome — รับคุกกี้ `Secure` บน `localhost`)
- [ ] `/api/*` ผ่าน web ไปถึง api (`curl http://localhost:32xx/api/health` ตอบ 200)
- [ ] RAM ตอนใช้งานปกติ web + api รวมไม่เกิน **~400 MB** (demo: web ~40 MB · api ~85 MB)

### 6.1 ในเครื่องต่างจาก server ตรงไหน

image ตัวเดียวกัน แต่สิ่งรอบ ๆ ไม่เหมือนกัน — รันในเครื่องได้คือด่านแรก ก่อนเปิดใช้ DevOps จะซ้อมรัน image จาก ghcr.io บน server จริงกับทีมอีกครั้ง

| เรื่อง | ในเครื่อง | บน server | ทีมต้องทำ |
|---|---|---|---|
| CPU | Mac รุ่น M = arm64 · Windows/Intel = amd64 | amd64 (GitHub build ให้) | ไม่ใช้ package ที่มีแต่ binary ของเครื่องตัวเอง · ดูผล Actions → Images ทุกครั้ง |
| ฐานข้อมูล | user `postgres` (superuser) ใน container ของทีม | role ของระบบใน PostgreSQL ตัวกลาง | ห้าม `CREATE EXTENSION` เอง (ข้อ 4.1) · ห้ามพึ่งข้อมูลจาก seed |
| env | เขียนใน `docker-compose.yml` | DevOps ตั้งตาม `backend/.env.example` | ประกาศ env ทุกตัวใน `.env.example` (ข้อ 4.2) — ตัวที่ไม่มีจะไม่ถูกตั้ง และ api สตาร์ตไม่ขึ้น |
| URL | `http://localhost:32xx` | `https://<ชื่อ>.jowave.com` ผ่าน Cloudflare + Apache | ห้ามสร้าง URL เต็มจาก request และห้ามฝัง `localhost` (ข้อ 3.4) |
| RAM | compose ของ demo จำกัดเท่า server | api `512m` · web `384m` | เกินแล้วถูก kill — ดู `docker stats` ตอนทดสอบ |
| เน็ตขาออก | ออกได้ทุกที่ | ออกได้ แต่ IP ของ server ทั้งเครื่องใช้เพดานเรียก Core Hub ร่วมกัน | cache ข้อมูลอ้างอิงตาม [reference-data](reference-data.md) · ไม่เรียก Core Hub ทีละแถว |
| callback | `http://localhost:32xx/auth/callback` (โหมดก่อนเปิดใช้) | `https://<ชื่อ>.jowave.com/auth/callback` | PL ขอ admin เปลี่ยนก่อนวันเปิด (ข้อ 2) |

---

## 7. งานของ DevOps

**ครั้งเดียว**

1. ตั้งค่า org: **Settings → Packages → Package creation** ให้สร้าง package แบบ private ได้ ·
   ไม่ต้องเพิ่ม action ใน allow-list — `subsystem-images.yml` ใช้แค่ `actions/checkout` กับคำสั่ง `docker` บน runner
2. รัน `org-settings/add-image-workflow.sh v1.8.1` (dry run) → `--apply --merge`
   — วาง `images.yml` ทุก repo · repo ที่ยังไม่ถึง 1.8.0 จะไม่ build จนกว่าทีมจะเลื่อนเอง (ทำแล้ว 6 ต.ค. 2569 ครบ 38 repo)
3. บน server: token อ่าน package (classic PAT สิทธิ์ `read:packages` เท่านั้น ของบัญชีที่อ่าน repo ได้) →
   `docker login ghcr.io` · ห้ามเก็บ token ใน repo หรือ log
4. PostgreSQL ตัวกลาง: `max_connections` ไม่น้อยกว่า `จำนวนระบบ × 6 + 20` · network ภายในที่ api ทุกตัวเข้าถึงได้ · backup ด้วย `pg_dump` ทุกฐาน
5. DNS และ Apache ตามที่อาจารย์อนุมัติ (ข้อ 2)

**ต่อระบบ**

```sql
-- ชื่อ role/ฐาน = ชื่อในทะเบียน เปลี่ยน - เป็น _
CREATE ROLE csmju_quiz LOGIN PASSWORD '<สุ่มใหม่ ห้ามใช้ซ้ำ>' CONNECTION LIMIT 6;
CREATE DATABASE csmju_quiz OWNER csmju_quiz;
REVOKE ALL ON DATABASE csmju_quiz FROM PUBLIC;
```

```yaml
# /srv/subsystems/csmju-quiz/compose.yml — ตัวอย่าง (ค่าจริงอยู่ใน api.env บน server เท่านั้น)
name: csmju-quiz
x-hardening: &hardening
  read_only: true
  cap_drop: [ALL]
  security_opt: ['no-new-privileges:true']
  restart: unless-stopped
  logging: { driver: json-file, options: { max-size: '10m', max-file: '3' } }   # 37 ระบบ — ไม่หมุน log ดิสก์เต็ม
services:
  api:
    <<: *hardening
    image: ghcr.io/csmju2030/csmju-quiz-api:main
    env_file: ./api.env              # DATABASE_URL · CORE_HUB_* · SUBSYSTEM_ID · ค่าของทีม
    environment: { NODE_ENV: production, PORT: 4000, DATABASE_POOL_MAX: 5, TZ: Asia/Bangkok }
    tmpfs: ['/tmp:size=32m']
    mem_limit: 512m
    networks: [default, subsystems-db]
  web:
    <<: *hardening
    image: ghcr.io/csmju2030/csmju-quiz-web:main
    environment: { CORE_HUB_WEB_URL: 'https://csmju2030.jowave.com', SUBSYSTEM_ID: csmju-quiz, TZ: Asia/Bangkok }
    tmpfs: ['/tmp:size=32m', '/app/frontend/.next/cache:size=64m']
    depends_on: { api: { condition: service_healthy } }
    ports: ['127.0.0.1:<พอร์ตของระบบบน server>:3000']   # Apache ส่ง <ชื่อ>.jowave.com มาที่นี่
    mem_limit: 384m
networks:
  subsystems-db: { external: true }
```

- อัปเดตหลังทีม merge: `docker compose pull && docker compose up -d` (ตั้งเวลาหรือสั่งเอง) · ลบ image เก่าเป็นระยะ (`docker image prune`)
- ขนาดโดยประมาณต่อระบบ: web ~290 MB · api ~800 MB (ส่วนใหญ่คือ Prisma CLI ที่ใช้รัน migration)

---

## 8. ระบบที่ต้องรันโค้ดของผู้ใช้

ระบบที่รับโค้ดจากผู้ใช้มารัน (ตัวตรวจคำตอบ · playground) คือจุดที่ถูกเจาะง่ายที่สุดของทั้ง server — โค้ดนั้นเขียนโดยใครก็ได้
ข้อนี้ใช้กับทุกระบบ (ตอนนี้: `csmju-coding-arena`) · **ต้องให้ PM อนุมัติก่อนเปิดใช้บน server**

### 8.1 ห้าม

| วิธี | ทำไม |
|---|---|
| mount `/var/run/docker.sock` ของ server เข้า container | Docker ตัวหลักรันเป็น root — ใครสั่งได้ก็สร้าง container ที่ mount `/` ของ host ได้ = root ทั้งเครื่อง รวม Core Hub และทุกระบบ |
| docker-socket-proxy | กรองได้แค่ชนิดคำสั่ง ไม่ได้กรอง flag — ยังสั่ง `--privileged` หรือ mount ไฟล์ของ host ได้ |
| Docker-in-Docker เป็น container ที่ 3 | ต้องรันแบบ `--privileged` ซึ่งหลุดออก host ได้ และเพิ่ม container นอก web + api |
| รันโค้ดใน api ตรง ๆ (`child_process` · `eval` · `vm`) | โค้ดผู้ใช้อ่าน env (`DATABASE_URL`) และออกเน็ตได้ · nsjail/bubblewrap ใช้ไม่ได้ใน container ที่ตัด capability |
| บริการตรวจโค้ดภายนอกโดยไม่ได้อนุมัติ | ต้องส่ง test case ที่ซ่อนไว้และโค้ดของผู้ใช้ออกนอก |

### 8.2 ทางที่ใช้

server มี **Docker แบบ rootless ที่แยกไว้รันโค้ดโดยเฉพาะ** (daemon ของ user `judge` ที่ไม่ใช่ root · DevOps ดูแล) —
api ของระบบที่ได้รับอนุมัติสั่ง `docker run` ผ่าน env `DOCKER_HOST` ที่ DevOps ตั้งให้ ระบบยังเป็น web + api เหมือนเดิม

- api ของระบบนั้นบน server รันเป็น uid ของ `judge` และมีแค่ socket ของ daemon นี้ — มองไม่เห็น Docker ตัวหลัก
- user `judge` ไม่มีเน็ตขาออก · image ที่ใช้รันโค้ดดึงไว้ล่วงหน้าโดย DevOps และอ้างด้วย digest
- `backend/Dockerfile` เพิ่มแค่ตัวสั่ง (`RUN apk add --no-cache docker-cli` · `ENV DOCKER_CONFIG=/tmp/.docker`) — ไม่มี daemon ใน image
- `backend/.env.example` ประกาศ `DOCKER_HOST=` (ว่าง = ตอน dev ใช้ Docker ในเครื่อง) และ env ของ image ที่ใช้รันโค้ด
- ถ้าภายหลังได้เครื่องแยกสำหรับรันโค้ด ทีมเปลี่ยนแค่ค่า `DOCKER_HOST`

### 8.3 container ที่รันโค้ดผู้ใช้ — ขั้นต่ำทุกครั้ง

| flag / พฤติกรรม | เพื่อ |
|---|---|
| `--network=none` | ออกเน็ตไม่ได้ |
| `--read-only` + `--tmpfs=/tmp:rw,noexec,nosuid,size=16m` | เขียนได้แค่ `/tmp` และรันไฟล์จากที่นั่นไม่ได้ |
| `--user=65534:65534` · `--cap-drop=ALL` · `--security-opt=no-new-privileges` | ไม่ใช่ root และยกสิทธิ์ไม่ได้ |
| `--memory` = `--memory-swap` · `--cpus` · `--pids-limit` | จำกัด RAM (ไม่ใช้ swap) · CPU · กัน fork bomb |
| `--ulimit nofile=64:64` | จำกัดจำนวนไฟล์ที่เปิดได้ |
| `--rm` + ลบใน `finally` (`docker rm -f <ชื่อ>`) | ไม่มี container ค้างเมื่อ api ล่มกลางงาน |
| `--pull=never` + image อ้างด้วย digest | ใช้ image ที่ DevOps ดึงไว้เท่านั้น ผลตรวจคงที่ |
| จำกัดเวลาและขนาด output ฝั่ง api | โค้ดวนไม่จบหรือพิมพ์ไม่หยุดไม่ทำให้ api ค้าง |
| ตรวจทีละงาน (หรือจำนวนที่ตกลงกับ DevOps) | RAM ของ server ใช้ร่วมกันทุกระบบ |

ตัวอย่างที่ทำครบ: `csmju-coding-arena` `backend/src/evaluation/sandbox-runner.ts` (ขาดแค่ `--ulimit`)

### 8.4 ทดสอบในเครื่อง

`pnpm dev` ใช้ Docker ในเครื่องตามปกติ (ไม่ตั้ง `DOCKER_HOST`) · ถ้าจะทดสอบ api ใน container ให้ mount socket ของ Docker Desktop
ผ่านไฟล์ compose แยกที่ใช้เฉพาะในเครื่อง (`docker-compose.local-judge.yml`) — **ห้ามนำวิธีนี้ไปใช้บน server**
และก่อนเปิดใช้ ซ้อมกับ DevOps บน server ด้วยโค้ดที่พยายามออกเน็ต · เขียนไฟล์ · fork bomb · กิน RAM · วนไม่จบ ทุกข้อต้องถูกหยุด
