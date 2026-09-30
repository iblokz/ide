#!/usr/bin/env bash
# Create annotated tag v<package.json version> and push branch + tag.
#
# Usage (after the release commit is on HEAD):
#   ./bin/tag-push.sh
#   ./bin/tag-push.sh --dry-run
#
# Env:
#   REMOTE  — git remote (default: origin)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

REMOTE="${REMOTE:-origin}"
DRY_RUN=0

usage() {
  echo "Usage: $0 [--dry-run] [--help]"
  echo ""
  echo "  Tag HEAD as v\$(package.json version) and push the current branch + tag."
  echo "  Run after the release commit (version + CHANGELOG) is on HEAD."
  echo ""
  echo "  --dry-run   Print actions only"
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_cmd git
require_cmd node

VERSION="$(node -p "require('./package.json').version")"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-].+)?$ ]]; then
  echo "Invalid package.json version: ${VERSION}" >&2
  exit 1
fi

TAG="v${VERSION}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [ "$BRANCH" = "HEAD" ]; then
  echo "Detached HEAD — check out a branch before tagging." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty. Commit or stash before tagging." >&2
  git status -sb >&2
  exit 1
fi

HEAD_SHA="$(git rev-parse HEAD)"
HEAD_MSG="$(git log -1 --format='%s')"
echo "Branch:  ${BRANCH}"
echo "HEAD:    $(git rev-parse --short HEAD) ${HEAD_MSG}"
echo "Version: ${VERSION}"
echo "Tag:     ${TAG}"
echo "Remote:  ${REMOTE}"

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "+ $*"
  else
    "$@"
  fi
}

CREATE_TAG=1
if git rev-parse "$TAG" >/dev/null 2>&1; then
  TAG_SHA="$(git rev-parse "$TAG^{}")"
  if [ "$TAG_SHA" = "$HEAD_SHA" ]; then
    echo "Tag ${TAG} already points at HEAD — skip create, push only."
    CREATE_TAG=0
  else
    echo "Tag already exists on another commit: ${TAG}" >&2
    git show -s --oneline "$TAG" >&2
    echo "HEAD is $(git rev-parse --short HEAD) — move/delete the tag before retrying." >&2
    exit 1
  fi
fi

if [ "$CREATE_TAG" -eq 1 ]; then
  run git tag -a "$TAG" -m "$TAG"
fi
run git push "$REMOTE" "$BRANCH"
run git push "$REMOTE" "$TAG"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run only — no tag or push performed."
elif [ "$CREATE_TAG" -eq 1 ]; then
  echo "Tagged and pushed ${TAG} on ${BRANCH}."
  echo "Native CI should build release assets for ${TAG}."
else
  echo "Pushed ${BRANCH} and existing ${TAG}."
  echo "Native CI should build release assets for ${TAG}."
fi
