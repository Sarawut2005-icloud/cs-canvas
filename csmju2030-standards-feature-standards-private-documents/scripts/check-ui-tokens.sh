#!/usr/bin/env bash
# scripts/check-ui-tokens.sh — UI-01 (fail), UI-02/03/04 (warn)
# Scans the whole frontend/ (not just frontend/src): a Next.js app may keep
# app/ at the root of frontend/, and scanning only src/ let those repos pass
# without checking anything.
# globals.css and csmju/ are the central token files copied from the
# template (ui-design-system.md ข้อ 3, 17.0) — they declare the palette in
# hex on purpose, and subsystems are not allowed to edit them.
# Usage: check-ui-tokens.sh [target_dir]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

# shellcheck source=lib/exceptions.sh
source "$SCRIPT_DIR/lib/exceptions.sh"
UI01_EXCEPTIONS=$(active_exceptions UI-01)

VIOLATION=0
SCAN_OPTS=(--include='*.tsx' --include='*.ts' --include='*.css'
  --exclude-dir=node_modules --exclude-dir=.next)

# UI-01 (Fail): raw hex color
RESULT=$(grep -rnE '#[0-9a-fA-F]{3,8}\b' frontend "${SCAN_OPTS[@]}" \
  --exclude='*.config.*' --exclude='globals.css' --exclude-dir=csmju \
  2>/dev/null || true)
# Files an approved UI-01 exception covers (ci-compliance-spec 11.1) — such
# as the drawn art of a game — drop out of the result; the rest is checked.
if [[ -n "$RESULT" && -n "$UI01_EXCEPTIONS" ]]; then
  KEPT=""
  while IFS= read -r HIT; do
    [[ -z "$HIT" ]] && continue
    COVERED=0
    while IFS='|' read -r SCOPE _; do
      if exception_covers_path "$SCOPE" "${HIT%%:*}"; then COVERED=1; break; fi
    done <<< "$UI01_EXCEPTIONS"
    [[ "$COVERED" -eq 1 ]] || KEPT="$KEPT$HIT"$'\n'
  done <<< "$RESULT"
  RESULT="${KEPT%$'\n'}"
fi
warn_exceptions UI-01 "$UI01_EXCEPTIONS"

if [[ -n "$RESULT" ]]; then
  cat <<MSG
❌ [UI-01] พบค่าสี hex ดิบในโค้ด frontend
$(echo "$RESULT" | sed 's/^/   /')
   อ้างอิง: ui-design-system.md ข้อ 3
   วิธีแก้: ใช้ utility class จาก token ใน @theme ของ globals.css
            (เช่น bg-primary-container, text-on-surface) แทนการพิมพ์ hex
MSG
  VIOLATION=1
fi

# UI-02 (Warn): spacing/radius values outside the design scale
SPACING=$(grep -rnE "(margin|padding|border-radius|gap)\s*:\s*[0-9]+px" frontend \
  "${SCAN_OPTS[@]}" --exclude='globals.css' --exclude-dir=csmju 2>/dev/null || true)
if [[ -n "$SPACING" ]]; then
  echo "⚠️  [UI-02] พบค่า spacing/radius แบบ px ดิบ นอก scale ที่กำหนด (ui-design-system.md ข้อ 3.2–3.3)"
  echo "$SPACING" | sed 's/^/   /'
fi

# UI-03 (Warn): div onClick / outline:none / !important
UI03=$(grep -rnE "(<div[^>]*onClick=|outline:\s*none|!important)" frontend \
  "${SCAN_OPTS[@]}" --exclude='globals.css' --exclude-dir=csmju 2>/dev/null || true)
if [[ -n "$UI03" ]]; then
  echo "⚠️  [UI-03] พบ div onClick / outline:none / !important (ui-design-system.md ข้อ 12.1, 16.2)"
  echo "$UI03" | sed 's/^/   /'
fi

# UI-04 (Warn): emoji in screens
UI04=$(grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" frontend \
  --include='*.tsx' --exclude-dir=node_modules --exclude-dir=.next 2>/dev/null || true)
if [[ -n "$UI04" ]]; then
  echo "⚠️  [UI-04] พบ emoji ในหน้าจอระบบ (ui-design-system.md ข้อ 16.2)"
  echo "$UI04" | sed 's/^/   /'
fi

if [[ "$VIOLATION" -eq 1 ]]; then
  exit 1
fi
echo "✅ [UI-01] ไม่พบ hex color ดิบ (UI-02..04 เป็น warn เท่านั้น)"
