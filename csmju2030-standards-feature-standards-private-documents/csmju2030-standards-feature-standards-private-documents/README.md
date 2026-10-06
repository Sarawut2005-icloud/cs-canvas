# csmju2030-standards

มาตรฐานกลางและ automated compliance gate ของโครงการ **CSMJU2030**
(ระบบ MIS สาขาวิชาวิทยาการคอมพิวเตอร์ — 1 ระบบย่อย = 1 repo)

repo นี้เป็นแหล่งความจริงเพียงแหล่งเดียวของกฎที่ทุกระบบย่อยต้องทำตาม
และเป็นที่อยู่ของสคริปต์ที่ CI ใช้ตรวจจริง ระบบย่อยไม่ต้องคัดลอกกฎไปเก็บเอง
แค่ชี้มาที่นี่

**เวอร์ชันปัจจุบัน:** ดู [`VERSION`](VERSION) · การเปลี่ยนแปลง: [`CHANGELOG.md`](CHANGELOG.md)

> **ทุกทีมใช้สาย 1.7.x** (สายนิ่ง) — ตรงกับ Core Hub ตัวจริงที่ `https://csmju2030.jowave.com`
> สาย 1.0.x ปิดแล้ว (1.0.6 เป็นตัวสุดท้าย) · วิธีเลื่อนและย้ายสาย: [`docs/standards-versioning.md`](docs/standards-versioning.md)

มาตรฐานเขียนจาก **ระบบที่ทำงานได้จริง** ไม่ใช่จากการออกแบบล่วงหน้า:
`csmju-core-hub` (Core Hub จริง) และ `demo-student-subsystem` (reference implementation — ระบบจองห้อง)

---

## ถ้าคุณเป็น AIE (คนเขียนโค้ดระบบย่อย)

อ่าน 4 ไฟล์แรกก่อนเริ่ม แล้วค่อยกลับมาดูตัวอื่นเมื่อต้องใช้

| อ่านเพื่อ | ไฟล์ |
|---|---|
| **เริ่มที่นี่ (AIE)** — ลำดับขั้นตอนตั้งแต่ศูนย์จนส่งมอบ | [`docs/aie-workflow.md`](docs/aie-workflow.md) |
| **เริ่มที่นี่** — ภาพรวมและสถานะจริงของสถาปัตยกรรม | [`docs/overview.md`](docs/overview.md) |
| **เชื่อมระบบย่อยกับ Core Hub จริง** — บัญชี · ลงทะเบียน · env · ทดสอบ · ปัญหาที่พบบ่อย | [`docs/connect-core-hub.md`](docs/connect-core-hub.md) |
| **ข้อมูลกลางที่ Core Hub มีให้** — เรียกยังไง และระบบย่อยเก็บอะไรได้ | [`docs/reference-data.md`](docs/reference-data.md) |
| JWT · JWKS · SSO · callback | [`docs/auth-contract.md`](docs/auth-contract.md) |
| role mapping · permission · 401/403 | [`docs/authorization.md`](docs/authorization.md) |
| stack ที่บังคับ + เวอร์ชัน และกฎ Database Isolation | [`docs/tech-stack.md`](docs/tech-stack.md) |
| ดีไซน์และการออกแบบ | [`docs/ui-design-system.md`](docs/ui-design-system.md) |
| รูปแบบ API ที่ต้องทำตาม | [`docs/api-conventions.md`](docs/api-conventions.md) |
| ชื่อตาราง/คอลัมน์ · migration | [`docs/data-dictionary.md`](docs/data-dictionary.md) |
| ลงทะเบียนระบบย่อยกับ Core Hub | [`docs/subsystem-registry.md`](docs/subsystem-registry.md) |
| เกณฑ์ผ่าน/ไม่ผ่าน และวิธีรัน | [`docs/conformance.md`](docs/conformance.md) |
| วิธีแตก branch, ตั้งชื่อ commit, เปิด PR | [`docs/github-workflow.md`](docs/github-workflow.md) ข้อ 1 |
| เลื่อนเวอร์ชัน standards ของระบบย่อย (ทำเองได้) | [`docs/standards-versioning.md`](docs/standards-versioning.md) |
| Dockerfile · image บน ghcr.io · ขึ้น server | [`docs/deployment.md`](docs/deployment.md) |
| กฎของ Core Hub และข้อยกเว้น (ทีม Core Hub เท่านั้น) | [`docs/core-hub-rules.md`](docs/core-hub-rules.md) |
| ใช้ AI ช่วยเขียนโค้ด | [`ai/AGENTS.md`](ai/AGENTS.md) · [`ai/TASK_TEMPLATE.md`](ai/TASK_TEMPLATE.md) |

ขั้นตอนทำงานปกติ

```bash
git submodule update --init standards/        # ให้ standards/ ตรงกับ .standards-version (ห้ามใส่ --remote)
git checkout -b feature/<subsystem>/<เรื่องที่ทำ>  # repo ที่มี develop ให้แตกจาก develop
# ...เขียนโค้ด...
git commit -m "feat(<subsystem>): <คำอธิบาย>"
git push origin feature/<subsystem>/<เรื่องที่ทำ>
gh pr create --base main                       # repo ที่มี develop ใช้ --base develop
```

repo ที่มีหลายคนทำพร้อมกันหรือมี dev server (เช่น Core Hub) ใช้ `develop` เป็นที่รวมงานก่อนขึ้น `main`
ดูกติกาใน [`docs/github-workflow.md`](docs/github-workflow.md) ข้อ 1.5

### ตรวจเองก่อนเปิด PR (ไม่ต้องรอ CI)

```bash
./standards/scripts/run-all-checks.sh .        # static — เช็คเดียวกับ CI (ยกเว้น GH-04 ที่ตรวจ tag · MIN_VERSION · การถอยเวอร์ชันบน CI)
node standards/conformance/run.js              # runtime — ยิงระบบที่รันอยู่จริง (บัญชีอ่านจากไฟล์นอก repo — docs/conformance.md)
```

> ทีม Core Hub ใช้ `./scripts/run-core-hub-checks.sh /path/to/csmju-core-hub` แทน — มันตั้ง
> `CSMJU_PROFILE=core-hub` และข้ามกฎที่ขัดกับหน้าที่ของ Core Hub ตาม [`docs/core-hub-rules.md`](docs/core-hub-rules.md)

การตรวจมี **สองชั้น** และต้องผ่านทั้งคู่:

| ชั้น | ตรวจอะไร | รันเมื่อไร |
|---|---|---|
| `scripts/` (static) | ซอร์สโค้ด: naming · dependency · secret · commit · openapi sync | ทุก PR |
| `conformance/` (runtime) | พฤติกรรมจริงผ่าน HTTP ตามสัญญา (L1/L2/L3) | nightly + ก่อน release |

CI ตรวจว่า "เขียนถูกกฎ" · conformance ตรวจว่า "ทำงานได้จริงตามสัญญา"

---

## กฎที่ CI บังคับ

ทุก PR ที่เข้า `main` หรือ `develop` จะรัน 8 job นี้ ต้องเขียวหมดจึง merge ได้

| Job | ตรวจอะไร |
|---|---|
| Convention Check | ชื่อ branch, commit message, ห้ามแก้ไฟล์ CI เอง |
| Standards Version Check | `.standards-version` มี tag จริง ไม่ต่ำกว่า `MIN_VERSION` ไม่ถอยเวอร์ชัน และ submodule `standards` ชี้ tag เดียวกัน |
| Security & Stack Scan | secret, token ใน localStorage, JWT verify เอง, DB isolation, dependency นอก whitelist |
| API Contract Sync | `openapi.json` sync กับโค้ด, รูปแบบ API |
| Data Dictionary Compliance | ชื่อฟิลด์ต้องห้าม, snake_case, รายชื่อคณะ hardcode, ฟิลด์เงินเป็น float |
| UI Token Compliance | สีดิบแทน design token |
| Code Quality | lint, typecheck, unit test, build, บังคับ pnpm |
| Exception Validation | `.compliance-exceptions.yml` ถูกต้องและไม่หมดอายุ |

กฎแต่ละข้อมีรหัสกำกับ (`SEC-01`, `DD-04`, `QA-03` …) เวลา CI ตีตกจะบอกรหัส
ข้อความ พร้อมชี้ว่าอ้างอิงเอกสารข้อไหน และวิธีแก้

รายละเอียดกฎทุกข้อ: [`ci-compliance-spec.md`](ci-compliance-spec.md) §7

---

## ถ้าคุณเป็น DevOps

### สร้างระบบย่อยใหม่

```bash
./new-subsystem.sh payroll "ระบบเงินเดือน"
```
สร้างโครงไฟล์, ตรวจ compliance กับของที่สร้าง, สร้าง repo บน GitHub, push,
แล้วผูก standards submodule และตั้ง ruleset ให้ — ถ้า scaffold ไม่ผ่าน compliance
จะหยุดก่อนสร้างอะไรบน GitHub

### ตั้ง branch protection

```bash
./org-settings/apply-rulesets.sh validate <repo>   # ลองยิง payload แบบ disabled แล้วลบ
./org-settings/apply-rulesets.sh repo csmju-payroll
./org-settings/apply-rulesets.sh sweep --dry-run   # ไล่ทุก repo ดูว่าตัวไหนยังขาด
./org-settings/apply-rulesets.sh org               # ต้องมี scope admin:org
```

plan Free ไม่มี org ruleset — `new-subsystem.sh` ตั้งให้ตอนสร้าง และ workflow
`ruleset-sweep.yml` ตามเก็บตัวที่หลุดทุกชั่วโมง

งานตั้งค่าระดับ organization ที่สคริปต์ทำแทนไม่ได้ อยู่ใน
[`org-settings/org-settings-checklist.md`](org-settings/org-settings-checklist.md)

### ทดสอบว่าสคริปต์ยังทำงานถูก

```bash
./scripts/self-test.sh
```
รันทุก check กับ fixture pass/fail ใน `__fixtures__/` แล้วเทียบ exit code
**ทุก PR ที่แก้ `scripts/` ต้องให้ชุดนี้ผ่านก่อน**

---

## โครงสร้าง repo

```
docs/              เอกสารมาตรฐาน — คนอ่าน
ai/                กติกา + เทมเพลตสั่งงาน AI + checklist ส่งงาน
contracts/         สัญญาที่เครื่องอ่านได้ (jwt · error-codes · vocabulary · log-events · openapi)
conformance/       ชุดทดสอบ runtime แบบ black-box (Node 20+ ไม่มี dependency)
scripts/           กฎที่บังคับจริง (check-*.sh) + self-test + run-all-checks + run-core-hub-checks
scripts/lib/       allowed-deps.json — whitelist dependency
schemas/           JSON Schema ของ shared data + subsystem.yaml
fixtures/          บัญชี dev ของ Core Hub + manifest ตัวอย่าง (ใช้กับ conformance)
templates/         ไฟล์ที่ทุก subsystem repo ต้องมีเหมือนกัน (subsystem.yaml, ci.yml, …)
                   และ csmju-subsystem-web/ = หน้าเว็บตั้งต้นของ frontend/ (ui-design-system.md ข้อ 17.0)
org-settings/      ruleset + checklist ที่ต้องตั้งในหน้า Settings ของ GitHub
__fixtures__/      ตัวอย่าง pass/fail สำหรับ self-test
.github/workflows/ subsystem-compliance.yml · core-hub-compliance.yml (reusable) · self-test.yml · ruleset-sweep.yml
                   (conformance-nightly.yml เป็น template ใน templates/ สำหรับ repo ระบบย่อย)
```

> `docs/` คนอ่าน · `contracts/` เครื่องอ่าน · ถ้าสองอย่างขัดกันให้ยึด `contracts/` แล้วแจ้ง PL

**จุดที่มักเข้าใจสลับกัน:** ไฟล์ `.yml` รายงานผ่าน/ไม่ผ่านได้เท่านั้น
มันห้าม merge ไม่ได้ด้วยตัวเอง สิ่งที่ห้ามได้จริงคือ required status checks
ใน ruleset ซึ่งเป็น setting บน GitHub ไม่ใช่ไฟล์ในโค้ด

---

## จะแก้กฎหรือเอกสาร ทำอย่างไร

กฎอยู่ใน `scripts/` เอกสารอยู่ใน `docs/` — สองอย่างนี้ต้องตรงกันเสมอ
ถ้าไม่ตรง จะเกิดสภาพ "ทำตามเอกสารแล้ว CI ตีตก" หรือแย่กว่านั้นคือ
"ทำตามเอกสารแล้วต่อกับ Core Hub จริงไม่ได้" ซึ่งเป็นเหตุผลที่ v1.0 เขียนใหม่
จากระบบที่รันได้จริงทั้งหมด (ดู `CHANGELOG.md` 1.0.0)

ลำดับที่ต้องทำใน PR เดียว

1. แก้เอกสารใน `docs/` และระบุ errata ว่าแก้อะไรเพราะอะไร
2. แก้สคริปต์ใน `scripts/` ให้ตรงกับเอกสาร
3. เพิ่ม fixture `__fixtures__/<รหัสกฎ>/{pass,fail}` ที่พิสูจน์กฎใหม่
4. `./scripts/self-test.sh` ต้องผ่าน
5. bump `VERSION` + `STANDARDS_ENTRY_REF` ใน `subsystem-compliance.yml` / `core-hub-compliance.yml` (self-test ตรวจว่าตรงกัน) + เขียน `CHANGELOG.md`
6. ติด tag ใหม่ แล้วแจ้งให้แต่ละ subsystem เลื่อน `.standards-version` และ submodule `standards`
   ตามจังหวะตัวเอง (ไม่ต้องแก้ `ci.yml` — [`docs/standards-versioning.md`](docs/standards-versioning.md))

subsystem แต่ละตัวเลือกเวอร์ชันเองใน `.standards-version` จึงไม่มีใครถูกเปลี่ยนกฎกลางคันโดยไม่รู้ตัว
ถ้าต้องบังคับให้ทุกทีมขึ้นเวอร์ชันใด DevOps ยก `MIN_VERSION` บน `main`

---

## สถานะที่ยังไม่เสร็จ

ยืนยันแล้วว่าใช้งานได้จริง: PR ทดสอบบน `csmju-equipment` (#1 และ #2) รันครบ
ทั้ง 8 job ผ่านหมด และ `mergeStateStatus` เป็น `BLOCKED` เพราะรอ review ตามที่
ตั้งใจ — คือ gate บล็อก merge ได้จริง ไม่ใช่แค่รายงานผล

| เรื่อง | สถานะ |
|---|---|
| Teams `devops` `pm` `pl-equipment` `aie-equipment` | ✅ สร้างและผูกสิทธิ์แล้ว |
| org settings, Actions allow-list, secret scanning, Dependabot | ✅ ตั้งแล้ว — รายละเอียดใน `org-settings/org-settings-checklist.md` |
| ruleset ระดับ repo | ✅ ทั้ง 2 repo |
| **ruleset ระดับ org** | ❌ ต้องมี plan **GitHub Team** — API ตอบ 403 ตรง ๆ บน Free ใช้ `new-subsystem.sh` + workflow Ruleset Sweep แทน |
| Ruleset Sweep credential | ⬜ ต้องสร้าง GitHub App — ขั้นตอนใน `org-settings/org-settings-checklist.md` |
| Require 2FA / ห้าม member ลบ repo / เปลี่ยน visibility | ⬜ ต้องตั้งในหน้าเว็บ |
| สมาชิกจริงใน team `pl-*` / `aie-*` | ⬜ ยังมีแค่เจ้าของ org — จนกว่าจะมีคนจริง PR จะ approve ไม่ได้นอกจากใช้ bypass ของ devops |
| standards repo เป็น private | ⬜ ต้องทำ GitHub App ก่อน (เหตุผลอยู่ในหัว `new-subsystem.sh`) |
