"""오늘의 운세 5섹션 템플릿 (v2.7 P3).

생성 입력:
- relation: {kind, intensity, focus_hint, day_master_element, today_element}
- focus: total | money | health | work | relation (calibration)
- tone: soft | real | short

출력 5섹션:
- total / money / health / work / one_thing
- 각 섹션: { key, title, body, reason }

Barnum 방지:
- relation kind 5종 × tone 3종 = 15 변형 per 섹션 base
- focus 가 매칭되는 섹션은 추가 디테일 1줄 부착
- 본인 일간 오행 + 오늘 오행 명시 (사주적 디테일)

금지 표현 (CRITICAL):
- "병이 생깁니다", "반드시 합격합니다", "큰돈을 벌 수 있습니다", "반드시 헤어집니다",
  진단/처방/치료/완치/사망 등 단정 의료/법률/투자/관계 표현
"""

from __future__ import annotations

from typing import Literal

TEMPLATE_VERSION = "v1.0"

DEFAULT_SAFETY_NOTICE = (
    "이 내용은 재미와 자기이해를 위한 참고용 운세입니다. "
    "중요한 결정은 전문가나 실제 상황을 기준으로 판단해주세요."
)

ToneLiteral = Literal["soft", "real", "short"]
FocusLiteral = Literal["total", "money", "health", "work", "relation"]
RelationKindLiteral = Literal["harmony", "clash", "support", "pressure", "same"]

# ─────────────────────────────────────────────
# 섹션 body — relation × tone 매트릭스
# ─────────────────────────────────────────────

# 형식: _BODY[section][relation_kind][tone]
_BODY: dict[str, dict[str, dict[str, str]]] = {
    "total": {
        "harmony": {
            "soft": "오늘은 새로운 흐름을 받아들이기 좋은 날이에요. 무리해서 시작하기보다 평소 리듬을 점검하면 좋아요.",
            "real": "흐름이 우호적인 날입니다. 새 일을 시도하기 전에 기존 페이스를 점검해두면 효율이 잘 살아나요.",
            "short": "흐름 우호적. 페이스 점검부터.",
        },
        "clash": {
            "soft": "오늘은 작은 변동이 느껴질 수 있는 날이에요. 큰 결심보다 마무리·정리에 무게를 두면 안정돼요.",
            "real": "변동성이 있는 날입니다. 큰 결단보다 마무리 작업이 잘 맞아요.",
            "short": "변동 있음. 마무리 위주로.",
        },
        "support": {
            "soft": "오늘은 누군가의 도움이 살짝 더 잘 닿는 흐름이에요. 혼자 끙끙대기보다 작은 부탁도 가볍게.",
            "real": "지원받기 좋은 날입니다. 도움 요청을 미루지 않는 편이 효율적이에요.",
            "short": "지원 흐름. 도움 요청 OK.",
        },
        "pressure": {
            "soft": "오늘은 절제가 어울리는 흐름이에요. 욕심을 살짝 줄이면 마음이 가벼워져요.",
            "real": "절제·정리가 잘 맞는 날입니다. 욕심을 줄이는 쪽이 효율적이에요.",
            "short": "절제 흐름. 욕심 줄이기.",
        },
        "same": {
            "soft": "오늘은 평소 리듬이 잘 유지되는 날이에요. 큰 변화보다 일상의 흐름에 집중하면 좋아요.",
            "real": "리듬 안정형 하루입니다. 일상 루틴 유지가 가장 효율적이에요.",
            "short": "안정 흐름. 루틴 유지.",
        },
    },
    "money": {
        "harmony": {
            "soft": "큰 결정보다 작은 정리가 어울리는 흐름이에요. 카드 사용·구독 정리 같은 작은 결심이 도움 돼요.",
            "real": "재물은 작은 정리가 잘 맞는 날. 구독·소비 패턴 점검에 시간을 쓰는 편이 이득이에요.",
            "short": "작은 정리 OK. 큰 결정 보류.",
        },
        "clash": {
            "soft": "지출이나 결제가 평소보다 잘 보이는 날이에요. 큰 구매는 한 박자 미뤄두면 좋아요.",
            "real": "지출·결제 변동이 보이는 날. 큰 구매·계약은 하루 미루는 편이 안전해요.",
            "short": "큰 결제 보류 권장.",
        },
        "support": {
            "soft": "주변에서 작은 정보가 흘러오는 날이에요. 평소 미뤄둔 소비 비교를 해두면 도움돼요.",
            "real": "정보가 잘 들어오는 날. 비교·검토 작업에 시간 쓰는 편이 효과적.",
            "short": "비교·검토 적합.",
        },
        "pressure": {
            "soft": "오늘은 지출보다 정리 쪽이 어울리는 흐름이에요. 작은 결심이 큰 변화를 만들어요.",
            "real": "절제 흐름. 신규 지출보다 기존 소비 정리에 무게.",
            "short": "지출 절제·정리 위주.",
        },
        "same": {
            "soft": "재정 흐름은 평소와 비슷한 날이에요. 무리한 변화보다 점검에 집중해 보세요.",
            "real": "재정 안정형 하루. 점검 작업이 가장 효율적이에요.",
            "short": "안정. 점검 위주.",
        },
    },
    "health": {
        "harmony": {
            "soft": "컨디션이 평소보다 가벼운 흐름이에요. 가볍게 산책이나 스트레칭이 잘 어울려요.",
            "real": "컨디션 양호한 날. 가벼운 운동·산책이 효율 잘 살려줘요.",
            "short": "컨디션 양호. 산책 OK.",
        },
        "clash": {
            "soft": "컨디션 변화가 느껴질 수 있는 날이에요. 물·수면 양을 평소보다 살짝 더 챙겨보세요.",
            "real": "컨디션 변동 가능. 수분·수면 평소 + 10% 챙기는 편이 안전.",
            "short": "수분·수면 추가 챙기기.",
        },
        "support": {
            "soft": "회복에 도움 되는 흐름이에요. 평소 미뤄둔 휴식이 잘 들어와요.",
            "real": "회복 흐름. 미뤄둔 휴식·정리 시간 잡기 좋은 날.",
            "short": "회복 흐름. 휴식 챙기기.",
        },
        "pressure": {
            "soft": "긴장이 평소보다 잘 느껴질 수 있어요. 호흡·짧은 휴식 한 번이 도움 돼요.",
            "real": "긴장 흐름. 30~60분 단위 짧은 휴식 권장.",
            "short": "짧은 휴식 자주.",
        },
        "same": {
            "soft": "컨디션은 평소와 비슷한 날이에요. 일상 루틴 유지가 잘 맞아요.",
            "real": "컨디션 안정. 루틴 유지가 효율적.",
            "short": "안정. 루틴 유지.",
        },
    },
    "work": {
        "harmony": {
            "soft": "협업·소통이 잘 풀리는 흐름이에요. 새 시작보다 진행 중인 일을 매끄럽게.",
            "real": "협업 잘 풀리는 날. 진행 중 작업 매듭짓기가 효율적.",
            "short": "협업 OK. 매듭짓기.",
        },
        "clash": {
            "soft": "일정이 살짝 바뀔 수 있는 날이에요. 예비 시간 30분 잡아두면 마음이 편해요.",
            "real": "일정 변동 가능. 버퍼 30분 확보 권장.",
            "short": "버퍼 시간 확보.",
        },
        "support": {
            "soft": "도움받기 좋은 흐름이에요. 막힌 일은 다른 사람 시선을 살짝 빌려보세요.",
            "real": "지원 받기 좋은 날. 막힌 작업은 동료 리뷰 받는 편이 빠름.",
            "short": "리뷰 받기 적합.",
        },
        "pressure": {
            "soft": "집중이 필요한 한 가지를 정해두면 효율이 잘 살아나요. 멀티태스킹은 잠시 쉬어가기.",
            "real": "단일 과업 집중형 하루. 멀티태스킹은 비효율적.",
            "short": "한 가지 집중.",
        },
        "same": {
            "soft": "일은 평소처럼 안정적으로 흘러요. 큰 변화보다 한 가지 깊게.",
            "real": "안정형. 단일 과업 깊이 들어가기 효율적.",
            "short": "안정. 한 가지 집중.",
        },
    },
    "one_thing": {
        "harmony": {
            "soft": "오늘은 \"미뤄둔 작은 정리 한 가지\" 를 끝내보세요. 책상 정리·메일 정리·물 한 컵 같은 작은 행동이면 충분해요.",
            "real": "오늘 한 가지: 미뤄둔 작은 정리 1개를 마치세요. 5~10분짜리면 충분.",
            "short": "작은 정리 1개 마무리.",
        },
        "clash": {
            "soft": "오늘은 \"한 가지 결정만 미루기\" 를 추천해요. 큰 결심은 내일로 넘기고 오늘은 흐름만 정리.",
            "real": "오늘 한 가지: 결정 1개를 의도적으로 미루세요. 충 흐름엔 보류가 이득.",
            "short": "결정 1개 보류.",
        },
        "support": {
            "soft": "오늘은 \"누군가에게 짧게 묻기\" 한 가지를 챙겨보세요. 5분 대화가 며칠을 절약해요.",
            "real": "오늘 한 가지: 막힌 거 1개를 다른 사람한테 5분 묻기.",
            "short": "5분 질문 1개.",
        },
        "pressure": {
            "soft": "오늘은 \"하지 않을 일 1개 정하기\" 를 추천해요. 줄이는 쪽이 정답인 흐름이에요.",
            "real": "오늘 한 가지: 안 할 일 1개를 명시적으로 결정하세요.",
            "short": "안 할 일 1개 결정.",
        },
        "same": {
            "soft": "오늘은 \"평소 루틴 1개 챙기기\" 를 추천해요. 작은 일관성이 큰 안정을 만들어요.",
            "real": "오늘 한 가지: 평소 루틴 1개를 빠뜨리지 않고 챙기세요.",
            "short": "루틴 1개 유지.",
        },
    },
}

# ─────────────────────────────────────────────
# reason ("왜 이렇게 봤나요?")
# ─────────────────────────────────────────────

_REASON_TOTAL: dict[str, str] = {
    "harmony": "오늘 일진({today_pillar})의 천간이 본인 일간({day_master})과 합(合)을 이루는 흐름이에요. 새 흐름을 받아들이기 좋은 배치로 보았어요.",
    "clash": "오늘 일진({today_pillar})이 본인 일간({day_master})과 충(沖)의 관계예요. 변동성이 큰 흐름으로 보았어요.",
    "support": "오늘 일진({today_pillar})의 오행({today_element})이 본인 오행({day_master_element})을 도와주는(생, 生) 관계예요.",
    "pressure": "오늘 일진({today_pillar})의 오행({today_element})이 본인 오행({day_master_element})과 극(剋)의 긴장 관계예요. 절제·정리에 무게를 두는 게 자연스러워요.",
    "same": "오늘 일진({today_pillar})이 본인 일간({day_master})과 같은 오행({day_master_element})이라 비화(比和)의 안정 흐름이에요.",
}

_REASON_MONEY: dict[str, str] = {
    "harmony": "재물은 사주에서 재성(財星)으로 살피는데, 오늘 흐름은 결단보다 정리·점검에 어울리는 배치예요.",
    "clash": "재물은 재성(財星)의 흐름으로 보는데, 오늘은 충(沖)의 영향으로 변동 가능성이 보여요. 큰 결정은 한 박자 미루는 편이 안전해요.",
    "support": "재물은 재성(財星)의 흐름으로 살펴요. 오늘은 정보·도움이 잘 들어오는 배치라 비교·검토에 시간 쓰기 좋아요.",
    "pressure": "재물은 재성(財星)의 흐름으로 보는데, 오늘은 극(剋)의 긴장이 있어 절제·정리 쪽으로 무게를 두었어요.",
    "same": "재물 흐름은 비화(比和)로 평소와 비슷해요. 큰 변화보다 점검에 집중하는 쪽이 자연스러워요.",
}

_REASON_HEALTH: dict[str, str] = {
    "harmony": "건강은 오행(五行) 균형으로 보는데, 오늘은 균형이 받쳐주는 흐름이에요. 가벼운 활동에 어울려요.",
    "clash": "건강은 오행(五行: 목·화·토·금·수)의 균형으로 봐요. 오늘 일진({today_pillar})이 균형 폭을 살짝 흔드는 배치라 컨디션 변동 가능성을 짚었어요.",
    "support": "건강은 오행(五行) 균형으로 보는데, 오늘은 회복(생, 生)이 잘 들어오는 흐름이에요.",
    "pressure": "건강은 오행(五行) 균형으로 보는데, 오늘은 극(剋)의 긴장이 있어 짧은 휴식이 도움돼요.",
    "same": "건강은 오행(五行) 균형으로 봐요. 비화(比和)의 안정 흐름이라 평소 루틴이 가장 효율적이에요.",
}

_REASON_WORK: dict[str, str] = {
    "harmony": "일·학업은 관성(官星)·인성(印星)의 흐름으로 보는데, 오늘은 협업·소통이 매끄러운 배치예요.",
    "clash": "일·학업은 관성(官星: 책임·역할)과 인성(印星: 배움·정리)의 흐름으로 살펴요. 오늘은 충(沖)의 영향이 있어 일정 버퍼가 필요해요.",
    "support": "일·학업은 관성(官星)·인성(印星)의 흐름으로 보는데, 오늘은 도움(생, 生)이 들어오는 배치라 리뷰 받기 좋아요.",
    "pressure": "일·학업은 관성(官星)·인성(印星)의 흐름으로 봐요. 오늘은 분산보다 집중 — 한 곳에 깊게 들어가는 기운이 더 잘 맞아요.",
    "same": "일·학업은 관성(官星)·인성(印星)의 흐름으로 보는데, 오늘은 비화(比和)의 안정 흐름이라 단일 과업에 깊이 들어가기 좋아요.",
}

_REASON_ONE_THING: dict[str, str] = {
    "harmony": "오늘 일진({today_pillar})은 합(合)의 마무리에 어울리는 배치예요. 작은 정리가 흐름의 균형을 잡아주는 \"용신(用神: 흐름을 보완해주는 기운)\" 역할을 해요.",
    "clash": "오늘 일진({today_pillar})은 충(沖)의 변동기예요. 결정 보류가 곧 용신(用神) 역할이에요.",
    "support": "오늘 일진({today_pillar})은 생(生)의 도움 흐름이에요. 작은 질문 1개가 며칠을 아껴줄 수 있어요.",
    "pressure": "오늘 일진({today_pillar})은 극(剋)의 긴장이 있어 빼는 쪽이 정답이에요. \"안 할 일 1개\" 가 용신(用神)이에요.",
    "same": "오늘 일진({today_pillar})은 비화(比和)의 안정 흐름이라 루틴 1개의 일관성이 흐름의 용신(用神)이 돼요.",
}

# 섹션 key → reason 매트릭스
_REASON_BY_SECTION: dict[str, dict[str, str]] = {
    "total": _REASON_TOTAL,
    "money": _REASON_MONEY,
    "health": _REASON_HEALTH,
    "work": _REASON_WORK,
    "one_thing": _REASON_ONE_THING,
}

# 섹션 key → 표시 title (프론트 i18n 매핑과 일치)
_TITLE_BY_SECTION: dict[str, str] = {
    "total": "총운",
    "money": "재물운",
    "health": "건강운",
    "work": "일·학업운",
    "one_thing": "오늘의 한 가지",
}

# focus → 강조 섹션 key (calibration focus 가 매칭되는 섹션은 한 줄 추가)
_FOCUS_TO_SECTION: dict[str, str] = {
    "total": "total",
    "money": "money",
    "health": "health",
    "work": "work",
    "relation": "total",  # relation 섹션 미구현 — total 로 흡수
}

_FOCUS_BOOST: dict[str, str] = {
    "money": "오늘은 특히 재물 흐름에 집중해 보세요.",
    "health": "오늘은 특히 컨디션 관리를 우선해 보세요.",
    "work": "오늘은 특히 일·학업 흐름에 집중해 보세요.",
    "total": "오늘은 전반적인 흐름을 차분히 점검해 보세요.",
}

# 섹션 본문 길이 (Barnum 방지 검증용 — 너무 두루뭉술한 표현 grep 가능)
_BARNUM_BLOCKLIST: tuple[str, ...] = (
    "누구에게나",
    "모든 사람이",
    "항상 그렇듯",
)


def _safe_format(template: str, **kwargs) -> str:
    """KeyError 안전 format — 누락 키는 빈 문자로 치환."""
    class _SafeDict(dict):
        def __missing__(self, key: str) -> str:
            return ""
    return template.format_map(_SafeDict(**kwargs))


def build_sections(
    *,
    relation: dict,
    natal: dict,
    today: dict,
    focus: FocusLiteral = "total",
    tone: ToneLiteral = "soft",
) -> tuple[list[dict], str, list[str]]:
    """5섹션 + summary + keywords 생성.

    입력:
    - relation: derive_day_relation 결과 ({kind, intensity, focus_hint, day_master_element, today_element})
    - natal: compute_natal_chart 의 ['natal'] dict
    - today: today_pillar 결과 ({date, gan, ji, pillar, gan_element})
    - focus: 사용자 calibration 선택
    - tone: 사용자 calibration 선택

    반환:
    (sections, summary, keywords)
    sections: [{key, title, body, reason}, ...] (5개)
    summary: 우측 패널 SajuTodayCard 에 노출할 한 줄 요약
    keywords: 3~5개 (UI 키워드 배지용)
    """
    kind = relation.get("kind", "same")
    if kind not in _REASON_TOTAL:
        kind = "same"
    if tone not in ("soft", "real", "short"):
        tone = "soft"
    if focus not in ("total", "money", "health", "work", "relation"):
        focus = "total"

    day_master = natal.get("day_master", "")
    day_master_element = relation.get("day_master_element", "")
    today_element = relation.get("today_element", "")
    today_pillar_str = today.get("pillar", "")

    fmt_kwargs = {
        "day_master": day_master,
        "day_master_element": day_master_element,
        "today_element": today_element,
        "today_pillar": today_pillar_str,
    }

    section_keys = ["total", "money", "health", "work", "one_thing"]
    sections: list[dict] = []
    focus_section_key = _FOCUS_TO_SECTION.get(focus, "total")

    for key in section_keys:
        body = _BODY[key][kind][tone]
        # focus 매칭 섹션에 한 줄 추가
        if key == focus_section_key and key in _FOCUS_BOOST:
            body = body + " " + _FOCUS_BOOST[key]
        reason_template = _REASON_BY_SECTION[key][kind]
        reason = _safe_format(reason_template, **fmt_kwargs)
        sections.append({
            "key": key,
            "title": _TITLE_BY_SECTION[key],
            "body": body,
            "reason": reason,
        })

    # summary: relation kind + day_master + 핵심 톤
    summary_by_kind = {
        "harmony": f"{day_master}일주 — 새 흐름 받기 좋은 합(合)의 날이에요.",
        "clash": f"{day_master}일주 — 변동이 보이는 충(沖)의 날, 마무리 위주로.",
        "support": f"{day_master}일주 — 도움이 잘 들어오는 생(生)의 날.",
        "pressure": f"{day_master}일주 — 절제·정리가 잘 맞는 극(剋)의 날.",
        "same": f"{day_master}일주 — 평소 리듬이 안정적인 비화(比和)의 날.",
    }
    summary = summary_by_kind[kind]

    # keywords: 3개 (kind + focus + dominant_element)
    kind_kw = {
        "harmony": "조화",
        "clash": "변동",
        "support": "도움",
        "pressure": "절제",
        "same": "안정",
    }[kind]
    focus_kw = {
        "total": "전반",
        "money": "재물",
        "health": "건강",
        "work": "일·학업",
        "relation": "관계",
    }[focus]
    keywords = [kind_kw, focus_kw, today_pillar_str or day_master]

    return sections, summary, keywords
