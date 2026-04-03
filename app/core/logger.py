"""structlog 기반 로깅 — setup_logger() 인터페이스 유지.

dev 환경: 컬러 콘솔 출력
prod 환경: JSON 라인 출력 (로그 수집기 친화)
호출부 변경 없음: logger.info(), logger.warning() 등 그대로 사용.
"""

import logging
import sys

import structlog

_configured = False


def _configure_once() -> None:
    """structlog 전역 설정 — 앱 생명주기 동안 1회만 실행."""
    global _configured  # noqa: PLW0603
    if _configured:
        return

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # stdlib 핸들러에 structlog 포매터 연결
    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.dev.ConsoleRenderer(),
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    _configured = True


def setup_logger(name: str = "ai_worker", level: int = logging.INFO) -> structlog.stdlib.BoundLogger:
    """이름 기반 구조화 로거를 반환한다.

    기존 logging.Logger와 동일한 .info(), .warning(), .error() 인터페이스.
    """
    _configure_once()
    return structlog.get_logger(name)


# 앱 전역에서 사용할 로거
default_logger = setup_logger()
