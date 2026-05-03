"""사주 P1.5 export / hard delete 통합 테스트.

검증 범위:
- 서비스 레벨: export_user_data / hard_delete_user_data
- HTTP 레이어: GET /saju/data/export · DELETE /saju/data
  (feature flag 무관 동작 확인, 인증은 dependency_overrides 로 우회)
- 다른 사용자 격리
- settings CSV export 에 사주 블록 포함

P2 이후 (sajupy 등) 의존 없이 P1 모델만으로 동작 검증.
"""

from __future__ import annotations

from datetime import date, time
from typing import Any

from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from backend.core import config
from backend.dependencies.security import get_request_user
from backend.main import app
from backend.models.saju import (
    SajuChart,
    SajuConsentEvent,
    SajuDailyCard,
    SajuFeedbackEvent,
    SajuProfile,
)
from backend.models.users import Gender, User
from backend.services.saju.consent import CONSENT_VERSION_REVOCATION
from backend.services.saju.service import SajuService
from backend.services.settings import SettingsService


async def _create_user(email: str, *, phone: str = "01000000001") -> User:
    return await User.create(
        email=email,
        hashed_password="dummy-hash-for-saju-p1.5-test",
        name="테스터",
        gender=Gender.MALE,
        birthday=date(1990, 1, 1),
        phone_number=phone,
    )


async def _seed_saju_data(user: User) -> dict[str, Any]:
    """테스트 시드 데이터. 프로필은 서비스 경유로 저장해 birth_time 정규화 경로 검증."""
    consent = await SajuConsentEvent.create(
        user_id=user.id,
        consent_version="saju-v1.0",
        granted=True,
    )
    profile = await SajuService().upsert_profile(
        user_id=user.id,
        birth_date=date(1990, 1, 1),
        is_lunar=False,
        is_leap_month=False,
        birth_time=time(12, 0),  # naive — 서비스가 보장
        birth_time_accuracy="exact",
        gender="MALE",
    )
    chart = await SajuChart.create(
        profile_id=profile.id,
        engine_version="p1.5-test",
        natal={"stub": True},
        strength={},
        yongshin={},
        daewoon=[],
    )
    card = await SajuDailyCard.create(
        user_id=user.id,
        card_date=date(2026, 4, 23),
        summary="정리가 잘 맞는 하루 흐름이에요",
        keywords=["정리", "회복", "점검"],
        sections=[
            {
                "key": "total",
                "title": "총운",
                "body": "오늘은 마무리에 힘이 붙는 흐름이에요.",
                "reason": "정리·마무리 쪽 기운이 강하게 잡혔어요.",
            }
        ],
        safety_notice="이 내용은 재미와 자기이해를 위한 참고용 운세입니다.",
        engine_version="p1.5-test",
        template_version="v1",
    )
    feedback = await SajuFeedbackEvent.create(
        user_id=user.id,
        card_id=card.id,
        section_key="total",
        verdict="match",
    )
    return {
        "consent": consent,
        "profile": profile,
        "chart": chart,
        "card": card,
        "feedback": feedback,
    }


class TestSajuExportService(TestCase):
    """SajuService.export_user_data 서비스 레벨 검증."""

    async def test_export_returns_all_sections(self):
        user = await _create_user("export_all@test.com")
        await _seed_saju_data(user)

        service = SajuService()
        data = await service.export_user_data(user_id=user.id)

        assert data["user_id"] == user.id
        assert data["exported_at"] is not None

        assert len(data["consent_events"]) == 1
        assert data["consent_events"][0]["consent_version"] == "saju-v1.0"
        assert data["consent_events"][0]["granted"] is True

        assert data["profile"] is not None
        assert data["profile"]["birth_date"] == date(1990, 1, 1)
        assert data["profile"]["birth_time_accuracy"] == "exact"
        assert data["profile"]["gender"] == "MALE"

        assert data["chart"] is not None
        assert data["chart"]["engine_version"] == "p1.5-test"

        assert len(data["daily_cards"]) == 1
        assert data["daily_cards"][0]["summary"].startswith("정리가")
        assert data["daily_cards"][0]["keywords"] == ["정리", "회복", "점검"]

        assert len(data["feedback_events"]) == 1
        assert data["feedback_events"][0]["verdict"] == "match"
        assert data["feedback_events"][0]["card_date"] == date(2026, 4, 23)
        assert data["feedback_events"][0]["section_key"] == "total"

    async def test_export_empty_state(self):
        user = await _create_user("export_empty@test.com", phone="01000000002")

        service = SajuService()
        data = await service.export_user_data(user_id=user.id)

        assert data["user_id"] == user.id
        assert data["consent_events"] == []
        assert data["profile"] is None
        assert data["chart"] is None
        assert data["daily_cards"] == []
        assert data["feedback_events"] == []


class TestSajuHardDelete(TestCase):
    """SajuService.hard_delete_user_data 서비스 레벨 검증 + 격리."""

    async def test_hard_delete_clears_all_user_data(self):
        user = await _create_user("delete_all@test.com")
        seed = await _seed_saju_data(user)

        service = SajuService()
        counts = await service.hard_delete_user_data(user_id=user.id)

        assert counts["feedback_events"] == 1
        assert counts["daily_cards"] == 1
        assert counts["chart"] == 1
        assert counts["profile"] == 1
        assert counts["consent_events"] == 1

        assert await SajuProfile.filter(user_id=user.id).count() == 0
        assert await SajuDailyCard.filter(user_id=user.id).count() == 0
        assert await SajuFeedbackEvent.filter(user_id=user.id).count() == 0
        assert await SajuChart.filter(profile_id=seed["profile"].id).count() == 0

        # consent_events: 기존 granted 는 hard delete, revoke 이벤트 1건만 남음
        remaining = await SajuConsentEvent.filter(user_id=user.id).all()
        assert len(remaining) == 1
        assert remaining[0].consent_version == CONSENT_VERSION_REVOCATION
        assert remaining[0].granted is False

    async def test_hard_delete_isolates_other_users(self):
        me = await _create_user("me_delete@test.com", phone="01000000011")
        other = await _create_user("other_keep@test.com", phone="01000000012")
        await _seed_saju_data(me)
        await _seed_saju_data(other)

        service = SajuService()
        await service.hard_delete_user_data(user_id=me.id)

        # me 측: 삭제 완료 (revoke 이벤트 1건만)
        assert await SajuProfile.filter(user_id=me.id).count() == 0
        assert await SajuDailyCard.filter(user_id=me.id).count() == 0

        # other 측: 원본 그대로 유지
        assert await SajuProfile.filter(user_id=other.id).count() == 1
        assert await SajuDailyCard.filter(user_id=other.id).count() == 1
        assert await SajuFeedbackEvent.filter(user_id=other.id).count() == 1
        granted_count = await SajuConsentEvent.filter(
            user_id=other.id, granted=True
        ).count()
        assert granted_count == 1


class TestSajuDataApiWithFlagDisabled(TestCase):
    """GET /saju/data/export · DELETE /saju/data : SAJU_ENABLED=false 에서도 200."""

    async def asyncSetUp(self):
        await super().asyncSetUp()
        self._user = await _create_user("api_user@test.com", phone="01000000021")
        app.dependency_overrides[get_request_user] = lambda: self._user
        self._saju_flag_backup = config.SAJU_ENABLED
        config.SAJU_ENABLED = False

    async def asyncTearDown(self):
        config.SAJU_ENABLED = self._saju_flag_backup
        app.dependency_overrides.pop(get_request_user, None)
        await super().asyncTearDown()

    async def test_export_endpoint_200_when_flag_disabled(self):
        await _seed_saju_data(self._user)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/v1/saju/data/export")

        assert response.status_code == status.HTTP_200_OK
        payload = response.json()
        assert payload["user_id"] == self._user.id
        assert payload["profile"] is not None
        assert len(payload["consent_events"]) == 1
        assert len(payload["daily_cards"]) == 1
        assert len(payload["feedback_events"]) == 1

    async def test_delete_endpoint_200_when_flag_disabled(self):
        await _seed_saju_data(self._user)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.delete("/api/v1/saju/data")

        assert response.status_code == status.HTTP_200_OK
        payload = response.json()
        assert payload["deleted"] is True
        assert payload["revoke_event_recorded"] is True
        assert payload["counts"]["profile"] == 1
        assert payload["counts"]["daily_cards"] == 1
        assert payload["counts"]["feedback_events"] == 1

        # revoke 이벤트 1건 남았는지 DB 직접 확인
        remaining = await SajuConsentEvent.filter(user_id=self._user.id).all()
        assert len(remaining) == 1
        assert remaining[0].consent_version == CONSENT_VERSION_REVOCATION


class TestSettingsCsvExportIncludesSaju(TestCase):
    """backend/services/settings.py 의 CSV export 에 사주 블록 포함."""

    async def test_csv_contains_saju_sections(self):
        user = await _create_user("settings_export@test.com", phone="01000000031")
        await _seed_saju_data(user)

        service = SettingsService()
        csv_text, filename, _ = await service.export_user_data_csv(user_id=user.id)

        # 사주 섹션 3개가 모두 포함
        assert "saju_consent" in csv_text
        assert "saju_profile" in csv_text
        assert "saju_summary" in csv_text

        # 구체 필드
        assert "consent_version" in csv_text
        assert "saju-v1.0" in csv_text
        assert "birth_time_accuracy" in csv_text
        assert "daily_cards_count" in csv_text

        # 기존 섹션 (chat-knowledge 무관하게 기본 사용자 블록) 유지
        assert "user" in csv_text
        assert "settings" in csv_text
        assert filename.startswith("danaa-user-export-")

    async def test_csv_empty_saju_state(self):
        user = await _create_user("settings_empty@test.com", phone="01000000032")

        service = SettingsService()
        csv_text, _, _ = await service.export_user_data_csv(user_id=user.id)

        # 동의·프로필 없으면 해당 블록 생략. summary(카운트=0) 는 항상 출력.
        assert "saju_consent" not in csv_text
        assert "saju_profile" not in csv_text
        assert "saju_summary" in csv_text
        assert "daily_cards_count" in csv_text


class TestBirthTimeNormalization(TestCase):
    """서비스 레이어 birth_time 정규화 검증.

    DB 컬럼 TIME WITHOUT TZ 특성상 tz-aware time 저장이 불가. 서비스가
    tzinfo 를 벗겨 저장하고, 저장된 값은 naive 로 되돌려지는지 확인.
    """

    async def test_upsert_profile_strips_tzinfo_from_aware_time(self):
        from datetime import timedelta, timezone

        user = await _create_user("tz_aware@test.com", phone="01000000041")
        await SajuConsentEvent.create(
            user_id=user.id,
            consent_version="saju-v1.0",
            granted=True,
        )
        # Pydantic 이 "12:00+09:00" 같은 문자열을 파싱할 때 생성되는 UTC offset 기반 aware time
        aware_time = time(12, 0, tzinfo=timezone(timedelta(hours=9)))

        service = SajuService()
        profile = await service.upsert_profile(
            user_id=user.id,
            birth_date=date(1990, 1, 1),
            is_lunar=False,
            is_leap_month=False,
            birth_time=aware_time,
            birth_time_accuracy="exact",
            gender="MALE",
        )

        # 저장 직후 인스턴스
        assert profile.birth_time is not None
        assert profile.birth_time.tzinfo is None
        assert profile.birth_time.hour == 12
        assert profile.birth_time.minute == 0

        # DB round-trip 검증 — 다시 조회해도 naive
        reloaded = await SajuProfile.filter(user_id=user.id).first()
        assert reloaded is not None
        assert reloaded.birth_time is not None
        assert reloaded.birth_time.tzinfo is None
        assert reloaded.birth_time.hour == 12

    async def test_upsert_profile_preserves_naive_time(self):
        user = await _create_user("naive_time@test.com", phone="01000000042")
        await SajuConsentEvent.create(
            user_id=user.id,
            consent_version="saju-v1.0",
            granted=True,
        )
        naive_time = time(7, 30)

        service = SajuService()
        profile = await service.upsert_profile(
            user_id=user.id,
            birth_date=date(1990, 1, 1),
            is_lunar=False,
            is_leap_month=False,
            birth_time=naive_time,
            birth_time_accuracy="exact",
            gender="FEMALE",
        )

        assert profile.birth_time == time(7, 30)
        assert profile.birth_time.tzinfo is None

    async def test_upsert_profile_accepts_none_birth_time(self):
        user = await _create_user("unknown_time@test.com", phone="01000000043")
        await SajuConsentEvent.create(
            user_id=user.id,
            consent_version="saju-v1.0",
            granted=True,
        )

        service = SajuService()
        profile = await service.upsert_profile(
            user_id=user.id,
            birth_date=date(1990, 1, 1),
            is_lunar=False,
            is_leap_month=False,
            birth_time=None,
            birth_time_accuracy="unknown",
            gender="UNKNOWN",
        )

        assert profile.birth_time is None


class TestSajuProfilePolicyApi(TestCase):
    """본인 계정 기준 사주 1개 정책 검증."""

    async def asyncSetUp(self):
        await super().asyncSetUp()
        self._user = await _create_user("saju_policy@test.com", phone="01000000051")
        app.dependency_overrides[get_request_user] = lambda: self._user
        self._saju_flag_backup = config.SAJU_ENABLED
        config.SAJU_ENABLED = True
        await SajuConsentEvent.create(
            user_id=self._user.id,
            consent_version="saju-v1.0",
            granted=True,
        )

    async def asyncTearDown(self):
        config.SAJU_ENABLED = self._saju_flag_backup
        app.dependency_overrides.pop(get_request_user, None)
        await super().asyncTearDown()

    async def test_put_profile_uses_account_snapshot_and_locks_birth_date(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            created = await client.put(
                "/api/v1/saju/profile",
                json={
                    "birth_time": "08:30:00",
                    "birth_time_accuracy": "exact",
                },
            )
            locked = await client.put(
                "/api/v1/saju/profile",
                json={
                    "birth_date": "1999-09-09",
                    "birth_time": "09:30:00",
                    "birth_time_accuracy": "exact",
                },
            )

        assert created.status_code == status.HTTP_200_OK
        assert created.json()["birth_date"] == "1990-01-01"
        assert created.json()["gender"] == "MALE"
        assert locked.status_code == status.HTTP_409_CONFLICT
        assert locked.json()["detail"] == "birth_date_locked"

        profile = await SajuProfile.filter(user_id=self._user.id).first()
        assert profile is not None
        assert profile.birth_date == date(1990, 1, 1)
        assert profile.birth_time == time(8, 30)

    async def test_patch_profile_time_invalidates_chart_and_daily_card(self):
        profile = await SajuService().create_profile_from_user(
            user=self._user,
            birth_time=None,
            birth_time_accuracy="unknown",
        )
        chart = await SajuService().ensure_chart(profile=profile)
        await SajuDailyCard.create(
            user_id=self._user.id,
            card_date=date(2026, 5, 3),
            summary="테스트 카드",
            keywords=["테스트"],
            sections=[],
            safety_notice="참고용",
            engine_version=chart.engine_version,
            template_version="test",
        )

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.patch(
                "/api/v1/saju/profile/time",
                json={
                    "birth_time": "06:10:00",
                    "birth_time_accuracy": "exact",
                },
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["birth_time"] == "06:10:00"
        assert await SajuChart.filter(profile_id=profile.id).count() == 0
        assert await SajuDailyCard.filter(user_id=self._user.id).count() == 0

    async def test_patch_profile_time_rejects_locked_base_fields(self):
        await SajuService().create_profile_from_user(
            user=self._user,
            birth_time=None,
            birth_time_accuracy="unknown",
        )

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.patch(
                "/api/v1/saju/profile/time",
                json={
                    "birth_date": "1999-09-09",
                    "birth_time": "06:10:00",
                    "birth_time_accuracy": "exact",
                },
            )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
