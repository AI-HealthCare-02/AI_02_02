"""RiskAssessment 히스토리 백필 스크립트.

과거 날짜별로 `RiskAnalysisService.recalculate_risk(user_id, for_date=d)` 를 호출해
그 날짜 기준 7일 창의 실제 `DailyHealthLog` + 프로필을 근거로 평가 레코드를 생성/갱신.

사용 예::

    docker exec ai-health-local-fastapi-1 \
        python -m backend.tasks.backfill_risk_history --user-id 1 --from 2026-04-13 --to 2026-04-17

`--to`(포함)까지 각 날짜에 대해 1건씩 생성. 유니크 제약 덕에 재실행해도 UPSERT.
"""
from __future__ import annotations

import argparse
import asyncio
from datetime import date, timedelta

from tortoise import Tortoise

from backend.db.databases import TORTOISE_ORM
from backend.services.risk_analysis import RiskAnalysisService


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


def _daterange(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current = current + timedelta(days=1)


async def run(user_id: int, start: date, end: date) -> None:
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        service = RiskAnalysisService()
        ok = 0
        skipped = 0
        for day in _daterange(start, end):
            result = await service.recalculate_risk(user_id=user_id, for_date=day)
            if result is None:
                skipped += 1
                print(f"  - {day}: skipped (no profile or prerequisites)")
                continue
            ok += 1
            print(f"  + {day}: findrisc={result.findrisc_score}")
        print(f"done: ok={ok}, skipped={skipped}")
    finally:
        await Tortoise.close_connections()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-id", type=int, required=True)
    parser.add_argument("--from", dest="start", type=_parse_date, required=True)
    parser.add_argument("--to", dest="end", type=_parse_date, required=True)
    args = parser.parse_args()
    if args.start > args.end:
        raise SystemExit("--from must be <= --to")
    asyncio.run(run(args.user_id, args.start, args.end))


if __name__ == "__main__":
    main()
