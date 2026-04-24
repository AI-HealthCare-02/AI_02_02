"""사주 리딩 템플릿 (P4.2).

오늘 카드(`/today`)와 분리된 정적 리딩:
- natal: 나의 기질 (리드 + 핵심 기질 5 + 핵심 모순 + 강점 + 주의점 + 관계 + 일 + 회복 + 총평)
- yearly: 특정 연도 총운 (리드 + 세운 + 키워드 + 기회3 + 주의3 + 분야별 5 + 체크리스트 + 최종)
- monthly: 12개월 흐름 (요약 + 활용·보수 달 + 연간 패턴 + 월별 상세)

원칙:
- LLM 사용 금지 — 일간·십성·용신 조합의 결정론 템플릿
- 섹션 body 는 문학적·명리학적 3~5문장, easy_summary 한 줄, reason 근거
- 의료·법률·투자·관계 단정 표현 금지. 컨디션·운영·페이스 조절 프레임만

DB 저장 없이 원국(natal) + 억부용신 + 오행 분포를 즉시 해석한다.
"""

from __future__ import annotations

from typing import Literal

from backend.services.saju.engine.chart import GAN, GAN_ELEMENT, JI, JI_ELEMENT
from backend.services.saju.engine.sisung import _element_relation
from backend.services.saju.templates.today import DEFAULT_SAFETY_NOTICE

READING_TEMPLATE_VERSION = "reading-v1.1"

PeriodLiteral = Literal["natal", "yearly", "monthly"]

_YEAR_EPOCH = 1984  # 1984 = 甲子

_ELEMENT_TRAIT = {
    "목": "계획을 세우고 성장시키는 힘",
    "화": "표현하고 드러내는 힘",
    "토": "정리하고 버티는 힘",
    "금": "기준을 세우고 다듬는 힘",
    "수": "관찰하고 깊게 파고드는 힘",
}

_DAY_MASTER_ARCHETYPE = {
    "목": "방향이 잡히면 꾸준히 밀고 가는 성장형",
    "화": "분위기를 읽고 자기 색을 드러내는 표현형",
    "토": "흐트러진 것을 붙잡아 안정시키는 중심형",
    "금": "기준과 완성도를 중요하게 보는 정리형",
    "수": "겉보다 안쪽 구조를 오래 보는 탐구형",
}

# 일간 오행 × "작은 등불 / 큰 불꽃" 같은 문학적 메타포 (자기 은유 제공)
_DAY_MASTER_METAPHOR = {
    "목": "깊이 뿌리내리고 높이 올라가는 한 그루 나무",
    "화": "주변을 밝히는 불빛, 불씨가 꺼지지 않도록 아끼는 등불",
    "토": "흐트러진 기운을 받아주는 너른 땅, 중심이 되는 산",
    "금": "다듬어야 쓸모가 드러나는 단단한 금속, 날을 세운 칼",
    "수": "멈추지 않고 깊이 흐르는 물, 겉이 고요해도 안이 깊은 강",
}

_ROLE_STYLE = {
    "비겁": "자기 기준과 독립성이 강하게 작동하는 편",
    "인수": "배우고 흡수한 뒤 자기 식으로 정리하는 편",
    "식상": "생각을 말·글·결과물로 꺼내야 흐름이 살아나는 편",
    "재성": "현실 감각과 결과를 만드는 쪽에서 힘이 나는 편",
    "관살": "역할·책임·규칙을 의식할수록 집중력이 살아나는 편",
}

_RELATION_LABEL = {
    "same": "비겁",
    "toMe": "인수",
    "fromMe": "식상",
    "meCtrl": "재성",
    "ctrlMe": "관살",
}

_MONTH_NAMES = [
    "1월", "2월", "3월", "4월", "5월", "6월",
    "7월", "8월", "9월", "10월", "11월", "12월",
]

# 양력 월 기준 압축 월지. 절기 정밀 보정은 P5+ 범위라 today 엔진과 같은 단순화 원칙을 따른다.
_MONTH_JI_BY_SOLAR_MONTH = {
    1: "丑",
    2: "寅",
    3: "卯",
    4: "辰",
    5: "巳",
    6: "午",
    7: "未",
    8: "申",
    9: "酉",
    10: "戌",
    11: "亥",
    12: "子",
}

_SHENG = {"목": "화", "화": "토", "토": "금", "금": "수", "수": "목"}


def _year_pillar(year: int) -> dict[str, str]:
    delta = year - _YEAR_EPOCH
    gan = GAN[delta % 10]
    ji = JI[delta % 12]
    return {
        "gan": gan,
        "ji": ji,
        "pillar": gan + ji,
        "gan_element": GAN_ELEMENT.get(gan, ""),
        "ji_element": JI_ELEMENT.get(ji, ""),
    }


def _element_counts(natal: dict) -> dict[str, int]:
    dist = natal.get("element_distribution")
    if isinstance(dist, dict) and dist:
        return {str(k): int(v) for k, v in dist.items()}
    return {e: 0 for e in ("목", "화", "토", "금", "수")}


def _day_master_element(natal: dict) -> str:
    day_master = natal.get("day_master", "")
    return GAN_ELEMENT.get(day_master, natal.get("day_master_element", "") or "")


def _yongshin(natal: dict) -> dict:
    y = natal.get("yongshin")
    return y if isinstance(y, dict) else {}


def _sisung(pillar: dict | None, key: str) -> str:
    if not pillar:
        return ""
    value = pillar.get(key)
    return value if isinstance(value, str) else ""


def _top_and_low_elements(counts: dict[str, int]) -> tuple[str, str]:
    if not counts:
        return "", ""
    top = max(counts.keys(), key=lambda el: (counts.get(el, 0), -list(counts.keys()).index(el)))
    low = min(counts.keys(), key=lambda el: (counts.get(el, 0), list(counts.keys()).index(el)))
    return top, low


def _role_for_element(day_master_element: str, element: str) -> str:
    if not day_master_element or not element:
        return ""
    return _RELATION_LABEL.get(_element_relation(day_master_element, element), "")


def _section(
    key: str,
    title: str,
    body: str,
    reason: str,
    easy_summary: str = "",
) -> dict[str, str]:
    return {
        "key": key,
        "title": title,
        "body": body,
        "easy_summary": easy_summary,
        "reason": reason,
    }


# ═════════════════════════════════════════════
# NATAL — 나의 기질 (9 섹션 풀리딩)
# ═════════════════════════════════════════════
def _natal_lead_definition(*, day_master: str, dm_el: str, y: dict) -> str:
    """한 줄 정의 — 일간 메타포 + 용신 역할을 한 문장에 압축."""
    metaphor = _DAY_MASTER_METAPHOR.get(dm_el, "자기 리듬을 지키는 사람")
    yong_role = y.get("yongshin_role", "")
    yong_el = y.get("yongshin_element", "")
    if yong_role and yong_el:
        return (
            f"{metaphor}. "
            f"{yong_el}({yong_role}) 흐름이 살아날 때 자기 이야기를 결과로 바꾸는 사람."
        )
    return f"{metaphor}. 자기 리듬 위에서 깊이를 쌓아가는 사람."


def _natal_core_traits(*, day_master: str, dm_el: str, counts: dict, y: dict) -> tuple[str, str]:
    """핵심 기질 5가지 묶음 (문학적 + 쉽게 말하면)."""
    trait = _ELEMENT_TRAIT.get(dm_el, "자기 흐름을 지키는 힘")
    yong_role = y.get("yongshin_role", "")
    top_el, low_el = _top_and_low_elements(counts)
    yong_el = y.get("yongshin_element", "")

    body = (
        f"일간 {day_master}({dm_el})의 성향은 '{trait}' 쪽에 기울어 있어요. "
        f"첫 번째는 깊이형 사고 — 겉으로 빠르게 반응하지 않고, 상황을 오래 관찰한 뒤 의미를 정리하는 흐름이 강합니다. "
        f"두 번째는 자기 표현력 — 생각을 자기 방식으로 꺼낼 때 에너지가 살아나고, 납득이 안 되는 일에서는 빠르게 소모됩니다. "
        f"세 번째는 현실 압박 감지력 — 원국에 {top_el} 기운이 두드러져 외부 신호에 민감하게 반응해요. "
        f"네 번째는 외로운 일간 — 혼자 정리하는 시간이 있어야 오히려 사람과의 거리 조절이 잘 됩니다. "
        f"다섯 번째는 정신력 우세·체력 보조 — 머리로 끝까지 밀고 가는 힘은 강하지만, {low_el} 기운 보강 없이는 몸이 따라오지 못할 수 있어요."
    )
    easy = (
        "쉽게 말하면, 아무 일이나 오래 버티는 사람이 아니라 '납득되는 일'에서 오래 빛나는 사람입니다."
    )
    if yong_el and yong_role:
        easy = (
            f"쉽게 말하면, {yong_el}({yong_role}) 흐름이 열리는 자리에서 이 다섯 가지 기질이 한꺼번에 살아나요."
        )
    return body, easy


def _natal_contradiction(*, dm_el: str, counts: dict, y: dict) -> tuple[str, str]:
    """성격의 핵심 모순 — 원국 구조의 고유 긴장 포인트."""
    sin_gang = y.get("sin_gang", "balanced")
    top_el, low_el = _top_and_low_elements(counts)
    if sin_gang == "weak":
        body = (
            f"머리는 끝까지 가는데 환경이 못 받쳐주는 구조예요. "
            f"{top_el} 기운이 과하게 들어와 일간이 눌리는 모양이라, 욕심·표현 욕구는 강한데 그것을 받쳐주는 자원({low_el})이 적어 쉽게 지칩니다. "
            "결과를 내고 싶은데, 그 결과를 오래 유지할 체력 자원은 아껴써야 하는 긴장이 일상에 깔려 있어요."
        )
        easy = "쉽게 말하면, '하고 싶은 만큼 다 할 수 있는 사람' 이라기보다 '선택과 보존이 같이 필요한 사람' 입니다."
    elif sin_gang == "strong":
        body = (
            f"자기 힘은 충분한데 그 힘을 쓸 출구가 좁은 구조예요. "
            f"{top_el} 기운이 이미 넉넉해 안에 에너지가 쌓이는 반면, 설기·제어해줄 흐름이 부족해 '밖으로 꺼낼 통로'가 잘 열리지 않습니다. "
            "움직이지 않으면 답답해지고, 움직이면 선명하게 드러나는 양극단이 같이 있어요."
        )
        easy = "쉽게 말하면, 엔진은 준비돼 있는데 운전대가 좁은 사람. 통로를 만들어두면 움직임이 선명해져요."
    else:
        body = (
            f"{top_el} 기운은 익숙하게 처리하지만 {low_el} 쪽은 낯선 구조예요. "
            "균형에 가까워 보여도, 같은 패턴의 일만 반복하면 지루함이 빨리 찾아오고, 새로운 패턴은 시작할 때 저항이 큽니다. "
            "익숙함과 새로움 사이에서 한쪽을 의식적으로 고르는 연습이 평생 따라붙는 과제예요."
        )
        easy = "쉽게 말하면, 안정적인 듯 보이지만 '같은 하루의 반복' 에 가장 지치는 사람 입니다."
    return body, easy


def _natal_strengths(*, dm_el: str, y: dict) -> tuple[str, str]:
    yong_role = y.get("yongshin_role", "")
    yong_el = y.get("yongshin_element", "")
    hee_el = y.get("hee_shin_element", "")
    style = _ROLE_STYLE.get(yong_role, "균형을 맞추는 방식이 중요한 편")
    body = (
        f"강점은 집중이 필요한 일, 긴 호흡의 분석, 남이 놓친 맥락을 찾아내는 일에서 선명하게 드러나요. "
        f"용신 {yong_el}({yong_role}) 흐름이 열리면 {style}이라, 무리하게 밀어붙이기보다 자기 리듬을 찾아 주 단위·월 단위로 쌓을 때 결과가 단단해집니다. "
        f"희신 {hee_el} 기운은 이 강점을 현실에서 쓰기 쉽게 도와주는 보조로 봅니다. "
        "사람을 설득하거나 움직이는 일보다, 구조를 짜고 마무리로 정리하는 일에서 남이 놓치기 쉬운 완성도를 만들어낼 수 있어요."
    )
    easy = "쉽게 말하면, '한 번에 크게' 보다 '오래 쌓아 단단하게' 가 훨씬 어울리는 사람이에요."
    return body, easy


def _natal_cautions(*, counts: dict, y: dict) -> tuple[str, str]:
    top_el, low_el = _top_and_low_elements(counts)
    ki_el = y.get("ki_shin_element", "")
    body = (
        f"주의점은 외부 압박({top_el}) 앞에서 자기 페이스를 잃기 쉽다는 점이에요. "
        f"기신 {ki_el} 기운이 들어오는 시기나 환경에서는 '더 열심히 하면 해결된다' 는 충동이 생기는데, 실제로는 페이스 조절이 답일 때가 많습니다. "
        f"체력 자원({low_el})이 비축되지 않은 상태에서 계속 결과만 요구하면 번아웃이 빠르게 올 수 있어요. "
        "완벽하게 끝내려는 욕심보다, 중간 점검과 잠깐의 정리 시간을 먼저 일정에 넣는 편이 안정적입니다."
    )
    easy = "쉽게 말하면, '더 세게 밀어붙이기' 가 답이 아니라 '더 영리하게 나눠쓰기' 가 답인 날이 많아요."
    return body, easy


def _natal_relation(*, dm_el: str, y: dict) -> tuple[str, str]:
    yong_role = y.get("yongshin_role", "")
    body = (
        "관계 스타일은 넓게 여러 명을 만나기보다, 몇 사람과 깊게 오래 이어지는 쪽이에요. "
        "말이 많은 자리보다 말이 오래 남는 자리에서 편안함을 느끼고, 갈등 상황에서는 즉답보다 한 박자 두고 정리해서 답하는 방식이 잘 맞습니다. "
        "다만 생각을 너무 오래 안에 두면 상대가 답답해할 수 있어서, '언제까지 답을 주겠다' 같은 기한을 스스로 말로 약속해두는 게 관계 유지에 도움이 돼요. "
        f"{yong_role or '용신'} 기운이 살아날 때 관계에서 자기 색이 가장 자연스럽게 드러납니다."
    )
    easy = "쉽게 말하면, '빨리 대답' 보다 '정리된 한마디' 로 사람을 오래 곁에 두는 타입이에요."
    return body, easy


def _natal_work(*, counts: dict, y: dict) -> tuple[str, str]:
    top_el, _ = _top_and_low_elements(counts)
    yong_role = y.get("yongshin_role", "")
    body = (
        "일하는 방식은 '자료 수집 → 구조 잡기 → 결과물로 정리' 의 3단계가 기본 리듬이에요. "
        "중간에 맥락이 충분히 이해되지 않으면 속도를 더 내기보다 오히려 멈춰서 흐름을 다시 보는 편이라, 급하게 몰아붙이는 환경보다 단계가 있는 프로젝트에서 성과가 안정적입니다. "
        f"원국에서 {top_el} 기운이 두드러져, 결과 기준이 명확한 일에서는 남이 놓친 디테일까지 챙기는 집중력이 나와요. "
        f"{yong_role or '용신'} 흐름이 잡힌 팀·환경에서는 자기 역할이 선명해지면서 생산성이 한 단계 올라갑니다."
    )
    easy = "쉽게 말하면, 빨리 반응하는 일보다 구조 잡고 정리하는 일에서 실력이 더 잘 드러나는 사람이에요."
    return body, easy


def _natal_recovery(*, dm_el: str, counts: dict) -> tuple[str, str]:
    _, low_el = _top_and_low_elements(counts)
    body = (
        "회복은 사람 사이가 아니라 자기 안쪽에서 이뤄지는 편이에요. "
        "말수가 줄거나 혼자 있는 시간이 길어진다면 피로 회복 사이클에 들어간 신호라고 보면 됩니다. "
        f"부족한 기운({low_el}) 쪽을 루틴에 얹어두는 것이 도움이 되는데, 예를 들면 가벼운 산책, 물 섭취 리듬, 잠들기 전 짧은 정리 시간 같은 작은 반복이 큰 휴식보다 효과가 오래 갑니다. "
        "무리해서 활동적인 휴식을 잡기보다, '방해받지 않는 혼자만의 30분' 같은 작은 단위가 더 잘 맞아요."
    )
    easy = "쉽게 말하면, 거창한 리프레시보다 '혼자 있는 30분' 하나가 진짜 회복인 사람이에요."
    return body, easy


def _natal_closing(*, day_master: str, y: dict, counts: dict) -> tuple[str, str]:
    """총평 5줄 — 앞의 섹션들을 한 문단으로 묶는 마무리."""
    yong_el = y.get("yongshin_element", "")
    yong_role = y.get("yongshin_role", "")
    top_el, low_el = _top_and_low_elements(counts)
    body = (
        f"{day_master}일간의 기본 리듬은 '깊게 보고, 내 방식으로 정리하고, 오래 쌓아가는' 쪽에 있어요. "
        f"용신 {yong_el}({yong_role}) 흐름이 열리면 자기다움이 가장 선명해지는 시기가 오고, "
        f"반대로 {top_el} 기운이 과해지는 구간에서는 페이스 조절이 곧 자기 보호가 됩니다. "
        f"부족한 {low_el} 쪽을 생활 루틴에 미리 얹어두면, 불균형이 커지기 전에 자기 안쪽에서 중심이 잡혀요. "
        "결론적으로 '크게 한 번' 보다 '작고 오래' 가 이 원국의 성격에 가장 잘 어울리는 운영 방식입니다."
    )
    easy = "쉽게 말하면, 이 사주는 '잘 쌓는 사람' 이지 '빨리 터뜨리는 사람' 이 아닙니다."
    return body, easy


def _build_natal_reading(*, natal: dict) -> dict:
    day_master = natal.get("day_master", "")
    dm_el = _day_master_element(natal)
    y = _yongshin(natal)
    counts = _element_counts(natal)
    top_el, low_el = _top_and_low_elements(counts)
    month = natal.get("month") or {}
    day = natal.get("day") or {}
    month_role = _sisung(month, "sisung_ji") or _sisung(month, "sisung_gan")
    day_branch_role = _sisung(day, "sisung_ji")
    yong_el = y.get("yongshin_element", "")
    yong_role = y.get("yongshin_role", "")

    lead_body = _natal_lead_definition(day_master=day_master, dm_el=dm_el, y=y)
    summary = lead_body

    core_body, core_easy = _natal_core_traits(day_master=day_master, dm_el=dm_el, counts=counts, y=y)
    contra_body, contra_easy = _natal_contradiction(dm_el=dm_el, counts=counts, y=y)
    strong_body, strong_easy = _natal_strengths(dm_el=dm_el, y=y)
    caut_body, caut_easy = _natal_cautions(counts=counts, y=y)
    rel_body, rel_easy = _natal_relation(dm_el=dm_el, y=y)
    work_body, work_easy = _natal_work(counts=counts, y=y)
    recov_body, recov_easy = _natal_recovery(dm_el=dm_el, counts=counts)
    close_body, close_easy = _natal_closing(day_master=day_master, y=y, counts=counts)

    sections = [
        _section(
            "lead",
            "한 줄 정의",
            lead_body,
            "일간 오행 + 억부 용신의 역할을 한 문장으로 압축한 자기 은유.",
            easy_summary="",
        ),
        _section(
            "core_traits",
            "핵심 기질 5가지",
            core_body,
            (
                f"일간 {day_master}({dm_el})의 기본 성향 + 원국의 주 기운({top_el}) "
                f"+ 부족 기운({low_el}) + 용신 {yong_el}({yong_role}) 을 묶어서 봤습니다."
            ),
            easy_summary=core_easy,
        ),
        _section(
            "contradiction",
            "성격의 핵심 모순",
            contra_body,
            f"신강신약({y.get('sin_gang', 'balanced')}) + 주 기운 {top_el} · 부족 {low_el} 분포의 고유 긴장.",
            easy_summary=contra_easy,
        ),
        _section(
            "strengths",
            "강점",
            strong_body,
            f"용신 {yong_el}({yong_role}) + 희신 {y.get('hee_shin_element', '')} 흐름으로 살아나는 실력 축.",
            easy_summary=strong_easy,
        ),
        _section(
            "cautions",
            "주의점",
            caut_body,
            f"주 기운 {top_el} 과잉 + 기신 {y.get('ki_shin_element', '')} 유입 시 에너지 소모 패턴.",
            easy_summary=caut_easy,
        ),
        _section(
            "relation",
            "인간관계 스타일",
            rel_body,
            f"일지({day_branch_role or '본인 리듬'}) + 용신 {yong_role} 기질로 본 관계 운영 방식.",
            easy_summary=rel_easy,
        ),
        _section(
            "work",
            "일하는 방식",
            work_body,
            f"월주({month_role or '역할'}) + 일지({day_branch_role or '리듬'}) + 용신 {yong_role} 을 묶어서 봤습니다.",
            easy_summary=work_easy,
        ),
        _section(
            "recovery",
            "회복 방식",
            recov_body,
            f"부족 기운 {low_el} 을 생활 루틴으로 보완하는 관점.",
            easy_summary=recov_easy,
        ),
        _section(
            "closing",
            "총평",
            close_body,
            "일간·용신·주 기운·부족 기운을 한 문단으로 묶은 최종 요약.",
            easy_summary=close_easy,
        ),
    ]

    return {
        "period": "natal",
        "title": "나의 기질",
        "summary": summary,
        "keywords": [
            kw
            for kw in [
                "깊이형",
                yong_role or "균형",
                top_el or "주 기운",
                low_el and f"{low_el} 보강",
                "자기 리듬",
            ]
            if kw
        ],
        "sections": sections,
        "months": [],
        "safety_notice": DEFAULT_SAFETY_NOTICE,
    }


# ═════════════════════════════════════════════
# YEARLY — 2026 총운 (분야별 + 체크리스트 포함)
# ═════════════════════════════════════════════
def _year_score(*, natal: dict, year_info: dict[str, str]) -> int:
    y = _yongshin(natal)
    counts = _element_counts(natal)
    yong = y.get("yongshin_element", "")
    hee = y.get("hee_shin_element", "")
    ki = y.get("ki_shin_element", "")
    year_elements = [year_info.get("gan_element", ""), year_info.get("ji_element", "")]
    score = 62
    for el in year_elements:
        if el == yong:
            score += 10
        if el == hee:
            score += 7
        if el == ki:
            score -= 8
        if counts.get(el, 0) == 0:
            score += 4
    return max(0, min(100, score))


def _build_yearly_reading(*, natal: dict, year: int) -> dict:
    year_info = _year_pillar(year)
    y = _yongshin(natal)
    yong = y.get("yongshin_element", "")
    hee = y.get("hee_shin_element", "")
    ki = y.get("ki_shin_element", "")
    score = _year_score(natal=natal, year_info=year_info)
    pillar = year_info["pillar"]
    gan_el = year_info["gan_element"]
    ji_el = year_info["ji_element"]
    sin_gang = y.get("sin_gang", "balanced")

    if yong and (gan_el == yong or ji_el == yong):
        lead_sentence = f"{year}년은 용신 {yong} 흐름이 직접 들어와, 자기 장점을 결과로 바꾸기 좋은 해."
    elif hee and (gan_el == hee or ji_el == hee):
        lead_sentence = f"{year}년은 희신 {hee} 흐름이 도와, 확장보다 완성·정리에 힘이 실리는 해."
    elif ki and (gan_el == ki or ji_el == ki):
        lead_sentence = f"{year}년은 기신 {ki} 흐름이 섞여 있어, 속도보다 페이스 조절이 중심이 되는 해."
    else:
        lead_sentence = f"{year}년은 원국과 큰 충돌 없이 균형을 맞춰가는 해."

    lead_body = (
        f"{lead_sentence} "
        f"올해 세운은 {pillar}이고, 천간은 {gan_el}, 지지는 {ji_el} 기운으로 들어와요. "
        f"참고 지수는 {score}점 — 절대 평가가 아니라 원국과 얼마나 무리 없이 맞물리는지 보는 지표입니다. "
        "크게 새로 벌이기보다 쌓아둔 것을 쓸모 있게 정리하는 리듬이 이 해의 기본 톤입니다."
    )

    flow_body = (
        f"세운의 천간 {gan_el}({_RELATION_LABEL.get(_element_relation(_day_master_element(natal), gan_el), '기운')}) "
        f"과 지지 {ji_el}({_RELATION_LABEL.get(_element_relation(_day_master_element(natal), ji_el), '기운')}) 의 조합은 "
        f"한마디로 '균형을 재정비하라는 해' 로 읽힙니다. "
        f"원국이 {sin_gang} 쪽에 기울어 있어, 무리한 확장보다 중심에서 멀어진 것들을 한 발짝 가깝게 당기는 운영이 이 흐름과 잘 맞아요. "
        "아직 못 끝낸 것, 미뤄둔 점검, 오래 들고 있던 질문을 하나씩 마주하기 좋은 해입니다."
    )
    flow_easy = "쉽게 말하면, 올해는 '새로 시작하는 해' 보다 '미뤄둔 것 갚아가는 해' 에 가깝습니다."

    keyword_list = [
        f"{pillar} 세운",
        f"{score}점 흐름",
        yong and f"용신 {yong} 활용" or "균형 운영",
        hee and f"희신 {hee} 보조" or "기회 선택",
        "페이스 조절",
    ]
    keywords_body = (
        "올해 흐름을 다섯 개 키워드로 압축하면 이렇게 잡힙니다. "
        + " / ".join(k for k in keyword_list if k)
        + ". 크게 흔들리기보다 작은 반복을 통해 '내 쪽으로 기운을 가져오는' 운영이 잘 맞는 해예요."
    )

    opportunities_body = (
        "올해의 기회 세 가지를 꼽아보면 이렇습니다. "
        "첫째, 오래 미뤄둔 결과물 마감 — 반쯤 만들어둔 자료·기획·공부를 결과로 묶기 좋은 타이밍입니다. "
        "둘째, 반복 수익·지출 구조 재배치 — 한 번의 큰 결정보다 월 단위로 반복되는 구조를 다듬는 쪽이 단단합니다. "
        "셋째, 깊이 있는 관계 정리 — 피상적인 연결을 줄이고, 말이 통하는 사람과의 밀도를 높이기 좋은 해입니다."
    )
    opportunities_easy = "쉽게 말하면, '터뜨리는 해' 가 아니라 '단단하게 만드는 해' 예요."

    cautions_body = (
        "올해의 주의 세 가지를 꼽으면 이렇습니다. "
        "첫째, 한 번에 해결하려는 충동 — 밀린 것을 몰아서 쳐내면 피로가 크게 올 수 있어, 한 주 한 주 나눠 잡는 편이 낫습니다. "
        "둘째, 큰 결정의 조급함 — 확장형 결정은 현실 정보와 시간을 충분히 두고 보는 게 안전합니다. "
        f"셋째, 기신 {ki or '반대 흐름'} 자극 — 이 기운이 들어오는 달(월별 탭 참고) 에는 기대치를 살짝 낮추고, 실행보다 관찰에 비중을 두는 편이 좋습니다."
    )
    cautions_easy = "쉽게 말하면, '다 해결해야 해' 를 줄이고 '지금 가장 중요한 한 가지' 에 집중하는 해예요."

    sections = [
        _section(
            "lead",
            f"{year}년 한 줄 정의",
            lead_body,
            f"세운 {pillar} 의 오행이 원국의 용신({yong})·희신({hee})·기신({ki}) 과 맞물리는 지점을 요약.",
            easy_summary=f"쉽게 말하면, {year}년은 '{'확장' if yong and (gan_el == yong or ji_el == yong) else '정리·완성'}' 이 테마인 해예요.",
        ),
        _section(
            "year_flow",
            "세운 분석",
            flow_body,
            "세운의 천간·지지 오행과 원국 신강신약을 비교한 흐름 해석.",
            easy_summary=flow_easy,
        ),
        _section(
            "keywords",
            "올해 핵심 키워드",
            keywords_body,
            "세운 오행 + 참고 지수 + 용신·희신 매칭을 키워드 5개로 압축.",
            easy_summary="쉽게 말하면, 올해의 분위기를 한눈에 잡는 단어 모음이에요.",
        ),
        _section(
            "opportunities",
            "올해의 기회 3",
            opportunities_body,
            "용신·희신 흐름이 현실에서 어디에 쓰이기 좋은지 3 영역으로 정리.",
            easy_summary=opportunities_easy,
        ),
        _section(
            "cautions",
            "올해의 주의 3",
            cautions_body,
            "기신 흐름과 과잉 기운이 만들어내는 피로 패턴 3 가지.",
            easy_summary=cautions_easy,
        ),
        _section(
            "career",
            "분야: 커리어·학업",
            (
                "일과 학업은 새 판을 크게 벌리기보다 이미 들고 있는 프로젝트·자료·배움을 '결과물'로 묶어내는 쪽이 잘 맞습니다. "
                "특히 중간 점검과 마감 기준을 먼저 세워두면 흐름이 훨씬 단단해져요. "
                "자격·문서·면접 같은 '형식이 있는 단계' 를 통과해야 하는 일에서 올해의 집중력이 더 잘 발휘됩니다."
            ),
            "세운 흐름 + 용신 역할을 커리어·학업 운영 조언으로 번역.",
            easy_summary="쉽게 말하면, '새 판 벌리기' 보다 '지금 판 마무리' 가 올해의 성과 키 입니다.",
        ),
        _section(
            "money",
            "분야: 금전",
            (
                "재물 운영은 큰 한 방보다 반복 지출 정리, 작은 수익 구조 만들기, 기존 자원의 재배치 쪽이 안정적입니다. "
                "큰 결정은 현실 정보와 기간을 같이 두고 판단하는 편이 좋고, 레버리지를 키우기보다 현금흐름 가시성을 먼저 만드는 전략이 어울려요. "
                "분기별로 한 번씩 '현재 구조가 여전히 유효한가' 를 점검하면 불필요한 손실을 막을 수 있습니다."
            ),
            "금전 단정 금지 — 사주 흐름을 돈 관리 운영 성향으로 치환한 참고 문장.",
            easy_summary="쉽게 말하면, '크게 벌기' 보다 '새지 않게 정리하기' 가 올해의 키예요.",
        ),
        _section(
            "relation",
            "분야: 관계·연애",
            (
                "관계는 넓게 많이 늘리기보다, 말이 통하는 사람과 깊게 맞춰가는 쪽이 편합니다. "
                "부담스러운 요청은 즉답하기보다 한 박자 두고 정리해서 답하는 방식이 잘 맞고, 연애는 빠르게 불타오르는 구조보다 꾸준히 밀도를 쌓는 쪽이 올해 흐름과 어울립니다. "
                "기존 관계에서 오래 미뤄둔 대화를 다시 꺼낼 타이밍이 자연스럽게 찾아올 수 있어요."
            ),
            "관계 단정 금지 — 사주 톤을 관계 운영 방식으로 번역.",
            easy_summary="쉽게 말하면, '누군가와 빨리 가까워진다' 보다 '지금 사람들과 깊어진다' 가 어울리는 해예요.",
        ),
        _section(
            "health",
            "분야: 건강·컨디션",
            (
                "건강은 몸 상태 단정이 아니라 컨디션 관리 관점으로만 봅니다. "
                "올해는 루틴이 흐트러질 때 피로감이 커지기 쉬워 수면·수분·가벼운 움직임을 우선 챙기는 편이 좋아요. "
                "특정 달에 무리한 일정이 몰리면 회복 주기를 한 번씩 넣어주는 설계가 올해 흐름과 잘 맞습니다."
            ),
            "의료 단정 금지 — 오행 균형을 일상 컨디션 관리로 치환.",
            easy_summary="쉽게 말하면, 큰 대응보다 '회복 일정' 을 먼저 짜는 해예요.",
        ),
        _section(
            "learning",
            "분야: 학습·문서·자격",
            (
                "올해는 '정리 후 출력' 에 어울리는 기운이 강해, 학습한 것을 시험·문서·포트폴리오 형태로 밖에 꺼내는 활동이 특히 잘 맞습니다. "
                "자격증·면접·발표처럼 '형식 안에 결과를 담는 일' 에서 집중력이 안정적으로 나와요. "
                "새 분야를 파고드는 것보다 익숙한 분야의 정리·심화가 더 단단한 결과로 돌아옵니다."
            ),
            "세운의 '정리·완성' 톤을 학습 영역에 적용한 조언.",
            easy_summary="쉽게 말하면, 올해는 '새 공부 시작' 보다 '지금 아는 것 출력' 이 점수가 더 잘 나오는 해입니다.",
        ),
        _section(
            "checklist",
            "올해 운영 체크리스트",
            (
                "아래 5 가지는 올해 꾸준히 돌리면 좋은 간단한 체크리스트입니다. "
                "• 분기별(3개월마다) 현재 프로젝트·지출 구조 리뷰 1회. "
                "• 중요한 결정 전 48시간 '결정 유예 룰'. "
                "• 관계에서 답변 기한을 스스로 정해서 말하기 (침묵도 선택지로 유지). "
                "• 몸 루틴: 수면 시작 시간 ±30분 유지, 주 2회 가벼운 산책. "
                "• 매달 첫 주 '월별 흐름' 탭을 열어 그 달의 톤 한 번 확인. "
                "체크리스트는 완벽하게 지키는 게 아니라 '지금 놓치고 있는 항목' 을 알아차리는 용도예요."
            ),
            "세운·월운 흐름을 매일 운영 루틴으로 번역.",
            easy_summary="쉽게 말하면, '이 해를 낭비하지 않으려면 어느 박자를 지키면 되는가' 의 답입니다.",
        ),
        _section(
            "closing",
            "최종 한 줄",
            (
                f"{year}년은 '이미 가진 것을 다시 쓸모 있게 만드는 해' 입니다. "
                "새로 벌이는 크기로 평가하지 말고, 한 해가 지난 뒤 '무엇이 단단해졌는가' 를 기준으로 삼으면 흐름을 놓치지 않아요."
            ),
            "세운의 전반 톤을 한 줄로 압축한 마무리.",
            easy_summary="쉽게 말하면, 크기보다 밀도, 확장보다 완성의 해.",
        ),
    ]

    return {
        "period": "yearly",
        "year": year,
        "title": f"{year} 총운",
        "summary": lead_sentence,
        "keywords": [
            k for k in [
                f"{pillar} 세운",
                f"{score}점",
                yong and f"용신 {yong}",
                hee and f"희신 {hee}",
                "페이스 조절",
            ]
            if k
        ],
        "sections": sections,
        "months": [],
        "safety_notice": DEFAULT_SAFETY_NOTICE,
    }


# ═════════════════════════════════════════════
# MONTHLY — 12개월 흐름 (패턴 요약 + 월별 상세 확장)
# ═════════════════════════════════════════════
def _month_score(*, natal: dict, month_element: str, month_index: int) -> int:
    y = _yongshin(natal)
    counts = _element_counts(natal)
    yong = y.get("yongshin_element", "")
    hee = y.get("hee_shin_element", "")
    ki = y.get("ki_shin_element", "")
    score = 58
    if month_element == yong:
        score += 18
    if month_element == hee:
        score += 12
    if month_element == ki:
        score -= 14
    if counts.get(month_element, 0) == 0:
        score += 6
    elif counts.get(month_element, 0) >= 3:
        score -= 5
    # 너무 같은 점수가 반복되지 않게 월 순서 기반의 작은 결정론 보정.
    score += ((month_index * 7) % 9) - 4
    return max(35, min(92, score))


def _month_tone(score: int) -> str:
    if score >= 78:
        return "실행 적기"
    if score >= 66:
        return "정리·완성"
    if score >= 54:
        return "보통 흐름"
    return "보수 운영"


def _month_detail(
    *,
    label: str,
    ji: str,
    element: str,
    role: str,
    tone: str,
    yong: str,
    hee: str,
    ki: str,
) -> str:
    """월별 상세 3~5문장 — 오행 · 역할 · 용·희·기신 기준."""
    head = f"{label}은 지지 {ji}({element} · {role or '오행'}) 기운이 들어오는 달입니다. "
    if element == yong:
        body = (
            head
            + f"용신 {yong} 흐름이 직접 들어와, 올해 쌓아둔 것들 중 '결과로 꺼내기 좋은 한 가지' 를 이 달에 맞추면 완성도가 특히 올라가요. "
            "새 판을 열기보다 이미 준비된 일의 발표·마감·제출에 힘을 실어보세요. "
            "단 체력 관리 없이 몰아치면 다음 달 컨디션이 흔들릴 수 있으니, 중반 한 번은 휴식 블록을 잡아두는 편이 좋습니다."
        )
    elif element == hee:
        body = (
            head
            + f"희신 {hee} 기운이 들어와 용신 흐름을 보조하는 달이에요. "
            "큰 결단보다 '이미 벌여둔 일을 다듬는 작업' 과 합이 잘 맞습니다. "
            "대외 활동보다 내부 정리·구조 개편·협업 룰 만들기 같은 백오피스 작업이 이 달의 힘을 가장 잘 살립니다."
        )
    elif element == ki:
        body = (
            head
            + f"기신 {ki} 기운이 섞여 페이스 조절이 중심이 되는 달이에요. "
            "큰 결정을 내리기보다 일정·지출·기대치를 한 단계 낮춰 운영하는 편이 좋습니다. "
            "이 달에 발생하는 작은 마찰은 해석하지 말고 '지금 시기가 그런 달' 이라는 쪽으로 해석해 두면 에너지 소모를 줄일 수 있어요."
        )
    else:
        body = (
            head
            + f"{tone} 쪽에 가까운 달로, 원국과 큰 충돌 없이 평평하게 흐르는 구간이에요. "
            "평소 루틴을 유지하면서 '미뤄둔 체크리스트' 를 한두 개 해결하기에 잘 맞습니다. "
            "이 달에 너무 욕심을 내면 다른 달 흐름에 역효과가 올 수 있으니, 강약 조절을 의식해두세요."
        )
    return body


def _build_monthly_reading(*, natal: dict, year: int) -> dict:
    y = _yongshin(natal)
    yong = y.get("yongshin_element", "")
    hee = y.get("hee_shin_element", "")
    ki = y.get("ki_shin_element", "")
    dm_el = _day_master_element(natal)
    months: list[dict] = []
    best: dict | None = None
    caution: dict | None = None

    for idx, label in enumerate(_MONTH_NAMES, start=1):
        ji = _MONTH_JI_BY_SOLAR_MONTH[idx]
        element = JI_ELEMENT.get(ji, "")
        role = _role_for_element(dm_el, element)
        score = _month_score(natal=natal, month_element=element, month_index=idx)
        tone = _month_tone(score)
        detail = _month_detail(
            label=label,
            ji=ji,
            element=element,
            role=role,
            tone=tone,
            yong=yong,
            hee=hee,
            ki=ki,
        )
        if best is None or score > best["score"]:
            best = {"label": label, "score": score, "tone": tone}
        if caution is None or score < caution["score"]:
            caution = {"label": label, "score": score, "tone": tone}
        months.append(
            {
                "month": idx,
                "label": label,
                "score": score,
                "title": f"{label} · {tone}",
                "summary": f"{element}({role or '오행'}) 흐름이 들어오는 달 — {tone}",
                "detail": detail,
                "reason": "월지 오행과 원국의 용신·희신·기신·오행 분포를 함께 점수화했습니다.",
            }
        )

    # 고점·저점 3개월씩
    sorted_by_score = sorted(months, key=lambda m: -m["score"])
    top3 = sorted_by_score[:3]
    bottom3 = sorted(sorted_by_score[-3:], key=lambda m: m["score"])

    sections = [
        _section(
            "monthly_overview",
            "월별 흐름 요약",
            (
                f"{year}년 월별 흐름은 매달 들어오는 지지 오행을 기준으로 압축해서 봤어요. "
                "점수는 절대 평가가 아니라 '내 원국과 얼마나 무리 없이 맞물리는지' 를 보는 참고 지수이고, "
                "아래 12 개월 카드는 각 달의 지지 오행 + 용신·희신·기신 매칭 + 오행 분포 영향을 종합해 결정론으로 계산했습니다. "
                "실행 적기와 보수 운영 달을 구분해두면 한 해 체력 분배가 훨씬 단단해져요."
            ),
            "12 개월 월지 오행을 용신·희신·기신과 비교했습니다.",
            easy_summary="쉽게 말하면, '언제 밀고 언제 아낄지' 를 미리 짚어주는 지도입니다.",
        ),
        _section(
            "best_month",
            "활용하기 좋은 달",
            (
                f"가장 활용도가 높게 잡힌 달은 {best['label']}({best['score']}점)입니다. "
                "이 달에는 새로 벌이기보다 중요한 실행·발표·정리·마감에 힘을 실어보세요. "
                f"그 다음으로 좋게 잡힌 달은 {', '.join(m['label'] for m in top3[1:])} 입니다. "
                "이 세 달을 묶어 '상반기/하반기 각각 한 번씩은 이 흐름에 결과물을 맞춘다' 같은 룰을 정해두면 한 해가 훨씬 또렷해져요."
            ),
            "12 개월 점수 중 가장 높은 3 개월.",
            easy_summary="쉽게 말하면, '해야 한다면 이 달에' 를 알려주는 섹션이에요.",
        ),
        _section(
            "caution_month",
            "보수적으로 가기 좋은 달",
            (
                f"가장 조심스럽게 운영하기 좋은 달은 {caution['label']}({caution['score']}점)입니다. "
                "큰 결정보다 일정 여유·컨디션 관리·말의 속도 조절을 우선해보세요. "
                f"함께 주의 구간에 드는 달은 {', '.join(m['label'] for m in bottom3[1:])} 입니다. "
                "이 구간에는 '새로 벌이지 않는다 · 크게 약속하지 않는다' 두 가지만 지켜도 에너지 손실을 많이 줄일 수 있어요."
            ),
            "12 개월 점수 중 가장 낮은 3 개월.",
            easy_summary="쉽게 말하면, '이 달엔 페이스 먼저' 라고 적어두는 섹션이에요.",
        ),
        _section(
            "pattern_summary",
            "연간 패턴 요약",
            (
                f"{year}년 12 개월을 이어붙여 보면, 활용 구간({', '.join(m['label'] for m in top3)}) 와 "
                f"보수 구간({', '.join(m['label'] for m in bottom3)}) 이 해 중 번갈아 나타나는 리듬을 만듭니다. "
                "한 해를 통째로 보면 '실행 → 정리 → 재정비' 의 3 단계가 자연스럽게 반복되는 구조로, "
                "그 사이사이에 보통 흐름의 달이 끼어 체력 분배를 조절해주는 역할을 해요. "
                "연간 운영 팁은 — 활용 달에 결과물을 맞춰 밀고, 보수 달에는 체력·관계·지출을 복구하는 식으로 리듬을 교대로 가져가는 것이 가장 안전합니다."
            ),
            "12 개월 고점·저점 3 개씩 묶어 연 단위 운영 리듬을 요약.",
            easy_summary="쉽게 말하면, '이 해는 밀고·쉬고·다듬는 세 구간으로 돌아간다' 는 뜻이에요.",
        ),
    ]

    return {
        "period": "monthly",
        "year": year,
        "title": f"{year} 월별 흐름",
        "summary": f"{best['label']}은 활용, {caution['label']}은 보수 운영에 더 어울리는 흐름입니다.",
        "keywords": ["12개월", "월운", f"활용 {best['label']}", f"주의 {caution['label']}", "체력 분배"],
        "sections": sections,
        "months": months,
        "safety_notice": DEFAULT_SAFETY_NOTICE,
    }


def build_reading(
    *,
    period: PeriodLiteral,
    natal: dict,
    engine_version: str,
    year: int = 2026,
) -> dict:
    """P4.2 리딩 응답 생성 — natal 은 풀리딩(9섹션), yearly 는 8섹션+분야별5+체크리스트, monthly 는 12카드+패턴요약."""
    if period == "natal":
        payload = _build_natal_reading(natal=natal)
    elif period == "yearly":
        payload = _build_yearly_reading(natal=natal, year=year)
    elif period == "monthly":
        payload = _build_monthly_reading(natal=natal, year=year)
    else:
        raise ValueError(f"unsupported reading period: {period}")

    payload["engine_version"] = engine_version
    payload["template_version"] = READING_TEMPLATE_VERSION
    payload["natal_chart"] = natal
    payload["yongshin"] = _yongshin(natal)
    return payload
