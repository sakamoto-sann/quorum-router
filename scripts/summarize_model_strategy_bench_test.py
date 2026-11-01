from __future__ import annotations

import importlib.util
import json
import math
import tempfile
import unittest
from pathlib import Path
from typing import Any

MODULE_PATH = Path(__file__).with_name("summarize-model-strategy-bench.py")
SPEC = importlib.util.spec_from_file_location("bench_summary", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class BenchSummaryTest(unittest.TestCase):
    def source(self) -> dict[str, Any]:
        usage = {
            "input_tokens": 10,
            "cached_input_tokens": 2,
            "output_tokens": 3,
            "reasoning_output_tokens": 1,
        }
        aggregate = {
            "win_rate_pct": 50.0,
            "mean_rubric_pct": 75.0,
            "mean_calls": 1.0,
            "mean_input_tokens": 10,
            "mean_cached_input_tokens": 2,
            "mean_output_tokens": 3,
        }
        return {
            "run_date": "2026-07-11",
            "models": {"private-model": "sentinel-model-name"},
            "results": [
                {
                    "id": "sentinel-case-name",
                    "scores": {strategy: 1 for strategy in MODULE.STRATEGIES},
                    "max_score": 2,
                    "usage": {
                        strategy: dict(usage) for strategy in MODULE.STRATEGIES
                    },
                    "calls": {strategy: 1 for strategy in MODULE.STRATEGIES},
                    "answers": {"single-model": "sentinel-private-answer"},
                    "unexpected_private_field": "sentinel-result-extra",
                }
            ],
            "summary": {
                **{strategy: dict(aggregate) for strategy in MODULE.STRATEGIES},
                "unexpected_private_field": "sentinel-summary-extra",
            },
        }

    def write_source(self, value: dict[str, Any], directory: Path) -> Path:
        path = directory / "source.json"
        path.write_text(json.dumps(value))
        return path

    def test_publication_summary_whitelists_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = self.write_source(self.source(), Path(tmp))
            summary = MODULE.build_summary(source)
        rendered = json.dumps(summary, sort_keys=True)
        for sentinel in (
            "sentinel-model-name",
            "sentinel-case-name",
            "sentinel-private-answer",
            "sentinel-result-extra",
            "sentinel-summary-extra",
        ):
            self.assertNotIn(sentinel, rendered)
        self.assertEqual(summary["sample_size"], 1)
        self.assertNotIn("tasks", summary)
        self.assertEqual(
            summary["aggregate_summary"]["single-model"],
            {
                "win_rate_pct": 33.3,
                "mean_rubric_pct": 50.0,
                "mean_calls": 1.0,
                "mean_input_tokens": 10,
                "mean_cached_input_tokens": 2,
                "mean_output_tokens": 3,
            },
        )
        self.assertFalse(summary["publication_boundary"]["per_case_rows_included"])
        self.assertFalse(
            summary["publication_boundary"]["eligible_as_calibration_ground_truth"]
        )

    def test_nonfinite_and_negative_metrics_fail_closed(self) -> None:
        for invalid in (-1, math.nan, math.inf):
            with self.subTest(invalid=invalid), tempfile.TemporaryDirectory() as tmp:
                source_value = self.source()
                source_value["results"][0]["usage"]["single-model"][
                    "input_tokens"
                ] = invalid
                source = self.write_source(source_value, Path(tmp))
                with self.assertRaises(ValueError):
                    MODULE.build_summary(source)

    def test_invalid_or_nested_run_date_fails_closed(self) -> None:
        for invalid in ({"private": "sentinel-date"}, "2026-7-1", "2026-02-30"):
            with self.subTest(invalid=invalid), tempfile.TemporaryDirectory() as tmp:
                source_value = self.source()
                source_value["run_date"] = invalid
                source = self.write_source(source_value, Path(tmp))
                with self.assertRaises(ValueError):
                    MODULE.build_summary(source)


if __name__ == "__main__":
    unittest.main()
