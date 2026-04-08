"""콘텐츠 필터 서비스.

표현축(ALLOW/WARN/BLOCK)과 의료안전축(NONE/MEDICAL_NOTE/CRISIS_ESCALATE)을
함께 판정한다. 이번 라운드에서는 공개 API와 우선순위 동작을 유지한 채
패턴/상수만 별도 모듈로 추출한다.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from backend.core.config import Config
from backend.core.logger import setup_logger
from backend.models.enums import FilterExpressionVerdict, FilterMedicalAction, MessageRoute
from backend.services.content_filter_patterns import (
    _ZERO_WIDTH,
    BLOCK_RESPONSE,
    CRISIS_INTENT_PATTERNS,
    CRISIS_RESPONSE,
    HEALTH_FRUSTRATION_PATTERNS,
    IDIOM_NEUTRALIZERS,
    MEDICAL_COMPOUND_WHITELIST,
    MEDICAL_NOTE_PROMPT_INSTRUCTION,
    MEDICAL_QUESTION_EXCLUDERS,
    MEDICAL_REFUSAL_PATTERNS,
    MEDICAL_WHITELIST,
    MILD_PROFANITY_PATTERNS,
    NON_CHRONIC_MED_PATTERN,
    POSITIVE_EXCLUDERS,
    ROUTING_EMOTION_PATTERNS,
    ROUTING_GENERAL_PATTERNS,
    ROUTING_SPECIFIC_PATTERNS,
    SEVERE_PROFANITY_PATTERNS,
    WARN_PROMPT_INSTRUCTION,
)
from backend.services.content_filter_reason_codes import FilterReasonCode

logger = setup_logger(__name__)

_PROTECTED_NUMERIC_TOKEN = re.compile(
    r"\d+(?:\.\d+|[-~]\d+|/\d+)?(?:\s?(?:%|mg/dL|mg/dl|mmHg|mmhg|mmol/L|mmol/l))?"
)
_NORMALIZE_SEPARATORS = re.compile(r"[.,/_\\\-~·•ㆍ…]+")
_MULTISPACE = re.compile(r"\s+")


def _protect_numeric_tokens(text: str) -> tuple[str, dict[str, str]]:
    """의료 수치/범위/단위 표현을 정규화 전 임시 토큰으로 보호한다."""
    protected: dict[str, str] = {}

    def _replace(match) -> str:
        token = f"CFTOKEN{len(protected)}X"
        protected[token] = match.group(0)
        return token

    return _PROTECTED_NUMERIC_TOKEN.sub(_replace, text), protected


def _restore_numeric_tokens(text: str, protected: dict[str, str]) -> str:
    for token, original in protected.items():
        text = text.replace(token, original)
    return text


def _normalize_text(text: str) -> str:
    """Option C: zero-width 제거 + 숫자/단위 보호 + NFKC + 우회 구두점 정리."""
    text = _ZERO_WIDTH.sub("", text)
    text = unicodedata.normalize("NFKC", text)
    text, protected = _protect_numeric_tokens(text)
    text = _NORMALIZE_SEPARATORS.sub(" ", text)
    text = _MULTISPACE.sub(" ", text).strip()
    return _restore_numeric_tokens(text, protected)


@dataclass
class FilterResult:
    """2축 판정 + 라우팅 결과.

    내부 전용 구조이며 API 응답에 직접 노출하지 않는다.
    """

    expression_verdict: FilterExpressionVerdict
    medical_action: FilterMedicalAction
    reason_codes: list[FilterReasonCode] = field(default_factory=list)
    user_facing_message: str | None = None
    prompt_instruction: str | None = None
    message_route: MessageRoute | None = None
    emotional_priority: bool = False


class ContentFilterService:
    """korcen + 규칙 기반 2축 콘텐츠 필터."""

    def __init__(self) -> None:
        self._korcen_available = False
        self._korcen_check = None
        try:
            from korcen import korcen

            korcen.check("테스트")
            self._korcen_available = True
            self._korcen_check = korcen.check
        except Exception:
            logger.warning("korcen 로드 실패 — regex fallback 사용")

        self._config = Config()

    def check_message(self, message: str) -> FilterResult:
        """메시지를 검사하여 2축 판정 결과를 반환한다."""
        if not self._config.CONTENT_FILTER_ENABLED:
            return FilterResult(
                expression_verdict=FilterExpressionVerdict.ALLOW,
                medical_action=FilterMedicalAction.NONE,
            )

        normalized = _normalize_text(message)

        medical_action, medical_reasons = self._check_medical_safety(normalized)
        expression_verdict, expression_reasons = self._check_expression(normalized)

        reason_codes = expression_reasons + medical_reasons
        result = self._merge_results(expression_verdict, medical_action, reason_codes)

        route, emotional = self._classify_routing(normalized, medical_action, reason_codes)
        result.message_route = route
        result.emotional_priority = emotional
        return result

    def _check_medical_safety(self, text: str) -> tuple[FilterMedicalAction, list[FilterReasonCode]]:
        """의료안전축 판정: CRISIS_ESCALATE > MEDICAL_NOTE > NONE."""
        reasons: list[FilterReasonCode] = []

        has_crisis_keyword = self._has_crisis_keyword(text)
        if has_crisis_keyword:
            is_idiom = any(p.search(text) for p in IDIOM_NEUTRALIZERS)
            if not is_idiom:
                is_intent = any(p.search(text) for p in CRISIS_INTENT_PATTERNS)
                if is_intent:
                    reasons.append(FilterReasonCode.CRISIS_INTENT)
                    return FilterMedicalAction.CRISIS_ESCALATE, reasons

        is_question = any(p.search(text) for p in MEDICAL_QUESTION_EXCLUDERS)
        if not is_question and not NON_CHRONIC_MED_PATTERN.search(text):
            for pattern in MEDICAL_REFUSAL_PATTERNS:
                if pattern.search(text):
                    reasons.append(FilterReasonCode.MEDICAL_REFUSAL)
                    return FilterMedicalAction.MEDICAL_NOTE, reasons

        return FilterMedicalAction.NONE, reasons

    def _has_crisis_keyword(self, text: str) -> bool:
        """위기 관련 키워드가 존재하는지 빠른 사전 검사."""
        keywords = ("죽", "자살", "자해", "끝내", "없었으면", "삼킬", "긋", "목매", "유서")
        return any(kw in text for kw in keywords)

    def _check_expression(self, text: str) -> tuple[FilterExpressionVerdict, list[FilterReasonCode]]:
        """표현축 판정: BLOCK > WARN > ALLOW."""
        reasons: list[FilterReasonCode] = []
        is_whitelisted = self._is_whitelisted(text)

        has_profanity = False
        if not is_whitelisted:
            has_profanity = self._detect_profanity(text)
            if has_profanity:
                severity = self._assess_severity(text)
                if severity == "severe":
                    reasons.append(FilterReasonCode.SEVERE_PROFANITY)
                    return FilterExpressionVerdict.BLOCK, reasons
                reasons.append(FilterReasonCode.MILD_PROFANITY)

        has_frustration = any(p.search(text) for p in HEALTH_FRUSTRATION_PATTERNS)
        if has_frustration:
            has_positive = any(p.search(text) for p in POSITIVE_EXCLUDERS)
            if has_positive:
                return FilterExpressionVerdict.ALLOW, reasons
            reasons.append(FilterReasonCode.HEALTH_FRUSTRATION)
            return FilterExpressionVerdict.WARN, reasons

        if has_profanity:
            return FilterExpressionVerdict.WARN, reasons

        return FilterExpressionVerdict.ALLOW, reasons

    def _is_whitelisted(self, text: str) -> bool:
        """의료 화이트리스트 매칭으로 욕설 오탐을 방지한다."""
        for term in MEDICAL_WHITELIST:
            if term in text:
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
        """korcen 또는 fallback regex로 욕설을 감지한다."""
        if self._korcen_available and self._korcen_check is not None:
            try:
                return self._korcen_check(text)
            except Exception:
                pass

        return self._regex_profanity_check(text)

    def _regex_profanity_check(self, text: str) -> bool:
        """regex 기반 욕설 감지(korcen fallback)."""
        for pattern in SEVERE_PROFANITY_PATTERNS:
            if pattern.search(text):
                return True
        for pattern in MILD_PROFANITY_PATTERNS:
            if pattern.search(text):
                return True
        return False

    def _assess_severity(self, text: str) -> str:
        """욕설 심각도 평가: severe 또는 mild."""
        for pattern in SEVERE_PROFANITY_PATTERNS:
            if pattern.search(text):
                if not self._config.CONTENT_FILTER_BLOCK_ENABLED:
                    return "mild"
                return "severe"
        return "mild"

    def _merge_results(
        self,
        expression: FilterExpressionVerdict,
        medical: FilterMedicalAction,
        reason_codes: list[FilterReasonCode],
    ) -> FilterResult:
        """2축 판정을 병합하여 최종 FilterResult를 생성한다.

        우선순위: CRISIS_ESCALATE > BLOCK > MEDICAL_NOTE > WARN > ALLOW
        """
        if medical == FilterMedicalAction.CRISIS_ESCALATE:
            return FilterResult(
                expression_verdict=expression,
                medical_action=medical,
                reason_codes=reason_codes,
                user_facing_message=CRISIS_RESPONSE,
                prompt_instruction=None,
            )

        if expression == FilterExpressionVerdict.BLOCK:
            return FilterResult(
                expression_verdict=expression,
                medical_action=medical,
                reason_codes=reason_codes,
                user_facing_message=BLOCK_RESPONSE,
                prompt_instruction=None,
            )

        if medical == FilterMedicalAction.MEDICAL_NOTE:
            return FilterResult(
                expression_verdict=expression,
                medical_action=medical,
                reason_codes=reason_codes,
                user_facing_message=None,
                prompt_instruction=MEDICAL_NOTE_PROMPT_INSTRUCTION,
            )

        if expression == FilterExpressionVerdict.WARN:
            return FilterResult(
                expression_verdict=expression,
                medical_action=medical,
                reason_codes=reason_codes,
                user_facing_message=None,
                prompt_instruction=WARN_PROMPT_INSTRUCTION,
            )

        return FilterResult(
            expression_verdict=expression,
            medical_action=medical,
            reason_codes=reason_codes,
        )

    def _classify_routing(
        self,
        text: str,
        medical_action: FilterMedicalAction,
        reason_codes: list[FilterReasonCode],
    ) -> tuple[MessageRoute | None, bool]:
        """메시지를 route + emotional_priority로 분류한다."""
        if not self._config.CONTENT_FILTER_ROUTING_ENABLED:
            return None, False

        try:
            emotional = False
            if FilterReasonCode.HEALTH_FRUSTRATION in reason_codes:
                emotional = True
            elif any(p.search(text) for p in ROUTING_EMOTION_PATTERNS):
                emotional = True

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
