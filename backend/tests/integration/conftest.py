import asyncio
import os
from collections.abc import Generator
from typing import Any
from unittest.mock import Mock, patch

import pytest
from _pytest.fixtures import FixtureRequest
from tortoise import generate_config
from tortoise.contrib import test as tortoise_test
from tortoise.contrib.test import finalizer, initializer

from backend.core import config
from backend.db.databases import TORTOISE_APP_MODELS
from backend.middleware.rate_limit import limiter

TEST_BASE_URL = "http://test"
TEST_DB_LABEL = "models"
TEST_DB_TZ = "Asia/Seoul"
_SHARED_LOOP: asyncio.AbstractEventLoop | None = None


def get_test_db_config() -> dict[str, Any]:
    tortoise_config = generate_config(
        db_url=f"postgres://{config.DB_USER}:{config.DB_PASSWORD}@{config.DB_HOST}:{config.DB_PORT}/test",
        app_modules={TEST_DB_LABEL: TORTOISE_APP_MODELS},
        connection_label=TEST_DB_LABEL,
        testing=True,
    )
    tortoise_config["timezone"] = TEST_DB_TZ

    return tortoise_config


def _setup_shared_asyncio_runner(self: tortoise_test.SimpleTestCase) -> None:
    """Pin Tortoise's unittest runner to the same loop used for DB init on Python 3.13."""
    if not hasattr(asyncio, "Runner"):
        return
    if _SHARED_LOOP is None:
        raise RuntimeError("Integration test loop was not initialized.")
    asyncio.set_event_loop(_SHARED_LOOP)
    self._asyncioRunner = asyncio.Runner(debug=True, loop_factory=lambda: _SHARED_LOOP)


@pytest.fixture(scope="session")
def integration_event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
def initialize(
    request: FixtureRequest, integration_event_loop: asyncio.AbstractEventLoop
) -> Generator[None, None]:
    del request
    global _SHARED_LOOP
    _SHARED_LOOP = integration_event_loop
    os.environ.setdefault("PGDATABASE", "postgres")

    original_setup_runner = tortoise_test.SimpleTestCase._setupAsyncioRunner
    tortoise_test.SimpleTestCase._setupAsyncioRunner = _setup_shared_asyncio_runner
    original_limiter_enabled = limiter.enabled
    limiter.enabled = False

    with patch("tortoise.contrib.test.getDBConfig", Mock(return_value=get_test_db_config())):
        initializer(modules=TORTOISE_APP_MODELS, loop=integration_event_loop)
    yield
    finalizer()
    limiter.enabled = original_limiter_enabled
    tortoise_test.SimpleTestCase._setupAsyncioRunner = original_setup_runner
    _SHARED_LOOP = None


@pytest.fixture(scope="session")
def event_loop(integration_event_loop: asyncio.AbstractEventLoop) -> asyncio.AbstractEventLoop:
    return integration_event_loop
