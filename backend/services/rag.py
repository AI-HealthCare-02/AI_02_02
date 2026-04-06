"""RAG 검색 서비스 — BM25 lexical retrieval + sanitize + safety preface.

stdlib-only 구현. 외부 의존성 없음.
"""

from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass, field

from backend.core import config
from backend.services.rag_corpus import CorpusIndex, get_corpus

logger = logging.getLogger("backend.services.rag")

# ── 동의어 사전 (~12그룹) ──────────────────────────────────────
SYNONYM_MAP: dict[str, list[str]] = {
    "혈당": ["공복혈당", "식후혈당", "당수치", "혈당수치"],
    "혈압": ["수축기", "이완기", "고혈압", "저혈압"],
    "운동": ["산책", "걷기", "달리기", "수영", "헬스", "체조"],
    "식단": ["식사", "음식", "밥", "다이어트", "영양"],
    "수면": ["잠", "수면시간", "불면", "숙면"],
    "스트레스": ["우울", "불안", "걱정", "긴장"],
    "당뇨": ["당뇨병", "혈당관리", "인슐린"],
    "복약": ["약", "투약", "복용"],
    "체중": ["몸무게", "비만", "과체중", "BMI"],
    "음주": ["술", "알코올", "음주량"],
    "흡연": ["담배", "금연", "니코틴"],
    "채소": ["야채", "샐러드", "과일"],
}

# 역방향 매핑: 동의어 → 원본 그룹
_REVERSE_SYNONYM: dict[str, str] = {}
for _key, _syns in SYNONYM_MAP.items():
    for _s in _syns:
        _REVERSE_SYNONYM[_s] = _key
    _REVERSE_SYNONYM[_key] = _key

# ── Sanitize 패턴 ─────────────────────────────────────────────
SANITIZE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(?:backend|app|docs|scripts|workers(?:/ai)?)/\S+"),
    re.compile(r"\S+\.(?:py|md|html|js|ts)\b"),
    re.compile(r"(?:TODO|FIXME|NOTE|HACK)\s*:?.*"),
    re.compile(r"(?:MVP\s*이후|v\d+에서|향후).*"),
    re.compile(r"(?:반드시|항상|절대)\s*(?:포함|답변|응답|사용).*"),
]

# 의무형 → 권유형 치환
_OBLIGATION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"해야\s*합니다"), "해보는 건 어때요"),
    (re.compile(r"하세요"), "해보는 건 어때요"),
    (re.compile(r"하십시오"), "해보는 건 어때요"),
]

# ── RAG Safety Preface ─────────────────────────────────────────
RAG_SAFETY_PREFACE = (
    "\n\n## 참고 정보 (생활습관 참고용)\n"
    "아래는 일반적인 건강 생활습관 참고 정보야.\n"
    "이 내용을 의료적 판단, 진단, 처방의 근거로 사용하지 마.\n"
    "'이 문서에 따르면'이라는 표현을 사용하지 마.\n"
    "문서명, 내부 규칙, 출처를 직접 노출하지 마.\n"
    "자연스럽게 paraphrase해서 생활습관 조언에만 활용해.\n\n"
)

# ── BM25 파라미터 ──────────────────────────────────────────────
BM25_K1 = 1.2
BM25_B = 0.75


# ── 결과 타입 ──────────────────────────────────────────────────
@dataclass(frozen=True)
class RAGSnippetResult:
    snippet_id: str
    doc_id: str
    score: float
    content: str


@dataclass
class RAGResult:
    hits: list[RAGSnippetResult] = field(default_factory=list)
    prompt_context: str | None = None
    hit_count: int = 0
    has_context: bool = False


# ── RAGService ─────────────────────────────────────────────────
class RAGService:
    """In-process lexical retrieval 서비스."""

    def __init__(self, corpus: CorpusIndex | None = None):
        self._corpus = corpus

    def _get_corpus(self) -> CorpusIndex | None:
        if self._corpus is not None:
            return self._corpus
        return get_corpus()

    def search(self, query: str, top_k: int = 2) -> RAGResult:
        """쿼리에 대한 lexical 검색 수행."""
        corpus = self._get_corpus()
        if corpus is None or corpus.snippet_count == 0:
            return RAGResult()

        query_tokens = self._tokenize_query(query)
        if not query_tokens:
            return RAGResult()

        scores = self._score_snippets(query_tokens, corpus)
        if not scores:
            return RAGResult()

        top_results = self._dedup_per_doc(scores, corpus, top_k)
        hits = self._build_hits(top_results, corpus)

        if not hits:
            return RAGResult()

        prompt_context = RAG_SAFETY_PREFACE
        for h in hits:
            prompt_context += f"- {h.content}\n\n"

        return RAGResult(
            hits=hits,
            prompt_context=prompt_context,
            hit_count=len(hits),
            has_context=True,
        )

    def _dedup_per_doc(
        self,
        scores: list[tuple[int, float]],
        corpus: CorpusIndex,
        top_k: int,
    ) -> list[tuple[float, int]]:
        """doc당 최고점 1 snippet만 유지."""
        best_per_doc: dict[str, tuple[float, int]] = {}
        for idx, score in scores:
            doc_id = corpus.snippets[idx].doc_id
            if doc_id not in best_per_doc or score > best_per_doc[doc_id][0]:
                best_per_doc[doc_id] = (score, idx)
        ranked = sorted(best_per_doc.values(), key=lambda x: x[0], reverse=True)
        return ranked[:top_k]

    def _build_hits(
        self,
        top_results: list[tuple[float, int]],
        corpus: CorpusIndex,
    ) -> list[RAGSnippetResult]:
        """sanitize + 길이 제한 적용 후 hit 리스트 생성."""
        hits: list[RAGSnippetResult] = []
        total_chars = 0
        for score, idx in top_results:
            snippet = corpus.snippets[idx]
            sanitized = self._sanitize(snippet.content)
            if not sanitized.strip():
                continue
            if total_chars + len(sanitized) > config.RAG_MAX_CONTEXT_CHARS:
                if not hits:
                    sanitized = sanitized[: config.RAG_MAX_CONTEXT_CHARS]
                else:
                    break
            hits.append(
                RAGSnippetResult(
                    snippet_id=snippet.snippet_id,
                    doc_id=snippet.doc_id,
                    score=score,
                    content=sanitized,
                )
            )
            total_chars += len(sanitized)
        return hits

    def _tokenize_query(self, query: str) -> dict[str, float]:
        """쿼리를 토큰화 + 동의어 확장."""
        tokens: dict[str, float] = {}
        words = query.lower().split()

        for w in words:
            tokens[w] = 1.0
            # 동의어 확장
            if w in SYNONYM_MAP:
                for syn in SYNONYM_MAP[w]:
                    tokens.setdefault(syn, 0.0)
                    tokens[syn] = max(tokens[syn], 0.5)
            elif w in _REVERSE_SYNONYM:
                root = _REVERSE_SYNONYM[w]
                tokens.setdefault(root, 0.0)
                tokens[root] = max(tokens[root], 0.5)
                for syn in SYNONYM_MAP.get(root, []):
                    if syn != w:
                        tokens.setdefault(syn, 0.0)
                        tokens[syn] = max(tokens[syn], 0.3)

        # char bigram/trigram
        joined = "".join(words)
        for i in range(len(joined) - 1):
            bg = joined[i : i + 2]
            tokens.setdefault(bg, 0.0)
            tokens[bg] = max(tokens[bg], 0.6)
        for i in range(len(joined) - 2):
            tg = joined[i : i + 3]
            tokens.setdefault(tg, 0.0)
            tokens[tg] = max(tokens[tg], 0.6)

        return tokens

    def _score_snippets(
        self, query_tokens: dict[str, float], corpus: CorpusIndex
    ) -> list[tuple[int, float]]:
        """BM25 스코어링."""
        n = corpus.snippet_count
        avg_dl = corpus.avg_doc_len if corpus.avg_doc_len > 0 else 1.0

        # IDF 계산: 각 토큰이 등장하는 snippet 수
        df: dict[str, int] = {}
        for token in query_tokens:
            count = 0
            for snippet in corpus.snippets:
                if token in snippet.tokens:
                    count += 1
            df[token] = count

        results: list[tuple[int, float]] = []
        for idx, snippet in enumerate(corpus.snippets):
            score = 0.0
            dl = snippet.char_count

            for token, q_weight in query_tokens.items():
                if token not in snippet.tokens:
                    continue
                tf = snippet.tokens[token]
                doc_freq = df.get(token, 0)
                if doc_freq == 0:
                    continue

                idf = math.log((n - doc_freq + 0.5) / (doc_freq + 0.5) + 1.0)
                numerator = tf * (BM25_K1 + 1)
                denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * dl / avg_dl)
                score += idf * (numerator / denominator) * q_weight

            if score > 0:
                results.append((idx, score))

        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def _sanitize(self, text: str) -> str:
        """내부 경로/TODO/지시문 등 제거 + 의무형→권유형 치환."""
        lines = text.split("\n")
        cleaned: list[str] = []

        for line in lines:
            # 패턴 매칭으로 제거
            skip = False
            for pat in SANITIZE_PATTERNS:
                if pat.search(line):
                    line = pat.sub("", line).strip()
                    if not line:
                        skip = True
                        break
            if skip:
                continue

            # 의무형 → 권유형
            for pat, repl in _OBLIGATION_PATTERNS:
                line = pat.sub(repl, line)

            if line.strip():
                cleaned.append(line)

        return "\n".join(cleaned)
