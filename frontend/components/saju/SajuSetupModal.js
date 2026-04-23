'use client';

/**
 * SajuSetupModal · 오늘의 운세 MVP 모달 (통합 테스트용 4단계 플로우, v2.7 P1.5)
 *
 * 목적:
 *  - P5 전체 완성 전, 사용자가 카드 클릭 후 "이런 흐름이구나" 를 체감할 수 있는 최소 UX
 *  - 백엔드 호출 없음, 결과는 클라이언트 사이드 mock (참고용 배지 표기)
 *
 * 4단계:
 *  1. 동의 (consent)        — 짧은 안내 + "동의하고 계속"
 *  2. 프로필 (profile)       — 생년월일·성별·양력/음력·출생시간(선택, 모름 가능)
 *  3. Calibration            — 가장 궁금한 영역 + 원하는 말투
 *  4. 결과 (mock)            — 5섹션 카드 + "왜 이렇게 봤나요?" 토글 + 안전 문구
 *
 * 패턴:
 *  - Portal (document.body, z-index 130 — MissedQuestionsModal 보다 1단 위)
 *  - Focus trap (수동 Tab 가두기 + ESC 닫기 + 이전 포커스 복귀)
 *  - 톤: --color-surface / --color-border / radius 14px (RpRow 와 동일)
 *
 * P5 교체 지점:
 *  - handleConsentSubmit → POST /api/v1/saju/consent
 *  - handleProfileSubmit → PUT /api/v1/saju/profile
 *  - MOCK_RESULT → GET /api/v1/saju/today
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ts } from '@/lib/i18n/saju.ko';

const STEPS = ['consent', 'profile', 'calibration', 'result'];

/**
 * Mock 결과 (P5 에서 GET /api/v1/saju/today 응답으로 교체).
 * 톤 가이드 (saju.ko.js 헤더 참조): "~하기 좋은 흐름", "조절이 필요한 날" 등.
 * 의료·투자·법률·사고·관계 단정 표현 금지.
 */
const MOCK_RESULT = {
  isMock: true,
  sections: [
    {
      key: 'total',
      titleKey: 'saju.modal.result.section.total',
      body:
        '오늘은 새로운 흐름에 적응하기 좋은 날이에요. 무리해서 시작하기보다 평소 리듬을 점검하면 좋아요.',
      why:
        '오늘 일진(日辰: 그날의 천간지지)과 본인 일주(日柱)가 만나는 흐름에서 합(合)의 기운이 두드러져, 새 흐름을 받아들이기 좋은 배치로 보았어요.',
    },
    {
      key: 'money',
      titleKey: 'saju.modal.result.section.money',
      body:
        '큰 결정보다 작은 정리가 어울리는 흐름이에요. 카드 사용·구독 정리 같은 작은 결심이 도움 돼요.',
      why:
        '재물은 사주에서 재성(財星)의 움직임으로 살펴요. 오늘 일진은 결단보다 정리·점검에 어울리는 배치라, 작은 흐름을 다듬는 쪽으로 보았어요.',
    },
    {
      key: 'health',
      titleKey: 'saju.modal.result.section.health',
      body:
        '컨디션 변화가 느껴질 수 있는 날이에요. 물·수면 양을 평소보다 살짝 더 챙겨보세요.',
      why:
        '건강은 오행(五行: 목·화·토·금·수)의 균형으로 봐요. 오늘 일진의 기운이 평소 균형 폭을 살짝 흔드는 배치라, 컨디션 변동 가능성을 짚었어요.',
    },
    {
      key: 'work',
      titleKey: 'saju.modal.result.section.work',
      body:
        '집중이 필요한 한 가지를 정해두면 효율이 잘 살아나요. 멀티태스킹은 잠시 쉬어가기.',
      why:
        '일·학업은 관성(官星: 책임·역할의 기운)과 인성(印星: 배움·정리의 기운)의 흐름으로 살펴요. 오늘은 분산보다 집중 — 한 곳에 깊게 들어가는 기운이 더 잘 맞아요.',
    },
    {
      key: 'oneThing',
      titleKey: 'saju.modal.result.section.oneThing',
      body:
        '오늘은 "미뤄둔 작은 정리 한 가지" 를 끝내보세요. 책상 정리·메일 정리·물 한 컵 같은 작은 행동이면 충분해요.',
      why:
        '오늘 일진은 마무리에 어울리는 배치예요. 사주에서는 작은 정리가 흐름의 균형을 잡아주는 "용신(用神: 흐름을 보완해주는 기운)" 역할을 하기도 해요.',
    },
  ],
};

const FOCUS_OPTIONS = [
  { value: 'total', labelKey: 'saju.modal.calibration.focus.total' },
  { value: 'money', labelKey: 'saju.modal.calibration.focus.money' },
  { value: 'relation', labelKey: 'saju.modal.calibration.focus.relation' },
  { value: 'health', labelKey: 'saju.modal.calibration.focus.health' },
  { value: 'work', labelKey: 'saju.modal.calibration.focus.work' },
];

const TONE_OPTIONS = [
  { value: 'soft', labelKey: 'saju.modal.calibration.tone.soft' },
  { value: 'real', labelKey: 'saju.modal.calibration.tone.real' },
  { value: 'short', labelKey: 'saju.modal.calibration.tone.short' },
];

const GENDER_OPTIONS = [
  { value: 'female', labelKey: 'saju.modal.profile.gender.female' },
  { value: 'male', labelKey: 'saju.modal.profile.gender.male' },
  { value: 'unknown', labelKey: 'saju.modal.profile.gender.unknown' },
];

function SectionCard({ titleKey, body, why }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="saju-modal__section">
      <div className="saju-modal__section-title">{ts(titleKey)}</div>
      <div className="saju-modal__section-body">{body}</div>
      <button
        type="button"
        className="saju-modal__why-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="saju-modal__why-arrow" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        {ts('saju.modal.result.toggle.why')}
      </button>
      {open && <div className="saju-modal__why-body">{why}</div>}
    </div>
  );
}

function SajuSetupModalImpl({ open, onClose }) {
  const modalRef = useRef(null);
  const previouslyFocused = useRef(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [profile, setProfile] = useState({
    birthDate: '',
    calendar: 'solar',
    gender: 'unknown',
    birthTime: '',
    birthTimeUnknown: false,
  });
  const [calibration, setCalibration] = useState({
    focus: 'total',
    tone: 'soft',
  });
  const [mounted, setMounted] = useState(false);

  // SSR 안전: createPortal 은 client only
  useEffect(() => {
    setMounted(true);
  }, []);

  // 포커스 관리 + body scroll lock
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => {
      modalRef.current?.querySelector('.saju-modal__close')?.focus();
    }, 30);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // 모달이 열릴 때마다 step 1로 초기화 (재방문 시 처음부터)
  useEffect(() => {
    if (open) setStepIdx(0);
  }, [open]);

  // ESC + Focus trap
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusables = Array.from(
        modalRef.current.querySelectorAll(
          'button, [href], input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.disabled && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const goNext = useCallback(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), []);
  const goBack = useCallback(() => setStepIdx((i) => Math.max(i - 1, 0)), []);

  const profileValid = useMemo(() => {
    return Boolean(profile.birthDate); // 생년월일만 필수
  }, [profile.birthDate]);

  if (!open || !mounted) return null;

  const step = STEPS[stepIdx];

  const stepperLabel = `${stepIdx + 1} / ${STEPS.length}`;

  const titleByStep = {
    consent: ts('saju.modal.consent.title'),
    profile: ts('saju.modal.profile.title'),
    calibration: ts('saju.modal.calibration.title'),
    result: ts('saju.modal.result.title'),
  };

  const node = (
    <div className="saju-modal__overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="saju-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saju-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="saju-modal__header">
          <div className="saju-modal__header-left">
            <span className="saju-modal__step-pill" aria-label={`단계 ${stepperLabel}`}>
              {stepperLabel}
            </span>
            <h2 id="saju-modal-title" className="saju-modal__title">
              {titleByStep[step]}
            </h2>
          </div>
          <button
            type="button"
            className="saju-modal__close"
            aria-label={ts('saju.modal.close')}
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="saju-modal__body">
          {/* Step 1: Consent */}
          {step === 'consent' && (
            <div className="saju-modal__pane">
              <p className="saju-modal__lead">{ts('saju.modal.consent.lead')}</p>
              <p className="saju-modal__paragraph">{ts('saju.modal.consent.body')}</p>
            </div>
          )}

          {/* Step 2: Profile */}
          {step === 'profile' && (
            <div className="saju-modal__pane">
              <label className="saju-modal__field">
                <span className="saju-modal__field-label">
                  {ts('saju.modal.profile.birthDate.label')}
                </span>
                <input
                  type="date"
                  className="saju-modal__input"
                  value={profile.birthDate}
                  onChange={(e) => setProfile({ ...profile, birthDate: e.target.value })}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </label>

              <fieldset className="saju-modal__field">
                <legend className="saju-modal__field-label">
                  {ts('saju.modal.profile.calendar.label')}
                </legend>
                <div className="saju-modal__chips">
                  {['solar', 'lunar'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`saju-modal__chip ${profile.calendar === v ? 'is-active' : ''}`}
                      onClick={() => setProfile({ ...profile, calendar: v })}
                    >
                      {ts(`saju.modal.profile.calendar.${v}`)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="saju-modal__field">
                <legend className="saju-modal__field-label">
                  {ts('saju.modal.profile.gender.label')}
                </legend>
                <div className="saju-modal__chips">
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`saju-modal__chip ${profile.gender === opt.value ? 'is-active' : ''}`}
                      onClick={() => setProfile({ ...profile, gender: opt.value })}
                    >
                      {ts(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="saju-modal__field">
                <span className="saju-modal__field-label">
                  {ts('saju.modal.profile.birthTime.label')}
                </span>
                <div className="saju-modal__time-row">
                  <input
                    type="time"
                    className="saju-modal__input"
                    value={profile.birthTime}
                    onChange={(e) =>
                      setProfile({ ...profile, birthTime: e.target.value, birthTimeUnknown: false })
                    }
                    disabled={profile.birthTimeUnknown}
                  />
                  <label className="saju-modal__check">
                    <input
                      type="checkbox"
                      checked={profile.birthTimeUnknown}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          birthTimeUnknown: e.target.checked,
                          birthTime: e.target.checked ? '' : profile.birthTime,
                        })
                      }
                    />
                    {ts('saju.modal.profile.birthTime.unknown')}
                  </label>
                </div>
                <span className="saju-modal__field-hint">
                  {ts('saju.modal.profile.birthTime.hint')}
                </span>
              </label>
            </div>
          )}

          {/* Step 3: Calibration */}
          {step === 'calibration' && (
            <div className="saju-modal__pane">
              <fieldset className="saju-modal__field">
                <legend className="saju-modal__field-label">
                  {ts('saju.modal.calibration.focus.label')}
                </legend>
                <div className="saju-modal__chips">
                  {FOCUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`saju-modal__chip ${calibration.focus === opt.value ? 'is-active' : ''}`}
                      onClick={() => setCalibration({ ...calibration, focus: opt.value })}
                    >
                      {ts(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="saju-modal__field">
                <legend className="saju-modal__field-label">
                  {ts('saju.modal.calibration.tone.label')}
                </legend>
                <div className="saju-modal__chips">
                  {TONE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`saju-modal__chip ${calibration.tone === opt.value ? 'is-active' : ''}`}
                      onClick={() => setCalibration({ ...calibration, tone: opt.value })}
                    >
                      {ts(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {/* Step 4: Result (mock) */}
          {step === 'result' && (
            <div className="saju-modal__pane">
              <div className="saju-modal__result-meta">
                <span className="saju-modal__result-badge">
                  {ts('saju.modal.result.badge.mock')}
                </span>
                <span className="saju-modal__result-date">
                  {new Date().toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </span>
              </div>
              <div className="saju-modal__sections">
                {MOCK_RESULT.sections.map((s) => (
                  <SectionCard key={s.key} titleKey={s.titleKey} body={s.body} why={s.why} />
                ))}
              </div>
              <p className="saju-modal__safety-notice">{ts('saju.safety.notice')}</p>
            </div>
          )}
        </div>

        <footer className="saju-modal__footer">
          {step === 'consent' && (
            <>
              <button type="button" className="saju-modal__btn saju-modal__btn--ghost" onClick={onClose}>
                {ts('saju.modal.close')}
              </button>
              <button type="button" className="saju-modal__btn saju-modal__btn--primary" onClick={goNext}>
                {ts('saju.modal.consent.cta')}
              </button>
            </>
          )}
          {step === 'profile' && (
            <>
              <button type="button" className="saju-modal__btn saju-modal__btn--ghost" onClick={goBack}>
                {ts('saju.modal.back')}
              </button>
              <button
                type="button"
                className="saju-modal__btn saju-modal__btn--primary"
                onClick={goNext}
                disabled={!profileValid}
              >
                {ts('saju.modal.next')}
              </button>
            </>
          )}
          {step === 'calibration' && (
            <>
              <button type="button" className="saju-modal__btn saju-modal__btn--ghost" onClick={goBack}>
                {ts('saju.modal.back')}
              </button>
              <button type="button" className="saju-modal__btn saju-modal__btn--primary" onClick={goNext}>
                {ts('saju.modal.calibration.cta')}
              </button>
            </>
          )}
          {step === 'result' && (
            <button type="button" className="saju-modal__btn saju-modal__btn--primary" onClick={onClose}>
              {ts('saju.modal.result.cta.close')}
            </button>
          )}
        </footer>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

export default memo(SajuSetupModalImpl);
