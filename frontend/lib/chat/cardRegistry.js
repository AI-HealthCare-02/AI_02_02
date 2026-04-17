/**
 * 우측 패널 카드 중앙 등록소 (CARD_REGISTRY)
 *
 * 향후 새 카드(혈압, 당 체크 등) 추가 시 이 배열 한 곳만 수정.
 * 순서 = 시간 흐름 (수면 → 식사 → 복약(A) → 운동 → 수분 → 기분 → 음주)
 *   · 백엔드 bundle_1~5,7 순서와 1:1 매핑
 *   · 복약은 bundle_2(아침식사)와 자연스럽게 결합 · A 그룹 전용
 */

import { t } from '@/lib/i18n/rightPanel.ko';

/**
 * @typedef {Object} UserCtx
 * @property {string[]} groups - 사용자 그룹 배열 (e.g. ['A'] · 향후 ['A','B'] 교차 가능)
 * @property {boolean} [isOffline]
 */

export const CARD_REGISTRY = [
  {
    key: 'sleep',
    emoji: '💤',
    marker: 'SL',
    nameKey: 'rightPanel.card.sleep.name',
    visibleFor: () => true,
  },
  {
    key: 'meal',
    emoji: '🍽️',
    marker: 'ME',
    nameKey: 'rightPanel.card.meal.name',
    visibleFor: () => true,
  },
  {
    key: 'medication',
    emoji: '💊',
    marker: 'MD',
    nameKey: 'rightPanel.card.medication.name',
    visibleFor: (ctx) => (ctx?.groups ?? []).includes('A'),
  },
  {
    key: 'exercise',
    emoji: '🏃',
    marker: 'EX',
    nameKey: 'rightPanel.card.exercise.name',
    visibleFor: () => true,
  },
  {
    key: 'water',
    emoji: '💧',
    marker: 'WA',
    nameKey: 'rightPanel.card.water.name',
    visibleFor: () => true,
  },
  {
    key: 'mood',
    emoji: '😊',
    marker: 'MO',
    nameKey: 'rightPanel.card.mood.name',
    visibleFor: () => true,
  },
  {
    key: 'alcohol',
    emoji: '🍷',
    marker: 'AL',
    nameKey: 'rightPanel.card.alcohol.name',
    visibleFor: () => true,
  },
];

/**
 * 사용자 맥락에 따라 보이는 카드만 필터링
 * @param {UserCtx} ctx
 */
export function getVisibleCards(ctx) {
  return CARD_REGISTRY.filter((c) => c.visibleFor(ctx));
}

/**
 * 미응답 모달용 카테고리 매핑 — cards와 같은 순서 · 같은 필터 적용
 * @param {UserCtx} ctx
 */
export function getVisibleMissedCategories(ctx) {
  return getVisibleCards(ctx).map((c) => ({
    key: c.key,
    emoji: c.emoji,
    name: t(c.nameKey),
  }));
}

/**
 * 그룹 정규화: onboarding/risk 응답에서 groups 배열 생성
 * 현재는 user_group 한 글자만 사용 · 향후 교차 그룹 대응 확장 지점
 */
export function normalizeGroups({ onboarding }) {
  const groups = [];
  if (onboarding?.user_group) groups.push(onboarding.user_group);
  return groups;
}
