#!/usr/bin/env bash
# scripts/check-exceptions.sh — validates .compliance-exceptions.yml (§11.1)
# - Every exception must have `expires`, and must not be past that date.
# - Every exception must reference an `issue`.
# - `scope` must not be a bare wildcard "*".
#
# Usage: check-exceptions.sh [target_dir]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

FILE=".compliance-exceptions.yml"
if [[ ! -f "$FILE" ]]; then
  echo "✅ [EXC-01] ไม่พบ .compliance-exceptions.yml (ไม่มี exception ใช้งานอยู่)"
  exit 0
fi

TODAY=$(date +%Y-%m-%d)
VIOLATION=0

# Parse each "- check:" block by simple indentation scanning (no yq dependency).
CHECK="" SCOPE="" EXPIRES="" ISSUE=""
flush() {
  if [[ -n "$CHECK" ]]; then
    if [[ -z "$EXPIRES" ]]; then
      echo "❌ [EXC-01] exception '$CHECK' ไม่มี expires"
      VIOLATION=1
    elif [[ "$EXPIRES" < "$TODAY" ]]; then
      echo "❌ [EXC-01] exception '$CHECK' หมดอายุแล้ว (expires: $EXPIRES)"
      VIOLATION=1
    fi
    if [[ -z "$ISSUE" ]]; then
      echo "❌ [EXC-01] exception '$CHECK' ไม่มี issue อ้างอิง"
      VIOLATION=1
    fi
    if [[ "$SCOPE" == '"*"' || "$SCOPE" == "*" ]]; then
      echo "❌ [EXC-01] exception '$CHECK' ใช้ scope กว้างเกินไป (*)"
      VIOLATION=1
    fi
  fi
}

while IFS= read -r LINE; do
  if [[ "$LINE" =~ ^[[:space:]]*-[[:space:]]*check:[[:space:]]*(.*)$ ]]; then
    flush
    CHECK="${BASH_REMATCH[1]}"; SCOPE=""; EXPIRES=""; ISSUE=""
  elif [[ "$LINE" =~ ^[[:space:]]*scope:[[:space:]]*(.*)$ ]]; then
    SCOPE="${BASH_REMATCH[1]}"
  elif [[ "$LINE" =~ ^[[:space:]]*expires:[[:space:]]*\"?([0-9-]+)\"?[[:space:]]*$ ]]; then
    EXPIRES="${BASH_REMATCH[1]}"
  elif [[ "$LINE" =~ ^[[:space:]]*issue:[[:space:]]*(.*)$ ]]; then
    ISSUE="${BASH_REMATCH[1]}"
  fi
done < "$FILE"
flush

if [[ "$VIOLATION" -eq 1 ]]; then
  cat <<EOF
   อ้างอิง: ci-compliance-spec.md ข้อ 11.1
   วิธีแก้: ต่ออายุผ่านกระบวนการ Exception Process ใหม่ หรือแก้โค้ดให้ตรงมาตรฐาน
EOF
  exit 1
fi
echo "✅ [EXC-01] .compliance-exceptions.yml ผ่านการตรวจ (ไม่มี exception หมดอายุ)"
