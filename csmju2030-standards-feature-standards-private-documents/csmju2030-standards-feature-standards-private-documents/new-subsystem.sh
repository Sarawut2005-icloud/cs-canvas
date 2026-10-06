#!/usr/bin/env bash
# new-subsystem.sh — สร้าง subsystem repo ใหม่ให้ผ่าน compliance ตั้งแต่ commit แรก
#
#   ./new-subsystem.sh payroll "ระบบเงินเดือน"
#
# ชื่อ repo ปกติเป็น csmju-<slug> อัตโนมัติ ถ้าต้องตั้งชื่ออื่น (เช่นของกลางที่
# ไม่ใช่ระบบย่อย) ให้ override ด้วย REPO_NAME แต่ยังต้องส่ง slug ตัวเล็กมาด้วย
# เพราะ slug ถูกใช้ตั้งชื่อ team และชื่อ branch ที่ ruleset บังคับรูปแบบไว้
#
#   REPO_NAME=CSMJU2030-BE-Core_Hub ./new-subsystem.sh core-hub "Backend Core Hub"
#
# ต้องมี: gh CLI ที่ login แล้ว และสิทธิ์สร้าง repo ใน org
#
# สิ่งที่สคริปต์นี้ทำ
#   1. สร้างโครงไฟล์ให้ผ่านทุก check (รวม .standards-version ที่ GH-04 บังคับ)
#   2. รัน run-all-checks.sh กับของที่สร้าง — ถ้าไม่ผ่านจะหยุด ไม่ push ขึ้นเว็บ
#   3. สร้าง repo บน GitHub แล้ว push
#   4. เพิ่ม standards submodule
#   5. ตั้ง ruleset (ถ้าสิทธิ์ไม่พอ workflow Ruleset Sweep จะตามตั้งให้ภายในชั่วโมง)
#
# หมายเหตุเรื่อง visibility: subsystem repo สร้างเป็น public เพราะ
#   (ก) GitHub Actions ให้เวลารันไม่จำกัดกับ repo public — 37 repo × 8 job
#       ต่อ PR เกินโควตา 2,000 นาที/เดือน ของ plan Free แน่นอนถ้าเป็น private
#   (ข) GITHUB_TOKEN ของ repo หนึ่งไม่มีสิทธิ์ actions/checkout repo พี่น้อง
#       ที่เป็น private ซึ่งดีไซน์ reusable workflow นี้ต้องใช้
# ถ้าต้องการ private ต้องทำ GitHub App หรือ PAT ที่ scope แคบเป็น secret แทน

set -euo pipefail

ORG="CSMJU2030"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STANDARDS_VERSION="$(tr -d '[:space:]' < "$SCRIPT_DIR/VERSION")"
PNPM_VERSION="12.3.4"

SUBSYSTEM="${1:?ระบุชื่อ subsystem เช่น payroll}"
DISPLAY_NAME="${2:-$SUBSYSTEM}"
REPO_NAME="${REPO_NAME:-csmju-${SUBSYSTEM}}"
WORKDIR="./${REPO_NAME}"

# slug ต้องเป็น kebab-case เสมอ แม้ override ชื่อ repo แล้วก็ตาม เพราะมันไปโผล่
# ในชื่อ branch ที่ ruleset บังคับด้วย regex
#   ^feature/[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*$
# และไปเป็น slug ของ team (@org/pl-<slug>) ซึ่ง GitHub บังคับตัวเล็กอยู่แล้ว
if ! printf '%s' "$SUBSYSTEM" | grep -qE '^[a-z0-9][a-z0-9-]*$'; then
  echo "❌ slug ต้องเป็น kebab-case ตัวเล็ก (a-z 0-9 -): '$SUBSYSTEM'" >&2
  exit 1
fi

# GitHub ยอมรับ . _ - ในชื่อ repo แต่ห้ามอย่างอื่น
if ! printf '%s' "$REPO_NAME" | grep -qE '^[A-Za-z0-9][A-Za-z0-9._-]*$'; then
  echo "❌ ชื่อ repo ใช้อักขระที่ GitHub ไม่รับ: '$REPO_NAME'" >&2
  exit 1
fi
if [ "$REPO_NAME" != "csmju-${SUBSYSTEM}" ]; then
  echo "⚠️  ชื่อ repo '$REPO_NAME' ไม่ตรงแบบแผน csmju-<slug> ของโครงการ"
  echo "   team และ branch จะยังใช้ slug '${SUBSYSTEM}' (pl-${SUBSYSTEM}, aie-${SUBSYSTEM},"
  echo "   feature/${SUBSYSTEM}/<เรื่อง>) — ตรวจให้แน่ใจว่าตั้งใจแบบนี้"
fi
if [ -e "$WORKDIR" ]; then
  echo "❌ มี $WORKDIR อยู่แล้ว" >&2
  exit 1
fi

# --- GH-04 ต้องมี tag ของเวอร์ชันนี้จริง: เช็กก่อนสร้างอะไรทั้งในเครื่องและบน GitHub ---
# ไม่งั้นสคริปต์จะไปตกตอน checkout submodule หลัง gh repo create --push แล้ว
# เหลือ repo ครึ่งทางที่ไม่มี submodule และ ruleset
if ! git ls-remote --exit-code --tags "https://github.com/${ORG}/csmju2030-standards.git" \
     "refs/tags/v${STANDARDS_VERSION}" >/dev/null 2>&1; then
  echo "❌ ยังไม่มี tag v${STANDARDS_VERSION} ใน csmju2030-standards (VERSION ของ checkout นี้)" >&2
  echo "   ติด tag ก่อน หรือรันสคริปต์จาก checkout ของ tag ที่ออกแล้ว" >&2
  exit 1
fi

echo "=== สร้าง $REPO_NAME (standards v$STANDARDS_VERSION) ==="

mkdir -p "$WORKDIR"/{frontend/src,backend/src,.github/workflows}
cd "$WORKDIR"

# --- CI: คัดลอกจาก template แล้วแทนที่ชื่อ ไม่เขียนซ้ำด้วยมือ ---
# เลขตัวกลาง (@vX.Y.Z) คงตาม template — DevOps เป็นเจ้าของ ไม่ผูกกับ VERSION
# (เวอร์ชันชุดตรวจอยู่ใน .standards-version) · เคยใช้ sed แบบ \+ ซึ่ง GNU กับ macOS ทำงานไม่เหมือนกัน
sed -e "s#csmju-<subsystem-name>#${REPO_NAME}#" \
    "$SCRIPT_DIR/templates/ci.yml" > .github/workflows/ci.yml

sed "s#<subsystem-name>#${SUBSYSTEM}#g" \
    "$SCRIPT_DIR/templates/CODEOWNERS" > .github/CODEOWNERS

cp "$SCRIPT_DIR/templates/pull_request_template.md" .github/pull_request_template.md
sed "s#csmju-change-me#${REPO_NAME}#" "$SCRIPT_DIR/templates/.env.example" > .env.example
cp "$SCRIPT_DIR/templates/conformance-nightly.yml" .github/workflows/conformance-nightly.yml
# build image api/web ไป ghcr.io ทุกครั้งที่ merge เข้า main (docs/deployment.md ข้อ 5)
cp "$SCRIPT_DIR/templates/images.yml" .github/workflows/images.yml

# --- GH-04: ไฟล์นี้คือสิ่งที่สคริปต์เดิมลืมสร้าง ทำให้ทุก repo ใหม่ fail ทันที ---
printf '%s\n' "$STANDARDS_VERSION" > .standards-version

sed -e "s#csmju-<subsystem-name>#${REPO_NAME}#" \
    -e "s#<subsystem-name>#${SUBSYSTEM}#g" \
    "$SCRIPT_DIR/templates/subsystem.yaml" > subsystem.yaml
{
  echo ""
  echo "display_name: \"${DISPLAY_NAME}\""
  echo "repo: github.com/${ORG}/${REPO_NAME}"
  echo "status: proposed"
} >> subsystem.yaml

cat > .gitignore <<'EOF'
.env
.env.local
.env.*.local
node_modules/
.pnpm-store/
.next/
dist/
build/
coverage/
generated/
*.pem
*.key
!.env.example
EOF

# build context ของทั้งสอง image คือรากของ repo (DEP-03 · docs/deployment.md ข้อ 3)
cat > .dockerignore <<'EOF'
**/node_modules
**/.next
**/dist
**/generated
**/coverage
**/.env*
**/*.log
.git
standards
EOF

cat > pnpm-workspace.yaml <<'EOF'
packages:
  - 'frontend'
  - 'backend'
EOF

# reusable workflow เรียก pnpm/action-setup โดยไม่ระบุ version เพื่อให้อ่าน
# "packageManager" จากไฟล์นี้ — ไม่มีไฟล์นี้ job Code Quality กับ API Contract
# Sync จะ fail ด้วย "No pnpm version is specified" ตั้งแต่ PR แรก
cat > package.json <<EOF
{
  "name": "${REPO_NAME}",
  "private": true,
  "packageManager": "pnpm@${PNPM_VERSION}"
}
EOF

cat > README.md <<EOF
# ${REPO_NAME}

${DISPLAY_NAME} — ระบบย่อยของโครงการ CSMJU2030

มาตรฐานกลางอยู่ใน \`standards/\` (submodule ของ ${ORG}/csmju2030-standards)
สร้างจาก standards v${STANDARDS_VERSION} · เลื่อนเวอร์ชันเองได้ตาม \`standards/docs/standards-versioning.md\`

## เริ่มทำงาน

\`\`\`bash
git submodule update --init standards/
pnpm install
git checkout -b feature/${SUBSYSTEM}/<เรื่องที่ทำ>
\`\`\`

ก่อนเปิด PR อ่าน \`standards/docs/github-workflow.md\` ข้อ 1
EOF

touch frontend/src/.gitkeep backend/src/.gitkeep

echo "✅ สร้างไฟล์เสร็จ"

# --- ตรวจของที่สร้างก่อน push: ถ้าไม่ผ่านก็ไม่ต้องขึ้นเว็บ ---
echo ""
echo "→ ตรวจ compliance กับของที่สร้าง..."
# ตรวจเฉพาะ check ที่ตัดสินจากเนื้อไฟล์ — ตัด check-branch-name /
# check-commit-messages / check-ci-untouched ออก เพราะสามตัวนั้นต้องมี PR
# context (branch ต้นทาง, base sha) ซึ่งยังไม่มีตอน scaffold
SCAFFOLD_CHECKS=(
  check-submodule-pointer check-no-secrets check-no-local-storage
  check-no-jwt-verify check-db-isolation check-authorized-deps
  check-openapi-sync check-api-conventions check-field-aliases
  check-snake-case check-no-hardcoded-faculty check-money-fields
  check-ui-tokens check-qa check-exceptions
)
SCAFFOLD_FAILED=0
for chk in "${SCAFFOLD_CHECKS[@]}"; do
  if ! out=$("$SCRIPT_DIR/scripts/$chk.sh" . 2>&1); then
    echo "  ❌ $chk" >&2
    printf '%s\n' "$out" | sed 's/^/     /' >&2
    SCAFFOLD_FAILED=1
  fi
done
if [ "$SCAFFOLD_FAILED" -ne 0 ]; then
  echo "❌ scaffold ไม่ผ่าน compliance — ไม่ push ขึ้นเว็บ" >&2
  exit 1
fi
echo "✅ scaffold ผ่าน compliance (${#SCAFFOLD_CHECKS[@]} checks)"

# --- git: -b main สำคัญ ---
# git เวอร์ชันเก่าตั้ง default เป็น master ซึ่งทำให้ ci.yml (on: pull_request
# branches: [main]) ไม่ยิงเลย และ ruleset ที่ exclude แค่ refs/heads/main
# จะบล็อก branch หลักของ repo เอง
git init -q -b main 2>/dev/null || { git init -q && git symbolic-ref HEAD refs/heads/main; }
git add .
git commit -q -m "chore(${SUBSYSTEM}): scaffold ${REPO_NAME} from standards v${STANDARDS_VERSION}"

echo "→ สร้าง repo บน GitHub..."
gh repo create "${ORG}/${REPO_NAME}" --public --source=. --remote=origin --push

echo "→ เพิ่ม standards submodule..."
git submodule add -q "https://github.com/${ORG}/csmju2030-standards.git" standards/
git -C standards checkout -q "v${STANDARDS_VERSION}"
git add .gitmodules standards
git commit -q -m "chore(${SUBSYSTEM}): pin standards submodule at v${STANDARDS_VERSION}"
git push -q

# --- ruleset: ต้องตั้งหลัง push ครบแล้วเท่านั้น main-protection ห้าม push ตรง
# เข้า main แม้แต่ team devops (bypass_mode: pull_request) ตั้งก่อนจะ push
# submodule commit ไม่ขึ้น — ถ้าตั้งไม่สำเร็จไม่หยุดสคริปต์ เพราะ repo ขึ้นเว็บแล้ว ---
echo "→ ตั้ง ruleset..."
RULESET_STEP=""
if ! "$SCRIPT_DIR/org-settings/apply-rulesets.sh" repo "$REPO_NAME"; then
  echo "⚠️  ตั้ง ruleset ไม่สำเร็จ (ต้องเป็น org admin หรืออยู่ team devops)" >&2
  echo "   workflow Ruleset Sweep ใน standards repo จะตามตั้งให้ภายในชั่วโมง" >&2
  RULESET_STEP="
  - ruleset ยังไม่ได้ตั้ง: รอ Ruleset Sweep หรือรันเอง
      standards/org-settings/apply-rulesets.sh repo ${REPO_NAME}"
fi

cat <<EOF

✅ สร้าง ${REPO_NAME} สำเร็จ
   https://github.com/${ORG}/${REPO_NAME}

ขั้นตอนที่เหลือ (ต้องมีสิทธิ์ org admin)
  - สร้าง Team: pl-${SUBSYSTEM}, aie-${SUBSYSTEM} แล้วผูกเข้า repo
  - แก้ subsystem.yaml ใส่ owner จริง${RULESET_STEP}

ส่งให้ทีม
  - พอร์ตของทีม: frontend 32xx · backend 42xx — ทีมแทน 32xx ใน subsystem.yaml (base_url) และ PORT ใน .env.example
  - บัญชีเจ้าของระบบใน Core Hub ส่งทางข้อความส่วนตัว (standards/docs/connect-core-hub.md ข้อ 2)
EOF
