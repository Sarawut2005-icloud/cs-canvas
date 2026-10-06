#!/usr/bin/env bash
# scripts/check-deploy-ready.sh — DEP-01..04
# Every subsystem ships as two container images built from its own repo
# (docs/deployment.md): web from frontend/Dockerfile and api from
# backend/Dockerfile, both with the repo root as build context — so the root
# .dockerignore decides what reaches the build.
#
# - DEP-01 backend/Dockerfile exists, and frontend/Dockerfile when the repo
#          has frontend/package.json
# - DEP-02 the final stage of each Dockerfile switches to a non-root USER
#          (a USER in an earlier stage does not carry over)
# - DEP-03 the root .dockerignore keeps out **/.env* (or both **/.env and
#          **/.env.*) and **/node_modules
# - DEP-04 frontend/next.config.* sets output: "standalone"
#
# - neither frontend/package.json nor backend/package.json → skip: a repo
#   fresh from new-subsystem.sh has only empty folders (same as ARC-04)
# - CSMJU_PROFILE=core-hub → skip: Core Hub builds its images from deploy/
#   (docs/core-hub-rules.md)
#
# Usage: check-deploy-ready.sh [target_dir]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

if [[ "${CSMJU_PROFILE:-subsystem}" == "core-hub" ]]; then
  echo "✅ [DEP] ข้ามการตรวจ (profile core-hub — Core Hub build image จาก deploy/)"
  exit 0
fi

if [[ ! -f frontend/package.json && ! -f backend/package.json ]]; then
  echo "✅ [DEP] ข้ามการตรวจ (ยังไม่มี frontend/package.json และ backend/package.json — repo เพิ่ง scaffold)"
  exit 0
fi

PROBLEMS=""
add_problem() {
  PROBLEMS="${PROBLEMS}   - $1\n"
}

# Prints the USER of the final stage: the last USER after the last FROM,
# or nothing when that stage never sets one. Instructions are case-insensitive;
# CR from Windows checkouts is dropped.
final_stage_user() {
  awk '
    {
      line = $0
      sub(/\r$/, "", line)
      sub(/^[ \t]+/, "", line)
      upper = toupper(line)
    }
    upper ~ /^FROM[ \t]/ { user = "" }
    upper ~ /^USER[ \t]/ {
      value = substr(line, 6)
      sub(/^[ \t]+/, "", value)
      split(value, parts, /[ \t]+/)
      user = parts[1]
    }
    END { print user }
  ' "$1"
}

check_dockerfile() {
  local file="$1" user name
  if [[ ! -f "$file" ]]; then
    add_problem "[DEP-01] ไม่พบ $file"
    return 0
  fi
  user="$(final_stage_user "$file")"
  name="${user%%:*}"
  if [[ -z "$user" ]]; then
    add_problem "[DEP-02] $file: stage สุดท้ายไม่มี USER — container จะรันเป็น root (USER ใน stage ก่อนหน้าไม่ตามมา)"
  elif [[ "$name" == "root" || "$name" == "0" ]]; then
    add_problem "[DEP-02] $file: stage สุดท้ายตั้ง USER $user — ต้องเป็น user ที่ไม่ใช่ root เช่น node"
  fi
}

# --- DEP-01 / DEP-02 ---------------------------------------------------------
if [[ -f backend/package.json ]]; then
  check_dockerfile backend/Dockerfile
fi
if [[ -f frontend/package.json ]]; then
  check_dockerfile frontend/Dockerfile
fi

# --- DEP-03 ------------------------------------------------------------------
if [[ ! -f .dockerignore ]]; then
  add_problem "[DEP-03] ไม่พบ .dockerignore ที่รากของ repo — .env และ node_modules จะถูกส่งเข้า build"
else
  IGNORE_LINES="$(tr -d '\r' < .dockerignore | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  ignores() {
    printf '%s\n' "$IGNORE_LINES" | grep -qxF -- "$1"
  }
  if ! ignores '**/.env*' && ! { ignores '**/.env' && ignores '**/.env.*'; }; then
    add_problem "[DEP-03] .dockerignore ไม่กัน **/.env* — .env ใน backend/ หรือ .env.local ใน frontend/ จะติดเข้า image"
  fi
  if ! ignores '**/node_modules' && ! ignores '**/node_modules/'; then
    add_problem "[DEP-03] .dockerignore ไม่กัน **/node_modules — node_modules ของเครื่อง (macOS/Windows) จะทับของใน image"
  fi
fi

# --- DEP-04 ------------------------------------------------------------------
if [[ -f frontend/package.json ]]; then
  NEXT_CONFIG=""
  for candidate in frontend/next.config.ts frontend/next.config.mjs frontend/next.config.js frontend/next.config.cjs; do
    if [[ -f "$candidate" ]]; then
      NEXT_CONFIG="$candidate"
      break
    fi
  done
  if [[ -z "$NEXT_CONFIG" ]]; then
    add_problem "[DEP-04] ไม่พบ frontend/next.config.ts — ต้องตั้ง output: \"standalone\""
  elif ! grep -Eq "output[[:space:]]*:[[:space:]]*['\"]standalone['\"]" "$NEXT_CONFIG"; then
    add_problem "[DEP-04] $NEXT_CONFIG ไม่ได้ตั้ง output: \"standalone\" — Dockerfile ของ template copy .next/standalone"
  fi
fi

if [[ -n "$PROBLEMS" ]]; then
  echo "❌ [DEP] repo ยังไม่พร้อม build image สำหรับ deploy"
  printf '%b' "$PROBLEMS"
  cat <<'MSG'
   อ้างอิง: deployment.md ข้อ 3
   วิธีแก้: frontend/Dockerfile และ next.config.ts — copy จาก standards/templates/csmju-subsystem-web/
            backend/Dockerfile · backend/docker/entrypoint.sh · .dockerignore — copy จาก demo-student-subsystem
            ทดสอบในเครื่อง: docker compose up -d --build (ดู docker-compose.yml ของ demo)
MSG
  exit 1
fi
echo "✅ [DEP] Dockerfile ครบ · ไม่รันเป็น root · .dockerignore กัน .env และ node_modules · Next.js standalone"
