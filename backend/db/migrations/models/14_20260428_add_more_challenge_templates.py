from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        INSERT INTO "challenge_templates" ("code", "name", "emoji", "category", "description", "goal_criteria", "default_duration_days", "evidence_summary", "for_groups", "is_active")
        VALUES
            ('exercise_3x_week',      '주 3회 유산소 운동',   '',  'exercise',   '일주일에 3번 이상 유산소 운동을 해요.',          '{"field":"exercise_done","daily_target":true}',   14, '규칙적 유산소 운동은 인슐린 감수성 개선에 효과적입니다.',     '["A","B","C"]', true),
            ('stretching_10min',      '매일 스트레칭 10분',   '',  'exercise',   '아침·저녁 스트레칭으로 혈액순환을 돕고 유연성을 높여요.',  '{"field":"exercise_done","daily_target":true}',   14, '간단한 스트레칭도 혈당 조절과 스트레스 완화에 도움이 됩니다.',  '["A","B","C"]', true),
            ('no_phone_before_sleep', '취침 전 스마트폰 금지', '',  'sleep',      '잠들기 1시간 전에는 스마트폰을 내려놓아요.',        '{"field":"manual","daily_target":true}',          14, '블루라이트 차단으로 멜라토닌 분비를 돕고 수면 질을 향상시킵니다.',  '["A","B","C"]', true),
            ('consistent_bedtime',    '규칙적 취침 시간',      '',  'sleep',      '매일 같은 시간에 자고 일어나요.',                '{"field":"manual","daily_target":true}',          14, '수면 리듬 유지는 혈당 조절 호르몬 균형에 필수적입니다.',        '["A","B","C"]', true),
            ('water_before_meal',     '식전 물 한 잔',         '',  'hydration',  '식사 30분 전에 물 한 잔(200ml)을 마셔요.',         '{"field":"water_cups","daily_target":1}',         14, '식전 수분 섭취는 과식 예방과 소화 개선에 효과적입니다.',          '["A","B","C"]', true),
            ('herbal_tea_daily',      '무가당 차 마시기',       '',  'hydration',  '하루 한 잔, 무가당 녹차 또는 허브티를 마셔요.',      '{"field":"manual","daily_target":true}',          14, '무가당 차는 항산화 작용과 혈당 안정화에 도움이 됩니다.',           '["A","B","C"]', true),
            ('vegetable_3servings',   '채소 3회 섭취',          '',  'diet',       '하루 세 끼에 채소를 한 가지 이상 포함해요.',         '{"field":"manual","daily_target":true}',          14, '식이섬유 풍부한 채소는 혈당 급등을 억제하고 장 건강을 개선합니다.',  '["A","B","C"]', true),
            ('no_sweetdrink',         '단음료 줄이기',           '',  'diet',       '탄산음료·과일 주스 등 당류 음료를 마시지 않아요.',   '{"field":"manual","daily_target":true}',          14, '설탕 음료 제한은 혈당 조절과 체중 관리에 가장 효과적인 식습관입니다.', '["A","B","C"]', true),
            ('no_nightsnack',         '야식 금지',               '',  'diet',       '저녁 9시 이후에는 음식을 먹지 않아요.',            '{"field":"manual","daily_target":true}',          14, '야간 공복 유지는 인슐린 저항성 감소와 지방 분해에 도움이 됩니다.',    '["A","B","C"]', true),
            ('drink_less_alcohol',    '음주 줄이기',             '',  'lifestyle',  '일주일에 2회 이하, 음주를 줄여요.',                '{"field":"manual","daily_target":true}',          14, '과음은 혈당 조절을 방해하고 간 건강에 부정적 영향을 줍니다.',        '["A","B","C"]', true),
            ('medication_daily',      '약 꼬박꼬박 먹기',        '',  'medication', '처방받은 약을 매일 빠짐없이 복용해요.',             '{"field":"manual","daily_target":true}',          14, '규칙적인 복약은 혈당 안정화의 기본입니다.',                         '["A","B","C"]', true)
        ON CONFLICT ("code") DO NOTHING;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DELETE FROM "challenge_templates"
        WHERE "code" IN (
            'exercise_3x_week', 'stretching_10min', 'no_phone_before_sleep',
            'consistent_bedtime', 'water_before_meal', 'herbal_tea_daily',
            'vegetable_3servings', 'no_sweetdrink', 'no_nightsnack',
            'drink_less_alcohol', 'medication_daily'
        );
    """


MODELS_STATE = (
    "eJyrVsrPVrJSMKwFAA3IAqI="
)