"""참여 상태 머신 (_determine_state) 단위 테스트.

순수 함수 테스트 — DB 불필요.
5단계 상태 + 경계값 검증.
"""

from backend.models.enums import EngagementState
from backend.tasks.daily_cron import _determine_state


class TestDetermineState:
    """_determine_state(responded_days, last_gap) 테스트."""

    # ── 기본 상태 ──

    def test_active(self):
        """rate >= 0.80 → ACTIVE."""
        assert _determine_state(responded_days=6, last_gap=1) == EngagementState.ACTIVE
        assert _determine_state(responded_days=7, last_gap=0) == EngagementState.ACTIVE

    def test_moderate(self):
        """0.50 <= rate < 0.80 → MODERATE."""
        assert _determine_state(responded_days=4, last_gap=3) == EngagementState.MODERATE
        assert _determine_state(responded_days=5, last_gap=2) == EngagementState.MODERATE

    def test_low(self):
        """0.20 <= rate < 0.50 → LOW."""
        assert _determine_state(responded_days=2, last_gap=5) == EngagementState.LOW
        assert _determine_state(responded_days=3, last_gap=4) == EngagementState.LOW

    def test_dormant(self):
        """rate < 0.20 AND last_gap > 7 → DORMANT."""
        assert _determine_state(responded_days=1, last_gap=10) == EngagementState.DORMANT
        assert _determine_state(responded_days=0, last_gap=15) == EngagementState.DORMANT

    def test_hibernating(self):
        """last_gap > 30 → HIBERNATING (최우선)."""
        assert _determine_state(responded_days=0, last_gap=31) == EngagementState.HIBERNATING
        assert _determine_state(responded_days=7, last_gap=31) == EngagementState.HIBERNATING

    # ── 경계값 ──

    def test_boundary_active_moderate(self):
        """rate = 6/7 ≈ 0.857 → ACTIVE."""
        assert _determine_state(responded_days=6, last_gap=1) == EngagementState.ACTIVE

    def test_boundary_moderate_low(self):
        """rate = 3/7 ≈ 0.429 → LOW."""
        assert _determine_state(responded_days=3, last_gap=4) == EngagementState.LOW

    def test_boundary_gap_30(self):
        """last_gap=30 → NOT HIBERNATING (> 30 필요)."""
        assert _determine_state(responded_days=0, last_gap=30) != EngagementState.HIBERNATING

    def test_boundary_gap_31(self):
        """last_gap=31 → HIBERNATING."""
        assert _determine_state(responded_days=0, last_gap=31) == EngagementState.HIBERNATING

    def test_low_rate_short_gap_is_low_not_dormant(self):
        """rate < 0.20 but gap <= 7 → LOW (DORMANT 아님)."""
        assert _determine_state(responded_days=1, last_gap=5) == EngagementState.LOW

    def test_zero_responded_short_gap(self):
        """0일 응답, gap=3 → LOW."""
        assert _determine_state(responded_days=0, last_gap=3) == EngagementState.LOW
