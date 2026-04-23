/**
 * 우측 패널 한국어 문자열 집계 (flat key 구조)
 *
 * 향후 i18n(next-intl 등) 도입 시 동일 키 스키마로 en.json 복붙 가능.
 * 지금은 상수 객체만 · 런타임 비용 0.
 */

export const KO = {
  // 패널 헤더
  'rightPanel.title': 'Today',
  'rightPanel.action.directInput': '오늘 입력 가능',
  'rightPanel.action.recorded': '오늘 입력됨',
  'rightPanel.action.offline': '오프라인',
  'rightPanel.action.saving': '저장 중',
  'rightPanel.action.saved': '오늘 기록에 저장됨',
  'rightPanel.action.error': '저장 실패',

  // 요약 카드
  'rightPanel.quick.meta.recorded': '항목 기록',
  'rightPanel.quick.meta.lastInput': '에 마지막 입력',

  // 카드 레이블
  'rightPanel.card.sleep.name': '수면',
  'rightPanel.card.meal.name': '식사',
  'rightPanel.card.medication.name': '복약',
  'rightPanel.card.exercise.name': '운동',
  'rightPanel.card.water.name': '수분',
  'rightPanel.card.mood.name': '기분',
  'rightPanel.card.alcohol.name': '음주',

  // Row 기본
  'rightPanel.row.placeholder': '바로 입력',
  'rightPanel.row.chevron': '›',

  // 상세 입력 공통
  'rightPanel.input.close': '입력 닫기',
  'rightPanel.input.actions.chat': '💬 대화로 입력',
  'rightPanel.input.actions.save': '저장',

  // 수면 상세
  'rightPanel.sleep.duration.label': '주무신 시간',
  'rightPanel.sleep.duration.less_5': '5시간 미만',
  'rightPanel.sleep.duration.5_6': '5~6시간',
  'rightPanel.sleep.duration.6_7': '6~7시간',
  'rightPanel.sleep.duration.7_8': '7~8시간',
  'rightPanel.sleep.duration.8_plus': '8시간 이상',
  'rightPanel.sleep.quality.label': '수면 질',
  'rightPanel.sleep.quality.excellent': '아주 좋음',
  'rightPanel.sleep.quality.good': '좋음',
  'rightPanel.sleep.quality.normal': '보통',
  'rightPanel.sleep.quality.bad': '나쁨',

  // 식사 상세
  'rightPanel.meal.slot.label': '어느 끼니인가요',
  'rightPanel.meal.slot.breakfast': '아침',
  'rightPanel.meal.slot.lunch': '점심',
  'rightPanel.meal.slot.dinner': '저녁',
  'rightPanel.meal.slot.snack': '간식',
  'rightPanel.meal.balance.label': '구성',
  'rightPanel.meal.balance.carb_heavy': '밥·빵·면 위주였어요',
  'rightPanel.meal.balance.balanced': '고르게 먹었어요',
  'rightPanel.meal.balance.protein_heavy': '단백질 위주였어요',
  'rightPanel.meal.balance.veg_heavy': '채소 위주였어요',

  // 복약 상세 (A 그룹 전용)
  'rightPanel.medication.taken.label': '오늘 약을 드셨나요',
  'rightPanel.medication.taken.true': '드셨어요',
  'rightPanel.medication.taken.false': '건너뜀',

  // 운동 상세
  'rightPanel.exercise.type.label': '어떤 활동',
  'rightPanel.exercise.type.walking': '산책',
  'rightPanel.exercise.type.cycling': '자전거',
  'rightPanel.exercise.type.strength': '근력',
  'rightPanel.exercise.type.stretching': '스트레칭',
  'rightPanel.exercise.minutes.label': '얼마나 (분)',
  'rightPanel.exercise.minutes.under_10': '10분 미만',
  'rightPanel.exercise.minutes.10_20': '10~20분',
  'rightPanel.exercise.minutes.20_30': '20~30분',
  'rightPanel.exercise.minutes.30_plus': '30분 이상',

  // 수분 상세
  'rightPanel.water.label': '오늘 마신 물 (잔)',
  'rightPanel.water.hint': '하루 권장 8잔 (240ml 기준)',

  // 기분 상세
  'rightPanel.mood.label': '오늘 기분은',
  'rightPanel.mood.great': '아주 좋음',
  'rightPanel.mood.good': '좋음',
  'rightPanel.mood.normal': '보통',
  'rightPanel.mood.hard': '힘듦',

  // 음주 상세
  'rightPanel.alcohol.today.label': '오늘 음주 여부',
  'rightPanel.alcohol.today.true': '마심',
  'rightPanel.alcohol.today.false': '안 마심',
  'rightPanel.alcohol.amount.label': '어느 정도',
  'rightPanel.alcohol.amount.light': '가볍게',
  'rightPanel.alcohol.amount.moderate': '보통',
  'rightPanel.alcohol.amount.heavy': '많이',

  // 챌린지 섹션
  'rightPanel.challenges.title': '도전 챌린지',
  'rightPanel.challenges.action.inProgress': '건 진행중',

  // 미응답 섹션
  'rightPanel.missed.title': '미응답 질문',
  'rightPanel.missed.action.recent3days': '최근 3일',
  'rightPanel.missed.card.title': '아직 기록 안 한 항목',
  'rightPanel.missed.card.desc': '최근 3일치 미응답 항목을 한 번에 확인하고 이어서 기록',

  // 모달
  'rightPanel.missedModal.title': '아직 기록 안 한 항목 · 최근 3일',
  'rightPanel.missedModal.hint': '미입력 칸에서 값을 선택한 뒤 기록 저장하기를 누르면 해당 날짜 기록에 반영됩니다.',
  'rightPanel.missedModal.empty': '미입력',
  'rightPanel.missedModal.columns.category': '카테고리',
  'rightPanel.missedModal.columns.today': '오늘',
  'rightPanel.missedModal.columns.yesterday': '어제',
  'rightPanel.missedModal.columns.dayBefore': '그제',
  'rightPanel.missedModal.close': '닫기',
  'rightPanel.missedModal.unsavedConfirm': '저장 안 된 입력이 있어요. 정말 닫을까요?',
  'rightPanel.missedModal.todayLockedHint': '오늘 기록은 위 카드에서 입력해주세요',

  // 에러/상태
  'rightPanel.error.networkFail': '저장 중 연결 문제가 있었어요. 잠시 후 다시 시도해주세요.',
  'rightPanel.error.skippedAlreadyAnswered': '이미 저장된 값이에요',
  'rightPanel.error.skippedGeneric': '저장되지 않았어요 · 다시 시도',
};

/**
 * 간단 헬퍼
 * @param {string} key - flat key (e.g. 'rightPanel.card.sleep.name')
 * @returns {string}
 */
export const t = (key) => KO[key] ?? key;
