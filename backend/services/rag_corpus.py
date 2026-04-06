"""RAG 코퍼스 로더 — 승인된 건강 문서를 로드하고 스니펫으로 분할.

모듈 전역 registry 패턴: load_corpus / get_corpus / clear_corpus.
전역 state에 저장하지 않음 — ChatService가 get_corpus()로 직접 접근.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

from backend.core import config

logger = logging.getLogger("backend.services.rag_corpus")

# ── 허용 카테고리 ──────────────────────────────────────────────
VALID_CATEGORIES: frozenset[str] = frozenset(
    {
        "diabetes_lifestyle",
        "hypertension_lifestyle",
        "medication_compliance",
        "diet_nutrition",
        "exercise_activity",
        "sleep_mental",
    }
)

REQUIRED_FIELDS: tuple[str, ...] = ("doc_id", "title", "category", "review_status", "version")

# ── 스니펫 크기 제한 ───────────────────────────────────────────
MIN_SNIPPET_CHARS = 300
MAX_SNIPPET_CHARS = 700

# ── 한국어 문장 경계 패턴 (분할용) ─────────────────────────────
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+|(?<=다\.)\s*|(?<=요\.)\s*|(?<=세요\.)\s*")


# ── 데이터 타입 ────────────────────────────────────────────────
@dataclass(frozen=True)
class CorpusDocument:
    doc_id: str
    title: str
    category: str
    version: int
    review_status: str
    source_path: str


@dataclass(frozen=True)
class CorpusSnippet:
    snippet_id: str
    doc_id: str
    title: str
    category: str
    content: str
    tokens: dict[str, float]
    char_count: int


@dataclass
class CorpusIndex:
    documents: dict[str, CorpusDocument] = field(default_factory=dict)
    snippets: list[CorpusSnippet] = field(default_factory=list)
    snippet_count: int = 0
    doc_count: int = 0
    avg_doc_len: float = 0.0


# ── 모듈 전역 registry ────────────────────────────────────────
_corpus: CorpusIndex | None = None
_load_attempted: bool = False


def load_corpus(corpus_dir: str | None = None) -> CorpusIndex:
    """코퍼스를 로드하고 모듈 전역에 저장. startup warm-up용."""
    global _corpus, _load_attempted
    _load_attempted = True

    resolved_dir = Path(corpus_dir or config.RAG_CORPUS_DIR)
    if not resolved_dir.is_absolute():
        resolved_dir = Path.cwd() / resolved_dir

    if not resolved_dir.is_dir():
        logger.warning("corpus_dir_not_found dir=%s", resolved_dir)
        _corpus = CorpusIndex()
        return _corpus

    _corpus = _build_corpus(resolved_dir)
    return _corpus


def get_corpus() -> CorpusIndex | None:
    """현재 로드된 코퍼스 반환. lazy fallback 1회만."""
    global _corpus, _load_attempted
    if _corpus is None and not _load_attempted and config.RAG_ENABLED:
        try:
            load_corpus()
        except Exception:
            logger.warning("rag_corpus_lazy_load_failed")
    return _corpus


def clear_corpus() -> None:
    """테스트용 cleanup."""
    global _corpus, _load_attempted
    _corpus = None
    _load_attempted = False


# ── Frontmatter 파서 ───────────────────────────────────────────
def _parse_frontmatter(text: str) -> dict[str, str] | None:
    """YAML 의존성 없이 key: value 단일 라인만 파싱."""
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        return None

    meta: dict[str, str] = {}
    for line in lines[1:]:
        stripped = line.strip()
        if stripped == "---":
            break
        if ":" not in stripped:
            continue
        key, _, value = stripped.partition(":")
        meta[key.strip()] = value.strip()
    else:
        # 닫는 --- 없이 끝남
        return None

    return meta if meta else None


def _extract_body(text: str) -> str:
    """frontmatter 뒤의 본문만 추출."""
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        return text

    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return "\n".join(lines[i + 1 :]).strip()
    return text


def _validate_frontmatter(meta: dict[str, str], path: str) -> CorpusDocument | None:
    """필수 필드 검증 + CorpusDocument 생성."""
    for key in REQUIRED_FIELDS:
        if key not in meta:
            logger.warning("frontmatter_missing_field field=%s path=%s", key, path)
            return None

    if meta["review_status"] != "approved":
        logger.info("corpus_skip_not_approved path=%s", path)
        return None

    if meta["category"] not in VALID_CATEGORIES:
        logger.warning("corpus_skip_invalid_category category=%s path=%s", meta["category"], path)
        return None

    try:
        version = int(meta["version"])
    except (ValueError, TypeError):
        logger.warning("corpus_skip_invalid_version path=%s", path)
        return None

    return CorpusDocument(
        doc_id=meta["doc_id"],
        title=meta["title"],
        category=meta["category"],
        version=version,
        review_status=meta["review_status"],
        source_path=path,
    )


# ── 스니펫 생성 ────────────────────────────────────────────────
_HEADING_RE = re.compile(r"^#{2,3}\s+.+", re.MULTILINE)


def _split_into_sections(body: str) -> list[str]:
    """H2/H3 헤딩 기준으로 섹션 분할."""
    positions = [m.start() for m in _HEADING_RE.finditer(body)]

    if not positions:
        return [body.strip()] if body.strip() else []

    sections: list[str] = []
    # 헤딩 전 텍스트
    if positions[0] > 0:
        pre = body[: positions[0]].strip()
        if pre:
            sections.append(pre)

    for i, pos in enumerate(positions):
        end = positions[i + 1] if i + 1 < len(positions) else len(body)
        section = body[pos:end].strip()
        if section:
            sections.append(section)

    return sections


def _split_long_text(text: str, max_chars: int = MAX_SNIPPET_CHARS) -> list[str]:
    """긴 텍스트를 문장 경계에서 분할."""
    if len(text) <= max_chars:
        return [text]

    parts = _SENTENCE_END.split(text)
    chunks: list[str] = []
    current = ""

    for part in parts:
        candidate = (current + " " + part).strip() if current else part.strip()
        if len(candidate) > max_chars and current:
            chunks.append(current.strip())
            current = part.strip()
        else:
            current = candidate

    if current.strip():
        chunks.append(current.strip())

    # fallback: 공백 단위 절단
    final: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            final.append(chunk)
        else:
            words = chunk.split()
            buf = ""
            for w in words:
                if len(buf) + len(w) + 1 > max_chars and buf:
                    final.append(buf.strip())
                    buf = w
                else:
                    buf = (buf + " " + w).strip() if buf else w
            if buf:
                final.append(buf.strip())

    return final


def _tokenize(text: str) -> dict[str, float]:
    """공백 토큰 + char bigram + trigram 생성."""
    tokens: dict[str, float] = {}
    words = text.lower().split()
    for w in words:
        tokens[w] = 1.0

    joined = "".join(words)
    for i in range(len(joined) - 1):
        bg = joined[i : i + 2]
        tokens.setdefault(bg, 0.0)
        tokens[bg] = max(tokens[bg], 0.8)
    for i in range(len(joined) - 2):
        tg = joined[i : i + 3]
        tokens.setdefault(tg, 0.0)
        tokens[tg] = max(tokens[tg], 0.8)

    return tokens


def _merge_short_sections(sections: list[str]) -> list[str]:
    """300자 미만 섹션 병합, 700자 초과 분할."""
    merged: list[str] = []
    buf = ""
    for sec in sections:
        if buf:
            candidate = buf + "\n\n" + sec
            if len(candidate) <= MAX_SNIPPET_CHARS:
                buf = candidate
                continue
            merged.append(buf)
            buf = sec
        else:
            buf = sec

        if len(buf) >= MIN_SNIPPET_CHARS:
            merged.append(buf)
            buf = ""

    if buf:
        if merged and len(merged[-1]) + len(buf) + 2 <= MAX_SNIPPET_CHARS:
            merged[-1] = merged[-1] + "\n\n" + buf
        else:
            merged.append(buf)

    final: list[str] = []
    for sec in merged:
        final.extend(_split_long_text(sec))
    return final


def _build_snippets(doc: CorpusDocument, body: str) -> list[CorpusSnippet]:
    """문서 본문을 스니펫으로 분할."""
    sections = _split_into_sections(body)
    if not sections:
        return []

    final_sections = _merge_short_sections(sections)

    snippets: list[CorpusSnippet] = []
    for idx, content in enumerate(final_sections):
        if not content.strip():
            continue
        tokens = _tokenize(content)
        snippets.append(
            CorpusSnippet(
                snippet_id=f"{doc.doc_id}::{idx:03d}",
                doc_id=doc.doc_id,
                title=doc.title,
                category=doc.category,
                content=content,
                tokens=tokens,
                char_count=len(content),
            )
        )

    return snippets


# ── 코퍼스 빌드 ────────────────────────────────────────────────
def _build_corpus(corpus_dir: Path) -> CorpusIndex:
    """디렉터리에서 approved 문서만 읽어 CorpusIndex 생성."""
    index = CorpusIndex()

    md_files = sorted(corpus_dir.glob("*.md"))
    for fpath in md_files:
        if fpath.name == "README.md":
            continue

        try:
            text = fpath.read_text(encoding="utf-8")
        except Exception:
            logger.warning("corpus_file_read_error path=%s", fpath)
            continue

        meta = _parse_frontmatter(text)
        if meta is None:
            logger.warning("corpus_skip_no_frontmatter path=%s", fpath)
            continue

        doc = _validate_frontmatter(meta, str(fpath))
        if doc is None:
            continue

        body = _extract_body(text)
        if not body.strip():
            logger.warning("corpus_skip_empty_body path=%s", fpath)
            continue

        snippets = _build_snippets(doc, body)
        if not snippets:
            continue

        index.documents[doc.doc_id] = doc
        index.snippets.extend(snippets)

    index.doc_count = len(index.documents)
    index.snippet_count = len(index.snippets)
    if index.snippets:
        index.avg_doc_len = sum(s.char_count for s in index.snippets) / index.snippet_count

    logger.info(
        "corpus_loaded docs=%d snippets=%d",
        index.doc_count,
        index.snippet_count,
    )
    return index
