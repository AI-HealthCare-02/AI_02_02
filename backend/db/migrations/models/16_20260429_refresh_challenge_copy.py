from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "challenge_templates"
        SET
            "name" = '물 8잔 마시기',
            "description" = '하루 물 8잔 이상 마셔요.',
            "goal_criteria" = '{"field":"water_cups","daily_target":8}'
        WHERE "code" = 'water_6cups';

        UPDATE "challenge_templates"
        SET
            "name" = '끼니마다 채소 먹기',
            "description" = '아침, 점심, 저녁 식사 때마다 채소를 함께 먹어요.'
        WHERE "code" = 'vegetable_3servings';

        UPDATE "challenge_templates"
        SET
            "name" = '음주 주 2회 이하',
            "description" = '일주일에 2회 이하로 음주 빈도를 줄여요.'
        WHERE "code" = 'drink_less_alcohol';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "challenge_templates"
        SET
            "name" = '물 6잔 마시기',
            "description" = '하루 물 6잔 이상 마셔요.',
            "goal_criteria" = '{"field":"water_cups","daily_target":6}'
        WHERE "code" = 'water_6cups';

        UPDATE "challenge_templates"
        SET
            "name" = '채소 3회 섭취',
            "description" = '하루 세 끼에 채소를 한 가지 이상 포함해요.'
        WHERE "code" = 'vegetable_3servings';

        UPDATE "challenge_templates"
        SET
            "name" = '음주 줄이기',
            "description" = '일주일에 2회 이하, 음주를 줄여요.'
        WHERE "code" = 'drink_less_alcohol';
    """


MODELS_STATE = (
    "eJyrVsrPVrJSMKwFAA3IAqI="
)
