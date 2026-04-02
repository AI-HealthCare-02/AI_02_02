#!/bin/bash
# Edit 도구로 보호 경로(archive/, docs/planning/) 수정 방지
# Event: PreToolUse (Edit 매칭)
# jq 불필요 — 순수 bash만 사용 (Windows Git Bash 호환)

INPUT=""
while IFS= read -r line || [ -n "$line" ]; do
  INPUT="${INPUT}${line}"
done

# tool_input.file_path 추출
FILE_PATH=$(echo "$INPUT" | grep -oP '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"file_path"\s*:\s*"//;s/"//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 보호 경로 체크: archive/
if echo "$FILE_PATH" | grep -qi "archive"; then
  cat <<ENDJSON
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"archive/ 폴더는 수정 금지입니다 (CLAUDE.md §2). 이전 작업물은 참고만 합니다."}}
ENDJSON
  exit 0
fi

# 보호 경로 체크: docs/planning/
if echo "$FILE_PATH" | grep -qi "docs/planning"; then
  cat <<ENDJSON
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"docs/planning/ 폴더는 수정 금지입니다 (CLAUDE.md §2). 기획 문서는 참고만 합니다."}}
ENDJSON
  exit 0
fi

# 보호 경로 체크: docs/prototypes/
if echo "$FILE_PATH" | grep -qi "docs/prototypes"; then
  cat <<ENDJSON
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"docs/prototypes/ 폴더는 수정 금지입니다 (CLAUDE.md §2). 프로토타입은 참고만 합니다."}}
ENDJSON
  exit 0
fi

exit 0
