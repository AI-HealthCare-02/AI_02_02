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


def _pick_yongshin_for_weak(*, dm_el: str, counts: dict[str, int]) -> str:
    """신약: 일간을 도와주는 오행 중 현재 부족한 쪽.

    우선순위: 인수(生조) > 비겁(직접 보강).
    """
    in_el = next((k for k, v in _SHENG.items() if v == dm_el), "")
    bi_el = dm_el
    candidates = [in_el, bi_el]
    candidates = [c for c in candidates if c]
    return min(candidates, key=lambda el: (counts.get(el, 0), candidates.index(el)))


def _pick_yongshin_for_balanced(*, natal: dict, counts: dict[str, int]) -> str:
    """중화: 월지 계절 기준 조후 용신 + 현재 부족한 오행 교차.

    - 계절 조후가 이미 충분(2+)이면 5오행 중 결핍 오행 채택
    - 조후 오행이 부족하면 그대로 조후 오행 채택
    """
    month_pillar = natal.get("month") or {}
    month_ji = month_pillar.get("ji", "")
    season = _SEASON_BY_MONTH_JI.get(month_ji, "spring")
    season_el = _SEASON_YONGSHIN.get(season, "화")

    # 조후 오행이 부족하면 그대로
    if counts.get(season_el, 0) <= 1:
        return season_el

    # 이미 충분하면 전체 결핍 오행 (0개)
    empties = [el for el, n in counts.items() if n == 0]
    if empties:
        return empties[0]

    # 모두 있으면 가장 적은 것 선택
    return min(counts.keys(), key=lambda el: counts.get(el, 0))


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
        "hee_shin_element": "목",   # 희신 (용신을 生해주는 오행)
        "ki_shin_element": "수",    # 기신 (용신을 剋하는 오행)
        "reasoning": "강약 판정 근거 + 용신 선정 이유 (한국어 1~2문장)",
    }
    """
    day_master = natal.get("day_master", "")
    if day_master not in GAN_ELEMENT:
        return {
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

    dm_el = GAN_ELEMENT[day_master]
    strength = compute_strength_score(natal=natal)
    sin_gang = strength["sin_gang"]
    counts = _element_counts(natal)

    if sin_gang == "strong":
        yong_el = _pick_yongshin_for_strong(dm_el=dm_el, counts=counts)
    elif sin_gang == "weak":
        yong_el = _pick_yongshin_for_weak(dm_el=dm_el, counts=counts)
    else:
        yong_el = _pick_yongshin_for_balanced(natal=natal, counts=counts)

    # 희신: 용신을 生해주는 오행 (앞 오행 → 용신)
    hee_el = next((src for src, dst in _SHENG.items() if dst == yong_el), "")
    # 기신: 용신을 剋하는 오행 (용신을 극하는 것)
    ki_el = next((src for src, dst in _KE.items() if dst == yong_el), "")

    # 용신의 일간 기준 관계 (role 라벨)
    rel = _element_relation(dm_el, yong_el)
    yong_role = _REL_KOR.get(rel, "")

    # Reasoning 한국어
    comp = strength["components"]
    sin_gang_kor = {"strong": "신강", "weak": "신약", "balanced": "중화"}[sin_gang]
    sin_gang_desc = {
        "strong": "일간 기운이 강하므로 설기·제어하는 오행을 용신으로",
        "weak": "일간 기운이 약하므로 도와주는 오행을 용신으로",
        "balanced": "균형에 가깝기에 월지 계절 조후 오행을 용신으로",
    }[sin_gang]
    reasoning = (
        f"{sin_gang_kor}({strength['score']}점: 월령 {comp.get('myeongryeong', 0)}+"
        f"득지 {comp.get('deukji', 0)}+득세 {comp.get('deukse', 0)}). "
        f"{sin_gang_desc} 판정 → {yong_el}({yong_role}) 선정."
    )

    return {
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
