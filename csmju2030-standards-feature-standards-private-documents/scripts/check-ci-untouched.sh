#!/usr/bin/env bash
# scripts/check-ci-untouched.sh — GH-03
# The `standards` submodule is not guarded since 1.5.1: moving it is part of a
# subsystem's own bump, and GH-04 holds it to the tag `.standards-version` names
# (docs/standards-versioning.md).
# Usage: check-ci-untouched.sh [target_dir] [base_ref]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

BASE_SHA="${2:-${GITHUB_BASE_SHA:-origin/main}}"
PROTECTED=(
  '^\.github/workflows/'
  '^\.github/CODEOWNERS$'
)

if ! git rev-parse "$BASE_SHA" >/dev/null 2>&1; then
  echo "✅ [GH-03] ข้ามการตรวจ (ไม่มี base ref ให้เทียบ: $BASE_SHA)"
  exit 0
fi

CHANGED=$(git diff --name-only "$BASE_SHA...HEAD" 2>/dev/null || true)
VIOLATION=0

for PATTERN in "${PROTECTED[@]}"; do
  MATCHES=$(echo "$CHANGED" | grep -E "$PATTERN" || true)
  if [[ -n "$MATCHES" ]]; then
    echo "❌ [GH-03] แก้ไขไฟล์ที่ห้ามแก้:"
    echo "$MATCHES" | sed 's/^/   - /'
    VIOLATION=1
  fi
done

if [[ "$VIOLATION" -eq 1 ]]; then
  cat <<EOF
   อ้างอิง: github-workflow.md ข้อ 5.1
   วิธีแก้: revert การแก้ไขไฟล์เหล่านี้ออกจาก PR
            ถ้าจะเลื่อนเวอร์ชัน standards ไม่ต้องแก้ ci.yml — แก้ .standards-version
            กับ submodule standards แทน (docs/standards-versioning.md)
            ถ้าจำเป็นต้องแก้จริง ให้เปิด issue ขอต่อทีม DevOps
EOF
  exit 1
fi
echo "✅ [GH-03] ไม่มีการแก้ไขไฟล์ CI"
