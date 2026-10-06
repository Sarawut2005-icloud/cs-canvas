#!/usr/bin/env bash
# scripts/check-no-local-storage.sh — SEC-03
# Usage: check-no-local-storage.sh [target_dir]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

RESULT=$(grep -rnE "localStorage\.(setItem|getItem)\(['\"](access_token|token|jwt|refresh_token)" \
  frontend 2>/dev/null \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
  --exclude-dir=node_modules --exclude-dir=.next || true)

if [[ -n "$RESULT" ]]; then
  cat <<EOF
❌ [SEC-03] พบการเก็บ token ใน localStorage
$(echo "$RESULT" | sed 's/^/   /')
   อ้างอิง: ui-design-system.md ข้อ 16.2 (ข้อห้ามข้อ 4)
   วิธีแก้: เก็บ token ใน httpOnly cookie หรือ memory เท่านั้น ห้ามใช้ localStorage
EOF
  exit 1
fi
echo "✅ [SEC-03] ไม่พบ token ใน localStorage"
