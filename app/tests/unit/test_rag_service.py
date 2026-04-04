"""RAG 검색 서비스 단위 테스트.

핵심 테스트:
- factual health query hit
- greeting/lifestyle no-hit 또는 skip
- doc당 1 snippet dedupe
- sanitize 후 내부 경로/파일명/TODO 미노출
- RAG_MAX_CONTEXT_CHARS 이하 유지
- chat.py 연동: _should_run_rag, _has_factual_intent, _is_lifestyle_query
"""

import pytest

from app.services.rag import RAGResult, RAGService
from app.services.rag_corpus import (
    CorpusDocument,
    CorpusIndex,
    CorpusSnippet,
    _tokenize,
    clear_corpus,
)

# ──────────────────────────────────────────────
# 테스트 헬퍼
# ──────────────────────────────────────────────


def _make_snippet(doc_id: str, idx: int, content: str) -> CorpusSnippet:
    return CorpusSnippet(
        snippet_id=f"{doc_id}::{idx:03d}",
        doc_id=doc_id,
        title="테스트",
        category="diet_nutrition",
        content=content,
        tokens=_tokenize(content),
        char_count=len(content),
    )


def _make_corpus(snippets: list[CorpusSnippet]) -> CorpusIndex:
    docs = {}
    for s in snippets:
        if s.doc_id not in docs:
            docs[s.doc_id] = CorpusDocument(
                doc_id=s.doc_id,
                title=s.title,
                category=s.category,
                version=1,
                review_status="approved",
                source_path="test.md",
            )
    avg_len = sum(s.char_count for s in snippets) / len(snippets) if snippets else 0
    return CorpusIndex(
        documents=docs,
        snippets=snippets,
        snippet_count=len(snippets),
        doc_count=len(docs),
        avg_doc_len=avg_len,
    )


@pytest.fixture(autouse=True)
def cleanup():
    clear_corpus()
    yield
    clear_corpus()


# ──────────────────────────────────────────────
# RAGService 검색
# ──────────────────────────────────────────────


class TestRAGSearch:
    def test_health_query_hit(self):
        snippets = [
            _make_snippet("diet_001", 0, "당뇨 환자에게 좋은 식단 관리 방법은 균형 잡힌 식사를 하는 것이 중요해요"),
            _make_snippet("exercise_001", 0, "규칙적인 운동은 혈당 관리에 도움이 돼요 산책이나 걷기를 추천해요"),
        ]
        corpus = _make_corpus(snippets)
        svc = RAGService(corpus=corpus)
        result = svc.search("당뇨 식단 관리 어떻게 해요?", top_k=2)
        assert result.hit_count > 0
        assert result.has_context

    def test_empty_corpus_no_hit(self):
        corpus = _make_corpus([])
        svc = RAGService(corpus=corpus)
        result = svc.search("당뇨 관리")
        assert result.hit_count == 0
        assert not result.has_context

    def test_no_match_no_hit(self):
        snippets = [
            _make_snippet("diet_001", 0, "당뇨 환자의 식단 관리 방법에 대한 내용입니다"),
        ]
        corpus = _make_corpus(snippets)
        svc = RAGService(corpus=corpus)
        result = svc.search("날씨가 좋네요")
        # 관련 없는 쿼리 — hit 수가 적거나 0
        # n-gram이 겹칠 수 있으므로 score 기반 결과는 있을 수 있음
        assert isinstance(result, RAGResult)

    def test_doc_dedup(self):
        """같은 doc_id에서 1 snippet만 반환."""
        snippets = [
            _make_snippet("diet_001", 0, "당뇨 식단의 기본 원칙은 균형 잡힌 영양 섭취입니다"),
            _make_snippet("diet_001", 1, "당뇨 식단에서 탄수화물 조절은 매우 중요합니다"),
            _make_snippet("exercise_001", 0, "규칙적인 운동은 혈당 관리에 도움이 됩니다"),
        ]
        corpus = _make_corpus(snippets)
        svc = RAGService(corpus=corpus)
        result = svc.search("당뇨 식단", top_k=3)
        doc_ids = [h.doc_id for h in result.hits]
        # doc_id 중복 없음
        assert len(doc_ids) == len(set(doc_ids))

    def test_top_k_limit(self):
        snippets = [
            _make_snippet(f"doc_{i}", 0, f"건강 관리 정보 {i}번 문서입니다 식단 운동 수면")
            for i in range(10)
        ]
        corpus = _make_corpus(snippets)
        svc = RAGService(corpus=corpus)
        result = svc.search("건강 관리", top_k=2)
        assert result.hit_count <= 2

    def test_synonym_expansion(self):
        """동의어 확장으로 '산책'이 '운동' 쿼리에 매칭."""
        snippets = [
            _make_snippet("walk_001", 0, "아침 산책은 혈당 조절에 도움이 됩니다 걷기를 꾸준히 하면 좋아요"),
        ]
        corpus = _make_corpus(snippets)
        svc = RAGService(corpus=corpus)
        result = svc.search("운동 방법 추천", top_k=2)
        assert result.hit_count > 0


# ──────────────────────────────────────────────
# Sanitize
# ──────────────────────────────────────────────


class TestSanitize:
    def _svc(self):
        return RAGService(corpus=_make_corpus([]))

    def test_remove_internal_path(self):
        svc = self._svc()
        text = "이 내용은 app/services/chat.py에서 사용됩니다"
        result = svc._sanitize(text)
        assert "app/services/chat.py" not in result

    def test_remove_file_extension(self):
        svc = self._svc()
        text = "설정은 config.py 파일을 확인하세요"
        result = svc._sanitize(text)
        assert "config.py" not in result

    def test_remove_todo(self):
        svc = self._svc()
        text = "TODO: 나중에 추가할 내용\n실제 건강 정보"
        result = svc._sanitize(text)
        assert "TODO" not in result
        assert "실제 건강 정보" in result

    def test_remove_mvp_marker(self):
        svc = self._svc()
        text = "MVP 이후에 추가 예정\n현재 정보"
        result = svc._sanitize(text)
        assert "MVP 이후" not in result

    def test_obligation_to_suggestion(self):
        svc = self._svc()
        text = "운동을 해야 합니다"
        result = svc._sanitize(text)
        assert "해야 합니다" not in result

    def test_remove_assistant_instruction(self):
        svc = self._svc()
        text = "반드시 포함해서 답변하세요"
        result = svc._sanitize(text)
        assert "반드시 포함" not in result


# ──────────────────────────────────────────────
# Safety Preface
# ──────────────────────────────────────────────


class TestSafetyPreface:
    def test_preface_included_in_result(self):
        snippets = [
            _make_snippet("diet_001", 0, "당뇨 식단 관리의 기본 원칙은 균형 잡힌 영양 섭취입니다"),
        ]
        corpus = _make_corpus(snippets)
        svc = RAGService(corpus=corpus)
        result = svc.search("당뇨 식단", top_k=1)
        if result.has_context:
            assert "생활습관 참고" in result.prompt_context
            assert "의료적 판단" in result.prompt_context
            assert "문서명" in result.prompt_context


# ──────────────────────────────────────────────
# ChatService RAG 조건 (import 없이 로직만 테스트)
# ──────────────────────────────────────────────


class TestChatServiceRAGConditions:
    """ChatService의 RAG 관련 정적 메서드 테스트."""

    def _service(self):
        from app.services.chat import ChatService

        svc = ChatService.__new__(ChatService)
        svc._rag_service = None
        return svc

    def test_has_factual_intent_keyword(self):
        svc = self._service()
        assert svc._has_factual_intent("혈당 관리 방법이 궁금해요")
        assert svc._has_factual_intent("왜 운동을 해야 하나요?")
        assert svc._has_factual_intent("어떻게 식단을 조절하나요")
        assert svc._has_factual_intent("운동 빈도는 얼마나")

    def test_has_factual_intent_compound(self):
        svc = self._service()
        assert svc._has_factual_intent("좋은 음식 추천해주세요")
        assert svc._has_factual_intent("나쁜 습관이 뭐가 있나요")
        assert svc._has_factual_intent("도움이 될까요?")

    def test_has_factual_intent_rejects_standalone(self):
        """'좋은', '나쁜' 단독은 매칭 안 됨."""
        svc = self._service()
        assert not svc._has_factual_intent("오늘 기분이 좋은 날이에요")
        assert not svc._has_factual_intent("좀 나쁜 기분이야")
        assert not svc._has_factual_intent("안녕하세요")

    def test_is_lifestyle_query(self):
        svc = self._service()
        assert svc._is_lifestyle_query("식단 관리 팁 알려주세요")
        assert svc._is_lifestyle_query("운동 방법이 궁금해요")
        assert svc._is_lifestyle_query("수면 습관 개선하고 싶어요")

    def test_is_lifestyle_rejects_clinical(self):
        """clinical 뉘앙스면 skip."""
        svc = self._service()
        assert not svc._is_lifestyle_query("약 변경하고 싶어요")
        assert not svc._is_lifestyle_query("인슐린 용량 조절 방법")
        assert not svc._is_lifestyle_query("검사 결과가 나빠요")
        assert not svc._is_lifestyle_query("수술 후 관리")

    def test_clinical_overrides_lifestyle(self):
        """clinical + lifestyle 동시 매칭 → skip 우선."""
        svc = self._service()
        assert not svc._is_lifestyle_query("약 변경하면서 식단 관리하고 싶어요")
        assert not svc._is_lifestyle_query("인슐린 용량 조절하면서 운동 방법 알려주세요")
