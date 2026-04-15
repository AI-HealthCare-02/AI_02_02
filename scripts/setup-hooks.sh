#!/bin/bash
set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$REPO_ROOT"

echo -e "${BLUE}=== Git hooks setup ===${NC}"
echo ""

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo -e "${RED}Error: this directory is not a git repository.${NC}"
  exit 1
fi

for hook in pre-commit commit-msg pre-push; do
  if [ ! -f "scripts/hooks/$hook" ]; then
    echo -e "${RED}Error: missing hook file scripts/hooks/$hook${NC}"
    exit 1
  fi
done

chmod +x scripts/hooks/pre-commit
chmod +x scripts/hooks/commit-msg
chmod +x scripts/hooks/pre-push
echo -e "${GREEN}  [1/3] Hook permissions updated${NC}"

git config core.hooksPath scripts/hooks
echo -e "${GREEN}  [2/3] core.hooksPath set to scripts/hooks${NC}"

if [ -f ".github/commit_template.txt" ]; then
  git config commit.template .github/commit_template.txt
  echo -e "${GREEN}  [3/3] commit.template configured${NC}"
else
  echo -e "${GREEN}  [3/3] commit.template skipped (.github/commit_template.txt not found)${NC}"
fi

echo ""
echo -e "${GREEN}=== Setup complete ===${NC}"
echo ""
echo "Applied settings:"
echo "  core.hooksPath  = $(git config core.hooksPath)"
if git config commit.template >/dev/null 2>&1; then
  echo "  commit.template = $(git config commit.template)"
fi
echo ""
echo "Active hook checks:"
echo "  1. pre-commit  -> staged Python ruff check"
echo "  2. commit-msg  -> commit message format check"
echo "  3. pre-push    -> backend ruff + backend unit tests + frontend build when needed"
echo ""
