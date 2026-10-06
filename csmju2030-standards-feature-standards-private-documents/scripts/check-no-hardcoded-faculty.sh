#!/usr/bin/env bash
# scripts/check-no-hardcoded-faculty.sh — DD-04
# Heuristic: flags array/object literals that look like a hardcoded list of
# faculty names instead of fetching them from Core Hub's GET /api/v1/faculties
# (docs/reference-data.md).
# The name match is case-insensitive on purpose: a SCREAMING_CASE constant
# (const FACULTIES = [...]) is the most common way to write one and used to
# slip through a [Ff]acult-only pattern.
# Usage: check-no-hardcoded-faculty.sh [target_dir]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

KEYWORDS='คณะ|Faculty of|FACULTIES'
RESULT=$(grep -rniE "(const|let)\s+\w*facult\w*\s*=\s*\[" \
  frontend/src backend/src 2>/dev/null \
  --include='*.ts' --include='*.tsx' \
  --exclude-dir=node_modules || true)

# refine: only flag arrays whose nearby content actually looks like faculty names
if [[ -n "$RESULT" ]]; then
  MATCHING_FILES=$(echo "$RESULT" | cut -d: -f1 | sort -u)
  VIOLATION=0
  for f in $MATCHING_FILES; do
    if grep -qE "$KEYWORDS" "$f"; then
      echo "❌ [DD-04] พบรายชื่อคณะแบบ hardcode ใน $f"
      grep -niE "(const|let)\s+\w*facult\w*\s*=\s*\[" "$f" | sed 's/^/   /'
      VIOLATION=1
    fi
  done
  if [[ "${VIOLATION:-0}" -eq 1 ]]; then
    cat <<EOF
   อ้างอิง: docs/reference-data.md (ข้อมูลอ้างอิงจาก Core Hub)
   วิธีแก้: ลบ array คงที่ทิ้ง แล้วเรียก GET /api/v1/faculties ของ Core Hub จาก backend (cache ได้ 10 นาที)
EOF
    exit 1
  fi
fi
echo "✅ [DD-04] ไม่พบรายชื่อคณะแบบ hardcode"
