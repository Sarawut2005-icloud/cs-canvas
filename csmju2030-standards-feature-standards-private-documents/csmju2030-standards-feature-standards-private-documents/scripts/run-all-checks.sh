#!/usr/bin/env bash
# scripts/run-all-checks.sh
# Local orchestrator that mirrors the jobs of the reusable workflow
# (.github/workflows/subsystem-compliance.yml) — runs every check script
# against a target subsystem repo directory and prints a summary table.
#
# Usage: run-all-checks.sh [target_dir]
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$(cd "${1:-.}" && pwd)"

declare -a JOBS=(
  "Convention Check|check-branch-name.sh"
  "Convention Check|check-commit-messages.sh"
  "Convention Check|check-ci-untouched.sh"
  "Standards Version Check|check-submodule-pointer.sh"
  "Security & Stack Scan|check-no-secrets.sh"
  "Security & Stack Scan|check-no-local-storage.sh"
  "Security & Stack Scan|check-no-jwt-verify.sh"
  "Security & Stack Scan|check-db-isolation.sh"
  "Security & Stack Scan|check-authorized-deps.sh"
  "Security & Stack Scan|check-backend-nestjs.sh"
  "Security & Stack Scan|check-deploy-ready.sh"
  "API Contract Sync|check-openapi-sync.sh"
  "API Contract Sync|check-api-conventions.sh"
  "Data Dictionary Compliance|check-field-aliases.sh"
  "Data Dictionary Compliance|check-snake-case.sh"
  "Data Dictionary Compliance|check-no-hardcoded-faculty.sh"
  "Data Dictionary Compliance|check-money-fields.sh"
  "UI Token Compliance|check-ui-tokens.sh"
  "Code Quality|check-qa.sh"
  "Exception Validation|check-exceptions.sh"
)

# bash 3.2 (macOS default) ไม่มี associative array — ใช้ indexed array คู่ขนานกับ JOBS
declare -a JOB_STATUS=()
FAIL_COUNT=0
TOTAL=0

echo "=================================================================="
echo " CSMJU2030 Subsystem Compliance — local run"
echo " target: $TARGET_DIR"
echo "=================================================================="

IDX=0
for ENTRY in "${JOBS[@]}"; do
  JOB="${ENTRY%%|*}"
  SCRIPT="${ENTRY##*|}"
  TOTAL=$((TOTAL + 1))
  echo
  echo "--- [$JOB] $SCRIPT ---"
  OUTPUT="$("$SCRIPT_DIR/$SCRIPT" "$TARGET_DIR" 2>&1)"
  CODE=$?
  echo "$OUTPUT"
  if [[ "$CODE" -ne 0 ]]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    JOB_STATUS[$IDX]="❌ FAIL"
  else
    JOB_STATUS[$IDX]="✅ PASS"
  fi
  IDX=$((IDX + 1))
done

echo
echo "=================================================================="
echo " Summary"
echo "=================================================================="
IDX=0
for ENTRY in "${JOBS[@]}"; do
  JOB="${ENTRY%%|*}"
  SCRIPT="${ENTRY##*|}"
  printf "  %-8s  %-26s  %s\n" "${JOB_STATUS[$IDX]}" "$JOB" "$SCRIPT"
  IDX=$((IDX + 1))
done

echo
if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo "❌ $FAIL_COUNT / $TOTAL checks failed — merge would be blocked."
  exit 1
fi
echo "✅ All $TOTAL checks passed."
