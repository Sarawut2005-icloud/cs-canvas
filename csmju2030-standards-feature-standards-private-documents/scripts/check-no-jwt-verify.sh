#!/usr/bin/env bash
# scripts/check-no-jwt-verify.sh — SEC-04, SEC-05
#
# SEC-04: ระบบย่อย "ต้อง" ตรวจ JWT ของ Core Hub เองผ่าน JWKS + kid
#         (สถาปัตยกรรม v1.0 ยังไม่มี API Gateway กลาง — ดู auth-contract.md ข้อ 1, 4)
#         สิ่งที่ห้ามคือการตรวจแบบผิดสัญญา: HS256 / alg=none / กุญแจฝังในโค้ด /
#         ออก token เอง / ใช้ไลบรารีที่ไม่รองรับ JWKS+kid
# SEC-05: ห้ามมีหน้า login หรือฟอร์ม username-password ในระบบย่อย
#
# Usage: check-no-jwt-verify.sh [target_dir]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"


# ตัดผลที่แมตช์อยู่ในคอมเมนต์ออก — โค้ดที่ "อธิบายว่าปฏิเสธ HS256" ไม่ใช่การใช้ HS256
strip_comment_hits() {
  awk -F: '{
    line = $0
    sub(/^[^:]*:[0-9]+:/, "", line)     # ตัด path:line: ออก เหลือเนื้อโค้ด
    code = line
    sub(/\/\/.*/, "", code)              # ตัดคอมเมนต์ท้ายบรรทัด
    sub(/^[[:space:]]*\*.*/, "", code)   # บรรทัดใน block comment
    if (code ~ pattern) print $0
  }' pattern="$1"
}

VIOLATION=0
# ไฟล์ทดสอบถูกยกเว้น: ชุดทดสอบต้องสร้าง token ที่ผิดสัญญา (HS256, alg=none, ปลอมลายเซ็น)
# เพื่อพิสูจน์ว่าระบบปฏิเสธได้จริง
GREP_OPTS=(--include='*.ts' --include='*.js'
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=test --exclude-dir=__tests__
  --exclude='*.spec.ts' --exclude='*.e2e-spec.ts' --exclude='*.integration-spec.ts')

# ยึดหลักเดียวกับสคริปต์อื่น: ไม่มีไฟล์ = ข้าม (repo ที่เพิ่ง scaffold ยังไม่มีโค้ด)
# -print -quit แทน `| head -1`: ภายใต้ pipefail ถ้า head ปิดท่อก่อน find เขียนเสร็จ
# find จะโดน SIGPIPE (exit 141) แล้ว set -e ทำให้สคริปต์จบเงียบ ๆ โดยไม่บอกว่าตกเพราะอะไร
# เกิดจริงบน CI (Linux) ของ Core Hub เมื่อรายชื่อไฟล์ยาวเกิน buffer — ดู CHANGELOG 1.1.1
BACKEND_TS=$(find backend/src -name '*.ts' -not -path '*/node_modules/*' -print -quit 2>/dev/null)

if [[ -n "$BACKEND_TS" ]]; then
  BAD_ALG=$(grep -rnE "HS(256|384|512)|algorithms?\s*:\s*\[?\s*['\"]none['\"]" \
    backend/src "${GREP_OPTS[@]}" 2>/dev/null | strip_comment_hits "HS(256|384|512)|algorithms?[[:space:]]*:" || true)
  if [[ -n "$BAD_ALG" ]]; then
    echo "❌ [SEC-04] พบการใช้ HS256/alg=none — สัญญากำหนด RS256 เท่านั้น"
    echo "$BAD_ALG" | sed 's/^/   /'
    VIOLATION=1
  fi

  INLINE_KEY=$(grep -rnE "BEGIN (RSA )?(PRIVATE|PUBLIC) KEY" backend/src "${GREP_OPTS[@]}" 2>/dev/null || true)
  if [[ -n "$INLINE_KEY" ]]; then
    echo "❌ [SEC-04] พบกุญแจ PEM ฝังในโค้ด — ต้องดึง public key จาก JWKS ตาม kid เท่านั้น"
    echo "$INLINE_KEY" | sed 's/^/   /'
    VIOLATION=1
  fi

  SIGNING=$(grep -rnE "jwt\.sign\(|new SignJWT\(|JwtService" backend/src "${GREP_OPTS[@]}" 2>/dev/null || true)
  if [[ -n "$SIGNING" ]]; then
    echo "❌ [SEC-04] พบการออก JWT เองในระบบย่อย — Core Hub เป็นผู้ออก token เท่านั้น"
    echo "$SIGNING" | sed 's/^/   /'
    VIOLATION=1
  fi

  BAD_LIB=$(grep -rnE "from ['\"](jsonwebtoken|passport-jwt)['\"]|require\(['\"](jsonwebtoken|passport-jwt)['\"]\)" \
    backend/src "${GREP_OPTS[@]}" 2>/dev/null || true)
  if [[ -n "$BAD_LIB" ]]; then
    echo "❌ [SEC-04] ระบบย่อยต้องตรวจ JWT ด้วย jose (รองรับ JWKS + kid) ไม่ใช่ jsonwebtoken/passport-jwt"
    echo "$BAD_LIB" | sed 's/^/   /'
    VIOLATION=1
  fi

  USES_AUTH=$(grep -rlniE "authorization|bearer" backend/src "${GREP_OPTS[@]}" 2>/dev/null || true)
  HAS_JWKS=$(grep -rlniE "jwks|createRemoteJWKSet|importJWK" backend/src "${GREP_OPTS[@]}" 2>/dev/null || true)
  if [[ -n "$USES_AUTH" && -z "$HAS_JWKS" ]]; then
    echo "❌ [SEC-04] พบการรับ Bearer token แต่ไม่พบการตรวจผ่าน JWKS ของ Core Hub"
    echo "   ให้คัดลอกชั้น auth จาก reference implementation (ai/AGENTS.md ข้อ 2)"
    VIOLATION=1
  fi
fi

LOGIN_RESULT=$(grep -rniE "(type=[\"']password[\"']|<form[^>]*login)" \
  frontend 2>/dev/null \
  --include='*.tsx' --include='*.jsx' \
  --exclude-dir=node_modules --exclude-dir=.next || true)
if [[ -n "$LOGIN_RESULT" ]]; then
  echo "❌ [SEC-05] พบหน้า login / form username-password ในระบบย่อย"
  echo "$LOGIN_RESULT" | sed 's/^/   /'
  VIOLATION=1
fi

if [[ "$VIOLATION" -eq 1 ]]; then
  printf '%s\n' \
    "   อ้างอิง: auth-contract.md ข้อ 4, 9 · tech-stack.md ข้อ 1.3" \
    "   วิธีแก้: ใช้ชั้น auth จาก reference implementation (jose + JWKS + kid)" \
    "            ผู้ใช้ต้อง login ที่ Core Hub แล้วเข้าระบบย่อยผ่าน SSO เท่านั้น"
  exit 1
fi
echo "✅ [SEC-04/05] การตรวจ JWT เป็นไปตามสัญญา และไม่มีหน้า login ในระบบย่อย"
