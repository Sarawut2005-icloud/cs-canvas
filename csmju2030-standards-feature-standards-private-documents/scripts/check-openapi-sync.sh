#!/usr/bin/env bash
# scripts/check-openapi-sync.sh — API-01
# Best-effort: requires a real backend with `pnpm run generate:openapi`.
# If that tooling isn't present (as in this demo scaffold), the check is
# skipped with a warning rather than failing the whole pipeline.
#
# Usage: check-openapi-sync.sh [target_dir]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

if [[ ! -f "backend/package.json" ]]; then
  echo "✅ [API-01] ข้ามการตรวจ (ไม่พบ backend/package.json)"
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "⚠️  [API-01] ข้ามการตรวจ (ไม่พบ pnpm ในเครื่อง — ต้องรันจริงใน CI)"
  exit 0
fi

if ! jq -e '.scripts["generate:openapi"]' backend/package.json >/dev/null 2>&1; then
  echo "⚠️  [API-01] ข้ามการตรวจ (ไม่พบ script generate:openapi ใน backend/package.json)"
  exit 0
fi

cd backend
pnpm run generate:openapi

if ! git diff --exit-code --quiet openapi.json 2>/dev/null; then
  cat <<EOF
❌ [API-01] openapi.json ไม่ตรงกับโค้ด backend
   อ้างอิง: tech-stack.md ข้อ 3
   วิธีแก้: cd backend && pnpm run generate:openapi
            แล้ว git add backend/openapi.json ใน PR เดียวกัน

Diff ที่พบ:
$(git diff openapi.json | head -40)
EOF
  exit 1
fi
echo "✅ [API-01] openapi.json sync กับโค้ด"
