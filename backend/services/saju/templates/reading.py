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

from backend.services.saju.engine.chart import (
    GAN,
    GAN_ELEMENT,
    JI,
    JI_ELEMENT,
    _month_pillar,
    _sexagenary_for_year,
)
from backend.services.saju.engine.sisung import (
    SISUNG_KOR,
    _element_relation,
    compute_sisung,
)
from backend.services.saju.engine.yongshin import build_yongshin_guidance
from backend.services.saju.templates.today import DEFAULT_SAFETY_NOTICE

READING_TEMPLATE_VERSION = "reading-v1.2"

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

_TEN_GOD_HINT = {
    "비견": "내 기준, 동료, 같은 편",
    "겁재": "경쟁, 나눔, 지출 분산",
    "식신": "꾸준한 생산, 루틴, 표현",
    "상관": "강한 표현, 돌파, 규칙 충돌",
    "정재": "안정적인 돈, 관리, 예산",
    "편재": "움직이는 돈, 기회, 확장",
    "정관": "질서, 책임, 평가",
    "편관": "압박, 도전, 위기 대응",
    "정인": "배움, 보호, 문서",
    "편인": "탐구, 직감, 특수 지식",
}

_BRANCH_MONTH_HINT = {
    "子": "생각과 감정이 깊어지는 물의 달이라, 내부 정리와 회복 루틴이 중요합니다.",
    "丑": "느리지만 현실감 있는 토의 달이라, 묵은 일을 정리하고 기준을 다시 세우기 좋습니다.",
    "寅": "새 흐름이 열리는 목의 달이라, 시작과 추진력은 좋지만 속도 조절이 필요합니다.",
    "卯": "관계와 조율이 살아나는 목의 달이라, 협업과 대화의 밀도가 중요해집니다.",
    "辰": "변화 전 정리되는 토의 달이라, 아직 완전히 확정되지 않은 일을 다듬기 좋습니다.",
    "巳": "빠르게 달아오르는 화의 달이라, 기회 포착은 좋지만 과열과 즉흥 결정을 조심해야 합니다.",
    "午": "화가 가장 선명한 달이라, 드러내고 실행하기 좋지만 체력 소모도 함께 커집니다.",
    "未": "결과를 정리하는 토의 달이라, 사람·돈·일의 경계를 차분히 다듬기 좋습니다.",
    "申": "기준과 성과가 살아나는 금의 달이라, 점검·평가·정교화에 힘이 실립니다.",
    "酉": "금의 완성도가 강한 달이라, 말과 결과물을 다듬고 불필요한 것을 덜어내기 좋습니다.",
    "戌": "마무리와 책임이 겹치는 토의 달이라, 오래 미룬 결정을 정리하기 좋습니다.",
    "亥": "깊은 물의 달이라, 회복·학습·관찰에는 좋지만 생각이 길어질 수 있습니다.",
}

_TEN_GOD_DOMAIN = {
    "비견": {
        "work": "내 기준이 강해져 독립적으로 밀고 가는 일에 좋지만, 협업에서는 역할 구분이 필요합니다.",
        "money": "지출이나 자원 분산이 생기기 쉬워 공동 비용과 구독을 점검하는 편이 좋습니다.",
        "relation": "비슷한 사람과 가까워지기 쉽지만, 고집 싸움으로 번지지 않게 조율이 필요합니다.",
        "health": "자기 페이스가 강해지는 만큼 수면·식사 리듬을 스스로 끊어먹지 않는 것이 중요합니다.",
    },
    "겁재": {
        "work": "경쟁과 비교가 커질 수 있어 성과 기준을 먼저 정해두면 흔들림이 줄어듭니다.",
        "money": "예상 밖 지출이나 나눠야 하는 비용이 생기기 쉬우니 큰 결제는 한 번 더 확인하세요.",
        "relation": "사람 사이 힘겨루기가 생기기 쉬워, 즉답보다 조건을 정리한 답변이 낫습니다.",
        "health": "무리해서 따라가려는 흐름이 생길 수 있어 회복 시간을 일정에 먼저 넣는 편이 좋습니다.",
    },
    "식신": {
        "work": "꾸준한 결과물, 글쓰기, 루틴형 작업에 힘이 붙습니다.",
        "money": "작은 수익 구조나 반복 관리에는 좋지만 큰 모험보다는 유지가 어울립니다.",
        "relation": "편안한 대화와 일상 공유가 관계를 부드럽게 만듭니다.",
        "health": "건강 루틴을 작게 시작하기 좋은 달입니다.",
    },
    "상관": {
        "work": "표현력과 돌파력은 좋아지지만 규칙·상사·평가와 부딪히지 않게 말의 강도를 조절하세요.",
        "money": "즉흥 구매나 과감한 선택이 커질 수 있어 비교 견적이 필요합니다.",
        "relation": "솔직함은 장점이지만 날카로운 말이 오래 남을 수 있습니다.",
        "health": "흥분도와 피로도가 함께 오르기 쉬워 중간 휴식이 중요합니다.",
    },
    "정재": {
        "work": "관리, 마감, 예산, 반복 운영처럼 안정적인 구조를 다듬기 좋습니다.",
        "money": "저축·예산·고정비 정리에 잘 맞는 달입니다.",
        "relation": "관계에서도 약속과 신뢰를 지키는 태도가 힘을 얻습니다.",
        "health": "규칙적인 수면과 식사처럼 기본 관리가 잘 먹힙니다.",
    },
    "편재": {
        "work": "외부 제안, 영업, 새 기회처럼 움직이는 흐름이 늘 수 있습니다.",
        "money": "수입 기회와 지출 가능성이 함께 커지므로 조건 확인이 중요합니다.",
        "relation": "사람을 통해 기회가 오지만 약속이 부담으로 바뀌지 않게 선을 정하세요.",
        "health": "활동량이 늘 수 있어 체력 배분이 필요합니다.",
    },
    "정관": {
        "work": "평가, 책임, 조직 안 역할을 정리하기 좋은 달입니다.",
        "money": "공식적인 계약이나 납부, 세금, 규칙을 확인하기 좋습니다.",
        "relation": "신뢰와 책임을 보여주는 행동이 관계 안정에 도움이 됩니다.",
        "health": "정해진 루틴을 지킬수록 컨디션이 안정됩니다.",
    },
    "편관": {
        "work": "압박이 있지만 집중력이 올라오는 달이라, 어려운 일을 짧게 끊어 처리하기 좋습니다.",
        "money": "위험한 선택은 피하고 비상 지출을 대비하는 편이 좋습니다.",
        "relation": "갈등을 이기려 하기보다 빠르게 구조를 정리하는 태도가 필요합니다.",
        "health": "긴장도가 올라가기 쉬워 몸을 풀어주는 루틴이 중요합니다.",
    },
    "정인": {
        "work": "문서, 학습, 자격, 도움받기에 좋은 달입니다.",
        "money": "새 투자보다 정보 수집과 기준 정리가 우선입니다.",
        "relation": "조언을 듣고 관계를 회복하는 흐름에 잘 맞습니다.",
        "health": "무리한 활동보다 회복과 수면의 질을 챙기기 좋습니다.",
    },
    "편인": {
        "work": "특수 지식, 기획, 연구처럼 깊이 파고드는 일에 좋습니다.",
        "money": "낯선 제안은 오래 검토하고, 검증되지 않은 정보는 거리를 두는 편이 좋습니다.",
        "relation": "혼자 정리하는 시간이 필요하지만 너무 오래 닫히지는 않게 하세요.",
        "health": "생각이 길어질 수 있어 가벼운 움직임으로 리듬을 끊어주는 것이 좋습니다.",
    },
}


def _topic(value: str) -> str:
    """한국어 주제 조사(은/는)를 자연스럽게 붙인다."""
    if not value:
        return "이 흐름은"
    last = value[-1]
    code = ord(last)
    if 0xAC00 <= code <= 0xD7A3:
        has_batchim = (code - 0xAC00) % 28 != 0
        return f"{value}{'은' if has_batchim else '는'}"
    return f"{value}은"


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
    if not isinstance(y, dict):
        return {}
    result = dict(y)
    if result and not result.get("guidance"):
        result["guidance"] = build_yongshin_guidance(
            yongshin=result,
            natal=natal,
        )
    return result


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


def _safe_sisung(day_master: str, target: str, *, is_ji: bool = False) -> str:
    if not day_master or not target:
        return ""
    try:
        return compute_sisung(day_master_gan=day_master, target=target, is_ji=is_ji)
    except KeyError:
        return ""


def _ten_god_hint(name: str) -> str:
    if not name:
        return ""
    return _TEN_GOD_HINT.get(name) or SISUNG_KOR.get(name, {}).get("short", "")


def _month_pillar_info(*, year: int, month: int, day_master: str) -> dict[str, str]:
    year_gan, _ = _sexagenary_for_year(year)
    gan, ji = _month_pillar(year_gan, month)
    return {
        "gan": gan,
        "ji": ji,
        "pillar": gan + ji,
        "gan_element": GAN_ELEMENT.get(gan, ""),
        "ji_element": JI_ELEMENT.get(ji, ""),
        "stem_ten_god": _safe_sisung(day_master, gan),
        "branch_ten_god": _safe_sisung(day_master, ji, is_ji=True),
    }


def _month_action_hints(*, stem_ten_god: str, branch_ten_god: str, tone: str) -> list[str]:
    hints: list[str] = []
    if stem_ten_god in {"정재", "편재"} or branch_ten_god in {"정재", "편재"}:
        hints.append("돈과 약속이 걸린 일은 조건을 문서로 남기세요.")
    if stem_ten_god in {"정관", "편관"} or branch_ten_god in {"정관", "편관"}:
        hints.append("책임이 커지는 달이므로 마감과 역할 범위를 먼저 정하세요.")
    if stem_ten_god in {"식신", "상관"} or branch_ten_god in {"식신", "상관"}:
        hints.append("말·글·결과물을 밖으로 꺼내되, 표현의 강도는 한 번 낮춰 보세요.")
    if stem_ten_god in {"정인", "편인"} or branch_ten_god in {"정인", "편인"}:
        hints.append("새 결정보다 자료 수집과 정리에 시간을 쓰면 안정적입니다.")
    if stem_ten_god in {"비견", "겁재"} or branch_ten_god in {"비견", "겁재"}:
        hints.append("협업과 경쟁이 함께 오니 내 몫과 상대 몫을 분리해두세요.")
    if tone == "보수 운영":
        hints.append("큰 시작보다 일정·지출·컨디션을 작게 줄이는 쪽이 좋습니다.")
    if not hints:
        hints.append("이번 달은 루틴을 유지하면서 미뤄둔 체크리스트를 하나 끝내세요.")
    return hints[:3]


def _month_reason_label(month: dict) -> str:
    ganji = month.get("ganji", "")
    stem = month.get("stem_ten_god", "")
    branch = month.get("branch_ten_god", "")
    return f"{month['label']}({ganji}·월간 {stem or '-'}·월지 {branch or '-'})"


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
        f"[기본 성향] 일간 {day_master}({dm_el})의 바탕은 '{trait}' 쪽에 가까워요. 겉으로 빠르게 반응하기보다 먼저 관찰하고, 상황이 어떤 구조로 움직이는지 안쪽에서 오래 맞춰보는 편입니다. 그래서 가볍게 흘러가는 말보다 맥락이 있는 대화, 이유가 분명한 일, 스스로 납득되는 목표에서 집중력이 훨씬 잘 살아나요.\n\n"
        f"[생각의 깊이] 이 원국은 표면적인 분위기보다 보이지 않는 신호를 더 많이 읽습니다. 상대의 말투, 일의 흐름, 결과가 어긋나는 지점을 빨리 감지하는 대신 머릿속 처리량이 많아져 피로가 쌓일 수 있어요. 생각이 깊다는 장점은 분명하지만, 정리하지 않고 계속 품고 있으면 결정을 늦추는 원인이 되기도 합니다.\n\n"
        f"[표현 방식] 용신 {yong_el or '보완 기운'}({yong_role or '흐름'})이 살아날 때 자기 이야기를 밖으로 꺼내는 힘이 열립니다. 이 사람은 아무 말이나 많이 하는 타입이라기보다, 충분히 생각한 뒤 자기 언어로 정리할 때 설득력이 생겨요. 글, 기획, 설명, 결과물처럼 '생각이 형태를 갖는 방식'이 특히 중요합니다.\n\n"
        f"[현실 감지] 원국에서 {top_el} 기운이 두드러져 외부 압박이나 기준 변화에 민감하게 반응합니다. 그래서 책임이 생기면 대충 넘기지 못하고, 작은 결함도 혼자 오래 신경 쓸 수 있어요. 이 민감함은 단점만은 아니고, 남들이 놓친 디테일을 잡아내는 실력으로 바뀔 수 있습니다.\n\n"
        f"[리듬 관리] 부족한 {low_el} 기운은 생활 속에서 의식적으로 보강할수록 안정됩니다. 머리로 버티는 힘은 강하지만 몸과 감정의 리듬이 따라오지 못하면 어느 순간 급격히 지칠 수 있어요. 그래서 이 원국은 '더 세게 하기'보다 '작게 나누고 꾸준히 꺼내기'가 훨씬 잘 맞습니다."
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
            f"[안쪽 충돌] 머리는 끝까지 가고 싶은데 환경이나 체력이 그 속도를 바로 받쳐주지 못하는 구조예요. {top_el} 기운이 강하게 들어오면 '해야 한다'는 압박은 커지는데, 그것을 오래 유지할 자원({low_el})은 쉽게 소모될 수 있습니다.\n\n"
            " [반복 패턴] 그래서 마음이 급할수록 더 많이 붙잡고, 더 많이 검토하고, 혼자 책임지려는 흐름이 생기기 쉬워요. 겉으로는 묵묵히 해내는 사람처럼 보이지만 안쪽에서는 피로와 긴장이 누적될 수 있습니다.\n\n"
            " [해결 방향] 이 구조는 의지가 약하다는 뜻이 아니라, 에너지 배분이 중요한 타입이라는 뜻입니다. 처음부터 크게 버티려 하지 말고, 중요한 일을 작은 단위로 쪼개서 자주 회복하며 가는 방식이 훨씬 안정적입니다."
        )
        easy = "쉽게 말하면, '하고 싶은 만큼 다 할 수 있는 사람' 이라기보다 '선택과 보존이 같이 필요한 사람' 입니다."
    elif sin_gang == "strong":
        body = (
            f"[안쪽 충돌] 자기 힘은 충분한데 그 힘을 어디로 써야 할지 정리되지 않으면 답답함이 커지는 구조예요. {top_el} 기운이 이미 넉넉해서 안쪽 에너지는 강하지만, 밖으로 꺼내는 통로가 좁으면 스스로도 무겁게 느낄 수 있습니다.\n\n"
            " [반복 패턴] 생각이 많아질수록 행동이 늦어지고, 행동하지 않으면 다시 생각이 더 많아지는 순환이 생길 수 있어요. 반대로 방향이 잡히면 밀어붙이는 힘은 꽤 강하게 살아납니다.\n\n"
            " [해결 방향] 이 사주는 힘을 줄이는 것보다 출구를 만드는 쪽이 중요합니다. 말, 글, 운동, 프로젝트, 발표처럼 에너지가 바깥으로 빠져나갈 작은 통로를 꾸준히 만들어두면 장점이 훨씬 선명해져요."
        )
        easy = "쉽게 말하면, 엔진은 준비돼 있는데 운전대가 좁은 사람. 통로를 만들어두면 움직임이 선명해져요."
    else:
        body = (
            f"[안쪽 충돌] 겉으로는 균형에 가까워 보여도, 실제 체감은 익숙한 {top_el} 흐름과 낯선 {low_el} 흐름 사이에서 흔들릴 수 있어요. 잘하는 방식은 분명한데, 그 방식만 반복하면 금방 답답해지고 새로운 방식은 시작할 때 부담이 생깁니다.\n\n"
            " [반복 패턴] 안정적인 사람처럼 보이다가도 어느 순간 '이렇게 계속해도 되나' 하는 질문이 올라올 수 있습니다. 같은 하루의 반복에는 쉽게 지치고, 너무 큰 변화 앞에서는 준비 시간이 필요해요.\n\n"
            " [해결 방향] 이 구조는 익숙함과 새로움 중 하나를 버리라는 뜻이 아닙니다. 익숙한 방식으로 기반을 잡고, 낯선 시도를 아주 작은 단위로 섞어야 오래 갑니다. 작게 바꾸고 오래 유지하는 전략이 가장 잘 맞습니다."
        )
        easy = "쉽게 말하면, 안정적인 듯 보이지만 '같은 하루의 반복' 에 가장 지치는 사람 입니다."
    return body, easy


def _natal_strengths(*, dm_el: str, y: dict) -> tuple[str, str]:
    yong_role = y.get("yongshin_role", "")
    yong_el = y.get("yongshin_element", "")
    hee_el = y.get("hee_shin_element", "")
    style = _ROLE_STYLE.get(yong_role, "균형을 맞추는 방식이 중요한 편")
    body = (
        f"[실력의 모양] 강점은 집중이 필요한 일, 긴 호흡의 분석, 남이 놓친 맥락을 찾아내는 일에서 선명하게 드러납니다. 빠르게 분위기만 타는 것보다, 한 번 이해한 것을 자기 방식으로 구조화하고 다시 설명하는 힘이 좋아요.\n\n"
        f"[용신이 열릴 때] 용신 {yong_el}({yong_role}) 흐름이 열리면 {style}입니다. 이때는 생각이 머릿속에만 머무르지 않고 말, 글, 설계, 결과물로 바뀌기 쉬워요. 무리하게 밀어붙이는 방식보다 자기 리듬을 찾아 주 단위·월 단위로 쌓을 때 결과가 단단해집니다.\n\n"
        f"[희신의 도움] 희신 {hee_el} 기운은 이 강점을 현실에서 쓰기 쉽게 도와주는 보조로 봅니다. 좋은 생각을 갖고 끝나는 것이 아니라, 보여주고 전달하고 마무리하는 쪽으로 연결해줘요.\n\n"
        "[잘 맞는 자리] 사람을 즉흥적으로 움직이는 일보다, 구조를 짜고 기준을 세우고 끝까지 다듬는 자리에서 완성도가 나옵니다. 기획, 분석, 개발, 문서화, 교육, 콘텐츠, 시스템 설계처럼 생각을 형태로 바꾸는 일과 잘 맞습니다."
    )
    easy = "쉽게 말하면, '한 번에 크게' 보다 '오래 쌓아 단단하게' 가 훨씬 어울리는 사람이에요."
    return body, easy


def _natal_cautions(*, counts: dict, y: dict) -> tuple[str, str]:
    top_el, low_el = _top_and_low_elements(counts)
    ki_el = y.get("ki_shin_element", "")
    body = (
        f"[주의 패턴] 주의점은 외부 압박({top_el}) 앞에서 자기 페이스를 잃기 쉽다는 점이에요. 책임감이 올라오면 대충 넘기지 못하고, 작은 일도 혼자 크게 떠안는 방식으로 번질 수 있습니다.\n\n"
        f"[기신이 자극될 때] 기신 {ki_el} 기운이 들어오는 시기나 환경에서는 '더 열심히 하면 해결된다'는 충동이 생길 수 있어요. 하지만 이 원국은 무조건 세게 밀어붙일수록 좋아지는 구조가 아니라, 어느 지점에서 멈추고 정리해야 다시 오래 갈 수 있는 구조입니다.\n\n"
        f"[체력과 감정] 부족한 {low_el} 기운이 비축되지 않은 상태에서 결과만 계속 요구하면 번아웃이 빠르게 올 수 있어요. 몸은 아직 따라오지 못했는데 머리만 앞서가면 예민함, 무기력, 결정 지연이 같이 올라올 수 있습니다.\n\n"
        "[안전한 운영] 완벽하게 끝내려는 욕심보다 중간 점검과 짧은 정리 시간을 먼저 일정에 넣는 편이 안정적입니다. 오늘 끝낼 일, 이번 주에 볼 일, 다음 달까지 가져갈 일을 분리하면 압박이 실력으로 바뀝니다."
    )
    easy = "쉽게 말하면, '더 세게 밀어붙이기' 가 답이 아니라 '더 영리하게 나눠쓰기' 가 답인 날이 많아요."
    return body, easy


def _natal_relation(*, dm_el: str, y: dict) -> tuple[str, str]:
    yong_role = y.get("yongshin_role", "")
    body = (
        "[관계의 속도] 관계 스타일은 넓게 여러 명을 만나기보다, 몇 사람과 깊게 오래 이어지는 쪽에 가깝습니다. 처음부터 마음을 활짝 여는 타입이라기보다 상대를 관찰하고, 신뢰가 쌓인 뒤 자기 이야기를 천천히 꺼내는 편이에요.\n\n"
        "[표현 방식] 말이 많은 자리보다 말이 오래 남는 자리에서 편안함을 느낍니다. 가벼운 리액션이 부족해 보일 수 있지만, 실제로는 상대의 말과 분위기를 안쪽에서 오래 처리하는 쪽에 가까워요.\n\n"
        "[갈등 처리] 갈등 상황에서는 즉답보다 한 박자 두고 정리해서 답하는 방식이 잘 맞습니다. 다만 생각을 너무 오래 안에 두면 상대가 답답해할 수 있으니, '지금 바로 답하기 어렵지만 언제까지 말하겠다'처럼 기한을 말해두는 것이 관계 안정에 도움이 됩니다.\n\n"
        f"[자기 색] {yong_role or '용신'} 기운이 살아날 때 관계에서 자기 색이 가장 자연스럽게 드러납니다. 억지로 밝아지려 하기보다, 자기 방식의 표현을 조금 더 자주 보여주는 쪽이 훨씬 오래 갑니다."
    )
    easy = "쉽게 말하면, '빨리 대답' 보다 '정리된 한마디' 로 사람을 오래 곁에 두는 타입이에요."
    return body, easy


def _natal_work(*, counts: dict, y: dict) -> tuple[str, str]:
    top_el, _ = _top_and_low_elements(counts)
    yong_role = y.get("yongshin_role", "")
    body = (
        "[업무 리듬] 일하는 방식은 '자료 수집 → 구조 잡기 → 작은 결과물 → 피드백 → 수정'의 흐름이 잘 맞습니다. 처음부터 완성본을 만들려고 하면 부담이 커지고, 작은 초안을 먼저 꺼내면 오히려 완성도가 빨리 올라가요.\n\n"
        "[집중이 켜지는 조건] 중간에 맥락이 충분히 이해되지 않으면 속도를 더 내기보다 멈춰서 흐름을 다시 보는 편입니다. 그래서 급하게 몰아붙이는 환경보다 역할, 기준, 마감, 피드백 루프가 있는 프로젝트에서 성과가 안정적이에요.\n\n"
        f"[디테일 감각] 원국에서 {top_el} 기운이 두드러져, 결과 기준이 명확한 일에서는 남이 놓친 디테일까지 챙기는 집중력이 나옵니다. 이 힘은 비판만 하는 힘이 아니라, 결과물을 더 단단하게 다듬는 힘으로 쓰면 강점이 됩니다.\n\n"
        f"[생산성 포인트] {yong_role or '용신'} 흐름이 잡힌 팀·환경에서는 자기 역할이 선명해지면서 생산성이 올라갑니다. 혼자 오래 고민하는 시간과 밖으로 보여주는 시간을 분리해두면, 생각이 실제 결과로 바뀌는 속도가 빨라집니다."
    )
    easy = "쉽게 말하면, 빨리 반응하는 일보다 구조 잡고 정리하는 일에서 실력이 더 잘 드러나는 사람이에요."
    return body, easy


def _natal_recovery(*, dm_el: str, counts: dict) -> tuple[str, str]:
    _, low_el = _top_and_low_elements(counts)
    body = (
        "[회복 신호] 회복은 사람 사이에서 에너지를 크게 받기보다 자기 안쪽에서 천천히 이뤄지는 편입니다. 말수가 줄거나 혼자 있는 시간이 길어진다면 단순히 기분이 가라앉은 것이 아니라, 안쪽에서 정보를 정리하고 피로를 회수하는 신호일 수 있어요.\n\n"
        f"[보강 포인트] 부족한 기운({low_el}) 쪽을 생활 루틴에 얹어두면 안정감이 좋아집니다. 거창한 변화보다 가벼운 산책, 물 섭취 리듬, 잠들기 전 짧은 정리 시간, 다음 날 할 일 세 줄 적기 같은 작은 반복이 오래 갑니다.\n\n"
        "[피해야 할 회복법] 무리해서 활동적인 휴식을 잡거나 사람을 많이 만나서 풀려고 하면 오히려 더 피곤해질 수 있습니다. 이 원국은 '방해받지 않는 혼자만의 30분'처럼 작고 조용한 회복 블록이 실제 에너지 회복에 잘 맞아요.\n\n"
        "[생활 적용] 회복을 기분이 무너진 뒤에 잡기보다 일정 안에 먼저 넣어두는 것이 좋습니다. 하루 끝에 생각을 비우는 루틴, 주 1회 정리 시간, 작업 사이 짧은 멈춤이 쌓이면 전체 리듬이 훨씬 안정됩니다."
    )
    easy = "쉽게 말하면, 거창한 리프레시보다 '혼자 있는 30분' 하나가 진짜 회복인 사람이에요."
    return body, easy


def _natal_closing(*, day_master: str, y: dict, counts: dict) -> tuple[str, str]:
    """총평 5줄 — 앞의 섹션들을 한 문단으로 묶는 마무리."""
    yong_el = y.get("yongshin_element", "")
    yong_role = y.get("yongshin_role", "")
    top_el, low_el = _top_and_low_elements(counts)
    body = (
        f"[핵심 요약] {day_master}일간의 기본 리듬은 '깊게 보고, 내 방식으로 정리하고, 오래 쌓아가는' 쪽에 있습니다. 겉으로는 조용해 보여도 안쪽에서는 계속 관찰하고 비교하고 의미를 정리하는 힘이 돌아가요.\n\n"
        f"[살아나는 방향] 용신 {yong_el}({yong_role}) 흐름이 열리면 자기다움이 가장 선명해집니다. 생각을 머릿속에만 두지 않고 말, 글, 결과물, 루틴으로 꺼낼 때 이 사주의 장점이 현실에서 보이기 시작해요.\n\n"
        f"[조심할 방향] 반대로 {top_el} 기운이 과해지는 구간에서는 페이스 조절이 곧 자기 보호가 됩니다. 더 많이 버티는 것보다 지금 어디서 에너지가 새는지 보는 것이 중요하고, 부족한 {low_el} 쪽을 생활 루틴에 미리 얹어두면 불균형이 커지기 전에 중심이 잡힙니다.\n\n"
        "[마지막 한 줄] 결론적으로 이 원국은 '크게 한 번'보다 '작게 꺼내고 오래 다듬기'가 가장 잘 맞습니다. 깊게 파되 늦게 꺼내지 말고, 작은 형태로 계속 보여줄수록 자기 색이 강해지는 사람입니다."
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
    day_master = natal.get("day_master", "")
    dm_el = _day_master_element(natal)
    gan_ten_god = _safe_sisung(day_master, year_info["gan"])
    ji_ten_god = _safe_sisung(day_master, year_info["ji"], is_ji=True)
    gan_hint = _ten_god_hint(gan_ten_god)
    ji_hint = _ten_god_hint(ji_ten_god)
    natal_month = natal.get("month") or {}
    natal_day = natal.get("day") or {}

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
        f"올해 세운은 {pillar}이고, 천간 {year_info['gan']}은 {gan_ten_god or gan_el}"
        f"({gan_hint or gan_el}), 지지 {year_info['ji']}는 {ji_ten_god or ji_el}({ji_hint or ji_el})로 작동해요. "
        f"참고 지수는 {score}점 — 절대 평가가 아니라 원국과 얼마나 무리 없이 맞물리는지 보는 지표입니다. "
        "크게 새로 벌이기보다 쌓아둔 것을 쓸모 있게 정리하는 리듬이 이 해의 기본 톤입니다."
    )

    flow_body = (
        f"세운의 천간 {year_info['gan']}({gan_ten_god or gan_el}) "
        f"과 지지 {year_info['ji']}({ji_ten_god or ji_el}) 의 조합은 "
        f"한마디로 '균형을 재정비하라는 해' 로 읽힙니다. "
        f"원국이 {sin_gang} 쪽에 기울어 있어, 무리한 확장보다 중심에서 멀어진 것들을 한 발짝 가깝게 당기는 운영이 이 흐름과 잘 맞아요. "
        "아직 못 끝낸 것, 미뤄둔 점검, 오래 들고 있던 질문을 하나씩 마주하기 좋은 해입니다."
    )
    flow_easy = "쉽게 말하면, 올해는 '새로 시작하는 해' 보다 '미뤄둔 것 갚아가는 해' 에 가깝습니다."

    role_body = (
        f"일간 {day_master}({dm_el}) 기준으로 보면, {year}년의 겉으로 드러나는 힘은 "
        f"연간 {year_info['gan']}의 {gan_ten_god or '역할'}입니다. "
        f"{_topic(gan_ten_god)} {_TEN_GOD_HINT.get(gan_ten_god, '올해 바깥 사건의 성격')} 쪽으로 나타나기 쉬워요. "
        f"생활에서 반복 체감되는 바닥 흐름은 연지 {year_info['ji']}의 {ji_ten_god or '역할'}입니다. "
        f"{_topic(ji_ten_god)} {_TEN_GOD_HINT.get(ji_ten_god, '생활 리듬의 성격')}을 건드리므로, 올해는 겉의 기회와 실제 생활 리듬을 따로 보면서 운영하는 편이 좋습니다."
    )
    role_easy = (
        f"쉽게 말하면, {year}년은 바깥에서는 {gan_ten_god or gan_el}, "
        f"생활 안쪽에서는 {ji_ten_god or ji_el} 흐름이 반복되는 해예요."
    )

    natal_contact_body = (
        f"원국과 만나는 지점은 월주와 일지가 핵심입니다. "
        f"월주는 사회생활과 일의 자리라, 현재 월주 {natal_month.get('pillar', '원국 월주')}의 "
        f"{natal_month.get('sisung_gan') or natal_month.get('sisung_ji') or '역할'} 흐름 위에 "
        f"세운 {pillar}이 얹히는 방식으로 봅니다. "
        f"일지는 생활 리듬과 가까운 자리라, 일지 {natal_day.get('ji', '')}와 올해 지지 {year_info['ji']}가 "
        "생활 습관, 관계 거리감, 체력 배분에서 체감되기 쉽습니다. "
        "현재 엔진은 절기 정밀 보정을 단순화하므로, 경계일 출생자는 참고 범위를 조금 넓게 보는 것이 안전합니다."
    )

    half_year_body = (
        "상반기는 새 일을 크게 벌이기보다 이미 가진 재료를 정리하고, 발표·제출·마감이 가능한 형태로 만드는 데 힘을 쓰기 좋습니다. "
        f"특히 연간 {year_info['gan']}({gan_ten_god or gan_el}) 흐름은 바깥에서 보이는 사건을 만들기 때문에, 상반기에는 약속·역할·돈·결과물처럼 눈에 보이는 기준을 먼저 잡아두는 편이 안정적이에요. "
        f"하반기는 연지 {year_info['ji']}({ji_ten_god or ji_el}) 흐름이 생활 안쪽에서 더 체감되므로, 체력·관계 거리·반복 루틴을 조정하는 쪽이 중요해집니다. "
        "올해는 처음부터 12개월을 모두 같은 속도로 뛰기보다, 상반기에는 구조를 만들고 하반기에는 유지·수정하는 식으로 나누는 전략이 잘 맞습니다."
    )

    month_digest_body = (
        "월별 흐름을 아주 압축하면, 봄에는 시작과 정리의 재료가 생기고 여름에는 표현·재성 흐름이 강해져 활동량과 지출 가능성이 함께 커집니다. "
        "가을에는 결과물의 기준을 다듬고 평가받는 흐름이 살아나며, 겨울에는 회복·학습·내부 정리가 중요해져요. "
        "정확한 활용 달과 보수 달은 월별 흐름 탭에서 월간/월지 십성까지 나눠 보여주므로, 올해 총운은 큰 전략 지도, 월운은 실제 운영표처럼 같이 보면 좋습니다."
    )

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
            "year_role",
            "나에게 들어오는 핵심 십성",
            role_body,
            f"일간 {day_master} 기준으로 연간 {year_info['gan']}과 연지 {year_info['ji']}의 십성을 계산했습니다.",
            easy_summary=role_easy,
        ),
        _section(
            "natal_contact",
            "원국과 만나는 지점",
            natal_contact_body,
            "월주는 사회생활, 일지는 생활 리듬 자리로 보고 세운 지지와 함께 해석했습니다.",
            easy_summary="쉽게 말하면, 올해 기운이 일·관계·생활 리듬 중 어디에서 체감될지 보는 부분이에요.",
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
            "half_year_strategy",
            "상반기·하반기 운영 전략",
            half_year_body,
            "연간은 바깥 사건, 연지는 생활 리듬으로 보고 1년을 앞뒤 두 구간으로 나눠 해석했습니다.",
            easy_summary="쉽게 말하면, 상반기는 판을 정리하고 하반기는 리듬을 유지·수정하는 해입니다.",
        ),
        _section(
            "monthly_digest",
            "2026 월별 흐름 압축",
            month_digest_body,
            "월운 상세는 별도 monthly API에서 월간·월지 십성까지 계산하므로, 총운에서는 계절별 큰 흐름만 압축했습니다.",
            easy_summary="쉽게 말하면, 총운은 큰 지도이고 월운은 실제 달력입니다.",
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
                gan_ten_god and f"연간 {gan_ten_god}",
                ji_ten_god and f"연지 {ji_ten_god}",
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
    gan: str,
    ji: str,
    element: str,
    role: str,
    tone: str,
    yong: str,
    hee: str,
    ki: str,
    stem_ten_god: str,
    branch_ten_god: str,
    evidence: list[str],
    action_hints: list[str],
) -> str:
    """월별 상세 3~5문장 — 월간/월지 십성 · 오행 · 용·희·기신 기준."""
    stem_hint = _ten_god_hint(stem_ten_god)
    branch_hint = _ten_god_hint(branch_ten_god)
    head = (
        f"{label}은 {gan}{ji}월입니다. "
        f"월간 {gan}은 {stem_ten_god or '오행'}"
        f"{f'({stem_hint})' if stem_hint else ''}로 겉으로 드러나는 사건을 만들고, "
        f"월지 {ji}는 {branch_ten_god or role or '오행'}"
        f"{f'({branch_hint})' if branch_hint else ''}로 실제 생활 리듬을 움직입니다. "
    )
    if element == yong:
        body = (
            head
            + f"월지 오행은 {element}이고, 대표 용신({yong})과 맞아 올해 쌓아둔 것들 중 '결과로 꺼내기 좋은 한 가지'를 이 달에 맞추면 완성도가 특히 올라가요. "
            "새 판을 열기보다 이미 준비된 일의 발표·마감·제출에 힘을 실어보세요. "
            "단 체력 관리 없이 몰아치면 다음 달 컨디션이 흔들릴 수 있으니, 중반 한 번은 휴식 블록을 잡아두는 편이 좋습니다."
        )
    elif element == hee:
        body = (
            head
            + f"월지 오행은 {element}이고, 희신({hee})과 맞아 용신 흐름을 보조하는 달이에요. "
            "큰 결단보다 '이미 벌여둔 일을 다듬는 작업' 과 합이 잘 맞습니다. "
            "대외 활동보다 내부 정리·구조 개편·협업 룰 만들기 같은 백오피스 작업이 이 달의 힘을 가장 잘 살립니다."
        )
    elif element == ki:
        body = (
            head
            + f"월지 오행은 {element}이고, 기신({ki})과 맞물려 페이스 조절이 중심이 되는 달이에요. "
            "큰 결정을 내리기보다 일정·지출·기대치를 한 단계 낮춰 운영하는 편이 좋습니다. "
            "이 달에 발생하는 작은 마찰은 해석하지 말고 '지금 시기가 그런 달' 이라는 쪽으로 해석해 두면 에너지 소모를 줄일 수 있어요."
        )
    else:
        body = (
            head
            + f"월지 오행은 {element}이고, 용신·희신·기신과 직접 맞물리지는 않아 {tone} 쪽에 가까운 달로 봅니다. "
            "평소 루틴을 유지하면서 '미뤄둔 체크리스트' 를 한두 개 해결하기에 잘 맞습니다. "
            "이 달에 너무 욕심을 내면 다른 달 흐름에 역효과가 올 수 있으니, 강약 조절을 의식해두세요."
        )
    body += " 왜 이렇게 보냐면 " + " ".join(evidence[:2])
    body += " 이번 달 행동 조언은 " + " / ".join(action_hints) + " 입니다."
    return body


def _build_monthly_reading(*, natal: dict, year: int) -> dict:
    y = _yongshin(natal)
    yong = y.get("yongshin_element", "")
    hee = y.get("hee_shin_element", "")
    ki = y.get("ki_shin_element", "")
    dm_el = _day_master_element(natal)
    day_master = natal.get("day_master", "")
    months: list[dict] = []
    best: dict | None = None
    caution: dict | None = None

    for idx, label in enumerate(_MONTH_NAMES, start=1):
        info = _month_pillar_info(year=year, month=idx, day_master=day_master)
        gan = info["gan"]
        ji = info["ji"]
        ganji = info["pillar"]
        element = info["ji_element"] or JI_ELEMENT.get(_MONTH_JI_BY_SOLAR_MONTH[idx], "")
        role = info["branch_ten_god"] or _role_for_element(dm_el, element)
        score = _month_score(natal=natal, month_element=element, month_index=idx)
        tone = _month_tone(score)
        stem_ten_god = info["stem_ten_god"]
        branch_ten_god = info["branch_ten_god"]
        evidence = [
            (
                f"월간 {gan}은 일간 {day_master} 기준 {stem_ten_god or '오행'}"
                f"({_ten_god_hint(stem_ten_god) or info['gan_element']})입니다."
            ),
            (
                f"월지 {ji}는 일간 {day_master} 기준 {branch_ten_god or role or '오행'}"
                f"({_ten_god_hint(branch_ten_god) or element})입니다."
            ),
            f"월지 오행은 {element}이고, 용신({yong or '-'})·희신({hee or '-'})·기신({ki or '-'}) 기준과 비교했습니다.",
            _BRANCH_MONTH_HINT.get(ji, ""),
        ]
        evidence = [item for item in evidence if item]
        domain_source = branch_ten_god or stem_ten_god
        domain_readings = dict(_TEN_GOD_DOMAIN.get(domain_source, {}))
        action_hints = _month_action_hints(
            stem_ten_god=stem_ten_god,
            branch_ten_god=branch_ten_god,
            tone=tone,
        )
        detail = _month_detail(
            label=label,
            gan=gan,
            ji=ji,
            element=element,
            role=role,
            tone=tone,
            yong=yong,
            hee=hee,
            ki=ki,
            stem_ten_god=stem_ten_god,
            branch_ten_god=branch_ten_god,
            evidence=evidence,
            action_hints=action_hints,
        )
        month_payload = {
            "month": idx,
            "label": label,
            "score": score,
            "title": f"{label} · {ganji} · {tone}",
            "summary": (
                f"월간 {stem_ten_god or info['gan_element']} / "
                f"월지 {branch_ten_god or role or element} 흐름 — {tone}"
            ),
            "detail": detail,
            "reason": " ".join(evidence[:3]),
            "ganji": ganji,
            "stem_ten_god": stem_ten_god,
            "branch_ten_god": branch_ten_god,
            "evidence": evidence,
            "domain_readings": domain_readings,
            "action_hints": action_hints,
        }
        if best is None or score > best["score"]:
            best = month_payload
        if caution is None or score < caution["score"]:
            caution = month_payload
        months.append(month_payload)

    # 고점·저점 3개월씩
    sorted_by_score = sorted(months, key=lambda m: -m["score"])
    top3 = sorted_by_score[:3]
    bottom3 = sorted(sorted_by_score[-3:], key=lambda m: m["score"])

    sections = [
        _section(
            "monthly_overview",
            "월별 흐름 요약",
            (
                f"{year}년 월별 흐름은 매달 들어오는 월간과 월지를 함께 봅니다. "
                "점수는 절대 평가가 아니라 '내 원국과 얼마나 무리 없이 맞물리는지' 를 보는 참고 지수이고, "
                "아래 12 개월 카드는 각 달의 월간 십성, 월지 십성, 지지 오행, 용신·희신·기신 매칭, 오행 분포 영향을 종합해 결정론으로 계산했습니다. "
                "실행 적기와 보수 운영 달을 구분해두면 한 해 체력 분배가 훨씬 단단해져요."
            ),
            "12 개월 월간·월지를 일간 기준 십성으로 계산하고 용신·희신·기신과 비교했습니다.",
            easy_summary="쉽게 말하면, '언제 밀고 언제 아낄지' 를 미리 짚어주는 지도입니다.",
        ),
        _section(
            "best_month",
            "활용하기 좋은 달",
            (
                f"가장 활용도가 높게 잡힌 달은 {_month_reason_label(best)} {best['score']}점입니다. "
                f"이유는 {best['reason']} "
                "이 달에는 새로 벌이기보다 중요한 실행·발표·정리·마감에 힘을 실어보세요. "
                f"그 다음으로 좋게 잡힌 달은 {', '.join(_month_reason_label(m) for m in top3[1:])} 입니다. "
                "이 세 달을 묶어 '상반기/하반기 각각 한 번씩은 이 흐름에 결과물을 맞춘다' 같은 룰을 정해두면 한 해가 훨씬 또렷해져요."
            ),
            "12 개월 점수 중 가장 높은 3 개월.",
            easy_summary="쉽게 말하면, '해야 한다면 이 달에' 를 알려주는 섹션이에요.",
        ),
        _section(
            "caution_month",
            "보수적으로 가기 좋은 달",
            (
                f"가장 조심스럽게 운영하기 좋은 달은 {_month_reason_label(caution)} {caution['score']}점입니다. "
                f"이유는 {caution['reason']} "
                "큰 결정보다 일정 여유·컨디션 관리·말의 속도 조절을 우선해보세요. "
                f"함께 주의 구간에 드는 달은 {', '.join(_month_reason_label(m) for m in bottom3[1:])} 입니다. "
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
                "같은 화 기운이라도 월간과 월지 십성이 다르면 체감이 달라지므로, 예를 들어 5월과 6월도 같은 문장으로 묶지 않습니다. "
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
        "keywords": [
            "12개월",
            "월운",
            f"활용 {best['label']} {best['ganji']}",
            f"주의 {caution['label']} {caution['ganji']}",
            "월간·월지 십성",
            "체력 분배",
        ],
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
