"""사주 4주 계산 (결정론 60갑자, v2.7 P2).

외부 라이브러리 의존성 0:
- 일주(日柱): 1900-01-31 = 갑진(甲辰) 기준 일수 차 mod 60 (역산 검증된 epoch)
- 년주(年柱): 양력 1984 = 갑자(甲子) 기준 (입춘 정밀 보정 없음 — 단순화 → P5 sajupy 교체 시 보정)
- 월주(月柱): 년간 + 양력 월(절기 단순화) 기반 두 천간 표
- 시주(時柱): 일간 + 출생 시각 → 24시 = 12지 매핑

한계 (P2 단순화 명시):
- 입춘·절기 정밀 보정 없음 (1월 1일 ~ 2월 4일 사이 출생자는 년주가 1년 차이날 수 있음)
- 음력 변환 미지원 (is_lunar=True 면 양력으로 간주, 결과 부정확 — 사용자에게 안전 문구로 안내)
- birth_time 모름 시 시주 = "?주" 표기 + 시지 기반 해석 skip

P5 교체:
- sajupy / lunar_python / korean_lunar_calendar 도입 후 ENGINE_VERSION bump
- 같은 함수 시그니처 유지 (compute_natal_chart) → 호출부 수정 0
"""

from __future__ import annotations

from datetime import date, time
from typing import Literal

ENGINE_VERSION = "danaa-deterministic-v0.3"

# 천간 10개 (甲乙丙丁戊己庚辛壬癸)
GAN: list[str] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]

# 지지 12개 (子丑寅卯辰巳午未申酉戌亥)
JI: list[str] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]

# 천간 → 오행 (음양 통합 기준)
GAN_ELEMENT: dict[str, str] = {
    "甲": "목", "乙": "목",
    "丙": "화", "丁": "화",
    "戊": "토", "己": "토",
    "庚": "금", "辛": "금",
    "壬": "수", "癸": "수",
}

# 지지 → 오행
JI_ELEMENT: dict[str, str] = {
    "子": "수", "亥": "수",
    "寅": "목", "卯": "목",
    "巳": "화", "午": "화",
    "辰": "토", "戌": "토", "丑": "토", "未": "토",
    "申": "금", "酉": "금",
}

# 오행 5개
ELEMENTS: list[str] = ["목", "화", "토", "금", "수"]

# 일주 epoch: 1900-01-31 = 갑진 (역산 검증). 인덱스: GAN[0]=甲, JI[4]=辰.
# 60 = lcm(10, 12). day_index = (date - epoch).days mod 60.
_EPOCH_DAY = date(1900, 1, 31)
_EPOCH_GAN_IDX = 0  # 甲
_EPOCH_JI_IDX = 4  # 辰

# 년주 epoch: 1984 = 갑자년 (보편 기준)
_EPOCH_YEAR = 1984
_EPOCH_YEAR_GAN_IDX = 0
_EPOCH_YEAR_JI_IDX = 0

# 월주 표: 년간(인덱스 5종) → 寅月(첫 절기 월)의 천간 시작
# 갑/기년 = 丙寅 시작 / 을/경년 = 戊寅 / 병/신년 = 庚寅 / 정/임년 = 壬寅 / 무/계년 = 甲寅
_MONTH_GAN_START_BY_YEAR_GAN: dict[str, int] = {
    "甲": 2, "己": 2,  # 丙
    "乙": 4, "庚": 4,  # 戊
    "丙": 6, "辛": 6,  # 庚
    "丁": 8, "壬": 8,  # 壬
    "戊": 0, "癸": 0,  # 甲
}

# 양력 월 → 사주 월지 (정밀 절기 무시 — 단순화)
# 사주는 寅月(인월)부터 시작. 양력 2월 = 寅月. 12월 = 丑月.
_SOLAR_MONTH_TO_JI_IDX: dict[int, int] = {
    2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 1, 1: 1,
}

# 시지: 23~01시=子 / 01~03=丑 / 03~05=寅 / ... / 21~23=亥
def _hour_to_ji_idx(hour: int) -> int:
    if hour == 23 or hour == 0:
        return 0  # 子
    return ((hour - 1) // 2 + 1) % 12

# 시간 표 (일간 → 子時 천간 시작): 갑·기 일 = 甲子時 / 을·경 = 丙子 / 병·신 = 戊子 / 정·임 = 庚子 / 무·계 = 壬子
_HOUR_GAN_START_BY_DAY_GAN: dict[str, int] = {
    "甲": 0, "己": 0,
    "乙": 2, "庚": 2,
    "丙": 4, "辛": 4,
    "丁": 6, "壬": 6,
    "戊": 8, "癸": 8,
}


def sexagenary_for_day(d: date) -> tuple[str, str]:
    """date → (천간, 지지) 일주 60갑자."""
    delta = (d - _EPOCH_DAY).days
    gan = GAN[(_EPOCH_GAN_IDX + delta) % 10]
    ji = JI[(_EPOCH_JI_IDX + delta) % 12]
    return gan, ji


def _sexagenary_for_year(year: int) -> tuple[str, str]:
    """양력 year → (천간, 지지) 년주. 입춘 보정 없음 (P2 단순화)."""
    delta = year - _EPOCH_YEAR
    # python 의 % 는 음수도 양수 결과 — 안전
    gan = GAN[(_EPOCH_YEAR_GAN_IDX + delta) % 10]
    ji = JI[(_EPOCH_YEAR_JI_IDX + delta) % 12]
    return gan, ji


def _month_pillar(year_gan: str, solar_month: int) -> tuple[str, str]:
    """년간 + 양력 월 → 월주 (절기 무시 단순화)."""
    ji_idx = _SOLAR_MONTH_TO_JI_IDX[solar_month]
    # 寅月 = 인덱스 2. 인월 천간 시작 + (ji_idx - 2) % 12
    start_gan_idx = _MONTH_GAN_START_BY_YEAR_GAN[year_gan]
    offset = (ji_idx - 2) % 12
    gan_idx = (start_gan_idx + offset) % 10
    return GAN[gan_idx], JI[ji_idx]


def _hour_pillar(day_gan: str, hour: int) -> tuple[str, str]:
    """일간 + 시(0~23) → 시주."""
    ji_idx = _hour_to_ji_idx(hour)
    start_gan_idx = _HOUR_GAN_START_BY_DAY_GAN[day_gan]
    gan_idx = (start_gan_idx + ji_idx) % 10
    return GAN[gan_idx], JI[ji_idx]


def _element_distribution(pillars: list[tuple[str, str]]) -> dict[str, int]:
    """4주 천간·지지 8글자 → 오행별 빈도. 모름 시 빈 표기."""
    counts: dict[str, int] = {e: 0 for e in ELEMENTS}
    for gan, ji in pillars:
        if gan and gan in GAN_ELEMENT:
            counts[GAN_ELEMENT[gan]] += 1
        if ji and ji in JI_ELEMENT:
            counts[JI_ELEMENT[ji]] += 1
    return counts


def _dominant_element(dist: dict[str, int]) -> str | None:
    """가장 많은 오행 (동률이면 첫 번째). 0건이면 None."""
    if not dist or all(v == 0 for v in dist.values()):
        return None
    return max(dist.items(), key=lambda kv: kv[1])[0]


GenderLiteral = Literal["MALE", "FEMALE", "UNKNOWN"]


def compute_natal_chart(
    *,
    birth_date: date,
    birth_time: time | None = None,
    is_lunar: bool = False,
    gender: GenderLiteral = "UNKNOWN",
) -> dict:
    """사주 원국 계산.

    반환 구조 (SajuChart.natal/strength 에 그대로 저장 가능):
    {
        "engine_version": "danaa-deterministic-v0.1",
        "natal": {
            "year":  {"gan":"...", "ji":"...", "pillar":"갑자"},
            "month": {...},
            "day":   {"gan":"...", "ji":"...", "pillar":"...", "is_day_master": True},
            "hour":  {...} | None,  # birth_time 없으면 None
            "day_master": "甲",     # 일간 = 본인 기준 천간
            "is_lunar_input": False, # 음력 입력이면 True (현재 단순 양력 처리됨 안내)
            "gender": "FEMALE",
        },
        "strength": {
            "element_distribution": {"목":2, "화":1, ...},  # 8글자 빈도
            "dominant_element": "토",
            "day_master_element": "목",
            "is_balanced": False,  # 분포가 균형(4+ 종)인지 단순 판정
        },
        "yongshin": {},  # P5 학파 도입 후 채움
        "daewoon": [],   # P5 도입 후 채움
        "limitations": [...]  # 단순화 한계 명시
    }
    """
    limitations: list[str] = []
    if is_lunar:
        limitations.append("lunar_input_treated_as_solar")
    if birth_time is None:
        limitations.append("hour_pillar_unknown")
    # 입춘 보정 없음
    if birth_date.month == 1 or (birth_date.month == 2 and birth_date.day < 4):
        limitations.append("year_pillar_no_solar_term_correction")
    # 월주 절기 비보정 — 양력 월 기반 단순화 (전체 유저 영향, 경계월 ±4일 내 오차 가능)
    limitations.append("month_pillar_no_solar_term_correction")

    year_gan, year_ji = _sexagenary_for_year(birth_date.year)
    month_gan, month_ji = _month_pillar(year_gan, birth_date.month)
    day_gan, day_ji = sexagenary_for_day(birth_date)

    pillars: list[tuple[str, str]] = [
        (year_gan, year_ji),
        (month_gan, month_ji),
        (day_gan, day_ji),
    ]
    hour_pillar_dict: dict | None = None
    if birth_time is not None:
        hour_gan, hour_ji = _hour_pillar(day_gan, birth_time.hour)
        pillars.append((hour_gan, hour_ji))
        hour_pillar_dict = {
            "gan": hour_gan,
            "ji": hour_ji,
            "pillar": hour_gan + hour_ji,
        }

    distribution = _element_distribution(pillars)
    dominant = _dominant_element(distribution)
    day_master_element = GAN_ELEMENT.get(day_gan)
    is_balanced = sum(1 for v in distribution.values() if v > 0) >= 4

    natal = {
        "year": {"gan": year_gan, "ji": year_ji, "pillar": year_gan + year_ji},
        "month": {"gan": month_gan, "ji": month_ji, "pillar": month_gan + month_ji},
        "day": {
            "gan": day_gan,
            "ji": day_ji,
            "pillar": day_gan + day_ji,
            "is_day_master": True,
        },
        "hour": hour_pillar_dict,
        "day_master": day_gan,
        "is_lunar_input": is_lunar,
        "gender": gender,
        # UI/응답 노출을 위해 JSONField(natal) 내부에 중복 보관 (v0.2)
        "limitations": list(limitations),
        "element_distribution": dict(distribution),
        "day_master_element": day_master_element,
    }
    # 십성 주입 (v0.2): 각 기둥에 sisung_gan / sisung_ji 추가, day.gan 은 '日主'
    from backend.services.saju.engine.sisung import attach_sisung_to_natal
    natal = attach_sisung_to_natal(natal)

    # 억부용신 판정 (v0.3, 한국 현대 기준)
    from backend.services.saju.engine.yongshin import derive_yongshin_eokbu
    yongshin = derive_yongshin_eokbu(natal=natal)
    # natal 에도 중복 저장 (UI 접근용)
    natal["yongshin"] = yongshin

    return {
        "engine_version": ENGINE_VERSION,
        "natal": natal,
        "strength": {
            "element_distribution": distribution,
            "dominant_element": dominant,
            "day_master_element": day_master_element,
            "is_balanced": is_balanced,
        },
        "yongshin": yongshin,
        "daewoon": [],  # P5 도입 후
        "limitations": limitations,
    }
