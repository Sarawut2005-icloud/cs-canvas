#!/usr/bin/env bash
# scripts/run-core-hub-checks.sh
#
# ชุดตรวจสำหรับ csmju-core-hub โดยเฉพาะ
#
# Core Hub ไม่ใช่ "ระบบย่อย" — มันเป็นผู้ออก token, ถือกุญแจส่วนตัว และเป็น
# หน้า login กลางของแพลตฟอร์ม กฎบางข้อที่บังคับกับระบบย่อยจึงขัดกับหน้าที่ของ
# Core Hub โดยตรง (เช่น SEC-04 ที่ห้ามออก JWT เอง) ไฟล์นี้รันเฉพาะกฎที่ยัง
# บังคับใช้ได้ โดยตั้ง CSMJU_PROFILE=core-hub เพื่อให้สคริปต์ที่รองรับ profile
# ผ่อนกฎเฉพาะจุดที่เอกสารระบุไว้
#
# กฎที่ยกเว้นทั้งหมดและเหตุผล: docs/core-hub-rules.md
#
# Usage: run-core-hub-checks.sh [target_dir]
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$(cd "${1:-.}" && pwd)"

export CSMJU_PROFILE=core-hub

declare -a JOBS=(
  "Convention Check|check-branch-name.sh"
  "Convention Check|check-commit-messages.sh"
  "Security Scan|check-no-secrets.sh"
  "Security Scan|check-no-local-storage.sh"
  "Security Scan|check-db-isolation.sh"
  "Stack Scan|check-authorized-deps.sh"
  "API Contract|check-api-conventions.sh"
  "Data Dictionary|check-field-aliases.sh"
  "Data Dictionary|check-snake-case.sh"
  "Data Dictionary|check-no-hardcoded-faculty.sh"
  "Data Dictionary|check-money-fields.sh"
  "Code Quality|check-qa.sh"
  "Exception Validation|check-exceptions.sh"
)

# code|สิ่งที่ยกเว้น|เหตุผล
declare -a EXEMPT=(
  "SEC-04|ห้ามออก/เซ็น JWT เอง|Core Hub เป็นผู้ออก token และถือ private key ตามออกแบบ"
  "SEC-05|ห้ามมีหน้า login|Core Hub คือหน้า login กลางของแพลตฟอร์ม"
  "GH-03|ห้ามแก้ .github/workflows|Core Hub เป็นเจ้าของ workflow ของตัวเอง"
  "GH-04|ต้องมี standards submodule|Core Hub ไม่ได้ผูก standards เป็น submodule"
  "DD-01|ห้ามใช้ user_id / userId|Core Hub เป็นเจ้าของตาราง users — user_id คือ PK/FK ปกติ"
  "API-06|ต้องประกาศ public_endpoints|Core Hub ไม่มี subsystem.yaml (ไม่ได้ลงทะเบียนกับตัวเอง)"
  "API-01|openapi.json sync|ยังไม่มีสคริปต์ generate:openapi ใน Core Hub"
  "UI-01..04|UI design tokens|ยังไม่มี frontend ของ Core Hub ใน repo นี้"
  "DEP-01..04|Dockerfile ใน backend/ frontend/|Core Hub build image จาก deploy/ ของตัวเอง (DEPLOYMENT.md)"
)

# bash 3.2 (macOS default) ไม่มี associative array — ใช้ indexed array คู่ขนาน
declare -a JOB_STATUS=()
FAIL_COUNT=0
TOTAL=0

echo "=================================================================="
echo " CSMJU2030 Core Hub Compliance — profile: core-hub"
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
  printf "  %-8s  %-18s  %s\n" "${JOB_STATUS[$IDX]}" "$JOB" "$SCRIPT"
  IDX=$((IDX + 1))
done

echo
echo " กฎที่ยกเว้นสำหรับ Core Hub (docs/core-hub-rules.md):"
for ENTRY in "${EXEMPT[@]}"; do
  CODE_="$(echo "$ENTRY" | cut -d'|' -f1)"
  RULE="$(echo "$ENTRY" | cut -d'|' -f2)"
  REASON="$(echo "$ENTRY" | cut -d'|' -f3)"
  printf "  ⏭️  %-10s %-26s %s\n" "$CODE_" "$RULE" "$REASON"
done

echo
if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo "❌ $FAIL_COUNT / $TOTAL checks failed — merge would be blocked."
  exit 1
fi
echo "✅ All $TOTAL checks passed."
