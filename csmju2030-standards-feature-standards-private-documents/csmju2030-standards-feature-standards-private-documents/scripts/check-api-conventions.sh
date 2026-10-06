#!/usr/bin/env bash
# scripts/check-api-conventions.sh — API-02, API-03, API-04, API-05, API-06
# Heuristic static checks (no running backend required).
# Usage: check-api-conventions.sh [target_dir]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# API-04 อ่านรายการ error code จากสัญญากลาง — หาไฟล์จากที่อยู่ของสคริปต์
# แบบเดียวกับ check-submodule-pointer.sh จึงใช้ได้ทั้งตอนเป็น submodule
# (standards/scripts) และตอน CI checkout ไว้ที่ .compliance-tools/scripts
ERROR_CODES_JSON="$SCRIPT_DIR/../contracts/error-codes.json"

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

VIOLATION=0

# ยิงเฉพาะเมื่อมีไฟล์ .ts จริงใน backend/src — repo ที่ scaffold ใหม่มีแต่
# โฟลเดอร์เปล่า ถ้าเช็คแค่ว่ามีโฟลเดอร์ API-03/API-05 จะตีตกทันทีก่อนที่
# ใครจะได้เขียนโค้ด ซึ่งขัดกับสคริปต์ตัวอื่นที่ยึดหลัก "ไม่มีไฟล์ = ข้าม"
# -print -quit แทน `| head -1`: ภายใต้ pipefail ถ้า head ปิดท่อก่อน find เขียนเสร็จ
# find จะโดน SIGPIPE (exit 141) แล้ว set -e ทำให้สคริปต์จบเงียบ ๆ โดยไม่บอกว่าตกเพราะอะไร
# เกิดจริงบน CI (Linux) ของ Core Hub เมื่อรายชื่อไฟล์ยาวเกิน buffer — ดู CHANGELOG 1.1.1
BACKEND_TS=$(find backend/src -name '*.ts' -not -path '*/node_modules/*' -print -quit 2>/dev/null)
if [[ -d backend/src && -n "$BACKEND_TS" ]]; then
  # API-02: route segments must be kebab-case (no camelCase / underscores),
  # and a /v1 global prefix must be declared somewhere in main.ts.
  # ชื่อ path parameter (:exceptionId) เป็นตัวแปรใน TypeScript ไม่ใช่ส่วนของ URL
  # จริง — NestJS ใช้ camelCase ตามปกติ จึงตัด :param ออกก่อนตรวจ kebab-case
  ROUTE_HITS=$(grep -rnE "@(Controller|Get|Post|Put|Patch|Delete)\(\s*['\"][^'\"]*['\"]" \
    backend/src --include='*.ts' 2>/dev/null || true)
  BAD_ROUTES=""
  while IFS= read -r LINE; do
    [[ -z "$LINE" ]] && continue
    PATH_LITERAL=$(echo "$LINE" \
      | sed -E "s/.*@(Controller|Get|Post|Put|Patch|Delete)\(\s*['\"]([^'\"]*)['\"].*/\2/")
    STRIPPED=$(echo "$PATH_LITERAL" | sed -E 's/:[A-Za-z0-9_]+//g')
    if echo "$STRIPPED" | grep -qE '[A-Z_]'; then
      BAD_ROUTES="${BAD_ROUTES}${LINE}
"
    fi
  done <<< "$ROUTE_HITS"
  if [[ -n "$BAD_ROUTES" ]]; then
    echo "❌ [API-02] Route path ไม่ใช่ kebab-case"
    echo "$BAD_ROUTES" | sed 's/^/   /'
    VIOLATION=1
  fi
  # api-conventions.md ข้อ 1: endpoint ธุรกิจอยู่ใต้ /api/v1 ส่วน /api/health และ
  # /auth/callback อยู่นอก v1 จึงรับได้ 3 รูปแบบ
  #   setGlobalPrefix('api/v1', ...)          เวอร์ชันอยู่ใน prefix
  #   setGlobalPrefix('api', ...) + @Controller('v1/...')   เวอร์ชันอยู่ใน controller
  #   setGlobalPrefix('api', ...) + enableVersioning(...)   เวอร์ชันแบบ Nest
  if [[ -f backend/src/main.ts ]]; then
    HAS_PREFIX=$(grep -cE "setGlobalPrefix\(\s*['\"](api(/v1)?|v1)['\"]" backend/src/main.ts || true)
    HAS_V1=$(grep -rlE "setGlobalPrefix\(\s*['\"]api/v1['\"]|enableVersioning\(|@Controller\(\s*['\"]v1/" \
      backend/src --include='*.ts' 2>/dev/null || true)
    if [[ "$HAS_PREFIX" -eq 0 ]]; then
      echo "❌ [API-02] ไม่พบการตั้ง global prefix 'api' หรือ 'api/v1' ใน backend/src/main.ts"
      VIOLATION=1
    elif [[ -z "$HAS_V1" ]]; then
      echo "❌ [API-02] ไม่พบเวอร์ชัน v1 — endpoint ธุรกิจต้องอยู่ใต้ /api/v1"
      VIOLATION=1
    fi
  fi

  # API-03: response envelope { success, data/error, meta }
  ENVELOPE=$(grep -rlE "success\s*:\s*(true|false)" backend/src --include='*.ts' 2>/dev/null || true)
  if [[ -z "$ENVELOPE" ]]; then
    echo "❌ [API-03] ไม่พบ response envelope { success, data/error, meta } ใน backend/src"
    VIOLATION=1
  fi

  # API-04: error.code ต้องอยู่ในรายการของ contracts/error-codes.json
  # อ่านรายการจากไฟล์นั้นไฟล์เดียว ไม่เขียนซ้ำไว้ในสคริปต์ — เพิ่ม code ในสัญญา
  # แล้วตัวตรวจเห็นทันที เอกสารกับ CI จึงเห็นไม่ตรงกันไม่ได้อีก
  if command -v node >/dev/null 2>&1; then
    ALLOWED_CODES=$(node -e \
      'process.stdout.write(require(process.argv[1]).codes.join("|"))' \
      "$ERROR_CODES_JSON")
  else
    # ไม่มี node: ดึงค่าจาก "codes" ด้วย grep — ไฟล์นี้อยู่ในการดูแลของ repo นี้
    ALLOWED_CODES=$(sed -n '/"codes"/,/\]/p' "$ERROR_CODES_JSON" \
      | grep -oE '"[A-Z_]+"' | tr -d '"' | paste -sd '|' -)
  fi
  CODE_COUNT=$(echo "$ALLOWED_CODES" | tr '|' '\n' | grep -c .)

  # ไฟล์ทดสอบ (*.spec.ts, test/) ไม่ถูกตรวจทั้ง (ก) และ (ข) — ค่า code ในนั้น
  # เป็นข้อมูลตัวอย่าง เช่น code: 'SCI' ของ reference data ไม่ใช่ error contract
  # (เดิมตีตก false positive จนระบบที่ทำถูกต้อง merge ไม่ได้)

  # (ก) รูป `code: 'X'` ที่ใช้ตอนสร้าง error response ตรง ๆ
  BAD_CODES=$(grep -rnE "code\s*:\s*['\"][A-Z_]+['\"]" backend/src --include='*.ts' \
    --exclude='*.spec.ts' --exclude-dir=test 2>/dev/null \
    | grep -vE "code\s*:\s*['\"]($ALLOWED_CODES)['\"]" || true)

  # (ข) ค่าที่ประกาศไว้ใน `ErrorCode` — ทั้ง object (`const ErrorCode = {...}`),
  # enum และ type union ส่วนใหญ่ระบบประกาศรายการไว้ที่นี่แล้วอ้าง
  # `ErrorCode.X` ทีหลัง ซึ่งรูป (ก) มองไม่เห็นเลย · ตัวสแกนเป็นไฟล์ node แยก
  # (heredoc ซ้อนใน command substitution ทำให้ bash 3.2 ของ macOS parse ไม่ผ่าน)
  # ถ้าเครื่องไม่มี node ข้ามเฉพาะส่วนนี้
  if command -v node >/dev/null 2>&1; then
    DECLARED=$(node "$SCRIPT_DIR/lib/api04-errorcode-scan.js" "$ALLOWED_CODES" backend/src)
    if [[ -n "$DECLARED" ]]; then
      BAD_CODES=$(printf '%s\n%s' "$BAD_CODES" "$DECLARED" | sed '/^$/d')
    fi
  fi

  if [[ -n "$BAD_CODES" ]]; then
    echo "❌ [API-04] error.code ไม่อยู่ในรายการมาตรฐาน $CODE_COUNT ค่า ($ALLOWED_CODES)"
    echo "$BAD_CODES" | sed 's/^/   /'
    VIOLATION=1
  fi

  # API-05: ต้องมี GET /api/health (public) — รับทั้ง @Get('health')
  # และ @Controller('health') + @Get()
  if ! grep -rqE "@Get\(\s*['\"]health['\"]\s*\)|@Controller\(\s*['\"]health['\"]|@Controller\(\s*\{[^}]*path:\s*['\"]health['\"]" \
    backend/src --include='*.ts' 2>/dev/null; then
    echo "❌ [API-05] ไม่พบ endpoint GET /api/health"
    VIOLATION=1
  fi

  # API-07: pagination ต้องใช้ page/limit ไม่ใช่ per_page (api-conventions.md ข้อ 5)
  PER_PAGE=$(grep -rnE "\bper_page\b|\bperPage\b" backend/src --include='*.ts' \
    --exclude-dir=node_modules 2>/dev/null || true)
  if [[ -n "$PER_PAGE" ]]; then
    echo "❌ [API-07] pagination ต้องใช้ ?page= และ ?limit= ไม่ใช่ per_page/perPage"
    echo "$PER_PAGE" | sed 's/^/   /'
    VIOLATION=1
  fi
fi

# API-06 (Warn only): public_endpoints declared in subsystem.yaml
if [[ -f subsystem.yaml ]] && ! grep -q "^public_endpoints:" subsystem.yaml; then
  echo "⚠️  [API-06] ไม่พบการประกาศ public_endpoints ใน subsystem.yaml"
fi

if [[ "$VIOLATION" -eq 1 ]]; then
  cat <<EOF
   อ้างอิง: api-conventions.md ข้อ 1, 2, 3, 4, 5, 8
   วิธีแก้: ปรับ route ให้เป็น kebab-case พหูพจน์ใต้ /api/v1/, ห่อ response ด้วย envelope มาตรฐาน,
            ใช้ error.code จาก contracts/error-codes.json, ใช้ page/limit สำหรับ pagination
            และเพิ่ม endpoint GET /api/health
EOF
  exit 1
fi
echo "✅ [API-02..07] ผ่านการตรวจ API conventions"
