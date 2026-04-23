"""사주 해석 템플릿 (v2.7 P3).

서브 모듈:
- today: 5섹션 (총운/재물운/건강운/일·학업운/오늘의 한 가지) body/reason 템플릿

원칙:
- LLM 사용 금지 (규칙 + 템플릿)
- relation kind (5종) × focus (5종) × tone (3종) 조합 — Barnum 방지 (75 변형 base)
- 의료·법률·투자 단정 표현 금지
"""

from backend.services.saju.templates.today import (
    DEFAULT_SAFETY_NOTICE,
    TEMPLATE_VERSION,
    build_sections,
)

__all__ = [
    "TEMPLATE_VERSION",
    "DEFAULT_SAFETY_NOTICE",
    "build_sections",
]
