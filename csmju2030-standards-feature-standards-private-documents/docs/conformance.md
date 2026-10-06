# Conformance — เกณฑ์ตัดสินว่าผ่านหรือไม่

**เวอร์ชัน 1.2** (standards 1.7.0)

> การตรวจมี 2 ชั้น: **CI (static)** ตรวจซอร์สโค้ด · **conformance (runtime)** ยิงระบบที่รันอยู่จริง
> ระบบย่อยต้องผ่าน **ทั้งสองชั้น**
> ขั้นตอนเชื่อมระบบกับ Core Hub จริง (URL · บัญชี · ลงทะเบียน · `.env` · พอร์ต) อยู่ใน [`connect-core-hub.md`](connect-core-hub.md)

---

## 1. ระดับ (Level)

| Level | ครอบคลุม | เคส |
|---|---|---|
| **L1 — Identity** | `/api/health` · ไม่มี login ของตัวเอง · `/api/v1/me` · ตรวจ token ตาม [auth-contract](auth-contract.md) ข้อ 4 (ขั้น 1–8 · ขั้น 9–10 ให้ทดสอบด้วย unit test ของระบบย่อยเอง) · 401 ทุกกรณีลบ · role mapping ของทุก role ที่มีบัญชี · ไม่รั่วข้อมูลภายใน | ~32 |
| **L2 — Contract** | L1 + response envelope · error code · pagination · 400/403/404 · unknown route | ~47 |
| **L3 — SSO** | L2 + ทะเบียนถูกต้อง · sign-in เริ่มที่ `/auth/login` · callback 3 แบบตาม state · session cookie · ปฏิเสธ token ปลอม · กัน login CSRF และ open redirect · logout | ~69 |

ระบบย่อยที่มี UI **ต้องถึง L3** · ระบบที่เป็น API อย่างเดียวอย่างน้อย **L2**

จำนวนจริงขึ้นกับบัญชีที่ login ได้ (L1-28 นับแยกต่อ role · L1-29 เฉพาะ role ที่ถูกปฏิเสธ) ให้ยึดตัวเลขจากผลรัน

runner ทดสอบขั้น 9–10 (อายุ token · `azp`) ไม่ได้ เพราะไม่มี token ที่ Core Hub เซ็นแบบอายุยาวหรือมี `azp` —
unit test ของตัวตรวจ token ในระบบย่อยต้องครอบคลุมสองขั้นนี้เอง

### รายการ L3

L3 เล่นบทเว็บของ Core Hub เอง: เริ่มที่ `/auth/login` ของระบบย่อย → อ่าน `state` จาก `Location`
และคุกกี้ `<ชื่อ>_sso_state` → เรียก `sso/authorize` ของ API ด้วย Bearer และ state แบบที่เว็บ Core Hub
ทำด้วยคุกกี้ของตัวเอง → เรียก callback พร้อมคุกกี้ state · token ที่ใช้คือของ role แรกใน `defaultRoleMapping`
ที่มีบัญชี (ไม่มีเลย = L3-06 ขึ้น SKIP)

| ข้อ | ตรวจอะไร |
|---|---|
| L3-01 – L3-05 | ลงทะเบียนแล้ว · `APPROVED` · `ACTIVE` · `callback_url` ตรงกับ `base_url` + `callback_path` · มี `defaultRoleMapping` |
| L3-06 · L3-07 | `sso/authorize` (ส่ง state) → 302 ไป callback ที่ลงทะเบียน และส่ง state กลับมาตรงตัว |
| L3-08 | callback ที่ state ตรงกับคุกกี้ → 302 |
| L3-09 | ได้คุกกี้ `<ชื่อ>_access_token` แบบ `HttpOnly` (หาตามชื่อ ไม่ใช่คุกกี้ตัวแรก) |
| L3-10 · L3-11 | คุกกี้อย่างเดียวเรียก `/api/v1/me` ได้ และได้ `sub` ตรงกับ token |
| L3-12 · L3-13 | token ปลอม (ส่ง state และคุกกี้ที่ถูกต้องไปด้วย เพื่อให้ถึงขั้นตรวจ token) → 401 และไม่มีคุกกี้ session |
| L3-14 | callback ที่ไม่มี token → 400 หรือ 401 |
| L3-15 | Core Hub ปฏิเสธ `callback_url` ที่ไม่ตรงทะเบียน → 400 |
| L3-16 | `/auth/login` → 302 ไป `{core_hub_web_url}/sso/authorize` ที่มี `subsystem` และ `state` · ไม่ส่ง `callback_url` |
| L3-17 | `/auth/login` ตั้งคุกกี้ `<ชื่อ>_sso_state` แบบ `HttpOnly` อายุไม่เกิน 600 วินาที |
| L3-18 | callback ที่ token ถูกแต่ไม่มี state (แบบกดจาก sidebar) → 302 ไป `/auth/login` และไม่มีคุกกี้ session |
| L3-19 | callback ที่มี state แต่ไม่ส่งคุกกี้ state → 401 และไม่มีคุกกี้ session |
| L3-20 | state จาก `/auth/login` รอบหนึ่งกับคุกกี้ของอีกรอบ → 401 |
| L3-21 | flow ครบด้วย `next=//evil.example.com` แล้ว `Location` สุดท้ายต้องอยู่ใน origin ของระบบย่อย |
| L3-22 | `POST /auth/logout` → 303 ไป `{core_hub_web_url}/logout` และคุกกี้ session ถูกตั้ง `Max-Age=0` |

L3-01 – L3-05 อ่านทะเบียนด้วยบัญชี `admin` ถ้ามี (`GET /api/v1/subsystems/all`) ไม่งั้นด้วยบัญชี `owner`
ผ่านรายการของเจ้าของ `GET /api/v1/subsystems?q=<name>&limit=100` ซึ่งเห็นเฉพาะระบบที่บัญชีนั้นลงทะเบียน
ไม่มีทั้งสองบัญชี = L3-01 ขึ้น SKIP

L3-16 และ L3-22 ต้องใช้ `core_hub_web_url` ใน `subsystem.yaml` (หรือ `--core-hub-web`) ถ้าไม่มีจะตกทั้งสองข้อ
โดย L3-16 แจ้งว่า "manifest ไม่มี core_hub_web_url"

---

## 2. วิธีรัน

ต้องมีระบบย่อยของตัวเองรันอยู่ และ Core Hub API ที่ runner เรียกถึง (server จริง หรือ Core Hub ในเครื่อง) ·
runner **ไม่เรียกเว็บของ Core Hub** — `core_hub_web_url` ใช้เทียบกับ `Location` ของ `/auth/login` และ `/auth/logout` เท่านั้น

```bash
# จากรากของ repo ระบบย่อย (มี subsystem.yaml อยู่) · ไฟล์บัญชีตามข้อ 2.1
export CONFORMANCE_ACCOUNTS_FILE=~/.csmju/conformance-accounts.json
node standards/conformance/run.js

# ระบุ manifest หรือ override ค่าได้
node standards/conformance/run.js --manifest subsystem.yaml --level L2
node standards/conformance/run.js --url http://localhost:3205 --subsystem csmju-equipment --level L1
node standards/conformance/run.js --core-hub-web http://localhost:3100

# ออกรายงาน JSON สำหรับ CI
node standards/conformance/run.js --json      # → conformance-report.json
```

Windows PowerShell: `$env:CONFORMANCE_ACCOUNTS_FILE = "$HOME\.csmju\conformance-accounts.json"`

### 2.1 บัญชีทดสอบ (`CONFORMANCE_ACCOUNTS_FILE`)

runner ไม่อ่านบัญชีจาก `subsystem.yaml` แล้ว — บัญชีอยู่ในไฟล์ JSON **นอก repo** ที่ env `CONFORMANCE_ACCOUNTS_FILE` ชี้

| สถานการณ์ | runner ทำอะไร |
|---|---|
| ตั้ง `CONFORMANCE_ACCOUNTS_FILE` | ใช้บัญชีในไฟล์เท่านั้น (ไม่ผสมกับบัญชี seed) |
| ไม่ตั้ง + `core_hub_url` เป็น `localhost` · `127.0.0.1` · `[::1]` | ใช้บัญชี seed ของ Core Hub ในเครื่อง (`admin\|student\|staff\|alumni@core.local`) |
| ไม่ตั้ง + Core Hub อื่น (เช่น server จริง) | **หยุดก่อน login บัญชีใด ๆ** — "ไม่ได้ตั้ง CONFORMANCE_ACCOUNTS_FILE …" (exit 2) |
| `subsystem.yaml` มี `test_accounts` | หยุดทันที (exit 2) — รหัสผ่านต้องไม่อยู่ใน repo ลบคีย์นี้ออก ถ้าเคย commit รหัสจริงให้แจ้งผู้ดูแลเปลี่ยนรหัส |

รูปแบบไฟล์ — คีย์คือ `owner` และ core role (`admin` `student` `staff` `alumni` `lecturer` `guest`) · คีย์อื่นทำให้หยุด:

```json
{
  "owner":    { "email": "<บัญชีเจ้าของระบบของทีม>", "password": "…" },
  "staff":    { "email": "<บัญชีทดสอบ role staff>", "password": "…" },
  "lecturer": { "email": "<บัญชีทดสอบ role lecturer>", "password": "…" },
  "alumni":   { "email": "<บัญชีทดสอบ role alumni>", "password": "…" },
  "guest":    { "email": "<บัญชีทดสอบ role guest>", "password": "…" }
}
```

```bash
mkdir -p ~/.csmju && chmod 700 ~/.csmju
# สร้างไฟล์ด้วย editor แล้ว
chmod 600 ~/.csmju/conformance-accounts.json
```

- **ไฟล์ต้องอยู่นอก repo** — ไฟล์ใน work tree ของ repo ระบบย่อย (รวม `standards/`) ถูกปฏิเสธแม้อยู่ใน `.gitignore` ·
  ถ้าผู้ใช้อื่นอ่านไฟล์ได้ runner จะเตือนให้ `chmod 600` · รหัสผ่านรับทางข้อความส่วนตัวเท่านั้น ([`connect-core-hub.md`](connect-core-hub.md) ข้อ 2)
- `owner` คือบัญชีที่ลงทะเบียนระบบ (บัญชีเจ้าของระบบของทีม · role staff) ใช้อ่านทะเบียนใน L3-01 – L3-05
  เมื่อไม่มี `admin` — ทีมระบบย่อยไม่มีบัญชี admin จึงต้องใส่ `owner` เสมอเมื่อรัน L3
- role ที่ไม่มีบัญชี = เคสที่ต้องใช้ role นั้นขึ้น SKIP (เช่น `probes.create.denied_role`) · L1-28 ตรวจเฉพาะ role ที่มีบัญชี
- บัญชีที่อยู่ในไฟล์แต่ login ไม่ผ่าน หรือได้ token คนละ role กับคีย์ → `login failed` ตอนเริ่ม และ `L1-28.<role>` ขึ้น SKIP
- อีเมลเดียวใช้ได้หลายคีย์ (เช่น `owner` กับ `staff`) — login ครั้งเดียว แต่รหัสต้องตรงกัน

> **⚠️ login ครั้งเดียวต่อบัญชีต่อการรัน และไม่ลองซ้ำ** เมื่อได้ 401 · 403 · 429 (ไม่ตาม redirect ด้วย) —
> Core Hub ล็อกอีเมลหลังรหัสผิด 10 ครั้งใน 15 นาที และบัญชี `csmju.*` ใช้ร่วมกันทุกทีม
> รันซ้ำด้วยรหัสผิดไม่กี่รอบ = บัญชีนั้นล็อกทั้งโครงการ · เห็น `login failed` ให้แก้ไฟล์ก่อนรันใหม่ทุกครั้ง

### 2.2 รันกับ Core Hub จริง (https://csmju2030.jowave.com)

ก่อนรัน: ระบบลงทะเบียนแล้วและ admin อนุมัติ + เปิดใช้งานแล้ว (`APPROVED` + `ACTIVE`) · Callback URL คือ
`http://localhost:<พอร์ต frontend>/auth/callback` · รัน frontend และ backend ของทีมอยู่ (ขั้นตอนทั้งหมดใน [`connect-core-hub.md`](connect-core-hub.md) ข้อ 3–5)

```yaml
# subsystem.yaml — ส่วนที่ต่างจากการรันกับ Core Hub ในเครื่อง
base_url: http://localhost:3205                  # พอร์ต frontend ของทีม (32xx) ไม่ใช่ backend · localhost ไม่ใช่ 127.0.0.1
core_hub_url: https://csmju2030.jowave.com
core_hub_web_url: https://csmju2030.jowave.com
probes:
  create:
    denied_role: guest                           # ต้องเป็น role ที่มีบัญชีรหัสผ่าน (guest หรือ alumni)
```

```bash
CONFORMANCE_ACCOUNTS_FILE=~/.csmju/conformance-accounts.json node standards/conformance/run.js
```

| | Core Hub ในเครื่อง | Core Hub จริง |
|---|---|---|
| บัญชี | seed อัตโนมัติ (ไม่ต้องมีไฟล์) | ไฟล์บัญชี **บังคับ** · `owner` + `staff` `lecturer` `alumni` `guest` |
| อ่านทะเบียน (L3-01 – L3-05) | `admin` → `GET /api/v1/subsystems/all` | `owner` → `GET /api/v1/subsystems?q=<name>` |
| `student` | `student@core.local` | ไม่มีบัญชีรหัสผ่าน (นักศึกษาเข้าด้วย MJU SSO เท่านั้น) — ไม่ต้องใส่ในไฟล์ · `denied_role` ใช้ `guest` หรือ `alumni` |

- Core Hub ไม่ต้องเข้าถึงเครื่องของทีม: `sso/authorize` ตอบ 302 ไป callback บน `localhost` แล้ว runner เรียกต่อเองจากเครื่องที่รัน
  (ได้เฉพาะช่วงก่อนเปิดใช้ — ดู [`connect-core-hub.md`](connect-core-hub.md) ข้อ 9)
- ผลที่ต้องได้เหมือนกัน: `0 failed · 0 skipped` และ `✅ CONFORMANT`

---

## 3. กฎการนับผล

- **0 failed และ 0 skipped** เท่านั้นจึงถือว่าผ่าน
- **SKIP = ไม่ผ่าน** — เคสที่ไม่ได้ทดสอบนับว่าผ่านไม่ได้ runner พิมพ์ `❌ NOT CONFORMANT` พร้อมรายการเคสที่ SKIP และเหตุผล
  แล้วจบด้วย exit 1 · สาเหตุที่พบบ่อย: `probes` ใน `subsystem.yaml` ประกาศไม่ครบ · ไม่มีบัญชีของ role ที่ต้องใช้ · login ไม่ผ่าน
- **WARN ไม่ทำให้ตก** แต่ต้องอ่าน:
  - `W-RETRY` — มีคำขอโดน `429` แล้ว runner รอตาม `Retry-After` (ไม่เกิน 5 วินาที) และลองใหม่ 1 ครั้ง (ยกเว้น login ที่ไม่ลองซ้ำเลย)
    บรรทัดสรุปแสดง `retries: N` · ค่า rate limit แบบ default ของระบบย่อยต้องผ่านได้โดย `retries: 0`
    **ห้ามผ่อนค่า rate limit เพื่อให้ผ่าน**
  - `W-CODE` — มี error response ที่ `error.code` ไม่อยู่ใน `contracts/error-codes.json`
    **เวอร์ชันถัดไปจะเปลี่ยนเป็น FAIL**
- ถ้าเชื่อว่าเคสใดผิดที่ตัว conformance เอง **ห้ามแก้ไฟล์ใน `standards/`** ให้บันทึกใน `REPORT.md` แล้วแจ้ง PL

| exit | ความหมาย |
|---|---|
| `0` | `✅ CONFORMANT` — 0 failed · 0 skipped |
| `1` | `❌ NOT CONFORMANT` — มี FAIL หรือ SKIP |
| `2` | รันไม่ได้ — manifest หรือไฟล์บัญชีผิด · ไม่มีบัญชีสำหรับ Core Hub นอกเครื่อง · ต่อระบบย่อยไม่ได้ · ไม่ได้ token ของ role ใดเลย |

ผลที่ต้องได้:

```text
RESULT: 69 passed · 0 failed · 0 skipped · 0 warnings · retries: 0
✅ CONFORMANT — csmju-equipment meets standard v1.2 L3
```

ตัวอย่างที่ไม่ผ่านเพราะ SKIP:

```text
RESULT: 68 passed · 0 failed · 1 skipped · 0 warnings · retries: 0
❌ NOT CONFORMANT — 1 check(s) skipped (SKIP ไม่นับว่าผ่าน)
   SKIP L2-12      denied write → 403
              → no token for the denied role "student" - add that account to CONFORMANCE_ACCOUNTS_FILE, or set probes.create.denied_role to a role that has one (guest or alumni on the real Core Hub)
```

---

## 4. runner ทำงานอย่างไร

- ยิงผ่าน HTTP อย่างเดียว (black-box) ไม่อ่านโค้ดภายใน
- ใช้ Node.js 20+ **ไม่มี dependency** จึงรันได้ทุกเครื่องและทุก stack
- login เข้า Core Hub (`POST /api/v1/auth/login`) ด้วยบัญชีตามข้อ 2.1 เพื่อขอ token จริง — บัญชีละครั้ง ไม่ลองซ้ำ ไม่ตาม redirect
- token ด้านลบ (หมดอายุ · iss/aud ผิด · kid ไม่รู้จัก · HS256 · alg=none · payload ถูกแก้) สร้างจาก
  **คู่กุญแจชั่วคราวที่ runner สร้างเอง** — ไม่ต้องใช้และไม่มีวันเห็นกุญแจส่วนตัวของ Core Hub
- อ่าน `Set-Cookie` ทุกตัว (callback ของ 1.1 ตั้ง 2 คุกกี้: ลบ state และตั้ง session) แล้วหาตามชื่อ
- ไม่พิมพ์รหัสผ่านหรือ token — `Location` ที่มี token ถูกตัดเป็น `access_token=<token>` · ค่าคุกกี้ในรายละเอียดเคสเป็น `<value>` ·
  ไฟล์บัญชีที่อ่าน JSON ไม่ได้ก็ไม่แสดงเนื้อหา

---

## 5. ความสัมพันธ์กับ CI

| | ตรวจอะไร | รันเมื่อไร |
|---|---|---|
| CI 8 jobs (`scripts/`) | ซอร์สโค้ด: naming · dependency · secret · commit · openapi sync | **ทุก PR** |
| conformance (`conformance/`) | พฤติกรรมจริงผ่าน HTTP | **nightly + ก่อน release** (ต้องมีระบบรันอยู่) |

CI ตรวจว่า "เขียนถูกกฎ" · conformance ตรวจว่า "ทำงานได้จริงตามสัญญา" — ผ่านอย่างเดียวไม่พอ

workflow `conformance-nightly.yml` รับบัญชีจาก secret `CONFORMANCE_ACCOUNTS_JSON` (เนื้อหาไฟล์ข้อ 2.1) แล้วเขียนลง
`$RUNNER_TEMP` ซึ่งอยู่นอก repo · ไม่ตั้ง secret ใช้ได้เฉพาะ Core Hub บน localhost
