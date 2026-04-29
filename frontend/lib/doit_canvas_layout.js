// frontend/lib/doit_canvas_layout.js
// Do it OS 캔버스 카드 배치 유틸 — 위치 알고리즘 (ESM)

/**
 * [min, max] 범위 내 정수 난수 반환
 */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 캔버스 경계 안으로 좌표를 클램프(제한)
 * @param {{ x, y, width, height, canvas, padding? }} opts
 * @returns {{ x, y }}
 */
export function clampToCanvas({ x, y, width, height, canvas, padding = 12 }) {
  const maxX = Math.max(canvas.width - width - padding, padding);
  const maxY = Math.max(canvas.height - height - padding, padding);
  return {
    x: Math.min(Math.max(x, padding), maxX),
    y: Math.min(Math.max(y, padding), maxY),
  };
}

/**
 * 두 사각형이 겹치는지 확인 (BoundingBox 직접 검사)
 */
export function rectsOverlap(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/**
 * 겹치지 않는 위치를 candidateCount 번 무작위 탐색 후 최적 반환.
 * 평가 기준: 겹침 없는 후보 중 기존 카드와의 최소 거리 최대화.
 * distFromCenter 패널티 제거 → 분포 편향(좌상단 수렴) 방지.
 * 카드 수에 따라 candidateCount 동적 증가.
 *
 * @param {{ canvas, existingCards, cardSize, padding?, candidateCount? }} opts
 * @returns {{ x, y }}
 */
export function nextNonOverlappingPosition({
  canvas,
  existingCards,
  cardSize,
  padding = 12,
  candidateCount = 30,
}) {
  // 캔버스가 카드를 담기에 너무 작으면 graceful 반환
  if (
    !canvas ||
    canvas.width < cardSize.width + padding * 2 ||
    canvas.height < cardSize.height + padding * 2
  ) {
    return { x: padding, y: padding };
  }

  const maxX = canvas.width - cardSize.width - padding;
  const maxY = canvas.height - cardSize.height - padding;

  // 카드가 많아질수록 candidateCount 증가 (충돌 회피 정확도 ↑)
  const dynamicCount = Math.min(60, Math.max(candidateCount, existingCards.length * 2));

  let best = null;
  let bestScore = -Infinity;
  let bestNonOverlapping = null;
  let bestNonOverlappingScore = -Infinity;

  for (let i = 0; i < dynamicCount; i++) {
    const cx = randInt(padding, maxX);
    const cy = randInt(padding, maxY);
    const candidate = { x: cx, y: cy, width: cardSize.width, height: cardSize.height };

    // BoundingBox 겹침 직접 검사 + 최소 중심 거리 계산
    let overlapping = false;
    let minDist = Infinity;

    for (const c of existingCards) {
      if (rectsOverlap(candidate, c)) {
        overlapping = true;
      }
      const dx = (cx + cardSize.width / 2) - (c.x + c.width / 2);
      const dy = (cy + cardSize.height / 2) - (c.y + c.height / 2);
      const d = Math.hypot(dx, dy);
      if (d < minDist) minDist = d;
    }

    // 첫 카드: 캔버스 대각선을 minDist 로 설정 (충분히 큰 값)
    if (existingCards.length === 0) minDist = Math.hypot(canvas.width, canvas.height);

    // 새 score: distFromCenter 패널티 제거 — 분포 균등화
    // overlapping 후보는 1e9 페널티 → 모두 겹칠 때만 fallback
    const score = overlapping ? minDist - 1e9 : minDist;

    if (score > bestScore) {
      bestScore = score;
      best = { x: cx, y: cy };
    }
    if (!overlapping && score > bestNonOverlappingScore) {
      bestNonOverlappingScore = score;
      bestNonOverlapping = { x: cx, y: cy };
    }
  }

  // 겹침 없는 후보가 있으면 그 중 best 반환, 모두 겹칠 때만 best fallback
  return bestNonOverlapping || best || { x: padding, y: padding };
}

/**
 * (0,0) 또는 null/NaN 좌표 카드를 일괄 재배치.
 * 카드 크기는 각 thought 의 width/height 사용 (없으면 200×120 기본값).
 * 원래 배열 순서(id 기준)를 유지해 반환한다.
 *
 * @param {Array<{ id, x, y, width?, height? }>} thoughts
 * @param {{ width, height }} canvas
 * @returns {Array}
 */
export function relayoutZeroCards(thoughts, canvas) {
  if (!canvas) return thoughts;

  const isStuck = (t) =>
    t.x === null ||
    t.y === null ||
    typeof t.x !== 'number' ||
    typeof t.y !== 'number' ||
    Number.isNaN(t.x) ||
    Number.isNaN(t.y) ||
    (t.x === 0 && t.y === 0);

  const fixed = thoughts.filter((t) => !isStuck(t));
  const stuck = thoughts.filter(isStuck);

  for (const t of stuck) {
    const cardSize = {
      width: typeof t.width === 'number' && t.width > 0 ? t.width : 200,
      height: typeof t.height === 'number' && t.height > 0 ? t.height : 120,
    };
    const pos = nextNonOverlappingPosition({
      canvas,
      existingCards: fixed,
      cardSize,
    });
    fixed.push({
      ...t,
      x: pos.x,
      y: pos.y,
      width: cardSize.width,
      height: cardSize.height,
    });
  }

  // 원래 순서 유지
  const byId = new Map(fixed.map((t) => [t.id, t]));
  return thoughts.map((t) => byId.get(t.id) || t);
}
