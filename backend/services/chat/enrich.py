"""RAG and user-context enrichment helpers."""

import re

from backend.core import config
from backend.core.logger import setup_logger
from backend.models.enums import FilterMedicalAction, MessageRoute
from backend.services.content_filter import FilterResult

logger = setup_logger(__name__)

_FACTUAL_KEYWORDS = re.compile(r"(?:왜|어떻게|얼마나|기준|방법|목표|빈도|권장)")
_FACTUAL_COMPOUNDS = re.compile(
    r"(?:좋은\s*(?:음식|운동|습관|방법))"
    r"|(?:나쁜\s*(?:음식|습관|영향))"
    r"|(?:도움이\s*(?:될까|되나|될지))"
)
_LIFESTYLE_QUERY_PATTERNS = re.compile(
    r"(?:관리|생활|습관|식단|운동|수면|스트레스|방법|팁)"
)
_CLINICAL_PATTERNS = re.compile(
    r"(?:진단|처방|치료|수술|검사\s*결과)"
    r"|(?:약\s*(?:바꿔|변경|조절|줄여))"
    r"|(?:인슐린\s*(?:단위|용량|조절))"
    r"|(?:용량\s*조절)"
)
_TOPIC_SLEEP_RE = re.compile(r"(?:수면|불면|잠|시간.*자)")
_TOPIC_EXERCISE_RE = re.compile(r"(?:운동|산책|걷기|달리기|헬스|체조|활동)")


def _get_rag_service(service):
    if service._rag_service is not None:
        return service._rag_service
    try:
        from backend.services.rag import RAGService

        service._rag_service = RAGService()
        return service._rag_service
    except Exception:
        logger.warning("rag_init_failed")
        return None


def _has_factual_intent(message: str) -> bool:
    return bool(
        _FACTUAL_KEYWORDS.search(message)
        or _FACTUAL_COMPOUNDS.search(message)
    )


def _is_lifestyle_query(message: str) -> bool:
    if _CLINICAL_PATTERNS.search(message):
        return False
    return bool(_LIFESTYLE_QUERY_PATTERNS.search(message))


def _should_run_rag(message: str, filter_result: FilterResult) -> bool:
    if not config.RAG_ENABLED:
        return False
    if not config.CONTENT_FILTER_ROUTING_ENABLED:
        return False
    if len(message.strip()) < 3:
        return False
    if filter_result.message_route is None:
        return False
    if filter_result.medical_action == FilterMedicalAction.MEDICAL_NOTE:
        return False
    if filter_result.message_route == MessageRoute.LIFESTYLE_CHAT:
        return False
    if filter_result.emotional_priority:
        return _has_factual_intent(message)
    if filter_result.message_route == MessageRoute.HEALTH_SPECIFIC:
        return _is_lifestyle_query(message)
    return True


def _rag_top_k(filter_result: FilterResult) -> int:
    if filter_result.emotional_priority:
        return 1
    return config.RAG_TOP_K


def _try_rag_search(service, message: str, filter_result: FilterResult):
    if not _should_run_rag(message, filter_result):
        logger.info("rag_skipped")
        return None
    rag_svc = _get_rag_service(service)
    if not rag_svc:
        return None
    try:
        result = rag_svc.search(query=message, top_k=_rag_top_k(filter_result))
        if result and result.hit_count > 0:
            logger.info("rag_search_hit")
        else:
            logger.info("rag_search_no_hit")
        return result
    except Exception:
        logger.warning("rag_search_failed")
        return None


def _get_user_context_service(service):
    if service._user_context_service is not None:
        return service._user_context_service
    try:
        from backend.services.user_context import UserContextService

        service._user_context_service = UserContextService()
        return service._user_context_service
    except Exception:
        logger.warning("user_context_init_failed")
        return None


def _should_build_user_context(filter_result: FilterResult, profile) -> bool:
    if not config.USER_CONTEXT_ENABLED:
        return False
    if profile is None:
        return False
    if filter_result.medical_action == FilterMedicalAction.MEDICAL_NOTE:
        return False
    if filter_result.emotional_priority:
        return False
    if filter_result.message_route is None:
        return False
    if filter_result.message_route != MessageRoute.HEALTH_GENERAL:
        return False
    return True


def _select_topic_hint(message: str) -> str | None:
    if _TOPIC_SLEEP_RE.search(message):
        return "sleep"
    if _TOPIC_EXERCISE_RE.search(message):
        return "exercise"
    return None
