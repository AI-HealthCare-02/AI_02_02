/**
 * 사주 사이드 게임 한국어 문구 (flat key 구조, v2.7 P1)
 *
 * 원칙:
 * - 허용 톤: "~하기 좋은 흐름", "조절이 필요한 날", "정리가 잘 맞는 날"
 * - 의료·투자·법률·사고·관계 단정 표현은 사용하지 않는다 (참고용 운세 프레임 유지)
 * - 참고용 안전 문구는 하단 고정 노출 (P4 상세 팝업)
 */

export const SAJU_KO = {
  // 섹션 공통
  'saju.section.title': '오늘의 운세',
  'saju.section.ariaLabel': '오늘의 운세 카드 섹션',

  // 입력 전 카드 (최초 노출)
  'saju.entry.emoji': '🔮',
  'saju.entry.title': '오늘의 운세',
  'saju.entry.desc': '생년월일을 넣으면 나다운 하루 흐름을 카드로 보여드려요.',
  'saju.entry.cta': '열어보기',
  'saju.entry.badge': '참고용',

  // 입력 완료 후 요약 카드 (P4에서 실제 body 주입)
  'saju.today.title': '오늘의 운세',
  'saju.today.placeholder.summary': '오늘의 흐름을 준비하고 있어요.',
  'saju.today.cta': '자세히 보기',

  // 로딩·오류
  'saju.state.loading': '불러오는 중…',
  'saju.state.disabled': '사주 정보 입력은 다음 단계에서 연결됩니다.',
  'saju.state.error': '잠시 후 다시 열어볼게요.',

  // 안전 문구 (상세 팝업 하단 고정, P4에서 실사용)
  'saju.safety.notice':
    '이 내용은 재미와 자기이해를 위한 참고용 운세입니다. 중요한 결정은 전문가나 실제 상황을 기준으로 판단해주세요.',

  // ─── MVP 모달 (통합 테스트용 4단계 플로우) ───
  // 공통
  'saju.modal.close': '닫기',
  'saju.modal.back': '이전',
  'saju.modal.next': '다음',
  'saju.modal.step.consent': '시작',
  'saju.modal.step.profile': '나에 대해',
  'saju.modal.step.calibration': '오늘 보고 싶은',
  'saju.modal.step.result': '결과',

  // Step 1 — 동의
  'saju.modal.consent.title': '오늘의 운세 시작하기',
  'saju.modal.consent.lead':
    '오늘의 운세는 재미와 자기이해를 위한 참고용 카드예요.',
  'saju.modal.consent.body':
    '입력하신 생년월일·시간은 오늘의 운세 카드를 보여드리는 데에만 쓰이고, 외부에 공유되지 않아요.',
  'saju.modal.consent.cta': '동의하고 계속',

  // Step 2 — 프로필
  'saju.modal.profile.title': '나에 대해 알려주세요',
  'saju.modal.profile.birthDate.label': '생년월일',
  'saju.modal.profile.calendar.label': '양력/음력',
  'saju.modal.profile.calendar.solar': '양력',
  'saju.modal.profile.calendar.lunar': '음력',
  'saju.modal.profile.gender.label': '성별',
  'saju.modal.profile.gender.female': '여성',
  'saju.modal.profile.gender.male': '남성',
  'saju.modal.profile.gender.unknown': '선택 안 함',
  'saju.modal.profile.birthTime.label': '출생 시간 (선택)',
  'saju.modal.profile.birthTime.unknown': '모름',
  'saju.modal.profile.birthTime.hint':
    '시간을 알면 더 정밀해져요. 모르면 비워두세요.',

  // Step 3 — Calibration
  'saju.modal.calibration.title': '오늘 보고 싶은 운세는?',
  'saju.modal.calibration.focus.label': '지금 가장 궁금한 영역',
  'saju.modal.calibration.focus.total': '총운',
  'saju.modal.calibration.focus.money': '재물',
  'saju.modal.calibration.focus.relation': '관계',
  'saju.modal.calibration.focus.health': '건강',
  'saju.modal.calibration.focus.work': '일·학업',
  'saju.modal.calibration.tone.label': '원하는 말투',
  'saju.modal.calibration.tone.soft': '부드럽게',
  'saju.modal.calibration.tone.real': '현실적으로',
  'saju.modal.calibration.tone.short': '짧고 명확하게',
  'saju.modal.calibration.cta': '결과 보기',

  // 에러 메시지 (API 통합)
  'saju.modal.error.network':
    '연결이 잠시 불안정해요. 잠시 후 다시 시도해주세요.',
  'saju.modal.error.consent':
    '동의 저장에 실패했어요. 잠시 후 다시 시도해주세요.',
  'saju.modal.error.profile':
    '정보 저장에 실패했어요. 입력 내용을 확인해주세요.',
  'saju.modal.error.consent_required':
    '먼저 사주 동의가 필요해요.',
  'saju.modal.error.disabled':
    '오늘의 운세는 잠시 점검 중이에요.',
  'saju.modal.error.login':
    '로그인이 필요해요. 잠시 후 다시 안내될 거예요.',
  'saju.modal.error.today':
    '오늘의 운세를 가져오지 못했어요. 잠시 후 다시 시도해주세요.',
  'saju.modal.submitting': '저장 중…',
  'saju.modal.loading.result': '오늘의 운세를 불러오는 중…',

  // 데모 모드 (백엔드 사주 라우터 미설치·SAJU_ENABLED=false 등)
  'saju.modal.demo.banner':
    '데모 모드 — 백엔드 사주 기능이 아직 연결되지 않아 입력은 저장되지 않아요. 결과는 참고용 샘플이에요.',

  // Step 4 — 결과 (mock fallback / 백엔드 응답)
  'saju.modal.result.title': '오늘의 운세',
  'saju.modal.result.badge.mock': '참고용',
  'saju.modal.result.section.total': '총운',
  'saju.modal.result.section.money': '재물운',
  'saju.modal.result.section.health': '건강운',
  'saju.modal.result.section.work': '일·학업운',
  'saju.modal.result.section.oneThing': '오늘의 한 가지',
  'saju.modal.result.toggle.why': '왜 이렇게 봤나요?',
  'saju.modal.result.cta.close': '카드 닫기',
};

/**
 * 간단 조회 헬퍼 (rightPanel.ko.js 의 t() 와 동일 패턴).
 * 키 없으면 키 자체를 반환해 빠지면 눈에 보이도록.
 */
export function ts(key) {
  return SAJU_KO[key] ?? key;
}
