#!/usr/bin/env bash
# add-image-workflow.sh — puts .github/workflows/images.yml (templates/images.yml)
# into every subsystem repo, or moves its pin to a newer tag
# (docs/deployment.md ข้อ 5)
#
#   ./add-image-workflow.sh v1.8.0                      # dry run: แสดงว่าจะแก้อะไร ไม่แตะ repo
#   ./add-image-workflow.sh v1.8.0 --apply              # เปิด PR ทุก repo ที่ยังไม่มีหรือยังปักหมุดเก่า
#   ./add-image-workflow.sh v1.8.0 --apply --merge      # เปิด PR แล้ว merge แบบ admin ทันที
#   ./add-image-workflow.sh v1.8.0 --apply csmju-quiz   # ทำเฉพาะ repo ที่ระบุ
#
# Safe to run again: repos already on the tag are skipped, and an open PR is
# reused (merged with --merge) instead of opened twice.
#
# The file is written from templates/images.yml of the tag itself, with its
# pin set to the tag — nothing else in the repo changes. A repo still on
# standards before 1.8.0 gets the file too: from v1.8.1 the build only plans
# and skips with a notice, and starts publishing once the team moves to 1.8.0
# or later, where DEP-01..04 hold its Dockerfiles to docs/deployment.md.
#
# The PR fails Convention Check (GH-03) on purpose — only DevOps may touch
# .github/workflows/ — so it has to be merged by an org admin or team devops
# (bypass_mode: pull_request in ruleset-main-protection). --merge does that.
#
# ต้องมี: gh CLI ที่ login เป็น org admin หรือสมาชิก team devops · git
# ต้องติด tag ก่อน — PR ใช้ workflow ของ tag นั้นทันทีที่ merge

set -euo pipefail

ORG="CSMJU2030"
TAG="${1:?ระบุ tag เช่น v1.8.0}"
shift
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "❌ tag ต้องเป็นรูปแบบ vX.Y.Z" >&2; exit 1; }

APPLY=0
MERGE=0
REPOS=()
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --merge) MERGE=1 ;;
    *) REPOS+=("$arg") ;;
  esac
done

raw() { # path ref
  gh api "repos/$ORG/csmju2030-standards/contents/$1?ref=$2" -H 'Accept: application/vnd.github.raw' 2>/dev/null
}

if ! gh api "repos/$ORG/csmju2030-standards/git/ref/tags/$TAG" >/dev/null 2>&1; then
  echo "❌ ยังไม่มี tag $TAG ใน $ORG/csmju2030-standards — ติด tag ก่อน" >&2
  exit 1
fi
if ! raw .github/workflows/subsystem-images.yml "$TAG" >/dev/null; then
  echo "❌ tag $TAG ไม่มี .github/workflows/subsystem-images.yml — ใช้ v1.8.0 ขึ้นไป" >&2
  exit 1
fi
PIN_RE='subsystem-images\.yml@v[0-9]+\.[0-9]+\.[0-9]+'
TEMPLATE="$(raw templates/images.yml "$TAG" | sed -E "s#$PIN_RE#subsystem-images.yml@$TAG#")"
if ! grep -q "subsystem-images.yml@$TAG" <<< "$TEMPLATE"; then
  echo "❌ อ่าน templates/images.yml ของ $TAG ไม่ได้" >&2
  exit 1
fi

if [[ ${#REPOS[@]} -eq 0 ]]; then
  while IFS= read -r r; do REPOS+=("$r"); done < <(gh repo list "$ORG" --limit 200 --no-archived --json name -q '.[].name' | sort)
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
DONE=0
SKIPPED=0

for repo in "${REPOS[@]}"; do
  ci="$(gh api "repos/$ORG/$repo/contents/.github/workflows/ci.yml" -q .content 2>/dev/null | base64 -d 2>/dev/null || true)"
  if ! grep -qE 'subsystem-compliance\.yml@' <<< "$ci"; then
    SKIPPED=$((SKIPPED + 1))
    continue   # ไม่ใช่ repo ระบบย่อย (ไม่มี ci.yml ที่เรียก subsystem-compliance)
  fi
  current="$(gh api "repos/$ORG/$repo/contents/.github/workflows/images.yml" -q .content 2>/dev/null | base64 -d 2>/dev/null || true)"
  pin="$(printf '%s\n' "$current" | grep -oE "$PIN_RE" | head -1 | sed 's/.*@//' || true)"
  if [[ "$pin" == "$TAG" ]]; then
    echo "✅ $repo — images.yml อยู่ที่ $TAG แล้ว"
    continue
  fi

  slug="${repo#csmju-}"
  slug="$(printf '%s' "$slug" | tr 'A-Z_' 'a-z-')"
  branch="feature/$slug/image-workflow"
  if [[ -z "$pin" ]]; then
    title="ci($slug): build the api and web images on ghcr.io ($TAG)"
    what="เพิ่ม images.yml"
  else
    title="ci($slug): move the image workflow to $TAG"
    what="images.yml @$pin → @$TAG"
  fi

  if [[ "$APPLY" -eq 0 ]]; then
    echo "→ $repo — $what (dry run)"
    continue
  fi

  url="$(gh pr list -R "$ORG/$repo" --head "$branch" --state open --json url -q '.[0].url' 2>/dev/null || true)"
  if [[ -n "$url" ]]; then
    echo "🔁 $repo — มี PR เปิดอยู่แล้ว: $url"
    if [[ "$MERGE" -eq 1 ]]; then
      gh pr merge -R "$ORG/$repo" "$url" --squash --admin --delete-branch >/dev/null
      echo "   merged"
    fi
    DONE=$((DONE + 1))
    continue
  fi

  dir="$WORK/$repo"
  git clone -q --depth 1 "https://github.com/$ORG/$repo.git" "$dir"
  git -C "$dir" switch -q -c "$branch"
  mkdir -p "$dir/.github/workflows"
  printf '%s\n' "$TEMPLATE" > "$dir/.github/workflows/images.yml"
  git -C "$dir" add .github/workflows/images.yml
  git -C "$dir" commit -q -m "$title" -m "Every push to main builds backend/Dockerfile and frontend/Dockerfile and pushes them to ghcr.io/$(printf '%s' "$ORG" | tr 'A-Z' 'a-z')/$repo-api and -web (csmju2030-standards docs/deployment.md), once the repo is on standards 1.8.0 or later."
  git -C "$dir" push -q -f -u origin "$branch"   # a branch left from an earlier run is replaced

  url="$(gh pr create -R "$ORG/$repo" --head "$branch" --title "$title" --body "$(printf '%s\n' \
    "build image ของระบบนี้ไปไว้ที่ GitHub Container Registry ทุกครั้งที่ merge เข้า \`main\` ([docs/deployment.md](https://github.com/$ORG/csmju2030-standards/blob/main/docs/deployment.md) ข้อ 5)" \
    "" \
    "- \`backend/Dockerfile\` → \`ghcr.io/$(printf '%s' "$ORG" | tr 'A-Z' 'a-z')/$repo-api\` · \`frontend/Dockerfile\` → \`…-web\`" \
    "- tag: \`main\` และ \`sha-<commit>\` สำหรับย้อนกลับ" \
    "- **ยังไม่ build จนกว่าทีมจะเลื่อน \`.standards-version\` เป็น 1.8.0 ขึ้นไป** (ผ่าน \`DEP-01..04\` แล้ว) — ก่อนหน้านั้น workflow แค่ตรวจแล้วข้ามพร้อมแจ้งเตือน ไม่ตก" \
    "" \
    "Convention Check ตก \`GH-03\` โดยตั้งใจ เพราะแก้ไฟล์ใน \`.github/workflows/\` ที่ DevOps เท่านั้นแก้ได้ — DevOps merge แบบ bypass")")"
  echo "🔀 $repo — $url"

  if [[ "$MERGE" -eq 1 ]]; then
    gh pr merge -R "$ORG/$repo" "$url" --squash --admin --delete-branch >/dev/null
    echo "   merged"
  fi
  DONE=$((DONE + 1))
done

echo
echo "เสร็จ: $DONE repo · ข้าม $SKIPPED repo ที่ไม่ใช่ระบบย่อย$([[ "$APPLY" -eq 0 ]] && echo ' (dry run — ใส่ --apply เพื่อทำจริง)')"
