import { aggregateTaskCalibration } from "./calibration.ts";

const evaluated_at = "2026-07-13T00:00:00Z";
const report = aggregateTaskCalibration([
  {
    observation_id: "demo-1",
    task_type: "code-review",
    source: { provider: "OpenAI", model: "example-model" },
    evaluation_basis: "caller_attested_external_ground_truth",
    correct: true,
    confidence: 0.8,
    evaluated_at,
  },
  {
    observation_id: "demo-2",
    task_type: "code-review",
    source: { provider: "OpenAI", model: "example-model" },
    evaluation_basis: "caller_attested_external_ground_truth",
    correct: false,
    confidence: 0.6,
    evaluated_at,
  },
], { minimum_sample_count: 2 });

console.log(JSON.stringify(report, null, 2));
