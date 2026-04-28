"""오늘 일진 + natal 일간 관계 (v2.7 P3).

규칙 (자평 사주 기본):
- 합(合): 갑己·을庚·병辛·정壬·무癸 천간합 (조화·정리)
- 충(沖): 갑庚·을辛·병壬·정癸·무甲·기乙·경丙·신丁·임戊·계己 천간충 (변동·전환)
- 생(生): 일간 오행이 오늘 일간 오행을 생함 (도움 받음 / 줌)
- 극(剋): 오행이 서로 극하는 관계 (긴장)
- 비화(比和): 같은 오행 (안정·유지)

해석에 쓰일 핵심 keys:
- relation: 'harmony' | 'clash' | 'support' | 'pressure' | 'same'
- intensity: 'strong' | 'medium' | 'mild'
- focus_hint: 어느 섹션에 영향이 큰지 ('total', 'money', ...)
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from backend.services.saju.engine.chart import (
    GAN_ELEMENT,
    sexagenary_for_day,
)

RelationKind = Literal["harmony", "clash", "support", "pressure", "same"]
Intensity = Literal["strong", "medium", "mild"]

# 천간 합 (서로 묶이는 5쌍)
_GAN_HE: set[frozenset[str]] = {
    frozenset({"甲", "己"}),
    frozenset({"乙", "庚"}),
    frozenset({"丙", "辛"}),
    frozenset({"丁", "壬"}),
    frozenset({"戊", "癸"}),
}

# 천간 충 (서로 부딪치는 4쌍 — 戊己 는 토라 충 없음)
_GAN_CHONG: set[frozenset[str]] = {
    frozenset({"甲", "庚"}),
    frozenset({"乙", "辛"}),
    frozenset({"丙", "壬"}),
    frozenset({"丁", "癸"}),
}

# 오행 상생 (앞 → 뒤 생함)
_SHENG: dict[str, str] = {
    "목": "화", "화": "토", "토": "금", "금": "수", "수": "목",
}

# 오행 상극 (앞 → 뒤 극함)
_KE: dict[str, str] = {
    "목": "토", "토": "수", "수": "화", "화": "금", "금": "목",
}

# 관계 → 섹션 강조 매핑 (calibration focus 와 별개로 자연스러운 강조)
GAN_RELATION: dict[RelationKind, dict] = {
    "harmony": {"intensity": "strong", "focus_hint": "total"},   # 합: 새 흐름 받기 좋음
    "same": {"intensity": "medium", "focus_hint": "work"},       # 비화: 안정·집중
    "support": {"intensity": "medium", "focus_hint": "health"},  # 생: 도움받음
    "pressure": {"intensity": "medium", "focus_hint": "money"},  # 극: 절제·정리
    "clash": {"intensity": "strong", "focus_hint": "oneThing"},  # 충: 변동·마무리
}


def today_pillar(today: date | None = None) -> dict:
    """오늘 일주 60갑자 + 천간/지지/오행 정보 반환.

    today=None 이면 시스템 오늘 (Asia/Seoul 가정 — 호출 측에서 KST 보정 가능).
    """
    if today is None:
        today = date.today()
    gan, ji = sexagenary_for_day(today)
    return {
        "date": today,
        "gan": gan,
        "ji": ji,
        "pillar": gan + ji,
        "gan_element": GAN_ELEMENT[gan],
    }


def derive_day_relation(*, day_master: str, today_gan: str) -> dict:
    """natal 일간 vs 오늘 일간 관계 산출.

    반환:
    {
        "kind": "harmony" | "clash" | "support" | "pressure" | "same",
        "intensity": "strong" | "medium" | "mild",
        "focus_hint": "total" | "work" | ...,
        "day_master_element": "목",
        "today_element": "수",
    }
    """
    if day_master not in GAN_ELEMENT or today_gan not in GAN_ELEMENT:
        # 안전 fallback (계산 깨졌을 때)
        return {
            "kind": "same",
            "intensity": "mild",
            "focus_hint": "total",
            "day_master_element": GAN_ELEMENT.get(day_master, ""),
            "today_element": GAN_ELEMENT.get(today_gan, ""),
        }

    pair = frozenset({day_master, today_gan})
    dm_element = GAN_ELEMENT[day_master]
    today_element = GAN_ELEMENT[today_gan]

    kind: RelationKind
    if pair in _GAN_HE:
        kind = "harmony"
    elif pair in _GAN_CHONG:
        kind = "clash"
    elif dm_element == today_element:
        kind = "same"
    elif _SHENG.get(today_element) == dm_element:
        # 오늘 오행이 본인 오행을 생함 → 도움
        kind = "support"
    elif _SHENG.get(dm_element) == today_element:
        # 본인이 오늘 오행을 생함 → 기 빠짐 (단순화: support 의 약 버전)
        kind = "support"
    elif _KE.get(today_element) == dm_element or _KE.get(dm_element) == today_element:
        kind = "pressure"
    else:
        kind = "same"

    meta = GAN_RELATION[kind]
    return {
        "kind": kind,
        "intensity": meta["intensity"],
        "focus_hint": meta["focus_hint"],
        "day_master_element": dm_element,
        "today_element": today_element,
    }
