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
};

/**
 * 간단 조회 헬퍼 (rightPanel.ko.js 의 t() 와 동일 패턴).
 * 키 없으면 키 자체를 반환해 빠지면 눈에 보이도록.
 */
export function ts(key) {
  return SAJU_KO[key] ?? key;
}
