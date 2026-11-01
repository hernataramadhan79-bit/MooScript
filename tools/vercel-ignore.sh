#!/bin/sh
# Vercel "Ignored Build Step" for both apps: exit 0 skips the build, exit 1 builds.
# Usage (from the app's root directory): sh ../../tools/vercel-ignore.sh <path>...
# Builds when there is no previous deployment to compare with, or when any given path changed.

if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ] || [ "$VERCEL_GIT_PREVIOUS_SHA" = "$VERCEL_GIT_COMMIT_SHA" ]; then
  exit 1
fi

if git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- "$@"; then
  echo "No changes in: $*. Skipping build."
  exit 0
fi

exit 1
