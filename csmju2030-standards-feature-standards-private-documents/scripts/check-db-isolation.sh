#!/usr/bin/env bash
# scripts/check-db-isolation.sh — ARC-01
# Usage: check-db-isolation.sh [target_dir]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

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
