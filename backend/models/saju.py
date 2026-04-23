"""사주 사이드 게임 모델 (v2.7 P1 스캐폴딩 / P1.5 NaiveTimeField 보강).

5 테이블:
- SajuConsentEvent: 사주 전용 동의 이력
- SajuProfile: 생년월일·음양력·윤달·출생시간 상태 (1:1 User, soft delete)
- SajuChart: 계산된 사주 구조 (engine_version 포함)
- SajuDailyCard: 오늘의 운세 7 섹션 결과 + 근거
- SajuFeedbackEvent: 대박/맞아요/애매해요/아니에요

원칙:
- 건강 데이터와 분리 (기존 health/challenge 모델과 FK 연결 없음)
- 로그·Sentry에 생년월일·출생시간 노출 금지 (필드명만 식별자)
- 결정론 계산: 같은 입력이면 같은 chart (engine_version 고정)
"""

from datetime import time
from typing import Any

from tortoise import fields, models


class NaiveTimeField(fields.TimeField):
    """timezone-naive 저장 강제 TimeField.

    배경 — Tortoise 기본 `TimeField` 의 두 가지 tz 관련 동작:
      1. `SQL_TYPE` postgres override: `TIMETZ` (`TIME WITH TIME ZONE`).
         → schema generator 가 `TIMETZ` 컬럼을 만들면 asyncpg 가 aware time 을
           기대하게 됨. naive 를 주면 `tzinfo.utcoffset(None)` 호출에서
           `AttributeError: 'NoneType' object has no attribute 'utcoffset'`.
      2. `to_db_value`: `USE_TZ=True` 환경에서 naive → pytz `DstTzInfo` 강제 aware.
         → 운영 마이그레이션이 `TIME` (WITHOUT TZ) 로 만든 컬럼과 불일치해
           `tzinfo='Asia/Seoul'` 를 `TIME WITHOUT TZ` 에 넣으려다 실패.

    해결 (이 필드 한정, DDL 수준 영향 없음):
      - `SQL_TYPE` / postgres override 모두 `TIME` 으로 고정 → 운영 마이그레이션과 동일
      - `to_db_value` 에서 `tzinfo` 제거 → 저장 직전 naive 강제

    이 필드만 사용하는 컬럼은 항상 `TIME WITHOUT TIME ZONE` + naive `datetime.time`
    으로 일관. 전역 `USE_TZ` 설정이나 다른 DatetimeField 동작에 영향 없음.
    """

    SQL_TYPE = "TIME"

    # Tortoise 는 `_db_<backend>` inner class 로 SQL_TYPE override 를 받는다 (소문자 규약).
    class _db_postgres:  # noqa: N801
        SQL_TYPE = "TIME"

    def to_db_value(self, value: Any, instance: type[models.Model] | models.Model) -> Any:
        # 저장 직전: tzinfo 제거 (Tortoise USE_TZ=True 의 강제 aware 변환 무력화).
        result = super().to_db_value(value, instance)
        if isinstance(result, time) and result.tzinfo is not None:
            return result.replace(tzinfo=None)
        return result

    def to_python_value(self, value: Any) -> Any:
        # 읽기 직후: tzinfo 제거 (Tortoise 기본 구현이 default timezone 을 재부착).
        # 출생 시각은 지방시 기반이라 ORM 전역 tz 를 붙이면 오히려 혼선. naive 유지.
        result = super().to_python_value(value)
        if isinstance(result, time) and result.tzinfo is not None:
            return result.replace(tzinfo=None)
        return result


class SajuConsentEvent(models.Model):
    """사주 전용 동의 이력.

    CHECKED: 생년월일 등 민감정보 수집 전 반드시 동의 선행.
    RECORD: 버전·granted·해시 IP/UA (평문 저장 금지).
    """

    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="saju_consents", on_delete=fields.CASCADE)
    consent_version = fields.CharField(max_length=16)  # e.g. "saju-v1.0"
    granted = fields.BooleanField()
    ip_hash = fields.CharField(max_length=64, null=True)  # sha256 해시만
    ua_hash = fields.CharField(max_length=64, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "saju_consent_events"
        indexes = (("user", "created_at"),)


class BirthTimeAccuracy:
    """출생시간 정확도 enum value (StrEnum 대신 문자열 상수).

    Tortoise 2.x CharEnumField 미사용 (다른 모델 패턴과 일관성 유지).
    """

    EXACT = "exact"  # 정확히 앎
    APPROX = "approx"  # 대략 앎
    UNKNOWN = "unknown"  # 모름


class SajuProfile(models.Model):
    """사주 프로필 (1:1 User, soft delete).

    users.birthday · users.gender 를 재사용하지 않고 saju 전용 필드 유지:
    - 음력/양력·윤달 보정이 사주에서만 필요
    - 건강 데이터와 분리 원칙
    """

    id = fields.BigIntField(primary_key=True)
    user = fields.OneToOneField("models.User", related_name="saju_profile", on_delete=fields.CASCADE)
    birth_date = fields.DateField()
    is_lunar = fields.BooleanField(default=False)
    is_leap_month = fields.BooleanField(default=False)
    # NaiveTimeField: Tortoise USE_TZ=True 환경에서 강제 aware 변환을 막아
    # TIME WITHOUT TZ 컬럼과 정합성 유지 (서비스 _normalize_birth_time 과 2중 방어).
    birth_time = NaiveTimeField(null=True)  # null 허용 (unknown 시)
    birth_time_accuracy = fields.CharField(max_length=10, default=BirthTimeAccuracy.UNKNOWN)
    gender = fields.CharField(max_length=10)  # MALE/FEMALE/UNKNOWN
    is_deleted = fields.BooleanField(default=False)
    deleted_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "saju_profiles"


class SajuChart(models.Model):
    """계산된 사주 구조 (천간지지·용신 등) 캐시.

    P1 단계에서는 스키마만. P2(sajupy 통합) 이후 실제 계산값 저장.
    """

    id = fields.BigIntField(primary_key=True)
    profile = fields.OneToOneField("models.SajuProfile", related_name="chart", on_delete=fields.CASCADE)
    engine_version = fields.CharField(max_length=32)  # e.g. "sajupy-0.1.0"
    natal = fields.JSONField(default=dict)  # 원국 8자
    strength = fields.JSONField(default=dict)  # 신강신약 판정
    yongshin = fields.JSONField(default=dict)  # 용신 (학파별)
    daewoon = fields.JSONField(default=list)  # 대운 10개
    computed_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "saju_charts"


class SajuDailyCard(models.Model):
    """오늘의 운세 결과 (7 섹션 + 근거).

    UNIQUE(user, card_date): 하루 1장.
    재생성 시 engine_version 기반 invalidation.
    """

    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="saju_daily_cards", on_delete=fields.CASCADE)
    card_date = fields.DateField()
    summary = fields.CharField(max_length=200, default="")
    keywords = fields.JSONField(default=list)  # ["정리","점검","회복"]
    sections = fields.JSONField(default=list)  # [{key,title,body,reason}, ...]
    safety_notice = fields.TextField(default="")
    engine_version = fields.CharField(max_length=32)
    template_version = fields.CharField(max_length=32, default="v1")
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "saju_daily_cards"
        unique_together = (("user", "card_date"),)


class SajuFeedbackEvent(models.Model):
    """오늘의 운세 피드백 (대박/맞아요/애매해요/아니에요).

    MVP: 섹션 단위 또는 카드 전체 피드백.
    자유 텍스트 피드백은 MVP에서 저장하지 않음 (플랜 §7 준수).
    """

    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="saju_feedback", on_delete=fields.CASCADE)
    card = fields.ForeignKeyField(
        "models.SajuDailyCard", related_name="feedback", on_delete=fields.CASCADE, null=True
    )
    section_key = fields.CharField(max_length=20, null=True)  # total/money/relation/... or null=카드 전체
    verdict = fields.CharField(max_length=12)  # wow/match/mild/mismatch
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "saju_feedback_events"
        indexes = (("user", "created_at"),)


class SajuFeedbackVerdict:
    """피드백 4축 문자열 상수."""

    WOW = "wow"  # 대박
    MATCH = "match"  # 맞아요
    MILD = "mild"  # 애매해요
    MISMATCH = "mismatch"  # 아니에요
