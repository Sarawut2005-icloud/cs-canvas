#!/usr/bin/env bash
# scripts/select-standards-version.sh — GH-04 (เลือกชุดตรวจ)
# Reads `.standards-version` of the subsystem repo and switches the standards
# checkout (tools_dir, fetched with every tag) to that tag, so each subsystem
# is checked by the version it chose. ci.yml pins only the entry point — the
# workflow and this script — and never needs to change for a bump
# (docs/standards-versioning.md).
#
# Refused before switching:
#   - a value that is not plain semver, or has no tag v<version>
#   - a version below MIN_VERSION on standards main (DevOps raises it there)
#   - a version lower than the PR base branch has (no downgrade to dodge a check)
#
# Usage: select-standards-version.sh [target_dir] [tools_dir]
#   PR_BASE_SHA            base commit of the PR; unset skips the downgrade check
#   CSMJU_MIN_VERSION_REF  ref in tools_dir that holds MIN_VERSION (default origin/main)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$(cd "${1:-.}" && pwd)"
TOOLS_DIR="$(cd "${2:-$TARGET_DIR/.compliance-tools}" && pwd)"
MIN_VERSION_REF="${CSMJU_MIN_VERSION_REF:-origin/main}"
SEMVER='^[0-9]+\.[0-9]+\.[0-9]+$'

# version_lt A B — true when A is an older version than B
version_lt() {
  [[ "$1" != "$2" && "$(printf '%s\n%s\n' "$1" "$2" | sort -V | sed -n 1p)" == "$1" ]]
}

# read_version — stdin without whitespace, NUL or non-ASCII bytes, so a file
# saved by a Windows tool (CRLF, a UTF-8 BOM, or UTF-16 from PowerShell's
# `echo 1.5.1 > .standards-version`) still reads as 1.5.1
read_version() {
  LC_ALL=C tr -d '\000-\040\177-\377'
}

fail() {
  echo "❌ [GH-04] $1"
  shift
  printf '   %s\n' "$@"
  echo "   อ้างอิง: docs/standards-versioning.md"
  exit 1
}

if [[ ! -f "$TARGET_DIR/.standards-version" ]]; then
  fail "ไม่พบไฟล์ .standards-version ใน subsystem repo" \
    "ต้องเป็น: ไฟล์ .standards-version ที่มีเลขเวอร์ชันบรรทัดเดียว เช่น 1.5.1" \
    "วิธีแก้: echo 1.5.1 > .standards-version แล้ว commit"
fi
VERSION="$(read_version < "$TARGET_DIR/.standards-version")"

if [[ ! "$VERSION" =~ $SEMVER ]]; then
  fail ".standards-version ต้องเป็นเลขเวอร์ชันล้วน" \
    "พบ: '$VERSION'" \
    "ต้องเป็น: รูปแบบ X.Y.Z ไม่มี v นำหน้า เช่น 1.5.1"
fi

TAG_SHA="$(git -C "$TOOLS_DIR" rev-parse -q --verify "refs/tags/v$VERSION^{commit}" 2>/dev/null || true)"
if [[ -z "$TAG_SHA" ]]; then
  AVAILABLE="$(git -C "$TOOLS_DIR" tag -l 'v[0-9]*' --sort=-v:refname | sed -n '1,5p' | tr '\n' ' ')"
  fail "ไม่มี tag v$VERSION ใน csmju2030-standards" \
    "เวอร์ชันล่าสุดที่มี: $AVAILABLE" \
    "วิธีแก้: ใส่เลขที่มี tag จริงใน .standards-version"
fi

MIN_VERSION="$(git -C "$TOOLS_DIR" show "$MIN_VERSION_REF:MIN_VERSION" 2>/dev/null | read_version || true)"
if [[ ! "$MIN_VERSION" =~ $SEMVER ]]; then
  MIN_VERSION="$(read_version < "$SCRIPT_DIR/../MIN_VERSION" 2>/dev/null || true)"
fi
if [[ "$MIN_VERSION" =~ $SEMVER ]] && version_lt "$VERSION" "$MIN_VERSION"; then
  fail "standards v$VERSION ต่ำกว่าเวอร์ชันขั้นต่ำที่ DevOps กำหนด" \
    "พบ: $VERSION" \
    "ต้องเป็น: $MIN_VERSION ขึ้นไป" \
    "วิธีแก้: เลื่อน .standards-version และ submodule standards เป็น $MIN_VERSION ขึ้นไป"
fi

if [[ -n "${PR_BASE_SHA:-}" ]]; then
  if ! git -C "$TARGET_DIR" cat-file -e "$PR_BASE_SHA^{commit}" 2>/dev/null; then
    git -C "$TARGET_DIR" fetch -q --depth=1 origin "$PR_BASE_SHA" 2>/dev/null || true
  fi
  if git -C "$TARGET_DIR" cat-file -e "$PR_BASE_SHA^{commit}" 2>/dev/null; then
    BASE_VERSION="$(git -C "$TARGET_DIR" show "$PR_BASE_SHA:.standards-version" 2>/dev/null | read_version || true)"
    if [[ "$BASE_VERSION" =~ $SEMVER ]] && version_lt "$VERSION" "$BASE_VERSION"; then
      fail "ห้ามถอย standards เป็นเวอร์ชันที่เก่ากว่า branch ปลายทาง" \
        "branch ปลายทางใช้: $BASE_VERSION" \
        "PR นี้ใช้: $VERSION" \
        "วิธีแก้: คง .standards-version ไว้ที่ $BASE_VERSION ขึ้นไป ถ้าจำเป็นต้องถอยจริงให้เปิด issue ขอ DevOps"
    fi
  else
    echo "⚠️  [GH-04] หา commit ปลายทาง $PR_BASE_SHA ไม่เจอ — ข้ามการตรวจการถอยเวอร์ชัน"
  fi
fi

git -C "$TOOLS_DIR" -c advice.detachedHead=false checkout -q -f --detach "$TAG_SHA"

echo "✅ [GH-04] ใช้ชุดตรวจของ standards v$VERSION (ขั้นต่ำ ${MIN_VERSION:-ไม่กำหนด})"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "version=$VERSION" >> "$GITHUB_OUTPUT"
fi
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo "ตรวจด้วย **standards v$VERSION** (จาก \`.standards-version\`)" >> "$GITHUB_STEP_SUMMARY"
fi
