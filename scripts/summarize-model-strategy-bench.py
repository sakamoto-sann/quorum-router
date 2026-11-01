#!/usr/bin/env python3
"""Create a deterministic content-minimized aggregate of a benchmark run."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from datetime import date
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "quorum-router-public-bench-aggregate-v1"
STRATEGIES = ("single-model", "best-route", "agent-chat")
USAGE_METRICS = (
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
)


def _object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def _nonnegative_number(value: Any, label: str) -> int | float:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value < 0
    ):
        raise ValueError(f"{label} must be a non-negative number")
    return value


def build_summary(source_path: Path) -> dict[str, Any]:
    source_bytes = source_path.read_bytes()
    source = _object(json.loads(source_bytes), "source")
    results = source.get("results")
    run_date = source.get("run_date")
    if not isinstance(results, list) or not results:
        raise ValueError("source.results must be a non-empty array")
    if not isinstance(run_date, str) or len(run_date) != 10:
        raise ValueError("source.run_date must be canonical YYYY-MM-DD")
    try:
        if date.fromisoformat(run_date).isoformat() != run_date:
            raise ValueError
    except ValueError as error:
        raise ValueError("source.run_date must be canonical YYYY-MM-DD") from error

    validated_tasks: list[dict[str, Any]] = []
    for index, raw_result in enumerate(results, start=1):
        result = _object(raw_result, f"source.results[{index - 1}]")
        scores = _object(result.get("scores"), "result.scores")
        usage = _object(result.get("usage"), "result.usage")
        calls = _object(result.get("calls"), "result.calls")
        max_score = result.get("max_score")
        if not isinstance(max_score, int) or max_score < 1:
            raise ValueError("result.max_score must be an integer >= 1")

        task: dict[str, Any] = {"max_proxy_score": max_score, "strategies": {}}
        for strategy in STRATEGIES:
            score = scores.get(strategy)
            strategy_usage = _object(usage.get(strategy), f"usage.{strategy}")
            call_count = calls.get(strategy)
            if not isinstance(score, int) or not 0 <= score <= max_score:
                raise ValueError(f"scores.{strategy} is outside the proxy-score range")
            if not isinstance(call_count, int) or call_count < 1:
                raise ValueError(f"calls.{strategy} must be an integer >= 1")
            task["strategies"][strategy] = {
                "proxy_score": score,
                "model_calls": call_count,
                **{
                    metric: _nonnegative_number(
                        strategy_usage.get(metric), f"usage.{strategy}.{metric}"
                    )
                    for metric in USAGE_METRICS
                },
            }
        validated_tasks.append(task)

    aggregate_summary: dict[str, dict[str, int | float]] = {}
    for strategy in STRATEGIES:
        win_points = 0.0
        rubric_percentages: list[float] = []
        calls_for_strategy: list[int] = []
        usage_for_strategy = {metric: [] for metric in USAGE_METRICS}
        for task in validated_tasks:
            strategies = task["strategies"]
            highest_score = max(
                strategies[candidate]["proxy_score"] for candidate in STRATEGIES
            )
            winner_count = sum(
                strategies[candidate]["proxy_score"] == highest_score
                for candidate in STRATEGIES
            )
            selected = strategies[strategy]
            if selected["proxy_score"] == highest_score:
                win_points += 1 / winner_count
            rubric_percentages.append(
                100 * selected["proxy_score"] / task["max_proxy_score"]
            )
            calls_for_strategy.append(selected["model_calls"])
            for metric in USAGE_METRICS:
                usage_for_strategy[metric].append(selected[metric])
        aggregate_summary[strategy] = {
            "win_rate_pct": round(100 * win_points / len(validated_tasks), 1),
            "mean_rubric_pct": round(
                sum(rubric_percentages) / len(rubric_percentages), 1
            ),
            "mean_calls": round(sum(calls_for_strategy) / len(calls_for_strategy), 1),
            "mean_input_tokens": round(
                sum(usage_for_strategy["input_tokens"]) / len(validated_tasks)
            ),
            "mean_cached_input_tokens": round(
                sum(usage_for_strategy["cached_input_tokens"])
                / len(validated_tasks)
            ),
            "mean_output_tokens": round(
                sum(usage_for_strategy["output_tokens"]) / len(validated_tasks)
            ),
        }

    return {
        "schema_version": SCHEMA_VERSION,
        "source": {
            "sha256": hashlib.sha256(source_bytes).hexdigest(),
            "run_date": run_date,
        },
        "publication_boundary": {
            "raw_prompts_included": False,
            "raw_answers_included": False,
            "original_task_names_included": False,
            "organization_identifiers_included": False,
            "per_case_rows_included": False,
            "semantic_ground_truth": False,
            "eligible_as_calibration_ground_truth": False,
            "score_interpretation": "predeclared deterministic rubric proxy",
        },
        "sample_size": len(validated_tasks),
        "strategies": list(STRATEGIES),
        "aggregate_summary": aggregate_summary,
    }


def rendered_summary(source_path: Path) -> str:
    return json.dumps(
        build_summary(source_path),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    ) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    rendered = rendered_summary(args.source)
    if args.check:
        if not args.output.exists() or args.output.read_text() != rendered:
            raise SystemExit("public benchmark aggregate is stale")
        return 0
    args.output.write_text(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
