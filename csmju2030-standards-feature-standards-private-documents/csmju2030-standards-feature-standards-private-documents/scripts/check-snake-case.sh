#!/usr/bin/env bash
# scripts/check-snake-case.sh — DD-03
#
# ฐานข้อมูลต้องเป็น snake_case ส่วนโค้ด TypeScript เป็น camelCase
# (data-dictionary.md ข้อ 9.1) จึงตรวจที่ Prisma schema:
#   - ทุก model ต้องมี @@map("plural_snake_case")
#   - field ที่ชื่อเป็น camelCase ต้องมี @map("snake_case")
# field ที่เป็น relation หรือ list ไม่ใช่คอลัมน์ จึงข้าม
#
# Usage: check-snake-case.sh [target_dir]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

SCHEMAS=$(find . -name 'schema.prisma' \
  -not -path '*/node_modules/*' \
  -not -path './standards/*' \
  -not -path './.compliance-tools/*' \
  -not -path '*/.git/*' 2>/dev/null || true)
if [[ -z "$SCHEMAS" ]]; then
  echo "⚠️  [DD-03] ไม่พบ prisma/schema.prisma — ข้ามการตรวจ"
  exit 0
fi

VIOLATION=0
REPORT=$(mktemp)

for schema in $SCHEMAS; do
  awk -v file="$schema" '
    /^[[:space:]]*model[[:space:]]+[A-Za-z0-9_]+[[:space:]]*\{/ {
      inmodel = 1; hasmap = 0; model = $2; next
    }
    inmodel && /^[[:space:]]*\}/ {
      if (!hasmap) printf "model %s ไม่มี @@map(\"plural_snake_case\")  (%s)\n", model, file
      inmodel = 0; next
    }
    inmodel && /@@map\(/ { hasmap = 1; next }
    inmodel {
      line = $0
      sub(/\/\/.*/, "", line)
      if (line ~ /^[[:space:]]*$/) next
      if (line ~ /@relation/) next
      n = split(line, tok, /[[:space:]]+/)
      name = ""; type = ""
      for (i = 1; i <= n; i++) {
        if (tok[i] == "") continue
        if (name == "") { name = tok[i]; continue }
        if (type == "") { type = tok[i] }
      }
      if (name == "") next
      if (name ~ /^@/) next
      if (type ~ /\[\]$/) next
      if (name ~ /[A-Z]/ && line !~ /@map\(/)
        printf "field %s.%s เป็น camelCase แต่ไม่มี @map(\"snake_case\")  (%s)\n", model, name, file
    }
  ' "$schema" >> "$REPORT" || true

  BAD_MAP=$(grep -nE '@@?map\("[^"]*[A-Z][^"]*"\)' "$schema" 2>/dev/null || true)
  if [[ -n "$BAD_MAP" ]]; then
    echo "ชื่อที่ map ไปยังฐานข้อมูลต้องเป็น snake_case  ($schema)" >> "$REPORT"
    echo "$BAD_MAP" | sed 's/^/   /' >> "$REPORT"
  fi
done

if [[ -s "$REPORT" ]]; then
  while IFS= read -r line; do
    case "$line" in
      "   "*) echo "$line" ;;
      *) echo "❌ [DD-03] $line" ;;
    esac
  done < "$REPORT"
  rm -f "$REPORT"
  printf '%s\n' \
    "   อ้างอิง: data-dictionary.md ข้อ 9.1" \
    '   วิธีแก้: ใส่ @map("snake_case") ให้ field ที่เป็น camelCase และ @@map("plural_snake_case") ให้ทุก model' \
    "            ชื่อ field ใน Prisma/TypeScript ยังคงเป็น camelCase ตามเดิม"
  exit 1
fi
rm -f "$REPORT"
echo "✅ [DD-03] ชื่อตาราง/คอลัมน์ในฐานข้อมูลเป็น snake_case ครบ"
