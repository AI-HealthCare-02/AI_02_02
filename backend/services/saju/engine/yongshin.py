"""용신(用神) 자동 판정 — 한국 현대 억부용신 (v2.7 P3).

학파: eokbu-korean-modern (抑扶用神, 한국 자평 현대 표준)
- 신강(身强) → 억(抑): 식상·관살·재성 중 부족한 오행을 용신으로
- 신약(身弱) → 부(扶): 인수·비겁 중 보강할 오행을 용신으로
- 중화(中和) → 조후(調候): 월지 계절 기준 결핍 오행을 용신으로

강약 판정 (strength_score):
- 월령(3점): 월지 오행이 일간의 인수(印)·비겁(比) 이면 +3 (계절 등·得令)
- 득지(2점): 일지가 인수·비겁이면 +2 (뿌리 得地)
- 득세(1점 × N): 8글자 중 일간 제외 인+비 개수 × 1 (세력 得勢)
- 총점 ≥ 7 → strong / ≤ 3 → weak / 4~6 → balanced

한계 (P3 단순화):
- 지지 장간 중기·여기 무시 (본기만) — 일반 만세력 관례
- 격국(格局)·용신 강약 미판정 — 단일 용신 오행만 반환
- 다학파 병치 미구현 — 학파별 해석은 P6+ 확장
"""

from __future__ import annotations

from typing import Literal

from backend.services.saju.engine.chart import GAN_ELEMENT, JI_ELEMENT
from backend.services.saju.engine.sisung import _element_relation

SCHOOL = "eokbu-korean-modern"
GUIDANCE_VERSION = "yongshin-guidance-v1"

SinGang = Literal["strong", "weak", "balanced"]

# 월지 계절 → 조후 용신 후보 오행 (중화 시 사용)
# 자평학 전통: 봄/겨울엔 火 (난방), 여름엔 水 (냉각), 가을엔 火 (鍊金)
_SEASON_BY_MONTH_JI: dict[str, str] = {
    "寅": "spring", "卯": "spring", "辰": "spring",
    "巳": "summer", "午": "summer", "未": "summer",
    "申": "autumn", "酉": "autumn", "戌": "autumn",
    "亥": "winter", "子": "winter", "丑": "winter",
}

# 계절별 조후 용신 오행 (전통 자평 표준)
_SEASON_YONGSHIN: dict[str, str] = {
    "spring": "화",  # 봄 木旺 → 火로 설기 + 따뜻함
    "summer": "수",  # 여름 火旺 → 水로 냉각
    "autumn": "화",  # 가을 金旺 → 火로 연금(鍊金) + 온기
    "winter": "화",  # 겨울 水寒 → 火로 해동(解凍)
}

# 오행 상생·상극 (chart.py/sisung.py 와 동일)
_SHENG: dict[str, str] = {
    "목": "화", "화": "토", "토": "금", "금": "수", "수": "목",
}
_KE: dict[str, str] = {
    "목": "토", "토": "수", "수": "화", "화": "금", "금": "목",
}

# 관계 → 한글 기능 라벨 (용신 reasoning 용)
_REL_KOR: dict[str, str] = {
    "same": "비겁",
    "toMe": "인수",
    "fromMe": "식상",
    "meCtrl": "재성",
    "ctrlMe": "관살",
}

_ELEMENT_GUIDE: dict[str, dict[str, str]] = {
    "목": {
        "symbol": "성장",
        "behavior": "방향을 세우고 작은 시작을 만드는 힘",
    },
    "화": {
        "symbol": "표현",
        "behavior": "생각을 말, 글, 콘텐츠, 행동으로 꺼내는 힘",
    },
    "토": {
        "symbol": "현실화",
        "behavior": "선택을 결과와 안정감으로 묶는 힘",
    },
    "금": {
        "symbol": "기준",
        "behavior": "흐름을 다듬고 약속, 구조, 책임으로 잡아주는 힘",
    },
    "수": {
        "symbol": "정리",
        "behavior": "관찰하고 쉬면서 다음 흐름을 준비하는 힘",
    },
}

_ROLE_GUIDE: dict[str, str] = {
    "비겁": "자기 주관과 동료성",
    "인수": "배움과 회복",
    "식상": "표현과 생산",
    "재성": "결과와 자원",
    "관살": "기준과 책임",
}


def _source_element(target_el: str) -> str:
    """target_el 을 생해주는 오행."""
    return next((src for src, dst in _SHENG.items() if dst == target_el), "")


def _month_geokguk(natal: dict | None) -> dict:
    """월지 중심 격국 안내용 요약.

    현재 엔진은 억부용신을 대표 계산값으로 쓰고 있으므로, 이 함수는 UI 설명을
    위한 보조 렌즈만 만든다. 기존 용신 판정 자체를 바꾸지 않는다.
    """
    month = (natal or {}).get("month") or {}
    month_ji = month.get("ji", "")
    month_role = month.get("sisung_ji") or month.get("sisung_gan") or ""
    month_el = JI_ELEMENT.get(month_ji, "")
    support_el = _source_element(month_el) if month_el else ""
    type_label = f"{month_role}격" if month_role else "월지 중심 구조"

    if month_el:
        reason = (
            f"월지 {month_ji}의 {month_role or month_el} 흐름을 중심으로 보며, "
            f"{support_el} 기운은 {month_el} 흐름을 받쳐주는 보조로 볼 수 있어요."
            if support_el
            else f"월지 {month_ji} 흐름을 중심으로 사주의 큰 구조를 살펴봅니다."
        )
    else:
        reason = "월지 정보가 부족해 격국 안내는 보조 참고로만 봅니다."

    return {
        "type": type_label,
        "element": month_el,
        "support_element": support_el,
        "summary": reason,
    }


def _johu_element(natal: dict | None) -> dict:
    """월지 계절 기준 조후 안내용 요약."""
    month_ji = ((natal or {}).get("month") or {}).get("ji", "")
    season = _SEASON_BY_MONTH_JI.get(month_ji, "")
    element = _SEASON_YONGSHIN.get(season, "")
    season_kr = {
        "spring": "봄",
        "summer": "여름",
        "autumn": "가을",
        "winter": "겨울",
    }.get(season, "")
    if element:
        summary = (
            f"{month_ji}월은 {season_kr} 흐름으로 보며, 조후 관점에서는 "
            f"{element} 기운이 온도감과 표현 방식을 조절하는 보조 역할을 합니다."
        )
    else:
        summary = "월지 계절 정보가 부족해 조후는 보조 참고로만 봅니다."
    return {"element": element, "season": season, "summary": summary}


def build_yongshin_guidance(*, yongshin: dict, natal: dict | None = None) -> dict:
    """오늘의 운세 UI 안내용 용신 설명.

    핵심 원칙:
    - 기존 `yongshin_element` 값을 바꾸지 않는다.
    - 억부/격국/조후/행동을 하나의 '정답'으로 합치지 않고 렌즈별로 분리한다.
    - 사용자는 대표 요약을 먼저 보고, 상세 근거는 펼쳐서 확인할 수 있게 한다.
    """
    yong_el = str(yongshin.get("yongshin_element") or "")
    hee_el = str(yongshin.get("hee_shin_element") or "")
    ki_el = str(yongshin.get("ki_shin_element") or "")
    yong_role = str(yongshin.get("yongshin_role") or "")
    reasoning = str(yongshin.get("reasoning") or "")

    geokguk = _month_geokguk(natal)
    johu = _johu_element(natal)
    johu_el = johu.get("element", "")
    representative_symbol = _ELEMENT_GUIDE.get(yong_el, {}).get("symbol", "균형")
    representative_behavior = _ELEMENT_GUIDE.get(yong_el, {}).get(
        "behavior", "오늘 참고할 균형 방향"
    )
    hee_behavior = _ELEMENT_GUIDE.get(hee_el, {}).get("behavior", "")
    johu_behavior = _ELEMENT_GUIDE.get(johu_el, {}).get("behavior", "")

    supporting_elements: list[dict[str, str]] = []
    if hee_el:
        supporting_elements.append({
            "key": "hee",
            "label": "희신",
            "element": hee_el,
            "summary": hee_behavior or "대표 용신을 도와주는 보조 기운입니다.",
        })
    if johu_el and johu_el != yong_el and all(item["element"] != johu_el for item in supporting_elements):
        supporting_elements.append({
            "key": "johu",
            "label": "조후 보조",
            "element": johu_el,
            "summary": johu_behavior or "계절감과 온도감을 조절하는 보조 기운입니다.",
        })

    if yong_el:
        headline = (
            f"{yong_el}의 {representative_symbol}을 중심으로 삼고, "
            f"{johu_el}의 표현 흐름을 보조로 쓰면 좋아요."
            if johu_el and johu_el != yong_el
            else f"{yong_el}의 {representative_symbol}을 중심으로 오늘의 선택을 정리해보세요."
        )
    else:
        headline = "용신 계산값이 부족해 오늘은 일반 운세 안내만 참고해주세요."

    if yong_el and johu_el and yong_el != johu_el:
        conflict_message = (
            f"억부 기준의 대표 용신은 {yong_el}이지만, 조후 관점에서는 {johu_el}가 함께 중요할 수 있어요. "
            "두 기준을 하나로 뭉개지 않고 역할을 나누어 보는 것이 안정적입니다."
        )
    else:
        conflict_message = (
            "여러 기준이 비슷한 방향을 가리키지만, 오늘 안내는 참고용 요약으로 봐주세요."
        )

    behavior_formula_parts = []
    behavior_formula_elements = set()
    if yong_el:
        behavior_formula_parts.append(f"{yong_el}의 {representative_symbol}")
        behavior_formula_elements.add(yong_el)
    if johu_el and johu_el != yong_el:
        behavior_formula_parts.append(f"{johu_el}의 표현")
        behavior_formula_elements.add(johu_el)
    if hee_el and hee_el not in behavior_formula_elements:
        hee_symbol = _ELEMENT_GUIDE.get(hee_el, {}).get("symbol", "보조")
        behavior_formula_parts.append(f"{hee_el}의 {hee_symbol}")
    behavior_formula = " → ".join(behavior_formula_parts) if behavior_formula_parts else "작게 정리하고 무리 없이 실행"

    daily_action = (
        f"오늘은 {representative_behavior}을 먼저 잡고, "
        f"{johu_behavior or '생각 하나를 밖으로 꺼내는 행동'}으로 작게 실행해보세요."
        if yong_el
        else "오늘은 결과를 단정하기보다, 작은 선택 하나를 차분히 정리해보세요."
    )

    return {
        "version": GUIDANCE_VERSION,
        "headline": headline,
        "representative": {
            "label": "대표 용신",
            "element": yong_el,
            "role": yong_role,
            "basis": "억부/전통 균형",
            "summary": (
                f"{yong_el}은 이 원국에서 {representative_behavior}으로 작동합니다."
                if yong_el
                else "대표 용신을 계산하기 위한 정보가 부족합니다."
            ),
        },
        "supporting_elements": supporting_elements,
        "perspectives": [
            {
                "key": "eokbu",
                "title": "억부",
                "element": yong_el,
                "summary": (
                    "사주의 강하고 약한 흐름을 살펴 균형이 필요한 부분을 보는 기준입니다."
                ),
                "reason": reasoning,
            },
            {
                "key": "geokguk",
                "title": "격국",
                "element": str(geokguk.get("element") or ""),
                "support_element": str(geokguk.get("support_element") or ""),
                "summary": str(geokguk.get("summary") or ""),
                "type": str(geokguk.get("type") or ""),
            },
            {
                "key": "johu",
                "title": "조후",
                "element": str(johu_el or ""),
                "summary": str(johu.get("summary") or ""),
            },
            {
                "key": "behavior",
                "title": "오늘의 사용법",
                "element": yong_el,
                "support_element": hee_el,
                "summary": f"{behavior_formula} 흐름으로 오늘의 선택을 정리해보세요.",
            },
        ],
        "conflict_notice": bool(yong_el and johu_el and yong_el != johu_el),
        "conflict_message": conflict_message,
        "daily_action": daily_action,
        "guardrail": (
            "이 안내는 재미와 자기이해를 위한 참고용입니다. 결과를 단정하지 말고 "
            "오늘의 태도와 선택을 정리하는 가이드로 활용해주세요."
        ),
        "caution_element": ki_el,
    }


def _score_myeongryeong(*, natal: dict, dm_el: str) -> int:
    """월령(月令): 월지 오행이 일간의 인수·비겁이면 3점, 아니면 0."""
    month_ji = (natal.get("month") or {}).get("ji", "")
    if month_ji and month_ji in JI_ELEMENT:
        rel = _element_relation(dm_el, JI_ELEMENT[month_ji])
        if rel in ("same", "toMe"):
            return 3
    return 0


def _score_deukji(*, natal: dict, dm_el: str) -> int:
    """득지(得地): 일지가 일간의 인수·비겁이면 2점, 아니면 0."""
    day_ji = (natal.get("day") or {}).get("ji", "")
    if day_ji and day_ji in JI_ELEMENT:
        rel = _element_relation(dm_el, JI_ELEMENT[day_ji])
        if rel in ("same", "toMe"):
            return 2
    return 0


def _score_deukse(*, natal: dict, dm_el: str) -> int:
    """득세(得勢): 8글자 중 일간 제외 인·비 개수."""
    count = 0
    for key in ("year", "month", "day", "hour"):
        p = natal.get(key)
        if not p:
            continue
        for target_key, table in (("gan", GAN_ELEMENT), ("ji", JI_ELEMENT)):
            if key == "day" and target_key == "gan":
                continue  # 일간 본인 제외
            t = p.get(target_key)
            if not t or t not in table:
                continue
            rel = _element_relation(dm_el, table[t])
            if rel in ("same", "toMe"):
                count += 1
    return count


def _label_sin_gang(score: int) -> SinGang:
    if score >= 7:
        return "strong"
    if score <= 3:
        return "weak"
    return "balanced"


def compute_strength_score(*, natal: dict) -> dict:
    """일간 강약 점수 산출 → {"score": int, "sin_gang": str, "components": dict}.

    - components["myeongryeong"]: 월령 (0 or 3)
    - components["deukji"]: 득지 (0 or 2)
    - components["deukse"]: 득세 (인+비 개수, 일간 제외)
    """
    day_master = natal.get("day_master", "")
    if day_master not in GAN_ELEMENT:
        return {"score": 0, "sin_gang": "balanced", "components": {}}

    dm_el = GAN_ELEMENT[day_master]
    myeongryeong = _score_myeongryeong(natal=natal, dm_el=dm_el)
    deukji = _score_deukji(natal=natal, dm_el=dm_el)
    deukse = _score_deukse(natal=natal, dm_el=dm_el)
    score = myeongryeong + deukji + deukse

    return {
        "score": score,
        "sin_gang": _label_sin_gang(score),
        "components": {
            "myeongryeong": myeongryeong,
            "deukji": deukji,
            "deukse": deukse,
        },
    }


def _element_counts(natal: dict) -> dict[str, int]:
    """natal 이 이미 element_distribution 를 품고 있으면 그걸, 아니면 재계산."""
    dist = natal.get("element_distribution")
    if isinstance(dist, dict) and dist:
        return dict(dist)
    counts = {e: 0 for e in ("목", "화", "토", "금", "수")}
    for key in ("year", "month", "day", "hour"):
        p = natal.get(key)
        if not p:
            continue
        gan = p.get("gan")
        ji = p.get("ji")
        if gan and gan in GAN_ELEMENT:
            counts[GAN_ELEMENT[gan]] += 1
        if ji and ji in JI_ELEMENT:
            counts[JI_ELEMENT[ji]] += 1
    return counts


def _pick_yongshin_for_strong(*, dm_el: str, counts: dict[str, int]) -> str:
    """신강: 일간 기운을 제어·설기할 오행 중 가장 부족한 쪽.

    우선순위: 식상(설기) > 관살(극제) > 재성(소모).
    동률이면 식상 > 관살 > 재성 순으로 채택.
    """
    # 식상 = dm 이 生하는 오행 / 관살 = dm 을 剋하는 오행 / 재성 = dm 이 剋하는 오행
    sik = _SHENG.get(dm_el, "")
    gwan = next((k for k, v in _KE.items() if v == dm_el), "")
    jae = _KE.get(dm_el, "")
    candidates = [sik, gwan, jae]
    candidates = [c for c in candidates if c]
    # 가장 개수 적은 것 우선 (결핍이면 꼭 보강)
    return min(candidates, key=lambda el: (counts.get(el, 0), candidates.index(el)))


def _is_extreme_weak(*, dm_el: str, counts: dict[str, int]) -> bool:
    """극신약 판정 — 재관식 ≥ 5 + 인수 ≤ 1.

    한국 현대 자평 다수 해석: 인수 1개로는 생조 부족 → 비겁으로 직접 보강 필요.
    일반 규칙으로 판단하며 특정 원국 하드코딩 아님.
    """
    insu_el = _role_to_element(dm_el, "인수")
    jae_el = _role_to_element(dm_el, "재성")
    gwan_el = _role_to_element(dm_el, "관살")
    sik_el = _role_to_element(dm_el, "식상")
    insu_cnt = counts.get(insu_el, 0) if insu_el else 0
    jae_gwan_sik = (
        (counts.get(jae_el, 0) if jae_el else 0)
        + (counts.get(gwan_el, 0) if gwan_el else 0)
        + (counts.get(sik_el, 0) if sik_el else 0)
    )
    return jae_gwan_sik >= 5 and insu_cnt <= 1


def _pick_yongshin_for_weak(*, dm_el: str, counts: dict[str, int]) -> tuple[str, str]:
    """신약: 기본 인수 우선, 극신약이면 비겁 직접 보강.

    일반 신약 (재관식 < 5): 인수 > 비겁 순. 인수 결핍 보완 + index tie-breaker.
    극신약 (재관식 ≥ 5, 인수 ≤ 1): 비겁에 +8 가산 → 비겁(일간 오행) 우선.

    반환: (yongshin_element, reason_tag) — reason_tag ∈ {"인수", "비겁", "극신약"}.
    """
    in_el = next((k for k, v in _SHENG.items() if v == dm_el), "")
    bi_el = dm_el
    candidates = [(in_el, "인수"), (bi_el, "비겁")]
    candidates = [(el, role) for el, role in candidates if el]
    if not candidates:
        return "", ""

    extreme = _is_extreme_weak(dm_el=dm_el, counts=counts)

    def score(idx: int, el: str, role: str) -> float:
        base = 10.0
        cnt = counts.get(el, 0)
        # 결핍 보완 — 0개 +10, 1개 +5
        if cnt == 0:
            base += 10
        elif cnt == 1:
            base += 5
        # 극신약 보정: 비겁에 +8 (인수만으로는 보강 부족)
        if extreme and role == "비겁":
            base += 8
        # tie-breaker: 앞 후보 우선
        base -= idx * 0.1
        return base

    scored = [(score(i, el, role), el, role) for i, (el, role) in enumerate(candidates)]
    scored.sort(key=lambda x: -x[0])
    _, chosen_el, chosen_role = scored[0]
    tag = "극신약" if (extreme and chosen_role == "비겁") else chosen_role
    return chosen_el, tag


# ──────────────────────────────────────────────
# 희신·기신 역할 기반 매핑 (v0.4 — 정통 용신학)
# ──────────────────────────────────────────────
# 용신 십성 역할별 희신 후보 (정통 자평 규범)
# 식상→재성 : 식상생재 / 재성→식상 : 식상생재 / 관살→재·인 : 재생관·관생인
# 인수→관·비 : 관생인·인비동맥 / 비겁→인·식 : 인생비 or 식상 설기
_HEE_CANDIDATES: dict[str, tuple[str, ...]] = {
    "식상": ("재성",),
    "재성": ("식상",),
    "관살": ("재성", "인수"),
    "인수": ("관살", "비겁"),
    "비겁": ("인수", "식상"),
}

# 용신 십성 역할별 주요 기신 (용신 역할을 파괴하는 오행)
# 식상←인수(인극식) / 재성←비겁(비극재) / 관살←식상(식극관)
# 인수←재성(재극인) / 비겁←관살(관극비)
_KI_CANDIDATES: dict[str, tuple[str, ...]] = {
    "식상": ("인수",),
    "재성": ("비겁",),
    "관살": ("식상",),
    "인수": ("재성",),
    "비겁": ("관살",),
}


def _role_to_element(dm_el: str, role: str) -> str:
    """일간 오행 + 십성 역할명 → 해당 오행 한 개 반환.

    - 비겁 = 일간 오행 자신
    - 인수 = 일간을 生하는 오행
    - 식상 = 일간이 生하는 오행
    - 재성 = 일간이 剋하는 오행
    - 관살 = 일간을 剋하는 오행
    """
    if role == "비겁":
        return dm_el
    if role == "인수":
        return next((src for src, dst in _SHENG.items() if dst == dm_el), "")
    if role == "식상":
        return _SHENG.get(dm_el, "")
    if role == "재성":
        return _KE.get(dm_el, "")
    if role == "관살":
        return next((src for src, dst in _KE.items() if dst == dm_el), "")
    return ""


def _score_hee_candidate(
    *, role_name: str, cand_el: str, counts: dict[str, int], sin_gang: str, order_idx: int
) -> float:
    """희신 후보 1개의 점수 산출 (클수록 희신 자격 ↑).

    - base 10
    - 원국 분포: 0개 +10 / 1개 +5 / 2개 0 / 3개+ -5 (결핍 보완 가산, 과잉 감점)
    - 일간 과잉 방지: 신강에서 인수·비겁 -10 / 신약에서 식상·재성·관살 -10
    - 후보 순서 tie-breaker: 앞 후보 우선 (-0.1 * idx)
    """
    score = 10.0
    cnt = counts.get(cand_el, 0)
    if cnt == 0:
        score += 10
    elif cnt == 1:
        score += 5
    elif cnt >= 3:
        score -= 5
    if sin_gang == "strong" and role_name in ("인수", "비겁"):
        score -= 10
    if sin_gang == "weak" and role_name in ("식상", "재성", "관살"):
        score -= 10
    score -= order_idx * 0.1
    return score


def _pick_hee_shin(
    *,
    dm_el: str,
    yong_el: str,
    yong_role: str,
    counts: dict[str, int],
    sin_gang: str,
) -> str:
    """역할 기반 희신 선정 + 원국 분포·강약 가중.

    후보가 없거나 모두 용신 자신과 겹치면 fallback: 용신을 生하는 오행.
    """
    role_priority = _HEE_CANDIDATES.get(yong_role, ())
    best_score = -999.0
    best_el = ""
    for idx, role_name in enumerate(role_priority):
        cand_el = _role_to_element(dm_el, role_name)
        if not cand_el or cand_el == yong_el:
            continue
        score = _score_hee_candidate(
            role_name=role_name,
            cand_el=cand_el,
            counts=counts,
            sin_gang=sin_gang,
            order_idx=idx,
        )
        if score > best_score:
            best_score = score
            best_el = cand_el
    if not best_el:
        best_el = next((src for src, dst in _SHENG.items() if dst == yong_el), "")
    return best_el


def _pick_ki_shin(
    *,
    dm_el: str,
    yong_el: str,
    yong_role: str,
    counts: dict[str, int],
    sin_gang: str = "balanced",
) -> str:
    """역할 기반 기신 선정 + 원국 과잉 가중 + 비겁 용신 특례.

    기본 후보: `_KI_CANDIDATES` 매핑. 원국에서 과(3+)한 오행일수록 위험 점수 ↑.

    특례 — 비겁 용신 + 신약 + 재성 과잉(≥3):
        정통 규범은 "비겁←관살(관극비)" 을 1순위로 보지만, 한국 현대 자평에서는
        신약 일간이 재성 과잉에 설기·극제당하는 구조에서 "재성 기신" 을 우선
        지목하는 해석이 다수. (예: 丁火 약 + 申申 재성 중첩 → 금이 불꽃을 꺼뜨림)
    후보가 없으면 fallback: 용신을 剋하는 오행.
    """
    role_priority = list(_KI_CANDIDATES.get(yong_role, ()))
    # 특례 — 비겁 용신 + 신약 + 재성 과잉 → 재성 기신 1순위로 승격
    if yong_role == "비겁" and sin_gang == "weak":
        jae_el = _role_to_element(dm_el, "재성")
        if jae_el and counts.get(jae_el, 0) >= 3 and "재성" not in role_priority:
            role_priority = ["재성", *role_priority]
    best_score = -999.0
    best_el = ""
    for idx, role_name in enumerate(role_priority):
        cand_el = _role_to_element(dm_el, role_name)
        if not cand_el or cand_el == yong_el:
            continue
        score = 10.0
        cnt = counts.get(cand_el, 0)
        if cnt >= 3:
            score += 10  # 이미 과함 → 기신 가능성 큼
        elif cnt == 2:
            score += 5
        score -= idx * 0.1
        if score > best_score:
            best_score = score
            best_el = cand_el
    if not best_el:
        best_el = next((src for src, dst in _KE.items() if dst == yong_el), "")
    return best_el


def _pick_yongshin_for_balanced(
    *, natal: dict, dm_el: str, counts: dict[str, int]
) -> tuple[str, str]:
    """중화: 월지 격신(식상·재성·관살) 우선, 없으면 계절 조후.

    한국 현대 자평 다수 해석 기준:
    - 월지 오행이 일간의 `fromMe(식상)` / `meCtrl(재성)` / `ctrlMe(관살)` 중 하나면
      **월지 오행을 용신(격신=용신)** 으로 채택. 자평진전·적천수 공통 관례.
    - 월지가 인수·비겁이면 조후 규칙으로 fallback (봄/겨울 화, 여름 수, 가을 화)
    - 조후 오행도 충분하면 분포 최소 오행

    반환: (yongshin_element, reason_tag) — reason_tag ∈ {"격신", "조후", "결핍"}.
    """
    month_pillar = natal.get("month") or {}
    month_ji = month_pillar.get("ji", "")
    month_ji_el = JI_ELEMENT.get(month_ji, "")

    # 1순위 — 월지가 식상/재성/관살 오행이면 격신 채택
    if month_ji_el:
        rel = _element_relation(dm_el, month_ji_el)
        if rel in ("fromMe", "meCtrl", "ctrlMe"):
            return month_ji_el, "격신"

    # 2순위 — 조후 (월지가 인수·비겁일 때만 진입)
    season = _SEASON_BY_MONTH_JI.get(month_ji, "spring")
    season_el = _SEASON_YONGSHIN.get(season, "화")
    if counts.get(season_el, 0) <= 1:
        return season_el, "조후"

    # 3순위 — 전체 결핍 오행
    empties = [el for el, n in counts.items() if n == 0]
    if empties:
        return empties[0], "결핍"

    # 모두 있으면 가장 적은 것
    return min(counts.keys(), key=lambda el: counts.get(el, 0)), "결핍"


def derive_yongshin_eokbu(*, natal: dict) -> dict:
    """한국 현대 억부용신 자동 판정.

    반환:
    {
        "school": "eokbu-korean-modern",
        "sin_gang": "strong" | "weak" | "balanced",
        "strength_score": int,
        "strength_components": {myeongryeong, deukji, deukse},
        "yongshin_element": "화",   # 용신 오행
        "yongshin_role": "식상",     # 일간 기준 관계 (비겁/인수/식상/재성/관살)
        "hee_shin_element": "목",   # 희신 — 용신 역할 + 원국 분포·강약 가중
        "ki_shin_element": "수",    # 기신 — 용신 역할을 파괴하는 오행 + 원국 과잉 가중
        "reasoning": "강약 판정 근거 + 용신 선정 이유 (한국어 1~2문장)",
    }
    """
    day_master = natal.get("day_master", "")
    if day_master not in GAN_ELEMENT:
        result = {
            "school": SCHOOL,
            "sin_gang": "balanced",
            "strength_score": 0,
            "strength_components": {},
            "yongshin_element": "",
            "yongshin_role": "",
            "hee_shin_element": "",
            "ki_shin_element": "",
            "reasoning": "일간 정보 부족 — 용신 판정 보류.",
        }
        result["guidance"] = build_yongshin_guidance(
            yongshin=result,
            natal=natal,
        )
        return result

    dm_el = GAN_ELEMENT[day_master]
    strength = compute_strength_score(natal=natal)
    sin_gang = strength["sin_gang"]
    counts = _element_counts(natal)

    balanced_reason_tag = ""
    weak_reason_tag = ""
    if sin_gang == "strong":
        yong_el = _pick_yongshin_for_strong(dm_el=dm_el, counts=counts)
    elif sin_gang == "weak":
        yong_el, weak_reason_tag = _pick_yongshin_for_weak(
            dm_el=dm_el, counts=counts
        )
    else:
        yong_el, balanced_reason_tag = _pick_yongshin_for_balanced(
            natal=natal, dm_el=dm_el, counts=counts
        )

    # 용신의 일간 기준 관계 (role 라벨) — 희·기신 계산 전에 필요
    rel = _element_relation(dm_el, yong_el)
    yong_role = _REL_KOR.get(rel, "")

    # 희신·기신 (v0.4.2): 용신 역할 + 원국 분포·강약 가중 + 비겁 용신 특례
    hee_el = _pick_hee_shin(
        dm_el=dm_el,
        yong_el=yong_el,
        yong_role=yong_role,
        counts=counts,
        sin_gang=sin_gang,
    )
    ki_el = _pick_ki_shin(
        dm_el=dm_el,
        yong_el=yong_el,
        yong_role=yong_role,
        counts=counts,
        sin_gang=sin_gang,
    )

    # Reasoning 한국어
    comp = strength["components"]
    sin_gang_kor = {"strong": "신강", "weak": "신약", "balanced": "중화"}[sin_gang]
    if sin_gang == "balanced":
        month_ji = (natal.get("month") or {}).get("ji", "")
        balanced_desc = {
            "격신": f"월지({month_ji})가 일간의 식상·재성·관살에 해당해 격신을 용신으로",
            "조후": "월지가 인수·비겁이라 계절 조후 오행을 용신으로",
            "결핍": "조후도 충분하기에 분포상 결핍된 오행을 용신으로",
        }.get(balanced_reason_tag, "균형에 가깝기에 월지 기준 용신 선정")
        sin_gang_desc = balanced_desc
    elif sin_gang == "weak":
        weak_desc = {
            "극신약": (
                "재관식 압박이 강하고 인수 보강만으로는 약해, "
                f"일간 {day_master}을(를) 직접 받치는 비겁을 용신으로"
            ),
            "인수": "일간을 생조하는 인수가 가장 부족해 그 오행을 용신으로",
            "비겁": "비겁이 결핍돼 일간을 직접 보강하는 비겁을 용신으로",
        }.get(weak_reason_tag, "일간 기운이 약하므로 도와주는 오행을 용신으로")
        sin_gang_desc = weak_desc
    else:
        sin_gang_desc = "일간 기운이 강하므로 설기·제어하는 오행을 용신으로"
    reasoning = (
        f"{sin_gang_kor}({strength['score']}점: 월령 {comp.get('myeongryeong', 0)}+"
        f"득지 {comp.get('deukji', 0)}+득세 {comp.get('deukse', 0)}). "
        f"{sin_gang_desc} 판정 → {yong_el}({yong_role}) 선정."
    )

    result = {
        "school": SCHOOL,
        "sin_gang": sin_gang,
        "strength_score": strength["score"],
        "strength_components": comp,
        "yongshin_element": yong_el,
        "yongshin_role": yong_role,
        "hee_shin_element": hee_el,
        "ki_shin_element": ki_el,
        "reasoning": reasoning,
    }
    result["guidance"] = build_yongshin_guidance(
        yongshin=result,
        natal=natal,
    )
    return result
