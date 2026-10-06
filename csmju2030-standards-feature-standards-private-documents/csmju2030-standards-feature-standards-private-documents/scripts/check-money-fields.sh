#!/usr/bin/env bash
# scripts/check-money-fields.sh — DD-05
# Heuristic: money-sounding fields (price/amount/cost/fee/fine/salary/balance)
# must be stored as integers (smallest unit, e.g. satang), never as a float.
#
# Two shapes are checked, because the earlier single-pattern version only
# caught a decimal literal sitting directly after ":" or "=" and let both of
# these through:
#   - ts/tsx with a type annotation in between:  fine_amount: number = 12.50
#   - the prisma column that causes it upstream:  fine_amount Float
#
# Usage: check-money-fields.sh [target_dir]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

MONEY_WORDS='price|amount|cost|fee|fine|salary|balance'

# ts/tsx — a decimal literal assigned to a money field, with an optional type
# annotation between the name and the value.
#   const fine_amount = 12.50        → caught
#   fine_amount: number = 12.50      → caught
#   price: 199.99,                   → caught
#   item_count: number = 5           → not caught (no decimal)
TS_PATTERN="(${MONEY_WORDS})[a-zA-Z_]*\s*\??\s*(:\s*[a-zA-Z]+\s*)?=\s*-?[0-9]+\.[0-9]+"
TS_PATTERN="${TS_PATTERN}|(${MONEY_WORDS})[a-zA-Z_]*\s*\??\s*:\s*-?[0-9]+\.[0-9]+"
TS_RESULT=$(grep -rnEi "$TS_PATTERN" frontend/src backend/src 2>/dev/null \
  --include='*.ts' --include='*.tsx' \
  --exclude-dir=node_modules || true)

# prisma — a money column declared Float/Decimal is the root cause, so flag the
# schema itself rather than waiting for a float to show up in application code.
PRISMA_PATTERN="(${MONEY_WORDS})[a-zA-Z_]*\s+(Float|Decimal)\b"
PRISMA_RESULT=$(grep -rnEi "$PRISMA_PATTERN" prisma 2>/dev/null \
  --include='*.prisma' || true)

RESULT=$(printf '%s\n%s\n' "$TS_RESULT" "$PRISMA_RESULT" | grep -v '^$' || true)

if [[ -n "$RESULT" ]]; then
  cat <<EOF
❌ [DD-05] พบฟิลด์เงินเป็น float แทนที่จะเป็น integer
$(echo "$RESULT" | sed 's/^/   /')
   อ้างอิง: data-dictionary.md ข้อ 5
   วิธีแก้: เปลี่ยนให้เก็บเป็น integer (หน่วยย่อยสุด เช่น สตางค์) แทน float
            ใน prisma ใช้ Int แทน Float/Decimal
EOF
  exit 1
fi
echo "✅ [DD-05] ไม่พบฟิลด์เงินที่เป็น float"
