#!/usr/bin/env bash
# scripts/check-no-secrets.sh — SEC-01, SEC-02
# Usage: check-no-secrets.sh [target_dir]
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

VIOLATION=0

# SEC-01: hardcoded connection strings / API keys / secrets in source
PATTERNS=(
  'postgres(ql)?:\/\/[^ '"'"'"$]+:[^ '"'"'"$]+@'
  'CSMJU_CLIENT_SECRET\s*=\s*["'"'"'][^"'"'"']+["'"'"']'
  '[Aa][Pp][Ii]_?[Kk][Ee][Yy]\s*[:=]\s*["'"'"'][A-Za-z0-9_\-]{12,}["'"'"']'
  '-----BEGIN (RSA |EC )?PRIVATE KEY-----'
)
for PATTERN in "${PATTERNS[@]}"; do
  RESULT=$(grep -rnE "$PATTERN" frontend backend 2>/dev/null \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    --include='*.env*' \
    --exclude='*.example' \
    --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist || true)
  if [[ -n "$RESULT" ]]; then
    echo "❌ [SEC-01] พบ hardcoded connection string / API key / secret"
    echo "$RESULT" | sed 's/^/   /'
    VIOLATION=1
  fi
done

# SEC-02: .env file with real values committed (not .env.example)
ENV_FILES_RAW=$(find . -maxdepth 3 -type f -name '.env*' ! -name '.env.example' \
  -not -path '*/node_modules/*' -not -path './.compliance-tools/*' -not -path './standards/*' 2>/dev/null || true)

# ไฟล์ที่ git ignore ไว้ไม่ได้อยู่ใน repo จริง (นักพัฒนาทุกคนมี .env ในเครื่องตัวเอง)
ENV_FILES=""
if [[ -n "$ENV_FILES_RAW" ]]; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      git check-ignore -q "$f" && continue
    fi
    ENV_FILES+="$f"$'\n'
  done <<< "$ENV_FILES_RAW"
  ENV_FILES=$(printf '%s' "$ENV_FILES")
fi

if [[ -n "$ENV_FILES" ]]; then
  echo "❌ [SEC-02] พบไฟล์ .env ที่มีค่าจริงใน repo:"
  echo "$ENV_FILES" | sed 's/^/   - /'
  VIOLATION=1
fi

if [[ "$VIOLATION" -eq 1 ]]; then
  cat <<EOF
   อ้างอิง: github-workflow.md ข้อ 4
   วิธีแก้: ย้ายค่าจริงไปที่ .env.local (ห้าม commit) หรือ GitHub Actions Secrets
            เก็บเฉพาะชื่อ key ไว้ใน .env.example
EOF
  exit 1
fi
echo "✅ [SEC-01/02] ไม่พบ secret หรือ .env ที่มีค่าจริง"
