#!/usr/bin/env bash
# scripts/check-branch-name.sh — GH-01
# Usage: check-branch-name.sh [target_dir] [branch_name_override] [base_branch_override]
#
# งานทุกชิ้นต้องมาจาก feature/<subsystem>/<เรื่อง> ข้อยกเว้นมีแค่ PR ระหว่าง
# branch หลักสองตัวของ repo ที่ใช้ develop (github-workflow.md ข้อ 1.5)
#   develop → main   ขึ้น production
#   main → develop   ดึง hotfix กลับเข้า develop
# base อ่านจาก GITHUB_BASE_REF ที่ GitHub Actions ตั้งให้ทุก PR ตอนรันในเครื่องไม่มีค่านี้
# develop และ main จึงไม่ผ่านเมื่อตรวจเฉย ๆ เหมือนเดิม
set -euo pipefail
TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"
BRANCH="${2:-${GITHUB_HEAD_REF:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)}}"
BASE="${3:-${GITHUB_BASE_REF:-}}"
PATTERN='^feature/[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*$'

if [[ "$BRANCH" == "develop" && "$BASE" == "main" ]]; then
  echo "✅ [GH-01] PR ขึ้น production: develop → main (github-workflow.md 1.5)"
  exit 0
fi
if [[ "$BRANCH" == "main" && "$BASE" == "develop" ]]; then
  echo "✅ [GH-01] PR ดึง hotfix กลับ: main → develop (github-workflow.md 1.5)"
  exit 0
fi

if [[ ! "$BRANCH" =~ $PATTERN ]]; then
  cat <<EOF
❌ [GH-01] ชื่อ branch ไม่ตรงมาตรฐาน
   พบ: $BRANCH
   ต้องเป็น: feature/<subsystem>/<เรื่องที่ทำ>
   ตัวอย่าง: feature/equipment/add-borrow-return
   ข้อยกเว้น: PR develop → main และ main → develop (github-workflow.md ข้อ 1.5)
   อ้างอิง: github-workflow.md ข้อ 1.1
   วิธีแก้: git branch -m feature/<subsystem>/<เรื่อง>
EOF
  exit 1
fi
echo "✅ [GH-01] Branch name ผ่าน: $BRANCH"
