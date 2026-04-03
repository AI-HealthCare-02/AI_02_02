#!/bin/bash
# Bash에서 git commit 실행 시 사용자 확인 요청
# Event: PreToolUse (Bash 매칭)
# 목적: 사용자 지시 없이 커밋하는 것을 방지

INPUT=""
while IFS= read -r line || [ -n "$line" ]; do
  INPUT="${INPUT}${line}"
done

# tool_input.command 추출
COMMAND=$(echo "$INPUT" | grep -oP '"command"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"command"\s*:\s*"//;s/"//')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# git commit 명령어 감지
if echo "$COMMAND" | grep -qE "git commit"; then
  cat <<ENDJSON
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"git commit을 실행하려 합니다. 커밋 메시지가 컨벤션(이모지+타입: 설명)을 따르는지 확인해주세요."}}
ENDJSON
  exit 0
fi

exit 0
