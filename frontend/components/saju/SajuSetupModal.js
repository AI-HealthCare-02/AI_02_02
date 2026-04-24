'use client';

/**
 * SajuSetupModal · 오늘의 운세 4단계 모달 (v2.7 P1.5 → API 통합)
 *
 * 4단계:
 *  1. 동의 (consent)        — POST /api/v1/saju/consent
 *  2. 프로필 (profile)       — PUT /api/v1/saju/profile
 *  3. Calibration            — 클라이언트 전용 (P5 엔진 입력에 사용 예정)
 *  4. 결과                   — GET /api/v1/saju/today
 *                                · 200 → 백엔드 응답 렌더
 *                                · 501 (P1~P4 엔진 미구현) → MOCK_RESULT fallback
 *
 * 백엔드 401/403/503 처리:
 *  - api() 헬퍼가 401 자동 refresh / 실패 시 /login 리다이렉트
 *  - 403 (consent 없을 때 profile 호출): 'consent_required' 에러 표시
 *  - 503 (SAJU_ENABLED=false): 'disabled' 에러 표시
 *
 * 재방문 진입 (initialStep=3):
 *  - SajuCardSection 이 GET /saju/profile 으로 프로필 존재 확인 후
 *    SajuTodayCard 클릭 시 step 4 (결과) 로 직행
 *
 * 패턴:
 *  - Portal (document.body, z-index 130)
 *  - Focus trap (수동 Tab 가두기 + ESC 닫기 + 이전 포커스 복귀)
 *  - 톤: --color-surface / --color-border / radius 14px (RpRow 와 동일)
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/hooks/useApi';
import { ts } from '@/lib/i18n/saju.ko';

const CONSENT_VERSION = '1.0';

// 백엔드 SectionKey (7개) → 프론트 mock key (5개) 매핑.
// P5 에서 백엔드 응답을 그대로 렌더할 때, 프론트 i18n 타이틀 키를 찾기 위함.
const BACKEND_SECTION_TITLE_KEY = {
  total: 'saju.modal.result.section.total',
  money: 'saju.modal.result.section.money',
  health: 'saju.modal.result.section.health',
  work: 'saju.modal.result.section.work',
  one_thing: 'saju.modal.result.section.oneThing',
  // relation, caution 은 i18n 키만 추가 시 자동 노출
};

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

// ─────────────────────────────────────────────
// P2.2 — 원국·일진 컴포넌트 (내부 헬퍼)
// ─────────────────────────────────────────────

// 한자 → 한글 음독 (10 천간 + 12 지지)
const HAN_TO_KOR = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};
const toKor = (han) => HAN_TO_KOR[han] || '';

// 천간·지지 → 오행 매핑 (색상용 · 백엔드 GAN_ELEMENT·JI_ELEMENT 와 동일)
const GAN_ELEMENT = {
  甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토',
  己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수',
};
const JI_ELEMENT = {
  子: '수', 亥: '수', 寅: '목', 卯: '목', 巳: '화',
  午: '화', 辰: '토', 戌: '토', 丑: '토', 未: '토', 申: '금', 酉: '금',
};
const elOfGan = (g) => GAN_ELEMENT[g] || '';
const elOfJi = (j) => JI_ELEMENT[j] || '';

// 관계 이모지
const RELATION_EMOJI = {
  harmony: '🤝',
  clash: '⚡',
  support: '🌱',
  pressure: '🔥',
  same: '🪞',
};

function TodayPillarBadge({ apiResult }) {
  if (!apiResult?.today_pillar || !apiResult?.day_master) return null;
  const pillar = apiResult.today_pillar;
  const pillarKor = pillar.split('').map(toKor).join('');
  const todayElement = apiResult.today_element || '';
  const dayMaster = apiResult.day_master;
  const dmKor = toKor(dayMaster);
  const dmElement = apiResult.day_master_element || '';
  const kind = apiResult.day_relation?.kind || 'same';
  const kindLabel = ts(`saju.today.relation.${kind}`);
  const emoji = RELATION_EMOJI[kind] || '🪞';
  return (
    <div className="saju-modal__today-badge" role="group" aria-label="오늘 일진">
      <div className="saju-modal__today-badge-line1">
        🌙 {ts('saju.today.pillar.prefix')}{' '}
        <span className="saju-modal__today-badge-pillar">
          {pillar}
          {pillarKor ? `(${pillarKor})` : ''}
        </span>
        {todayElement && (
          <span className="saju-modal__today-badge-element">
            · <span className="saju-modal__element-chip" data-element={todayElement}>
              {ts(`saju.element.${todayElement}`) || todayElement}
            </span>
          </span>
        )}
      </div>
      <div className="saju-modal__today-badge-line2">
        {ts('saju.today.relation.prefix')} <strong>{dayMaster}{dmKor ? `(${dmKor})` : ''}</strong>{' '}
        {ts('saju.today.pillar.subject')}
        {dmElement && (
          <>
            ·{' '}
            <span className="saju-modal__element-chip" data-element={dmElement}>
              {ts(`saju.element.${dmElement}`) || dmElement}
            </span>
          </>
        )}
        {' '}{emoji} <strong>{kindLabel}</strong> {ts('saju.today.relation.suffix')}
      </div>
    </div>
  );
}

function NatalChartTable({ apiResult }) {
  const natal = apiResult?.natal_chart;
  if (!natal) return null;
  // 포스텔러·한국 만세력 표준 순서: 時 → 日 → 月 → 年 (좌→우)
  const pillars = [
    { key: 'hour', data: natal.hour, labelKey: 'saju.natal.pillar.hour' },
    { key: 'day', data: natal.day, labelKey: 'saju.natal.pillar.day' },
    { key: 'month', data: natal.month, labelKey: 'saju.natal.pillar.month' },
    { key: 'year', data: natal.year, labelKey: 'saju.natal.pillar.year' },
  ];
  const dist = apiResult?.element_distribution || {};
  const ELEMENTS = ['목', '화', '토', '금', '수'];

  return (
    <section className="saju-modal__natal-section" aria-label="사주 원국">
      <h4 className="saju-modal__natal-title">{ts('saju.natal.title')}</h4>
      <div className="saju-modal__natal">
        {pillars.map(({ key, data, labelKey }) => {
          const isDayMaster = key === 'day';
          if (!data) {
            return (
              <div
                key={key}
                className="saju-modal__natal-cell"
                data-pillar={key}
              >
                <span className="saju-modal__natal-header">{ts(labelKey)}</span>
                <span className="saju-modal__natal-kor">
                  {ts('saju.natal.hour.unknown')}
                </span>
              </div>
            );
          }
          const ganEl = elOfGan(data.gan);
          const jiEl = elOfJi(data.ji);
          return (
            <div
              key={key}
              className="saju-modal__natal-cell"
              data-pillar={key}
              data-day-master={isDayMaster ? 'true' : 'false'}
            >
              <span className="saju-modal__natal-header">{ts(labelKey)}</span>
              <div>
                <span className="saju-modal__natal-han" data-element={ganEl}>
                  {data.gan}
                </span>
                <span className="saju-modal__natal-kor">{toKor(data.gan)}</span>
              </div>
              <div>
                <span className="saju-modal__natal-han" data-element={jiEl}>
                  {data.ji}
                </span>
                <span className="saju-modal__natal-kor">{toKor(data.ji)}</span>
              </div>
              {data.sisung_gan && (
                data.sisung_gan === '日主' ? (
                  <span className="saju-modal__daymaster-marker">
                    {ts('saju.natal.dayMaster.label')}
                  </span>
                ) : (
                  <span
                    className="saju-modal__sisung-label"
                    title={ts(`saju.natal.sisung.${data.sisung_gan}.long`)}
                  >
                    {ts(`saju.natal.sisung.${data.sisung_gan}.short`) || data.sisung_gan}
                  </span>
                )
              )}
              {data.sisung_ji && (
                <span
                  className="saju-modal__sisung-label"
                  title={ts(`saju.natal.sisung.${data.sisung_ji}.long`)}
                >
                  {ts(`saju.natal.sisung.${data.sisung_ji}.short`) || data.sisung_ji}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {Object.keys(dist).length > 0 && (
        <div className="saju-modal__element-dist">
          <span className="saju-modal__element-dist-title">
            {ts('saju.natal.elementDistribution.title')}:
          </span>
          {ELEMENTS.map((el) => (
            <span key={el} className="saju-modal__element-chip" data-element={el}>
              {ts(`saju.element.${el}`) || el} {dist[el] ?? 0}
            </span>
          ))}
        </div>
      )}
      {/* P3: 억부용신 배지 — 원국 아래 */}
      <YongshinBadge apiResult={apiResult} />
    </section>
  );
}

function YongshinBadge({ apiResult }) {
  const y = apiResult?.yongshin;
  if (!y || !y.yongshin_element) return null;
  const singangLabel = ts(`saju.yongshin.sin_gang.${y.sin_gang || 'balanced'}`);
  const chips = [
    { key: 'yong', labelKey: 'saju.yongshin.label.yong', el: y.yongshin_element, role: y.yongshin_role },
    { key: 'hee', labelKey: 'saju.yongshin.label.hee', el: y.hee_shin_element, role: null },
    { key: 'ki', labelKey: 'saju.yongshin.label.ki', el: y.ki_shin_element, role: null },
  ].filter((c) => c.el);
  return (
    <div className="saju-modal__yongshin" role="group" aria-label="용신">
      <div className="saju-modal__yongshin-head">
        <span className="saju-modal__yongshin-title">🎯 {ts('saju.yongshin.title')}</span>
        <span
          className="saju-modal__yongshin-singang"
          title={ts('saju.yongshin.score.tooltip')}
        >
          {singangLabel} · {y.strength_score}점
        </span>
      </div>
      <div className="saju-modal__yongshin-row">
        {chips.map((c) => (
          <span key={c.key} className="saju-modal__yongshin-chip">
            <span className="saju-modal__yongshin-chip-label">{ts(c.labelKey)}</span>
            <span className="saju-modal__element-chip" data-element={c.el}>
              {ts(`saju.element.${c.el}`) || c.el}
            </span>
            {c.role && (
              <span className="saju-modal__yongshin-chip-label">
                ({ts(`saju.yongshin.role.${c.role}`) || c.role})
              </span>
            )}
          </span>
        ))}
      </div>
      {y.reasoning && (
        <p className="saju-modal__yongshin-reasoning" title={y.reasoning}>
          {y.reasoning}
        </p>
      )}
      <span className="saju-modal__yongshin-school">— {ts('saju.yongshin.school.eokbu')}</span>
    </div>
  );
}

function LimitationBanner({ apiResult, birthDate }) {
  const lims = apiResult?.limitations || [];
  if (!lims.includes('month_pillar_no_solar_term_correction')) return null;
  // 경계월 조건: birthDate.day 가 4~8 사이 (절기 경계일 근처)
  if (!birthDate) return null;
  const m = String(birthDate).match(/-(\d{2})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  if (day < 4 || day > 8) return null;
  return (
    <div className="saju-modal__limitation-banner" role="status">
      {ts('saju.warning.month_pillar.boundary')}
    </div>
  );
}

function SajuSetupModalImpl({ open, onClose, initialStep = 0 }) {
  const modalRef = useRef(null);
  const previouslyFocused = useRef(null);
  const [stepIdx, setStepIdx] = useState(initialStep);
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [apiResult, setApiResult] = useState(null); // { sections, summary, ... } | null
  const [resultLoading, setResultLoading] = useState(false);
  // 데모 모드: 백엔드 사주 기능 OFF (404/403/503) 상태에서도 4단계 끝까지 가볼 수 있게 fallback.
  // 한 번 진입하면 그 모달 세션 동안 후속 API 호출 모두 skip.
  const [demoMode, setDemoMode] = useState(false);

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

  // 모달이 열릴 때마다 initialStep 으로 초기화 + 임시 상태 클리어
  useEffect(() => {
    if (open) {
      setStepIdx(initialStep);
      setError(null);
      setSubmitting(false);
      setDemoMode(false);
      // result-only 진입(initialStep=3)이면 즉시 today fetch
      if (initialStep === 3) {
        loadTodayResult();
      } else {
        setApiResult(null);
      }
    }
    // loadTodayResult 는 stable deps — 아래에서 useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialStep]);

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

  // ─── API 핸들러 ───

  // step 1 → 2: POST /api/v1/saju/consent
  // 404/503 (백엔드 라우터 미설치·SAJU_ENABLED=false) 시 데모 모드로 전환 + step 진행
  const handleConsentSubmit = useCallback(async () => {
    if (demoMode) { goNext(); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api('/api/v1/saju/consent', {
        method: 'POST',
        body: JSON.stringify({ consent_version: CONSENT_VERSION, granted: true }),
      });
      if (res.status === 201 || res.status === 200) {
        goNext();
      } else if (res.status === 404 || res.status === 503) {
        setDemoMode(true);
        goNext();
      } else if (res.status === 401) {
        setError('login');
      } else {
        setError('consent');
      }
    } catch {
      setError('network');
    } finally {
      setSubmitting(false);
    }
  }, [goNext, demoMode]);

  // step 2 → 3: PUT /api/v1/saju/profile
  // 데모 모드면 호출 skip. 404/403/503 시에도 데모 모드 진입 + 진행.
  const handleProfileSubmit = useCallback(async () => {
    if (demoMode) { goNext(); return; }
    setSubmitting(true);
    setError(null);
    try {
      const genderMap = { female: 'FEMALE', male: 'MALE', unknown: 'UNKNOWN' };
      const payload = {
        birth_date: profile.birthDate,
        is_lunar: profile.calendar === 'lunar',
        is_leap_month: false,
        birth_time: profile.birthTime ? `${profile.birthTime}:00` : null,
        birth_time_accuracy: profile.birthTime ? 'exact' : 'unknown',
        gender: genderMap[profile.gender] || 'UNKNOWN',
      };
      const res = await api('/api/v1/saju/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        goNext();
      } else if (res.status === 404 || res.status === 503 || res.status === 403) {
        // 403 (consent 없음) 도 데모 모드의 일부 — 어차피 백엔드가 받지 않으므로
        setDemoMode(true);
        goNext();
      } else if (res.status === 401) {
        setError('login');
      } else {
        setError('profile');
      }
    } catch {
      setError('network');
    } finally {
      setSubmitting(false);
    }
  }, [profile, goNext, demoMode]);

  // step 3 → 4: GET /api/v1/saju/today?focus=&tone=
  // 200 → 실데이터 / 404 (no_profile) → demoMode + mock
  // 501 / 503 / 라우터 부재(404 라우터) → demoMode + mock
  // P4 부터는 정상 경로에서 200 + 실 sections 가 와야 함. mock 은 fallback only.
  const loadTodayResult = useCallback(async () => {
    if (demoMode) { setApiResult(null); return; }
    setResultLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        focus: calibration.focus || 'total',
        tone: calibration.tone || 'soft',
      }).toString();
      const res = await api(`/api/v1/saju/today?${qs}`);
      if (res.status === 200) {
        const data = await res.json();
        setApiResult(data);
      } else if (res.status === 501 || res.status === 404 || res.status === 503) {
        // 라우터 미설치 / 엔진 미구현 / SAJU_ENABLED=false / no_profile → 데모 모드
        setDemoMode(true);
        setApiResult(null);
      } else if (res.status === 401) {
        setError('login');
      } else {
        setError('today');
      }
    } catch {
      setError('network');
    } finally {
      setResultLoading(false);
    }
  }, [demoMode, calibration]);

  const handleCalibrationSubmit = useCallback(async () => {
    await loadTodayResult();
    goNext();
  }, [loadTodayResult, goNext]);

  // 결과 섹션 (백엔드 응답 우선, 없으면 mock fallback)
  const resultSections = useMemo(() => {
    if (apiResult?.sections?.length) {
      return apiResult.sections.map((s) => ({
        key: s.key,
        titleKey:
          BACKEND_SECTION_TITLE_KEY[s.key] ||
          `saju.modal.result.section.${s.key}`,
        body: s.body,
        why: s.reason || '엔진 분석 근거가 곧 제공돼요.',
      }));
    }
    return MOCK_RESULT.sections;
  }, [apiResult]);

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
          {/* 데모 모드 배너 (404/403/503 진입 후 모달 닫을 때까지 유지) */}
          {demoMode && (
            <div className="saju-modal__demo-banner" role="status">
              {ts('saju.modal.demo.banner')}
            </div>
          )}

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

          {/* Step 4: Result (백엔드 응답 우선, 501 시 mock fallback) */}
          {step === 'result' && (
            <div className="saju-modal__pane">
              {resultLoading ? (
                <p className="saju-modal__paragraph" role="status">
                  {ts('saju.modal.loading.result')}
                </p>
              ) : (
                <>
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
                  {/* P2.2: ① 오늘 일진 배지 (상단) */}
                  <TodayPillarBadge apiResult={apiResult} />
                  {/* ② 5섹션 (기존 메인 가치) */}
                  <div className="saju-modal__sections">
                    {resultSections.map((s) => (
                      <SectionCard key={s.key} titleKey={s.titleKey} body={s.body} why={s.why} />
                    ))}
                  </div>
                  {/* ③ 경계월 배너 (조건부) + 원국 표 (하단 참고) */}
                  <LimitationBanner apiResult={apiResult} birthDate={profile.birthDate} />
                  <NatalChartTable apiResult={apiResult} />
                  {/* ④ 안전 문구 */}
                  <p className="saju-modal__safety-notice">
                    {apiResult?.safety_notice || ts('saju.safety.notice')}
                  </p>
                </>
              )}
            </div>
          )}

          {/* 에러 배너 (모든 step 공통) */}
          {error && (
            <div className="saju-modal__error" role="alert">
              {ts(`saju.modal.error.${error}`)}
            </div>
          )}
        </div>

        <footer className="saju-modal__footer">
          {step === 'consent' && (
            <>
              <button type="button" className="saju-modal__btn saju-modal__btn--ghost" onClick={onClose} disabled={submitting}>
                {ts('saju.modal.close')}
              </button>
              <button
                type="button"
                className="saju-modal__btn saju-modal__btn--primary"
                onClick={handleConsentSubmit}
                disabled={submitting}
              >
                {submitting ? ts('saju.modal.submitting') : ts('saju.modal.consent.cta')}
              </button>
            </>
          )}
          {step === 'profile' && (
            <>
              <button type="button" className="saju-modal__btn saju-modal__btn--ghost" onClick={goBack} disabled={submitting}>
                {ts('saju.modal.back')}
              </button>
              <button
                type="button"
                className="saju-modal__btn saju-modal__btn--primary"
                onClick={handleProfileSubmit}
                disabled={!profileValid || submitting}
              >
                {submitting ? ts('saju.modal.submitting') : ts('saju.modal.next')}
              </button>
            </>
          )}
          {step === 'calibration' && (
            <>
              <button type="button" className="saju-modal__btn saju-modal__btn--ghost" onClick={goBack} disabled={resultLoading}>
                {ts('saju.modal.back')}
              </button>
              <button
                type="button"
                className="saju-modal__btn saju-modal__btn--primary"
                onClick={handleCalibrationSubmit}
                disabled={resultLoading}
              >
                {resultLoading ? ts('saju.modal.submitting') : ts('saju.modal.calibration.cta')}
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
