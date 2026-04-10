"""Benchmark legacy chat prep vs LangGraph prep with deterministic fixtures."""

from __future__ import annotations

import argparse
import asyncio
import pathlib
import statistics
import time
from types import SimpleNamespace

ROOT = pathlib.Path(__file__).resolve().parents[1]


def _load_modules():
    import sys

    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    import backend.services.chat_graph.adapter as graph_adapter  # noqa: PLC0415
    import backend.services.chat_graph.graph as graph_module  # noqa: PLC0415
    import backend.services.chat_graph.nodes as graph_nodes  # noqa: PLC0415
    from backend.models.enums import (  # noqa: PLC0415
        FilterExpressionVerdict,
        FilterMedicalAction,
        MessageRoute,
    )
    from backend.services.content_filter import FilterResult  # noqa: PLC0415

    return (
        graph_adapter,
        graph_module,
        graph_nodes,
        FilterExpressionVerdict,
        FilterMedicalAction,
        MessageRoute,
        FilterResult,
    )


class _FakeRagService:
    def search(self, query: str, top_k: int = 2):
        del query, top_k
        return SimpleNamespace(
            prompt_context="\n\n## 참고 정보\n- 벤치마크용 문맥\n",
            hit_count=1,
            has_context=True,
        )


class _FakeUserContextService:
    def build_context(self, profile, topic_hint=None):
        del profile, topic_hint
        return SimpleNamespace(summary="체중관리 목표, 운동 주 3-4회", has_context=True)


def _inputs():
    (
        graph_adapter,
        _graph_module,
        _graph_nodes,
        filter_expression_verdict,
        filter_medical_action,
        message_route,
        filter_result_cls,
    ) = _load_modules()
    return graph_adapter._build_inputs(
        user_id=77,
        message_text="운동 계획 어떻게 세우는 게 좋아?",
        base_system_prompt="BASE\n",
        history=[
            SimpleNamespace(role="user", content="이전 질문"),
            SimpleNamespace(role="assistant", content="이전 답변"),
        ],
        filter_result=filter_result_cls(
            expression_verdict=filter_expression_verdict.ALLOW,
            medical_action=filter_medical_action.NONE,
            message_route=message_route.HEALTH_GENERAL,
            emotional_priority=False,
        ),
        profile=SimpleNamespace(
            goals=["exercise_habit"],
            exercise_frequency="3_4_per_week",
            sleep_duration_bucket="between_7_8",
            user_group="B",
        ),
    )


async def _measure(coro_factory, iterations: int) -> list[float]:
    samples: list[float] = []
    for _ in range(iterations):
        start = time.perf_counter()
        await coro_factory()
        samples.append((time.perf_counter() - start) * 1000)
    return samples


async def main(iterations: int) -> None:
    graph_adapter, graph_module, graph_nodes, *_ = _load_modules()
    graph_module._compiled_graph = None
    graph_module._compile_error = None
    graph_nodes._get_rag_service = lambda: _FakeRagService()
    graph_nodes._get_user_context_service = lambda: _FakeUserContextService()

    inputs = _inputs()
    legacy = await _measure(lambda: graph_adapter._run_legacy_prep(inputs), iterations)
    graph = await _measure(lambda: graph_adapter._run_graph_prep(inputs), iterations)

    print("legacy median(ms):", round(statistics.median(legacy), 2))
    print("legacy p95(ms):", round(sorted(legacy)[int(len(legacy) * 0.95) - 1], 2))
    print("graph median(ms):", round(statistics.median(graph), 2))
    print("graph p95(ms):", round(sorted(graph)[int(len(graph) * 0.95) - 1], 2))
    print("delta median(ms):", round(statistics.median(graph) - statistics.median(legacy), 2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=200)
    args = parser.parse_args()
    asyncio.run(main(args.iterations))
