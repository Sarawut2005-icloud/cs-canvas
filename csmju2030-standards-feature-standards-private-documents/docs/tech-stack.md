# มาตรฐาน Tech Stack
**โครงการ:** CSMJU2030 (ระบบ MIS สาขาวิชาวิทยาการคอมพิวเตอร์)
**ดูแลโดย:** ทีม Infrastructure & DevOps

เอกสารฉบับนี้คือข้อกำหนดด้านสถาปัตยกรรมเทคโนโลยี บังคับใช้กับทุกระบบย่อย (Subsystem) โดยอ้างอิงจากแผนสถาปัตยกรรมระบบและการบริหารจัดการทีมพัฒนา (CSMJU2030-PM)

---

## 1. Tech Stack มาตรฐาน (Authorized Technology Stack)

ไม่อนุญาตให้ติดตั้ง Framework นอกเหนือจากนี้:

เวอร์ชันด้านล่างคือเวอร์ชันที่ Core Hub และ reference implementation ใช้จริงและทดสอบผ่านแล้ว

### 1.1 Runtime และเครื่องมือร่วม

| รายการ | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| **Node.js** | `22.x` | ตรงกับ Core Hub |
| **TypeScript** | `^5.9` | เปิด `strictNullChecks` อย่างน้อย |
| **package manager** | **pnpm `12.3.4`** | ตั้ง `"packageManager": "pnpm@12.3.4"` ใน `package.json` ที่ราก (CI ใช้เลขนี้) · ต้อง commit `pnpm-lock.yaml` · ห้ามมี `package-lock.json` / `yarn.lock` (กฎ `QA-05`) |
| **Docker + docker compose** | — | ต้องมี `backend/Dockerfile` · `frontend/Dockerfile` · `.dockerignore` ที่ราก และ `docker-compose.yml` — ข้อกำหนดของ image อยู่ใน [`deployment.md`](deployment.md) (`DEP-01..04`) |

### 1.2 Frontend Stack
*   **Core Framework:** **Next.js** (App Router) — `15.5+` (ต้องมีคำสั่ง `next typegen` ดูข้อ 1.2.1)
*   **Language:** **TypeScript**
*   **Styling:** **Tailwind CSS** (ใช้งานร่วมกับ `@csmju2030/design-system` ของ Core)
*   **State / Data Fetching:** Zustand, React Context, Axios หรือ React Query
*   **ไอคอน · แผนที่ · QR:** `lucide-react` · `leaflet` · `qrcode.react` (ตั้งแต่ 1.2.1 ดูข้อ 1.4.2)
*   **Realtime:** `socket.io-client` (ตั้งแต่ 1.7.1 ดูข้อ 1.4.3)
*   ห้ามมีหน้า login ของตัวเอง — ต้องเข้าผ่าน Core Hub SSO (`auth-contract.md` ข้อ 5)

#### 1.2.1 script `typecheck` ของ frontend ต้องสร้าง route types ก่อน

Next.js สร้าง type ของ route/layout (`LayoutProps`, `PageProps`) ลงใน `.next/types`
**ตอนรัน `next dev` หรือ `next build` เท่านั้น** ไม่ได้อยู่ในซอร์สโค้ด

ถ้าตั้ง `"typecheck": "tsc --noEmit"` เฉย ๆ จะ **ผ่านในเครื่องแต่ตกบน CI** เพราะในเครื่องมี
`.next/` ค้างจากการรัน dev อยู่แล้ว ส่วน CI checkout ใหม่ไม่มี และ `QA-02` รัน typecheck
**ก่อน** build เสมอ อาการที่เจอคือ:

```text
app/layout.tsx(23,50): error TS2304: Cannot find name 'LayoutProps'.
```

`frontend/package.json` จึงต้องเป็น:

```json
{
  "scripts": {
    "typecheck": "next typegen && tsc --noEmit"
  }
}
```

`next typegen` สร้างเฉพาะ type โดยไม่ต้อง build ทั้งโปรเจกต์ (ใช้เวลาไม่ถึงวินาที)
ฝั่ง backend ใช้ `tsc --noEmit -p tsconfig.json` ตามปกติ

> ตรวจก่อนเปิด PR ด้วยการลบของค้างออกก่อน: `rm -rf frontend/.next && pnpm -r typecheck`
> ถ้าผ่านแบบนี้ CI จะผ่านด้วย

### 1.3 Backend Stack

| รายการ | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| **NestJS** | `^11` | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` |
| **@nestjs/config** | `^4.0.4` | |
| **Prisma** | **`7.9.1` (pin เป๊ะ ห้ามใส่ `^`)** | `prisma`, `@prisma/client`, `@prisma/adapter-pg` ต้องเป็นเลขเดียวกันทั้งสามตัว |
| **pg** | `^8.23` | driver ที่ `@prisma/adapter-pg` ต้องใช้ |
| **PostgreSQL** | `16+` | ห้ามใช้ MySQL / MongoDB / SQLite |
| **class-validator / class-transformer** | `^0.15.1` / `^0.5.1` | ใช้กับ `ValidationPipe` |
| **jose** | `^5.10` | ตรวจ JWT ผ่าน JWKS — **ห้ามใช้ `passport-jwt` ในระบบย่อย** เพราะไม่รองรับ JWKS + `kid` ตามสัญญา |
| **Jest / ts-jest / supertest** | `^30` / `^29.4` / `^7` | |
| **Realtime (ถ้าต้องใช้)** | `socket.io` `^4.8` | `@nestjs/websockets` + `@nestjs/platform-socket.io` ใช้ major เดียวกับ NestJS · ดูข้อ 1.4.3 |

*   **Database:** Frontend ห้ามเชื่อมต่อ PostgreSQL ตรงเด็ดขาด ต้องผ่าน Backend ของระบบย่อยเท่านั้น (กฎ `ARC-01`)
*   **Backend ต้องเป็น NestJS ทุกระบบย่อย** (กฎ `ARC-04`) — Next.js ทำหน้าเว็บเท่านั้น: route handler / server action
    ส่งต่อคำขอไป backend ได้ แต่ข้อมูลและ business logic ต้องอยู่ที่ backend · ระบบที่ไม่มีข้อมูลของตัวเองแต่ต้อง login
    ก็ยังต้องมี backend บาง ๆ (auth · health จาก demo) ไว้รับ callback และตรวจ token · เว็บที่ไม่ต้อง login ไม่ใช่ระบบย่อย
*   **ORM:** ใช้ Prisma 7 แบบ **driver adapter** (`PrismaPg`) ตาม reference implementation

---

### 1.4 Dependency whitelist

CI (`ARC-02`) ตรวจ dependency ทุกตัวกับรายการที่อนุญาตใน
[`../scripts/lib/allowed-deps.json`](../scripts/lib/allowed-deps.json)

`devDependencies` ผ่านได้เมื่ออยู่ในรายการของฝั่งนั้น (`allowed_frontend` / `allowed_backend`) หรือ `allowed_dev_tooling`
หรือตรง pattern `@types/*` — ไลบรารีนอก whitelist (เช่น `react-leaflet`) ย้ายไปไว้ใน `devDependencies` ก็ยังตก ·
Tailwind v4 ใช้ `@tailwindcss/postcss` ได้ (อนุญาตตั้งแต่ 1.2.1)

ต้องการไลบรารีนอกรายการ → เปิด issue ขอเพิ่ม พร้อมเหตุผลว่าแก้ปัญหาอะไร
**ห้าม**แก้ไฟล์ whitelist เองใน PR ของระบบย่อย

#### 1.4.1 งานตั้งเวลา (scheduled job)

งานที่ต้องรันเองตามเวลา เช่น ยกเลิกคำขอที่ค้างเกินกำหนด หรือติดธงรายการที่เกินกำหนดคืน ให้ใช้ `@nestjs/schedule` (อนุญาตตั้งแต่ 1.0.1)
ไลบรารีตั้งเวลาตัวอื่น (`node-cron` · `cron` · `agenda` · `bull`) ยังไม่อนุญาต ให้ใช้ตัวเดียวกันทั้ง platform

ทุกงานต้องทำตาม 3 ข้อนี้

1. **รันซ้ำได้โดยไม่เสียหาย (idempotent)** — ใส่เงื่อนไขทั้งหมดไว้ใน `WHERE` ของคำสั่งเดียว
   เช่น `UPDATE … SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at < now()`
   ห้ามดึงรายการออกมาก่อนแล้วค่อยวนแก้ทีละแถว เพราะถ้ามีสอง instance รันพร้อมกัน งานจะถูกทำซ้ำ
2. **ระบุ time zone ทุกครั้ง** — `@Cron('0 2 * * *', { timeZone: 'Asia/Bangkok' })`
   ระบบที่รันใน Docker มักใช้เวลา UTC ถ้าไม่ระบุ งานที่ตั้งไว้ตีสองจะไปรันตอนเก้าโมงเช้าเวลาไทย
3. **ถ้าวันหนึ่งต้องรันหลาย instance** — ครอบงานด้วย `pg_try_advisory_xact_lock` ภายใน `prisma.$transaction`
   เพื่อให้มีแค่ instance เดียวที่ทำงานรอบนั้น ทำได้ทันทีโดยไม่ต้องเพิ่ม dependency และไม่ต้องย้ายไป scheduler กลาง
   (ตอนนี้ระบบย่อยรัน instance เดียว และมาตรฐานยังไม่มี scheduler กลาง)

```ts
await this.prisma.$transaction(async (tx) => {
  // เลขประจำงาน ต้องไม่ซ้ำกับงานอื่นในระบบเดียวกัน
  const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(4201) AS locked`;
  if (!locked) return; // instance อื่นกำลังทำงานนี้อยู่
  await tx.$executeRaw`UPDATE borrow_requests SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at < now()`;
});
```

#### 1.4.2 ไอคอน แผนที่ QR และ Tailwind v4 (อนุญาตตั้งแต่ 1.2.1 · สาย 1.0.x ตั้งแต่ 1.0.2)

| แพ็กเกจ | ใช้ทำอะไร | license |
|---|---|---|
| `lucide-react` | ไอคอน — ใช้แทนชุดไอคอนกลาง `icons.tsx` ได้ทั้งระบบ แต่ห้ามผสมสองชุด (`ui-design-system.md` ข้อ 14) · import ทีละไอคอน (`import { MapPin } from 'lucide-react'`) | ISC |
| `leaflet` (+ `@types/leaflet`) | แผนที่ | BSD-2-Clause |
| `qrcode.react` | สร้าง QR code ในเบราว์เซอร์ | ISC |
| `@tailwindcss/postcss` | Tailwind CSS v4 (`@theme`) ผ่าน PostCSS แบบเดียวกับ frontend ของ Core Hub | MIT |

**`react-leaflet` ไม่อนุญาต** เพราะใช้ license Hippocratic-2.1 ซึ่งไม่ใช่ license โอเพนซอร์สมาตรฐาน (ไม่ผ่าน OSI)
ให้เรียก `leaflet` ตรง ๆ ใน client component แทน:

```tsx
'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export function CampusMap({ lat, lng, zoom = 17 }: { lat: number; lng: number; zoom?: number }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import('leaflet').Map | undefined;
    let cancelled = false;
    // leaflet ใช้ window — โหลดเฉพาะฝั่งเบราว์เซอร์ ไม่ให้พังตอน server render
    import('leaflet').then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current).setView([lat, lng], zoom);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, zoom]);

  return <div ref={el} style={{ height: 320 }} />;
}
```

- ทุกแผนที่ต้องแสดง attribution ของ OpenStreetMap และทำตาม tile usage policy ของ OSM — ถ้าใช้ปริมาณมากให้ตั้ง tile server เอง
- ถ้าตั้ง Content-Security-Policy ต้องเพิ่มโดเมน tile ใน `img-src`
- QR code ใส่ได้เฉพาะข้อมูลสาธารณะ เช่น URL ของหน้าประกาศ — **ห้าม**ใส่ token รหัสผ่าน หรือข้อมูลบุคคล

#### 1.4.3 Realtime และเครื่องมือเทสต์หน้าเว็บ (อนุญาตตั้งแต่ 1.7.1)

| แพ็กเกจ | ฝั่ง | ใช้ทำอะไร | license |
|---|---|---|---|
| `socket.io` · `@nestjs/websockets` · `@nestjs/platform-socket.io` | backend | WebSocket gateway ของ NestJS — แชทสด แจ้งเตือนสด สถานะออนไลน์ signaling ของ WebRTC | MIT |
| `socket.io-client` | frontend | client ของข้อข้างบน | MIT |
| `@testing-library/jest-dom` · `@testing-library/user-event` | frontend · `devDependencies` เท่านั้น | matcher และการจำลองการกด/พิมพ์ในเทสต์ ใช้คู่กับ `@testing-library/react` | MIT |

- `@nestjs/websockets` และ `@nestjs/platform-socket.io` ต้องใช้ major เดียวกับ `@nestjs/core`
- การเชื่อม socket ต้องตรวจ token ของ Core Hub ตอน handshake ด้วยตัวตรวจชุดเดียวกับ REST (`auth-contract.md` ข้อ 4 ครบ 10 ขั้น) — ห้ามเขียนตัวตรวจแยก
- token ที่ใช้ต่อ socket อยู่ใต้ `auth-contract.md` ข้อ 6.1 เหมือนกัน — ห้ามเก็บ ส่งต่อ หรือ log

### 1.5 ข้อยกเว้นของ Core Hub

`csmju-core-hub` **ไม่ใช่**ระบบย่อย จึงไม่อยู่ใต้กฎบางข้อ เพราะเป็นผู้ให้ identity เอง:

| กฎ | Core Hub |
|---|---|
| `SEC-04` ห้ามตรวจ/ออก JWT เอง | ยกเว้น — Core Hub เป็นผู้ออก token และถือกุญแจส่วนตัว |
| `SEC-05` ห้ามมีหน้า login | ยกเว้น — Core Hub คือหน้า login กลาง |
| health path | ใช้ `/api/v1/health` (มีเวอร์ชัน) ต่างจากระบบย่อยที่ใช้ `/api/health` |

---

## 2. นโยบาย Repository (1 ระบบย่อย = 1 Repo)

ตามแผนภาพรวมของโครงการ กำหนดให้ **แต่ละระบบย่อย = 1 repo แยก และมี AIE รับผิดชอบ 1 คนต่อ 1 ระบบย่อย** ดังนั้นโค้ดของระบบย่อยหนึ่งๆ จะรวมอยู่ใน Repository เดียวกัน โดยแบ่งโฟลเดอร์ให้ชัดเจน (ดูแนวทาง Git workflow แบบเจ้าของคนเดียวใน `github-workflow.md` ข้อ 1.4)

**ตัวอย่างโครงสร้าง (เช่น `csmju-equipment`):**
```text
csmju-<subsystem-name>/
├── .github/
│   └── workflows/                    # CI รัน automated compliance ทุกครั้งที่เปิด PR
├── frontend/                         # โค้ด Next.js
├── backend/                          # โค้ด NestJS
├── standards/                        # Git Submodule ดึงไฟล์มาตรฐาน (csmju2030-standards)
├── subsystem.yaml                    # manifest: name · callback · probes (เวอร์ชัน standards อยู่ใน .standards-version)
├── .standards-version                # เวอร์ชันมาตรฐานที่ผูกอยู่
└── docker-compose.yml
```

รายละเอียดโครงภายใน `backend/` และกฎ branch/commit ดู [`repo-structure.md`](repo-structure.md)

---

## 3. API Contract ระหว่าง Frontend–Backend

เพื่อไม่ให้ frontend/backend หลุดจากกันเมื่อพัฒนาคนละคน:

*   Backend (NestJS) ต้อง generate **OpenAPI/Swagger spec** อัตโนมัติจาก decorator (`@nestjs/swagger`) และ export เป็น `openapi.json` ไว้ใน repo
*   Frontend ห้ามเขียน type ของ API response เอง ให้ generate TypeScript type จาก `openapi.json` (เช่นด้วย `openapi-typescript`) เพื่อให้ type ตรงกับ backend เสมอ
*   ทุกครั้งที่ backend เปลี่ยน endpoint ต้องอัปเดต `openapi.json` ใน PR เดียวกัน — CI ตรวจว่าไฟล์นี้ sync กับโค้ดจริงก่อน merge

---

## 4. System Prompt สำหรับ AI (Tech Stack)

*สำหรับป้อนให้ AI Agent ก่อนเริ่มเขียนโค้ด เพื่อให้ AI ปฏิบัติตามมาตรฐานโปรเจกต์:*

```text
คุณคือ AI Assistant สำหรับเขียนโค้ดในโครงการ CSMJU2030 (1 ระบบย่อย = 1 Repo) กรุณาปฏิบัติตามกฎต่อไปนี้อย่างเคร่งครัด:

1. Tech Stack: 
   - Frontend: บังคับใช้ Next.js (App Router) เท่านั้น ห้ามใช้ Framework อื่น
   - Backend: บังคับใช้ NestJS และ PostgreSQL (ผ่าน Prisma) เท่านั้น
2. Database Isolation: 
   - โค้ดฝั่ง Frontend ห้ามมี Connection String หรือเชื่อมต่อ PostgreSQL ตรงเด็ดขาด
3. Git Submodule: 
   - รับทราบว่าโฟลเดอร์ `standards/` เป็น Submodule ห้าม AI แนะนำให้แก้ไขไฟล์ในนั้นเด็ดขาด
   - ห้ามแก้ไฟล์ใน standards/conformance/ และ standards/contracts/ เพื่อให้ผ่านการตรวจ
5. Authentication:
   - ระบบย่อยต้องตรวจ JWT เองผ่าน JWKS ของ Core Hub ด้วย jose (ยังไม่มี API Gateway)
   - ห้ามสร้าง login/register/refresh ของตัวเอง และห้ามใช้ HS256 หรือกุญแจฮาร์ดโค้ด
   - ให้คัดลอกชั้น auth จาก reference implementation ตาม ai/AGENTS.md ข้อ 2
4. API Contract:
   - เมื่อแก้ backend endpoint ต้องอัปเดต openapi.json ให้ตรงกับโค้ดเสมอ และฝั่ง frontend ต้องใช้ type ที่ generate จาก openapi.json นั้น ห้าม define type ของ API response เอง
```
