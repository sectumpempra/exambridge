#!/bin/sh
set -eu

umask 027

base="${EXAMBRIDGE_BASE:-/var/www/exambridge}"
repo="${EXAMBRIDGE_REPO:-sectumpempra/exambridge}"
branch="${EXAMBRIDGE_BRANCH:-gh-pages}"
health_url="${EXAMBRIDGE_HEALTH_URL:-https://exambridge.cn/index.html}"
keep_releases="${EXAMBRIDGE_KEEP_RELEASES:-3}"
min_pdf_count="${EXAMBRIDGE_MIN_PDF_COUNT:-}"
expected_materials_owner="${EXAMBRIDGE_MATERIALS_OWNER:-deploy}"
dry_run="${EXAMBRIDGE_DRY_RUN:-0}"
allow_nonstandard_base="${EXAMBRIDGE_ALLOW_NONSTANDARD_BASE:-0}"
sha_file="${EXAMBRIDGE_SHA_FILE:-}"
archive_url_override="${EXAMBRIDGE_ARCHIVE_URL:-}"

fail() {
  printf 'ExamBridge sync refused: %s\n' "$*" >&2
  exit 1
}

case "$base" in
  /*) ;;
  *) fail "EXAMBRIDGE_BASE must be an absolute path" ;;
esac

if test "$allow_nonstandard_base" != "1" && test "$base" != "/var/www/exambridge"; then
  fail "nonstandard base requires EXAMBRIDGE_ALLOW_NONSTANDARD_BASE=1"
fi

for command_name in curl git python3 tar; do
  if test "$command_name" = "git" && test -n "$sha_file"; then
    continue
  fi
  command -v "$command_name" >/dev/null 2>&1 || fail "missing required command: $command_name"
done

test -d "$base" || fail "base directory does not exist: $base"
test -d "$base/shared" || fail "shared directory does not exist"
test -d "$base/releases" || fail "releases directory does not exist"

base_real="$(cd "$base" && pwd -P)"
test "$base_real" != "/" || fail "base directory resolves to filesystem root"
test "$base_real" = "$base" || fail "base directory must not traverse a symlink"

work="$(mktemp -d)"
stage=""
lock_dir="$base/shared/.sync-lock"
lock_acquired=0

cleanup() {
  if test -n "$stage"; then
    case "$stage" in
      "$base/releases/.staging-"*)
        test ! -L "$stage" && rm -rf "$stage"
        ;;
    esac
  fi
  rm -rf "$work"
  if test "$lock_acquired" = "1"; then
    rmdir "$lock_dir" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

if ! mkdir "$lock_dir" 2>/dev/null; then
  fail "another sync is already running"
fi
lock_acquired=1

materials="$base/shared/exam-materials"
materials_marker="$materials/.exambridge-persistent-materials"
materials_minimum_file="$base/shared/exam-materials.minimum"
state_file="$base/shared/gh-pages.sha"
records_dir="$base/shared/release-records"
test -d "$materials" || fail "persistent materials directory is missing"
test ! -L "$materials" || fail "persistent materials directory must not be a symlink"
test -f "$materials_marker" || fail "persistent materials marker is missing"
grep -qx 'exambridge-persistent-materials-v1' "$materials_marker" || fail "persistent materials marker is invalid"
materials_real="$(cd "$materials" && pwd -P)"
case "$materials_real" in
  "$base_real/shared/"*) ;;
  *) fail "persistent materials resolve outside the shared directory" ;;
esac
materials_owner="$(python3 - "$materials" <<'PY'
import os
import pwd
import sys
print(pwd.getpwuid(os.stat(sys.argv[1], follow_symlinks=False).st_uid).pw_name)
PY
)"
test "$materials_owner" = "$expected_materials_owner" || fail "persistent materials owner is $materials_owner, expected $expected_materials_owner"
materials_world_writable="$(python3 - "$materials" <<'PY'
import os
import stat
import sys
print(1 if os.stat(sys.argv[1], follow_symlinks=False).st_mode & stat.S_IWOTH else 0)
PY
)"
test "$materials_world_writable" = "0" || fail "persistent materials directory must not be world-writable"

material_stats() {
  python3 - "$1" <<'PY'
import os
import sys

root = sys.argv[1]
count = 0
size = 0
for directory, _, files in os.walk(root, followlinks=False):
    for name in files:
        path = os.path.join(directory, name)
        if os.path.islink(path):
            continue
        if name.lower().endswith(".pdf"):
            count += 1
        size += os.path.getsize(path)
print(count, size)
PY
}

set -- $(material_stats "$materials")
materials_pdf_before="$1"
materials_bytes_before="$2"
case "$materials_pdf_before" in *[!0-9]*|'') fail "invalid persistent PDF count" ;; esac
if test -z "$min_pdf_count"; then
  test -f "$materials_minimum_file" && test ! -L "$materials_minimum_file" || fail "persistent PDF minimum guard is missing"
  min_pdf_count="$(sed -n '1p' "$materials_minimum_file" | tr -d '[:space:]')"
fi
case "$min_pdf_count" in *[!0-9]*|'') fail "EXAMBRIDGE_MIN_PDF_COUNT must be a non-negative integer" ;; esac
test "$materials_pdf_before" -ge "$min_pdf_count" || fail "persistent PDF count is below the configured minimum"

if test -f "$state_file"; then
  previous_sha="$(sed -n '1p' "$state_file" | tr -d '[:space:]')"
  previous_record="$records_dir/$previous_sha.json"
  if test -f "$previous_record" && test ! -L "$previous_record"; then
    set -- $(python3 - "$previous_record" <<'PY'
import json
import sys
with open(sys.argv[1], "r", encoding="utf-8") as handle:
    payload = json.load(handle)
print(payload["persistentPdfCount"], payload["persistentMaterialBytes"])
PY
)
    previous_pdf_count="$1"
    previous_material_bytes="$2"
    test "$materials_pdf_before" -ge "$previous_pdf_count" || fail "persistent PDF count dropped below the last verified release"
    test "$materials_bytes_before" -ge "$previous_material_bytes" || fail "persistent materials size dropped below the last verified release"
  fi
fi

case "$keep_releases" in *[!0-9]*|'') fail "EXAMBRIDGE_KEEP_RELEASES must be an integer" ;; esac
test "$keep_releases" -ge 2 || fail "at least two releases must be retained"
case "$dry_run" in 0|1) ;; *) fail "EXAMBRIDGE_DRY_RUN must be 0 or 1" ;; esac

if test -n "$sha_file"; then
  test -f "$sha_file" || fail "configured SHA file does not exist"
  sha="$(sed -n '1p' "$sha_file" | tr -d '[:space:]')"
else
  git ls-remote --refs "https://github.com/${repo}.git" "refs/heads/${branch}" > "$work/remote.txt"
  sha="$(awk 'NR == 1 { print $1 }' "$work/remote.txt")"
fi
case "$sha" in
  [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
  *) fail "resolved gh-pages commit is not a 40-character lowercase SHA" ;;
esac

release="$base/releases/$sha"
mkdir -p "$records_dir"

validate_provenance() {
  python3 - "$1" <<'PY'
import hashlib
import json
import os
import re
import sys

release = os.path.realpath(sys.argv[1])
path = os.path.join(release, "release-provenance.json")
with open(path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)
if payload.get("schemaVersion") != 1:
    raise SystemExit("unsupported release provenance schema")
commit = payload.get("commit", "")
if not re.fullmatch(r"[0-9a-f]{40}", commit):
    raise SystemExit("release provenance commit is invalid")
if payload.get("trackedPdfCount") != 0:
    raise SystemExit("release provenance reports tracked PDFs")
evidence = payload.get("evidence")
if not isinstance(evidence, dict) or not evidence:
    raise SystemExit("release provenance evidence is empty")
for source_path, expected in evidence.items():
    if not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise SystemExit(f"invalid evidence digest: {source_path}")
    if not source_path.startswith("dist-static/"):
        continue
    relative = source_path.removeprefix("dist-static/")
    candidate = os.path.realpath(os.path.join(release, relative))
    if os.path.commonpath([release, candidate]) != release or not os.path.isfile(candidate):
        raise SystemExit(f"published evidence file is missing: {relative}")
    with open(candidate, "rb") as handle:
        actual = hashlib.sha256(handle.read()).hexdigest()
    if actual != expected:
        raise SystemExit(f"published evidence digest mismatch: {relative}")
for directory, directories, files in os.walk(release, followlinks=False):
    directories[:] = [name for name in directories if not os.path.islink(os.path.join(directory, name))]
    for name in files:
        if name.lower().endswith(".pdf"):
            raise SystemExit(f"release artifact contains forbidden PDF: {name}")
print(commit)
PY
}

validate_release() {
  candidate="$1"
  test -d "$candidate" || fail "release directory is missing"
  test ! -L "$candidate" || fail "release directory must not be a symlink"
  test -f "$candidate/index.html" || fail "release has no index.html"
  test -f "$candidate/release-provenance.json" || fail "release provenance is missing"
  if test -e "$candidate/exam-materials" && test ! -L "$candidate/exam-materials"; then
    fail "release contains a real exam-materials path"
  fi
  validate_provenance "$candidate"
}

link_exam_materials() {
  target="$1"
  link="$target/exam-materials"
  if test -L "$link"; then
    linked_real="$(python3 - "$link" <<'PY'
import os
import sys
print(os.path.realpath(sys.argv[1]))
PY
)"
    if test "$linked_real" = "$materials_real"; then
      return
    fi
    unlink "$link"
  elif test -e "$link"; then
    fail "refusing to replace a real exam-materials path"
  fi
  ln -s "$materials_real" "$link"
}

atomic_symlink() {
  target="$1"
  link="$2"
  python3 - "$target" "$link" <<'PY'
import os
import sys
import uuid

target, link = sys.argv[1:]
temporary = f"{link}.next-{uuid.uuid4().hex}"
os.symlink(target, temporary)
os.replace(temporary, link)
PY
}

write_state() {
  value="$1"
  destination="$2"
  if test -L "$destination"; then
    printf 'State path must not be a symlink.\n' >&2
    return 1
  fi
  python3 - "$value" "$destination" <<'PY'
import os
import sys
import uuid

value, destination = sys.argv[1:]
temporary = f"{destination}.next-{uuid.uuid4().hex}"
with open(temporary, "w", encoding="ascii") as handle:
    handle.write(value + "\n")
    handle.flush()
    os.fsync(handle.fileno())
os.replace(temporary, destination)
PY
}

current="$base/current"
previous_target=""
previous_real=""
if test -L "$current"; then
  previous_target="$(readlink "$current")"
  previous_real="$(python3 - "$current" <<'PY'
import os
import sys
print(os.path.realpath(sys.argv[1]))
PY
)"
  case "$previous_real" in
    "$base_real/releases/"[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
    *) fail "current symlink resolves outside the managed release set" ;;
  esac
elif test -e "$current"; then
  fail "current must be a symlink"
fi

if test -f "$state_file" && test "$(sed -n '1p' "$state_file" | tr -d '[:space:]')" = "$sha"; then
  test -L "$current" || fail "state says current release is active but current is not a symlink"
  current_real="$(python3 - "$current" <<'PY'
import os
import sys
print(os.path.realpath(sys.argv[1]))
PY
)"
  test "$current_real" = "$release" || fail "state and current symlink disagree"
  validate_release "$release" >/dev/null
  link_exam_materials "$release"
  curl -fsS --max-time 15 "$health_url" >/dev/null || fail "current release health check failed"
  printf 'ExamBridge already serves verified gh-pages commit %s.\n' "$sha"
  exit 0
fi

archive_url="$archive_url_override"
if test -z "$archive_url"; then
  archive_url="https://codeload.github.com/${repo}/tar.gz/${sha}"
fi
curl -fsSL --retry 3 --retry-all-errors "$archive_url" -o "$work/site.tar.gz"

python3 - "$work/site.tar.gz" <<'PY'
import pathlib
import sys
import tarfile

with tarfile.open(sys.argv[1], "r:gz") as archive:
    members = archive.getmembers()
    if not members:
        raise SystemExit("release archive is empty")
    roots = set()
    for member in members:
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or ".." in path.parts or not path.parts:
            raise SystemExit("release archive contains an unsafe path")
        roots.add(path.parts[0])
        if member.issym() or member.islnk() or member.isdev():
            raise SystemExit("release archive contains a link or device entry")
    if len(roots) != 1:
        raise SystemExit("release archive must contain one root directory")
PY

stage="$base/releases/.staging-$sha-$$"
test ! -e "$stage" || fail "staging path already exists"
mkdir "$stage"
tar -xzf "$work/site.tar.gz" --strip-components=1 -C "$stage"
source_commit="$(validate_release "$stage")"
link_exam_materials "$stage"

set -- $(material_stats "$materials")
test "$1" = "$materials_pdf_before" || fail "persistent PDF count changed during staging"
test "$2" = "$materials_bytes_before" || fail "persistent materials size changed during staging"

if test "$dry_run" = "1"; then
  printf 'Dry run verified gh-pages %s (source %s); current was not changed.\n' "$sha" "$source_commit"
  exit 0
fi

if test -e "$release"; then
  test -d "$release" && test ! -L "$release" || fail "existing release path is unsafe"
  existing_source_commit="$(validate_release "$release")"
  test "$existing_source_commit" = "$source_commit" || fail "existing release provenance differs from staged artifact"
  link_exam_materials "$release"
else
  mv "$stage" "$release"
  stage=""
fi

archive_digest="$(python3 - "$work/site.tar.gz" <<'PY'
import hashlib
import sys
with open(sys.argv[1], "rb") as handle:
    print(hashlib.sha256(handle.read()).hexdigest())
PY
)"
provenance_digest="$(python3 - "$release/release-provenance.json" <<'PY'
import hashlib
import sys
with open(sys.argv[1], "rb") as handle:
    print(hashlib.sha256(handle.read()).hexdigest())
PY
)"

python3 - "$records_dir/$sha.json" "$sha" "$source_commit" "$archive_digest" "$provenance_digest" "$materials_pdf_before" "$materials_bytes_before" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

path, gh_pages_commit, source_commit, archive_sha256, provenance_sha256, pdf_count, material_bytes = sys.argv[1:]
payload = {
    "schemaVersion": 1,
    "ghPagesCommit": gh_pages_commit,
    "sourceCommit": source_commit,
    "archiveSha256": archive_sha256,
    "provenanceSha256": provenance_sha256,
    "persistentPdfCount": int(pdf_count),
    "persistentMaterialBytes": int(material_bytes),
    "verifiedAt": datetime.now(timezone.utc).isoformat(),
}
temporary = path + ".next"
with open(temporary, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2)
    handle.write("\n")
    handle.flush()
    os.fsync(handle.fileno())
os.replace(temporary, path)
PY

atomic_symlink "$release" "$current"
rollback_current() {
  if test -n "$previous_target"; then
    atomic_symlink "$previous_target" "$current"
  else
    test -L "$current" && unlink "$current"
  fi
}

if ! curl -fsS --max-time 15 "$health_url" >/dev/null; then
  rollback_current
  fail "new release health check failed; previous current symlink restored"
fi

set -- $(material_stats "$materials")
if test "$1" != "$materials_pdf_before" || test "$2" != "$materials_bytes_before"; then
  rollback_current
  fail "persistent materials changed; previous current symlink restored"
fi

if ! write_state "$sha" "$state_file"; then
  rollback_current
  fail "release state could not be recorded; previous current symlink restored"
fi

python3 - "$base/releases" "$keep_releases" "$sha" "$previous_real" <<'PY'
import os
import re
import shutil
import sys

releases, keep_count, active_sha, previous_target = sys.argv[1:]
keep_count = int(keep_count)
sha_pattern = re.compile(r"^[0-9a-f]{40}$")
candidates = []
for name in os.listdir(releases):
    path = os.path.join(releases, name)
    if sha_pattern.fullmatch(name) and os.path.isdir(path) and not os.path.islink(path):
        candidates.append((os.path.getmtime(path), name, path))
candidates.sort(reverse=True)
protected = {active_sha}
previous_name = os.path.basename(os.path.realpath(previous_target)) if previous_target else ""
if sha_pattern.fullmatch(previous_name):
    protected.add(previous_name)
for _, name, _ in candidates:
    if len(protected) >= keep_count:
        break
    protected.add(name)
for _, name, path in candidates:
    if name not in protected:
        shutil.rmtree(path)
PY

printf 'Deployed verified gh-pages %s (source %s); persistent PDFs: %s.\n' "$sha" "$source_commit" "$materials_pdf_before"
