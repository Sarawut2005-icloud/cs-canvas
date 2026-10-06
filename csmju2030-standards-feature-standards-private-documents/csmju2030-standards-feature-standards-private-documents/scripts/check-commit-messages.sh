#!/usr/bin/env bash
# scripts/check-commit-messages.sh — GH-02
# Usage: check-commit-messages.sh [target_dir] [base_ref]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

BASE_REF="${2:-${GITHUB_BASE_SHA:-HEAD~1}}"
# type ที่อนุญาตตาม github-workflow.md ข้อ 1.3 — เจ็ดตัวเท่านั้น
# เวอร์ชันก่อนหน้ารับ style|perf|build เพิ่มด้วย ซึ่งหลวมกว่ามาตรฐานที่
# ประกาศไว้ ทำให้ commit ที่เอกสารไม่อนุญาตผ่าน CI ไปได้เงียบ ๆ
PATTERN='^(feat|fix|chore|refactor|docs|test|ci)(\([a-z0-9-]+\))?: .+'

if ! git rev-parse "$BASE_REF" >/dev/null 2>&1; then
  echo "✅ [GH-02] ข้ามการตรวจ (ไม่มี base ref ให้เทียบ: $BASE_REF)"
  exit 0
fi

# --no-merges is required: on a pull_request event actions/checkout builds an
# ephemeral merge commit ("Merge <head> into <base>") that is not authored by
# anyone and can never satisfy Conventional Commits.
MESSAGES=$(git log --no-merges --format=%s "$BASE_REF..HEAD" 2>/dev/null || true)
if [[ -z "$MESSAGES" ]]; then
  echo "✅ [GH-02] ไม่มี commit ใหม่ให้ตรวจ"
  exit 0
fi

VIOLATION=0
while IFS= read -r MSG; do
  [[ -z "$MSG" ]] && continue
  if [[ ! "$MSG" =~ $PATTERN ]]; then
    cat <<EOF
❌ [GH-02] Commit message ไม่ตาม Conventional Commits
   พบ: $MSG
   ต้องเป็น: <type>(<scope>?): <description> เช่น feat(equipment): add borrow flow
   อ้างอิง: github-workflow.md ข้อ 1.3
   วิธีแก้: แก้ commit message ด้วย git commit --amend หรือ git rebase -i
EOF
    VIOLATION=1
  fi
done <<< "$MESSAGES"

if [[ "$VIOLATION" -eq 1 ]]; then
  exit 1
fi
echo "✅ [GH-02] Commit messages ผ่านทั้งหมด"
