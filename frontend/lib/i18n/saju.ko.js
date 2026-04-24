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
  // P2.2 강화: 입춘·절기 정밀도 미적용, 음력 미지원 한계 명시
  'saju.safety.notice':
    '이 내용은 재미와 자기이해를 위한 참고용 운세입니다. 입춘·절기 정밀도 미적용, 음력 미지원으로 실제 만세력 앱과 다를 수 있어요. 중요한 결정은 전문가나 실제 상황을 기준으로 판단해주세요.',

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

  // ─── P2.2: 오늘 일진 배지 ───
  'saju.today.pillar.prefix': '오늘은',
  'saju.today.pillar.subject': '일주',
  'saju.today.relation.prefix': '→',
  'saju.today.relation.suffix': '관계',
  'saju.today.relation.harmony': '합(合)',
  'saju.today.relation.clash': '충(沖)',
  'saju.today.relation.support': '생(生)',
  'saju.today.relation.pressure': '극(剋)',
  'saju.today.relation.same': '비화(比和)',

  // ─── P2.2: 원국 (사주팔자 4주) ───
  'saju.natal.title': '나의 사주팔자 (원국 참고)',
  'saju.natal.header.gan': '천간',
  'saju.natal.header.ji': '지지',
  'saju.natal.header.sisung': '십성',
  'saju.natal.pillar.year': '年 년주',
  'saju.natal.pillar.month': '月 월주',
  'saju.natal.pillar.day': '日 일주',
  'saju.natal.pillar.hour': '時 시주',
  'saju.natal.hour.unknown': '출생시간 미입력',
  'saju.natal.dayMaster.label': '日主 (본인 기준)',
  'saju.natal.elementDistribution.title': '오행 분포',

  // 십성 2단 해설 (short + long)
  'saju.natal.sisung.비견.short': '같은편',
  'saju.natal.sisung.비견.long': '같은 오행·같은 음양. 동료·내 편의 기운이에요.',
  'saju.natal.sisung.겁재.short': '경쟁',
  'saju.natal.sisung.겁재.long': '같은 오행·다른 음양. 경쟁·도전의 기운이에요.',
  'saju.natal.sisung.식신.short': '표현',
  'saju.natal.sisung.식신.long': '내가 생하는 같은 음양. 표현·여유·꾸준함의 기운이에요.',
  'saju.natal.sisung.상관.short': '재능',
  'saju.natal.sisung.상관.long': '내가 생하는 다른 음양. 재능·창의·입담의 기운이에요.',
  'saju.natal.sisung.편재.short': '기회',
  'saju.natal.sisung.편재.long': '내가 극하는 같은 음양. 기회·투자·변동 재물의 기운이에요.',
  'saju.natal.sisung.정재.short': '안정',
  'saju.natal.sisung.정재.long': '내가 극하는 다른 음양. 안정적 고정수입의 기운이에요.',
  'saju.natal.sisung.편관.short': '도전',
  'saju.natal.sisung.편관.long': '나를 극하는 같은 음양. 도전·책임·압박의 기운이에요.',
  'saju.natal.sisung.정관.short': '책임',
  'saju.natal.sisung.정관.long': '나를 극하는 다른 음양. 규율·역할·명예의 기운이에요.',
  'saju.natal.sisung.편인.short': '탐구',
  'saju.natal.sisung.편인.long': '나를 생하는 같은 음양. 탐구·변칙 지원의 기운이에요.',
  'saju.natal.sisung.정인.short': '배움',
  'saju.natal.sisung.정인.long': '나를 생하는 다른 음양. 배움·모성·안정 지원의 기운이에요.',

  // 오행
  'saju.element.목': '목',
  'saju.element.화': '화',
  'saju.element.토': '토',
  'saju.element.금': '금',
  'saju.element.수': '수',

  // 경계월 배너 (월주 절기 비보정 경계일 4~8일 출생자)
  'saju.warning.month_pillar.boundary':
    '⚠️ 이 달은 절기 경계일 가능성이 있어요. 월주가 정통 만세력과 다를 수 있어 참고용으로 봐주세요.',

  // ─── P3: 용신 (억부 한국 현대) ───
  'saju.yongshin.title': '용신 (억부·한국 현대 기준)',
  'saju.yongshin.label.yong': '용신',
  'saju.yongshin.label.hee': '희신',
  'saju.yongshin.label.ki': '기신',
  'saju.yongshin.sin_gang.strong': '신강',
  'saju.yongshin.sin_gang.weak': '신약',
  'saju.yongshin.sin_gang.balanced': '중화',
  'saju.yongshin.school.eokbu': '한국 현대 억부용신 기준',
  'saju.yongshin.score.tooltip': '월령(3) + 득지(2) + 득세(인·비 개수) 합산. 7↑ 신강 · 4~6 중화 · 3↓ 신약.',
  'saju.yongshin.role.비겁': '비겁',
  'saju.yongshin.role.인수': '인수',
  'saju.yongshin.role.식상': '식상',
  'saju.yongshin.role.재성': '재성',
  'saju.yongshin.role.관살': '관살',
};

/**
 * 간단 조회 헬퍼 (rightPanel.ko.js 의 t() 와 동일 패턴).
 * 키 없으면 키 자체를 반환해 빠지면 눈에 보이도록.
 */
export function ts(key) {
  return SAJU_KO[key] ?? key;
}
