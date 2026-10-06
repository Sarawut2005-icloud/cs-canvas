# มาตรฐาน GitHub Workflow
**โครงการ:** CSMJU2030 (ระบบ MIS สาขาวิชาวิทยาการคอมพิวเตอร์)
**ดูแลโดย:** ทีม Infrastructure & DevOps

เอกสารฉบับนี้คือข้อกำหนดด้านการจัดการซอร์สโค้ด บังคับใช้กับทุกระบบย่อย (Subsystem) โดยอ้างอิงจากแผนสถาปัตยกรรมระบบและการบริหารจัดการทีมพัฒนา (CSMJU2030-PM)

---

## 1. GitHub Workflow และการทำงานร่วมกัน

เพื่อให้ AIE และ PL ทำงานร่วมกันได้อย่างเป็นระบบและโค้ดไม่พัง ให้ปฏิบัติตามกฎและลำดับการทำงาน (Flow) จากส่วนกลางอย่างเคร่งครัด:

### 1.1 กฎเหล็กของ Workflow
1. **Branch Protection:** ไม่ push ตรงเข้า `main` และ `develop` เด็ดขาด ทุกอย่างเข้าผ่าน PR
2. **Reviewer:** กำหนด CODEOWNERS ให้ PL (Project Lead) เป็น required reviewer ของ `main` (และ `develop` ถ้ามี) เสมอ
3. **Feature Branch:** AIE ต้องทำงานใน feature branch เท่านั้น
4. **Naming Convention:** ใช้ branch naming รูปแบบ `feature/<subsystem>/<เรื่องที่ทำ>` ข้อยกเว้นมีแค่ PR ระหว่าง `develop` กับ `main` (ข้อ 1.5)
5. **CI/CD:** CI จะรัน automated compliance ทุกครั้งที่เปิด PR

### 1.2 ขั้นตอนการทำงานจริง (Git Commands สำหรับ AIE)
เมื่อเริ่มต้นพัฒนาฟีเจอร์ใหม่ ให้ทำตามลำดับคำสั่งนี้:

**ขั้นตอนที่ 1:** แตก Branch ใหม่จาก branch หลักล่าสุด (ใช้ naming convention ตามข้อ 1.1 ข้อ 4)
repo ที่มี `develop` ให้แตกจาก `develop` · repo ที่ไม่มีให้แตกจาก `main` (ข้อ 1.5)
```bash
git switch develop
git pull
git switch -c feature/equipment/add-borrow-return
```

**ขั้นตอนที่ 2:** ให้ `standards/` ในเครื่องตรงกับเวอร์ชันที่ repo ผูกไว้ก่อนเขียนโค้ดเสมอ (อ่านกฎชุดเดียวกับที่ CI ใช้ตรวจ)
```bash
git submodule update --init standards/
```
ห้ามใช้ `--remote` เพราะจะเลื่อน submodule ไปที่ `main` ของ standards ซึ่งไม่ใช่ tag ที่ `.standards-version` ระบุ
และ CI จะตก `GH-04` ถ้า commit ไป · การเลื่อนเวอร์ชันทำเป็น PR แยกตาม [`standards-versioning.md`](standards-versioning.md)

**ขั้นตอนที่ 3:** พัฒนาโค้ด เมื่อเสร็จแล้วให้เพิ่มไฟล์และ Commit
```bash
git add .
git commit -m "feat(equipment): add borrow-return flow"
```

**ขั้นตอนที่ 4:** Push ขึ้น Repository 
```bash
git push origin feature/equipment/add-borrow-return
```

**ขั้นตอนที่ 5:** เปิด Pull Request (PR) ให้ PL ตรวจสอบ (ผ่าน GitHub UI หรือ gh cli)
PR ต้องเข้า branch เดียวกับที่แตกออกมาในขั้นตอนที่ 1 (repo ที่ไม่มี `develop` ใช้ `--base main`)
```bash
gh pr create --base develop --title "feat(equipment): add borrow-return flow"
```

> **หมายเหตุ:** ชื่อ commit และ PR title ต้องตาม Commit Convention ในข้อ 1.3

---

### 1.3 Commit Message Convention

บังคับใช้รูปแบบ [Conventional Commits](https://www.conventionalcommits.org/) เพื่อให้ generate changelog อัตโนมัติได้ และเพื่อให้ PL scan ประวัติงานได้เร็ว:

```
<type>(<subsystem-scope>): <คำอธิบายสั้นๆ ภาษาอังกฤษหรือไทยก็ได้>
```

**Type ที่อนุญาต:**
| Type | ใช้เมื่อ |
|---|---|
| `feat` | เพิ่มฟีเจอร์ใหม่ |
| `fix` | แก้บั๊ก |
| `chore` | งานเบื้องหลัง (อัปเดต dependency, config) |
| `refactor` | ปรับโครงสร้างโค้ดโดยไม่เปลี่ยนพฤติกรรม |
| `docs` | แก้เอกสาร |
| `test` | เพิ่ม/แก้ test |
| `ci` | แก้ CI/CD pipeline (ยกเว้นแก้ไฟล์ใน `.github/workflows/` ตรงๆ ซึ่งห้ามตามข้อ 5) |

**ตัวอย่าง:**
```
feat(equipment): add borrow-return flow
fix(equipment): correct due-date calculation timezone bug
```

**PR ควรเล็กและโฟกัสเรื่องเดียว** — ถ้า PR แตะทั้ง frontend และ backend logic ที่ไม่เกี่ยวกัน ให้แยกเป็นคนละ PR เพื่อให้ PL review ได้ไวและ diff อ่านง่าย

---

### 1.4 แนวทางทำงานเดี่ยวต่อ Subsystem

แต่ละ subsystem มี AIE รับผิดชอบ 1 คน (1 คน = 1 ระบบย่อย) จึงไม่มี concurrent conflict ภายใน repo เดียวกัน แต่ยังต้องรักษาวินัยดังนี้:

1. **ตามเวอร์ชัน standards ให้ทัน:** ดู `CHANGELOG.md` ของ standards เมื่อมี tag ใหม่ แล้วเลื่อน `.standards-version` กับ submodule `standards`
   เป็น PR แยกตามจังหวะของทีม ([`standards-versioning.md`](standards-versioning.md)) — ไม่ต้องรอ DevOps เพราะไม่ต้องแตะ `ci.yml`
2. **Branch อายุสั้น:** feature branch ไม่ควรค้างเกิน 2-3 วัน เพื่อให้ PL review ทัน และลดความเสี่ยงที่ branch หลักเปลี่ยนไปมากจนต้อง resolve conflict ตอน merge
3. **Merge strategy:** PR จาก feature branch ใช้ **Squash and merge** เท่านั้น เพื่อให้ 1 PR = 1 commit ใน history
   ส่วน PR ระหว่าง `develop` กับ `main` ใช้ **Create a merge commit** (เหตุผลอยู่ในข้อ 1.5)
4. **Cross-subsystem dependency:** ถ้างานต้องพึ่งพา API ของ subsystem อื่น ให้ประสานผ่าน `openapi.json` ของ subsystem นั้น (ดูข้อ 3 ใน tech-stack.md) แทนการเข้าไปแก้ repo อื่นเอง

---

### 1.5 Branch หลักสองตัว: `develop` และ `main`

repo ที่มีหลายคนทำงานพร้อมกัน หรือมีเครื่อง dev server กลาง ให้แยก branch หลักเป็น 2 ตัว
งานทุกชิ้นรวมกันและทดสอบด้วยกันที่ `develop` ก่อน แล้วค่อยขึ้น `main`

| branch | ใช้ทำอะไร | deploy ไปที่ |
|---|---|---|
| `develop` | รวมงานทุก feature แล้วทดสอบด้วยกัน | dev server |
| `main` | เฉพาะของที่ผ่านการทดสอบบน dev server แล้ว | production |

**repo ไหนใช้:** Core Hub **ต้องใช้** · ระบบย่อย**เลือกใช้ได้** (แนะนำเมื่อมีคนทำมากกว่า 1 คน หรือมี dev server) ·
repo มาตรฐาน**ไม่ใช้** เพราะ tag ทำหน้าที่เป็น release อยู่แล้ว และระบบย่อยปักหมุดตาม tag

```text
feature/<subsystem>/<เรื่อง>  →  PR (squash)  →  develop  →  ทดสอบบน dev server  →  PR (merge commit)  →  main
```

| งาน | แตกจาก | PR | วิธี merge |
|---|---|---|---|
| feature หรือแก้บั๊กทั่วไป | `develop` | เข้า `develop` | Squash and merge |
| ขึ้น production (release) | — | `develop` → `main` | **Create a merge commit** |
| hotfix (production พังต้องแก้ด่วน) | `main` | เข้า `main` | Squash and merge |
| ดึง hotfix กลับเข้า develop | — | `main` → `develop` | **Create a merge commit** |

hotfix ใช้ชื่อ branch แบบ feature ตามปกติ เช่น `feature/core-hub/hotfix-login-loop` · PR `develop` → `main` และ `main` → `develop`
เป็นข้อยกเว้นเดียวของกฎชื่อ branch (`GH-01` ดูจาก base ของ PR)

**ทำไม PR ระหว่าง `develop` กับ `main` ห้าม squash:** squash สร้าง commit ใหม่บน `main` ที่ `develop` ไม่มี
รอบ release ถัดไป GitHub จะเห็นงานเก่าทั้งหมดเป็นของใหม่อีกครั้ง PR จะรวม commit เดิมซ้ำและชนกันซ้ำทุกรอบ
merge commit ทำให้ `main` มี commit ชุดเดียวกับ `develop` และ history ยังอ่านง่าย เพราะแต่ละ feature ถูก squash เหลือ 1 commit ตั้งแต่ตอนเข้า `develop`

**กติกา**
1. `develop` ต้องใช้งานได้เสมอ เพราะทุกคนทดสอบบนนั้น PR ที่ทำให้ dev server พังต้องแก้หรือ revert ทันที
2. ขึ้น production บ่อย ๆ อย่างน้อยทุกสัปดาห์ที่มีงานเข้า `develop` ยิ่งปล่อยให้ `develop` ห่างจาก `main` นานยิ่ง merge ยาก
3. PR release ต้องทดสอบบน dev server ครบก่อน และต้องเขียนรายการงานที่ขึ้นในรอบนั้นไว้ใน PR
4. merge release แล้วติด tag เวอร์ชันบน `main` (เช่น `v1.1.0`) เพื่อให้รู้ว่า production เป็นเวอร์ชันไหนและย้อนกลับได้
5. merge hotfix เข้า `main` แล้วต้องเปิด PR `main` → `develop` ทันที ไม่งั้น `develop` จะยังมีบั๊กเดิม และรอบ release ถัดไปอาจชนกัน
6. PR ที่มี migration ใหม่ต้องเขียนไว้ใน PR ว่าต้องรัน `prisma migrate deploy` ทั้งบน dev server และในเครื่องของทุกคนที่ดึง `develop`

**ตั้งค่าครั้งแรก** (PL หรือ DevOps ทำครั้งเดียวต่อ repo)
1. สร้าง `develop` จาก `main` แล้ว push
2. ให้ `.github/workflows/ci.yml` รัน PR ที่เข้า `develop` ด้วย (`branches: [main, develop]` ซึ่ง `templates/ci.yml` มีให้แล้ว) ระบบย่อยต้องให้ DevOps แก้ไฟล์นี้เพราะ AIE แก้ไม่ได้ (`GH-03`)
3. ตั้ง default branch เป็น `develop` (Settings → General → Default branch) เพื่อให้ PR ใหม่ชี้ `develop` เอง
   **ต้องทำก่อน merge PR release ครั้งแรก** เพราะถ้าเปิด "Automatically delete head branches" ไว้ GitHub จะลบ head branch ของ PR ที่ merge แล้ว
   ยกเว้น default branch (ถ้า `develop` ถูกลบไป กดปุ่ม Restore branch ในหน้า PR ได้)
4. เปิด "Allow merge commits" คู่กับ "Allow squash merging" (Settings → General → Pull Requests) โดย merge commit ใช้กับ PR ระหว่าง `develop` กับ `main` เท่านั้น
5. ตั้ง dev server ให้ deploy จาก `develop`

---

## 2. Monorepo Tooling ภายใน 1 Subsystem

เนื่องจากแต่ละ repo บรรจุทั้ง `frontend/` และ `backend/` ไว้ด้วยกัน (monorepo ระดับ subsystem) ต้องมีเครื่องมือจัดการเพื่อไม่ให้ CI ช้าและ dependency ปนกัน:

*   **Package manager:** ใช้ **pnpm** พร้อม `pnpm-workspace.yaml` แยก workspace ระหว่าง `frontend` และ `backend` (ห้ามใช้ `npm install` เดี่ยวๆ ที่ root)
*   **Task runner:** ใช้ `pnpm -r <script>` และ `pnpm --filter <workspace> <script>` เป็นพื้นฐาน — ทั้ง Core Hub และ
    reference implementation ใช้แค่นี้ **Turborepo ใช้ได้แต่ไม่บังคับ** (อยู่ใน whitelist) เพิ่มเมื่อ repo โตจนเวลา CI เป็นปัญหาจริง
*   **ชื่อ workspace ต้องไม่ซ้ำกัน** — ถ้า `name` ใน `package.json` ที่รากซ้ำกับของ `backend/`
    `pnpm --filter backend test` จะไม่ match อะไรเลยแล้วคืน exit 0 (กฎ `QA-06` ดู [`repo-structure.md`](repo-structure.md) ข้อ 3)

---

## 3. CI Compliance Checklist (`.github/workflows/`)

เพื่อให้ CI pipeline มาตรฐานตรวจอย่างน้อยดังนี้ทุก PR ที่เข้า `main` หรือ `develop`:

1. **Lint & Format:** ESLint + Prettier ผ่านทั้ง `frontend/` และ `backend/`
2. **Type Check:** `tsc --noEmit` ผ่านทั้งสองฝั่ง 
3. **Unit Test:** รัน test suite ของ workspace ที่ถูกแก้ (ผ่าน coverage ขั้นต่ำที่ทีมกำหนด)
4. **Stack Compliance Scan:** สคริปต์ตรวจ `package.json` ว่าไม่มี dependency นอกเหนือจาก Next.js/NestJS/Prisma stack ที่อนุญาต
5. **Secret/DB-Isolation Scan:** grep หา connection string หรือ `pg`/`prisma client` import ใน `frontend/` — ถ้าเจอ ให้ CI fail ทันที
6. **Standards Version Check (`GH-04`):** CI ตรวจด้วยชุดตรวจของเวอร์ชันใน `.standards-version` และ submodule `standards/` ต้องชี้ tag เดียวกัน
   (ไม่ต่ำกว่า `MIN_VERSION` และไม่ถอยจาก branch ปลายทาง — [`standards-versioning.md`](standards-versioning.md))
7. **Build:** `next build` และ `nest build` ต้องผ่านทั้งคู่ก่อน merge ได้

> **repo ที่ DevOps สร้างด้วย `new-subsystem.sh` มีไฟล์ CI ครบตั้งแต่ commit แรก** — ทีมไม่ต้องเพิ่มไฟล์ CI เอง
> ข้อยกเว้นของ `GH-03` เหลือแค่ repo เดิมที่ติดตั้งมาตรฐานผ่าน PR: PR นั้นต้องเพิ่ม `.github/workflows/ci.yml`
> และ `CODEOWNERS` ซึ่ง `GH-03` ห้ามแตะ จึงให้ DevOps merge โดย override ผลของ `GH-03` ครั้งเดียว
> (submodule `standards/` ไม่อยู่ในรายการห้ามแล้ว — ทีมเลื่อนเองตาม `GH-04`) หลังจากนั้นกฎบังคับเต็มตามปกติ

---

## 4. Secrets & Environment Management

*   ห้าม commit ไฟล์ `.env`, `.env.local` เข้า repo เด็ดขาด (ต้องอยู่ใน `.gitignore` ตั้งแต่ scaffold แรก)
*   ใช้ `.env.example` เป็น template ระบุชื่อ key ที่ต้องมี (ไม่ใส่ค่าจริง) ให้ AIE คนใหม่ copy ไปตั้งค่าเอง
*   Secret สำหรับ CI/CD (เช่น DB URL ของ staging) เก็บใน **GitHub Actions Secrets** ระดับ repo เท่านั้น ห้าม hardcode ในไฟล์ workflow
*   Backend เป็นจุดเดียวที่ถือ DB connection string จริง 

---

## 5. System Prompt สำหรับ AI (GitHub Workflow)

*สำหรับป้อนให้ AI Agent ก่อนเริ่มเขียนโค้ด เพื่อให้ AI ปฏิบัติตามมาตรฐานโปรเจกต์:*

```text
คุณคือ AI Assistant สำหรับเขียนโค้ดในโครงการ CSMJU2030 (1 ระบบย่อย = 1 Repo) กรุณาปฏิบัติตามกฎต่อไปนี้อย่างเคร่งครัด:

1. GitHub Actions:
   - ห้ามแก้ไขไฟล์ในโฟลเดอร์ `.github/workflows/`
2. Monorepo Tooling:
   - ใช้ pnpm workspace เท่านั้นสำหรับจัดการ frontend/backend ภายใน repo เดียวกัน ห้ามใช้ npm/yarn (กฎ `QA-05`)
   - ตั้งชื่อ `name` ใน package.json ของแต่ละ workspace ไม่ให้ซ้ำกัน (กฎ `QA-06`)
3. Commit Convention:
   - ทุก commit และ PR title ต้องตาม Conventional Commits รูปแบบ `<type>(<subsystem-scope>): <คำอธิบาย>` เช่น `feat(equipment): add borrow-return flow`
4. Secrets:
   - ห้าม hardcode connection string, API key หรือค่าลับใดๆ ในโค้ด ต้องอ่านจาก environment variable เท่านั้น และห้ามสร้าง/แก้ไฟล์ .env ที่มีค่าจริงเข้า repo
5. Branch:
   - ถ้า repo มี branch `develop` ให้แตก feature branch จาก `develop` และเปิด PR เข้า `develop` ถ้าไม่มีให้ใช้ `main`
   - ห้าม push ตรงเข้า `main` หรือ `develop` และห้ามเปิด PR `develop` → `main` เอง (เป็นหน้าที่ของ PL)
```
