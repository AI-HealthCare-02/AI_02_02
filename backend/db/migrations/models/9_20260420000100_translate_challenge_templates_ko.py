from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "challenge_templates"
        SET "name"='매일 30분 걷기',
            "description"='하루 30분 이상 걸어요.',
            "evidence_summary"='공유 데모 검증용 간단 걷기 목표.'
        WHERE "code"='daily_walk_30min';

        UPDATE "challenge_templates"
        SET "name"='7시간 숙면',
            "description"='하루 7시간 이상 자요.',
            "evidence_summary"='리포트·챌린지 테스트용 수면 일관성 목표.'
        WHERE "code"='sleep_7h';

        UPDATE "challenge_templates"
        SET "name"='물 6잔 마시기',
            "description"='하루 물 6잔 이상 마셔요.',
            "evidence_summary"='완료 사례 예시용 수분 섭취 목표.'
        WHERE "code"='water_6cups';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "challenge_templates"
        SET "name"='Daily 30min Walk',
            "description"='Walk at least 30 minutes per day.',
            "evidence_summary"='Simple daily walking target for shared demo verification.'
        WHERE "code"='daily_walk_30min';

        UPDATE "challenge_templates"
        SET "name"='Sleep 7h',
            "description"='Sleep at least 7 hours.',
            "evidence_summary"='Sleep consistency target for report/challenge testing.'
        WHERE "code"='sleep_7h';

        UPDATE "challenge_templates"
        SET "name"='Water 6 cups',
            "description"='Drink at least 6 cups of water daily.',
            "evidence_summary"='Hydration target for completed challenge examples.'
        WHERE "code"='water_6cups';"""


MODELS_STATE = (
    "eJyrVsrPVrJSMKwFAA3IAqI="
)
