# การ deploy Core Hub บนเซิร์ฟเวอร์ (`https://csmju2030.jowave.com`)

เอกสารสำหรับทีม PL / AIE ที่รับช่วงต่อ — อ่านคู่กับ `~/README-KATIKA.md` บนเครื่อง (กติกาการใช้เครื่อง)
ค่าที่เป็นของเครื่อง (IP · uid · path) อยู่ใน `.env` บนเซิร์ฟเวอร์ ไม่อยู่ในเอกสารหรือไฟล์ตัวอย่าง

## 1. ภาพรวม

```text
Internet ──https──► Cloudflare ──► Apache (ของอาจารย์, TLS, :443)
                                     │ /api/v1/  → 127.0.0.1:${API_HOST_PORT} (3010)
                                     │ ที่เหลือ   → 127.0.0.1:${WEB_HOST_PORT} (3000)
                                     ▼
              ┌─ docker network "core" (private) ─────────────────────────┐
              │  core-web  Next.js 16   :3100 ── BACKEND_API_URL ──┐       │
              │                                                    ▼       │
              │  core-api  NestJS 11    :3000  ◄── /api/v1/ จาก Apache      │
              │      │ DATABASE_URL                                         │
              │      ▼                                                      │
              │  core-db   PostgreSQL 16 :5432  (ไม่เปิดออก host)           │
              └───────────────────────────────────────────────────────────┘
```

- เบราว์เซอร์คุยกับ `core-web` · token อยู่ใน httpOnly cookie ไม่เคยถึง JavaScript ฝั่ง client
- `core-api` เปิดพอร์ตที่ **loopback เท่านั้น** ให้ Apache ส่ง `/api/v1/` เข้ามา — backend ของระบบย่อยเรียก JWKS,
  login และข้อมูลกลางที่นี่ · เบราว์เซอร์ไม่เรียก API ตรง (CORS ปิด)
- `core-db` **ไม่มีพอร์ตออก host** — เข้าถึงได้จากใน docker network เท่านั้น
- กุญแจ RS256 อยู่ที่ `./secrets/` ข้าง `compose.yml` (chmod 600) mount แบบ read-only ไม่อยู่ใน image และไม่อยู่ใน git

## 2. ไฟล์บนเซิร์ฟเวอร์

| path | คืออะไร |
|---|---|
| `$REPO_DIR` (เช่น `~/projects/csmju-core-hub`) | โค้ด — branch **`develop`** |
| `~/docker/core-hub/compose.yml` | compose ที่ใช้จริง — คัดลอกจาก `deploy/compose.example.yml` |
| `~/docker/core-hub/.env` | ค่าทั้งหมดของ stack นี้ — คัดลอกจาก `deploy/.env.example` (chmod 600) |
| `~/docker/core-hub/secrets/jwt-*.pem` | คู่กุญแจเซ็น token (chmod 600 · เจ้าของคือบัญชี deploy) |
| `~/docker/core-hub/uploads/` | ไฟล์รูปที่อัปโหลด — เจ้าของคือบัญชี deploy · สำรองพร้อมฐานข้อมูล |
| `~/docker/core-hub/CREDENTIALS.md` | บัญชีทดสอบ (chmod 600) |

ตั้งครั้งแรก:

```bash
cd ~/docker/core-hub
cp "$REPO_DIR/deploy/compose.example.yml" compose.yml
cp "$REPO_DIR/deploy/.env.example" .env && chmod 600 .env    # แล้วแก้ทุกค่าที่เป็น <…>
mkdir -p secrets uploads && chmod 700 secrets uploads
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out secrets/jwt-private.pem
openssl rsa -in secrets/jwt-private.pem -pubout -out secrets/jwt-public.pem
chmod 600 secrets/*.pem
```

`DEPLOY_UID` ใน `.env` ต้องเป็น uid ของบัญชีที่เป็นเจ้าของ `secrets/` และ `uploads/` (`id -u`) — container ทั้งสองรันด้วย uid นี้

## 3. คำสั่งประจำวัน

```bash
cd ~/docker/core-hub
docker compose ps                         # สถานะ + healthcheck
docker compose logs -f core-api           # log ของ API (หรือ core-web / core-db)
docker compose restart core-web           # restart ตัวเดียว
docker compose down                       # หยุดทั้งหมด (ข้อมูล DB อยู่ใน volume ไม่หาย)
```

อัปเดตโค้ด:

```bash
cd "$REPO_DIR" && git fetch origin && git checkout develop && git pull
cd ~/docker/core-hub
nice -n 15 docker compose build core-api      # ทีละ image, ลด priority
nice -n 15 docker compose build core-web
docker compose up -d                          # สลับ container หลัง build เสร็จทั้งคู่
```

**การ build ใช้ RAM มาก (เครื่องมี 2 GB) — เมื่อ 28/09/2026 เครื่องถูก reboot ระหว่าง build**

- ห้ามใช้ `up -d --build` แบบ build สองตัวพร้อมกัน และอย่ารันงานหนักอื่นระหว่าง build
- ตรวจก่อน build ว่ามี RAM ว่าง ≥ 700 MB (`free -m` ช่อง available)
- ทางที่ปลอดภัยกว่าในระยะยาว: build image บนเครื่องอื่นแล้วส่งเข้า registry **ส่วนตัว** ให้เซิร์ฟเวอร์แค่ `docker compose pull && up -d`
  — **ห้าม push image ขึ้น registry สาธารณะ** (ดูข้อ 6)

## 4. ตอนสตาร์ต `core-api` ทำอะไร (`deploy/backend-entrypoint.sh`)

1. ตรวจว่ามีคู่กุญแจ RSA ถ้าไม่มี **หยุดทันที**
2. `prisma migrate deploy` — migration ทุกตัวใน `backend/prisma/migrations/` (ห้ามลบ/squash)
3. `node dist/prisma/seed.js` — upsert roles / permissions
   - production **ไม่ลงทะเบียนระบบย่อยใด ๆ** — ทะเบียนเป็นของหลังบ้าน · ถ้ามีแถว `student-service` จาก seed รุ่นเก่า ให้ปิดใช้งานในหลังบ้าน
   - production **ไม่สร้างบัญชีทดสอบ** (`student|staff|alumni@core.local`) และ**ไม่สร้างประกาศตัวอย่าง** · ไม่แก้และไม่สร้างคืนบัญชีที่มีอยู่ — ลบแล้วไม่กลับมา
   - ยกเว้นฐานที่**ยังไม่มี admin สักคน** (สตาร์ตครั้งแรก) จะได้ admin ตั้งต้น `admin@core.local` รหัสจาก `SEED_ADMIN_PASSWORD` (≥ 12 ตัวอักษร) — สร้างบัญชี admin จริงแล้วลบบัญชีนี้ได้
   - ไม่ทับรหัสผ่านที่มีอยู่ (ตั้ง `SEED_RESET_PASSWORDS=true` ถ้าต้องการรีเซ็ต)
4. `node dist/src/main.js`

## 5. Reverse proxy (Apache)

Apache ส่ง `/api/v1/` ไป API และที่เหลือไปหน้าเว็บ ตัวอย่าง (ปรับพอร์ตตาม `.env`):

```apache
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto "https"
# รูป: POST /api/v1/images รับได้ถึง 10 MB ต่อไฟล์
LimitRequestBody 11534336

ProxyPass        /api/v1/ http://127.0.0.1:3010/api/v1/
ProxyPassReverse /api/v1/ http://127.0.0.1:3010/api/v1/
ProxyPass        /        http://127.0.0.1:3000/
ProxyPassReverse /        http://127.0.0.1:3000/
```

- `ProxyPass` ของ `/api/v1/` ต้องมาก่อน `/`
- `GET /api/v1/images/:id/file` ต้องผ่านได้โดยไม่ login (`<img>` แนบ token ไม่ได้) และห้าม cache นานกว่า 1 วัน
- **IP จริงของผู้ใช้:** API ใช้ `request.ip` ที่ Express คำนวณจาก `X-Forwarded-For` เฉพาะ hop ที่ `TRUST_PROXY` เชื่อ
  (ค่าปกติ `loopback, uniquelocal` = Apache บน host และ `core-web`) · โค้ดไม่อ่าน `X-Forwarded-For` หรือ `CF-Connecting-IP` เอง ·
  ถ้าไม่ตั้ง `TRUST_PROXY` ทุกคนจะเป็น IP ของ proxy แล้วใช้ถัง rate limit ร่วมกันทั้งมหาวิทยาลัย
- ตรวจ: `curl -s https://<domain>/api/v1/health` ได้ `"environment":"production"` · `…/api/v1/.well-known/jwks.json` ได้ `200`

## 6. ข้อมูลกลาง (`master-data.sql`)

`backend/prisma/data/master-data.sql` มี**ข้อมูลบุคคลจริง** — อยู่ใน checkout บนเซิร์ฟเวอร์เท่านั้น
`.dockerignore` กันไม่ให้เข้า image · ห้ามส่งไฟล์นี้ dump หรือ `.env` ให้ทีมใด — ทีมใช้ข้อมูลกลางผ่าน API

โหลดหรืออัปเดต (รันซ้ำได้ ทุกคำสั่งเป็น upsert · ไม่แตะบัญชีที่ผูกกับบุคคลไว้แล้ว) — หลัง `core-api` สตาร์ตครั้งแรก (migration ต้องเสร็จก่อน):

```bash
cd ~/docker/core-hub
set -a; . ./.env; set +a
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" core-db \
  psql -v ON_ERROR_STOP=1 --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  < "$REPO_DIR/backend/prisma/data/master-data.sql"
```

ตรวจ: login แล้ว `GET /api/v1/rooms` ต้องได้ `meta.total` มากกว่า 0 · ข้อมูลบุคคลรอบถัดไปนำเข้าผ่านหลังบ้าน (CSV)

## 7. โหมดก่อนเปิดใช้ (`ALLOW_LOCALHOST_CALLBACKS`)

ช่วงก่อนเปิดใช้ เซิร์ฟเวอร์นี้เป็น dev server ของทีม AIE ด้วย: ทีมรันระบบย่อยบนเครื่องตัวเอง แล้วลงทะเบียน callback
`http://localhost:<พอร์ต>/auth/callback` — เซิร์ฟเวอร์สั่ง**เบราว์เซอร์**ไปที่ localhost ของคนที่กด ไม่ต้องเห็นเครื่องของทีม

| `.env` | ผล |
|---|---|
| `ALLOW_LOCALHOST_CALLBACKS=true` | ลงทะเบียน callback/base URL `http://localhost` (`127.0.0.1` · `[::1]`) ได้ และ SSO พาไปได้ · API log เตือนทุกครั้งที่สตาร์ต |
| `false` หรือค่าอื่น | ลงทะเบียน `http://` ได้ `400` · SSO ไป callback `http://` ที่ลงทะเบียนไว้ได้ `409` **ทันที** ไม่ต้องไล่ปิดทีละระบบ |

- เปิด: แก้ `.env` แล้ว `docker compose up -d core-api` (ไม่ต้อง build)
- **ไม่ใช้ `API_NODE_ENV=development` แทน flag** — โหมดนั้นทำให้ seed ยอมใช้รหัสตัวอย่างใน README เมื่อ `SEED_*_PASSWORD` สั้นหรือหาย
  `API_NODE_ENV` มีไว้สำหรับทางสำรองที่ PL สั่งเท่านั้น
- **ก่อนเปิดใช้จริง:** ตั้ง `false` · ปิดใช้งานหรือให้ทีมแก้ระบบที่ลงทะเบียน `http://localhost` เป็น `https://` · ลบหรือเปลี่ยนรหัสบัญชีทดสอบของทีม
- Monitor ในหลังบ้านขึ้น DOWN สำหรับระบบบน localhost ของทีม — ปกติ เพราะ server probe `localhost` ของตัวเอง

## 8. รันชุดที่สองบนเครื่องเดียวกัน (เช่น dev server แยกจาก production)

ใช้ไฟล์ deploy ชุดเดียวกัน แต่แยกทุกอย่างที่เป็นของ stack:

1. โฟลเดอร์ใหม่ เช่น `~/docker/core-hub-dev/` พร้อม `compose.yml` · `.env` · `secrets/` · `uploads/` ของตัวเอง
2. `.env`: `COMPOSE_PROJECT_NAME` ใหม่ (เช่น `csmju-core-hub-dev`) · `WEB_HOST_PORT` / `API_HOST_PORT` ที่ไม่ชนกับชุดแรก ·
   `POSTGRES_PASSWORD` และ `SEED_*_PASSWORD` ใหม่ · `PUBLIC_URL` ของโดเมนนั้น
3. **กุญแจ JWT คู่ใหม่** — ห้ามใช้คู่ของ production (token ของชุดหนึ่งจะใช้กับอีกชุดได้)
4. `REPO_DIR` ชี้ checkout เดียวกันหรือแยกก็ได้ · image ได้ชื่อ `<project>/api` และ `<project>/web` จึงไม่ทับกัน ·
   ฐานข้อมูลเป็น volume `<project>_core-hub-db-data` แยกกัน
5. reverse proxy ของโดเมนนั้นชี้ไปพอร์ตของชุดที่สอง · MJU SSO ใช้ได้เฉพาะโดเมนที่ลงทะเบียน callback กับมหาวิทยาลัยไว้

## 9. สิ่งที่ hardening ไว้แล้ว (บน `develop`)

| เรื่อง | ทำอะไร | ไฟล์ |
|---|---|---|
| IP จริงของผู้เรียก | `TRUST_PROXY` → Express `trust proxy` · rate limit ใช้ `request.ip` เท่านั้น ไม่อ่าน header เอง | `backend/src/main.ts`, `backend/src/common/rate-limit/client-ip.ts` |
| Rate limit 2 ชั้น | ต่อ IP 600/10 วินาที · 3000/นาที (ทั้งห้องแล็บออกเน็ต IP เดียว) · ต่อผู้ใช้ 100/10 วินาที · 600/นาที · login 60/นาที/IP · refresh 120/นาที/IP · อัปโหลดรูป 60/นาที/IP — ปรับได้ด้วย `RATE_LIMIT_*` | `backend/src/common/rate-limit/`, `backend/src/config/configuration.ts` |
| Brute force รายบัญชี | ผิด 10 ครั้งใน 15 นาที → อีเมลนั้นได้ 429 จนครบเวลา ไม่ว่ามาจาก IP ไหน · นับใน memory ของ process | `backend/src/modules/auth/auth.service.ts` |
| รหัสผ่าน seed ที่รู้กันทั่ว (`password1`) | production ต้องตั้งผ่าน env, seed ซ้ำไม่ทับรหัส | `backend/prisma/seed.ts` |
| CORS เปิดทุก origin พร้อม credentials | ปิดโดยปริยาย เปิดได้ด้วย `CORS_ORIGINS` แบบระบุ origin | `backend/src/main.ts` |
| Fingerprint header | ปิด `X-Powered-By` ทั้งสองฝั่ง | `main.ts`, `next.config.ts` |
| Clickjacking / MIME sniffing | `X-Frame-Options: DENY`, `CSP frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | `frontend/next.config.ts` |
| Container | non-root, `read_only` fs, `cap_drop ALL`, `no-new-privileges`, mem limit, log rotation, DB ไม่เปิดพอร์ต, API/เว็บเปิดแค่ loopback, scram-sha-256 | `deploy/*.Dockerfile`, `compose.yml` |
| MJU SSO | แลก code ฝั่ง server, ไม่เก็บเลขบัตรประชาชน (HMAC), ไม่ให้ admin อัตโนมัติ — รายละเอียด `backend/README.md` §5.7 | `backend/src/modules/auth/mju-sso/`, `frontend/app/auth/mju/` |
| Secrets และข้อมูลบุคคล | ไม่มีใน image / git — `.env` `secrets/` chmod 600 · `.dockerignore` กัน `.env` `*.pem` `keys/` และ `backend/prisma/data/` | `.dockerignore` |

สิ่งที่โค้ดทำดีอยู่แล้วและ **ห้ามถอย**: bcrypt hash, refresh token rotation + reuse detection, ตรวจ session ทุก request,
callback_url ต้องตรงเป๊ะ (กัน open redirect), ตรวจรูปจาก magic bytes, ValidationPipe `whitelist + forbidNonWhitelisted`, ไม่คืน stack trace

## 10. งานด้านความปลอดภัยที่ยังค้าง (เรียงตามความสำคัญ)

1. **Content-Security-Policy เต็มรูปแบบ** — ตอนนี้มีแค่ `frame-ancestors` เพราะ Next ต้องใช้ nonce สำหรับ inline script
2. **HSTS** — ต้องตั้งที่ Apache (`Header always set Strict-Transport-Security "max-age=31536000"`) เพราะ TLS จบที่นั่น
3. **Origin ยิงตรงได้** — เข้าเครื่องได้โดยไม่ผ่าน Cloudflare · ขออาจารย์จำกัดพอร์ต 80/443 ให้รับเฉพาะ [Cloudflare IP ranges](https://www.cloudflare.com/ips/)
4. **IP ที่ rate limit เห็นเมื่ออยู่หลัง Cloudflare** — `TRUST_PROXY` ค่าปกติเชื่อแค่ hop ภายใน IP ที่ API เห็นจึงเป็น IP ของ Cloudflare edge
   ไม่ใช่ของผู้ใช้ · ถ้า rate limit ต่อ IP แน่นเกินให้พิจารณาเพิ่มช่วง IP ของ Cloudflare ใน `TRUST_PROXY` **หลัง**ปิดข้อ 3 แล้วเท่านั้น
5. **`aud` เป็นค่าเดียวทุก subsystem** และ **handoff ส่ง token ทาง URL query** — ข้อจำกัดที่รู้อยู่แล้วใน `backend/README.md` §11
6. **บัญชี `*@core.local` และบัญชีทดสอบของทีม** — ก่อนเปิดใช้จริงให้ลบหรือเปลี่ยนรหัส
7. **Backup** — ยังไม่มี cron: ฐานข้อมูล (`pg_dump`) และโฟลเดอร์ `uploads/` ต้องสำรองพร้อมกัน
8. **Dependency audit เป็นประจำ** — `pnpm audit` ทั้ง workspace

## 11. Troubleshooting

| อาการ | ดูที่ |
|---|---|
| `core-api` วนรีสตาร์ต "RSA key pair not found" | `ls -la secrets/` ต้องมี 2 ไฟล์ และ `DEPLOY_UID` ต้องตรง uid เจ้าของไฟล์ (`id -u`) |
| `SEED_ADMIN_PASSWORD must be set` | ฐานยังไม่มี admin (สตาร์ตครั้งแรก) แต่ `.env` ขาดค่า หรือสั้นกว่า 12 ตัวอักษร |
| `docker compose` บอก `set … in .env` | ค่าบังคับใน `.env` ขาด (`REPO_DIR` · `DEPLOY_UID` · `PUBLIC_URL` · รหัสต่าง ๆ) |
| หน้าเว็บขึ้น 503 จาก Apache | `docker compose ps` — `core-web` ต้อง `healthy` และพอร์ต host ต้องตรง `WEB_HOST_PORT` |
| `/api/v1/…` จากภายนอกได้ 404/503 | Apache ต้องมี `ProxyPass /api/v1/` ไป `API_HOST_PORT` ก่อน `ProxyPass /` |
| อัปโหลดรูปได้ 500 | `uploads/` ต้องมีอยู่และเจ้าของเป็น `DEPLOY_UID` · ไฟล์ใหญ่ได้ 413 จาก Apache → `LimitRequestBody` |
| URL รูปขึ้นต้นด้วย host ภายใน | `PUBLIC_URL` ใน `.env` |
| login ได้ 429 | IP นั้น login เกิน 60 ครั้ง/นาที หรืออีเมลนั้นผิด 10 ครั้งใน 15 นาที — รอตาม `Retry-After` |
| ลงทะเบียน callback `http://localhost` ไม่ได้ | `ALLOW_LOCALHOST_CALLBACKS` ไม่ใช่ `true` (ข้อ 7) |
| เข้า Postgres (local auth ก็ต้องใช้รหัส) | `docker compose exec -e PGPASSWORD="$(grep ^POSTGRES_PASSWORD .env \| cut -d= -f2)" core-db psql -U core_hub core_hub` |
