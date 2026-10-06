#!/usr/bin/env bash
# scripts/run-job.sh
# Runs the checks of one job of subsystem-compliance.yml (listed in
# scripts/lib/jobs.tsv) against the subsystem repo. CI runs this from the
# entry copy — the version ci.yml pins — while the checks come from tools_dir,
# the version `.standards-version` chose (select-standards-version.sh).
#
# The list comes from tools_dir when that version ships one, else from this
# copy: every tag up to 1.5.0 ran the same steps (only ARC-04 is newer), and a
# check the chosen version does not have yet is skipped. GH-03 and GH-04 always
# come from this copy, so no version can be chosen to get round them.
#
# Usage: run-job.sh <job> [target_dir] [tools_dir]
#   PR_BASE_SHA · GITHUB_HEAD_REF   PR context, for the checks that need it
set -uo pipefail

ENTRY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JOB="${1:?ระบุชื่อ job ตามคอลัมน์แรกของ scripts/lib/jobs.tsv เช่น convention}"
TARGET_DIR="${2:-.}"
TOOLS_DIR="$(cd "${3:-$TARGET_DIR/.compliance-tools}" && pwd)"
POLICY_SCRIPTS=" check-ci-untouched.sh check-submodule-pointer.sh "

MANIFEST="$TOOLS_DIR/scripts/lib/jobs.tsv"
[[ -f "$MANIFEST" ]] || MANIFEST="$ENTRY_DIR/scripts/lib/jobs.tsv"
VERSION="$(tr -d '[:space:]' < "$TOOLS_DIR/VERSION" 2>/dev/null || echo '?')"

PASSED=0
FAILED=0
SKIPPED=0
while IFS=$'\t' read -r job label script args <&3 || [[ -n "${job:-}" ]]; do
  [[ "$job" == "$JOB" ]] || continue

  if [[ "$POLICY_SCRIPTS" == *" $script "* ]]; then
    dir="$ENTRY_DIR/scripts"
  else
    dir="$TOOLS_DIR/scripts"
  fi
  echo
  echo "── $label ──"
  if [[ ! -f "$dir/$script" ]]; then
    echo "⏭️  ข้าม — standards v$VERSION ยังไม่มีเช็คนี้ ($script)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  args="${args//\{base_sha\}/${PR_BASE_SHA:-}}"
  args="${args//\{head_ref\}/${GITHUB_HEAD_REF:-}}"
  args="${args//\{tools\}/$TOOLS_DIR}"
  read -ra argv <<< "$args"

  if bash "$dir/$script" "$TARGET_DIR" ${argv[@]+"${argv[@]}"} < /dev/null; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
done 3< "$MANIFEST"

echo
if [[ $((PASSED + FAILED + SKIPPED)) -eq 0 ]]; then
  echo "❌ ไม่พบเช็คของ job '$JOB' ใน $MANIFEST"
  exit 1
fi
echo "สรุป ($JOB · standards v$VERSION): ผ่าน $PASSED · ตก $FAILED · ข้าม $SKIPPED"
[[ "$FAILED" -eq 0 ]]
