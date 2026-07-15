#!/bin/sh
set -eu

base="/var/www/exambridge"
repo="sectumpempra/exambridge"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

link_exam_materials() {
  target="$1"
  rm -rf "$target/exam-materials"
  ln -s "$base/shared/exam-materials" "$target/exam-materials"
}

curl -fsSL --retry 3 "https://api.github.com/repos/${repo}/branches/gh-pages" -o "$work/branch.json"
sha="$(sed -n 's/.*"sha": "\([0-9a-f]\{40\}\)".*/\1/p' "$work/branch.json" | head -n 1)"
test -n "$sha"

if test -f "$base/shared/gh-pages.sha" && test "$(cat "$base/shared/gh-pages.sha")" = "$sha"; then
  link_exam_materials "$base/current"
  exit 0
fi

release="$base/releases/$sha"
mkdir -p "$release"
curl -fsSL --retry 3 "https://codeload.github.com/${repo}/tar.gz/refs/heads/gh-pages" -o "$work/site.tar.gz"
tar -xzf "$work/site.tar.gz" --strip-components=1 -C "$release"
link_exam_materials "$release"
ln -sfn "$release" "$base/current"
printf '%s\n' "$sha" > "$base/shared/gh-pages.sha"
