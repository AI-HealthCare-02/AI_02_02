// ═══════════════════════════════════════════
// 다나아 — 당뇨 온보딩 설문 데이터
// ═══════════════════════════════════════════
//
// 각 질문 객체의 구조:
//   id          : 고유 식별자
//   type        : 질문 유형 (single-select, multi-select, grid-select, dual-slider, multi-group, completion)
//   title       : 질문 제목
//   subtitle    : 보조 설명 (선택)
//   why         : "왜 물어보는지" 설명 (선택)
//   phase       : Phase 번호 (1~4)
//   phaseLabel  : Phase 이름
//   showFor     : 특정 그룹에만 표시 (null = 전체, ['A'] = A그룹만, ['A','B'] = A+B)
//   options     : 선택지 배열
//   phaseMessage: Phase 전환 시 격려 메시지 (선택)
//

const diabetesQuestions = [

  // ━━━ Phase 1: 누구인지 파악 (필수) ━━━

  {
    id: 'relation',
    type: 'single-select',
    title: '당뇨와 어떤 관계인가요?',
    subtitle: '답변에 따라 맞춤 설문이 달라집니다',
    why: '불필요한 질문을 건너뛰고, 딱 맞는 설문만 보여드리기 위해 물어봅니다.',
    phase: 1,
    phaseLabel: '기본 분류',
    showFor: null,
    options: [
      { value: 'diagnosed',     label: '당뇨 진단을 받았어요',     emoji: '🏥', group: 'A' },
      { value: 'prediabetes',   label: '전당뇨(경계)라고 들었어요', emoji: '⚠️', group: 'B' },
      { value: 'family',        label: '가족 중에 당뇨가 있어요',   emoji: '👨‍👩‍👧', group: 'C' },
      { value: 'curious',       label: '그냥 궁금해서요',           emoji: '🤔', group: 'C' },
      { value: 'prevention',    label: '건강관리 차원에서',         emoji: '💪', group: 'C' },
    ],
  },

  {
    id: 'profile',
    type: 'multi-group',
    title: '기본 정보를 알려주세요',
    subtitle: null,
    why: '나이와 성별은 당뇨 위험도 계산의 핵심 변수입니다.',
    phase: 1,
    phaseLabel: '기본 분류',
    showFor: null,
    groups: [
      {
        id: 'gender',
        label: '성별',
        options: [
          { value: 'male',   label: '남성' },
          { value: 'female', label: '여성' },
        ],
      },
      {
        id: 'age',
        label: '연령대',
        options: [
          { value: '20s', label: '20대' },
          { value: '30s', label: '30대' },
          { value: '40s', label: '40대' },
          { value: '50s', label: '50대' },
          { value: '60+', label: '60대 이상' },
        ],
      },
    ],
  },

  {
    id: 'body',
    type: 'dual-slider',
    title: '체형을 알려주세요',
    subtitle: '슬라이더를 움직여주세요. BMI가 자동 계산됩니다.',
    why: 'BMI(체질량지수)는 당뇨 위험 예측의 핵심 지표입니다.',
    phase: 1,
    phaseLabel: '기본 분류',
    showFor: null,
    phaseMessage: '기본 프로필 완성! 이제 절반 왔어요 💪',
    sliders: [
      { id: 'height', label: '키 (cm)',     min: 140, max: 200, step: 1, defaultValue: 170 },
      { id: 'weight', label: '몸무게 (kg)', min: 35,  max: 150, step: 1, defaultValue: 70  },
    ],
  },


  // ━━━ Phase 2: 핵심 위험인자 (조건부) ━━━

  {
    id: 'family-history',
    type: 'single-select',
    title: '가까운 가족 중\n당뇨가 있나요?',
    subtitle: null,
    why: '부모의 당뇨 이력이 있으면 위험도가 2~3배 높아집니다.',
    phase: 2,
    phaseLabel: '위험인자',
    showFor: null,
    options: [
      { value: 'parents',    label: '부모님 중 있어요',       emoji: '' },
      { value: 'siblings',   label: '형제·자매 중 있어요',    emoji: '' },
      { value: 'both',       label: '부모 + 형제 모두 있어요', emoji: '' },
      { value: 'none',       label: '없어요',                 emoji: '' },
      { value: 'unknown',    label: '잘 모르겠어요',           emoji: '', isSkip: true },
    ],
  },

  {
    id: 'conditions',
    type: 'multi-select',
    title: '해당하는 것을\n모두 골라주세요',
    subtitle: null,
    why: '고혈당 이력은 당뇨 위험 예측에서 가장 높은 점수(5점)를 차지합니다.',
    phase: 2,
    phaseLabel: '위험인자',
    showFor: null,
    options: [
      { value: 'hypertension',    label: '고혈압 / 혈압약 복용',  emoji: '💊' },
      { value: 'dyslipidemia',    label: '고지혈증',              emoji: '' },
      { value: 'high-glucose',    label: '고혈당 판정 이력',      emoji: '📋' },
      { value: 'gestational',     label: '임신성 당뇨 경험',      emoji: '🤰', genderOnly: 'female' },
      { value: 'none',            label: '해당 없음',             emoji: '' },
    ],
  },

  {
    id: 'treatment',
    type: 'multi-select',
    title: '현재 어떤 관리를\n하고 계세요?',
    subtitle: null,
    why: '현재 치료 상황에 맞는 대시보드와 챌린지를 제공하기 위해 확인합니다.',
    phase: 2,
    phaseLabel: '위험인자',
    showFor: ['A'],   // ← A그룹(관리형)만 표시
    options: [
      { value: 'lifestyle',  label: '식이요법 / 생활습관',  emoji: '🥗' },
      { value: 'oral-med',   label: '경구 혈당강하제',       emoji: '💊' },
      { value: 'insulin',    label: '인슐린 주사',           emoji: '💉' },
      { value: 'other-med',  label: '기타 약물',             emoji: '🏥' },
      { value: 'nothing',    label: '관리하지 않고 있어요',   emoji: '' },
    ],
  },

  {
    id: 'lab-values',
    type: 'multi-group',
    title: '최근 검사 수치를\n알고 있다면 알려주세요',
    subtitle: '몰라도 괜찮아요! 나중에 입력할 수 있어요 😊',
    why: '당화혈색소(HbA1c)는 당뇨 예측 변수 중 단독 1위 예측력을 가집니다.',
    phase: 2,
    phaseLabel: '위험인자',
    showFor: ['A', 'B'],   // ← A+B그룹만 표시
    phaseMessage: '거의 다 됐어요! 마지막 생활습관만 남았어요 🏃',
    groups: [
      {
        id: 'hba1c',
        label: '당화혈색소 (HbA1c)',
        options: [
          { value: 'under-5.7',   label: '~5.7%'   },
          { value: '5.7-6.4',     label: '5.7~6.4%' },
          { value: '6.5-7.0',     label: '6.5~7%'   },
          { value: 'over-7',      label: '7%+'       },
          { value: 'unknown',     label: '모름', isDefault: true },
        ],
      },
      {
        id: 'fasting-glucose',
        label: '공복혈당',
        options: [
          { value: 'under-100',   label: '~100' },
          { value: '100-125',     label: '100~125' },
          { value: 'over-126',    label: '126+'  },
          { value: 'unknown',     label: '모름', isDefault: true },
        ],
      },
    ],
  },


  // ━━━ Phase 3: 생활습관 (필수) ━━━

  {
    id: 'exercise',
    type: 'single-select',
    title: '일주일에 운동을\n얼마나 하시나요?',
    subtitle: '걷기, 계단 오르기 등 가벼운 활동도 포함',
    why: '주 4시간 이상 운동하면 당뇨 위험이 크게 줄어듭니다.',
    phase: 3,
    phaseLabel: '생활습관',
    showFor: null,
    options: [
      { value: 'none',   label: '거의 안 해요',   emoji: '🛋️' },
      { value: '1-2',    label: '주 1~2회',        emoji: '🚶' },
      { value: '3-4',    label: '주 3~4회',        emoji: '🏃' },
      { value: '5+',     label: '주 5회 이상',     emoji: '💪' },
    ],
  },

  {
    id: 'diet',
    type: 'multi-select',
    title: '식습관을 골라주세요',
    subtitle: '해당하는 것을 모두 선택해주세요',
    why: '탄수화물·당류 과다 섭취는 당뇨의 직접적 위험인자입니다.',
    phase: 3,
    phaseLabel: '생활습관',
    showFor: null,
    options: [
      { value: 'carb-heavy',   label: '밥·빵·면 위주',      emoji: '🍚' },
      { value: 'sugary-drink', label: '단 음료 자주',        emoji: '🥤' },
      { value: 'late-snack',   label: '야식 자주',           emoji: '🌙' },
      { value: 'veggies',      label: '채소·과일 매일',      emoji: '🥗' },
      { value: 'irregular',    label: '불규칙한 식사',       emoji: '⏰' },
      { value: 'none',         label: '특별히 해당 없음',    emoji: '' },
    ],
  },

  {
    id: 'lifestyle',
    type: 'multi-group',
    title: '생활 패턴을 알려주세요',
    subtitle: null,
    why: '수면 부족은 인슐린 저항성 증가, 흡연과 과음은 당뇨 위험을 직접 높입니다.',
    phase: 3,
    phaseLabel: '생활습관',
    showFor: null,
    groups: [
      {
        id: 'sleep',
        label: '💤 평균 수면',
        options: [
          { value: 'under-5',  label: '~5시간'  },
          { value: '5-6',      label: '5~6시간'  },
          { value: '7-8',      label: '7~8시간'  },
          { value: 'over-9',   label: '9시간+'   },
        ],
      },
      {
        id: 'alcohol',
        label: '🍺 음주',
        options: [
          { value: 'none',       label: '안 마셔요'   },
          { value: 'sometimes',  label: '가끔'         },
          { value: 'often',      label: '자주'         },
          { value: 'daily',      label: '매일'         },
        ],
      },
      {
        id: 'smoking',
        label: '🚬 흡연',
        options: [
          { value: 'none',    label: '안 피워요'  },
          { value: 'former',  label: '과거 흡연'  },
          { value: 'current', label: '현재 흡연'  },
        ],
      },
    ],
  },


  // ━━━ Phase 4: 개인화 설정 (필수) ━━━

  {
    id: 'goal',
    type: 'multi-select',
    title: '다나아에서 가장\n하고 싶은 것은?',
    subtitle: '여러 개 선택할 수 있어요',
    why: null,
    phase: 4,
    phaseLabel: '목표 설정',
    showFor: null,
    options: [
      { value: 'risk',      label: '당뇨 위험도 알아보기',  emoji: '🎯' },
      { value: 'tracking',  label: '건강수치 추적하기',      emoji: '📊' },
      { value: 'diet',      label: '식단 개선하기',          emoji: '🥗' },
      { value: 'exercise',  label: '운동 습관 만들기',       emoji: '🏃' },
      { value: 'weight',    label: '체중 관리하기',          emoji: '⚖️' },
      { value: 'all',       label: '전체 다 관심 있어요',    emoji: '✨' },
    ],
  },

  {
    id: 'ai-consent',
    type: 'single-select',
    title: 'AI 채팅 중 짧은 건강 질문을\n받아도 괜찮을까요?',
    subtitle: '다나아의 핵심 기능입니다. AI와 대화 중 답변 끝에 건강 질문 1~2개가 붙습니다.',
    why: null,
    phase: 4,
    phaseLabel: '목표 설정',
    showFor: null,
    options: [
      { value: 'always',    label: '좋아요, 계속 받을게요',  emoji: '👍' },
      { value: 'sometimes', label: '가끔만 받을게요',        emoji: '👌' },
      { value: 'later',     label: '나중에 할게요',          emoji: '⏰' },
    ],
  },

  // ━━━ 완료 화면 ━━━
  {
    id: 'completion',
    type: 'completion',
    phase: 4,
    phaseLabel: '완료',
    showFor: null,
  },
];

export default diabetesQuestions;
