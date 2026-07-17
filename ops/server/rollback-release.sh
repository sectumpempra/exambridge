#!/bin/sh
set -eu

umask 027

base="${EXAMBRIDGE_BASE:-/var/www/exambridge}"
health_url="${EXAMBRIDGE_HEALTH_URL:-http://127.0.0.1/index.html}"
expected_materials_owner="${EXAMBRIDGE_MATERIALS_OWNER:-deploy}"
allow_nonstandard_base="${EXAMBRIDGE_ALLOW_NONSTANDARD_BASE:-0}"
target_sha="${1:-}"

fail() {
  printf 'ExamBridge rollback refused: %s\n' "$*" >&2
  exit 1
}

case "$target_sha" in
  [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
  *) fail "pass one verified 40-character gh-pages commit SHA" ;;
esac

case "$base" in /*) ;; *) fail "EXAMBRIDGE_BASE must be absolute" ;; esac
if test "$allow_nonstandard_base" != "1" && test "$base" != "/var/www/exambridge"; then
  fail "nonstandard base requires EXAMBRIDGE_ALLOW_NONSTANDARD_BASE=1"
fi
for command_name in curl python3; do
  command -v "$command_name" >/dev/null 2>&1 || fail "missing required command: $command_name"
done

test -d "$base/releases" || fail "releases directory is missing"
test -d "$base/shared" || fail "shared directory is missing"
base_real="$(cd "$base" && pwd -P)"
test "$base_real" = "$base" || fail "base directory must not traverse a symlink"
test "$base_real" != "/" || fail "base directory resolves to filesystem root"

lock_dir="$base/shared/.sync-lock"
lock_acquired=0
cleanup() {
  if test "$lock_acquired" = "1"; then
    rmdir "$lock_dir" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
if ! mkdir "$lock_dir" 2>/dev/null; then
  fail "a sync or rollback is already running"
fi
lock_acquired=1

materials="$base/shared/exam-materials"
marker="$materials/.exambridge-persistent-materials"
test -d "$materials" && test ! -L "$materials" || fail "persistent materials directory is unsafe"
grep -qx 'exambridge-persistent-materials-v1' "$marker" 2>/dev/null || fail "persistent materials marker is missing or invalid"
materials_real="$(cd "$materials" && pwd -P)"
case "$materials_real" in "$base_real/shared/"*) ;; *) fail "persistent materials resolve outside shared" ;; esac

materials_owner="$(python3 - "$materials" <<'PY'
import os
import pwd
import sys
print(pwd.getpwuid(os.stat(sys.argv[1], follow_symlinks=False).st_uid).pw_name)
PY
)"
test "$materials_owner" = "$expected_materials_owner" || fail "persistent materials owner is $materials_owner, expected $expected_materials_owner"

material_stats() {
  python3 - "$1" <<'PY'
import os
import sys
count = 0
size = 0
for directory, _, files in os.walk(sys.argv[1], followlinks=False):
    for name in files:
        path = os.path.join(directory, name)
        if os.path.islink(path):
            continue
        count += int(name.lower().endswith(".pdf"))
        size += os.path.getsize(path)
print(count, size)
PY
}

set -- $(material_stats "$materials")
pdf_count_before="$1"
material_bytes_before="$2"

release="$base/releases/$target_sha"
record="$base/shared/release-records/$target_sha.json"
test -d "$release" && test ! -L "$release" || fail "target release is missing or unsafe"
test -f "$record" && test ! -L "$record" || fail "target release has no trusted verification record"
test -f "$release/index.html" || fail "target release has no index.html"
test -L "$release/exam-materials" || fail "target release has no persistent materials link"
linked_materials="$(python3 - "$release/exam-materials" <<'PY'
import os
import sys
print(os.path.realpath(sys.argv[1]))
PY
)"
test "$linked_materials" = "$materials_real" || fail "target release materials link is incorrect"

source_commit="$(python3 - "$release" "$record" "$target_sha" <<'PY'
import hashlib
import json
import os
import re
import sys

release, record_path, target_sha = sys.argv[1:]
with open(record_path, "r", encoding="utf-8") as handle:
    record = json.load(handle)
if record.get("schemaVersion") != 1 or record.get("ghPagesCommit") != target_sha:
    raise SystemExit("verification record does not match target release")
provenance_path = os.path.join(release, "release-provenance.json")
with open(provenance_path, "rb") as handle:
    provenance_bytes = handle.read()
if hashlib.sha256(provenance_bytes).hexdigest() != record.get("provenanceSha256"):
    raise SystemExit("release provenance digest does not match verification record")
provenance = json.loads(provenance_bytes)
source_commit = provenance.get("commit", "")
if not re.fullmatch(r"[0-9a-f]{40}", source_commit) or source_commit != record.get("sourceCommit"):
    raise SystemExit("source commit does not match verification record")
if provenance.get("trackedPdfCount") != 0:
    raise SystemExit("release provenance reports tracked PDFs")
for directory, directories, files in os.walk(release, followlinks=False):
    directories[:] = [name for name in directories if not os.path.islink(os.path.join(directory, name))]
    if any(name.lower().endswith(".pdf") for name in files):
        raise SystemExit("target release contains a forbidden PDF")
print(source_commit)
PY
)" || fail "target release verification failed"

current="$base/current"
test -L "$current" || fail "current is not a managed symlink"
previous_target="$(readlink "$current")"
previous_real="$(python3 - "$current" <<'PY'
import os
import sys
print(os.path.realpath(sys.argv[1]))
PY
)"
case "$previous_real" in "$base_real/releases/"*) ;; *) fail "current resolves outside managed releases" ;; esac

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

rollback_current() {
  atomic_symlink "$previous_target" "$current"
}

atomic_symlink "$release" "$current"
if ! curl -fsS --max-time 15 "$health_url" >/dev/null; then
  rollback_current
  fail "target health check failed; original current symlink restored"
fi

set -- $(material_stats "$materials")
if test "$1" != "$pdf_count_before" || test "$2" != "$material_bytes_before"; then
  rollback_current
  fail "persistent materials changed; original current symlink restored"
fi

state="$base/shared/gh-pages.sha"
if test -L "$state"; then
  rollback_current
  fail "state path is a symlink; original current symlink restored"
fi
if ! python3 - "$target_sha" "$state" <<'PY'
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
then
  rollback_current
  fail "state update failed; original current symlink restored"
fi

printf 'Rolled back to verified gh-pages %s (source %s); persistent PDFs: %s.\n' "$target_sha" "$source_commit" "$pdf_count_before"
