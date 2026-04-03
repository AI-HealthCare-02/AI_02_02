#!/usr/bin/env python3
"""설계가이드V2에 미접속/저사용 전략 섹션 추가"""
import re

guide_path = r"C:\Users\mal03\Desktop\레퍼런스\마지막 웹프로젝트\docs\prototypes\다나아_데이터수집_설계가이드V2.html"

with open(guide_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. 네비게이션에 새 탭 추가
nav_old = '<button class="nav-tab" onclick="showSection(7)">의학적 근거</button>'
nav_new = nav_old + '\n  <button class="nav-tab" onclick="showSection(8)">미접속/저사용 전략</button>'
html = html.replace(nav_old, nav_new)

# 2. sec-7 닫는 태그 뒤에 새 섹션 삽입
new_section = '''

<!-- ═══ 8. 미접속/저사용 전략 ═══ -->
<div class="section" id="sec-8">
  <div class="section-title">미접속/저사용 시 데이터 수집 전략</div>
  <div class="section-sub">사용자가 매일 3회 접속하지 않아도, 예측 모델·대시보드·챌린지 3기능을 유지하는 적응형 수집 전략입니다.</div>

  <!-- 핵심 원칙 -->
  <div class="card" style="border-left:4px solid var(--danger);margin-bottom:24px;">
    <h3>&#x1F6A8; 절대 원칙 3가지</h3>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <div style="width:28px;height:28px;border-radius:50%;background:#FEE2E2;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">1</div>
        <div>
          <div style="font-size:13px;font-weight:800;color:var(--g800);">폭탄 투하 금지</div>
          <div style="font-size:12px;color:var(--g500);">"미응답 질문이 8개 있습니다" 같은 누적 질문 한꺼번에 쏟아내기 절대 금지</div>
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <div style="width:28px;height:28px;border-radius:50%;background:#FEE2E2;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">2</div>
        <div>
          <div style="font-size:13px;font-weight:800;color:var(--g800);">죄책감 유발 금지</div>
          <div style="font-size:12px;color:var(--g500);">"어제 못 한 질문입니다", "N일 연속 끊겼어요" 등 실패를 암시하는 문구 사용 금지</div>
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <div style="width:28px;height:28px;border-radius:50%;background:#FEE2E2;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">3</div>
        <div>
          <div style="font-size:13px;font-weight:800;color:var(--g800);">복귀 시 최대 1묶음(2문항)만</div>
          <div style="font-size:12px;color:var(--g500);">아무리 오래 부재했어도, 복귀 첫 인터랙션에서 최대 1묶음만 질문. 이후 정상 흐름으로 복귀</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 참여 상태 머신 ── -->
  <div class="card">
    <h3>&#x1F4CA; 5단계 참여 상태 머신 (Engagement State Machine)</h3>
    <p style="margin-bottom:14px;">사용자의 7일 응답률을 기반으로 5단계 상태를 자동 전환합니다. <strong>하락은 즉시, 상승은 7일 연속 충족 후</strong> 1단계씩만.</p>
    <table class="dt">
      <tr><th>상태</th><th>조건</th><th>터치포인트</th><th>일일 질문</th><th>묶음 구성</th></tr>
      <tr style="background:#D1FAE5;">
        <td><strong>ACTIVE</strong></td>
        <td>7일 응답률 <strong>80%+</strong></td>
        <td>3회</td>
        <td><strong>10문항</strong></td>
        <td>전체 7묶음 + 격일 묶음7</td>
      </tr>
      <tr>
        <td><strong>MODERATE</strong></td>
        <td>응답률 <strong>50-80%</strong></td>
        <td>3회</td>
        <td>9문항</td>
        <td>6묶음 (묶음7 → 월1회)</td>
      </tr>
      <tr style="background:#FEF3C7;">
        <td><strong>LOW</strong></td>
        <td>응답률 <strong>&lt;50%</strong></td>
        <td><strong>2회</strong> (점심 제외)</td>
        <td>4-6문항</td>
        <td>묶음1+2(아침), 묶음4(저녁), 묶음3/5 교대</td>
      </tr>
      <tr style="background:#FEE2E2;">
        <td><strong>DORMANT</strong></td>
        <td><strong>3일 연속</strong> 무응답</td>
        <td>2회 + 넛지</td>
        <td>3문항</td>
        <td>묶음2(채소) + 묶음4(운동) + 주간 체중</td>
      </tr>
      <tr style="background:var(--g100);">
        <td><strong>HIBERNATING</strong></td>
        <td><strong>2주+</strong> 저참여</td>
        <td>주1회</td>
        <td><strong>2문항</strong></td>
        <td>주간 운동 + 식단 요약</td>
      </tr>
    </table>

    <div style="margin-top:16px;padding:14px;background:var(--g50);border-radius:12px;font-size:12px;color:var(--g600);">
      <strong>왜 HIBERNATING에서도 예측 가능한가?</strong><br>
      FINDRISC 8개 변수 중 6개(나이/BMI/가족력/기저질환/고혈압약/고혈당이력)는 <strong>온보딩에서 고정</strong>.<br>
      동적 변수 2개(운동/채소)만 주간 데이터 필요 → 주1회 체크인으로도 추정 가능.<br>
      AUC: ~0.80(ACTIVE) → ~0.75(HIBERNATING). 임상 유용성 임계값 0.70 이상 유지 <span class="tag tag-model" style="font-size:9px;">Lindstrom & Tuomilehto 2003</span>
    </div>
  </div>

  <!-- ── 부재 시간별 대응 ── -->
  <div class="card">
    <h3>&#x23F1; 부재 시간별 대응 규칙</h3>
    <p style="margin-bottom:14px;">마지막 세션으로부터 경과 시간에 따라 복귀 시 행동이 달라집니다.</p>
    <table class="dt">
      <tr><th>부재 시간</th><th>복귀 인사</th><th>최대 질문</th><th>처리 규칙</th></tr>
      <tr>
        <td><strong>1.5~3시간</strong></td>
        <td>"잠깐 사이에 2가지만 여쭤볼게요"</td>
        <td>1묶음(2문항)</td>
        <td>유효한 질문 중 최대 2문항 선별</td>
      </tr>
      <tr>
        <td><strong>3~6시간</strong></td>
        <td>"2가지만 빠르게 확인할게요"</td>
        <td>1묶음(2문항)</td>
        <td>만료된 질문 스킵, 유효한 것 1-2문항</td>
      </tr>
      <tr style="background:#FEF3C7;">
        <td><strong>6~24시간</strong></td>
        <td>"오랜만이에요! 간단히 1가지만 물어볼게요"</td>
        <td>1묶음(2문항)</td>
        <td>과거 질문 전부 폐기, 현재 시간대 시퀀스부터</td>
      </tr>
      <tr style="background:#FEE2E2;">
        <td><strong>24시간+</strong></td>
        <td>"다시 돌아오셨네요! 오늘부터 시작해요"</td>
        <td>1묶음(2문항)</td>
        <td>어제를 "미수집일"로 기록, 오늘 현재 시퀀스부터</td>
      </tr>
      <tr style="background:#FEE2E2;">
        <td><strong>48시간~7일</strong></td>
        <td>"반가워요! 오늘부터 다시 시작해볼까요?"</td>
        <td>1묶음 + 건너뛰기</td>
        <td>부재일 전부 미수집일 처리, P1 데이터 손실 수용</td>
      </tr>
      <tr style="background:var(--g100);">
        <td><strong>30일+</strong></td>
        <td>"오랫동안 못 뵈었네요! 반갑습니다"</td>
        <td>경량 재확인 + 1묶음</td>
        <td>체중/운동습관 변화 확인 후 Tier 5에서 시작</td>
      </tr>
    </table>
  </div>

  <!-- ── 5대 시나리오 ── -->
  <div style="margin-top:8px;margin-bottom:14px;">
    <div style="font-size:18px;font-weight:900;color:var(--g800);">5대 시나리오별 전략</div>
  </div>

  <!-- 시나리오 1 -->
  <div class="card" style="border-left:4px solid var(--danger);">
    <h3>&#x1F6AB; 시나리오 1 — 하루종일 미접속</h3>
    <p><strong>상황:</strong> 사용자가 하루 내내 앱을 열지 않음. 3개 터치포인트 전부 놓침.</p>
    <div style="margin-top:14px;">
      <div style="font-size:13px;font-weight:800;margin-bottom:8px;">당일 조치</div>
      <p>없음. 시스템이 기다린다. 알림/푸시 보내지 않음.</p>
    </div>
    <div style="margin-top:14px;">
      <div style="font-size:13px;font-weight:800;margin-bottom:8px;">다음날 복귀 시</div>
      <p>전일을 <strong>"미수집일"</strong>로 마킹 → 복귀 첫 질문에 <strong>현재 시간대의 최고 우선순위 1묶음만</strong> 질문</p>
      <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;padding:12px;background:var(--primary-light);border-radius:10px;font-size:12px;">
          <strong>07:00~13:30 복귀</strong><br>→ 묶음2 아침/채소 <span class="tag tag-model" style="font-size:9px;">FINDRISC 1점</span>
        </div>
        <div style="flex:1;min-width:200px;padding:12px;background:#EDE9FE;border-radius:10px;font-size:12px;">
          <strong>14:00~22:00 복귀</strong><br>→ 묶음4 운동 <span class="tag tag-model" style="font-size:9px;">FINDRISC 2점</span>
        </div>
      </div>
    </div>
    <div style="margin-top:14px;">
      <div style="font-size:13px;font-weight:800;margin-bottom:8px;">3기능 영향</div>
      <table class="dt">
        <tr><th>기능</th><th>영향</th><th>완화</th></tr>
        <tr>
          <td><span class="tag tag-model">예측 모델</span></td>
          <td>동적 변수 1일 결손</td>
          <td>주간 집계로 계산 → 1일 무시 가능. FINDRISC 정적 6개 변수는 온보딩에서 확보</td>
        </tr>
        <tr>
          <td><span class="tag tag-dash">대시보드</span></td>
          <td>히트맵 1일 공백</td>
          <td>"--"으로 표시, 추세선은 선형 보간법</td>
        </tr>
        <tr>
          <td><span class="tag tag-challenge">챌린지</span></td>
          <td>운동 챌린지 1일 미확인</td>
          <td>미기록일은 분모에서 제외 ("6/7일 기록됨")</td>
        </tr>
      </table>
    </div>
    <div style="margin-top:12px;padding:10px 14px;background:var(--g50);border-radius:10px;font-size:11px;color:var(--g500);">
      <strong>의학적 근거:</strong> DPP(Knowler 2002)는 운동을 주간 단위(150분/주)로 추적 — 1일 결손은 주간 집계에 무시 가능. Cappuccio(2010)의 수면 위험은 만성적 수면 부족에서 발생 — 단일 야간 결손은 무의미.
    </div>
  </div>

  <!-- 시나리오 2 -->
  <div class="card" style="border-left:4px solid var(--warning);">
    <h3>&#x26A1; 시나리오 2 — 짧게만 사용 (1-2개 질문만)</h3>
    <p><strong>상황:</strong> 사용자가 1-2개 메시지만 보내고 떠남. 시간이 1묶음뿐.</p>
    <div style="margin-top:14px;">
      <div style="font-size:13px;font-weight:800;margin-bottom:8px;">우선순위 점수로 최고 가치 1묶음 자동 선택</div>
      <div style="padding:14px;background:var(--g50);border-radius:12px;font-family:monospace;font-size:12px;line-height:1.8;">
        score = (FINDRISC가중치 x 3) + (활성챌린지 x 2) + (미수집일수 x 1.5) + 시간유효보너스
      </div>
      <table class="dt" style="margin-top:12px;">
        <tr><th>묶음</th><th>FINDRISC 가중치</th><th>점수 예시 (아침, 챌린지 없음)</th></tr>
        <tr style="background:#D1FAE5;">
          <td><strong>묶음4 운동</strong></td>
          <td><strong>2.0</strong> (FINDRISC 2점)</td>
          <td>2.0x3 + 0 + 1x1.5 + 0 = <strong>7.5</strong> (저녁 최우선)</td>
        </tr>
        <tr>
          <td><strong>묶음2 채소/아침</strong></td>
          <td>1.0 (FINDRISC 1점)</td>
          <td>1.0x3 + 0 + 1x1.5 + 2.0 = <strong>6.5</strong> (아침 최우선)</td>
        </tr>
        <tr>
          <td>묶음7 음주</td>
          <td>0.5 (KDRS)</td>
          <td>0.5x3 + 0 + 2x1.5 + 1.0 = <strong>5.5</strong></td>
        </tr>
        <tr>
          <td>묶음1/3/5</td>
          <td>0 (보조 지표)</td>
          <td>0 + 0 + 1x1.5 + 2.0 = <strong>3.5</strong></td>
        </tr>
      </table>
    </div>
    <div style="margin-top:12px;padding:10px 14px;background:#FEF3C7;border-radius:10px;font-size:11px;color:#92400E;">
      <strong>핵심:</strong> 딱 1묶음(2문항, ~6초)만 질문. 답변 후 "기록했어요!" 피드백. 추가 질문 없음.
    </div>
  </div>

  <!-- 시나리오 3 -->
  <div class="card" style="border-left:4px solid var(--primary);">
    <h3>&#x2600; 시나리오 3 — 아침만 접속</h3>
    <p><strong>상황:</strong> 아침(07-09시)에 채팅 후 하루 내내 미접속. 묶음1(수면)+묶음2(아침/채소) 수집 완료, 나머지 미수집.</p>
    <div style="margin-top:14px;">
      <table class="dt">
        <tr><th>놓친 묶음</th><th>우선순위</th><th>처리</th><th>기본값</th></tr>
        <tr style="background:#FEE2E2;">
          <td><strong>묶음4 운동</strong></td>
          <td><span class="tag tag-critical">P1 Critical</span></td>
          <td>22시 전 복귀하면 최우선 복구. 미복구 시 보수적 기본값</td>
          <td><strong>"안 했어요"</strong></td>
        </tr>
        <tr>
          <td>묶음3 식단질</td>
          <td><span class="tag tag-important">P2 Important</span></td>
          <td>20시 전 복귀하면 재질문 가능</td>
          <td>미기록 (null)</td>
        </tr>
        <tr>
          <td>묶음5 저녁습관</td>
          <td><span class="tag tag-important">P2 Important</span></td>
          <td>기본값 적용</td>
          <td>야식="안 먹었어요"</td>
        </tr>
        <tr>
          <td>묶음7 정서+음주</td>
          <td><span class="tag tag-nice">P3 Optional</span></td>
          <td>스킵, 다음 주기 대기</td>
          <td>스킵</td>
        </tr>
      </table>
    </div>
    <div style="margin-top:12px;padding:10px 14px;background:var(--primary-light);border-radius:10px;font-size:11px;color:var(--primary-dark);">
      <strong>다음날 아침에 "어제 운동하셨나요?" 묻지 않는 이유:</strong> 운동 질문은 14:00-22:00에만 유효. 시간 민감도 규칙을 위반하면 데이터 정확성이 떨어짐. 대신 주간 집계에서 해당일을 비운동일로 처리.
    </div>
  </div>

  <!-- 시나리오 4 -->
  <div class="card" style="border-left:4px solid var(--purple);">
    <h3>&#x1F4E6; 시나리오 4 — 누적 미응답 (여러 날 부분 데이터)</h3>
    <p><strong>상황:</strong> 며칠간 부분 데이터만 쌓임. 예: 월(아침만) → 화(미접속) → 수(미접속) → 목(복귀)</p>
    <div style="margin-top:14px;">
      <div style="font-size:13px;font-weight:800;margin-bottom:10px;">복구 판단 흐름</div>
      <div class="flow-h">
        <div class="flow-h-node">
          <div class="fh-title">P1 미수집일 체크</div>
          <div class="fh-sub">운동/채소 결손일 수</div>
        </div>
        <div class="flow-h-arrow">→</div>
        <div class="flow-h-node" style="border-color:var(--accent);">
          <div class="fh-title">0일 결손</div>
          <div class="fh-sub">복구 불필요<br>정상 흐름</div>
        </div>
        <div class="flow-h-arrow">→</div>
        <div class="flow-h-node" style="border-color:var(--warning);">
          <div class="fh-title">1-2일 결손</div>
          <div class="fh-sub">연성 복구<br>오늘 흐름에서 우선 배정</div>
        </div>
        <div class="flow-h-arrow">→</div>
        <div class="flow-h-node" style="border-color:var(--danger);">
          <div class="fh-title">3일+ 결손</div>
          <div class="fh-sub">데이터 손실 수용<br>오늘부터 새 시작</div>
        </div>
      </div>
    </div>
    <div style="margin-top:14px;">
      <div style="font-size:13px;font-weight:800;margin-bottom:8px;">FINDRISC 주간 집계: 부분 데이터 처리</div>
      <table class="dt">
        <tr><th>주간 데이터</th><th>처리 방식</th><th>예시</th></tr>
        <tr style="background:#D1FAE5;">
          <td><strong>3일+</strong> 데이터 있음</td>
          <td>비례 추정</td>
          <td>5일 중 3일 운동 → 3/5 = 60% → ~4.2일/주 환산</td>
        </tr>
        <tr style="background:#FEF3C7;">
          <td><strong>2일 이하</strong></td>
          <td>추정 불가 → 최근 신뢰 가능 주간 평균 사용</td>
          <td>지난주 운동 빈도 그대로 적용</td>
        </tr>
        <tr style="background:var(--g100);">
          <td><strong>0일</strong></td>
          <td>온보딩 기저값 폴백</td>
          <td>가입 시 "주 2-3회 운동" → 그대로 사용</td>
        </tr>
      </table>
    </div>
    <div style="margin-top:12px;padding:10px 14px;background:#EDE9FE;border-radius:10px;font-size:11px;color:#6D28D9;">
      <strong>대시보드 표시:</strong> 모든 점수 옆에 "(N일 기준)" 표기. 예: "운동 점수 7/10 (5일 기준)". 사용자가 데이터 정확도를 직관적으로 알 수 있음.
    </div>
  </div>

  <!-- 시나리오 5 -->
  <div class="card" style="border-left:4px solid var(--g400);">
    <h3>&#x1F4C9; 시나리오 5 — 적응형 축소 (Adaptive Reduction)</h3>
    <p><strong>상황:</strong> 장기간 참여도가 하락. 시스템이 질문 부담을 자동으로 줄이면서 최소 기능 유지.</p>
    <div style="margin-top:14px;">
      <table class="dt">
        <tr><th>Tier</th><th>묶음 구성</th><th>문항 수</th><th>예측 AUC</th><th>대시보드</th></tr>
        <tr style="background:#D1FAE5;">
          <td><strong>1 Standard</strong><br><span style="font-size:10px;color:var(--g400);">응답률 80%+</span></td>
          <td>전체 7묶음</td>
          <td>10문항</td>
          <td><strong>~0.80</strong></td>
          <td>전체 카드, 완전한 히트맵</td>
        </tr>
        <tr>
          <td><strong>2 Reduced</strong><br><span style="font-size:10px;color:var(--g400);">50-80%</span></td>
          <td>6묶음 (묶음7→월1회)</td>
          <td>9문항</td>
          <td>~0.80</td>
          <td>전체 카드, "일부 미기록일 포함"</td>
        </tr>
        <tr style="background:#FEF3C7;">
          <td><strong>3 Minimal</strong><br><span style="font-size:10px;color:var(--g400);">&lt;50%</span></td>
          <td>4묶음 (묶음1+2, 묶음4, 묶음3/5 교대)</td>
          <td>4-6문항</td>
          <td>~0.78</td>
          <td>핵심 카드만, "일부 추정 포함"</td>
        </tr>
        <tr style="background:#FEE2E2;">
          <td><strong>4 Survival</strong><br><span style="font-size:10px;color:var(--g400);">3일 무응답</span></td>
          <td>3묶음 (묶음2+묶음4+체중)</td>
          <td>3문항</td>
          <td>~0.77</td>
          <td>FINDRISC 게이지만, "데이터 부족"</td>
        </tr>
        <tr style="background:var(--g100);">
          <td><strong>5 Hibernation</strong><br><span style="font-size:10px;color:var(--g400);">2주+ 저참여</span></td>
          <td>주1회 (운동+식단 요약)</td>
          <td>2문항/주</td>
          <td>~0.75</td>
          <td>월간 요약만, "기록 부족"</td>
        </tr>
      </table>
    </div>
    <div style="margin-top:12px;padding:10px 14px;background:var(--g50);border-radius:10px;font-size:11px;color:var(--g600);">
      <strong>Tier 전환 규칙:</strong> 하락은 즉시(임계값 도달 시). DORMANT→HIBERNATING만 14일 유지 후. 상승은 7일 연속 상위 기준 충족 시 1단계만 올림. 급격한 질문 증가로 인한 피로감 방지.
    </div>
  </div>

  <!-- ── 기본값 매트릭스 ── -->
  <div class="card">
    <h3>&#x1F4CB; 미수집 시 기본값(Default) 매트릭스</h3>
    <p style="margin-bottom:12px;">질문을 받지 못했을 때 어떤 값을 사용하는지, 그리고 <strong>왜 그 값인지</strong> 의학적 근거.</p>
    <table class="dt">
      <tr><th>묶음</th><th>질문</th><th>기본값</th><th>근거</th></tr>
      <tr>
        <td>B1 수면</td>
        <td>몇 시간?</td>
        <td>7h (인구 중앙값)</td>
        <td>Cappuccio 2010: 7h = 중립 위험도</td>
      </tr>
      <tr>
        <td>B1 수면질</td>
        <td>잠 잘 잤나요?</td>
        <td>"그냥 그래요"</td>
        <td>중립 기본값이 가장 보수적</td>
      </tr>
      <tr style="background:#FEF3C7;">
        <td>B2 아침</td>
        <td>드셨나요?</td>
        <td><strong>미기록 (null)</strong></td>
        <td>Bi 2015: 결식 21-55% 위험↑, 가정 불가</td>
      </tr>
      <tr style="background:#FEF3C7;">
        <td>B2 채소</td>
        <td>챙기셨나요?</td>
        <td><strong>미기록 (null)</strong></td>
        <td>FINDRISC 1점 — 잘못된 가정은 점수 왜곡</td>
      </tr>
      <tr>
        <td>B3 단음료</td>
        <td>드셨나요?</td>
        <td>"안 먹었어요"</td>
        <td>가당음료 섭취는 예외적 행동 (낙관적 기본값)</td>
      </tr>
      <tr style="background:#FEE2E2;">
        <td><strong>B4 운동</strong></td>
        <td>하셨나요?</td>
        <td><strong>"안 했어요"</strong></td>
        <td>DPP 2002: 보수적 처리. 주간 집계 시 비운동일 카운트</td>
      </tr>
      <tr>
        <td>B5 야식</td>
        <td>드셨나요?</td>
        <td>"안 먹었어요"</td>
        <td>야식은 예외 행동 (낙관적)</td>
      </tr>
      <tr style="background:#FEE2E2;">
        <td><strong>B6 복약</strong></td>
        <td>드셨나요?</td>
        <td><strong>미기록 (절대 가정 불가)</strong></td>
        <td>Cramer 2004: 비순응 35-65% 영향, 오가정 위험</td>
      </tr>
      <tr>
        <td>B7 정서</td>
        <td>스트레스/기분</td>
        <td>스킵 (마지막 값 유지)</td>
        <td>2-3일 주기이므로 1일 스킵은 정상</td>
      </tr>
      <tr>
        <td>B7 음주</td>
        <td>마셨나요?</td>
        <td>"안 마셨어요"</td>
        <td>음주는 비일상적 행동 (보수적 안전 기본값)</td>
      </tr>
    </table>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
      <div style="padding:8px 12px;background:#D1FAE5;border-radius:8px;font-size:10px;font-weight:700;color:#065F46;">낙관적 = 미해당이 더 일반적인 행동</div>
      <div style="padding:8px 12px;background:#FEF3C7;border-radius:8px;font-size:10px;font-weight:700;color:#92400E;">미기록 = 양방향 위험, 가정 불가</div>
      <div style="padding:8px 12px;background:#FEE2E2;border-radius:8px;font-size:10px;font-weight:700;color:#DC2626;">보수적 = 위험 쪽으로 가정 (안전)</div>
    </div>
  </div>

  <!-- ── 대시보드 단계적 약화 ── -->
  <div class="card">
    <h3>&#x1F4CA; 대시보드 단계적 약화 (Graceful Degradation)</h3>
    <p style="margin-bottom:12px;">주간 데이터 커버리지에 따라 대시보드 표시 수준이 자동 조절됩니다.</p>
    <table class="dt">
      <tr><th>커버리지</th><th>일수</th><th>표시 방식</th><th>라벨</th></tr>
      <tr style="background:#D1FAE5;">
        <td><strong>80-100%</strong></td>
        <td>6-7일</td>
        <td>전체 카드, 완전한 추세선, 히트맵 완성</td>
        <td>없음 (정상)</td>
      </tr>
      <tr>
        <td>60-79%</td>
        <td>4-5일</td>
        <td>전체 카드, 추세선 일부 공백</td>
        <td style="color:var(--primary);">"일부 미기록일 포함"</td>
      </tr>
      <tr style="background:#FEF3C7;">
        <td>40-59%</td>
        <td>3-4일</td>
        <td>핵심 카드만 (FINDRISC/운동/식단)</td>
        <td style="color:var(--warning);">"일부 추정 포함"</td>
      </tr>
      <tr style="background:#FEE2E2;">
        <td>20-39%</td>
        <td>1-2일</td>
        <td>FINDRISC 게이지만, 하위 점수 숨김</td>
        <td style="color:var(--danger);">"데이터 부족"</td>
      </tr>
      <tr style="background:var(--g100);">
        <td>&lt;20%</td>
        <td>0일</td>
        <td>온보딩 기반 FINDRISC만, 동적 카드 전부 숨김</td>
        <td style="color:var(--g500);">"이번 주 기록이 부족합니다"</td>
      </tr>
    </table>
  </div>

  <!-- ── 재참여 전략 ── -->
  <div class="card" style="border-left:4px solid var(--accent);">
    <h3>&#x1F49A; 재참여 전략 (가치 프레이밍)</h3>
    <p style="margin-bottom:14px;">모든 재참여 메시지는 <strong>"뭘 놓쳤는지"가 아니라 "뭘 얻을 수 있는지"</strong> 중심으로 작성합니다.</p>

    <div style="margin-bottom:16px;">
      <div style="font-size:13px;font-weight:800;margin-bottom:8px;color:var(--danger);">금지 문구 (절대 사용 금지)</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        <span style="padding:5px 10px;background:#FEE2E2;border-radius:8px;font-size:11px;color:#DC2626;text-decoration:line-through;">"미응답 질문이 N개 있습니다"</span>
        <span style="padding:5px 10px;background:#FEE2E2;border-radius:8px;font-size:11px;color:#DC2626;text-decoration:line-through;">"어제 못 한 질문입니다"</span>
        <span style="padding:5px 10px;background:#FEE2E2;border-radius:8px;font-size:11px;color:#DC2626;text-decoration:line-through;">"N일 연속 끊겼어요"</span>
        <span style="padding:5px 10px;background:#FEE2E2;border-radius:8px;font-size:11px;color:#DC2626;text-decoration:line-through;">"응답률이 낮아요"</span>
        <span style="padding:5px 10px;background:#FEE2E2;border-radius:8px;font-size:11px;color:#DC2626;text-decoration:line-through;">"데이터가 부족해서 정확하지 않아요"</span>
      </div>
    </div>

    <div>
      <div style="font-size:13px;font-weight:800;margin-bottom:8px;color:var(--accent);">허용 문구 (가치 제안 중심)</div>
      <table class="dt">
        <tr><th>상황</th><th>메시지</th><th>프레이밍</th></tr>
        <tr>
          <td>대시보드 공백</td>
          <td>"3일만 더 기록하면 이번 주 운동 점수를 볼 수 있어요"</td>
          <td>무엇을 <strong>얻는지</strong></td>
        </tr>
        <tr>
          <td>긍정 추세 중단</td>
          <td>"지난주에 수면 패턴이 좋아지고 있었어요. 이번 주도 볼까요?"</td>
          <td>과거 <strong>성과 인정</strong></td>
        </tr>
        <tr>
          <td>챌린지 일시정지</td>
          <td>"챌린지를 잠시 쉬어갈까요? 언제든 다시 시작할 수 있어요"</td>
          <td><strong>자율권</strong> 강조</td>
        </tr>
        <tr>
          <td>Tier 하락/상승</td>
          <td><strong>(무음)</strong> — 사용자에게 알리지 않음</td>
          <td>등급 <strong>판단 자체를 숨김</strong></td>
        </tr>
      </table>
    </div>
  </div>

  <!-- ── 질문 시간 민감도 ── -->
  <div class="card">
    <h3>&#x23F0; 질문별 시간 민감도 (Time Sensitivity)</h3>
    <p style="margin-bottom:12px;">각 질문은 유효 시간이 있으며, 만료 시 기본값이 적용되거나 다음 시간대로 이월됩니다.</p>
    <table class="dt">
      <tr><th>질문</th><th>유효 시작</th><th>유효 종료</th><th>만료 시 처리</th></tr>
      <tr>
        <td>Q1 수면 시간</td><td>06:00</td><td>12:00</td><td>기본값 7h 적용</td>
      </tr>
      <tr>
        <td>Q2 수면 질</td><td>06:00</td><td>12:00</td><td>"그냥 그래요" 적용</td>
      </tr>
      <tr>
        <td>Q3 음주 (묶음7)</td><td>06:00</td><td>14:00</td><td>기본값 "안 마심"</td>
      </tr>
      <tr style="background:#FEF3C7;">
        <td>Q4 아침식사</td><td>07:00</td><td>12:00</td><td><strong>"미기록"</strong> (가정 불가)</td>
      </tr>
      <tr>
        <td>Q5-6 식단 (점심)</td><td>11:00</td><td>20:00</td><td>저녁 터치포인트에서 재질문 가능</td>
      </tr>
      <tr style="background:#D1FAE5;">
        <td><strong>Q7 운동</strong></td><td><strong>14:00</strong></td><td><strong>22:00</strong></td><td>유효 시간 가장 김 → 복구 확률 높음</td>
      </tr>
      <tr>
        <td>Q9 야식</td><td>20:00</td><td>22:00</td><td>저녁 윈도우에서만 유효</td>
      </tr>
    </table>
  </div>

  <!-- ── P1/P2/P3 우선순위 ── -->
  <div class="card">
    <h3>&#x1F3AF; 미응답 복구 우선순위 (3단계)</h3>
    <p style="margin-bottom:12px;">복귀 시 어떤 질문을 먼저 복구할지 결정하는 3단계 체계.</p>
    <div class="grid-3" style="margin-top:10px;">
      <div style="padding:16px;background:#FEE2E2;border-radius:14px;border:2px solid #FECACA;">
        <div style="font-size:12px;font-weight:900;color:#DC2626;margin-bottom:6px;">P1 Critical</div>
        <div style="font-size:11px;font-weight:700;color:var(--g700);margin-bottom:4px;">위험 모델에 직접 영향</div>
        <div style="font-size:12px;color:var(--g600);line-height:1.6;">
          Q3 음주<br>Q7 운동<br>Q5 채소
        </div>
        <div style="margin-top:8px;font-size:10px;font-weight:700;color:#DC2626;">2시간 내 재질문</div>
      </div>
      <div style="padding:16px;background:#FEF3C7;border-radius:14px;border:2px solid #FDE68A;">
        <div style="font-size:12px;font-weight:900;color:#92400E;margin-bottom:6px;">P2 Important</div>
        <div style="font-size:11px;font-weight:700;color:var(--g700);margin-bottom:4px;">생활습관 점수에 영향</div>
        <div style="font-size:12px;color:var(--g600);line-height:1.6;">
          Q1 수면<br>Q4 아침<br>Q6 단음료<br>Q9 야식
        </div>
        <div style="margin-top:8px;font-size:10px;font-weight:700;color:#92400E;">6시간 내 배치 복구</div>
      </div>
      <div style="padding:16px;background:var(--g100);border-radius:14px;border:2px solid var(--g200);">
        <div style="font-size:12px;font-weight:900;color:var(--g500);margin-bottom:6px;">P3 Optional</div>
        <div style="font-size:11px;font-weight:700;color:var(--g700);margin-bottom:4px;">보조 지표</div>
        <div style="font-size:12px;color:var(--g600);line-height:1.6;">
          Q2 수면질<br>Q8 수분<br>Q10-11 스트레스/기분
        </div>
        <div style="margin-top:8px;font-size:10px;font-weight:700;color:var(--g500);">스킵, 다음 주기 대기</div>
      </div>
    </div>
  </div>

  <!-- ── 엣지 케이스 ── -->
  <div class="card">
    <h3>&#x1F527; 엣지 케이스 처리</h3>
    <table class="dt">
      <tr><th>케이스</th><th>감지 방법</th><th>처리</th></tr>
      <tr>
        <td><strong>주말 패턴</strong></td>
        <td>2주+ 데이터 후 주중/주말 참여 비교</td>
        <td>주말 30%+ 낮으면 자동 2터치포인트, Tier 하락 미반영</td>
      </tr>
      <tr>
        <td><strong>공휴일(설/추석)</strong></td>
        <td>한국 공휴일 DB 자동 감지</td>
        <td>주말 행동 자동 적용</td>
      </tr>
      <tr>
        <td><strong>해외여행 (시차)</strong></td>
        <td>브라우저 시간대 3h+ 변화 감지</td>
        <td>"새 시작" 적용, 새 시간대 기준 윈도우 재계산</td>
      </tr>
      <tr>
        <td><strong>폭풍 사용 (2-3h 집중)</strong></td>
        <td>단일 세션 내 다수 메시지</td>
        <td>90분 쿨다운으로 최대 2묶음까지만, 3번째는 다음 윈도우</td>
      </tr>
      <tr>
        <td><strong>챌린지 중 중단</strong></td>
        <td>3일 무데이터</td>
        <td>3일→"진행 확인 필요", 7일→자동 일시정지 + "언제든 재시작"</td>
      </tr>
      <tr>
        <td><strong>30일+ 장기 부재</strong></td>
        <td>last_active_date 30일+ 경과</td>
        <td>경량 온보딩 재확인(체중/습관 변화) → Tier 5에서 시작</td>
      </tr>
      <tr>
        <td><strong>휴가 모드</strong></td>
        <td>설정 또는 AI에게 "여행 가요" 발화</td>
        <td>질문 삽입 전면 중단, 대시보드 "휴가 모드" 뱃지, 휴가일은 응답률 분모 제외</td>
      </tr>
    </table>
  </div>

  <!-- ── 구현 핵심 요약 ── -->
  <div class="card" style="background:linear-gradient(135deg,var(--g900),#1a2744);color:#fff;border:none;">
    <h3 style="color:#fff;">구현 핵심 요약</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
      <div style="padding:14px;background:rgba(255,255,255,.08);border-radius:12px;">
        <div style="font-size:11px;font-weight:800;color:var(--primary);margin-bottom:6px;">백엔드 신규 모델</div>
        <div style="font-size:11px;color:rgba(255,255,255,.7);line-height:1.7;">
          DailyHealthRecord — 일별 묶음 응답<br>
          UserEngagementState — Tier + 7일 응답률<br>
          QuestionSchedule — 오늘 질문 상태<br>
          AbsenceRecord — 부재 이벤트 기록
        </div>
      </div>
      <div style="padding:14px;background:rgba(255,255,255,.08);border-radius:12px;">
        <div style="font-size:11px;font-weight:800;color:var(--accent);margin-bottom:6px;">핵심 서비스 로직</div>
        <div style="font-size:11px;color:rgba(255,255,255,.7);line-height:1.7;">
          QuestionScheduler — 부재 감지 + 묶음 선택<br>
          DataImputation — 기본값 + 주간 FINDRISC 계산<br>
          EngagementTracker — Tier 전환 + 넛지 관리<br>
          DashboardDegrader — 표시 수준 결정
        </div>
      </div>
    </div>
    <div style="margin-top:14px;padding:12px;background:rgba(255,255,255,.05);border-radius:10px;font-size:11px;color:rgba(255,255,255,.6);">
      <strong style="color:var(--warning);">크론 잡:</strong> 매일 자정 — 미수집일 마킹, Tier 전환 체크, 챌린지 일시정지 / 매주 월요일 — FINDRISC 재계산, 대시보드 약화 수준 갱신
    </div>
  </div>

</div>
'''

# sec-7 섹션의 닫는 </div> 뒤, 컨테이너 닫는 </div> 앞에 삽입
# 정확한 위치: "</div>\n\n\n</div>" 패턴 찾기
insert_marker = '</div>\n\n\n</div>\n\n<script>'
new_marker = '</div>\n' + new_section + '\n\n</div>\n\n<script>'
html = html.replace(insert_marker, new_marker)

with open(guide_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("OK: sec-8 미접속/저사용 전략 탭 추가 완료")
print(f"파일 크기: {len(html):,} bytes")
