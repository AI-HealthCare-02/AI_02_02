"""사주 사이드 게임 모델 (v2.7 P1 스캐폴딩).

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

from tortoise import fields, models


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
    birth_time = fields.TimeField(null=True)  # null 허용 (unknown 시)
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
