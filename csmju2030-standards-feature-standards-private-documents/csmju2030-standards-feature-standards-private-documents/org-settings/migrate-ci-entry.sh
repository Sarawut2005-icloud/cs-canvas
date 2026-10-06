#!/usr/bin/env bash
# migrate-ci-entry.sh — moves every subsystem repo's ci.yml to a new entry
# point: once to the self-serve bump (1.5.2), and again only when the entry
# point itself changes (docs/standards-versioning.md ข้อ 4 และ 5.4)
#
#   ./migrate-ci-entry.sh v1.5.2                      # dry run: แสดงว่าจะแก้อะไร ไม่แตะ repo
#   ./migrate-ci-entry.sh v1.5.2 --apply              # เปิด PR ทุก repo ที่ยังไม่ย้าย
#   ./migrate-ci-entry.sh v1.5.2 --apply --merge      # เปิด PR แล้ว merge แบบ admin ทันที
#   ./migrate-ci-entry.sh v1.5.2 --apply csmju-quiz   # ทำเฉพาะ repo ที่ระบุ
#
# Safe to run again: repos already on the tag are skipped, and an open
# migration PR is reused (merged with --merge) instead of opened twice.
#
# Per repo, on its default branch, a single PR that
#   1. moves the `uses: ...subsystem-compliance.yml@vX` pin in ci.yml to the tag
#   2. drops the `/standards @csmju2030/devops` line from .github/CODEOWNERS
# and nothing else: `.standards-version` and the submodule stay where they
# are, so every team keeps the checks it has today and bumps when it chooses.
#
# The PR fails Convention Check (GH-03) on purpose — only DevOps may touch
# these two files — so it has to be merged by an org admin or team devops
# (bypass_mode: pull_request in ruleset-main-protection). --merge does that.
#
# ต้องมี: gh CLI ที่ login เป็น org admin หรือสมาชิก team devops · git
# ต้องติด tag ก่อน — PR จะรัน CI ด้วยตัวกลางของ tag นั้นทันที

set -euo pipefail

ORG="CSMJU2030"
TAG="${1:?ระบุ tag เช่น v1.5.2}"
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

if ! gh api "repos/$ORG/csmju2030-standards/git/ref/tags/$TAG" >/dev/null 2>&1; then
  echo "❌ ยังไม่มี tag $TAG ใน $ORG/csmju2030-standards — ติด tag ก่อนย้าย" >&2
  exit 1
fi
# tags before 1.5.2 check out the entry point with github.job_workflow_sha,
# which is empty in a called workflow, so their checks silently come from main
ENTRY_WF="$(gh api "repos/$ORG/csmju2030-standards/contents/.github/workflows/subsystem-compliance.yml?ref=$TAG" \
  -H 'Accept: application/vnd.github.raw' 2>/dev/null || true)"
if ! grep -q "^  STANDARDS_ENTRY_REF: $TAG\$" <<< "$ENTRY_WF"; then
  echo "❌ tag $TAG ไม่ได้ปักตัวกลางไว้ที่ตัวเอง (ไม่มี STANDARDS_ENTRY_REF: $TAG) — ใช้ v1.5.2 ขึ้นไป" >&2
  exit 1
fi

if [[ ${#REPOS[@]} -eq 0 ]]; then
  while IFS= read -r r; do REPOS+=("$r"); done < <(gh repo list "$ORG" --limit 200 --no-archived --json name -q '.[].name' | sort)
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PIN_RE='subsystem-compliance\.yml@v[0-9]+\.[0-9]+\.[0-9]+'
DONE=0
SKIPPED=0

for repo in "${REPOS[@]}"; do
  ci="$(gh api "repos/$ORG/$repo/contents/.github/workflows/ci.yml" -q .content 2>/dev/null | base64 -d 2>/dev/null || true)"
  pin="$(printf '%s\n' "$ci" | grep -oE "$PIN_RE" | head -1 | sed 's/.*@//' || true)"
  if [[ -z "$pin" ]]; then
    SKIPPED=$((SKIPPED + 1))
    continue   # ไม่ใช่ repo ระบบย่อย (ไม่มี ci.yml ที่เรียก subsystem-compliance)
  fi
  if [[ "$pin" == "$TAG" ]]; then
    echo "✅ $repo — ย้ายแล้ว ($TAG)"
    continue
  fi

  slug="${repo#csmju-}"
  slug="$(printf '%s' "$slug" | tr 'A-Z_' 'a-z-')"
  branch="feature/$slug/standards-self-serve-bump"
  title="ci($slug): pin compliance entry at $TAG so the team bumps standards itself"

  if [[ "$APPLY" -eq 0 ]]; then
    echo "→ $repo — ci.yml @$pin → @$TAG · ลบ /standards ออกจาก CODEOWNERS (dry run)"
    continue
  fi

  url="$(gh pr list -R "$ORG/$repo" --head "$branch" --state open --json url -q '.[0].url' 2>/dev/null || true)"
  if [[ -n "$url" ]]; then
    echo "🔁 $repo — มี PR ย้ายเปิดอยู่แล้ว: $url"
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
  sed -i -E "s#($PIN_RE)#subsystem-compliance.yml@$TAG#" "$dir/.github/workflows/ci.yml"
  if [[ -f "$dir/.github/CODEOWNERS" ]]; then
    sed -i -E '/^\/standards[[:space:]]/d' "$dir/.github/CODEOWNERS"
  fi
  git -C "$dir" add -A
  git -C "$dir" commit -q -m "$title" -m "Only the entry point is pinned now; the checks come from .standards-version, which the team moves together with the standards submodule (csmju2030-standards docs/standards-versioning.md)."
  git -C "$dir" push -q -f -u origin "$branch"   # a branch left from an earlier run is replaced

  url="$(gh pr create -R "$ORG/$repo" --head "$branch" --title "$title" --body "$(cat <<EOF
ย้าย CI ไปใช้ระบบเลือกเวอร์ชันเองของ standards $TAG ([docs/standards-versioning.md](https://github.com/$ORG/csmju2030-standards/blob/main/docs/standards-versioning.md))

- \`ci.yml\` ปักหมุดตัวกลางที่ \`$TAG\` — ชุดตรวจมาจาก \`.standards-version\` แทน
- CODEOWNERS ไม่ต้องให้ DevOps approve submodule \`standards\` แล้ว (CI ตรวจว่าชี้ tag ที่ \`.standards-version\` ระบุ)
- **ไม่เปลี่ยน** \`.standards-version\` และ submodule — ทีมยังตรวจด้วยชุดเดิม (\`$(gh api "repos/$ORG/$repo/contents/.standards-version" -q .content 2>/dev/null | base64 -d 2>/dev/null | tr -d '[:space:]' || echo '?')\`) จนกว่าจะเลื่อนเอง

Convention Check ตก \`GH-03\` โดยตั้งใจ เพราะแก้ไฟล์ที่ DevOps เท่านั้นแก้ได้ — DevOps merge แบบ bypass
EOF
)")"
  echo "🔀 $repo — $url"

  if [[ "$MERGE" -eq 1 ]]; then
    gh pr merge -R "$ORG/$repo" "$url" --squash --admin --delete-branch >/dev/null
    echo "   merged"
  fi
  DONE=$((DONE + 1))
done

echo
echo "เสร็จ: ย้าย $DONE repo · ข้าม $SKIPPED repo ที่ไม่ใช่ระบบย่อย$([[ "$APPLY" -eq 0 ]] && echo ' (dry run — ใส่ --apply เพื่อทำจริง)')"
