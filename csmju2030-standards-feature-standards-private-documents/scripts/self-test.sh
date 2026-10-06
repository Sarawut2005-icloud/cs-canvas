#!/usr/bin/env bash
# scripts/self-test.sh
# Runs every check script against small pass/fail fixtures and asserts the
# exit code is what's expected (0 for pass, 1 for fail). This is the main
# way to verify the whole compliance-check system actually works, without
# needing a real subsystem repo or GitHub Actions.
#
# Usage: self-test.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../__fixtures__"

TOTAL=0
FAILED=0

assert_exit() {
  local label="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if [[ "$actual" -eq "$expected" ]]; then
    echo "  ✅ PASS  $label (exit=$actual, expected=$expected)"
  else
    echo "  ❌ FAIL  $label (exit=$actual, expected=$expected)"
    FAILED=$((FAILED + 1))
  fi
}

# --- Generic fixture-based checks: __fixtures__/<name>/{pass,fail} -------
run_fixture_case() {
  local name="$1" script="$2"
  local pass_dir="$FIXTURES_DIR/$name/pass"
  local fail_dir="$FIXTURES_DIR/$name/fail"

  if [[ -d "$pass_dir" ]]; then
    "$SCRIPT_DIR/$script" "$pass_dir" >/dev/null 2>&1
    assert_exit "$name pass-fixture ($script)" 0 "$?"
  fi
  if [[ -d "$fail_dir" ]]; then
    "$SCRIPT_DIR/$script" "$fail_dir" >/dev/null 2>&1
    assert_exit "$name fail-fixture ($script)" 1 "$?"
  fi
}

echo "== Fixture-based checks =="
run_fixture_case "SEC-01"    "check-no-secrets.sh"
run_fixture_case "SEC-03"    "check-no-local-storage.sh"
run_fixture_case "ARC-01"    "check-db-isolation.sh"
run_fixture_case "ARC-02-03" "check-authorized-deps.sh"
# ARC-02-DEV: devDependencies are held to allowed_dev_tooling + @types/*,
# but forbidden_everywhere still applies there and dev tooling is still
# rejected as a runtime dependency.
run_fixture_case "ARC-02-DEV" "check-authorized-deps.sh"
# ARC-02-MAP: lucide-react / leaflet / qrcode.react / @tailwindcss/postcss are allowed since 1.2.1;
# react-leaflet stays out (Hippocratic-2.1 is not an OSI licence) — use leaflet directly.
run_fixture_case "ARC-02-MAP" "check-authorized-deps.sh"
# ARC-02-REALTIME: socket.io / @nestjs/websockets / @nestjs/platform-socket.io /
# socket.io-client are allowed since 1.7.1, and @testing-library/jest-dom /
# user-event as dev tooling only — a runtime dependency on them still fails.
run_fixture_case "ARC-02-REALTIME" "check-authorized-deps.sh"
# ARC-02-DEV-UNLISTED is a regression case: dev_tooling_patterns used to
# test each package name against itself, so any devDependency passed —
# including a library outside the whitelist (react-leaflet) moved there to dodge it.
run_fixture_case "ARC-02-DEV-UNLISTED" "check-authorized-deps.sh"
# ARC-02-EXC: an approved exception in .compliance-exceptions.yml (spec 11.1)
# names the package.json and the dependency; the same dependency in another
# package.json is still refused.
run_fixture_case "ARC-02-EXC" "check-authorized-deps.sh"
# ARC-04: every subsystem has a NestJS backend. A Next.js app doing the
# backend work used to pass, since each backend check skips without code;
# a non-NestJS backend fails too, and a fresh scaffold is skipped.
run_fixture_case "ARC-04" "check-backend-nestjs.sh"
run_fixture_case "ARC-04-NOTNEST" "check-backend-nestjs.sh"
run_fixture_case "ARC-04-SCAFFOLD" "check-backend-nestjs.sh"
# DEP-01..04: both images build from the repo (deployment.md 3). A USER set
# only in the build stage does not carry into the final one; root-only
# .dockerignore patterns miss backend/.env; a repo without a UI needs only
# backend/Dockerfile; a fresh scaffold is skipped.
run_fixture_case "DEP" "check-deploy-ready.sh"
run_fixture_case "DEP-ROOT" "check-deploy-ready.sh"
run_fixture_case "DEP-ROOT-EXPLICIT" "check-deploy-ready.sh"
run_fixture_case "DEP-IGNORE" "check-deploy-ready.sh"
run_fixture_case "DEP-STANDALONE" "check-deploy-ready.sh"
run_fixture_case "DEP-BACKEND-ONLY" "check-deploy-ready.sh"
run_fixture_case "DEP-SCAFFOLD" "check-deploy-ready.sh"
run_fixture_case "DD-01"     "check-field-aliases.sh"
# DD-02 is a regression case: the enum was copied wrong as
# student|staff|faculty|admin|guest, which rejected the real value
# "alumni" and accepted "faculty" — a field name, not a role.
run_fixture_case "DD-02"     "check-field-aliases.sh"
# DD-02-ROLES: lecturer and guest are core roles; 'teacher' is not.
run_fixture_case "DD-02-ROLES" "check-field-aliases.sh"
# DD-04/DD-05 fixtures are regression cases: both shapes below used to
# slip through (a SCREAMING_CASE faculty const, and a money field with a
# type annotation or a prisma Float column).
echo ""
echo "== DD-03: database naming (prisma @map) =="
run_fixture_case "DD-03"     "check-snake-case.sh"

echo ""
echo "== SEC-04: JWT verification ตามสัญญา =="
run_fixture_case "SEC-04"    "check-no-jwt-verify.sh"

run_fixture_case "DD-04"     "check-no-hardcoded-faculty.sh"
run_fixture_case "DD-05"     "check-money-fields.sh"
# API-02 is a regression case: the prefix check demanded exactly
# setGlobalPrefix('v1'), so following api-conventions.md ข้อ 1
# (/api/v1, with /health excluded) failed CI. pass/fail differ only
# in main.ts.
run_fixture_case "API-02"   "check-api-conventions.sh"
# API-02-EMPTY: a freshly scaffolded repo has backend/src but no .ts
# files yet. Gating on the directory alone made API-03/API-05 fail
# before anyone could write code. pass-only fixture.
run_fixture_case "API-02-EMPTY" "check-api-conventions.sh"
# API-04 reads the allowed codes from contracts/error-codes.json (9 since
# 1.1, adding TOO_MANY_REQUESTS and SERVICE_UNAVAILABLE) and also checks the
# values declared in an `ErrorCode` object, enum or type. The fail fixture
# only ever uses ErrorCode.RATE_LIMITED - never a `code: '...'` literal -
# which is exactly what the check used to miss. The pass fixture also holds
# a *.spec.ts with code: 'SCI' — test files are exempt: their `code` values
# are data samples (reference data), not the error contract.
run_fixture_case "API-04"   "check-api-conventions.sh"
run_fixture_case "UI-01"     "check-ui-tokens.sh"
# UI-01-NOSRC is a regression case: the scan was limited to frontend/src,
# so a Next.js app with app/ at the root of frontend/ passed without being
# checked. fail-only fixture.
run_fixture_case "UI-01-NOSRC" "check-ui-tokens.sh"
# UI-01-EXC: an approved exception lifts UI-01 for the file or folder it
# names and nothing else; one past its expiry lifts nothing (fail-only).
run_fixture_case "UI-01-EXC" "check-ui-tokens.sh"
run_fixture_case "UI-01-EXC-EXPIRED" "check-ui-tokens.sh"
run_fixture_case "QA-05"     "check-qa.sh"
run_fixture_case "EXC-01"    "check-exceptions.sh"

# --- SIGPIPE regression: `find | head -1` under pipefail -------------------
# head closes the pipe after one line; if find is still writing it dies with
# SIGPIPE (141) and set -e ends the script silently. On Linux CI that happened
# at random once Core Hub's file list outgrew the stdio buffer (~7 KB). This
# tree makes the list larger than a pipe can hold, so the old code fails every
# time. Built at runtime to keep 1,800 empty files out of the repo.
echo
echo "== SIGPIPE: large backend/src =="
BIG_TREE=$(mktemp -d)
mkdir -p "$BIG_TREE/backend/src"
printf "%s\n" "import { NestFactory } from '@nestjs/core';" \
  "async function bootstrap() { const app = await NestFactory.create(AppModule); app.setGlobalPrefix('api/v1'); }" \
  > "$BIG_TREE/backend/src/main.ts"
printf "%s\n" "@Controller('health')" "export class HealthController { @Get() ok() { return { success: true, data: {} }; } }" \
  > "$BIG_TREE/backend/src/health.controller.ts"
i=0
while [ "$i" -lt 1800 ]; do
  i=$((i + 1))
  : > "$BIG_TREE/backend/src/generated-file-number-$i-padding-to-outgrow-the-pipe.ts"
done
"$SCRIPT_DIR/check-api-conventions.sh" "$BIG_TREE" >/dev/null 2>&1
assert_exit "API-02..07 run to the end on a large backend (no SIGPIPE)" 0 "$?"
"$SCRIPT_DIR/check-no-jwt-verify.sh" "$BIG_TREE" >/dev/null 2>&1
assert_exit "SEC-04/05 run to the end on a large backend (no SIGPIPE)" 0 "$?"
rm -rf "$BIG_TREE"

# --- jq CRLF regression: Windows jq.exe ----------------------------------
# jq.exe ends every line with CR, so "true\r" never matched "true" and ARC-02
# refused every dependency, even next and react (reported by an AIE team on
# Windows). A stand-in jq that answers the same with CRLF line endings must
# leave the pass fixtures passing.
echo
echo "== jq CRLF (Windows jq.exe) =="
if command -v jq >/dev/null 2>&1; then
  FAKE_JQ_DIR=$(mktemp -d)
  REAL_JQ=$(type -P jq)
  printf '#!/bin/bash\n"%s" "$@" | awk '"'"'{ printf "%%s\\r\\n", $0 }'"'"'\nexit "${PIPESTATUS[0]}"\n' "$REAL_JQ" > "$FAKE_JQ_DIR/jq"
  chmod +x "$FAKE_JQ_DIR/jq"
  PATH="$FAKE_JQ_DIR:$PATH" "$SCRIPT_DIR/check-authorized-deps.sh" "$FIXTURES_DIR/ARC-02-03/pass" >/dev/null 2>&1
  assert_exit "ARC-02 with a CRLF jq still passes the pass fixture" 0 "$?"
  PATH="$FAKE_JQ_DIR:$PATH" "$SCRIPT_DIR/check-authorized-deps.sh" "$FIXTURES_DIR/ARC-02-03/fail" >/dev/null 2>&1
  assert_exit "ARC-02 with a CRLF jq still fails the fail fixture" 1 "$?"
  PATH="$FAKE_JQ_DIR:$PATH" "$SCRIPT_DIR/check-qa.sh" "$FIXTURES_DIR/QA-06/pass" >/dev/null 2>&1
  assert_exit "QA-06 with a CRLF jq still passes the pass fixture" 0 "$?"
  rm -rf "$FAKE_JQ_DIR"
fi

# --- GH-01: branch naming (no fixture dir needed, branch passed as arg) --
echo
echo "== GH-01: branch naming =="
"$SCRIPT_DIR/check-branch-name.sh" . "feature/equipment/add-borrow-return" >/dev/null 2>&1
assert_exit "GH-01 pass (valid branch name)" 0 "$?"
"$SCRIPT_DIR/check-branch-name.sh" . "bugfix-thing" >/dev/null 2>&1
assert_exit "GH-01 fail (invalid branch name)" 1 "$?"
# develop → main (release) and main → develop (hotfix back-merge) are the only
# PRs allowed between the two long-lived branches (github-workflow.md 1.5).
# GITHUB_BASE_REF is cleared so the result does not depend on the PR this
# self-test itself runs in.
GITHUB_BASE_REF="" "$SCRIPT_DIR/check-branch-name.sh" . "develop" "main" >/dev/null 2>&1
assert_exit "GH-01 pass (release PR develop → main)" 0 "$?"
GITHUB_BASE_REF="" "$SCRIPT_DIR/check-branch-name.sh" . "main" "develop" >/dev/null 2>&1
assert_exit "GH-01 pass (back-merge PR main → develop)" 0 "$?"
GITHUB_BASE_REF="" "$SCRIPT_DIR/check-branch-name.sh" . "feature/core-hub/add-thing" "develop" >/dev/null 2>&1
assert_exit "GH-01 pass (feature PR into develop)" 0 "$?"
GITHUB_BASE_REF="" "$SCRIPT_DIR/check-branch-name.sh" . "develop" >/dev/null 2>&1
assert_exit "GH-01 fail (develop outside a PR into main)" 1 "$?"
GITHUB_BASE_REF="" "$SCRIPT_DIR/check-branch-name.sh" . "release/1.1" "main" >/dev/null 2>&1
assert_exit "GH-01 fail (other long-lived names are still rejected)" 1 "$?"
GITHUB_BASE_REF="" "$SCRIPT_DIR/check-branch-name.sh" . "main" "main" >/dev/null 2>&1
assert_exit "GH-01 fail (main as a head outside the back-merge)" 1 "$?"

# --- GH-02: commit messages (needs a real git repo, built on the fly) ----
echo
echo "== GH-02: commit messages =="
setup_and_run_gh02() {
  local variant="$1"
  local dir
  dir="$(mktemp -d)"
  (
    cd "$dir" || exit 1
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test"
    echo "# readme" > README.md
    git add -A
    git commit -qm "chore: base"
  ) >/dev/null 2>&1

  local base_sha
  base_sha="$(cd "$dir" && git rev-parse HEAD)"

  case "$variant" in
    pass)
      (cd "$dir" && echo a >> README.md && git add -A && git commit -qm "feat(equipment): add borrow flow") >/dev/null 2>&1
      ;;
    fail)
      (cd "$dir" && echo a >> README.md && git add -A && git commit -qm "updated some stuff") >/dev/null 2>&1
      ;;
    merge)
      # Reproduces a pull_request checkout: a synthetic merge commit on top of
      # a valid Conventional Commit. The merge subject must be ignored.
      (
        cd "$dir"
        git switch -qc topic
        echo a >> README.md && git add -A && git commit -qm "fix(api): correct envelope"
        git switch -q master 2>/dev/null || git switch -q main
        echo b >> OTHER.md && git add -A && git commit -qm "chore: unrelated"
        git merge -q --no-ff topic -m "Merge topic into master"
      ) >/dev/null 2>&1
      ;;
  esac

  "$SCRIPT_DIR/check-commit-messages.sh" "$dir" "$base_sha" >/dev/null 2>&1
  local code=$?
  rm -rf "$dir"
  return $code
}
setup_and_run_gh02 "pass"
assert_exit "GH-02 pass (conventional commit)" 0 "$?"
setup_and_run_gh02 "fail"
assert_exit "GH-02 fail (non-conventional commit)" 1 "$?"
setup_and_run_gh02 "merge"
assert_exit "GH-02 pass (synthetic merge commit ignored)" 0 "$?"

# --- GH-03: CI file guard (needs a real git repo, built on the fly) ------
echo
echo "== GH-03: CI file guard =="
setup_and_run_gh03() {
  local variant="$1"
  local dir
  dir="$(mktemp -d)"
  (
    cd "$dir" || exit 1
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test"
    mkdir -p .github/workflows
    echo "# readme" > README.md
    echo "name: CI" > .github/workflows/ci.yml
    git add -A
    git commit -qm "chore: base"
  ) >/dev/null 2>&1

  local base_sha
  base_sha="$(cd "$dir" && git rev-parse HEAD)"

  case "$variant" in
    pass)
      (cd "$dir" && echo "more text" >> README.md && git add -A && git commit -qm "docs: update readme") >/dev/null 2>&1
      ;;
    submodule)
      # moving the standards submodule is part of a bump since 1.5.1 — GH-04 checks where it points
      (cd "$dir" && git update-index --add --cacheinfo "160000,$(printf '1%.0s' {1..40}),standards" \
        && git commit -qm "chore(equipment): bump standards") >/dev/null 2>&1
      ;;
    codeowners)
      (cd "$dir" && echo "* @someone" > .github/CODEOWNERS && git add -A && git commit -qm "chore: own everything") >/dev/null 2>&1
      ;;
    *)
      (cd "$dir" && echo "name: CI modified" > .github/workflows/ci.yml && git add -A && git commit -qm "ci: sneak change") >/dev/null 2>&1
      ;;
  esac

  "${GH03_RUNNER:-$SCRIPT_DIR/check-ci-untouched.sh}" "$dir" "$base_sha" >/dev/null 2>&1
  local code=$?
  rm -rf "$dir"
  return $code
}
setup_and_run_gh03 "pass"
assert_exit "GH-03 pass (only README changed)" 0 "$?"
setup_and_run_gh03 "submodule"
assert_exit "GH-03 pass (standards submodule moved)" 0 "$?"
setup_and_run_gh03 "fail"
assert_exit "GH-03 fail (workflow file changed)" 1 "$?"
setup_and_run_gh03 "codeowners"
assert_exit "GH-03 fail (CODEOWNERS changed)" 1 "$?"

# --- GH-04: version selection + submodule pointer (git repos built on the fly)
# A stand-in standards repo: one commit and one annotated tag per version,
# and a branch per floor holding MIN_VERSION (the real one is read from main).
echo
echo "== GH-04: .standards-version เลือกชุดตรวจ · submodule ชี้ tag เดียวกัน =="
new_repo() {
  git init -q "$1" && git -C "$1" config user.email "test@example.com" && git -C "$1" config user.name "Test"
}
make_tools_repo() {
  local dir="$1"
  shift
  new_repo "$dir"
  (
    cd "$dir" || exit 1
    for v in "$@"; do
      echo "$v" > VERSION
      git add -A && git commit -qm "chore: release $v" && git tag -a "v$v" -m "v$v"
    done
    git branch -q -M main
    for floor in 1.0.0 1.5.1; do
      git switch -qc "floor-$floor" main
      echo "$floor" > MIN_VERSION
      git add -A && git commit -qm "chore: floor $floor"
    done
    git switch -q main
  ) >/dev/null 2>&1
}
# make_target_repo <dir> <version>... — one commit per version of .standards-version
make_target_repo() {
  local dir="$1"
  shift
  new_repo "$dir"
  for v in "$@"; do
    (cd "$dir" && echo "$v" > .standards-version && git add -A && git commit -qm "chore(equipment): standards $v") >/dev/null 2>&1
  done
}
# with_submodule <dir> <sha> — point the standards gitlink at <sha>
with_submodule() {
  (cd "$1" && git update-index --add --cacheinfo "160000,$2,standards" && git commit -qm "chore(equipment): pin standards") >/dev/null 2>&1
}

GH04_TMP="$(mktemp -d)"
TOOLS="$GH04_TMP/tools"
make_tools_repo "$TOOLS" 1.0.0 1.5.1
SHA_100="$(git -C "$TOOLS" rev-parse 'v1.0.0^{commit}')"
SHA_151="$(git -C "$TOOLS" rev-parse 'v1.5.1^{commit}')"

select_version() { # select_version <target> <floor> [base_sha]
  CSMJU_MIN_VERSION_REF="floor-$2" PR_BASE_SHA="${3:-}" GITHUB_OUTPUT="" GITHUB_STEP_SUMMARY="" \
    "$SCRIPT_DIR/select-standards-version.sh" "$1" "$TOOLS" >/dev/null 2>&1
}

make_target_repo "$GH04_TMP/t-old" 1.0.0
select_version "$GH04_TMP/t-old" 1.0.0
assert_exit "GH-04 เลือก 1.0.0 ได้เมื่อขั้นต่ำ 1.0.0" 0 "$?"
[[ "$(git -C "$TOOLS" rev-parse HEAD)" == "$SHA_100" ]]
assert_exit "GH-04 ชุดตรวจถูกสลับไปที่ tag v1.0.0" 0 "$?"
select_version "$GH04_TMP/t-old" 1.5.1
assert_exit "GH-04 ตก 1.0.0 เมื่อขั้นต่ำเป็น 1.5.1" 1 "$?"

make_target_repo "$GH04_TMP/t-missing-tag" 9.9.9
select_version "$GH04_TMP/t-missing-tag" 1.0.0
assert_exit "GH-04 ตกเมื่อไม่มี tag ของเวอร์ชันนั้น" 1 "$?"
make_target_repo "$GH04_TMP/t-prefixed" v1.5.1
select_version "$GH04_TMP/t-prefixed" 1.0.0
assert_exit "GH-04 ตกเมื่อมี v นำหน้า (ต้องเป็น semver ล้วน)" 1 "$?"
new_repo "$GH04_TMP/t-nofile"
select_version "$GH04_TMP/t-nofile" 1.0.0
assert_exit "GH-04 ตกเมื่อไม่มี .standards-version" 1 "$?"
# PowerShell 5 `echo 1.0.0 > .standards-version` writes UTF-16 with a BOM and CRLF
new_repo "$GH04_TMP/t-windows"
printf '\xff\xfe1\x00.\x000\x00.\x000\x00\r\x00\n\x00' > "$GH04_TMP/t-windows/.standards-version"
select_version "$GH04_TMP/t-windows" 1.0.0
assert_exit "GH-04 อ่านไฟล์ UTF-16 + CRLF ที่ PowerShell เขียนได้" 0 "$?"

make_target_repo "$GH04_TMP/t-up" 1.0.0 1.5.1
select_version "$GH04_TMP/t-up" 1.0.0 "$(git -C "$GH04_TMP/t-up" rev-parse HEAD~1)"
assert_exit "GH-04 เลื่อนขึ้น 1.0.0 → 1.5.1 ได้" 0 "$?"
make_target_repo "$GH04_TMP/t-down" 1.5.1 1.0.0
select_version "$GH04_TMP/t-down" 1.0.0 "$(git -C "$GH04_TMP/t-down" rev-parse HEAD~1)"
assert_exit "GH-04 ตกเมื่อถอย 1.5.1 → 1.0.0" 1 "$?"

git -C "$TOOLS" checkout -q "$SHA_151"
make_target_repo "$GH04_TMP/p-ok" 1.5.1
with_submodule "$GH04_TMP/p-ok" "$SHA_151"
"$SCRIPT_DIR/check-submodule-pointer.sh" "$GH04_TMP/p-ok" "$TOOLS" >/dev/null 2>&1
assert_exit "GH-04 pass (submodule ชี้ tag เดียวกับ .standards-version)" 0 "$?"
make_target_repo "$GH04_TMP/p-behind" 1.5.1
with_submodule "$GH04_TMP/p-behind" "$SHA_100"
"$SCRIPT_DIR/check-submodule-pointer.sh" "$GH04_TMP/p-behind" "$TOOLS" >/dev/null 2>&1
assert_exit "GH-04 fail (เลื่อน .standards-version แต่ลืมเลื่อน submodule)" 1 "$?"
make_target_repo "$GH04_TMP/p-nosub" 1.5.1
"$SCRIPT_DIR/check-submodule-pointer.sh" "$GH04_TMP/p-nosub" "$TOOLS" >/dev/null 2>&1
assert_exit "GH-04 pass (ไม่มี submodule — ตรวจแค่เลขเวอร์ชัน)" 0 "$?"
make_target_repo "$GH04_TMP/p-mismatch" 1.0.0
"$SCRIPT_DIR/check-submodule-pointer.sh" "$GH04_TMP/p-mismatch" "$TOOLS" >/dev/null 2>&1
assert_exit "GH-04 fail (.standards-version ไม่ตรงกับชุดตรวจ)" 1 "$?"
new_repo "$GH04_TMP/p-bom"
printf '\xef\xbb\xbf1.5.1\r\n' > "$GH04_TMP/p-bom/.standards-version"
"$SCRIPT_DIR/check-submodule-pointer.sh" "$GH04_TMP/p-bom" "$TOOLS" >/dev/null 2>&1
assert_exit "GH-04 pass (.standards-version มี BOM + CRLF)" 0 "$?"
rm -rf "$GH04_TMP"

# --- run-job.sh: the job list, and policy checks that no version can swap out
echo
echo "== run-job.sh: รายการเช็คของแต่ละ job =="
MANIFEST="$SCRIPT_DIR/lib/jobs.tsv"
WORKFLOW="$SCRIPT_DIR/../.github/workflows/subsystem-compliance.yml"
MISSING=""
for job in $(grep -o 'run-job.sh" [a-z-]*' "$WORKFLOW" | awk '{ print $2 }'); do
  awk -F'\t' -v j="$job" '$1 == j { found = 1 } END { exit !found }' "$MANIFEST" || MISSING="$MISSING job:$job"
done
for script in $(grep -v '^#' "$MANIFEST" | awk -F'\t' '{ print $3 }'); do
  [[ -f "$SCRIPT_DIR/$script" ]] || MISSING="$MISSING script:$script"
done
[[ -z "$MISSING" ]]
assert_exit "ทุก job ใน workflow มีเช็คใน jobs.tsv และทุกสคริปต์มีจริง${MISSING:+ (ขาด$MISSING)}" 0 "$?"

"$SCRIPT_DIR/run-job.sh" no-such-job . "$SCRIPT_DIR/.." >/dev/null 2>&1
assert_exit "run-job ตกเมื่อไม่พบเช็คของ job (ไม่ผ่านแบบเงียบ ๆ)" 1 "$?"

# The entry point must be checked out at this file's own tag. github.job_workflow_sha
# is empty in a called workflow, and a checkout without ref silently takes main.
EXPECTED_REF="v$(tr -d '[:space:]' < "$SCRIPT_DIR/../VERSION")"
for wf in subsystem-compliance core-hub-compliance; do
  f="$SCRIPT_DIR/../.github/workflows/$wf.yml"
  ref="$(sed -n 's/^  STANDARDS_ENTRY_REF: *//p' "$f")"
  checkouts="$(grep -c 'repository: CSMJU2030/csmju2030-standards' "$f")"
  pinned="$(grep -c 'ref: ${{ env.STANDARDS_ENTRY_REF }}' "$f")"
  [[ "$ref" == "$EXPECTED_REF" && "$checkouts" -eq "$pinned" ]] && ! grep -q '{{ *github\.job_workflow_sha' "$f"
  assert_exit "$wf.yml ดึงตัวตรวจที่ STANDARDS_ENTRY_REF = VERSION ทุก job (พบ ${ref:-ไม่มี} · $pinned/$checkouts job)" 0 "$?"
done

# A version whose GH-03 always passes must not help: GH-03 comes from the entry copy.
FAKE_TOOLS="$(mktemp -d)"
mkdir -p "$FAKE_TOOLS/scripts/lib"
echo "0.0.1" > "$FAKE_TOOLS/VERSION"
printf '#!/usr/bin/env bash\nexit 0\n' > "$FAKE_TOOLS/scripts/check-ci-untouched.sh"
printf 'convention\tGuard CI files (GH-03)\tcheck-ci-untouched.sh\t{base_sha}\n' > "$FAKE_TOOLS/scripts/lib/jobs.tsv"
printf 'skiponly\tNot in this version\tcheck-not-shipped-yet.sh\n' >> "$FAKE_TOOLS/scripts/lib/jobs.tsv"
run_job_with_fake_tools() {
  PR_BASE_SHA="$2" "$SCRIPT_DIR/run-job.sh" convention "$1" "$FAKE_TOOLS" >/dev/null 2>&1
}
GH03_RUNNER=run_job_with_fake_tools setup_and_run_gh03 "fail"
assert_exit "run-job ใช้ GH-03 ของตัวกลางเสมอ แม้เวอร์ชันที่เลือกจะมี GH-03 ที่ปล่อยผ่าน" 1 "$?"
"$SCRIPT_DIR/run-job.sh" skiponly . "$FAKE_TOOLS" >/dev/null 2>&1
assert_exit "run-job ข้ามเช็คที่เวอร์ชันนั้นยังไม่มี" 0 "$?"
rm -rf "$FAKE_TOOLS"

echo ""
echo "== QA-06: workspace filter ต้องชี้ถูก =="
# ชื่อ package ซ้ำ / --filter ชี้ผิด ทำให้ pnpm ไม่รันอะไรเลยแต่คืน exit 0
run_fixture_case "QA-06"     "check-qa.sh"

echo ""
echo "== Profile: core-hub (docs/core-hub-rules.md) =="
# fixture เดียวกัน ต้องให้ผลตรงข้ามกันตาม CSMJU_PROFILE — ถ้า profile หลุด
# ระบบย่อยจะแอบใช้ passport-jwt/user_id ได้ทันที จึงต้องยืนยันทั้งสองทิศทาง
PROFILE_FIXTURE="$FIXTURES_DIR/PROFILE-CORE-HUB"

CSMJU_PROFILE=subsystem "$SCRIPT_DIR/check-authorized-deps.sh" "$PROFILE_FIXTURE" >/dev/null 2>&1
assert_exit "ARC-02 subsystem ตี passport-jwt/@nestjs/jwt ตก" 1 "$?"
CSMJU_PROFILE=core-hub  "$SCRIPT_DIR/check-authorized-deps.sh" "$PROFILE_FIXTURE" >/dev/null 2>&1
assert_exit "ARC-02 core-hub อนุญาต allowed_core_hub" 0 "$?"

# sharp อยู่ใน allowed_core_hub เท่านั้น — ระบบย่อยต้องเก็บรูปผ่าน Core Hub ไม่ย่อรูปเอง
SHARP_FIXTURE="$FIXTURES_DIR/PROFILE-CORE-HUB-SHARP"
CSMJU_PROFILE=subsystem "$SCRIPT_DIR/check-authorized-deps.sh" "$SHARP_FIXTURE" >/dev/null 2>&1
assert_exit "ARC-02 subsystem ตี sharp ตก" 1 "$?"
CSMJU_PROFILE=core-hub  "$SCRIPT_DIR/check-authorized-deps.sh" "$SHARP_FIXTURE" >/dev/null 2>&1
assert_exit "ARC-02 core-hub อนุญาต sharp" 0 "$?"

CSMJU_PROFILE=subsystem "$SCRIPT_DIR/check-field-aliases.sh" "$PROFILE_FIXTURE" >/dev/null 2>&1
assert_exit "DD-01 subsystem ตี user_id ตก" 1 "$?"
CSMJU_PROFILE=core-hub  "$SCRIPT_DIR/check-field-aliases.sh" "$PROFILE_FIXTURE" >/dev/null 2>&1
assert_exit "DD-01 core-hub ข้าม (เจ้าของตาราง users)" 0 "$?"

# Core Hub build image จาก deploy/ ไม่มี backend/Dockerfile — DEP ต้องข้ามเฉพาะ profile core-hub
CSMJU_PROFILE=subsystem "$SCRIPT_DIR/check-deploy-ready.sh" "$FIXTURES_DIR/DEP/fail" >/dev/null 2>&1
assert_exit "DEP subsystem ตี Dockerfile ที่ขาดตก" 1 "$?"
CSMJU_PROFILE=core-hub  "$SCRIPT_DIR/check-deploy-ready.sh" "$FIXTURES_DIR/DEP/fail" >/dev/null 2>&1
assert_exit "DEP core-hub ข้าม (image มาจาก deploy/)" 0 "$?"

# ค่าเริ่มต้นต้องเป็น subsystem เสมอ — ห้าม profile รั่วเป็น core-hub เมื่อไม่ได้ตั้งค่า
(unset CSMJU_PROFILE; "$SCRIPT_DIR/check-field-aliases.sh" "$PROFILE_FIXTURE" >/dev/null 2>&1)
assert_exit "ค่าเริ่มต้นของ CSMJU_PROFILE คือ subsystem" 1 "$?"

# subsystem-compliance.yml ต้องไม่ส่ง profile core-hub ให้ระบบย่อย
if grep -q "CSMJU_PROFILE" "$SCRIPT_DIR/../.github/workflows/subsystem-compliance.yml"; then
  assert_exit "subsystem workflow ไม่ตั้ง CSMJU_PROFILE" 0 1
else
  assert_exit "subsystem workflow ไม่ตั้ง CSMJU_PROFILE" 0 0
fi
# core-hub-compliance.yml ต้องตั้ง profile ให้เอง
if grep -q "CSMJU_PROFILE: core-hub" "$SCRIPT_DIR/../.github/workflows/core-hub-compliance.yml"; then
  assert_exit "core-hub workflow ตั้ง CSMJU_PROFILE=core-hub" 0 0
else
  assert_exit "core-hub workflow ตั้ง CSMJU_PROFILE=core-hub" 0 1
fi

echo
echo "=================================================================="
if [[ "$FAILED" -gt 0 ]]; then
  echo "❌ self-test: $FAILED / $TOTAL assertions failed"
  exit 1
fi
echo "✅ self-test: all $TOTAL assertions passed"
