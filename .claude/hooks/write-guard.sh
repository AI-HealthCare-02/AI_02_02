#!/bin/bash
# Write 도구로 큰 파일(50줄+) 덮어쓰기 방지
# Event: PreToolUse (Write만 매칭)
# jq 불필요 — 순수 bash만 사용 (Windows Git Bash 호환)

# stdin에서 JSON 읽기 (Windows stdin-as-TTY 버그 회피)
INPUT=""
while IFS= read -r line || [ -n "$line" ]; do
  INPUT="${INPUT}${line}"
done

# tool_input.file_path 추출 (jq 없이)
FILE_PATH=$(echo "$INPUT" | grep -oP '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"file_path"\s*:\s*"//;s/"//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 파일이 존재하고 50줄 이상인 경우만 차단
if [ -f "$FILE_PATH" ]; then
  LINE_COUNT=$(wc -l < "$FILE_PATH" 2>/dev/null | tr -d ' ')
  if [ "$LINE_COUNT" -gt 50 ]; then
    cat <<ENDJSON
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"${FILE_PATH} (${LINE_COUNT}줄)을 Write로 전체 교체하려 합니다. Edit로 부분 수정하는 것이 안전합니다. 정말 전체 교체가 필요한가요?"}}
ENDJSON
    exit 0
  fi
fi

exit 0
