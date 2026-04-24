"""사주 계산 엔진 (v2.7 P2~P4).

서브 모듈:
- chart: birth_date/time → natal 4주 (년월일시 + 일간 + 오행 분포)
- today: 오늘 일진 + natal 일간과의 관계 (합/충/생/극)
- sisung: 일간 기준 십성 결정론 매트릭스 (P2.1)

원칙:
- 외부 라이브러리 의존성 0 (결정론 60갑자 직접 구현)
- engine_version 명시 — P5 에서 sajupy/lunar_python 도입 시 같은 인터페이스로 교체
- 모든 함수 pure (입력 같으면 출력 같음) — 테스트 용이
"""

from backend.services.saju.engine.chart import (
    ENGINE_VERSION,
    GAN,
    GAN_ELEMENT,
    JI,
    JI_ELEMENT,
    compute_natal_chart,
    sexagenary_for_day,
)
from backend.services.saju.engine.sisung import (
    GAN_YINYANG,
    JI_YINYANG,
    SISUNG_KOR,
    attach_sisung_to_natal,
    compute_sisung,
)
from backend.services.saju.engine.today import (
    GAN_RELATION,
    derive_day_relation,
    today_pillar,
)

__all__ = [
    "ENGINE_VERSION",
    "GAN",
    "GAN_ELEMENT",
    "GAN_RELATION",
    "GAN_YINYANG",
    "JI",
    "JI_ELEMENT",
    "JI_YINYANG",
    "SISUNG_KOR",
    "attach_sisung_to_natal",
    "compute_natal_chart",
    "compute_sisung",
    "derive_day_relation",
    "sexagenary_for_day",
    "today_pillar",
]
