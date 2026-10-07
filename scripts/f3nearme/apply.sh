#!/usr/bin/env bash
# Applies the pending F3 Near Me patches in this folder to a local clone of
# F3-Nation/f3nearme and pushes them to main.
#
# Why this exists: Claude Code sessions can read that repo but can't push to
# the F3-Nation org, so the work lands here as git patches and a laptop that
# is signed in to GitHub pushes them.
#
# Usage:
#   scripts/f3nearme/apply.sh [path-to-f3nearme-clone]
#
# With no path it uses ~/f3nearme, cloning it first if it isn't there. Once
# the push succeeds, delete the applied .patch files from this folder and
# commit that so nobody applies them twice.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$HOME/f3nearme}"

shopt -s nullglob
PATCHES=("$HERE"/*.patch)
if [ ${#PATCHES[@]} -eq 0 ]; then
  echo "No patches in $HERE, nothing to apply."
  exit 0
fi

if [ ! -d "$TARGET/.git" ]; then
  echo "Cloning F3-Nation/f3nearme into $TARGET"
  git clone https://github.com/F3-Nation/f3nearme "$TARGET"
fi

cd "$TARGET"
if [ -n "$(git status --porcelain)" ]; then
  echo "$TARGET has uncommitted changes; commit or stash them first." >&2
  exit 1
fi

git checkout main
git pull --ff-only origin main

echo "Applying ${#PATCHES[@]} patch(es):"
printf '  %s\n' "${PATCHES[@]##*/}"
git am --3way "${PATCHES[@]}"

git push origin main

echo
echo "Pushed. Now remove the applied patches so they aren't applied again:"
echo "  git -C \"$(cd "$HERE/../.." && pwd)\" rm scripts/f3nearme/*.patch && git commit -m 'Remove applied f3nearme patches'"
