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

// 처음 방문자: "내가 어떤 사람인가" → "올해 흐름" → "이달" → "오늘" 순.
// 재방문자: 이미 자기 기질·연운은 봤으므로 "오늘" 탭이 먼저, 나머지는 참고 순.
const RESULT_TABS_FIRST_VISIT = [
  { key: 'natal', labelKey: 'saju.reading.tabs.natal' },
  { key: 'yearly', labelKey: 'saju.reading.tabs.yearly' },
  { key: 'monthly', labelKey: 'saju.reading.tabs.monthly' },
  { key: 'today', labelKey: 'saju.reading.tabs.today' },
];
const RESULT_TABS_RETURNING = [
  { key: 'today', labelKey: 'saju.reading.tabs.today' },
  { key: 'natal', labelKey: 'saju.reading.tabs.natal' },
  { key: 'monthly', labelKey: 'saju.reading.tabs.monthly' },
  { key: 'yearly', labelKey: 'saju.reading.tabs.yearly' },
];

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

const GENDER_TO_FORM = {
  FEMALE: 'female',
  MALE: 'male',
  UNKNOWN: 'unknown',
};

function normalizeTimeForInput(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

function formatBirthTime(value, accuracy) {
  const normalized = normalizeTimeForInput(value);
  if (!normalized || accuracy === 'unknown') return ts('saju.profile.time.unknown');
  return normalized;
}

function formatGender(value) {
  const formValue = GENDER_TO_FORM[value] || 'unknown';
  return ts(`saju.modal.profile.gender.${formValue}`);
}

function normalizeSajuError(detail, fallback) {
  if (!detail) return fallback;
  const key = `saju.modal.error.${detail}`;
  const message = ts(key);
  return message === key ? fallback : message;
}

function SectionCard({ titleKey, title, body, why, easySummary }) {
  const [open, setOpen] = useState(false);
  const resolvedTitle = title || ts(titleKey);
  return (
    <div className="saju-modal__section">
      <div className="saju-modal__section-title">{resolvedTitle}</div>
      <div className="saju-modal__section-body">{body}</div>
      {easySummary && (
        <div className="saju-modal__section-easy">
          <span className="saju-modal__section-easy-label">{ts('saju.reading.easy_summary.prefix')}</span>
          <span className="saju-modal__section-easy-body">{easySummary}</span>
        </div>
      )}
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

function DailyScoreBadge({ apiResult }) {
  if (!apiResult || typeof apiResult.daily_score !== 'number') return null;
  const score = Math.max(0, Math.min(100, Math.round(apiResult.daily_score)));
  const kind = apiResult.day_relation?.kind || 'same';
  // 100점 환산 상대 레벨 — 텍스트 라벨만 (절대 수치 기반 의료·재무 판단 금지 원칙)
  const tierLabel =
    score >= 75 ? ts('saju.daily.score.tier.high')
    : score >= 55 ? ts('saju.daily.score.tier.mid_high')
    : score >= 45 ? ts('saju.daily.score.tier.mid')
    : score >= 30 ? ts('saju.daily.score.tier.low')
    : ts('saju.daily.score.tier.caution');
  return (
    <div
      className="saju-modal__score-badge"
      data-tier={
        score >= 75 ? 'high' : score >= 55 ? 'mid_high' : score >= 45 ? 'mid' : score >= 30 ? 'low' : 'caution'
      }
      data-relation={kind}
      role="group"
      aria-label={`오늘의 참고 지수 ${score}점`}
    >
      <div className="saju-modal__score-badge-ring" aria-hidden="true">
        <span className="saju-modal__score-badge-num">{score}</span>
        <span className="saju-modal__score-badge-unit">/100</span>
      </div>
      <div className="saju-modal__score-badge-meta">
        <div className="saju-modal__score-badge-title">
          {ts('saju.daily.score.title')}
        </div>
        <div className="saju-modal__score-badge-tier">{tierLabel}</div>
        <div className="saju-modal__score-badge-hint">
          {ts('saju.daily.score.hint')}
        </div>
      </div>
    </div>
  );
}

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

function YongshinGuidanceCard({ apiResult }) {
  const guidance = apiResult?.yongshin?.guidance;
  if (!guidance?.headline) return null;

  const representative = guidance.representative || {};
  const supporting = Array.isArray(guidance.supporting_elements)
    ? guidance.supporting_elements.filter((item) => item?.element)
    : [];
  const perspectives = Array.isArray(guidance.perspectives)
    ? guidance.perspectives.filter((item) => item?.title || item?.summary)
    : [];
  const cautionElement = guidance.caution_element || '';
  const renderElement = (element) => {
    if (!element) return null;
    return (
      <span className="saju-modal__element-chip" data-element={element}>
        {ts(`saju.element.${element}`) || element}
      </span>
    );
  };

  return (
    <section className="saju-modal__yongshin-guide" aria-label={ts('saju.yongshin.guidance.title')}>
      <div className="saju-modal__yongshin-guide-head">
        <div>
          <span className="saju-modal__yongshin-guide-eyebrow">
            {ts('saju.yongshin.guidance.title')}
          </span>
          <h4 className="saju-modal__yongshin-guide-title">{guidance.headline}</h4>
        </div>
        <span className="saju-modal__yongshin-guide-badge">
          {ts('saju.yongshin.guidance.badge')}
        </span>
      </div>

      <div className="saju-modal__yongshin-guide-flow">
        {representative.element && (
          <div className="saju-modal__yongshin-guide-node" data-role="representative">
            <span className="saju-modal__yongshin-guide-node-label">
              {representative.label || ts('saju.yongshin.guidance.representative')}
            </span>
            <div className="saju-modal__yongshin-guide-node-main">
              {renderElement(representative.element)}
              {representative.role && (
                <span className="saju-modal__yongshin-guide-role">
                  {ts(`saju.yongshin.role.${representative.role}`) || representative.role}
                </span>
              )}
            </div>
            {representative.summary && (
              <p className="saju-modal__yongshin-guide-node-copy">{representative.summary}</p>
            )}
          </div>
        )}

        {supporting.map((item) => (
          <div key={`${item.key}-${item.element}`} className="saju-modal__yongshin-guide-node">
            <span className="saju-modal__yongshin-guide-node-label">
              {item.label || ts('saju.yongshin.guidance.support')}
            </span>
            <div className="saju-modal__yongshin-guide-node-main">
              {renderElement(item.element)}
              {item.element === cautionElement && (
                <span className="saju-modal__yongshin-guide-caution">
                  {ts('saju.yongshin.guidance.caution')}
                </span>
              )}
            </div>
            {item.summary && (
              <p className="saju-modal__yongshin-guide-node-copy">{item.summary}</p>
            )}
          </div>
        ))}
      </div>

      {guidance.conflict_notice && guidance.conflict_message && (
        <div className="saju-modal__yongshin-guide-notice">
          <strong>{ts('saju.yongshin.guidance.conflict')}</strong>
          <span>{guidance.conflict_message}</span>
        </div>
      )}

      {perspectives.length > 0 && (
        <div className="saju-modal__yongshin-guide-perspectives">
          <div className="saju-modal__yongshin-guide-subtitle">
            {ts('saju.yongshin.guidance.perspectives')}
          </div>
          {perspectives.map((item) => (
            <div key={item.key || item.title} className="saju-modal__yongshin-guide-perspective">
              <div className="saju-modal__yongshin-guide-perspective-head">
                <span>{item.title}</span>
                <span className="saju-modal__yongshin-guide-perspective-elements">
                  {renderElement(item.element)}
                  {item.support_element && renderElement(item.support_element)}
                </span>
              </div>
              {item.summary && (
                <p className="saju-modal__yongshin-guide-perspective-copy">{item.summary}</p>
              )}
              {item.reason && (
                <p className="saju-modal__yongshin-guide-perspective-reason">{item.reason}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {guidance.daily_action && (
        <div className="saju-modal__yongshin-guide-action">
          <strong>{ts('saju.yongshin.guidance.action')}</strong>
          <span>{guidance.daily_action}</span>
        </div>
      )}

      {guidance.guardrail && (
        <p className="saju-modal__yongshin-guide-guardrail">{guidance.guardrail}</p>
      )}
    </section>
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
          const renderSisungLabel = (name) => {
            if (!name) return null;
            if (name === '日主') {
              return (
                <span className="saju-modal__daymaster-marker">
                  {ts('saju.natal.dayMaster.label')}
                </span>
              );
            }
            const shortLabel = ts(`saju.natal.sisung.${name}.short`);
            const hasShort = shortLabel && shortLabel !== `saju.natal.sisung.${name}.short`;
            return (
              <span
                className="saju-modal__sisung-label"
                title={ts(`saju.natal.sisung.${name}.long`)}
              >
                {hasShort ? `${name}(${shortLabel})` : name}
              </span>
            );
          };
          return (
            <div
              key={key}
              className="saju-modal__natal-cell"
              data-pillar={key}
              data-day-master={isDayMaster ? 'true' : 'false'}
            >
              <span className="saju-modal__natal-header">{ts(labelKey)}</span>
              {/* 천간 줄 + 바로 아래 십성 라벨 (시각 매칭) */}
              <div className="saju-modal__natal-han-row">
                <span className="saju-modal__natal-han" data-element={ganEl}>
                  {data.gan}
                </span>
                <span className="saju-modal__natal-kor">{toKor(data.gan)}</span>
              </div>
              <div className="saju-modal__natal-sisung-row">
                {renderSisungLabel(data.sisung_gan)}
              </div>
              {/* 지지 줄 + 바로 아래 십성 라벨 */}
              <div className="saju-modal__natal-han-row">
                <span className="saju-modal__natal-han" data-element={jiEl}>
                  {data.ji}
                </span>
                <span className="saju-modal__natal-kor">{toKor(data.ji)}</span>
              </div>
              <div className="saju-modal__natal-sisung-row">
                {renderSisungLabel(data.sisung_ji)}
              </div>
            </div>
          );
        })}
      </div>
      {/* 오행 색상 범례 — 위 천간·지지의 글자 색상이 무엇을 의미하는지 안내 */}
      <div className="saju-modal__element-legend" role="group" aria-label="오행 색상 안내">
        <span className="saju-modal__element-dist-title">
          {ts('saju.natal.elementLegend.title')}:
        </span>
        {ELEMENTS.map((el) => (
          <span key={el} className="saju-modal__element-chip" data-element={el}>
            {ts(`saju.element.${el}`) || el}
          </span>
        ))}
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

function ProfileBasisCard({
  accountProfile,
  savedProfile,
  editableTime = false,
  timeDraft = '',
  timeUnknown = false,
  onTimeChange,
  onUnknownChange,
  onTimeSave,
  timeSaving = false,
  timeDisabled = false,
}) {
  const [timeEditorOpen, setTimeEditorOpen] = useState(false);
  const birthDate = savedProfile?.birth_date || accountProfile?.birthday || '';
  const gender = savedProfile?.gender || accountProfile?.gender || '';
  const calendar = savedProfile?.is_lunar ? ts('saju.modal.profile.calendar.lunar') : ts('saju.modal.profile.calendar.solar');
  const birthTime = savedProfile
    ? formatBirthTime(savedProfile.birth_time, savedProfile.birth_time_accuracy)
    : ts('saju.profile.time.not_created');
  const hasRequiredBase = Boolean(birthDate && gender);
  const canEditTime = Boolean(editableTime && savedProfile && !timeDisabled);
  const saveDisabled = timeSaving || !canEditTime || (!timeUnknown && !timeDraft);
  const handleTimeSave = async () => {
    if (!onTimeSave || saveDisabled) return;
    const ok = await onTimeSave();
    if (ok !== false) setTimeEditorOpen(false);
  };

  return (
    <section className="saju-modal__profile-lock" aria-label={ts('saju.profile.lock.title')}>
      <div className="saju-modal__profile-lock-head">
        <div>
          <span className="saju-modal__profile-lock-eyebrow">
            {ts('saju.profile.lock.eyebrow')}
          </span>
          <h4 className="saju-modal__profile-lock-title">
            {ts('saju.profile.lock.title')}
          </h4>
        </div>
      </div>
      <div className="saju-modal__profile-lock-grid">
        <div className="saju-modal__profile-lock-cell">
          <span>{ts('saju.modal.profile.birthDate.label')}</span>
          <strong>{birthDate || ts('saju.profile.lock.missing')}</strong>
        </div>
        <div className="saju-modal__profile-lock-cell">
          <span>{ts('saju.modal.profile.gender.label')}</span>
          <strong>{gender ? formatGender(gender) : ts('saju.profile.lock.missing')}</strong>
        </div>
        <div className="saju-modal__profile-lock-cell">
          <span>{ts('saju.modal.profile.calendar.label')}</span>
          <strong>{calendar}</strong>
        </div>
        {canEditTime ? (
          <button
            type="button"
            className="saju-modal__profile-lock-cell saju-modal__profile-lock-cell--button"
            aria-expanded={timeEditorOpen}
            onClick={() => setTimeEditorOpen((v) => !v)}
          >
            <span>{ts('saju.modal.profile.birthTime.label')}</span>
            <strong>{birthTime}</strong>
            <em>{ts('saju.profile.time.inline.hint')}</em>
          </button>
        ) : (
          <div className="saju-modal__profile-lock-cell">
            <span>{ts('saju.modal.profile.birthTime.label')}</span>
            <strong>{birthTime}</strong>
          </div>
        )}
      </div>
      {canEditTime && timeEditorOpen && (
        <div className="saju-modal__profile-time-inline" aria-label={ts('saju.profile.time.inline.title')}>
          <div className="saju-modal__time-row">
            <input
              type="time"
              className="saju-modal__input"
              value={timeDraft}
              onChange={(e) => onTimeChange?.(e.target.value)}
              disabled={timeUnknown || timeSaving}
            />
            <label className="saju-modal__check">
              <input
                type="checkbox"
                checked={timeUnknown}
                onChange={(e) => onUnknownChange?.(e.target.checked)}
                disabled={timeSaving}
              />
              {ts('saju.modal.profile.birthTime.unknown')}
            </label>
            <button
              type="button"
              className="saju-modal__btn saju-modal__btn--primary saju-modal__profile-time-save"
              onClick={handleTimeSave}
              disabled={saveDisabled}
            >
              {timeSaving ? ts('saju.profile.time.saving') : ts('saju.profile.time.save')}
            </button>
          </div>
          <p>{savedProfile?.time_accuracy_notice || ts('saju.profile.time.notice')}</p>
        </div>
      )}
      <p className="saju-modal__profile-lock-copy">
        {ts('saju.profile.lock.copy')}
      </p>
      {!hasRequiredBase && (
        <p className="saju-modal__profile-lock-warning">
          {ts('saju.profile.lock.accountMissing')}
        </p>
      )}
    </section>
  );
}

function NatalReadingPane({
  reading,
  loading,
  todayResult,
}) {
  const chartSource = todayResult || reading;
  const yongshinSource = reading || todayResult;
  const birthDate = chartSource?.profile?.birth_date || '';
  return (
    <>
      <YongshinGuidanceCard apiResult={yongshinSource} />
      <ReadingPane reading={reading} loading={loading} />
      <LimitationBanner apiResult={chartSource} birthDate={birthDate} />
      <NatalChartTable apiResult={chartSource} />
    </>
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

function ReadingHero({ reading }) {
  if (!reading) return null;
  const keywords = Array.isArray(reading.keywords) ? reading.keywords.filter(Boolean) : [];
  return (
    <section className="saju-modal__reading-hero" aria-label={reading.title}>
      <div className="saju-modal__reading-badge">
        {ts('saju.reading.badge.reference')}
      </div>
      <h3 className="saju-modal__reading-title">{reading.title}</h3>
      <p className="saju-modal__reading-summary">{reading.summary}</p>
      {keywords.length > 0 && (
        <div className="saju-modal__reading-keywords" aria-label="리딩 키워드">
          {keywords.map((keyword) => (
            <span key={keyword} className="saju-modal__reading-keyword">
              {keyword}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * 리딩 섹션 renderer — key 별로 다른 레이아웃 (P4.2, easy_summary·why toggle 제거).
 * - lead: 큰 리드 박스
 * - keywords: pill 그룹 (hero keywords 와 중복이라 body 만 자연스럽게)
 * - checklist: bullet 리스트
 * 그 외: ReadingSectionCard — 제목 이모지 + body 한 덩어리
 */

// 섹션 key → 제목 이모지 (풀리딩 scan 용 시각 고정점)
const READING_SECTION_EMOJI = {
  // natal
  lead: '🌙',
  core_traits: '🌿',
  contradiction: '🔀',
  strengths: '⭐',
  cautions: '⚠️',
  relation: '🤝',
  work: '🛠',
  recovery: '🧘',
  closing: '🍃',
  // yearly
  year_flow: '🌀',
  year_role: '🧭',
  natal_contact: '🔗',
  keywords: '🏷',
  opportunities: '✨',
  career: '💼',
  money: '💠',
  health: '🌱',
  learning: '📘',
  half_year_strategy: '🗓',
  monthly_digest: '📌',
  checklist: '✅',
  // monthly
  monthly_overview: '📅',
  best_month: '🚀',
  caution_month: '🌙',
  pattern_summary: '🔁',
};

function LeadSection({ section }) {
  return (
    <section className="saju-modal__reading-lead" aria-label={section.title}>
      <div className="saju-modal__reading-lead-title">{section.title}</div>
      <p className="saju-modal__reading-lead-body">{section.body}</p>
    </section>
  );
}

function normalizeReadingEasySummary(value) {
  return String(value || '').replace(/^쉽게 말하면[,，:]?\s*/, '').trim();
}

function ReadingBody({ body }) {
  const blocks = String(body || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) return null;

  return (
    <div className="saju-modal__reading-section-body">
      {blocks.map((block, idx) => {
        const match = block.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (!match) {
          return (
            <p key={idx} className="saju-modal__reading-section-paragraph">
              {block}
            </p>
          );
        }
        return (
          <p key={idx} className="saju-modal__reading-section-paragraph">
            <span className="saju-modal__reading-section-subhead">{match[1]}</span>
            {match[2]}
          </p>
        );
      })}
    </div>
  );
}

function ReadingSectionCard({ section }) {
  const emoji = READING_SECTION_EMOJI[section.key] || '';
  const easySummary = normalizeReadingEasySummary(section.easy_summary);
  return (
    <div className="saju-modal__reading-section">
      <h4 className="saju-modal__reading-section-title">
        {emoji && <span className="saju-modal__reading-section-emoji" aria-hidden="true">{emoji}</span>}
        {section.title}
      </h4>
      <ReadingBody body={section.body} />
      {easySummary && (
        <div className="saju-modal__reading-easy">
          <span className="saju-modal__reading-easy-label">
            {ts('saju.reading.easy_summary.prefix')}
          </span>
          <span className="saju-modal__reading-easy-body">{easySummary}</span>
        </div>
      )}
    </div>
  );
}

function ChecklistSection({ section }) {
  const raw = section.body || '';
  const items = raw
    .split('•')
    .map((s) => s.trim())
    .filter(Boolean);
  const [intro, ...rest] = items;
  const emoji = READING_SECTION_EMOJI[section.key] || '✅';
  return (
    <div className="saju-modal__reading-section saju-modal__reading-section--checklist">
      <h4 className="saju-modal__reading-section-title">
        <span className="saju-modal__reading-section-emoji" aria-hidden="true">{emoji}</span>
        {section.title}
      </h4>
      {intro && <p className="saju-modal__reading-section-body">{intro}</p>}
      {rest.length > 0 && (
        <ul className="saju-modal__checklist">
          {rest.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReadingPane({ reading, loading }) {
  if (loading && !reading) {
    return (
      <p className="saju-modal__paragraph" role="status">
        {ts('saju.reading.loading')}
      </p>
    );
  }
  if (!reading) {
    return (
      <p className="saju-modal__paragraph">
        {ts('saju.reading.empty')}
      </p>
    );
  }

  // 섹션 key → 특수 renderer (easy_summary·why toggle 없음)
  const renderSection = (section) => {
    if (section.key === 'lead') return <LeadSection key={section.key} section={section} />;
    if (section.key === 'checklist') return <ChecklistSection key={section.key} section={section} />;
    return <ReadingSectionCard key={section.key} section={section} />;
  };

  return (
    <>
      <ReadingHero reading={reading} />
      <div className="saju-modal__sections">
        {(reading.sections || []).map(renderSection)}
      </div>
    </>
  );
}

function MonthFlowCard({ month }) {
  const [open, setOpen] = useState(false);
  const score = Math.max(0, Math.min(100, Math.round(month.score || 0)));
  const tier = score >= 78 ? 'good' : score >= 66 ? 'safe' : score >= 54 ? 'neutral' : 'caution';
  const evidence = Array.isArray(month.evidence) ? month.evidence.filter(Boolean) : [];
  const actionHints = Array.isArray(month.action_hints) ? month.action_hints.filter(Boolean) : [];
  const domains = month.domain_readings || {};
  const domainItems = [
    ['work', '일', domains.work],
    ['money', '돈', domains.money],
    ['relation', '관계', domains.relation],
    ['health', '건강', domains.health],
  ].filter(([, , value]) => value);
  return (
    <article className="saju-modal__month-card" data-tier={tier}>
      <button
        type="button"
        className="saju-modal__month-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <strong>{month.label}</strong>
          <small>{month.title}</small>
        </span>
        <span className="saju-modal__month-score">{score}</span>
      </button>
      <div className="saju-modal__month-tags" aria-label="월간 월지 십성">
        {month.ganji && <span>{month.ganji}</span>}
        {month.stem_ten_god && <span>월간 {month.stem_ten_god}</span>}
        {month.branch_ten_god && <span>월지 {month.branch_ten_god}</span>}
      </div>
      <p className="saju-modal__month-summary">{month.summary}</p>
      {open && (
        <div className="saju-modal__month-detail">
          <p>{month.detail}</p>
          {evidence.length > 0 && (
            <div className="saju-modal__month-evidence">
              <strong>{ts('saju.month.evidence.title')}</strong>
              <ul>
                {evidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {domainItems.length > 0 && (
            <div className="saju-modal__month-domain-grid">
              {domainItems.map(([key, label, value]) => (
                <div key={key}>
                  <strong>{label}</strong>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          )}
          {actionHints.length > 0 && (
            <div className="saju-modal__month-actions">
              <strong>{ts('saju.month.action.title')}</strong>
              {actionHints.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function MonthlyReadingPane({ reading, loading }) {
  if (loading && !reading) {
    return (
      <p className="saju-modal__paragraph" role="status">
        {ts('saju.reading.loading')}
      </p>
    );
  }
  if (!reading) {
    return (
      <p className="saju-modal__paragraph">
        {ts('saju.reading.empty')}
      </p>
    );
  }
  return (
    <>
      <ReadingHero reading={reading} />
      <div className="saju-modal__sections">
        {(reading.sections || []).map((section) => (
          section.key === 'lead'
            ? <LeadSection key={section.key} section={section} />
            : <ReadingSectionCard key={section.key} section={section} />
        ))}
      </div>
      <div className="saju-modal__monthly-grid" aria-label="12개월 흐름">
        {(reading.months || []).map((month) => (
          <MonthFlowCard key={month.month} month={month} />
        ))}
      </div>
    </>
  );
}

function SajuSetupModalImpl({
  open,
  onClose,
  initialStep = 0,
  hasProfile = false,
  sajuProfile = null,
  prefetchedToday = null,
}) {
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
  const [accountProfile, setAccountProfile] = useState(null);
  const [savedProfile, setSavedProfile] = useState(sajuProfile);
  const [timeDraft, setTimeDraft] = useState(normalizeTimeForInput(sajuProfile?.birth_time));
  const [timeUnknown, setTimeUnknown] = useState(!sajuProfile?.birth_time);
  const [timeSaving, setTimeSaving] = useState(false);
  const [calibration, setCalibration] = useState({
    focus: 'total',
    tone: 'soft',
  });
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [apiResult, setApiResult] = useState(null); // { sections, summary, ... } | null
  const [resultLoading, setResultLoading] = useState(false);
  // 재방문이면 '오늘' 우선 노출, 처음이면 '나의 기질' 우선
  const resultTabs = useMemo(
    () => (hasProfile ? RESULT_TABS_RETURNING : RESULT_TABS_FIRST_VISIT),
    [hasProfile],
  );
  const defaultResultTabKey = resultTabs[0].key;
  const [activeResultTab, setActiveResultTab] = useState(defaultResultTabKey);
  const [profilePopoverOpen, setProfilePopoverOpen] = useState(false);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readings, setReadings] = useState({
    natal: null,
    yearly: null,
    monthly: null,
  });
  // 데모 모드: 백엔드 사주 기능 OFF (404/403/503) 상태에서도 4단계 끝까지 가볼 수 있게 fallback.
  // 한 번 진입하면 그 모달 세션 동안 후속 API 호출 모두 skip.
  const [demoMode, setDemoMode] = useState(false);

  const syncProfileForm = useCallback((account, saved) => {
    const birthDate = saved?.birth_date || account?.birthday || '';
    const gender = saved?.gender || account?.gender || 'UNKNOWN';
    const birthTime = normalizeTimeForInput(saved?.birth_time);
    const accuracy = saved?.birth_time_accuracy || (birthTime ? 'exact' : 'unknown');
    setProfile({
      birthDate,
      calendar: saved?.is_lunar ? 'lunar' : 'solar',
      gender: GENDER_TO_FORM[gender] || 'unknown',
      birthTime,
      birthTimeUnknown: !birthTime || accuracy === 'unknown',
    });
    setTimeDraft(birthTime);
    setTimeUnknown(!birthTime || accuracy === 'unknown');
  }, []);

  const loadAccountAndProfile = useCallback(async () => {
    try {
      const [userRes, profileRes] = await Promise.all([
        api('/api/v1/users/me'),
        api('/api/v1/saju/profile'),
      ]);
      const account = userRes.ok ? await userRes.json() : null;
      const saved = profileRes.ok ? await profileRes.json() : null;
      setAccountProfile(account);
      setSavedProfile(saved);
      syncProfileForm(account, saved);
    } catch {
      setAccountProfile(null);
      setSavedProfile(sajuProfile || null);
      syncProfileForm(null, sajuProfile || null);
    }
  }, [sajuProfile, syncProfileForm]);

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
      setTimeSaving(false);
      setProfilePopoverOpen(false);
      setDemoMode(false);
      setActiveResultTab(defaultResultTabKey);
      setReadings({ natal: null, yearly: null, monthly: null });
      loadAccountAndProfile();
      // result-only 진입(initialStep=3): prefetch 가 있으면 즉시 표시 + readings 백그라운드 로드,
      // 없으면 원래대로 today fetch (loadTodayResult 가 readings 까지 챙김).
      if (initialStep === 3) {
        if (prefetchedToday) {
          setApiResult(prefetchedToday);
          // demoMode 가 직전 세션의 stale 값(true)이면 loadReadings 가 빈 결과 반환하므로 prefetch 시점은 정상 백엔드라는 점을 신뢰. demoMode 가 false 인 케이스에서만 호출.
          if (!demoMode) loadReadings();
        } else {
          loadTodayResult();
        }
      } else {
        setApiResult(null);
      }
    }
    // loadTodayResult / loadReadings 는 useCallback 으로 안정화되어 있고,
    // prefetchedToday 는 의도적으로 deps 에서 제외 — open 시점 한 번만 캡처해
    // 모달이 열린 상태에서 prefetch 가 늦게 도착해도 mid-modal 재실행을 막는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialStep, defaultResultTabKey, loadAccountAndProfile]);

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
    const birthDate = savedProfile?.birth_date || accountProfile?.birthday || profile.birthDate;
    const gender = savedProfile?.gender || accountProfile?.gender;
    return demoMode || Boolean(birthDate && gender);
  }, [accountProfile, demoMode, profile.birthDate, savedProfile]);

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
      const payload = {
        birth_time: profile.birthTime ? `${profile.birthTime}:00` : null,
        birth_time_accuracy: profile.birthTime ? 'exact' : 'unknown',
      };
      const res = await api('/api/v1/saju/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedProfile(data);
        syncProfileForm(accountProfile, data);
        goNext();
      } else if (res.status === 404 || res.status === 503 || res.status === 403) {
        // 403 (consent 없음) 도 데모 모드의 일부 — 어차피 백엔드가 받지 않으므로
        setDemoMode(true);
        goNext();
      } else if (res.status === 401) {
        setError('login');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'profile');
      }
    } catch {
      setError('network');
    } finally {
      setSubmitting(false);
    }
  }, [accountProfile, profile.birthTime, goNext, demoMode, syncProfileForm]);

  const loadReadings = useCallback(async () => {
    if (demoMode) {
      setReadings({ natal: null, yearly: null, monthly: null });
      return;
    }
    setReadingLoading(true);
    try {
      const fetchReading = async (period, extra = '') => {
        const res = await api(`/api/v1/saju/reading?period=${period}${extra}`);
        if (!res.ok) return null;
        return await res.json();
      };
      const [natal, yearly, monthly] = await Promise.all([
        fetchReading('natal'),
        fetchReading('yearly', '&year=2026'),
        fetchReading('monthly', '&year=2026'),
      ]);
      setReadings({ natal, yearly, monthly });
    } catch {
      // 리딩 API 실패가 오늘 운세 자체를 막으면 안 됨. 탭 안에서 빈 상태만 보여준다.
      setReadings((prev) => prev);
    } finally {
      setReadingLoading(false);
    }
  }, [demoMode]);

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
        await loadReadings();
      } else if (res.status === 501 || res.status === 404 || res.status === 503) {
        // 라우터 미설치 / 엔진 미구현 / SAJU_ENABLED=false / no_profile → 데모 모드
        setDemoMode(true);
        setApiResult(null);
        setReadings({ natal: null, yearly: null, monthly: null });
        setActiveResultTab('today');
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
  }, [demoMode, calibration, loadReadings]);

  const handleBirthTimeSave = useCallback(async () => {
    if (!savedProfile || demoMode) return false;
    setTimeSaving(true);
    setError(null);
    try {
      const payload = {
        birth_time: timeUnknown || !timeDraft ? null : `${timeDraft}:00`,
        birth_time_accuracy: timeUnknown || !timeDraft ? 'unknown' : 'exact',
      };
      const res = await api('/api/v1/saju/profile/time', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || 'time');
        return false;
      }
      setSavedProfile(data);
      syncProfileForm(accountProfile, data);
      await loadTodayResult();
      return true;
    } catch {
      setError('network');
      return false;
    } finally {
      setTimeSaving(false);
    }
  }, [
    accountProfile,
    demoMode,
    loadTodayResult,
    savedProfile,
    syncProfileForm,
    timeDraft,
    timeUnknown,
  ]);

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
              <ProfileBasisCard accountProfile={accountProfile} savedProfile={savedProfile} />

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
                  {savedProfile?.time_accuracy_notice || ts('saju.modal.profile.birthTime.hint')}
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
                  <div className="saju-modal__result-top">
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
                      <button
                        type="button"
                        className="saju-modal__profile-info-trigger"
                        aria-expanded={profilePopoverOpen}
                        onClick={() => setProfilePopoverOpen((v) => !v)}
                      >
                        {ts('saju.profile.info.button')}
                      </button>
                    </div>
                    {profilePopoverOpen && (
                      <div className="saju-modal__profile-popover" role="dialog" aria-label={ts('saju.profile.info.button')}>
                        <ProfileBasisCard
                          accountProfile={accountProfile}
                          savedProfile={savedProfile}
                          editableTime
                          timeDraft={timeDraft}
                          timeUnknown={timeUnknown}
                          onTimeChange={(value) => {
                            setTimeDraft(value);
                            setTimeUnknown(false);
                          }}
                          onUnknownChange={(checked) => {
                            setTimeUnknown(checked);
                            if (checked) setTimeDraft('');
                          }}
                          onTimeSave={handleBirthTimeSave}
                          timeSaving={timeSaving}
                          timeDisabled={!savedProfile}
                        />
                      </div>
                    )}
                  </div>

                  <nav className="saju-modal__reading-tabs" aria-label="사주 리딩 탭">
                    {resultTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={`saju-modal__reading-tab ${activeResultTab === tab.key ? 'is-active' : ''}`}
                        aria-pressed={activeResultTab === tab.key}
                        onClick={() => setActiveResultTab(tab.key)}
                      >
                        {ts(tab.labelKey)}
                      </button>
                    ))}
                  </nav>

                  <div className="saju-modal__reading-panel">
                    {activeResultTab === 'natal' && (
                      <NatalReadingPane
                        reading={readings.natal}
                        loading={readingLoading}
                        todayResult={apiResult}
                      />
                    )}
                    {activeResultTab === 'yearly' && (
                      <ReadingPane reading={readings.yearly} loading={readingLoading} />
                    )}
                    {activeResultTab === 'monthly' && (
                      <MonthlyReadingPane reading={readings.monthly} loading={readingLoading} />
                    )}
                    {activeResultTab === 'today' && (
                      <>
                        {/* P4.1: ⓪ 오늘의 참고 지수 (100점 만점) — 오늘 탭 상단 요약 */}
                        <DailyScoreBadge apiResult={apiResult} />
                        {/* P2.2: ① 오늘 일진 배지 */}
                        <TodayPillarBadge apiResult={apiResult} />
                        {/* ② 5섹션 (기존 오늘 운세 가치) */}
                        <div className="saju-modal__sections">
                          {resultSections.map((s) => (
                            <SectionCard key={s.key} titleKey={s.titleKey} body={s.body} why={s.why} />
                          ))}
                        </div>
                        <p className="saju-modal__today-link-hint">
                          {ts('saju.today.natalLinkHint')}
                        </p>
                      </>
                    )}
                  </div>

                  {/* 안전 문구 */}
                  <p className="saju-modal__safety-notice">
                    {readings[activeResultTab]?.safety_notice || apiResult?.safety_notice || ts('saju.safety.notice')}
                  </p>
                </>
              )}
            </div>
          )}

          {/* 에러 배너 (모든 step 공통) */}
          {error && (
            <div className="saju-modal__error" role="alert">
              {normalizeSajuError(error, ts('saju.modal.error.profile'))}
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
