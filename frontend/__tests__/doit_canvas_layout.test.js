// frontend/__tests__/doit_canvas_layout.test.js
// doit_canvas_layout 단위 테스트 — Vitest

import { describe, it, expect } from 'vitest';
import {
  randInt,
  clampToCanvas,
  nextNonOverlappingPosition,
  relayoutZeroCards,
  rectsOverlap,
} from '../lib/doit_canvas_layout';

// ─── IoU 헬퍼 ────────────────────────────────────────────────────────────────
function iou(a, b) {
  const xL = Math.max(a.x, b.x);
  const xR = Math.min(a.x + a.width, b.x + b.width);
  const yT = Math.max(a.y, b.y);
  const yB = Math.min(a.y + a.height, b.y + b.height);
  if (xR <= xL || yB <= yT) return 0;
  const inter = (xR - xL) * (yB - yT);
  const ua = a.width * a.height + b.width * b.height - inter;
  return inter / ua;
}

// ─── rectsOverlap ────────────────────────────────────────────────────────────
describe('rectsOverlap', () => {
  it('겹치는 두 사각형 → true', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 50, y: 50, width: 100, height: 100 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it('딱 붙어 있지만 겹치지 않는 사각형 → false', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 100, y: 0, width: 100, height: 100 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('완전히 분리된 사각형 → false', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 200, y: 200, width: 100, height: 100 };
    expect(rectsOverlap(a, b)).toBe(false);
  });
});

// ─── randInt ─────────────────────────────────────────────────────────────────
describe('randInt', () => {
  it('범위 내 정수 반환', () => {
    for (let i = 0; i < 100; i++) {
      const v = randInt(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('min === max 이면 항상 그 값 반환', () => {
    for (let i = 0; i < 20; i++) {
      expect(randInt(7, 7)).toBe(7);
    }
  });
});

// ─── clampToCanvas ───────────────────────────────────────────────────────────
describe('clampToCanvas', () => {
  const canvas = { width: 800, height: 600 };
  const card = { width: 200, height: 120, canvas, padding: 12 };

  it('범위 안 좌표는 그대로', () => {
    const result = clampToCanvas({ x: 100, y: 100, ...card });
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it('범위 밖(음수) 좌표는 padding 으로 클램프', () => {
    const result = clampToCanvas({ x: -50, y: -50, ...card });
    expect(result.x).toBe(12);
    expect(result.y).toBe(12);
  });

  it('범위 밖(초과) 좌표는 maxX/maxY 로 클램프', () => {
    const result = clampToCanvas({ x: 9999, y: 9999, ...card });
    // maxX = 800 - 200 - 12 = 588, maxY = 600 - 120 - 12 = 468
    expect(result.x).toBe(588);
    expect(result.y).toBe(468);
  });

  it('카드보다 캔버스가 작으면 padding 좌표 반환', () => {
    const tinyCanvas = { width: 100, height: 100 };
    const result = clampToCanvas({ x: 0, y: 0, width: 200, height: 120, canvas: tinyCanvas, padding: 12 });
    // maxX = Math.max(100 - 200 - 12, 12) = 12
    expect(result.x).toBe(12);
    expect(result.y).toBe(12);
  });
});

// ─── nextNonOverlappingPosition ──────────────────────────────────────────────
describe('nextNonOverlappingPosition', () => {
  const canvas = { width: 1200, height: 800 };
  const cardSize = { width: 200, height: 120 };

  it('빈 캔버스에 첫 카드 — 정상 좌표 반환', () => {
    const pos = nextNonOverlappingPosition({ canvas, existingCards: [], cardSize });
    expect(pos).toBeDefined();
    expect(pos.x).toBeGreaterThanOrEqual(12);
    expect(pos.y).toBeGreaterThanOrEqual(12);
    expect(pos.x).toBeLessThanOrEqual(canvas.width - cardSize.width);
    expect(pos.y).toBeLessThanOrEqual(canvas.height - cardSize.height);
  });

  it('카드 1개 있을 때 추가 — 기존 카드와 중심 거리 충분', () => {
    const existingCards = [{ x: 100, y: 100, width: 200, height: 120 }];
    // 여러 번 시도해 안정성 확인
    for (let i = 0; i < 10; i++) {
      const pos = nextNonOverlappingPosition({ canvas, existingCards, cardSize, candidateCount: 50 });
      const newCenter = { x: pos.x + cardSize.width / 2, y: pos.y + cardSize.height / 2 };
      const oldCenter = { x: 200, y: 160 }; // 100+100, 100+60
      const dist = Math.hypot(newCenter.x - oldCenter.x, newCenter.y - oldCenter.y);
      // 최소한 카드 너비의 절반 이상 떨어져 있어야 함
      expect(dist).toBeGreaterThan(cardSize.width / 2);
    }
  });

  it('카드 50개 추가 — 모두 겹침 0 (IoU < 0.05)', () => {
    const placed = [];
    const cs = { width: 160, height: 100 };
    // 큰 캔버스에서 50개
    const bigCanvas = { width: 2400, height: 1600 };

    for (let i = 0; i < 50; i++) {
      const pos = nextNonOverlappingPosition({
        canvas: bigCanvas,
        existingCards: placed,
        cardSize: cs,
        candidateCount: 40,
      });
      placed.push({ x: pos.x, y: pos.y, width: cs.width, height: cs.height });
    }

    expect(placed).toHaveLength(50);

    // 모든 페어(50*49/2 = 1225 쌍) IoU 검사
    let maxIou = 0;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const v = iou(placed[i], placed[j]);
        if (v > maxIou) maxIou = v;
      }
    }
    // 알고리즘 특성상 완전 겹침은 없어야 함 (허용: 0.05 미만)
    expect(maxIou).toBeLessThan(0.05);
  });

  it('캔버스 너무 작으면 graceful — throw 없이 padding 좌표 반환', () => {
    const smallCanvas = { width: 100, height: 100 };
    const bigCard = { width: 200, height: 120 };
    let pos;
    expect(() => {
      pos = nextNonOverlappingPosition({
        canvas: smallCanvas,
        existingCards: [],
        cardSize: bigCard,
      });
    }).not.toThrow();
    expect(pos.x).toBe(12);
    expect(pos.y).toBe(12);
  });
});

// ─── relayoutZeroCards ───────────────────────────────────────────────────────
describe('relayoutZeroCards', () => {
  const canvas = { width: 1000, height: 700 };

  it('(0,0) 카드만 재배치, 정상 카드는 유지', () => {
    const thoughts = [
      { id: 'a', x: 300, y: 200, width: 200, height: 120 }, // 정상
      { id: 'b', x: 0, y: 0, width: 200, height: 120 },    // stuck
    ];
    const result = relayoutZeroCards(thoughts, canvas);
    // 정상 카드 위치 불변
    expect(result.find(t => t.id === 'a').x).toBe(300);
    expect(result.find(t => t.id === 'a').y).toBe(200);
    // stuck 카드는 (0,0) 이 아닌 다른 곳으로
    const b = result.find(t => t.id === 'b');
    expect(b.x === 0 && b.y === 0).toBe(false);
  });

  it('null 좌표 카드도 재배치', () => {
    const thoughts = [
      { id: 'c', x: null, y: null, width: 200, height: 120 },
    ];
    const result = relayoutZeroCards(thoughts, canvas);
    const c = result[0];
    expect(typeof c.x).toBe('number');
    expect(typeof c.y).toBe('number');
    expect(Number.isNaN(c.x)).toBe(false);
  });

  it('NaN 좌표도 재배치', () => {
    const thoughts = [
      { id: 'd', x: NaN, y: NaN, width: 200, height: 120 },
    ];
    const result = relayoutZeroCards(thoughts, canvas);
    const d = result[0];
    expect(Number.isNaN(d.x)).toBe(false);
    expect(Number.isNaN(d.y)).toBe(false);
  });

  it('재배치 후 원래 순서 유지 (id 기준)', () => {
    const thoughts = [
      { id: 'e1', x: 0, y: 0, width: 200, height: 120 },
      { id: 'e2', x: 400, y: 300, width: 200, height: 120 },
      { id: 'e3', x: 0, y: 0, width: 200, height: 120 },
      { id: 'e4', x: 200, y: 100, width: 200, height: 120 },
    ];
    const result = relayoutZeroCards(thoughts, canvas);
    // 순서 유지
    expect(result[0].id).toBe('e1');
    expect(result[1].id).toBe('e2');
    expect(result[2].id).toBe('e3');
    expect(result[3].id).toBe('e4');
    // 정상 카드 위치 불변
    expect(result[1].x).toBe(400);
    expect(result[3].x).toBe(200);
  });

  it('canvas null 이면 그대로 반환', () => {
    const thoughts = [{ id: 'f', x: 0, y: 0 }];
    const result = relayoutZeroCards(thoughts, null);
    expect(result).toEqual(thoughts);
  });

  it('width/height 없는 카드는 기본값(200×120) 적용', () => {
    const thoughts = [{ id: 'g', x: 0, y: 0 }];
    const result = relayoutZeroCards(thoughts, canvas);
    const g = result[0];
    expect(g.width).toBe(200);
    expect(g.height).toBe(120);
  });
});

// ─── 200카드 분포 균등성 ──────────────────────────────────────────────────────
describe('200카드 분포 균등성', () => {
  it('200카드 4사분면 분포 균등 (각 사분면 35-65)', () => {
    const canvas = { width: 1920, height: 1080 };
    const cardSize = { width: 240, height: 140 };
    const cards = [];

    for (let i = 0; i < 200; i++) {
      const pos = nextNonOverlappingPosition({ canvas, existingCards: cards, cardSize });
      cards.push({ x: pos.x, y: pos.y, width: cardSize.width, height: cardSize.height });
    }

    expect(cards).toHaveLength(200);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const q = [0, 0, 0, 0];
    for (const c of cards) {
      const idx = (c.x + c.width / 2 < cx ? 0 : 1) + (c.y + c.height / 2 < cy ? 0 : 2);
      q[idx]++;
    }

    // 각 사분면 35~65 사이 (이상적 50, 30% 편차 허용)
    for (const v of q) {
      expect(v).toBeGreaterThanOrEqual(35);
      expect(v).toBeLessThanOrEqual(65);
    }
  }, 15000); // 200카드 계산 타임아웃 15초
});
