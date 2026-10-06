#!/usr/bin/env bash
# scripts/check-qa.sh — QA-01..05
# QA-05 (package manager) is checked unconditionally — it's a plain file
# check. QA-01..04 (lint/typecheck/test/build) need a real toolchain
# installed; if `pnpm`/`node_modules` aren't present they are reported as
# skipped rather than failing this demo scaffold.
#
# Usage: check-qa.sh [target_dir]
set -euo pipefail

# jq.exe on Windows (Git Bash) ends every output line with CR, so "true\r"
# never equals "true" and names carry a trailing CR. Strip it here; on Linux,
# where CI runs, nothing changes. Defined only when jq exists, so the
# "no jq" checks below still work, and it keeps jq's own exit status.
if command -v jq >/dev/null 2>&1; then
  jq() { command jq "$@" | tr -d '\r'; return "${PIPESTATUS[0]}"; }
fi

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

VIOLATION=0

# QA-05: pnpm workspace only, no package-lock.json / yarn.lock
LOCKFILES=$(find . -maxdepth 3 \( -name 'package-lock.json' -o -name 'yarn.lock' \) \
  -not -path '*/node_modules/*' -not -path './.compliance-tools/*' 2>/dev/null || true)
if [[ -n "$LOCKFILES" ]]; then
  cat <<EOF
❌ [QA-05] พบ lockfile ที่ไม่ใช่ pnpm
$(echo "$LOCKFILES" | sed 's/^/   /')
   อ้างอิง: github-workflow.md ข้อ 2
   วิธีแก้: ลบ lockfile ดังกล่าว แล้วใช้ pnpm-lock.yaml เท่านั้น
EOF
  VIOLATION=1
fi
if [[ ! -f pnpm-workspace.yaml ]]; then
  echo "⚠️  [QA-05] ไม่พบ pnpm-workspace.yaml ที่ root"
fi

# QA-06: ชื่อ package ใน workspace ต้องไม่ซ้ำ และ `--filter <name>` ใน script
# ที่รากต้องชี้ไปยัง package ที่มีอยู่จริง — ถ้าชี้ผิด pnpm จะไม่รันอะไรเลยแต่
# คืน exit 0 ทำให้ `pnpm test` ที่รากดูเหมือนผ่านทั้งที่ไม่ได้รันเทสต์สักตัว
if command -v jq >/dev/null 2>&1 && [[ -f package.json ]]; then
  PKG_FILES=$(find . -maxdepth 3 -name 'package.json' \
    -not -path '*/node_modules/*' -not -path './.compliance-tools/*' \
    -not -path './standards/*' 2>/dev/null || true)
  ALL_NAMES=""
  while IFS= read -r PKG; do
    [[ -z "$PKG" ]] && continue
    NAME=$(jq -r '.name // empty' "$PKG" 2>/dev/null || true)
    [[ -z "$NAME" ]] && continue
    ALL_NAMES="${ALL_NAMES}${NAME}
"
  done <<< "$PKG_FILES"

  DUPES=$(echo "$ALL_NAMES" | grep -v '^$' | sort | uniq -d || true)
  if [[ -n "$DUPES" ]]; then
    cat <<EOF
❌ [QA-06] มี package ใน workspace ใช้ชื่อซ้ำกัน
$(echo "$DUPES" | sed 's/^/   /')
   ผลคือ pnpm --filter <ชื่อนั้น> จะไม่ match package ใดเลย แล้ว exit 0 เงียบ ๆ
   อ้างอิง: repo-structure.md ข้อ 3
   วิธีแก้: ตั้งชื่อ "name" ใน package.json ของแต่ละ workspace ให้ไม่ซ้ำกัน
EOF
    VIOLATION=1
  fi

  FILTERS=$(jq -r '.scripts // {} | to_entries[] | .value' package.json 2>/dev/null \
    | grep -oE '\-\-filter[= ]+[A-Za-z0-9@/_.-]+' | sed -E 's/^--filter[= ]+//' | sort -u || true)
  while IFS= read -r F; do
    [[ -z "$F" ]] && continue
    if ! echo "$ALL_NAMES" | grep -qx "$F"; then
      cat <<EOF
❌ [QA-06] script ที่รากอ้าง --filter $F แต่ไม่มี package ชื่อนี้ใน workspace
   pnpm จะไม่รันอะไรเลยแล้วคืน exit 0 — ทำให้ CI/สคริปต์ดูเหมือนผ่าน
   อ้างอิง: repo-structure.md ข้อ 3
   วิธีแก้: แก้ชื่อใน --filter ให้ตรงกับ "name" ของ package นั้น
EOF
      VIOLATION=1
    fi
  done <<< "$FILTERS"
fi

# QA-01..04: best-effort — only run if pnpm + installed deps are present
if command -v pnpm >/dev/null 2>&1 && [[ -d node_modules ]]; then
  if ! pnpm -r lint; then
    echo "❌ [QA-01] ESLint/Prettier ไม่ผ่าน"
    VIOLATION=1
  fi
  if ! pnpm -r typecheck; then
    echo "❌ [QA-02] tsc --noEmit ไม่ผ่าน"
    VIOLATION=1
  fi
  if ! pnpm -r test; then
    echo "❌ [QA-03] Unit test ไม่ผ่าน"
    VIOLATION=1
  fi
  if ! pnpm -r build; then
    echo "❌ [QA-04] next build / nest build ไม่ผ่าน"
    VIOLATION=1
  fi
else
  echo "⚠️  [QA-01..04] ข้ามการตรวจ (ไม่พบ pnpm หรือยังไม่ pnpm install — ต้องรันจริงใน CI)"
fi

if [[ "$VIOLATION" -eq 1 ]]; then
  exit 1
fi
echo "✅ [QA-05/06] ผ่านการตรวจ package manager และ workspace filter"
