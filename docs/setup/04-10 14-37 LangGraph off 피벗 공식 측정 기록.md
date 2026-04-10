# LangGraph off 피벗 공식 측정 기록

## 한 줄 결론
- LangGraph는 포트폴리오용 실험 자산으로 남기되, 실제 운영 응답속도 기준에서는 `CHAT_LANGGRAPH_MODE=off`로 피벗한다.
- 이번 공식 측정에서 `off` 기준 TTFT 중앙값은 `0.8981초`, done 중앙값은 `2.1586초`였다.
- 에러율 `0%`, zero-token 종료율 `0%`라서 운영 경로 off 전환은 안정적으로 볼 수 있다.

## 왜 이 결정을 했나
- 목표는 사용자가 체감하는 첫 글자 시간, 즉 TTFT를 줄이는 것이었다.
- LangGraph는 채팅 준비 과정을 그래프로 설명 가능하게 만드는 장점이 있었다.
- 하지만 현재 다나아 채팅에서는 LangGraph가 핵심 응답속도 개선 요인이 아니었다.
- OpenAI 첫 content 자체가 약 `0.65~0.66초` 수준이라, 서버 코드만으로 TTFT를 `0.7초대`까지 안정적으로 내리는 데 한계가 있었다.
- 따라서 지금은 “LangGraph를 운영 경로에서 계속 태우기”보다 “운영은 단순하고 빠른 legacy prep 경로로 두기”가 더 안전하다.

## 오늘 적용한 설정
`.env`의 LangGraph 관련 설정을 아래처럼 바꿨다.

```env
CHAT_LANGGRAPH_MODE=off
CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE=0.0
CHAT_LANGGRAPH_AUDIT_SAMPLE_RATE=0.0
```

의미는 다음과 같다.

- `off`: 실제 채팅 요청이 LangGraph adapter 경로로 들어가지 않는다.
- `shadow sample 0.0`: 백그라운드 비교 실험도 샘플링하지 않는다.
- `audit sample 0.0`: 추가 감사 로그/비교 작업도 하지 않는다.

중요한 점:
- LangGraph 코드를 삭제한 것은 아니다.
- 운영 실행 경로에서 LangGraph를 끈 것이다.
- 코드 제거 여부는 별도 작업으로 나중에 결정한다.

## 공식 interleaved 측정 결과
- 실행 명령:

```powershell
uv run python scripts/bench_ttft_interleaved.py --label langgraph-off-pivot --rounds 50
```

- 결과 파일:
  - `logs/ttft-interleaved-0410-142914-langgraph-off-pivot.log`
  - `logs/ttft-interleaved-0410-142914-langgraph-off-pivot.json`

측정값은 모두 초 단위다.

| 조건 | 유효 샘플 | TTFT 중앙값 | TTFT p95 | TTFT 95% CI | done 중앙값 | done p95 | OpenAI 첫 content 중앙값 | 에러율 | zero-token |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| off | 49 | 0.8981초 | 1.2515초 | 0.8791~0.9334초 | 2.1586초 | 3.3695초 | 0.6637초 | 0% | 0% |
| shadow0 | 49 | 0.8780초 | 1.4144초 | 0.8272~0.9095초 | 2.1250초 | 3.4071초 | 0.6471초 | 0% | 0% |
| shadow5 | 49 | 0.9029초 | 1.2177초 | 0.8352~0.9591초 | 2.1793초 | 3.4027초 | 0.6521초 | 0% | 0% |
| shadow100 | 49 | 0.8865초 | 1.3706초 | 0.8652~0.9498초 | 2.2903초 | 3.3923초 | 0.6629초 | 0% | 0% |

## 이전 기록과 비교
| 시점 | 기준 | TTFT 중앙값 | done 중앙값 | 해석 |
|---|---|---:|---:|---|
| origin/main warm 기준 | 초기 main 기준 | 1.208초 | 2.893초 | 최초 기준선 |
| vExec controlled/off | LangGraph off 진단 | 0.858초 | 2.074초 | 빠른 좋은 샘플, 다만 공식 interleaved 전 값 |
| vExec mirror/shadow | shadow 운영 미러 | 1.022초 | 2.463초 | LangGraph shadow가 켜진 운영 유사 기준 |
| 04-10 공식 interleaved shadow5 AFTER | shadow 5% | 1.098초 | 2.354초 | 코드 미세 최적화 효과 거의 없음 |
| 오늘 off pivot 공식 측정 | off | 0.8981초 | 2.1586초 | 운영 경로 off 전환 기준으로 안정적 |

## 초보자용 해석
- TTFT는 “사용자가 보낸 뒤 첫 글자가 뜨기까지 걸린 시간”이다.
- done은 “답변 전체가 끝날 때까지 걸린 시간”이다.
- 오늘 결과를 아주 쉽게 말하면:
  - 첫 글자: 약 `0.90초`
  - 전체 답변 완료: 약 `2.16초`
  - 중간 에러: `0건`
  - 빈 답변 종료: `0건`

즉, 현재는 “LangGraph를 끈 운영 경로”가 설명하기 쉽고, 빠르고, 안전하다.

## 포트폴리오에 쓸 수 있는 문장
`LangGraph를 실서비스 채팅 preparation 구간에 부분 적용해 보았지만, 공식 interleaved 측정 결과 TTFT 개선 효과가 크지 않았고 운영 경로에서는 오히려 단순 legacy prep 경로가 더 안정적이었다. 그래서 LangGraph는 실험/학습/설계 비교 자산으로 남기고, 실제 운영 응답속도 최적화는 CHAT_LANGGRAPH_MODE=off로 피벗했다.`

## 다음 결정
- 지금 단계에서는 3번까지 완료했다.
- 다음에 결정할 일은 LangGraph 코드를 완전히 제거할지 여부다.
- 냉정한 추천:
  - 속도와 운영 안정성이 목표면 지금처럼 `off` 유지.
  - 코드 구조까지 단순화하고 싶으면 별도 PR로 LangGraph 제거 작업 진행.
  - 포트폴리오에는 “도입, 측정, 반증, 피벗” 흐름을 남긴다.

