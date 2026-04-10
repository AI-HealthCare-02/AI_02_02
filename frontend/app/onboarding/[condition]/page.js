'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ─── Step definitions ───────────────────────────────────────────────────────
const allSteps = [
  // 0: terms (auth는 /login 페이지로 분리됨)
  { id: 'terms', type: 'terms', title: '서비스 이용 동의', sub: '다나아 서비스 이용을 위해\n아래 약관에 동의해주세요' },
  // 2: healthdisc
  { id: 'healthdisc', type: 'healthdisc', title: '건강 정보 수집 동의', sub: '맞춤 건강관리를 위해 동의해주세요' },
  // 3: category
  { id: 'category', phase: '시작', title: '관심 있는 건강 카테고리를\n선택해주세요', sub: '현재 당뇨만 운영 중이며 나머지는 곧 오픈', type: 'category' },
  // 4: relation
  { id: 'relation', phase: 'PHASE 1', title: '당뇨와 어떤 관계인가요?', sub: '답변에 따라 맞춤 설문이 달라집니다', why: '딱 맞는 설문만 보여드리기 위해 물어봅니다.', type: 'single', opts: [{ e: '🏥', l: '당뇨 진단을 받았어요' }, { e: '⚠️', l: '전당뇨(경계)라고 들었어요' }, { e: '👨‍👩‍👧', l: '가족 중에 당뇨가 있어요' }, { e: '💪', l: '건강관리 / 궁금해서' }] },
  // 5: profile
  { id: 'profile', phase: 'PHASE 1', title: '기본 정보를 알려주세요', why: '나이와 성별은 위험도 계산의 핵심.', type: 'grid', groups: [{ l: '성별', o: ['남성', '여성'] }, { l: '연령대', o: ['10대', '20대', '30대', '40대', '50대', '60대+'] }] },
  // 6: body
  { id: 'body', phase: 'PHASE 1', title: '체형을 알려주세요', sub: '슬라이더 또는 숫자 직접 입력', why: 'BMI는 당뇨 위험 예측 핵심 지표.', type: 'slider', phaseMsg: '기본 프로필 완성! 절반 왔어요 💪' },
  // 7: family
  { id: 'family', phase: 'PHASE 2', title: '가까운 가족 중\n당뇨가 있나요?', type: 'single', opts: [{ e: '👨‍👩‍👧', l: '가족(부모/형제) 중 있어요' }, { e: '👥', l: '친척 중 있어요' }, { e: '', l: '없어요' }, { e: '', l: '잘 모르겠어요' }] },
  // 8: conditions
  { id: 'conditions', phase: 'PHASE 2', title: '해당하는 것을\n모두 골라주세요', type: 'chip', chips: ['💊 고혈압/혈압약', '고지혈증', '📋 고혈당 이력', '🤰 임신성 당뇨', '해당 없음'] },
  // 9: treatment
  { id: 'treatment', phase: 'PHASE 2', title: '현재 어떤 관리를\n하고 계세요?', type: 'chip', chips: ['🥗 식이요법', '💊 경구약', '💉 인슐린', '🏥 기타 약물', '관리 안 함'], showFor: 'A', canSkip: true },
  // 10: lab
  { id: 'lab', phase: 'PHASE 2', title: '최근 검사 수치를\n알려주세요', sub: '몰라도 괜찮아요! 나중에 입력 가능', type: 'grid', groups: [{ l: 'HbA1c', o: ['~5.7%', '5.7~6.4%', '6.5~7%', '7%+', '모름'] }, { l: '공복혈당', o: ['~100', '100~125', '126+', '모름'] }], showFor: 'AB', canSkip: true, phaseMsg: '거의 다 됐어요! 생활습관만 남았어요 🏃' },
  // 11: exercise
  { id: 'exercise', phase: 'PHASE 3', title: '일주일에 운동을\n얼마나 하시나요?', sub: '걷기, 계단 등 가벼운 활동 포함', type: 'single', opts: [{ e: '🛋️', l: '거의 안 해요' }, { e: '🚶', l: '주 1~2회' }, { e: '🏃', l: '주 3~4회' }, { e: '💪', l: '주 5회 이상' }] },
  // 12: diet
  { id: 'diet', phase: 'PHASE 3', title: '식습관을 골라주세요', sub: '여러 개 선택 가능', type: 'chip', chips: ['🍚 밥·빵·면', '🥤 단 음료', '🌙 야식', '🥗 채소·과일', '⏰ 불규칙', '없음'] },
  // 13: lifestyle
  { id: 'lifestyle', phase: 'PHASE 3', title: '생활 패턴을 알려주세요', type: 'grid', groups: [{ l: '💤 수면', o: ['~5h', '5~6h', '7~8h', '9h+'] }, { l: '🍺 음주', o: ['안 마심', '가끔', '자주', '매일'] }, { l: '🚬 흡연', o: ['안 핌', '과거', '현재'] }] },
  // 14: goal
  { id: 'goal', phase: 'PHASE 4', title: '다나아에서 가장\n하고 싶은 것은?', sub: '여러 개 선택 가능', type: 'chip', chips: ['🎯 위험도', '📊 건강추적', '🥗 식단', '🏃 운동', '⚖️ 체중', '✨ 전체'] },
  // 15: freq
  { id: 'freq', phase: 'PHASE 4', title: 'AI 채팅 중 건강 질문\n얼마나 자주 받을까요?', sub: 'AI 답변 끝에 건강 질문이 붙어요.', type: 'single', opts: [{ e: '⏰', l: '1시간마다' }, { e: '🕐', l: '1시간 30분마다', rec: true }, { e: '🕑', l: '2시간마다' }, { e: '📝', l: '한번에 입력' }, { e: '🔕', l: '나중에 설정' }] },
];

const SURVEY_START = 2;
const SURVEY_END = 14;
const TOTAL_SURVEY = SURVEY_END - SURVEY_START + 1;

const categories = [
  { e: '🩸', n: '당뇨', d: '혈당, 위험도, 습관 추적', active: true },
  { e: '💓', n: '고혈압', d: '혈압, 심혈관', active: false },
  { e: '⚖️', n: '비만', d: '체중, 활동량', active: false },
  { e: '🫀', n: '심혈관', d: '심장 건강', active: false },
];

// ─── Component ──────────────────────────────────────────────────────────────
export default function OnboardingFlow() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({ 3: 0, 14: 1 }); // 3: 당뇨진단 기본선택, 14: 1시간30분 기본선택
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  const [consents, setConsents] = useState([false, false, false, false]);
  const [healthDisc, setHealthDisc] = useState([false, false, false]);
  const [height, setHeight] = useState(170);
  const [weight, setWeight] = useState(70);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [categorySelected, setCategorySelected] = useState(true); // 당뇨 기본 선택

  const step = allSteps[currentStep];

  // ── Progress ──
  const progressWidth = useMemo(() => {
    if (currentStep < SURVEY_START) return '0%';
    if (currentStep > SURVEY_END) return '100%';
    const idx = currentStep - SURVEY_START + 1;
    return `${Math.round((idx / TOTAL_SURVEY) * 100)}%`;
  }, [currentStep]);

  const stepLabel = useMemo(() => {
    if (currentStep < SURVEY_START || currentStep > SURVEY_END) return '';
    return `${currentStep - SURVEY_START + 1}/${TOTAL_SURVEY}`;
  }, [currentStep]);

  // ── Validation ──
  const canProceed = useMemo(() => {
    if (!step) return false;
    const { type, id } = step;
    if (type === 'auth') return true;
    if (type === 'terms') return consents[0] && consents[1] && consents[2];
    if (type === 'healthdisc') return healthDisc.every(Boolean);
    if (type === 'category') return categorySelected;
    if (type === 'slider') return true;
    if (type === 'single') return answers[currentStep] !== undefined;
    if (type === 'chip') return answers[currentStep] && answers[currentStep].length > 0;
    if (type === 'grid') {
      const g = answers[currentStep];
      if (!g) return false;
      return step.groups.every((_, gi) => g[gi] !== undefined);
    }
    return false;
  }, [step, currentStep, answers, consents, healthDisc, categorySelected]);

  // ── Navigation ──
  const saveOnboardingData = useCallback(() => {
    const a = answersRef.current;
    const data = {
      relation: a[3] ?? null,
      gender: a[4]?.[0] ?? null,
      age: a[4]?.[1] ?? null,
      height, weight,
      family: a[6] ?? null,
      conditions: a[7] ?? [],
      treatment: a[8] ?? [],
      lab: a[9] ?? {},
      exercise: a[10] ?? null,
      diet: a[11] ?? [],
      lifestyle_sleep: a[12]?.[0] ?? null,
      lifestyle_alcohol: a[12]?.[1] ?? null,
      lifestyle_smoking: a[12]?.[2] ?? null,
      goals: a[13] ?? [],
      freq: a[14] ?? null,
    };
    try { localStorage.setItem('danaa_onboarding', JSON.stringify(data)); } catch {}
  }, [height, weight]);

  const goNext = useCallback(() => {
    let next = currentStep + 1;
    if (next >= allSteps.length) {
      saveOnboardingData();
      router.push('/onboarding/complete');
      return;
    }
    // Use ref to always get the latest relation answer (avoids stale closure)
    const relationAnswer = answersRef.current[3];
    const nextStep = allSteps[next];
    if (nextStep?.showFor === 'A' && relationAnswer !== 0) {
      next++;
    }
    if (next < allSteps.length && allSteps[next]?.showFor === 'AB' && relationAnswer !== 0 && relationAnswer !== 1) {
      next++;
    }
    if (next >= allSteps.length) {
      saveOnboardingData();
      router.push('/onboarding/complete');
      return;
    }
    setCurrentStep(next);
  }, [currentStep, router, saveOnboardingData]);

  const goBack = useCallback(() => {
    if (currentStep <= 0) return;
    let prev = currentStep - 1;
    // Use ref to always get the latest relation answer
    const relationAnswer = answersRef.current[3];
    if (prev < allSteps.length && allSteps[prev]?.showFor === 'AB' && relationAnswer !== 0 && relationAnswer !== 1) {
      prev--;
    }
    if (prev >= 0 && allSteps[prev]?.showFor === 'A' && relationAnswer !== 0) {
      prev--;
    }
    if (prev >= 0) setCurrentStep(prev);
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    goNext();
  }, [goNext]);

  // ── Answer helpers ──
  const pickSingle = useCallback((idx) => {
    setAnswers((prev) => ({ ...prev, [currentStep]: idx }));
  }, [currentStep]);

  const toggleChip = useCallback((idx) => {
    setAnswers((prev) => {
      const current = prev[currentStep] ? [...prev[currentStep]] : [];
      const step = STEPS[currentStep];
      const chips = step?.chips || [];
      const chipLabel = chips[idx] || '';

      // "해당 없음", "없음", "관리 안 함" 등은 배타적 선택
      const exclusiveLabels = ['해당 없음', '없음', '관리 안 함'];
      const isExclusive = exclusiveLabels.some(l => chipLabel.includes(l));
      const lastChipIdx = chips.length - 1;

      if (isExclusive) {
        // 배타적 항목 클릭 → 다른 것 다 해제하고 이것만
        const pos = current.indexOf(idx);
        return { ...prev, [currentStep]: pos >= 0 ? [] : [idx] };
      } else {
        // 일반 항목 클릭 → 배타적 항목 해제
        const filtered = current.filter(i => {
          const label = chips[i] || '';
          return !exclusiveLabels.some(l => label.includes(l));
        });
        const pos = filtered.indexOf(idx);
        if (pos >= 0) filtered.splice(pos, 1);
        else filtered.push(idx);
        return { ...prev, [currentStep]: filtered };
      }
    });
  }, [currentStep]);

  const pickGrid = useCallback((groupIdx, optIdx) => {
    setAnswers((prev) => {
      const current = prev[currentStep] ? { ...prev[currentStep] } : {};
      current[groupIdx] = optIdx;
      return { ...prev, [currentStep]: current };
    });
  }, [currentStep]);

  // ── Consent helpers ──
  const toggleConsent = useCallback((idx) => {
    setConsents((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  }, []);

  const toggleAllConsents = useCallback(() => {
    setConsents((prev) => {
      const allChecked = prev.every(Boolean);
      return prev.map(() => !allChecked);
    });
  }, []);

  const toggleHealthDisc = useCallback((idx) => {
    setHealthDisc((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  }, []);

  // ── BMI ──
  const bmi = useMemo(() => {
    const h = height / 100;
    return (weight / (h * h)).toFixed(1);
  }, [height, weight]);

  // ─── Render body by step type ─────────────────────────────────────────────
  const renderBody = () => {
    if (!step) return null;

    // ── AUTH (step 0) ──


    // ── TERMS (step 1) ──
    if (step.type === 'terms') {
      const allChecked = consents.every(Boolean);
      const termItems = [
        { label: '서비스 이용약관', required: true },
        { label: '개인정보 수집·이용 동의', required: true },
        { label: '만 14세 이상 확인', required: true },
        { label: '마케팅 정보 수신 동의', required: false },
      ];
      return (
        <div>
          <div className="text-center mb-4">
            <div className="text-[28px] mb-2">📋</div>
            <h2 className="text-[20px] font-bold text-nature-900 mb-1">{step.title}</h2>
            <p className="text-[13px] text-neutral-400 whitespace-pre-line">{step.sub}</p>
          </div>

          {/* Toggle all */}
          <button
            onClick={toggleAllConsents}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-cream-300 border border-cream-500 mb-3 transition-all"
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] transition-all ${allChecked ? 'bg-nature-500 border-nature-500 text-white' : 'border-cream-500'}`}>
              {allChecked && '✓'}
            </div>
            <span className="text-[15px] font-medium text-nature-900">전체 동의</span>
          </button>

          <div className="space-y-1">
            {termItems.map((item, i) => (
              <button
                key={i}
                onClick={() => toggleConsent(i)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] shrink-0 transition-all ${consents[i] ? 'bg-nature-500 border-nature-500 text-white' : 'border-cream-500'}`}>
                  {consents[i] && '✓'}
                </div>
                <span className="flex-1 text-[14px] text-neutral-600">{item.label}</span>
                <span className={`text-[12px] ${item.required ? 'text-nature-500' : 'text-neutral-300'}`}>
                  {item.required ? '필수' : '선택'}
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // ── HEALTHDISC (step 2) ──
    if (step.type === 'healthdisc') {
      const hdItems = [
        { label: '개인건강정보 수집·이용 동의', required: true },
        { label: 'AI 기반 건강 분석 서비스 동의', required: true },
        { label: '위 면책조항을 확인했습니다', required: true },
      ];
      return (
        <div>
          <div className="text-center mb-4">
            <div className="text-[28px] mb-2">🔒</div>
            <h2 className="text-[20px] font-bold text-nature-900 mb-1">{step.title}</h2>
            <p className="text-[13px] text-neutral-400 whitespace-pre-line">{step.sub}</p>
          </div>

          <div className="bg-cream-300 rounded-xl p-4 mb-4">
            <h4 className="text-[14px] font-semibold text-nature-900 mb-2">수집하는 건강정보</h4>
            <div className="text-[13px] text-neutral-600 leading-[1.8] space-y-0.5">
              <p>✓ 신체 정보 (키, 몸무게, 나이, 성별)</p>
              <p>✓ 건강 상태 (만성질환, 가족력)</p>
              <p>✓ 생활 습관 (식사, 운동, 수면)</p>
            </div>
          </div>

          {/* First two consent rows */}
          {hdItems.slice(0, 2).map((item, i) => (
            <button
              key={i}
              onClick={() => toggleHealthDisc(i)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] shrink-0 transition-all ${healthDisc[i] ? 'bg-nature-500 border-nature-500 text-white' : 'border-cream-500'}`}>
                {healthDisc[i] && '✓'}
              </div>
              <span className="flex-1 text-[14px] text-neutral-600">{item.label}</span>
              <span className="text-[12px] text-nature-500">필수</span>
            </button>
          ))}

          {/* Medical disclaimer box */}
          <div className="bg-warning-light border border-warning/20 rounded-xl p-4 my-3">
            <h4 className="text-[14px] font-semibold text-nature-900 mb-1">⚕️ 의료 면책</h4>
            <p className="text-[12px] text-neutral-400 leading-[1.7]">
              다나아 AI는 의료 기기가 아니며, 의학적 진단을 대체하지 않습니다. 건강 리포트는 참고용이며 중요한 결정은 의료 전문가와 상담하세요.
            </p>
          </div>

          <button
            onClick={() => toggleHealthDisc(2)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] shrink-0 transition-all ${healthDisc[2] ? 'bg-nature-500 border-nature-500 text-white' : 'border-cream-500'}`}>
              {healthDisc[2] && '✓'}
            </div>
            <span className="flex-1 text-[14px] text-neutral-600">{hdItems[2].label}</span>
            <span className="text-[12px] text-nature-500">필수</span>
          </button>
        </div>
      );
    }

    // ── SURVEY STEPS (3-15) ──
    return (
      <div>
        {/* Phase transition celebration message */}
        {step.phaseMsg && (
          <div className="bg-nature-50 text-nature-700 text-[13px] font-medium rounded-lg px-4 py-2.5 mb-3 text-center">
            {step.phaseMsg}
          </div>
        )}

        {/* Phase tag */}
        {step.phase && (
          <div className="text-[12px] text-nature-500 font-semibold tracking-wide mb-1.5">{step.phase}</div>
        )}

        {/* Title */}
        <h2 className="text-[20px] font-bold text-nature-900 mb-1 leading-tight whitespace-pre-line">{step.title}</h2>

        {/* Subtitle */}
        {step.sub && <p className="text-[13px] text-neutral-400 mb-3">{step.sub}</p>}

        {/* Why box */}
        {step.why && (
          <div className="bg-cream-300 rounded-lg p-3 mb-4 flex gap-2">
            <span className="text-[13px]">💡</span>
            <span className="text-[12px] text-neutral-400 leading-[1.6]">{step.why}</span>
          </div>
        )}

        {/* ── CATEGORY ── */}
        {step.type === 'category' && (
          <div className="space-y-2">
            {categories.map((cat, i) => (
              <button
                key={i}
                disabled={!cat.active}
                onClick={() => cat.active && setCategorySelected(true)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all relative ${
                  cat.active && categorySelected
                    ? 'bg-cream-300 border-2 border-nature-500'
                    : cat.active
                    ? 'bg-white border border-cream-500 hover:bg-cream-300 cursor-pointer'
                    : 'bg-cream-300 border border-cream-500 opacity-60 cursor-not-allowed'
                }`}
              >
                <span className="text-[20px]">{cat.e}</span>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold text-nature-900">{cat.n}</div>
                  <div className="text-[12px] text-neutral-400">{cat.d}</div>
                </div>
                {!cat.active && (
                  <span className="text-[11px] bg-cream-500 text-neutral-400 px-2 py-0.5 rounded-full">준비 중</span>
                )}
                {cat.active && categorySelected && (
                  <div className="w-5 h-5 rounded-full bg-nature-500 text-white flex items-center justify-center text-[11px]">✓</div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── SINGLE SELECT ── */}
        {step.type === 'single' && (
          <div className="space-y-2">
            {step.opts.map((opt, i) => {
              const selected = answers[currentStep] === i;
              return (
                <button
                  key={i}
                  onClick={() => pickSingle(i)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[14px] text-left transition-all ${
                    selected
                      ? 'bg-cream-300 border-2 border-nature-500 text-nature-900 font-medium'
                      : 'bg-white border border-cream-500 text-neutral-600 hover:bg-cream-300'
                  }`}
                >
                  {opt.e && <span className="text-lg">{opt.e}</span>}
                  <span className="flex-1">{opt.l}</span>
                  {opt.rec && (
                    <span className="text-[11px] bg-nature-50 text-nature-700 px-2 py-0.5 rounded-full font-medium">추천</span>
                  )}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] shrink-0 ${
                    selected ? 'bg-nature-500 border-nature-500 text-white' : 'border-cream-500'
                  }`}>
                    {selected && '✓'}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── CHIP SELECT ── */}
        {step.type === 'chip' && (
          <div className="flex flex-wrap gap-2">
            {(() => {
              const exclusiveLabels = ['해당 없음', '없음', '관리 안 함'];
              const currentAnswers = answers[currentStep] || [];
              const hasExclusiveSelected = currentAnswers.some(i => {
                const label = step.chips[i] || '';
                return exclusiveLabels.some(l => label.includes(l));
              });
              return step.chips.map((chip, i) => {
                const selected = currentAnswers.includes(i);
                const isExclusive = exclusiveLabels.some(l => chip.includes(l));
                const isDisabled = hasExclusiveSelected && !isExclusive;
                return (
                  <button
                    key={i}
                    onClick={() => toggleChip(i)}
                    className={`px-4 py-2.5 rounded-full text-[14px] transition-all ${
                      selected
                        ? isExclusive
                          ? 'bg-nature-500 text-white font-medium ring-2 ring-nature-500/30'
                          : 'bg-nature-500 text-white font-medium'
                        : isDisabled
                          ? 'bg-cream-300 border border-cream-500 text-neutral-200 cursor-not-allowed'
                          : 'bg-white border border-cream-500 text-neutral-600 hover:bg-cream-300'
                    }`}
                  >
                    {chip}
                  </button>
                );
              });
            })()}
          </div>
        )}

        {/* ── GRID SELECT ── */}
        {step.type === 'grid' && (
          <div className="space-y-4">
            {step.groups.map((group, gi) => (
              <div key={gi}>
                <div className="text-[14px] font-semibold text-nature-900 mb-2">{group.l}</div>
                <div className="flex flex-wrap gap-2">
                  {group.o.map((opt, oi) => {
                    const selected = answers[currentStep]?.[gi] === oi;
                    return (
                      <button
                        key={oi}
                        onClick={() => pickGrid(gi, oi)}
                        className={`px-4 py-2.5 rounded-lg text-[14px] transition-all ${
                          selected
                            ? 'bg-nature-500 text-white font-medium'
                            : 'bg-white border border-cream-500 text-neutral-600 hover:bg-cream-300'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SLIDER (body) ── */}
        {step.type === 'slider' && (
          <div className="space-y-5">
            {/* Height slider */}
            <div>
              <div className="text-[14px] font-semibold text-nature-900 mb-2">키</div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="140"
                  max="200"
                  step="1"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="flex-1 h-1.5 appearance-none bg-cream-500 rounded-full outline-none accent-nature-500"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={height}
                    min="140"
                    max="200"
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') { setHeight(''); return; }
                      setHeight(Number(raw));
                    }}
                    onBlur={() => {
                      const v = Math.max(140, Math.min(200, Number(height) || 170));
                      setHeight(v);
                    }}
                    className="w-14 text-center text-[15px] font-medium border border-cream-500 rounded-lg py-1.5 outline-none focus:border-nature-500"
                  />
                  <span className="text-[13px] text-neutral-400">cm</span>
                </div>
              </div>
            </div>

            {/* Weight slider */}
            <div>
              <div className="text-[14px] font-semibold text-nature-900 mb-2">몸무게</div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="35"
                  max="150"
                  step="1"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="flex-1 h-1.5 appearance-none bg-cream-500 rounded-full outline-none accent-nature-500"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={weight}
                    min="35"
                    max="150"
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') { setWeight(''); return; }
                      setWeight(Number(raw));
                    }}
                    onBlur={() => {
                      const v = Math.max(35, Math.min(150, Number(weight) || 70));
                      setWeight(v);
                    }}
                    className="w-14 text-center text-[15px] font-medium border border-cream-500 rounded-lg py-1.5 outline-none focus:border-nature-500"
                  />
                  <span className="text-[13px] text-neutral-400">kg</span>
                </div>
              </div>
            </div>

            {/* BMI display */}
            <div className="bg-cream-300 rounded-xl p-4 text-center">
              <div className="text-[12px] text-neutral-400 mb-1">BMI</div>
              <div className="text-[24px] font-bold text-nature-500">{bmi}</div>
              <div className="text-[12px] text-neutral-400 mt-1">
                {bmi < 18.5 ? '저체중' : bmi < 23 ? '정상' : bmi < 25 ? '과체중' : '비만'}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Footer buttons ──
  const renderFooter = () => {
    if (step?.type === 'auth') return null;

    const buttonLabel =
      step?.type === 'terms'
        ? '동의하고 계속하기'
        : step?.type === 'healthdisc'
        ? '동의하고 건강설문 시작'
        : '다음';

    return (
      <div className="px-5 py-4 flex items-center justify-between shrink-0">
        {/* Back button */}
        <button
          onClick={goBack}
          className={`text-[13px] transition-all ${currentStep > 0 ? 'text-neutral-400 hover:text-neutral-600' : 'text-transparent pointer-events-none'}`}
        >
          ← 이전
        </button>

        <div className="flex items-center gap-2">
          {/* Skip button */}
          {step?.canSkip && (
            <button
              onClick={handleSkip}
              className="text-[13px] text-neutral-300 hover:text-neutral-400 transition-all"
            >
              건너뛰기
            </button>
          )}

          {/* Next button */}
          <button
            onClick={goNext}
            disabled={!canProceed}
            className={`px-6 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
              canProceed
                ? 'bg-nature-500 text-white hover:bg-nature-800'
                : 'bg-cream-500 text-neutral-300 cursor-not-allowed'
            }`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    );
  };

  // ─── Main layout ────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-cream-400 via-cream to-neutral-100 flex items-center justify-center p-6"
    >
      <div className="w-[380px] h-[600px] bg-white rounded-xl shadow-modal flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-full bg-nature-500 text-white flex items-center justify-center text-[11px] font-bold">
            D
          </div>
          <span className="text-[14px] font-semibold text-nature-900">DA-NA-A</span>
          <div className="flex-1 mx-2 h-[3px] bg-cream-500 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-nature-500 to-nature-600 rounded-full transition-all duration-300"
              style={{ width: progressWidth }}
            />
          </div>
          <span className="text-[12px] text-neutral-300">{stepLabel}</span>
          {/* DEV 건너뛰기 — 현재 입력된 데이터 그대로 저장 후 채팅으로 */}
          <button
            onClick={() => {
              // 현재까지 입력된 온보딩 데이터 저장 (없으면 빈 객체)
              if (!localStorage.getItem('danaa_onboarding')) {
                localStorage.setItem('danaa_onboarding', JSON.stringify({}));
              }
              localStorage.removeItem('danaa_tutorial_done');
              window.location.href = '/app/chat';
            }}
            className="ml-1 px-2 py-0.5 text-[9px] bg-red-100 text-red-500 rounded hover:bg-red-200 transition-colors shrink-0"
          >
            DEV
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{renderBody()}</div>

        {/* ── Footer ── */}
        {renderFooter()}
      </div>
    </div>
  );
}
