"""십성(十星) 결정론 계산 — 외부 의존성 0 (v2.7 P2.1).

일간(日干) 을 본인 기준으로 삼아, 타 간지의 오행 관계 × 음양 일치 를 조합해
10 십성(비견·겁재·식신·상관·편재·정재·편관·정관·편인·정인) 을 판정한다.

매트릭스 (오행 관계 × 음양 일치):
- same (비화)  + 같음 → 비견    / 다름 → 겁재
- fromMe (생)  + 같음 → 식신    / 다름 → 상관  (일간이 대상을 生)
- meCtrl (극)  + 같음 → 편재    / 다름 → 정재  (일간이 대상을 剋)
- ctrlMe (극됨) + 같음 → 편관    / 다름 → 정관  (대상이 일간을 剋)
- toMe (생됨)  + 같음 → 편인    / 다름 → 정인  (대상이 일간을 生)

도메인 주: 지지 십성은 본기(本氣) 오행만 사용 — 지장간 중기·여기 반영은
학파 확장(P6+) 시 별도 task. 일반 만세력·포스텔러 노출 수준과 동일.
"""

from __future__ import annotations

from backend.services.saju.engine.chart import GAN_ELEMENT, JI_ELEMENT

# 천간 음양 (갑·병·무·경·임 = 양 / 을·정·기·신·계 = 음)
GAN_YINYANG: dict[str, str] = {
    "甲": "양", "丙": "양", "戊": "양", "庚": "양", "壬": "양",
    "乙": "음", "丁": "음", "己": "음", "辛": "음", "癸": "음",
}

# 지지 음양 (子寅辰午申戌 = 양 / 丑卯巳未酉亥 = 음)
JI_YINYANG: dict[str, str] = {
    "子": "양", "寅": "양", "辰": "양", "午": "양", "申": "양", "戌": "양",
    "丑": "음", "卯": "음", "巳": "음", "未": "음", "酉": "음", "亥": "음",
}

# 오행 상생: 앞 → 뒤 생함 (목→화→토→금→수→목)
_SHENG: dict[str, str] = {
    "목": "화", "화": "토", "토": "금", "금": "수", "수": "목",
}

# 오행 상극: 앞 → 뒤 극함 (목→토→수→화→금→목)
_KE: dict[str, str] = {
    "목": "토", "토": "수", "수": "화", "화": "금", "금": "목",
}

# 십성 한글 short + long 2단 해설 (프론트 i18n 과 짝)
SISUNG_KOR: dict[str, dict[str, str]] = {
    "비견": {"short": "같은편", "long": "같은 오행·같은 음양. 동료·내 편의 기운."},
    "겁재": {"short": "경쟁", "long": "같은 오행·다른 음양. 경쟁·도전의 기운."},
    "식신": {"short": "표현", "long": "내가 생하는 같은 음양. 표현·꾸준함의 기운."},
    "상관": {"short": "재능", "long": "내가 생하는 다른 음양. 재능·창의·입담의 기운."},
    "편재": {"short": "기회", "long": "내가 극하는 같은 음양. 기회·변동 재물의 기운."},
    "정재": {"short": "안정", "long": "내가 극하는 다른 음양. 안정적 고정수입의 기운."},
    "편관": {"short": "도전", "long": "나를 극하는 같은 음양. 도전·책임·압박의 기운."},
    "정관": {"short": "책임", "long": "나를 극하는 다른 음양. 규율·역할·명예의 기운."},
    "편인": {"short": "탐구", "long": "나를 생하는 같은 음양. 탐구·변칙 지원의 기운."},
    "정인": {"short": "배움", "long": "나를 생하는 다른 음양. 배움·모성·안정 지원의 기운."},
}

# (관계, 음양일치) → 십성 매트릭스
_SISUNG_MATRIX: dict[tuple[str, bool], str] = {
    ("same", True): "비견", ("same", False): "겁재",
    ("fromMe", True): "식신", ("fromMe", False): "상관",
    ("meCtrl", True): "편재", ("meCtrl", False): "정재",
    ("ctrlMe", True): "편관", ("ctrlMe", False): "정관",
    ("toMe", True): "편인", ("toMe", False): "정인",
}


def _element_relation(src: str, dst: str) -> str:
    """src(일간 오행) 기준 dst(대상 오행) 관계 5종.

    반환: 'same' | 'fromMe' | 'toMe' | 'meCtrl' | 'ctrlMe'
    """
    if src == dst:
        return "same"
    if _SHENG.get(src) == dst:
        return "fromMe"  # 내가 생함
    if _SHENG.get(dst) == src:
        return "toMe"  # 내가 생 받음
    if _KE.get(src) == dst:
        return "meCtrl"  # 내가 극함
    if _KE.get(dst) == src:
        return "ctrlMe"  # 내가 극 받음
    return "same"  # fallback (안전)


def compute_sisung(*, day_master_gan: str, target: str, is_ji: bool = False) -> str:
    """일간(day_master_gan) 기준 target(천간 or 지지) 의 십성 한글명.

    is_ji=True 면 target 을 지지로 해석 (본기 오행 사용).
    """
    dm_el = GAN_ELEMENT[day_master_gan]
    dm_yy = GAN_YINYANG[day_master_gan]
    tgt_el = (JI_ELEMENT if is_ji else GAN_ELEMENT)[target]
    tgt_yy = (JI_YINYANG if is_ji else GAN_YINYANG)[target]
    rel = _element_relation(dm_el, tgt_el)
    return _SISUNG_MATRIX[(rel, dm_yy == tgt_yy)]


def attach_sisung_to_natal(natal: dict) -> dict:
    """natal 딕셔너리의 각 기둥(year/month/day/hour) 에 sisung_gan·sisung_ji 주입.

    일주 천간은 본인이므로 '日主' 마커. 지지는 본기 십성.
    """
    dm = natal.get("day_master", "")
    if not dm or dm not in GAN_ELEMENT:
        return natal
    for key in ("year", "month", "day", "hour"):
        pillar = natal.get(key)
        if not pillar:
            continue
        gan = pillar.get("gan")
        ji = pillar.get("ji")
        if gan and gan in GAN_ELEMENT:
            pillar["sisung_gan"] = "日主" if key == "day" else compute_sisung(
                day_master_gan=dm, target=gan, is_ji=False
            )
        if ji and ji in JI_ELEMENT:
            pillar["sisung_ji"] = compute_sisung(
                day_master_gan=dm, target=ji, is_ji=True
            )
    return natal
