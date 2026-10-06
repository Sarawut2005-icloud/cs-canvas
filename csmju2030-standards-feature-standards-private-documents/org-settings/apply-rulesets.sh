#!/usr/bin/env bash
# apply-rulesets.sh — create the two CSMJU2030 rulesets from the .json
# payloads beside this script.
#
#   ./apply-rulesets.sh org                 # one org ruleset covering csmju-*
#   ./apply-rulesets.sh repo csmju-equipment [more repos...]
#   ./apply-rulesets.sh self                # ป้องกัน main ของ standards repo เอง
#   ./apply-rulesets.sh validate <repo>     # POST as `disabled`, then delete
#   ./apply-rulesets.sh sweep [--dry-run]   # ไล่ทุก repo ใน org ตั้งให้ตัวที่ยังขาด
#
# org mode needs the `admin:org` scope:
#   gh auth refresh -h github.com -s admin:org
# repo mode works with plain `repo` scope but must be run per subsystem repo.
#
# A ruleset of the same name is updated in place (PUT) rather than duplicated.
#
# sweep คือตัวแทน org ruleset บน plan Free — .github/workflows/ruleset-sweep.yml
# เรียกทุกชั่วโมง นับเป็น repo ระบบย่อยเฉพาะตัวที่มี subsystem.yaml บน default
# branch เพราะ main-protection บังคับ status check ของ compliance ถ้าไปตั้งให้
# repo ที่ไม่มี ci.yml ของ standards (เช่น design-system) จะ merge อะไรไม่ได้อีก
# และสร้างเฉพาะ ruleset ที่ชื่อยังไม่มี ไม่ PUT ทับตัวที่มีอยู่แล้ว เผื่อ devops
# ปรับราย repo ไว้โดยตั้งใจ

set -euo pipefail

ORG="CSMJU2030"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:?ระบุ mode: org | repo | self | validate | sweep}"
SUBSYSTEM_RULESETS=(main-protection branch-naming)
shift || true

# บล็อกกรณี default branch ไม่ใช่ main หรือ develop — ruleset exclude แค่สองชื่อนี้
# (develop คือ branch รวมงานตาม github-workflow.md 1.5) ถ้า default เป็น master
# จะโดน branch_name_pattern ตีตก push เข้า default เอง
is_long_lived_branch() {
  [ "$1" = "main" ] || [ "$1" = "develop" ]
}

guard_default_branch() {
  local repo="$1" br
  br=$(gh api "repos/$ORG/$repo" --jq .default_branch)
  if ! is_long_lived_branch "$br"; then
    echo "❌ $repo: default branch คือ '$br' ไม่ใช่ 'main' หรือ 'develop'" >&2
    echo "   ต้อง rename เป็น main ก่อน ไม่งั้น branch-naming จะบล็อก branch หลักเอง" >&2
    return 1
  fi
}

# POST ถ้ายังไม่มีชื่อนี้, PUT ถ้ามีแล้ว
upsert() {
  local scope_path="$1" payload="$2" name existing
  name=$(jq -r .name "$payload")
  existing=$(gh api "$scope_path" --jq ".[] | select(.name==\"$name\") | .id" 2>/dev/null | head -1)
  if [ -n "$existing" ]; then
    gh api "$scope_path/$existing" -X PUT --input "$payload" --jq '"  ↻ อัปเดต \(.name) (id=\(.id), \(.enforcement))"'
  else
    gh api "$scope_path" -X POST --input "$payload" --jq '"  + สร้าง \(.name) (id=\(.id), \(.enforcement))"'
  fi
}

# ใน Actions ให้ขึ้นเป็น annotation ด้วย นอกนั้นพิมพ์ธรรมดา
warn() {
  echo "  ⚠️  $*" >&2
  [ -z "${GITHUB_ACTIONS:-}" ] || echo "::warning::$*"
}
fail() {
  echo "  ❌ $*" >&2
  [ -z "${GITHUB_ACTIONS:-}" ] || echo "::error::$*"
}

# repo เดียวใน sweep: สร้าง ruleset ที่ขาด คืนค่า 1 ถ้าตั้งไม่สำเร็จ
sweep_repo() {
  local repo="$1" branch="$2" have n name missing=()
  have=$(gh api "repos/$ORG/$repo/rulesets" --jq '.[].name') || return 1
  for n in "${SUBSYSTEM_RULESETS[@]}"; do
    name=$(jq -r .name "$DIR/ruleset-$n.repo.json")
    grep -qxF "$name" <<<"$have" || missing+=("$n")
  done
  if [ "${#missing[@]}" -eq 0 ]; then
    echo "  ✓ ครบแล้ว"
    return 0
  fi
  if ! is_long_lived_branch "$branch"; then
    fail "$repo: default branch คือ '$branch' ไม่ใช่ 'main' หรือ 'develop' — rename ก่อน แล้ว sweep จะตั้งให้เอง"
    return 1
  fi
  for n in "${missing[@]}"; do
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "  (dry-run) จะสร้าง $(jq -r .name "$DIR/ruleset-$n.repo.json")"
    else
      upsert "repos/$ORG/$repo/rulesets" "$DIR/ruleset-$n.repo.json" || return 1
    fi
  done
  SWEEP_APPLIED+=("$repo")
}

case "$MODE" in
  org)
    echo "→ org ruleset บน $ORG (ครอบ csmju-*)"
    for n in main-protection branch-naming; do
      upsert "orgs/$ORG/rulesets" "$DIR/ruleset-$n.org.json"
    done
    ;;
  repo)
    [ "$#" -gt 0 ] || { echo "ระบุชื่อ repo อย่างน้อย 1 ตัว" >&2; exit 1; }
    for repo in "$@"; do
      echo "→ $ORG/$repo"
      guard_default_branch "$repo"
      for n in main-protection branch-naming; do
        upsert "repos/$ORG/$repo/rulesets" "$DIR/ruleset-$n.repo.json"
      done
    done
    ;;
  self)
    echo "→ $ORG/csmju2030-standards (ชุดของ standards repo เอง)"
    upsert "repos/$ORG/csmju2030-standards/rulesets" "$DIR/ruleset-standards-repo.repo.json"
    ;;
  validate)
    repo="${1:?ระบุ repo}"
    echo "→ validate payload บน $ORG/$repo (สร้างแบบ disabled แล้วลบ)"
    tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
    for n in main-protection branch-naming; do
      jq '.enforcement="disabled" | .name="VALIDATE-ONLY-'"$n"'"' \
        "$DIR/ruleset-$n.repo.json" > "$tmp/$n.json"
      id=$(gh api "repos/$ORG/$repo/rulesets" -X POST --input "$tmp/$n.json" --jq .id)
      echo "  ✅ $n รับได้ (id=$id)"
      gh api "repos/$ORG/$repo/rulesets/$id" -X DELETE
    done
    echo "  ลบ ruleset ทดสอบเรียบร้อย"
    ;;
  sweep)
    DRY_RUN=0
    [ "${1:-}" = "--dry-run" ] && DRY_RUN=1
    SWEEP_APPLIED=() SWEEP_FAILED=() SWEEP_SKIPPED=()
    echo "→ sweep ทุก repo ใน $ORG$([ "$DRY_RUN" -eq 0 ] || echo ' (dry-run)')"
    # ไม่ใส่ || ต่อท้าย: ถ้า token ใช้ไม่ได้ต้องพังตรงนี้ ไม่ใช่รายงานว่าไม่มี repo
    repos=$(gh api --paginate "orgs/$ORG/repos?type=all&per_page=100" \
      --jq '.[] | select(.archived | not) | [.name, .visibility, .default_branch] | @tsv')
    # อ่านผ่าน fd 3 กัน gh ในลูปกิน stdin ที่เป็นรายชื่อ repo ไป
    while IFS=$'\t' read -r repo visibility branch <&3; do
      [ -n "$repo" ] || continue
      echo "→ $repo ($visibility)"
      # plan Free ตั้ง ruleset ให้ repo private ไม่ได้ (403 "Upgrade to GitHub Pro")
      if [ "$visibility" != "public" ]; then
        echo "  ข้าม — private ตั้ง ruleset บน plan Free ไม่ได้"
        SWEEP_SKIPPED+=("$repo (private)")
        continue
      fi
      if ! gh api "repos/$ORG/$repo/contents/subsystem.yaml" --silent 2>/dev/null; then
        echo "  ข้าม — ไม่มี subsystem.yaml ไม่ใช่ repo ระบบย่อย"
        SWEEP_SKIPPED+=("$repo (ไม่มี subsystem.yaml)")
        continue
      fi
      if ! sweep_repo "$repo" "$branch"; then
        fail "$repo: ตั้ง ruleset ไม่สำเร็จ"
        SWEEP_FAILED+=("$repo")
      fi
    done 3<<<"$repos"

    summary="### Ruleset sweep$([ "$DRY_RUN" -eq 0 ] || echo ' (dry-run)')
- ตั้งเพิ่ม: ${#SWEEP_APPLIED[@]} repo ${SWEEP_APPLIED[*]:-}
- ไม่สำเร็จ: ${#SWEEP_FAILED[@]} repo ${SWEEP_FAILED[*]:-}
- ข้าม: $(IFS=,; echo "${SWEEP_SKIPPED[*]:-ไม่มี}")"
    echo ""
    echo "$summary"
    [ -z "${GITHUB_STEP_SUMMARY:-}" ] || echo "$summary" >> "$GITHUB_STEP_SUMMARY"
    [ "${#SWEEP_FAILED[@]}" -eq 0 ] || exit 1
    ;;
  *)
    echo "mode ไม่รู้จัก: $MODE (org | repo | self | validate | sweep)" >&2; exit 1 ;;
esac

echo "✅ เสร็จ"
