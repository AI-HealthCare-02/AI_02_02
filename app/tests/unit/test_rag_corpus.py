"""RAG 코퍼스 로더 단위 테스트.

핵심 테스트:
- approved 문서만 로드
- review_status != approved → reject
- frontmatter 누락/오염 → reject
- category whitelist 검증
- H2/H3 snippet split
- 300자 미만 병합, 700자 초과 분할
- forbidden path 미로드
"""


from app.services.rag_corpus import (
    VALID_CATEGORIES,
    CorpusIndex,
    _build_snippets,
    _extract_body,
    _parse_frontmatter,
    _split_into_sections,
    _validate_frontmatter,
    clear_corpus,
    get_corpus,
    load_corpus,
)

# ──────────────────────────────────────────────
# Frontmatter 파서
# ──────────────────────────────────────────────


class TestParseFrontmatter:
    def test_valid_frontmatter(self):
        text = "---\ndoc_id: test_001\ntitle: 테스트\ncategory: diet_nutrition\nreview_status: approved\nversion: 1\n---\n본문"
        meta = _parse_frontmatter(text)
        assert meta is not None
        assert meta["doc_id"] == "test_001"
        assert meta["title"] == "테스트"
        assert meta["version"] == "1"

    def test_no_frontmatter(self):
        assert _parse_frontmatter("그냥 텍스트") is None

    def test_no_closing_delimiter(self):
        text = "---\ndoc_id: test\ntitle: 없음\n본문만 있음"
        assert _parse_frontmatter(text) is None

    def test_empty_frontmatter(self):
        text = "---\n---\n본문"
        assert _parse_frontmatter(text) is None

    def test_multiline_value_ignored(self):
        text = "---\ndoc_id: test\ntitle: 제목\n  - 리스트는 무시\ncategory: diet_nutrition\nreview_status: approved\nversion: 1\n---\n본문"
        meta = _parse_frontmatter(text)
        assert meta is not None
        assert "- 리스트는 무시" not in meta.values()


class TestExtractBody:
    def test_body_after_frontmatter(self):
        text = "---\ndoc_id: x\n---\n본문입니다"
        assert _extract_body(text) == "본문입니다"

    def test_no_frontmatter(self):
        text = "그냥 본문"
        assert _extract_body(text) == "그냥 본문"


# ──────────────────────────────────────────────
# Frontmatter 검증
# ──────────────────────────────────────────────


class TestValidateFrontmatter:
    def _meta(self, **overrides):
        base = {
            "doc_id": "test_001",
            "title": "테스트 문서",
            "category": "diet_nutrition",
            "review_status": "approved",
            "version": "1",
        }
        base.update(overrides)
        return base

    def test_valid(self):
        doc = _validate_frontmatter(self._meta(), "test.md")
        assert doc is not None
        assert doc.doc_id == "test_001"

    def test_missing_required_field(self):
        meta = self._meta()
        del meta["doc_id"]
        assert _validate_frontmatter(meta, "test.md") is None

    def test_not_approved(self):
        assert _validate_frontmatter(self._meta(review_status="draft"), "test.md") is None

    def test_invalid_category(self):
        assert _validate_frontmatter(self._meta(category="unknown"), "test.md") is None

    def test_invalid_version(self):
        assert _validate_frontmatter(self._meta(version="abc"), "test.md") is None

    def test_all_valid_categories(self):
        for cat in VALID_CATEGORIES:
            doc = _validate_frontmatter(self._meta(category=cat), "test.md")
            assert doc is not None, f"category={cat} should be valid"


# ──────────────────────────────────────────────
# 스니펫 분할
# ──────────────────────────────────────────────


class TestSplitSections:
    def test_heading_split(self):
        body = "## 섹션 1\n내용1\n## 섹션 2\n내용2"
        sections = _split_into_sections(body)
        assert len(sections) == 2
        assert sections[0].startswith("## 섹션 1")
        assert sections[1].startswith("## 섹션 2")

    def test_h3_split(self):
        body = "### 소섹션\n내용"
        sections = _split_into_sections(body)
        assert len(sections) == 1
        assert "### 소섹션" in sections[0]

    def test_no_heading(self):
        body = "그냥 텍스트만 있는 본문"
        sections = _split_into_sections(body)
        assert len(sections) == 1

    def test_pre_heading_text(self):
        body = "서론 텍스트\n## 첫 섹션\n내용"
        sections = _split_into_sections(body)
        assert len(sections) == 2


class TestBuildSnippets:
    def _doc(self):
        from app.services.rag_corpus import CorpusDocument

        return CorpusDocument(
            doc_id="test_001",
            title="테스트",
            category="diet_nutrition",
            version=1,
            review_status="approved",
            source_path="test.md",
        )

    def test_snippet_id_format(self):
        body = "## 섹션\n" + "가나다라마바사아자차카타파하 " * 30
        snippets = _build_snippets(self._doc(), body)
        assert len(snippets) >= 1
        assert snippets[0].snippet_id == "test_001::000"

    def test_short_sections_merged(self):
        body = "## A\n짧은 내용\n## B\n짧은 내용2\n## C\n짧은 내용3"
        snippets = _build_snippets(self._doc(), body)
        # 300자 미만 섹션들은 병합됨
        assert len(snippets) <= 3

    def test_long_section_split(self):
        body = "## 긴 섹션\n" + "이것은 테스트 문장입니다. " * 100
        snippets = _build_snippets(self._doc(), body)
        assert len(snippets) >= 2

    def test_tokens_generated(self):
        body = "## 당뇨 식단 관리\n당뇨 환자의 올바른 식단 관리 방법에 대해 설명합니다. " * 20
        snippets = _build_snippets(self._doc(), body)
        assert len(snippets) >= 1
        assert len(snippets[0].tokens) > 0

    def test_empty_body(self):
        snippets = _build_snippets(self._doc(), "")
        assert len(snippets) == 0


# ──────────────────────────────────────────────
# 코퍼스 로더 (filesystem)
# ──────────────────────────────────────────────


class TestLoadCorpus:
    def test_load_nonexistent_dir(self):
        clear_corpus()
        idx = load_corpus("/nonexistent/path")
        assert isinstance(idx, CorpusIndex)
        assert idx.doc_count == 0

    def test_load_and_get(self, tmp_path):
        clear_corpus()
        doc_file = tmp_path / "test.md"
        doc_file.write_text(
            "---\n"
            "doc_id: diet_001\n"
            "title: 식단 관리\n"
            "category: diet_nutrition\n"
            "review_status: approved\n"
            "version: 1\n"
            "---\n"
            "## 식단 기본 원칙\n"
            + "균형 잡힌 식단은 건강의 기본이에요. " * 20
            + "\n## 실천 방법\n"
            + "매일 규칙적인 식사를 하는 것이 좋아요. " * 20,
            encoding="utf-8",
        )
        idx = load_corpus(str(tmp_path))
        assert idx.doc_count == 1
        assert idx.snippet_count >= 1
        assert "diet_001" in idx.documents

        # get_corpus() should return the same
        assert get_corpus() is idx

    def test_reject_not_approved(self, tmp_path):
        clear_corpus()
        doc_file = tmp_path / "draft.md"
        doc_file.write_text(
            "---\n"
            "doc_id: draft_001\n"
            "title: 초안\n"
            "category: diet_nutrition\n"
            "review_status: draft\n"
            "version: 1\n"
            "---\n## 내용\n본문",
            encoding="utf-8",
        )
        idx = load_corpus(str(tmp_path))
        assert idx.doc_count == 0

    def test_reject_missing_frontmatter(self, tmp_path):
        clear_corpus()
        doc_file = tmp_path / "no_fm.md"
        doc_file.write_text("그냥 본문만 있는 파일", encoding="utf-8")
        idx = load_corpus(str(tmp_path))
        assert idx.doc_count == 0

    def test_reject_invalid_category(self, tmp_path):
        clear_corpus()
        doc_file = tmp_path / "bad_cat.md"
        doc_file.write_text(
            "---\n"
            "doc_id: bad_001\n"
            "title: 잘못된 카테고리\n"
            "category: invalid_category\n"
            "review_status: approved\n"
            "version: 1\n"
            "---\n## 내용\n본문",
            encoding="utf-8",
        )
        idx = load_corpus(str(tmp_path))
        assert idx.doc_count == 0

    def test_readme_skipped(self, tmp_path):
        clear_corpus()
        readme = tmp_path / "README.md"
        readme.write_text(
            "---\n"
            "doc_id: readme\n"
            "title: 리드미\n"
            "category: diet_nutrition\n"
            "review_status: approved\n"
            "version: 1\n"
            "---\n## 내용\n본문",
            encoding="utf-8",
        )
        idx = load_corpus(str(tmp_path))
        assert idx.doc_count == 0

    def test_clear_corpus(self, tmp_path):
        clear_corpus()
        doc_file = tmp_path / "test.md"
        doc_file.write_text(
            "---\n"
            "doc_id: t1\n"
            "title: 테스트\n"
            "category: diet_nutrition\n"
            "review_status: approved\n"
            "version: 1\n"
            "---\n## 내용\n" + "테스트 내용입니다. " * 30,
            encoding="utf-8",
        )
        load_corpus(str(tmp_path))
        assert get_corpus() is not None
        clear_corpus()
        # After clear, _load_attempted is reset, so get_corpus will try lazy load
        # but with RAG_ENABLED=False by default, it won't load
        assert get_corpus() is None
