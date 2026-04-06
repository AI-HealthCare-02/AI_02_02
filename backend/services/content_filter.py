"""콘텐츠 필터 서비스 — 욕설/위기/의료안전 2축 판정.

2축 판정 모델:
- 표현축: ALLOW / WARN / BLOCK (욕설·혐오 수준)
- 의료안전축: NONE / MEDICAL_NOTE / CRISIS_ESCALATE (위기·복약거부)

핵심 원칙:
- 키워드 단독 매칭 금지 → 반드시 문맥(관용구/의도) 확인
- "죽겠다" 90%+ 는 관용구 → IDIOM_NEUTRALIZERS 로 판별
- "질문"과 "선언"을 구분 → 물음표/의문형 = ALLOW, 의도 표현 = MEDICAL_NOTE
- 위기 감지는 ai_consent 와 무관하게 항상 실행 (duty of care)
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from backend.core.config import Config
from backend.core.logger import setup_logger
from backend.models.enums import FilterExpressionVerdict, FilterMedicalAction, MessageRoute

logger = setup_logger(__name__)

# ──────────────────────────────────────────────
# 의료 화이트리스트 (오탐 방지)
# ──────────────────────────────────────────────

MEDICAL_WHITELIST: frozenset[str] = frozenset(
    {
        # 식이 지도 (씹다 계열)
        "씹다",
        "씹어서",
        "씹어",
        "잘 씹",
        "꼭꼭 씹",
        # 동음이의어
        "사정",
        "개인 사정",
        "개인사정",
        # 해부학
        "유방",
        "유방암",
        "자궁",
        "전립선",
        # 정신건강
        "우울",
        "불안",
        "스트레스",
        # 비만 관련
        "비만",
        "체지방",
        "내장지방",
        # 임신
        "임신",
        "임신성당뇨",
    }
)

MEDICAL_COMPOUND_WHITELIST: frozenset[str] = frozenset(
    {
        # 혈당/혈압 관련
        "혈당",
        "혈압",
        "당뇨",
        "인슐린",
        "복약",
        "혈당 검사",
        "혈당 수치",
        "혈압약",
        "공복혈당",
        "식후혈당",
        "당화혈색소",
        # 합병증
        "합병증",
        "당뇨발",
        "망막병증",
        "고혈당",
        "저혈당",
        # 약물
        "메트포민",
        "인슐린 저항성",
        # 검사/관리
        "정기검진",
        "혈당 모니터링",
    }
)

# ──────────────────────────────────────────────
# 위기 판정 패턴 (문맥 기반)
# ──────────────────────────────────────────────

# 직접적 자살/자해 의도 — 반드시 "의도 표현"이 포함되어야 함
CRISIS_INTENT_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p)
    for p in [
        r"죽고\s*싶",
        r"자살\s*(하고|할|해)",
        r"자해\s*(하고|할|해)",
        r"죽을\s*(래|거야|까)",
        r"다\s*끝내고\s*싶",
        r"세상에\s*없었으면",
        r"차라리\s*죽",
        r"약.{0,10}(전부|다|한꺼번에)\s*삼킬",
        r"(손목|팔목).{0,5}(긋|그)",
        r"목.{0,3}(매|맬|맸)",
        r"유서.{0,5}(쓰|썼|적)",
    ]
]

# 관용구 예외 — 이 패턴에 매칭되면 위기 판정 취소
IDIOM_NEUTRALIZERS: list[re.Pattern[str]] = [
    re.compile(p)
    for p in [
        r"(배고파|힘들어|웃겨|좋아|더워|추워|졸려|바빠|아파|피곤해|귀찮아|짜증나|답답해|무서워|신나서|기뻐서|슬퍼서)\s*죽겠",
        r"죽겠(다|어|네|음)\s*(ㅋ|ㅎ|ㅠ|ㅜ|ㅋㅋ|ㅎㅎ)",
        r"(살기|살)\s*싫은\s*(날씨|동네|환경|곳|집)",
        r"목숨.{0,5}(걸|건|거는|달린)",
        r"자살.{0,5}(률|비율|통계|뉴스|기사|예방|방지)",
        r"자해.{0,5}(방지|예방|도움|방법|막)",
        r"(약|인슐린).{0,10}죽겠",
    ]
]

# ──────────────────────────────────────────────
# MEDICAL_NOTE 패턴 (질문 vs 선언 구분)
# ──────────────────────────────────────────────

# 거부/중단 선언 — 반드시 의도 표현 포함
# 의도 표현 공통 패턴 (반말 + 존댓말)
_INTENT = r"(싶|거[야예]|겠|할래|하려)"

MEDICAL_REFUSAL_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p)
    for p in [
        rf"(당뇨약|혈압약|인슐린|약).{{0,15}}(끊|중단|그만).{{0,10}}{_INTENT}",
        rf"(당뇨약|혈압약|인슐린|약).{{0,10}}안\s*먹.{{0,10}}{_INTENT}",
        rf"인슐린.{{0,10}}(싫|안\s*맞).{{0,10}}{_INTENT}",
        r"혈당.{0,10}(포기|관리\s*안).{0,10}(하겠|할래|할\s*거)",
        r"운동.{0,10}(안\s*하겠|안\s*할\s*거|필요\s*없다고\s*생각)",
        r"인슐린\s*용량.{0,10}(줄이겠|줄일\s*거|스스로\s*조절)",
        r"약.{0,5}(두\s*배|많이).{0,10}먹",
    ]
]

# 질문/궁금증 — 이 패턴이면 MEDICAL_NOTE 취소 → ALLOW
# 주의: "어요"는 평서문에도 쓰이므로 제외 (너무 광범위)
MEDICAL_QUESTION_EXCLUDERS: list[re.Pattern[str]] = [
    re.compile(p)
    for p in [
        r"\?$",
        r"(하나요|인가요|일까요|을까요|나요|던가요)\s*\??$",
        r"(어떻게|어떡|뭐가|언제|얼마나)",
        r"(빼먹|깜박|잊어|실수)",
        r"(괜찮을까|가능한가|되나요)",
    ]
]

# 비당뇨약 제외 패턴 — "감기약", "진통제" 등은 MEDICAL_NOTE 대상 아님
NON_CHRONIC_MED_PATTERN: re.Pattern[str] = re.compile(r"(감기약|진통제|소화제|두통약|알레르기약|수면제|영양제|비타민)")

# ──────────────────────────────────────────────
# 건강 좌절감 패턴 (WARN)
# ──────────────────────────────────────────────

HEALTH_FRUSTRATION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p)
    for p in [
        r"혈당.{0,15}(짜증|답답|미치겠|힘들|소용\s*없)",
        r"(당뇨약|혈압약|인슐린|약).{0,10}(싫|귀찮|지겨)",
        r"(당뇨|혈압).{0,10}(지겹|답답)",
        r"(당뇨약|혈압약|약).{0,5}때문에.{0,10}고생",
        r"계속.{0,10}고생.{0,10}혈당",
        r"운동.{0,10}의미\s*(없|가\s*없)",
    ]
]

# 긍정 표현 제외 — 이 패턴이면 WARN 취소 → ALLOW
POSITIVE_EXCLUDERS: list[re.Pattern[str]] = [
    re.compile(p)
    for p in [
        r"(잘\s*나왔|좋아졌|내려갔|괜찮아졌)",
        r"(노력|해야|하겠|할\s*거|해볼)",
        r"(그래도|하지만|그럼에도).{0,15}(하고|먹고|계속)",
    ]
]

# ──────────────────────────────────────────────
# 메시지 라우팅 패턴 (사전 컴파일)
# ──────────────────────────────────────────────

# HEALTH_SPECIFIC: 혈당수치/복약/증상 — 면책 강화 대상
ROUTING_SPECIFIC_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p)
    for p in [
        r"(?:혈당|혈압|당화혈색소|공복혈당).{0,5}\d+",
        r"(?:몸무게|체중|허리둘레).{0,5}\d+",
        r"(?:당뇨|혈압|고지혈)약\s*(?:먹|복용|끊|중단)",
        r"(?:인슐린|메트포민|글리메피리드)\s*(?:주사|복용|용량|맞)",
        r"(?:저혈당|고혈당|두통|어지러|시야)\s*(?:증상|있|났|생겼)",
        r"인슐린\s*용량",
        r"약.{0,3}(?:안\s*먹|안\s*맞|끊|중단|복용)",
    ]
]

# HEALTH_GENERAL: 운동/식단/수면 일반 건강 질문
ROUTING_GENERAL_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p)
    for p in [
        r"(?:운동|산책|걷기|달리기|수영|자전거|등산|스트레칭|요가)\s*(?:하|했|해|할|시작|방법)?",
        r"(?:식단|다이어트|칼로리|탄수화물|단백질)\s*(?:관리|조절|어떻게)?",
        r"(?:수면|잠|숙면|불면)\s*(?:시간|못|잘|패턴)?",
        r"(?:금주|금연|음주|술)\s*(?:줄이|끊|했|안)?",
        r"(?:건강검진|검진|정기검진)",
        r"혈당\s*(?:이?\s*왜|어떻게|뭐|언제|올라|내려|떨어)",
    ]
]

# EMOTIONAL: 감정 표현 — 건강질문 억제 + 공감 우선
ROUTING_EMOTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p)
    for p in [
        r"(?:우울|불안|외로|무기력|짜증|서운|괴로)\s*(?:하|해|한|했|ㅠ|\.{2,})",
        r"(?:스트레스|답답)\s*(?:받|돼|되|나|심|해)",
        r"(?:힘들|지쳐|지치|슬프|화나)\s*(?:어|다|네|ㅠ|\.{2,})",
        r"(?:기분|마음|감정)\s*이?\s*(?:안\s*좋|나빠|우울|불안)",
        r"너무\s*(?:우울|불안|힘들|지쳐)",
    ]
]

# ──────────────────────────────────────────────
# 위기 고정 응답
# ──────────────────────────────────────────────

CRISIS_RESPONSE = (
    "지금 많이 힘드신 거 같아서 걱정됩니다.\n"
    "혼자 감당하지 않으셔도 됩니다.\n\n"
    "지금 바로 도움받을 수 있는 곳이 있어요:\n"
    "- 정신건강위기상담전화: 1393 (24시간)\n"
    "- 자살예방상담전화: 109 (24시간)\n"
    "- 응급상황: 119\n\n"
    "가까운 가족이나 신뢰할 수 있는 분에게 지금 연락해주세요.\n"
    "당신은 혼자가 아닙니다."
)

BLOCK_RESPONSE = "부적절한 표현이 포함되어 있어요. 건강 관련 이야기로 대화해주시면 더 잘 도와드릴 수 있어요 😊"

WARN_PROMPT_INSTRUCTION = (
    "\n\n## 추가 지시 (좌절감 감지)\n"
    "사용자가 건강 관리에 힘들어하고 있어. "
    "공감을 먼저 충분히 표현한 후, 작은 실천부터 격려해줘. "
    "판단하거나 훈계하지 말고, 함께 고민하는 자세로."
)

MEDICAL_NOTE_PROMPT_INSTRUCTION = (
    "\n\n## 추가 지시 (의료 안전)\n"
    "사용자가 약 중단/용량 변경 의사를 표현했어. "
    "공감 먼저, 코칭은 그다음. 반드시 답변 끝에 다음을 자연스럽게 포함해줘:\n"
    '"약이나 치료 방법에 대한 변경은 꼭 담당 의사 선생님과 상의해주세요!"'
)

# ──────────────────────────────────────────────
# Unicode 정규화
# ──────────────────────────────────────────────

# 제로 너비 문자 등 우회 시도 차단
_ZERO_WIDTH = re.compile(r"[\u200b-\u200f\u2028-\u202f\u2060\ufeff]")


def _normalize_text(text: str) -> str:
    """Unicode NFKC 정규화 + 제로 너비 문자 제거."""
    text = _ZERO_WIDTH.sub("", text)
    return unicodedata.normalize("NFKC", text)


# ──────────────────────────────────────────────
# FilterResult
# ──────────────────────────────────────────────


@dataclass
class FilterResult:
    """2축 판정 + 라우팅 결과. 내부 전용 — API 응답에 직접 노출하지 않는다."""

    expression_verdict: FilterExpressionVerdict
    medical_action: FilterMedicalAction
    reason_codes: list[str] = field(default_factory=list)
    user_facing_message: str | None = None
    prompt_instruction: str | None = None
    message_route: MessageRoute | None = None
    emotional_priority: bool = False


# ──────────────────────────────────────────────
# ContentFilterService
# ──────────────────────────────────────────────


class ContentFilterService:
    """콘텐츠 필터 — korcen + 규칙 기반 2축 판정."""

    def __init__(self) -> None:
        self._korcen_available = False
        self._korcen_check = None
        try:
            from korcen import korcen

            # smoke test
            korcen.check("테스트")
            self._korcen_available = True
            self._korcen_check = korcen.check
        except Exception:
            logger.warning("korcen 로드 실패 — regex fallback 사용")

        self._config = Config()

    # ── 공개 API ──

    def check_message(self, message: str) -> FilterResult:
        """메시지를 검사하여 2축 판정 결과를 반환한다.

        호출 위치: ChatService.send_message_stream()
        ai_consent 와 무관하게 항상 호출됨 (위기 감지 의무).
        """
        if not self._config.CONTENT_FILTER_ENABLED:
            return FilterResult(
                expression_verdict=FilterExpressionVerdict.ALLOW,
                medical_action=FilterMedicalAction.NONE,
            )

        normalized = _normalize_text(message)

        # 1. 의료안전축 판정 (위기 > MEDICAL_NOTE > NONE)
        medical_action, medical_reasons = self._check_medical_safety(normalized)

        # 2. 표현축 판정 (BLOCK > WARN > ALLOW)
        expression_verdict, expression_reasons = self._check_expression(normalized)

        # 3. 우선순위 합산: CRISIS > BLOCK > MEDICAL_NOTE > WARN > ALLOW
        reason_codes = expression_reasons + medical_reasons
        result = self._merge_results(expression_verdict, medical_action, reason_codes)

        # 4. 라우팅 분류 (기존 2축과 독립)
        route, emotional = self._classify_routing(normalized, medical_action, reason_codes)
        result.message_route = route
        result.emotional_priority = emotional

        return result

    # ── 의료안전축 ──

    def _check_medical_safety(self, text: str) -> tuple[FilterMedicalAction, list[str]]:
        """의료안전축 판정: CRISIS_ESCALATE > MEDICAL_NOTE > NONE."""
        reasons: list[str] = []

        # (1) 위기 감지 — 관용구 우선 체크
        has_crisis_keyword = self._has_crisis_keyword(text)
        if has_crisis_keyword:
            is_idiom = any(p.search(text) for p in IDIOM_NEUTRALIZERS)
            if not is_idiom:
                is_intent = any(p.search(text) for p in CRISIS_INTENT_PATTERNS)
                if is_intent:
                    reasons.append("crisis_intent")
                    return FilterMedicalAction.CRISIS_ESCALATE, reasons

        # (2) MEDICAL_NOTE — 질문 vs 선언 구분
        is_question = any(p.search(text) for p in MEDICAL_QUESTION_EXCLUDERS)
        if not is_question:
            # 비당뇨약 제외
            if not NON_CHRONIC_MED_PATTERN.search(text):
                for pattern in MEDICAL_REFUSAL_PATTERNS:
                    if pattern.search(text):
                        reasons.append("medical_refusal")
                        return FilterMedicalAction.MEDICAL_NOTE, reasons

        return FilterMedicalAction.NONE, reasons

    def _has_crisis_keyword(self, text: str) -> bool:
        """위기 관련 키워드가 존재하는지 빠른 사전 검사."""
        keywords = ("죽", "자살", "자해", "끝내", "없었으면", "삼킬", "긋", "목매", "유서")
        return any(kw in text for kw in keywords)

    # ── 표현축 ──

    def _check_expression(self, text: str) -> tuple[FilterExpressionVerdict, list[str]]:
        """표현축 판정: BLOCK > WARN > ALLOW."""
        reasons: list[str] = []
        is_whitelisted = self._is_whitelisted(text)

        # (1) korcen 또는 fallback으로 욕설 판정 (화이트리스트면 스킵)
        has_profanity = False
        if not is_whitelisted:
            has_profanity = self._detect_profanity(text)
            if has_profanity:
                severity = self._assess_severity(text)
                if severity == "severe":
                    reasons.append("severe_profanity")
                    return FilterExpressionVerdict.BLOCK, reasons
                reasons.append("mild_profanity")

        # (2) 건강 좌절감 패턴 — 화이트리스트와 무관하게 항상 체크
        has_frustration = any(p.search(text) for p in HEALTH_FRUSTRATION_PATTERNS)
        if has_frustration:
            has_positive = any(p.search(text) for p in POSITIVE_EXCLUDERS)
            if has_positive:
                return FilterExpressionVerdict.ALLOW, reasons
            reasons.append("health_frustration")
            return FilterExpressionVerdict.WARN, reasons

        # (3) mild profanity만 있으면 WARN
        if has_profanity:
            return FilterExpressionVerdict.WARN, reasons

        return FilterExpressionVerdict.ALLOW, reasons

    def _is_whitelisted(self, text: str) -> bool:
        """의료 화이트리스트 매칭 — 욕설 오탐 방지."""
        for term in MEDICAL_WHITELIST:
            if term in text:
                # 화이트리스트 단어만 있는 짧은 문장이면 오탐 방지
                stripped = text.replace(term, "").strip()
                if len(stripped) < 5:
                    return True
        for term in MEDICAL_COMPOUND_WHITELIST:
            if term in text:
                stripped = text.replace(term, "").strip()
                if len(stripped) < 5:
                    return True
        return False

    def _detect_profanity(self, text: str) -> bool:
        """korcen 또는 regex fallback으로 욕설 감지."""
        if self._korcen_available and self._korcen_check is not None:
            try:
                return self._korcen_check(text)
            except Exception:
                pass

        # regex fallback — 명확한 욕설만 잡는다
        return self._regex_profanity_check(text)

    def _regex_profanity_check(self, text: str) -> bool:
        """regex 기반 욕설 감지 (korcen fallback)."""
        # 심한 욕설 패턴
        severe_patterns = [
            r"씨발|시발|씨[0-9]*발|ㅅㅂ|ㅆㅂ",
            r"병신|ㅂㅅ|병[0-9]*신",
            r"지랄|ㅈㄹ",
            r"개새끼|개색|개쉐|개세",
            r"꺼져|닥쳐|죽어라",
        ]
        # 가벼운 욕설 패턴
        mild_patterns = [
            r"ㅅㅂ|ㅈㄹ",
            r"미친|또라이",
            r"멍청|바보|등신",
        ]
        for p in severe_patterns + mild_patterns:
            if re.search(p, text):
                return True
        return False

    def _assess_severity(self, text: str) -> str:
        """욕설 심각도 평가: 'severe' 또는 'mild'."""
        severe_patterns = [
            r"씨발|시발|씨[0-9]*발|ㅅㅂ|ㅆㅂ",
            r"병신|ㅂㅅ|병[0-9]*신",
            r"지랄|ㅈㄹ",
            r"개새끼|개색|개쉐|개세",
            r"꺼져|닥쳐|죽어라",
        ]
        for p in severe_patterns:
            if re.search(p, text):
                if not self._config.CONTENT_FILTER_BLOCK_ENABLED:
                    return "mild"
                return "severe"
        return "mild"

    # ── 결과 병합 ──

    def _merge_results(
        self,
        expression: FilterExpressionVerdict,
        medical: FilterMedicalAction,
        reason_codes: list[str],
    ) -> FilterResult:
        """2축 판정을 병합하여 최종 FilterResult를 생성한다.

        우선순위: CRISIS_ESCALATE > BLOCK > MEDICAL_NOTE > WARN > ALLOW
        """
        # CRISIS_ESCALATE — 최우선
        if medical == FilterMedicalAction.CRISIS_ESCALATE:
            return FilterResult(
                expression_verdict=expression,
                medical_action=medical,
                reason_codes=reason_codes,
                user_facing_message=CRISIS_RESPONSE,
                prompt_instruction=None,
            )

        # BLOCK
        if expression == FilterExpressionVerdict.BLOCK:
            return FilterResult(
                expression_verdict=expression,
                medical_action=medical,
                reason_codes=reason_codes,
                user_facing_message=BLOCK_RESPONSE,
                prompt_instruction=None,
            )

        # MEDICAL_NOTE
        if medical == FilterMedicalAction.MEDICAL_NOTE:
            return FilterResult(
                expression_verdict=expression,
                medical_action=medical,
                reason_codes=reason_codes,
                user_facing_message=None,
                prompt_instruction=MEDICAL_NOTE_PROMPT_INSTRUCTION,
            )

        # WARN
        if expression == FilterExpressionVerdict.WARN:
            return FilterResult(
                expression_verdict=expression,
                medical_action=medical,
                reason_codes=reason_codes,
                user_facing_message=None,
                prompt_instruction=WARN_PROMPT_INSTRUCTION,
            )

        # ALLOW
        return FilterResult(
            expression_verdict=expression,
            medical_action=medical,
            reason_codes=reason_codes,
        )

    # ── 메시지 라우팅 ──

    def _classify_routing(
        self,
        text: str,
        medical_action: FilterMedicalAction,
        reason_codes: list[str],
    ) -> tuple[MessageRoute | None, bool]:
        """메시지를 route(3값) + emotional_priority(bool)로 분류한다.

        route와 emotional은 독립적 — 혼합 메시지 시 둘 다 True 가능.
        실패 시 (None, False) 반환 → 기존 2축 판정에 영향 없음.
        """
        if not self._config.CONTENT_FILTER_ROUTING_ENABLED:
            return None, False

        try:
            # 1. emotional_priority 판정 (route와 독립)
            emotional = False
            if "health_frustration" in reason_codes:
                emotional = True
            elif any(p.search(text) for p in ROUTING_EMOTION_PATTERNS):
                emotional = True

            # 2. route 판정 (specific > general > lifestyle)
            specific_signal = (
                medical_action == FilterMedicalAction.MEDICAL_NOTE
                or any(p.search(text) for p in ROUTING_SPECIFIC_PATTERNS)
            )
            general_signal = any(p.search(text) for p in ROUTING_GENERAL_PATTERNS)

            if specific_signal:
                route = MessageRoute.HEALTH_SPECIFIC
            elif general_signal:
                route = MessageRoute.HEALTH_GENERAL
            else:
                route = MessageRoute.LIFESTYLE_CHAT

            return route, emotional
        except Exception:
            return None, False
