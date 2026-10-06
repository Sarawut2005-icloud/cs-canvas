#!/usr/bin/env bash
# scripts/check-backend-nestjs.sh — ARC-04
# Every subsystem has its own NestJS backend in backend/ (repo-structure.md,
# tech-stack.md 1.3). Next.js is the web front only: its route handlers may
# pass requests on to the backend, but data and business logic live there.
# Without this check a repo with no backend/ passed CI, because every backend
# check (API-*, SEC-04/05, DD-*) skips when it finds no backend code.
#
# - neither frontend/package.json nor backend/package.json → skip: a repo
#   fresh from new-subsystem.sh has only empty folders
# - otherwise backend/package.json must list @nestjs/core under
#   "dependencies", and backend/src/main.ts must start the app with NestFactory
#
# Usage: check-backend-nestjs.sh [target_dir]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

if [[ ! -f frontend/package.json && ! -f backend/package.json ]]; then
  echo "✅ [ARC-04] ข้ามการตรวจ (ยังไม่มี frontend/package.json และ backend/package.json — repo เพิ่ง scaffold)"
  exit 0
fi

PROBLEMS=""
if [[ ! -f backend/package.json ]]; then
  PROBLEMS="${PROBLEMS}   - ไม่พบ backend/package.json — ระบบย่อยต้องมี backend ของตัวเอง\n"
else
  HAS_NEST=0
  if command -v jq >/dev/null 2>&1; then
    # tr: jq.exe on Windows ends lines with CR
    if [[ -n "$(jq -r '.dependencies["@nestjs/core"] // empty' backend/package.json 2>/dev/null | tr -d '\r')" ]]; then
      HAS_NEST=1
    fi
  elif grep -q '"@nestjs/core"' backend/package.json; then
    HAS_NEST=1
  fi
  if [[ "$HAS_NEST" -ne 1 ]]; then
    PROBLEMS="${PROBLEMS}   - backend/package.json ไม่มี @nestjs/core ใน dependencies — backend ต้องเป็น NestJS\n"
  fi
  if [[ ! -f backend/src/main.ts ]] || ! grep -q "NestFactory" backend/src/main.ts; then
    PROBLEMS="${PROBLEMS}   - backend/src/main.ts ไม่ได้เริ่มแอปด้วย NestFactory\n"
  fi
fi

if [[ -n "$PROBLEMS" ]]; then
  echo "❌ [ARC-04] ระบบย่อยต้องมี backend เป็น NestJS ใน backend/"
  printf '%b' "$PROBLEMS"
  cat <<'MSG'
   อ้างอิง: repo-structure.md ข้อ 2 · tech-stack.md ข้อ 1.3
   วิธีแก้: สร้าง backend/ ตามโครงของ demo-student-subsystem (auth · common · health)
            Next.js เป็นหน้าเว็บ — route handler ส่งต่อคำขอไป backend ได้ แต่ข้อมูลและ logic ต้องอยู่ที่ backend
MSG
  exit 1
fi
echo "✅ [ARC-04] มี backend NestJS ใน backend/"
