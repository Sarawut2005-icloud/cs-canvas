#!/usr/bin/env bash
# scripts/check-submodule-pointer.sh — GH-04
# A subsystem repo names the standards version it follows in `.standards-version`
# at its root, and CI checks it with that version (select-standards-version.sh).
# This script checks that the file agrees with the standards checkout it is
# compared against, and that the `standards` submodule — the copy AIE read on
# their machine — points at the same tag, so the rules they read are the rules
# CI enforces. A repo without the submodule skips the second part.
#
# Usage: check-submodule-pointer.sh [target_dir] [tools_dir]
#   tools_dir  the standards checkout to compare with (default: this repo);
#              CI passes the version .standards-version chose
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$(cd "${2:-$SCRIPT_DIR/..}" && pwd)"
STANDARDS_VERSION_FILE="$TOOLS_DIR/VERSION"

# stdin without whitespace, NUL or non-ASCII bytes — read the same way as
# select-standards-version.sh, so a CRLF, BOM or UTF-16 file still matches
read_version() {
  LC_ALL=C tr -d '\000-\040\177-\377'
}

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

if [[ ! -f "$STANDARDS_VERSION_FILE" ]]; then
  echo "✅ [GH-04] ข้ามการตรวจ (ไม่พบ VERSION ของ standards repo)"
  exit 0
fi
EXPECTED="$(read_version < "$STANDARDS_VERSION_FILE")"

if [[ ! -f ".standards-version" ]]; then
  cat <<EOF
❌ [GH-04] ไม่พบไฟล์ .standards-version ใน subsystem repo
   ต้องเป็น: มีไฟล์ .standards-version ระบุ semver ที่ตรงกับ standards repo ($EXPECTED)
   อ้างอิง: docs/standards-versioning.md
   วิธีแก้: echo $EXPECTED > .standards-version แล้ว commit
EOF
  exit 1
fi

FOUND="$(read_version < ".standards-version")"
if [[ "$FOUND" != "$EXPECTED" ]]; then
  cat <<EOF
❌ [GH-04] .standards-version ไม่ตรงกับ standards ที่ใช้เทียบ
   พบ: $FOUND
   ต้องเป็น: $EXPECTED
   อ้างอิง: docs/standards-versioning.md
   วิธีแก้: เลื่อน .standards-version และ submodule standards ไปเวอร์ชันเดียวกัน
EOF
  exit 1
fi

# gitlink ของ submodule อ่านจาก commit ได้เลย ไม่ต้อง init submodule
POINTER="$(git ls-tree HEAD standards 2>/dev/null | awk '$1 == "160000" { print $3 }' || true)"
if [[ -z "$POINTER" ]]; then
  echo "✅ [GH-04] standards version ตรงกัน: $FOUND (ไม่มี submodule standards ให้ตรวจ)"
  exit 0
fi

TAG_SHA="$(git -C "$TOOLS_DIR" rev-parse -q --verify "refs/tags/v$EXPECTED^{commit}" 2>/dev/null || true)"
if [[ -z "$TAG_SHA" ]]; then
  echo "✅ [GH-04] standards version ตรงกัน: $FOUND (ไม่พบ tag v$EXPECTED ในเครื่องให้เทียบ submodule — ข้ามส่วนนั้น)"
  exit 0
fi

if [[ "$POINTER" != "$TAG_SHA" ]]; then
  cat <<EOF
❌ [GH-04] submodule standards ไม่ได้ชี้ที่ v$EXPECTED
   พบ: $POINTER
   ต้องเป็น: $TAG_SHA (tag v$EXPECTED)
   อ้างอิง: docs/standards-versioning.md
   วิธีแก้: git -C standards fetch --tags && git -C standards checkout v$EXPECTED && git add standards
EOF
  exit 1
fi
echo "✅ [GH-04] standards version ตรงกัน: $FOUND · submodule ชี้ v$EXPECTED"
