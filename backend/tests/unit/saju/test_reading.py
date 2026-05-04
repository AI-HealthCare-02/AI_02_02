"""P4.2 사주 리딩 템플릿 단위 테스트."""

from datetime import date, time

import pytest

from backend.dtos.saju import SajuReadingResponse
from backend.services.saju.engine.chart import ENGINE_VERSION, compute_natal_chart
from backend.services.saju.templates.reading import build_reading

_FORBIDDEN_TERMS = [
    "진단",
    "처방",
    "치료",
    "완치",
    "사망",
    "반드시 합격",
    "반드시 헤어",
    "큰돈을",
    "수술",
]


def _natal() -> dict:
    return compute_natal_chart(
        birth_date=date(1985, 3, 25),
        birth_time=time(18, 30),
    )["natal"]


def _blob(payload: dict) -> str:
    parts = [payload.get("summary", "")]
    parts.extend(payload.get("keywords", []))
    for section in payload.get("sections", []):
        parts.extend([
            section.get("title", ""),
            section.get("body", ""),
            section.get("easy_summary", "") or "",
            section.get("reason", "") or "",
        ])
    for month in payload.get("months", []):
        parts.extend([
            month.get("title", ""),
            month.get("summary", ""),
            month.get("detail", ""),
            month.get("reason", "") or "",
            month.get("ganji", ""),
            month.get("stem_ten_god", ""),
            month.get("branch_ten_god", ""),
            " ".join(month.get("evidence", []) or []),
            " ".join(month.get("action_hints", []) or []),
            " ".join((month.get("domain_readings", {}) or {}).values()),
        ])
    return " ".join(parts)


class TestReadingTemplate:
    @pytest.mark.parametrize("period", ["natal", "yearly", "monthly"])
    def test_reading_response_validates(self, period: str) -> None:
        payload = build_reading(
            period=period,  # type: ignore[arg-type]
            natal=_natal(),
            engine_version=ENGINE_VERSION,
            year=2026,
        )

        dto = SajuReadingResponse.model_validate(payload)

        assert dto.period == period
        assert dto.title
        assert dto.summary
        assert dto.keywords
        assert dto.sections
        assert dto.safety_notice
        assert dto.engine_version == ENGINE_VERSION

    def test_natal_reading_has_at_least_four_sections(self) -> None:
        payload = build_reading(
            period="natal",
            natal=_natal(),
            engine_version=ENGINE_VERSION,
        )

        assert len(payload["sections"]) >= 4
        assert payload["period"] == "natal"
        assert payload["natal_chart"]
        assert payload["yongshin"]

    def test_yearly_reading_uses_requested_year(self) -> None:
        payload = build_reading(
            period="yearly",
            natal=_natal(),
            engine_version=ENGINE_VERSION,
            year=2026,
        )

        assert payload["period"] == "yearly"
        assert payload["year"] == 2026
        assert "2026" in payload["title"]
        assert any("2026" in section["title"] or "2026" in section["body"] for section in payload["sections"])

    def test_monthly_reading_has_twelve_months_in_score_range(self) -> None:
        payload = build_reading(
            period="monthly",
            natal=_natal(),
            engine_version=ENGINE_VERSION,
            year=2026,
        )

        assert payload["period"] == "monthly"
        assert len(payload["months"]) == 12
        assert [m["month"] for m in payload["months"]] == list(range(1, 13))
        for month in payload["months"]:
            assert 0 <= month["score"] <= 100
            assert month["summary"]
            assert month["detail"]

    @pytest.mark.parametrize("period", ["natal", "yearly", "monthly"])
    def test_reading_has_no_forbidden_definitive_terms(self, period: str) -> None:
        payload = build_reading(
            period=period,  # type: ignore[arg-type]
            natal=_natal(),
            engine_version=ENGINE_VERSION,
            year=2026,
        )
        blob = _blob(payload)

        for term in _FORBIDDEN_TERMS:
            assert term not in blob, f"forbidden term {term!r} in {period}: {blob[:200]}"


# ═════════════════════════════════════════════
# P4.2 풀리딩 — 섹션 수 · 본문 길이 · 구조 확인
# ═════════════════════════════════════════════
class TestNatalReadingDepth:
    """나의 기질은 짧은 카드가 아닌 풀리딩이어야 한다 (≥8 섹션, 본문 3~5문장)."""

    def test_natal_has_at_least_eight_sections(self) -> None:
        r = build_reading(period="natal", natal=_natal(), engine_version=ENGINE_VERSION)
        assert len(r["sections"]) >= 8

    def test_natal_contains_core_section_keys(self) -> None:
        r = build_reading(period="natal", natal=_natal(), engine_version=ENGINE_VERSION)
        keys = {s["key"] for s in r["sections"]}
        # 사용자 명시 9항목 중 핵심 7개가 반드시 있어야 함
        expected = {"lead", "core_traits", "contradiction", "strengths", "cautions", "relation", "work", "recovery", "closing"}
        missing = expected - keys
        assert not missing, f"missing natal sections: {missing}"

    def test_natal_body_is_substantial(self) -> None:
        """lead 제외한 본문은 100자 이상(3~5문장 분량)."""
        r = build_reading(period="natal", natal=_natal(), engine_version=ENGINE_VERSION)
        for s in r["sections"]:
            if s["key"] == "lead":
                continue  # 한 줄 정의는 짧음
            assert len(s["body"]) >= 100, f"natal section {s['key']} body too short: {len(s['body'])} chars"

    def test_natal_easy_summary_provided(self) -> None:
        """'쉽게 말하면:' 한 줄이 lead 제외 섹션에 있어야 한다."""
        r = build_reading(period="natal", natal=_natal(), engine_version=ENGINE_VERSION)
        sections_with_easy = [
            s for s in r["sections"]
            if s["key"] != "lead" and s.get("easy_summary")
        ]
        assert len(sections_with_easy) >= 6, (
            f"natal should have easy_summary on most sections (got {len(sections_with_easy)})"
        )


class TestYearlyReadingDepth:
    """연운은 분야별·체크리스트·기회/주의를 포함해야 한다."""

    def test_yearly_has_checklist_section(self) -> None:
        r = build_reading(period="yearly", natal=_natal(), engine_version=ENGINE_VERSION, year=2026)
        keys = {s["key"] for s in r["sections"]}
        assert "checklist" in keys

    def test_yearly_has_opportunities_and_cautions(self) -> None:
        r = build_reading(period="yearly", natal=_natal(), engine_version=ENGINE_VERSION, year=2026)
        keys = {s["key"] for s in r["sections"]}
        assert "opportunities" in keys
        assert "cautions" in keys

    def test_yearly_has_career_money_health(self) -> None:
        r = build_reading(period="yearly", natal=_natal(), engine_version=ENGINE_VERSION, year=2026)
        keys = {s["key"] for s in r["sections"]}
        assert "career" in keys
        assert "money" in keys
        assert "health" in keys
        assert "relation" in keys

    def test_yearly_has_2026_deep_sections(self) -> None:
        r = build_reading(period="yearly", natal=_natal(), engine_version=ENGINE_VERSION, year=2026)
        keys = {s["key"] for s in r["sections"]}
        assert "year_role" in keys
        assert "natal_contact" in keys
        assert "half_year_strategy" in keys
        assert "monthly_digest" in keys

    def test_yearly_substantial_sections(self) -> None:
        r = build_reading(period="yearly", natal=_natal(), engine_version=ENGINE_VERSION, year=2026)
        # lead·closing 제외하고 본문 80자 이상
        for s in r["sections"]:
            if s["key"] in ("lead", "closing"):
                continue
            assert len(s["body"]) >= 80, f"yearly section {s['key']} body too short: {len(s['body'])}"

    def test_yearly_has_natural_korean_particles(self) -> None:
        r = build_reading(period="yearly", natal=_natal(), engine_version=ENGINE_VERSION, year=2026)
        blob = _blob(r)
        assert "은/는" not in blob


class TestMonthlyReadingDepth:
    """월별 흐름은 12 카드 + 연간 패턴 요약을 가져야 한다."""

    def test_monthly_has_pattern_summary(self) -> None:
        r = build_reading(period="monthly", natal=_natal(), engine_version=ENGINE_VERSION, year=2026)
        keys = {s["key"] for s in r["sections"]}
        assert "pattern_summary" in keys

    def test_monthly_detail_is_substantial(self) -> None:
        r = build_reading(period="monthly", natal=_natal(), engine_version=ENGINE_VERSION, year=2026)
        for m in r["months"]:
            assert len(m["detail"]) >= 80, f"month {m['month']} detail too short: {len(m['detail'])}"

    def test_monthly_score_in_range(self) -> None:
        r = build_reading(period="monthly", natal=_natal(), engine_version=ENGINE_VERSION, year=2026)
        for m in r["months"]:
            assert 0 <= m["score"] <= 100

    def test_monthly_contains_ten_god_evidence_and_actions(self) -> None:
        r = build_reading(period="monthly", natal=_natal(), engine_version=ENGINE_VERSION, year=2026)
        for m in r["months"]:
            assert m["ganji"]
            assert m["stem_ten_god"]
            assert m["branch_ten_god"]
            assert len(m["evidence"]) >= 2
            assert m["action_hints"]

    def test_may_and_june_are_not_copied_even_when_fire_months(self) -> None:
        r = build_reading(period="monthly", natal=_natal(), engine_version=ENGINE_VERSION, year=2026)
        may = r["months"][4]
        june = r["months"][5]
        assert may["ganji"] != june["ganji"]
        assert (may["stem_ten_god"], may["branch_ten_god"]) != (
            june["stem_ten_god"],
            june["branch_ten_god"],
        )
        assert may["summary"] != june["summary"]
        assert may["detail"] != june["detail"]

    def test_monthly_has_natural_element_particle_text(self) -> None:
        r = build_reading(period="monthly", natal=_natal(), engine_version=ENGINE_VERSION, year=2026)
        blob = _blob(r)
        assert "화을" not in blob
        assert "금와" not in blob
