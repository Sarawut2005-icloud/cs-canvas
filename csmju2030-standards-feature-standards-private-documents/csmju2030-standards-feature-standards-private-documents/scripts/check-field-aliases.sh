#!/usr/bin/env bash
# scripts/check-field-aliases.sh — DD-01, DD-02
#
# DD-01: Global Identity คือ claim `sub` จาก Core Hub token · ในระบบย่อยต้องเก็บชื่อว่า
#        core_user_id / coreUserId เท่านั้น ห้ามตั้งชื่ออื่นที่สื่อความหมายเดียวกัน
#        (data-dictionary.md ข้อ 9.2)
#        หมายเหตุ: student_code / studentId ฯลฯ ใช้ได้ เพราะเป็นข้อมูลธุรกิจของระบบย่อยเอง
#        ไม่ใช่ Global Identity
# DD-02: core role ต้องใช้ค่าจาก enum ที่กำหนดเท่านั้น
#
# Usage: check-field-aliases.sh [target_dir]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

# profile=core-hub ข้าม DD-01 เพราะ Core Hub เป็นเจ้าของตาราง users เอง
# `user_id` ในนั้นคือ foreign key ปกติ ไม่ใช่ alias ของ Global Identity
PROFILE="${CSMJU_PROFILE:-subsystem}"

VIOLATION=0

# alias ที่ห้ามใช้แทน Global Identity
FORBIDDEN_ALIASES=(
  'user_id' 'userId' 'user_code' 'userCode' 'std_id' 'stdId'
)

if [[ "$PROFILE" == "core-hub" ]]; then
  echo "⏭️  [DD-01] ข้าม — Core Hub เป็นเจ้าของตาราง users (ดู docs/core-hub-rules.md)"
  FORBIDDEN_ALIASES=("")
fi

for ALIAS in "${FORBIDDEN_ALIASES[@]}"; do
  [[ -z "$ALIAS" ]] && continue
  RESULT=$(grep -rn --word-regexp "$ALIAS" \
    frontend/src backend/src prisma/ backend/prisma/ 2>/dev/null \
    --include='*.ts' --include='*.tsx' --include='*.prisma' \
    --exclude-dir=node_modules || true)
  if [[ -n "$RESULT" ]]; then
    echo "❌ [DD-01] ใช้ชื่อ field ที่ห้ามใช้แทน core_user_id: $ALIAS"
    echo "$RESULT" | sed 's/^/   /'
    VIOLATION=1
  fi
done

# DD-02: core role enum — ตรวจเฉพาะโค้ดแอปพลิเคชัน (ข้ามไฟล์ทดสอบที่จงใจใช้ค่าผิด)
ALLOWED_ROLES="student|alumni|staff|lecturer|guest|admin"
BAD_ROLES=$(grep -rnE "(core_role|coreRole)\s*[:=]\s*['\"][a-zA-Z_-]+['\"]" \
  frontend/src backend/src 2>/dev/null \
  --include='*.ts' --include='*.tsx' \
  --exclude='*.spec.ts' --exclude='*.e2e-spec.ts' --exclude-dir=node_modules \
  | grep -vE "(core_role|coreRole)\s*[:=]\s*['\"]($ALLOWED_ROLES)['\"]" || true)
if [[ -n "$BAD_ROLES" ]]; then
  echo "❌ [DD-02] core role ใช้ค่านอก enum ที่กำหนด"
  echo "$BAD_ROLES" | sed 's/^/   /'
  VIOLATION=1
fi

if [[ "$VIOLATION" -eq 1 ]]; then
  printf '%s\n' \
    "   อ้างอิง: data-dictionary.md ข้อ 1, 9.2" \
    "   วิธีแก้: ใช้ core_user_id / coreUserId แทน alias ต้องห้าม" \
    "            และให้ core role ใช้ค่าจาก enum: ${ALLOWED_ROLES}"
  exit 1
fi
echo "✅ [DD-01/02] ไม่พบ alias ต้องห้าม และ core role อยู่ใน enum"
