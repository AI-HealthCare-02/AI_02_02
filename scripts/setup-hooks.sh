#!/bin/bash
# 다나아 프로젝트 Git Hooks 설치 스크립트
# 사용법: bash scripts/setup-hooks.sh
set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# 프로젝트 루트로 이동
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$REPO_ROOT"

echo -e "${BLUE}=== 다나아 프로젝트 Git Hooks 설치 ===${NC}"
echo ""

# 1. git 저장소 확인
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
  echo -e "${RED}오류: git 저장소가 아닙니다.${NC}"
  exit 1
fi

# 2. hooks 파일 존재 확인
if [ ! -f "scripts/hooks/pre-commit" ] || [ ! -f "scripts/hooks/commit-msg" ]; then
  echo -e "${RED}오류: scripts/hooks/ 디렉토리에 hook 파일이 없습니다.${NC}"
  exit 1
fi

# 3. hook 파일에 실행 권한 부여
chmod +x scripts/hooks/pre-commit
chmod +x scripts/hooks/commit-msg
echo -e "${GREEN}  [1/3] hook 파일 실행 권한 설정 완료${NC}"

# 4. core.hooksPath 설정
git config core.hooksPath scripts/hooks
echo -e "${GREEN}  [2/3] core.hooksPath → scripts/hooks 설정 완료${NC}"

# 5. 커밋 템플릿 등록
git config commit.template .github/commit_template.txt
echo -e "${GREEN}  [3/3] commit.template 설정 완료${NC}"

echo ""
echo -e "${GREEN}=== 설치 완료! ===${NC}"
echo ""
echo "적용된 설정:"
echo "  core.hooksPath  = $(git config core.hooksPath)"
echo "  commit.template = $(git config commit.template)"
echo ""
echo "이제 커밋하면 자동으로:"
echo "  1. Python 코드 검사 (ruff)"
echo "  2. 커밋 메시지 형식 검증"
echo "  가 실행됩니다."
echo ""
