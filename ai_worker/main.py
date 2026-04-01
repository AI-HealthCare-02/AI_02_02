import asyncio
import logging


logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] ai-worker: %(message)s")
logger = logging.getLogger(__name__)


async def run() -> None:
    logger.info("AI worker placeholder started. Waiting for task integration.")
    while True:
        await asyncio.sleep(60)


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
