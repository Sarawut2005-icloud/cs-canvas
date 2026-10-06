# ci-compliance-spec.md

**เวอร์ชัน:** 1.0.0
**ดูแลโดย:** ทีม Infrastructure & DevOps (GitHub Governance)
**บังคับใช้กับ:** ทุก subsystem repository ในองค์กร `csmju2030`
**อ้างอิงจาก:** `github-workflow.md`, `tech-stack.md`, `api-conventions.md`, `data-dictionary.md`, `auth-contract.md`, `ui-design-system.md`

> เอกสารนี้คือสเปคของ **ระบบตรวจสอบอัตโนมัติ (Automated Compliance System)** ที่ทำให้มาตรฐานทั้งหมดในโครงการ CSMJU2030 กลายเป็นสิ่งที่ตรวจสอบได้ด้วยเครื่อง ไม่ใช่แค่เอกสารให้คนหรือ AI ตีความ
>
> **หลักการ:** ถ้ากฎข้อใดไม่มีสคริปต์ตรวจ ให้ถือว่ากฎข้อนั้น "ไม่มีผลบังคับใช้จริง"

---

## สารบัญ

1. [ขอบเขตและเป้าหมาย](#1-ขอบเขตและเป้าหมาย)
2. [สถาปัตยกรรมของระบบตรวจสอบ](#2-สถาปัตยกรรมของระบบตรวจสอบ)
3. [ระดับการป้องกัน (Defense Layers)](#3-ระดับการป้องกัน-defense-layers)
4. [Layer 1 — Branch Protection Rules](#4-layer-1--branch-protection-rules)
5. [Layer 2 — CODEOWNERS](#5-layer-2--codeowners)
6. [Layer 3 — CI Compliance Gate](#6-layer-3--ci-compliance-gate)
7. [รายการ Compliance Check ทั้งหมด](#7-รายการ-compliance-check-ทั้งหมด)
7.3 [Profile: Core Hub](#73-profile-core-hub)
8. [โครงสร้างไฟล์ที่ต้องมี](#8-โครงสร้างไฟล์ที่ต้องมี)
9. [Repository Ruleset ระดับองค์กร](#9-repository-ruleset-ระดับองค์กร)
10. [การจัดการ Secrets](#10-การจัดการ-secrets)
11. [Exception Process](#11-exception-process)
12. [แผนการติดตั้ง (Rollout Plan)](#12-แผนการติดตั้ง-rollout-plan)
13. [Completion Criteria](#13-completion-criteria)

---

## 1. ขอบเขตและเป้าหมาย

### 1.1 ปัญหาที่ต้องแก้

โครงการ CSMJU2030 มี **37 ระบบย่อย**, **ทีมงาน 52 คน**, และ **AI 50+ ตัว** ที่เขียนโค้ดคนละยี่ห้อ ความเสี่ยงหลักคือ

| ความเสี่ยง | ผลกระทบ |
|---|---|
| AIE (หรือ AI) ติดตั้ง framework นอกมาตรฐาน | ระบบย่อยหลุดจาก stack กลาง maintain ไม่ได้ |
| Frontend ต่อ Database ตรง | ทำลาย Database Isolation ตามสถาปัตยกรรม |
| Hardcode connection string / API key | ช่องโหว่ความปลอดภัยระดับร้ายแรง |
| ตั้งชื่อ field เอง (`student_id`, `user_code`) | ระบบเชื่อมกันไม่ได้ ต้องเขียน mapping ทุกจุด |
| ไม่อัปเดต `openapi.json` | Frontend/Backend type หลุดจากกัน |
| แก้ไขไฟล์ CI เพื่อข้ามการตรวจ | ระบบตรวจสอบไร้ความหมาย |
| Push ตรงเข้า `main` | โค้ดที่ไม่ผ่าน review เข้า production |

### 1.2 เป้าหมายของระบบ

1. **ป้องกันล่วงหน้า** — บล็อกโค้ดที่ผิดมาตรฐานก่อนเข้า `main` ไม่ใช่ตรวจย้อนหลัง
2. **ตรวจได้ด้วยเครื่อง** — ทุกกฎในเอกสารมาตรฐานต้องมีสคริปต์ตรวจคู่กัน
3. **ข้ามไม่ได้** — AIE และ AI ต้องไม่มีทางปิด/แก้ไขกลไกตรวจสอบเองได้
4. **แจ้งเหตุผลชัดเจน** — เมื่อ CI fail ต้องบอกว่าผิดข้อไหน แก้อย่างไร อ้างอิงเอกสารใด
5. **ไม่ช้า** — CI ต้องเสร็จภายใน 5 นาที เพื่อไม่ให้ขวางการทำงาน

### 1.3 สิ่งที่ระบบนี้ไม่ครอบคลุม

- ความถูกต้องของ Business Logic (เป็นหน้าที่ PL review)
- คุณภาพภาษาไทยบนหน้าจอ (AIE ต้องตรวจด้วยตาตนเอง)
- การทดสอบบนอุปกรณ์จริง (AIE ต้องทำเอง)
- Performance / Load testing (ทำในขั้น staging)

---

## 2. สถาปัตยกรรมของระบบตรวจสอบ

### 2.1 หลักการ "Standards-as-Code"

```text
csmju2030-standards (Private repo, PM/DevOps ดูแล)
        │
        ├── มาตรฐาน (.md)          ← เอกสารสำหรับคน + AI อ่าน
        ├── schemas/               ← JSON Schema สำหรับ validate ข้อมูล
        ├── scripts/               ← สคริปต์ตรวจสอบจริง (แหล่งเดียว)
        └── workflows/             ← Reusable GitHub Actions workflow
        │
        │  (git submodule + reusable workflow)
        ▼
csmju-<subsystem>  ×37 repo
        └── .github/workflows/ci.yml  ← เรียก reusable workflow จากส่วนกลาง
```

**เหตุผลที่ต้องรวมสคริปต์ไว้ที่ส่วนกลาง:** ถ้าให้แต่ละ repo เก็บสคริปต์ตรวจเอง เมื่อมาตรฐานเปลี่ยนจะต้องแก้ 37 ที่ และ AIE สามารถแก้สคริปต์ในซาก repo ตัวเองให้ผ่านได้

### 2.2 หลักการ "Untouchable CI"

ระบบตรวจสอบต้องอยู่นอกมือของผู้ถูกตรวจ ทำได้ด้วย 3 กลไกซ้อนกัน

| กลไก | ระดับ | ป้องกันอะไร |
|---|---|---|
| Organization Ruleset | Org | AIE ปิด branch protection เอง |
| CODEOWNERS + protection | Repo | AIE แก้ `.github/workflows/` |
| Reusable workflow ที่ pin ด้วย SHA | Workflow | AIE แก้เนื้อหาสคริปต์ตรวจ |

---

## 3. ระดับการป้องกัน (Defense Layers)

```text
┌─────────────────────────────────────────────────────────┐
│ Layer 0 — Local (pre-commit hook)      [แนะนำ ไม่บังคับ] │
│   ตรวจเบื้องต้นบนเครื่อง AIE — เร็ว แต่ข้ามได้            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 1 — Branch Protection            [บังคับ]         │
│   ห้าม push ตรง / ห้าม force push / บังคับ PR            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2 — CODEOWNERS                   [บังคับ]         │
│   PL เป็น required reviewer / DevOps คุมไฟล์ CI          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3 — CI Compliance Gate           [บังคับ]         │
│   14 checks — fail ข้อใดข้อหนึ่ง = merge ไม่ได้           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 4 — PL Human Review              [บังคับ]         │
│   Business logic / คุณภาพภาษาไทย / สิ่งที่เครื่องตรวจไม่ได้ │
└─────────────────────────────────────────────────────────┘
                          ↓
                    main (protected)
```

**กฎสำคัญ:** Layer 0 เป็นความสะดวก ไม่ใช่การป้องกัน ต้องมี check ตัวเดียวกันใน Layer 3 ทุกข้อ

---

## 4. Layer 1 — Branch Protection Rules

### 4.1 ค่าที่ต้องตั้งบน `main` ของทุก repo (และ `develop` ถ้ามี)

repo ที่ใช้ `develop` (github-workflow.md ข้อ 1.5) ตั้ง `develop` ด้วยค่าชุดเดียวกับตารางนี้ ยกเว้นข้อ creation ของ ruleset
เพราะ `develop` ต้องสร้างทีหลังได้ ตอนนี้ยังไม่มีไฟล์ ruleset ของ `develop` ให้ import ให้ตั้งเองใน Settings → Rules เมื่อแผนของ GitHub เปิดให้บังคับใช้ได้

| ตัวเลือก | ค่า | เหตุผล |
|---|---|---|
| Require a pull request before merging | ✅ | ห้าม push ตรง (github-workflow.md ข้อ 1.1) |
| — Require approvals | `1` | PL ต้อง approve |
| — Dismiss stale approvals on new commits | ✅ | ป้องกัน approve แล้วแอบ push เพิ่ม |
| — Require review from Code Owners | ✅ | บังคับให้ PL เป็นคน approve จริง |
| Require status checks to pass | ✅ | บังคับ CI ผ่านก่อน merge |
| — Require branches to be up to date | ✅ | ป้องกัน merge บนฐานเก่า |
| Require conversation resolution | ✅ | comment ของ PL ต้องถูกตอบก่อน |
| Require linear history | ❌ | PR `develop` → `main` ต้องเป็น merge commit (github-workflow.md ข้อ 1.5) · feature PR ยังเป็น squash โดยคุมที่ merge method (ข้อ 4.2) |
| Allow force pushes | ❌ | ห้ามเด็ดขาด — ทำลายประวัติ audit |
| Allow deletions | ❌ | ห้ามลบ branch หลัก |
| Do not allow bypassing | ✅ | admin ก็ต้องผ่าน — ปิดช่องข้ามกฎ |

### 4.2 Merge method

ตั้งใน `Settings → General → Pull Requests`

```text
✅ Allow squash merging      (default commit message = PR title)
❌ Allow merge commits       (repo ที่ใช้ develop: ✅ — ใช้กับ PR develop → main และ main → develop เท่านั้น)
❌ Allow rebase merging
✅ Automatically delete head branches   (repo ที่ใช้ develop ต้องตั้ง develop เป็น default branch ก่อน)
```

เหตุผล: `github-workflow.md` ข้อ 1.4 กำหนดให้ feature PR 1 ตัว = 1 commit ใน history
ส่วน PR ระหว่าง `develop` กับ `main` ต้องเป็น merge commit ไม่งั้น `main` กับ `develop` จะแยกประวัติกัน (ข้อ 1.5)
และ GitHub ไม่ลบ default branch เอง ถ้า `develop` ไม่ใช่ default branch จะถูกลบทิ้งหลัง merge PR release

### 4.3 Required status checks ที่ต้องเพิ่ม

ชื่อ job ที่ต้องปรากฏในรายการ required checks

```text
Convention Check
Security & Stack Scan
Standards Version Check
Code Quality
API Contract Sync
Data Dictionary Compliance
UI Token Compliance
```

---

## 5. Layer 2 — CODEOWNERS

### 5.1 ไฟล์ `.github/CODEOWNERS`

```text
# ค่าเริ่มต้น — PL ของระบบย่อยนี้ต้อง review ทุก PR
*                       @csmju2030/pl-<subsystem-name>

# ไฟล์ที่ AIE ห้ามแก้เอง — DevOps เท่านั้นที่ approve ได้
/.github/               @csmju2030/devops
/.github/workflows/     @csmju2030/devops
/.github/CODEOWNERS     @csmju2030/devops
/standards              @csmju2030/devops
/subsystem.yaml         @csmju2030/devops @csmju2030/pm

# ไฟล์ contract ที่กระทบระบบอื่น — ต้องมี PM ร่วม approve
/backend/openapi.json   @csmju2030/pl-<subsystem-name> @csmju2030/pm
```

### 5.2 GitHub Teams ที่ต้องสร้าง

| Team | สมาชิก | สิทธิ์ในแต่ละ subsystem repo |
|---|---|---|
| `@csmju2030/devops` | ทีม Infrastructure | Admin |
| `@csmju2030/pm` | ทีม PM (PM1–PM5) | Maintain |
| `@csmju2030/pl-<subsystem>` | PL ของระบบย่อยนั้น | Maintain |
| `@csmju2030/aie-<subsystem>` | AIE เจ้าของระบบย่อย | Write |

**หลักการ:** AIE ได้แค่ `Write` — push branch ได้ แต่แก้ setting ของ repo ไม่ได้

---

## 6. Layer 3 — CI Compliance Gate

### 6.1 Reusable workflow ที่ส่วนกลาง

เก็บใน `csmju2030-standards/.github/workflows/subsystem-compliance.yml`

```yaml
name: CSMJU2030 Subsystem Compliance (Reusable)

on:
  workflow_call:
    inputs:
      subsystem_name:
        required: true
        type: string
      node_version:
        required: false
        type: string
        default: '20'

jobs:
  convention-check:
    name: Convention Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Branch naming
        run: bash scripts/check-branch-name.sh
      - name: Commit messages
        run: bash scripts/check-commit-messages.sh

  security-scan:
    name: Security & Stack Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Guard CI files
        run: bash scripts/check-ci-untouched.sh
      - name: Secret scan
        run: bash scripts/check-no-secrets.sh
      - name: DB isolation
        run: bash scripts/check-db-isolation.sh
      - name: Authorized dependencies
        run: bash scripts/check-authorized-deps.sh

  # ... jobs อื่นตามรายการในข้อ 7
```

### 6.2 ไฟล์ที่วางในแต่ละ subsystem repo

ไฟล์นี้ **สั้นและตายตัว** — AIE แก้ไม่ได้ (ถูกคุมโดย CODEOWNERS)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]   # develop มีผลเฉพาะ repo ที่ใช้ (github-workflow.md 1.5)

jobs:
  compliance:
    uses: CSMJU2030/csmju2030-standards/.github/workflows/subsystem-compliance.yml@v1.5.2
    with:
      subsystem_name: csmju-equipment
    secrets: inherit
```

**สำคัญ:** ต้อง pin ด้วย tag เวอร์ชัน (`@v1.5.2`) เท่านั้น (commit SHA ใช้ไม่ได้แล้ว เพราะตัวกลางถูกดึงตาม `STANDARDS_ENTRY_REF` ของ tag นั้น) **ห้ามใช้ `@main`** เพราะจะทำให้ CI เปลี่ยนพฤติกรรมโดยไม่ได้ประกาศ

ตั้งแต่ 1.5.2 tag ใน `ci.yml` ปักหมุดแค่**ตัวกลาง** (workflow, `GH-03`, `GH-04`) ส่วนชุดตรวจอื่นมาจากเวอร์ชันใน `.standards-version`
ทีมจึงเลื่อนเวอร์ชันเองได้โดยไม่ต้องแก้ไฟล์นี้ ([`docs/standards-versioning.md`](docs/standards-versioning.md))

### 6.3 ข้อกำหนดของข้อความ error

ทุกสคริปต์ที่ fail ต้องแสดงข้อความในรูปแบบนี้

```text
❌ [รหัสข้อ] คำอธิบายปัญหาภาษาไทย
   ไฟล์: <path>:<line>
   พบ: <ค่าที่ผิด>
   ต้องเป็น: <ค่าที่ถูก>
   อ้างอิง: <ชื่อเอกสาร>.md ข้อ <หมายเลข>
   วิธีแก้: <คำสั่งหรือขั้นตอน>
```

ตัวอย่างจริง

```text
❌ [DD-01] ใช้ชื่อ field ที่ห้ามใช้แทน core_user_id
   ไฟล์: backend/src/borrow/borrow.entity.ts:14
   พบ: student_id
   ต้องเป็น: core_user_id / coreUserId
   อ้างอิง: data-dictionary.md ข้อ 1
   วิธีแก้: ใช้ core_user_id / coreUserId แทน alias ต้องห้าม ทั้งใน entity, DTO และ response
```

---

## 7. รายการ Compliance Check ทั้งหมด

### 7.1 ตารางสรุป

| รหัส | Check | ระดับ | อ้างอิง |
|---|---|---|---|
| `GH-01` | Branch name ตรงรูปแบบ `feature/<subsystem>/<เรื่อง>` ยกเว้น PR `develop` → `main` และ `main` → `develop` | ❌ Fail | github-workflow.md 1.1, 1.5 |
| `GH-02` | Commit message ตาม Conventional Commits | ❌ Fail | github-workflow.md 1.3 |
| `GH-03` | ไม่มีการแก้ไข `.github/workflows/` และ `.github/CODEOWNERS` (submodule `standards` เลื่อนเองได้ตั้งแต่ 1.5.1) | ❌ Fail | github-workflow.md 5 |
| `GH-04` | `.standards-version` มี tag จริง · ไม่ต่ำกว่า `MIN_VERSION` · ไม่ถอยจาก branch ปลายทาง · submodule `standards/` ชี้ tag เดียวกัน · CI ตรวจด้วยชุดตรวจของเวอร์ชันนั้น | ❌ Fail | standards-versioning.md |
| `SEC-01` | ไม่มี hardcoded connection string / API key / secret | ❌ Fail | github-workflow.md 4 |
| `SEC-02` | ไม่มีไฟล์ `.env` ที่มีค่าจริงใน repo | ❌ Fail | github-workflow.md 4 |
| `SEC-03` | ไม่มี token เก็บใน `localStorage` | ❌ Fail | ui-design-system.md 16.2 |
| `SEC-04` | ตรวจ JWT ตามสัญญา: RS256 + JWKS + `kid` · ห้าม HS256/alg=none/กุญแจฝังในโค้ด/ออก token เอง/ใช้ jsonwebtoken-passport-jwt | ❌ Fail | auth-contract.md 4, 9 |
| `SEC-05` | ไม่มีหน้า login / form username-password ในระบบย่อย | ❌ Fail | auth-contract.md 1, 9 |
| `ARC-01` | ไม่มี Prisma client / `pg` import ใน `frontend/` | ❌ Fail | tech-stack.md 1.2 |
| `ARC-02` | Dependency ทั้งหมดอยู่ใน whitelist ของ stack | ❌ Fail | tech-stack.md 1 |
| `ARC-03` | ไม่มี UI library ต้องห้าม (MUI/Antd/Bootstrap ฯลฯ) | ❌ Fail | ui-design-system.md 16.2 |
| `ARC-04` | มี backend NestJS ใน `backend/` (`@nestjs/core` ใน dependencies · `main.ts` ใช้ `NestFactory`) — repo ที่เพิ่ง scaffold ข้าม | ❌ Fail | repo-structure.md 2 · tech-stack.md 1.3 |
| `DEP-01` | มี `backend/Dockerfile` · และ `frontend/Dockerfile` เมื่อมี `frontend/package.json` — repo ที่เพิ่ง scaffold ข้าม | ❌ Fail | deployment.md 3 |
| `DEP-02` | stage สุดท้ายของ Dockerfile ตั้ง `USER` ที่ไม่ใช่ `root`/`0` | ❌ Fail | deployment.md 3.3 |
| `DEP-03` | `.dockerignore` ที่รากกัน `**/.env*` (หรือ `**/.env` + `**/.env.*`) และ `**/node_modules` | ❌ Fail | deployment.md 3.3 |
| `DEP-04` | `frontend/next.config.*` ตั้ง `output: "standalone"` | ❌ Fail | deployment.md 3.3 |
| `API-01` | `openapi.json` sync กับโค้ด backend | ❌ Fail | tech-stack.md 3 |
| `API-02` | URL เป็น kebab-case + noun พหูพจน์ + มี `/v1/` | ❌ Fail | api-conventions.md 1 |
| `API-03` | ทุก endpoint ห่อ response ด้วย envelope มาตรฐาน | ❌ Fail | api-conventions.md 3 |
| `API-04` | `error.code` และค่าใน `ErrorCode` อยู่ในรายการของ `contracts/error-codes.json` (9 ค่า) · ไฟล์ทดสอบ `*.spec.ts` และ `test/` ไม่ถูกตรวจ (ค่าในนั้นเป็นข้อมูลตัวอย่าง) | ❌ Fail | api-conventions.md 4 |
| `API-05` | มี endpoint `GET /api/health` | ❌ Fail | api-conventions.md 8 |
| `API-07` | pagination ใช้ `?page=&limit=` (ห้าม `per_page`) | ❌ Fail | api-conventions.md 5 |
| `API-06` | ประกาศ `public_endpoints` ใน `subsystem.yaml` | ⚠️ Warn | api-conventions.md 7 |
| `DD-01` | Global Identity ใช้ชื่อ `core_user_id`/`coreUserId` · ห้าม alias (`user_id`, `userId`, `user_code`, `userCode`, `std_id`, `stdId`) | ❌ Fail | data-dictionary.md 9.2 |
| `DD-02` | core role (`coreRole`/`core_role`) ใช้ค่าจาก enum `student\|alumni\|staff\|lecturer\|guest\|admin` | ❌ Fail | data-dictionary.md 4 |
| `DD-03` | ตาราง/คอลัมน์ในฐานข้อมูลเป็น `snake_case` ผ่าน `@map`/`@@map` (field ใน TS/JSON เป็น camelCase) | ❌ Fail | data-dictionary.md 9.1 |
| `DD-04` | ไม่ hardcode รายชื่อคณะ (ต้องเรียก `/v1/faculties`) | ❌ Fail | data-dictionary.md 3 |
| `DD-05` | ฟิลด์เงินเป็น integer ไม่ใช่ float | ❌ Fail | data-dictionary.md 5 |
| `UI-01` | ไม่มี hex color ดิบ (ต้องใช้ class จาก token ใน `@theme`) | ❌ Fail | ui-design-system.md 3 |
| `UI-02` | ไม่มีค่า spacing/radius นอก scale ที่กำหนด | ⚠️ Warn | ui-design-system.md 3.2–3.3 |
| `UI-03` | ไม่มี `div onClick` / `outline:none` / `!important` | ⚠️ Warn | ui-design-system.md 12.1, 16.2 |
| `UI-04` | ไม่มี emoji ในหน้าจอระบบ | ⚠️ Warn | ui-design-system.md 16.2 |
| `QA-01` | ESLint + Prettier ผ่านทั้ง frontend และ backend | ❌ Fail | github-workflow.md 3.1 |
| `QA-02` | `tsc --noEmit` ผ่านทั้งสองฝั่ง | ❌ Fail | github-workflow.md 3.2 |
| `QA-03` | Unit test ผ่าน + coverage ≥ เกณฑ์ที่ทีมกำหนด | ❌ Fail | github-workflow.md 3.3 |
| `QA-04` | `next build` และ `nest build` ผ่านทั้งคู่ | ❌ Fail | github-workflow.md 3.7 |
| `QA-05` | ใช้ pnpm workspace (ไม่มี `package-lock.json`) | ❌ Fail | github-workflow.md 2 |
| `QA-06` | ชื่อ package ใน workspace ไม่ซ้ำ และ `--filter` ใน script ที่รากชี้ไปยัง package ที่มีจริง | ❌ Fail | repo-structure.md 3 |

**ระดับ:** `❌ Fail` = block merge ทันที | `⚠️ Warn` = แสดงเตือนใน PR comment แต่ merge ได้ (PL ใช้ดุลพินิจ)

### 7.3 Profile: Core Hub

ตารางใน 7.1 คือกฎของ **ระบบย่อย** `csmju-core-hub` ไม่ใช่ระบบย่อย จึงมีชุดกฎแยกที่ยกเว้นเฉพาะข้อที่
ขัดกับหน้าที่ของมันเอง (เป็นผู้ออก token · ถือ private key · เป็นหน้า login กลาง · เป็นเจ้าของตาราง `users`)

กลไกคือตัวแปรแวดล้อม `CSMJU_PROFILE` ค่าเริ่มต้น `subsystem`:

| profile | ตัวเรียก | ผลต่อการตรวจ |
|---|---|---|
| `subsystem` | `run-all-checks.sh` · `subsystem-compliance.yml` | ตรวจครบทุกข้อในตาราง 7.1 |
| `core-hub` | `run-core-hub-checks.sh` · `core-hub-compliance.yml` | ยกเว้น `GH-03` `GH-04` `SEC-04` `SEC-05` `API-01` `API-06` `UI-01..04` `DEP-01..04` · `DD-01` และ `DEP` ถูกข้ามในสคริปต์ · `ARC-02` ขยาย whitelist ด้วยคีย์ `allowed_core_hub` |

ระบบย่อยตั้ง `CSMJU_PROFILE=core-hub` เองไม่ได้ — workflow ของระบบย่อยไม่ได้ส่งค่านี้ และ `GH-03`
ห้ามทีมแก้ไฟล์ workflow อยู่แล้ว

รายละเอียดพร้อมเหตุผลรายข้อ: [`docs/core-hub-rules.md`](docs/core-hub-rules.md)

### 7.2 รายละเอียดสคริปต์สำคัญ

#### `GH-01` — Branch naming

```bash
#!/usr/bin/env bash
# scripts/check-branch-name.sh
set -euo pipefail

BRANCH="${GITHUB_HEAD_REF:-$(git rev-parse --abbrev-ref HEAD)}"
BASE="${GITHUB_BASE_REF:-}"          # GitHub Actions ตั้งให้ทุก PR · ในเครื่องว่าง
PATTERN='^feature/[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*$'

# ข้อยกเว้นเดียว: PR ระหว่าง branch หลักสองตัว (github-workflow.md ข้อ 1.5)
[[ "$BRANCH" == "develop" && "$BASE" == "main" ]] && exit 0   # ขึ้น production
[[ "$BRANCH" == "main" && "$BASE" == "develop" ]] && exit 0   # ดึง hotfix กลับ

if [[ ! "$BRANCH" =~ $PATTERN ]]; then
  cat <<EOF
❌ [GH-01] ชื่อ branch ไม่ตรงมาตรฐาน
   พบ: $BRANCH
   ต้องเป็น: feature/<subsystem>/<เรื่องที่ทำ>
   ตัวอย่าง: feature/equipment/add-borrow-return
   ข้อยกเว้น: PR develop → main และ main → develop (github-workflow.md ข้อ 1.5)
   อ้างอิง: github-workflow.md ข้อ 1.1 (4)
   วิธีแก้: git branch -m feature/<subsystem>/<เรื่อง>
EOF
  exit 1
fi
echo "✅ [GH-01] Branch name ผ่าน: $BRANCH"
```

ตัวจริงอยู่ที่ `scripts/check-branch-name.sh` ซึ่งรับชื่อ branch และ base เป็น argument ได้ด้วย เพื่อให้ `self-test.sh` ทดสอบทุกกรณีได้

#### `GH-03` — ป้องกันการแก้ไฟล์ CI

```bash
#!/usr/bin/env bash
# scripts/check-ci-untouched.sh
set -euo pipefail

BASE_SHA="${GITHUB_BASE_SHA:-origin/main}"
PROTECTED=(
  '^\.github/workflows/'
  '^\.github/CODEOWNERS$'
)   # submodule standards ไม่อยู่ในรายการตั้งแต่ 1.5.1 — GH-04 ตรวจว่าชี้ tag ที่ .standards-version ระบุ

CHANGED=$(git diff --name-only "$BASE_SHA...HEAD")
VIOLATION=0

for PATTERN in "${PROTECTED[@]}"; do
  MATCHES=$(echo "$CHANGED" | grep -E "$PATTERN" || true)
  if [[ -n "$MATCHES" ]]; then
    echo "❌ [GH-03] แก้ไขไฟล์ที่ห้ามแก้:"
    echo "$MATCHES" | sed 's/^/   - /'
    VIOLATION=1
  fi
done

if [[ "$VIOLATION" -eq 1 ]]; then
  cat <<EOF
   อ้างอิง: github-workflow.md ข้อ 5 (1)
   วิธีแก้: revert การแก้ไขไฟล์เหล่านี้ออกจาก PR
            ถ้าจำเป็นต้องแก้จริง ให้เปิด issue ขอต่อทีม DevOps
EOF
  exit 1
fi
echo "✅ [GH-03] ไม่มีการแก้ไขไฟล์ CI"
```

#### `ARC-01` — Database Isolation

```bash
#!/usr/bin/env bash
# scripts/check-db-isolation.sh
set -euo pipefail

FORBIDDEN_IN_FRONTEND=(
  "@prisma/client"
  "from 'pg'"
  'from "pg"'
  "require('pg')"
  "new Pool("
  "new Client("
  "DATABASE_URL"
  "postgresql://"
  "postgres://"
)

VIOLATION=0
for PATTERN in "${FORBIDDEN_IN_FRONTEND[@]}"; do
  RESULT=$(grep -rn --fixed-strings "$PATTERN" frontend/ \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    --exclude-dir=node_modules --exclude-dir=.next 2>/dev/null || true)
  if [[ -n "$RESULT" ]]; then
    echo "❌ [ARC-01] Frontend เข้าถึง Database โดยตรง"
    echo "$RESULT" | sed 's/^/   /'
    VIOLATION=1
  fi
done

if [[ "$VIOLATION" -eq 1 ]]; then
  cat <<EOF
   อ้างอิง: tech-stack.md ข้อ 1.2 / Blueprint "Database-per-Subsystem"
   วิธีแก้: ย้าย logic ไปที่ backend/ แล้วให้ frontend เรียกผ่าน API
EOF
  exit 1
fi
echo "✅ [ARC-01] Database isolation ผ่าน"
```

#### `DD-01` — Forbidden aliases ของ Global Identity (`core_user_id`)

```bash
#!/usr/bin/env bash
# scripts/check-field-aliases.sh
set -euo pipefail

# alias ที่ห้ามใช้แทน core_user_id (data-dictionary.md ข้อ 1)
FORBIDDEN_ALIASES=(
  'student_id' 'student_code' 'user_id' 'user_code'
  'std_id' 'stdId' 'studentId' 'userId' 'userCode'
)

VIOLATION=0
for ALIAS in "${FORBIDDEN_ALIASES[@]}"; do
  RESULT=$(grep -rn --word-regexp "$ALIAS" \
    frontend/src backend/src prisma/ 2>/dev/null \
    --include='*.ts' --include='*.tsx' --include='*.prisma' \
    --exclude-dir=node_modules || true)
  if [[ -n "$RESULT" ]]; then
    echo "❌ [DD-01] ใช้ชื่อ field ที่ห้ามใช้แทน core_user_id: $ALIAS"
    echo "$RESULT" | sed 's/^/   /'
    VIOLATION=1
  fi
done

if [[ "$VIOLATION" -eq 1 ]]; then
  cat <<EOF
   อ้างอิง: data-dictionary.md ข้อ 1 (Forbidden aliases)
   วิธีแก้: เปลี่ยนทุกที่ให้ใช้ core_user_id / coreUserId แทน
            รวมทั้ง Prisma schema, DTO, API response และ frontend type
EOF
  exit 1
fi
echo "✅ [DD-01/02] ไม่พบ alias ต้องห้าม และ core role อยู่ใน enum"
```

#### `API-01` — OpenAPI sync

```bash
#!/usr/bin/env bash
# scripts/check-openapi-sync.sh
set -euo pipefail

cd backend
pnpm run generate:openapi

if ! git diff --exit-code --quiet openapi.json; then
  cat <<EOF
❌ [API-01] openapi.json ไม่ตรงกับโค้ด backend
   อ้างอิง: tech-stack.md ข้อ 3
   วิธีแก้: cd backend && pnpm run generate:openapi
            แล้ว git add backend/openapi.json ใน PR เดียวกัน

Diff ที่พบ:
$(git diff openapi.json | head -40)
EOF
  exit 1
fi
echo "✅ [API-01] openapi.json sync กับโค้ด"
```

#### `UI-01` — Design token compliance

```bash
#!/usr/bin/env bash
# scripts/check-ui-tokens.sh
set -euo pipefail

# หา hex color ดิบใน tsx/ts/css ทั้ง frontend/ (ไม่ใช่แค่ src/)
# ยกเว้นไฟล์ token กลางจาก template: globals.css และโฟลเดอร์ csmju/
RESULT=$(grep -rnE '#[0-9a-fA-F]{3,8}\b' frontend \
  --include='*.tsx' --include='*.ts' --include='*.css' \
  --exclude='*.config.*' --exclude='globals.css' --exclude-dir=csmju \
  --exclude-dir=node_modules --exclude-dir=.next 2>/dev/null || true)

if [[ -n "$RESULT" ]]; then
  cat <<EOF
❌ [UI-01] พบค่าสี hex ดิบในโค้ด frontend
$(echo "$RESULT" | sed 's/^/   /')
   อ้างอิง: ui-design-system.md ข้อ 3
   วิธีแก้: ใช้ utility class จาก token ใน @theme ของ globals.css
            (เช่น bg-primary-container, text-on-surface) แทนการพิมพ์ hex
EOF
  exit 1
fi
echo "✅ [UI-01] ไม่พบ hex color ดิบ"
```

### 7.3 Dependency Whitelist (`ARC-02`)

```json
{
  "allowed_frontend": [
    "next", "react", "react-dom", "typescript",
    "tailwindcss", "@tailwindcss/postcss", "postcss", "autoprefixer",
    "@csmju2030/design-system",
    "zustand", "axios", "@tanstack/react-query",
    "lucide-react", "leaflet", "qrcode.react",
    "socket.io-client",
    "zod", "openapi-typescript",
    "eslint", "prettier", "vitest", "@testing-library/react"
  ],
  "allowed_backend": [
    "@nestjs/core", "@nestjs/common", "@nestjs/platform-express",
    "@nestjs/config", "@nestjs/swagger", "@nestjs/testing",
    "@nestjs/websockets", "@nestjs/platform-socket.io", "socket.io",
    "typescript", "prisma", "@prisma/client",
    "class-validator", "class-transformer", "zod",
    "eslint", "prettier", "jest", "supertest"
  ],
  "forbidden_everywhere": [
    "@mui/material", "@mui/core", "antd", "@ant-design/icons",
    "bootstrap", "react-bootstrap",
    "@chakra-ui/react", "daisyui", "@mantine/core",
    "express", "fastify", "koa", "hapi",
    "mysql", "mysql2", "mongodb", "mongoose", "sequelize", "typeorm",
    "jsonwebtoken", "jose", "passport-jwt"
  ]
}
```

> **หมายเหตุ:** `jsonwebtoken`, `jose`, `passport-jwt` อยู่ในรายการห้าม เพราะ `auth-contract.md` ข้อ 3 กำหนดว่าระบบย่อยห้าม verify ลายเซ็น JWT เอง ต้องเชื่อ header จาก gateway

---

## 8. โครงสร้างไฟล์ที่ต้องมี

### 8.1 ใน `csmju2030-standards` (repo กลาง, Private)

```text
csmju2030-standards/
├── .github/
│   └── workflows/
│       ├── subsystem-compliance.yml     # reusable workflow หลัก
│       └── self-test.yml                # ทดสอบสคริปต์ตรวจเอง
├── docs/
│   ├── auth-contract.md
│   ├── api-conventions.md
│   ├── data-dictionary.md
│   ├── ui-design-system.md
│   ├── tech-stack.md
│   ├── github-workflow.md
│   └── ci-compliance-spec.md            # ไฟล์นี้
├── schemas/
│   ├── user.schema.json
│   ├── role.schema.json
│   ├── department.schema.json
│   ├── subsystem.schema.json
│   └── common.schema.json
├── scripts/
│   ├── check-branch-name.sh             # GH-01
│   ├── check-commit-messages.sh         # GH-02
│   ├── check-ci-untouched.sh            # GH-03
│   ├── check-submodule-pointer.sh       # GH-04
│   ├── check-no-secrets.sh              # SEC-01,02
│   ├── check-no-local-storage.sh        # SEC-03
│   ├── check-no-jwt-verify.sh           # SEC-04,05
│   ├── check-db-isolation.sh            # ARC-01
│   ├── check-authorized-deps.sh         # ARC-02,03
│   ├── check-openapi-sync.sh            # API-01
│   ├── check-api-conventions.ts         # API-02..05
│   ├── check-field-aliases.sh           # DD-01,02
│   ├── check-snake-case.sh              # DD-03
│   ├── check-no-hardcoded-faculty.sh    # DD-04
│   ├── check-ui-tokens.sh               # UI-01..04
│   └── lib/
│       ├── report.sh                    # ฟังก์ชันแสดง error รูปแบบมาตรฐาน
│       └── allowed-deps.json            # whitelist ตามข้อ 7.3
├── templates/
│   ├── ci.yml                           # ไฟล์ที่ subsystem copy ไปวาง
│   ├── CODEOWNERS
│   ├── pull_request_template.md
│   ├── .gitignore
│   ├── .env.example
│   └── subsystem.yaml
├── CHANGELOG.md
└── VERSION                              # semver ของมาตรฐานชุดนี้
```

### 8.2 ใน subsystem repo แต่ละตัว

```text
csmju-<subsystem-name>/
├── .github/
│   ├── workflows/
│   │   └── ci.yml                       # เรียก reusable workflow (แก้ไม่ได้)
│   ├── CODEOWNERS                       # (แก้ไม่ได้)
│   └── pull_request_template.md
├── frontend/                            # Next.js
├── backend/
│   ├── src/
│   └── openapi.json                     # ต้อง commit และ sync กับโค้ด
├── standards/                           # git submodule → csmju2030-standards
├── prisma/
│   └── schema.prisma
├── .env.example                          # ชื่อ key เท่านั้น ไม่มีค่าจริง
├── .gitignore                            # ต้องมี .env, .env.local
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── subsystem.yaml                        # manifest ของระบบย่อย
```

### 8.3 `pull_request_template.md`

```markdown
## สรุปสิ่งที่ทำใน PR นี้

<!-- อธิบายสั้นๆ 1-2 ประโยค -->

## ประเภทการเปลี่ยนแปลง

- [ ] `feat` — เพิ่มฟีเจอร์ใหม่
- [ ] `fix` — แก้บั๊ก
- [ ] `refactor` — ปรับโครงสร้างโค้ด
- [ ] `chore` / `docs` / `test` / `ci`

## Checklist (AIE ต้องติ๊กก่อน request review)

### มาตรฐานกลาง
- [ ] อ่านมาตรฐานใน `standards/` ตรงกับเวอร์ชันใน `.standards-version` (รัน `git submodule update --init standards/` แล้ว)
- [ ] Branch name ตรงรูปแบบ `feature/<subsystem>/<เรื่อง>`
- [ ] Commit message ตาม Conventional Commits ทุก commit
- [ ] PR นี้โฟกัสเรื่องเดียว (ไม่ปนหลายเรื่องที่ไม่เกี่ยวกัน)

### สถาปัตยกรรม
- [ ] ไม่มี Database connection หรือ Prisma ใน `frontend/`
- [ ] ไม่มี dependency นอก whitelist ของ stack
- [ ] ไม่มี UI library อื่นนอก `@csmju2030/design-system`

### Auth
- [ ] ไม่ได้สร้างหน้า login หรือ form username/password เอง
- [ ] ไม่ได้เขียนโค้ด verify JWT signature เอง
- [ ] ไม่เก็บ token ใน `localStorage`

### API & Data
- [ ] ถ้าแก้ endpoint → อัปเดต `openapi.json` ใน PR นี้ด้วย
- [ ] Response ทุก endpoint ห่อด้วย `{ success, data/error, meta }`
- [ ] `error.code` อยู่ในรายการมาตรฐาน 9 ค่า (`contracts/error-codes.json`) · 429/503 มี `Retry-After`
- [ ] ตาราง/คอลัมน์ใน DB เป็น `snake_case` ผ่าน `@map` · field ใน TS/JSON เป็น camelCase · ตรงกับ `data-dictionary.md`
- [ ] อ้างถึงผู้ใช้ด้วย `core_user_id` (ค่า `sub` ชนิด text) ไม่ใช้ `student_id` / `user_id` / `stdId`
- [ ] ข้อมูลกลางเก็บแค่ `code` · ไม่เก็บชื่อ/อีเมลของคน · ไม่ log token หรือ URL ของ callback

### UI (ถ้ามีการแก้หน้าจอ)
- [ ] ทุกหน้าอยู่ใน `<CsmjuAppShell>`
- [ ] ไม่มี hex สีหรือ px ดิบ ใช้ class จาก token ใน `@theme` เท่านั้น (ui-design-system.md ข้อ 3)
- [ ] ครบ 4 สถานะ: loading / empty / error / success
- [ ] ทุก input มี `<label>` ที่มองเห็นได้
- [ ] ทดสอบที่ 360px แล้วไม่มี horizontal scroll

### Security
- [ ] ไม่แก้ไฟล์ใน `.github/workflows/`
- [ ] ไม่มี hardcoded secret / connection string / API key
- [ ] ไม่มีไฟล์ `.env` ที่มีค่าจริงใน PR นี้

### สิ่งที่ AI ตรวจแทนไม่ได้ (AIE ยืนยันด้วยตนเอง)
- [ ] ทดสอบบนมือถือจริง (Android และ iOS อย่างน้อยอย่างละ 1 เครื่อง)
- [ ] ทดสอบด้วยคีย์บอร์ดจริง (กด Tab ไล่ทั้งหน้า)
- [ ] ตรวจข้อความไทยด้วยตาตนเองแล้ว ว่าเป็นภาษาที่คนใช้จริง

## หมายเหตุสำหรับ PL

<!-- จุดที่ไม่แน่ใจ / จุดที่ต้องการความเห็น / trade-off ที่เลือกไว้ -->
```

---

## 9. Repository Ruleset ระดับองค์กร

ตั้งที่ `Organization Settings → Repository rulesets` เพื่อให้กฎบังคับกับทุก repo พร้อมกัน และ AIE/PL ปิดเองไม่ได้

### 9.1 Ruleset: `csmju2030-main-protection`

```yaml
name: csmju2030-main-protection
enforcement: active
target: branch

bypass_actors:
  - actor: "@csmju2030/devops"
    bypass_mode: pull_request   # bypass ได้เฉพาะผ่าน PR ไม่ใช่ push ตรง

conditions:
  repository_name:
    include: ["csmju-*"]
  ref_name:
    include: ["refs/heads/main"]

rules:
  - type: pull_request
    parameters:
      required_approving_review_count: 1
      dismiss_stale_reviews_on_push: true
      require_code_owner_review: true
      require_last_push_approval: true
      required_review_thread_resolution: true

  - type: required_status_checks
    parameters:
      strict_required_status_checks_policy: true
      required_status_checks:
        - context: "Convention Check"
        - context: "Security & Stack Scan"
        - context: "Standards Version Check"
        - context: "Code Quality"
        - context: "API Contract Sync"
        - context: "Data Dictionary Compliance"
        - context: "UI Token Compliance"

  - type: required_linear_history
  - type: non_fast_forward          # ห้าม force push
  - type: deletion                  # ห้ามลบ branch
  - type: creation
    parameters:
      restrict: true
```

### 9.2 Ruleset: `csmju2030-branch-naming`

บังคับรูปแบบชื่อ branch ที่ระดับ GitHub เลย (ป้องกันตั้งแต่ push)

```yaml
name: csmju2030-branch-naming
enforcement: active
target: branch

conditions:
  repository_name:
    include: ["csmju-*"]
  ref_name:
    include: ["refs/heads/**"]
    exclude: ["refs/heads/main"]

rules:
  - type: branch_name_pattern
    parameters:
      operator: regex
      pattern: "^feature/[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*$"
      negate: false
```

### 9.3 Organization Settings อื่นที่ต้องตั้ง

| Setting | ค่า | เหตุผล |
|---|---|---|
| Base permissions | `Read` | AIE ไม่เห็น repo ที่ไม่เกี่ยวกับตน |
| Members can create repositories | ❌ | เฉพาะ DevOps สร้าง repo ได้ |
| Members can delete repositories | ❌ | ป้องกันลบโดยไม่ตั้งใจ |
| Members can change repo visibility | ❌ | ป้องกันเปลี่ยน private → public |
| Require 2FA for all members | ✅ | ความปลอดภัยบัญชี |
| Actions permissions | Allow select actions | จำกัด third-party action |
| Workflow permissions | Read repository contents (default) | หลัก least privilege |
| Allow GitHub Actions to approve PRs | ❌ | ป้องกัน bot approve ตัวเอง |

### 9.4 Allowed Actions List

```text
actions/*
github/codeql-action/*
pnpm/action-setup@*
dorny/paths-filter@*
csmju2030/*
```

Third-party action อื่นต้องขออนุมัติจาก DevOps และ pin ด้วย commit SHA

---

## 10. การจัดการ Secrets

### 10.1 กฎพื้นฐาน

| ประเภท | เก็บที่ไหน | ห้าม |
|---|---|---|
| DB connection string (dev) | `.env.local` บนเครื่อง AIE | commit เข้า repo |
| DB connection string (staging/prod) | GitHub Actions Secrets ระดับ repo | hardcode ใน workflow |
| `client_secret` ของ subsystem | Environment variable บน server | เขียนในโค้ด |
| Token ของผู้ใช้ (`access_token`) | httpOnly cookie / memory | `localStorage` |

### 10.2 ไฟล์ `.gitignore` ที่บังคับ

```gitignore
# Secrets — ห้าม commit เด็ดขาด
.env
.env.local
.env.*.local
.env.development
.env.production
*.pem
*.key

# Dependencies
node_modules/
.pnpm-store/

# Build output
.next/
dist/
build/
coverage/

# ยกเว้นไฟล์ template
!.env.example
```

### 10.3 ไฟล์ `.env.example` (ระบุชื่อ key เท่านั้น)

```env
# Database — ค่าจริงอยู่ใน .env.local ห้าม commit
DATABASE_URL=

# Core API credentials (ได้จากขั้นตอนขึ้นทะเบียน subsystem)
CSMJU_CLIENT_ID=
CSMJU_CLIENT_SECRET=

# Core endpoints
CSMJU_AUTH_URL=https://auth.csmju2030.ac.th
CSMJU_API_URL=https://api.csmju2030.ac.th
CSMJU_LOGIN_URL=https://login.csmju2030.ac.th

# Subsystem
SUBSYSTEM_NAME=
NEXT_PUBLIC_API_BASE_URL=
```

### 10.4 Secret Scanning ที่เปิดใช้

```text
✅ GitHub Secret scanning        (Settings → Code security)
✅ Push protection               (บล็อกตอน push ก่อนเข้า repo)
✅ Dependabot alerts
✅ Dependabot security updates
✅ Custom patterns (เพิ่ม pattern ของ CSMJU client_secret)
```

---

## 11. Exception Process

บางกรณีอาจมีเหตุผลจริงที่ต้องขอยกเว้น กระบวนการต้องมีร่องรอยตรวจสอบได้

```text
AIE พบว่าต้องละเมิดกฎข้อใดข้อหนึ่ง
        ↓
เปิด GitHub Issue ใน csmju2030-standards
ใช้ template "compliance-exception"
        ↓
ระบุ: รหัส check / เหตุผล / ทางเลือกที่ลองแล้ว / ผลกระทบ / ระยะเวลาที่ขอ
        ↓
PL รับรอง (comment approve)
        ↓
PM + DevOps พิจารณาร่วมกัน
        ↓
    ├─ ปฏิเสธ → AIE แก้โค้ดให้ตรงมาตรฐาน
    │
    └─ อนุมัติ → เพิ่มเข้า .compliance-exceptions.yml
                 (ต้องมี expiry date เสมอ)
                        ↓
                 บันทึกใน CHANGELOG.md
                        ↓
                 เมื่อครบกำหนด CI จะ fail อีกครั้ง
```

template คือฟอร์ม [`.github/ISSUE_TEMPLATE/compliance-exception.yml`](.github/ISSUE_TEMPLATE/compliance-exception.yml) —
กด New issue ใน `csmju2030-standards` แล้วเลือก "ขอข้อยกเว้นมาตรฐาน" · ฟอร์มถามครบทุกช่องข้างบน พร้อม `scope` และร่างรายการใน `.compliance-exceptions.yml`
· กฎในเอกสารที่ไม่มีตัวตรวจ CI ก็ยื่นด้วยฟอร์มนี้

### 11.1 ไฟล์ `.compliance-exceptions.yml`

วางใน root ของ subsystem repo แก้ได้เฉพาะ DevOps (คุมด้วย CODEOWNERS)

```yaml
# .compliance-exceptions.yml
version: 1

exceptions:
  - check: UI-01
    scope: "frontend/src/components/LegacyChart.tsx"
    reason: "library chart ภายนอกต้องรับ hex string ไม่รับ CSS variable"
    approved_by: ["@pm1", "@devops-lead"]
    issue: "csmju2030-standards#142"
    expires: "2026-12-31"

  - check: ARC-02
    scope: "backend/package.json"
    dependency: "node-cron"
    reason: "ต้องใช้ scheduled job สำหรับแจ้งเตือนของค้างคืน รอ PM เพิ่มเข้า whitelist"
    approved_by: ["@pm3"]
    issue: "csmju2030-standards#155"
    expires: "2026-10-15"
```

**ข้อกำหนด:**
- ทุก exception ต้องมี `expires` — ไม่มี exception ถาวร
- ทุก exception ต้องมี `issue` อ้างอิงกระบวนการอนุมัติ
- `scope` ต้องระบุไฟล์หรือ path เจาะจง ห้ามใช้ `*` กว้างๆ
- CI จะแสดง warning ทุกครั้งที่มี exception ที่ยังไม่หมดอายุ
- CI จะ fail ถ้าพบ exception ที่หมดอายุแล้ว

**ตัวตรวจที่อ่านไฟล์นี้** (ตั้งแต่ 1.4.0 · สาย 1.0.x ตั้งแต่ 1.0.3) — ไฟล์อยู่ใต้ CODEOWNERS ของ DevOps ระบบย่อยจึงยกเว้นตัวเองไม่ได้:

| check | `scope` | มีผลอย่างไร |
|---|---|---|
| `UI-01` | ไฟล์เดียว หรือโฟลเดอร์ที่ลงท้ายด้วย `/` | ไฟล์ในขอบเขตไม่ถูกตรวจ hex · ไฟล์อื่นตรวจตามปกติ — ใช้กับภาพที่วาดด้วยโค้ด เช่น ฉากและแผนที่ของเกม ส่วนเมนู ฟอร์ม ตาราง ต้องใช้ token กลาง |
| `ARC-02` | path ของ `package.json` + ต้องมี `dependency` | dependency นั้นผ่านเฉพาะใน `package.json` ที่ระบุ · **ไม่ยกเว้น `ARC-03`** (dependency ต้องห้าม) |

exception ที่ไม่มี `issue` · ใช้ `scope: "*"` · หรือเลย `expires` แล้ว **ไม่มีผล** (และ `EXC-01` ตก) · exception ที่มีผลขึ้น warning ใน log ของ CI ทุกครั้ง

---

## 12. แผนการติดตั้ง (Rollout Plan)

### สัปดาห์ที่ 1 — วางฐาน

| งาน | ผู้รับผิดชอบ | ผลลัพธ์ |
|---|---|---|
| สร้าง repo `csmju2030-standards` (Private) | DevOps | repo พร้อมใช้ |
| สร้าง GitHub Teams ทั้งหมด | DevOps | teams + สิทธิ์ตามข้อ 5.2 |
| ตั้ง Organization Settings ตามข้อ 9.3 | DevOps | org ล็อคแล้ว |
| ย้ายเอกสารมาตรฐานเข้า `docs/` | PM | เอกสารอยู่ที่เดียว |
| เปิด Secret scanning + Push protection | DevOps | scanning ทำงาน |

### สัปดาห์ที่ 2 — สร้างสคริปต์ชุดแรก

| งาน | ผู้รับผิดชอบ | หมายเหตุ |
|---|---|---|
| เขียนสคริปต์ `GH-01..04` | DevOps | เริ่มจากที่ง่ายและชัดเจน |
| เขียนสคริปต์ `SEC-01..05` | DevOps | ความปลอดภัยมาก่อน |
| เขียนสคริปต์ `ARC-01..03` | DevOps | สถาปัตยกรรมหลัก |
| สร้าง `self-test.yml` ทดสอบสคริปต์ | DevOps | มี fixture ทั้ง pass และ fail |
| สร้าง reusable workflow v0.1.0 | DevOps | ยังไม่บังคับใช้ |

### สัปดาห์ที่ 3 — Pilot กับ 1 ระบบย่อย

| งาน | ผู้รับผิดชอบ | เกณฑ์สำเร็จ |
|---|---|---|
| ติดตั้งใน `csmju-equipment` แบบ **warn only** | DevOps + AIE | CI รันได้ไม่ block |
| เก็บ false positive ที่พบ | AIE | รายการปัญหา |
| ปรับสคริปต์ให้แม่นขึ้น | DevOps | false positive < 5% |
| วัดเวลา CI | DevOps | < 5 นาที |

### สัปดาห์ที่ 4 — บังคับใช้ Pilot + เพิ่ม check

| งาน | ผู้รับผิดชอบ |
|---|---|
| เปลี่ยน pilot repo เป็น **blocking** | DevOps |
| ตั้ง Branch Protection + Ruleset จริง | DevOps |
| เขียนสคริปต์ `API-01..06`, `DD-01..05` | DevOps |
| เขียนสคริปต์ `UI-01..04`, `QA-01..05` | DevOps |
| tag `v1.0.0` ของ standards | PM + DevOps |

### สัปดาห์ที่ 5-6 — ขยายทุกระบบย่อย

| งาน | วิธี |
|---|---|
| วาง `ci.yml` + `CODEOWNERS` ทุก repo | สคริปต์ automation ผ่าน `gh` CLI |
| เพิ่ม submodule `standards/` ทุก repo | สคริปต์ automation |
| อบรม AIE ทุกคน (1 ชม.) | อธิบายรหัส check และวิธีอ่าน error |
| เปิดใช้ warn-only 1 สัปดาห์ | ให้ AIE แก้โค้ดเก่าให้ผ่าน |
| เปลี่ยนเป็น blocking ทั้งหมด | ประกาศล่วงหน้า 3 วัน |

### สัปดาห์ที่ 7+ — ดูแลต่อเนื่อง

- ทบทวน false positive รายสัปดาห์
- อัปเดต whitelist dependency ตามคำขอที่อนุมัติ
- ตรวจ exception ที่ใกล้หมดอายุ
- รายงานสถิติ compliance ให้ PM รายเดือน

---

## 13. Completion Criteria

### 13.1 Checklist การติดตั้ง

```text
Organization
[ ] Teams ทั้งหมดถูกสร้าง และกำหนดสิทธิ์ตามข้อ 5.2
[ ] Base permission = Read
[ ] Members ไม่สามารถสร้าง/ลบ/เปลี่ยน visibility ของ repo ได้
[ ] บังคับ 2FA ทุกบัญชี
[ ] Allowed Actions list ถูกจำกัดตามข้อ 9.4
[ ] Ruleset csmju2030-main-protection = active
[ ] Ruleset csmju2030-branch-naming = active

Standards repo
[ ] csmju2030-standards เป็น Private
[ ] เอกสารมาตรฐานทั้ง 7 ไฟล์อยู่ใน docs/
[ ] สคริปต์ตรวจครบทุกรหัสในข้อ 7.1
[ ] มี self-test.yml ที่ทดสอบสคริปต์ด้วย fixture
[ ] Reusable workflow ถูก tag เวอร์ชัน semver
[ ] Branch protection บน main ของ standards repo เอง
[ ] CHANGELOG.md บันทึกทุกการเปลี่ยนแปลง

Subsystem repo (ทำซ้ำทุก repo)
[ ] .github/workflows/ci.yml เรียก reusable workflow แบบ pin เวอร์ชัน
[ ] .github/CODEOWNERS ครบตามข้อ 5.1
[ ] .github/pull_request_template.md ถูกวาง
[ ] standards/ submodule ถูกเพิ่ม
[ ] .gitignore มี .env และ .env.local
[ ] .env.example มีชื่อ key ครบ ไม่มีค่าจริง
[ ] Required status checks ครบ 7 ตัว
[ ] feature PR ใช้ squash merge · repo ที่ใช้ develop เปิด merge commit ไว้ให้ PR develop ↔ main
[ ] ไม่มี secret หลงอยู่ใน git history
```

### 13.2 เกณฑ์วัดความสำเร็จ

| ตัวชี้วัด | เป้าหมาย |
|---|---|
| เวลา CI ต่อ PR | ≤ 5 นาที |
| อัตรา false positive | ≤ 5% |
| จำนวน PR ที่ merge เข้า main โดยไม่ผ่าน CI | 0 |
| จำนวน secret ที่หลุดเข้า repo | 0 |
| จำนวน exception ที่หมดอายุแล้วยังค้าง | 0 |
| ครอบคลุมกฎในเอกสารมาตรฐาน | ≥ 90% ของกฎที่ตรวจได้ด้วยเครื่อง |

---

## 14. หลักการกำกับ (Governing Principles)

> **1. กฎที่ไม่มีสคริปต์ตรวจ = กฎที่ไม่มีผลบังคับใช้**
> ถ้าเพิ่มกฎในเอกสารมาตรฐาน ต้องเพิ่มสคริปต์ตรวจในรอบเดียวกัน หรือระบุชัดว่าเป็นกฎที่ต้องพึ่งการ review ของคน

> **2. ผู้ถูกตรวจต้องไม่ควบคุมเครื่องมือตรวจ**
> AIE แก้ไฟล์ CI, CODEOWNERS หรือ exception file เองไม่ได้ (submodule pointer เลื่อนพร้อม `.standards-version` ได้ตั้งแต่ 1.5.1)

> **3. Error ต้องสอนได้ ไม่ใช่แค่ปฏิเสธ**
> ทุกข้อความ fail ต้องบอกไฟล์ บรรทัด ค่าที่ผิด ค่าที่ถูก เอกสารอ้างอิง และวิธีแก้

> **4. ไม่มีข้อยกเว้นถาวร**
> ทุก exception ใน `.compliance-exceptions.yml` มีวันหมดอายุ และมีร่องรอยการอนุมัติที่ตรวจสอบย้อนหลังได้
> ข้อยกเว้นเชิงสถาปัตยกรรมของ Core Hub (ข้อ 7.3) เป็นคนละเรื่อง — มันอยู่ในเอกสารมาตรฐาน ไม่ใช่ในไฟล์
> exception ของทีม และเปลี่ยนได้เฉพาะผ่าน PR ที่ขึ้นเวอร์ชัน standards

> **5. เริ่มจากเตือน แล้วค่อยบล็อก**
> ทุก check ใหม่ต้องผ่านช่วง warn-only ก่อนเปลี่ยนเป็น blocking เพื่อวัด false positive

---

*เอกสารนี้ต้องอัปเดตพร้อมกับทุกครั้งที่มีการเปลี่ยนแปลงเอกสารมาตรฐานอื่นในโครงการ*
*การเปลี่ยนแปลงที่ทำให้ CI เข้มขึ้น (เพิ่ม check หรือเปลี่ยน warn → fail) ถือเป็น MAJOR version*
