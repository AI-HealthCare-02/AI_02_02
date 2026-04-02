from datetime import datetime


class OnboardingRepository:
    """Persistence boundary for onboarding writes.

    Current phase keeps this as a lightweight placeholder so router/service
    flow is fixed before real DB persistence is wired in.
    """

    async def save_survey_result(self, user_id: int, payload: dict) -> int:
        _ = (user_id, payload)
        return 1

    async def get_completed_status(self, user_id: int) -> tuple[bool, datetime | None]:
        _ = user_id
        return True, datetime.fromisoformat("2026-04-02T10:05:00+09:00")
