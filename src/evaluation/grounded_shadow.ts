export type ShadowStatus =
  | "qualified"
  | "abstained"
  | "non_answer"
  | "invalid";

export type ShadowEvaluatorIdentity = Readonly<{
  principal_type: "model";
  provider_id: string;
  model_id: string;
  model_revision: string;
  operator_domain: string;
  evaluator_config_hash: string;
}>;

export type ShadowTaskContract = Readonly<{
  schema_version: "quorum-router.shadow.contract.v1";
  task_id_hash: string;
  task_type: string;
  requirements: ReadonlyArray<
    Readonly<{
      id: string;
      description: string;
      required: true;
      impact: "standard" | "high";
    }>
  >;
  available_evidence: ReadonlyArray<
    Readonly<{
      id: string;
      description: string;
    }>
  >;
  allowed_abstention_reasons: ReadonlyArray<string>;
  abstention_taxonomy_version: "quorum-router.abstention.v1";
  unsupported_claim_taxonomy_version: "quorum-router.unsupported-claim.v1";
  prohibited_claim_types: ReadonlyArray<string>;
  second_evaluator_confidence_below: number;
}>;

export type ShadowQualification = Readonly<{
  schema_version: "quorum-router.shadow-qualification.v1";
  advisory_only: true;
  candidate_sha256: string;
  task_id_hash: string;
  status: ShadowStatus;
  requirements: ReadonlyArray<
    Readonly<{
      id: string;
      satisfied: boolean;
      candidate_span: readonly [number, number] | null;
      evidence_ids: ReadonlyArray<string>;
    }>
  >;
  asks_for_available_evidence: boolean;
  unsupported_claims: ReadonlyArray<
    Readonly<{
      claim_type: string;
      candidate_span: readonly [number, number];
    }>
  >;
  unsupported_claim_count: number;
  abstention_reason: string | null;
  confidence: number;
  evaluator: ShadowEvaluatorIdentity;
}>;

export type ShadowEvaluationEnvelope = Readonly<{
  schema_version: "quorum-router.shadow-evaluation-envelope.v1";
  advisory_only: true;
  evaluation_state: "evaluated" | "unevaluated" | "disputed";
  evaluation_reason:
    | "completed"
    | "no_independent_evaluator"
    | "insufficient_valid_independent_results"
    | "valid_independent_disagreement";
  evaluation_reasons: ReadonlyArray<
    | "no_evaluator_result"
    | "malformed_evaluator_output"
    | "candidate_binding_mismatch"
    | "contract_binding_mismatch"
    | "candidate_identity_collision"
    | "pairwise_identity_collision"
    | "insufficient_valid_independent_results"
  >;
  qualification: ShadowQualification | null;
  evaluator_results: ReadonlyArray<ShadowQualification>;
  shadow_disposition:
    | "offline_match_qualified"
    | "offline_match_non_qualified"
    | "offline_unavailable"
    | "offline_disputed";
  simulation_result: "QUALIFIED_CANDIDATES_PRESENT" | "NO_QUALIFIED_ANSWER";
  selection_changed: false;
}>;

type JsonRecord = Record<string, unknown>;

export type ResolveGroundedShadowInput = Readonly<{
  contract: ShadowTaskContract;
  candidate: string;
  candidate_source: ShadowEvaluatorIdentity;
  evaluator_results: ReadonlyArray<unknown>;
}>;

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

function record(value: unknown, path: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, "expected object");
  }
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, keys: string[], path: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(path, `expected keys ${expected.join(",")}; got ${actual.join(",")}`);
  }
}

function text(value: unknown, path: string, max = 256): string {
  if (
    typeof value !== "string" || value.trim().length === 0 ||
    value.length > max
  ) {
    fail(path, `expected non-empty string up to ${max} UTF-16 code units`);
  }
  return value;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "expected boolean");
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "expected finite number");
  }
  return value;
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "expected array");
  return value;
}

function uniqueTextList(value: unknown, path: string): string[] {
  const values = list(value, path).map((item, index) =>
    text(item, `${path}[${index}]`)
  );
  if (new Set(values).size !== values.length) fail(path, "duplicate value");
  return values;
}

function parseIdentity(value: unknown, path: string): ShadowEvaluatorIdentity {
  const item = record(value, path);
  exactKeys(item, [
    "principal_type",
    "provider_id",
    "model_id",
    "model_revision",
    "operator_domain",
    "evaluator_config_hash",
  ], path);
  if (item.principal_type !== "model") fail(path, "unsupported principal");
  const evaluatorConfigHash = text(
    item.evaluator_config_hash,
    `${path}.evaluator_config_hash`,
  );
  if (!/^sha256:[0-9a-f]{64}$/.test(evaluatorConfigHash)) {
    fail(`${path}.evaluator_config_hash`, "expected sha256 identifier");
  }
  return {
    principal_type: "model",
    provider_id: text(item.provider_id, `${path}.provider_id`),
    model_id: text(item.model_id, `${path}.model_id`),
    model_revision: text(item.model_revision, `${path}.model_revision`),
    operator_domain: text(item.operator_domain, `${path}.operator_domain`),
    evaluator_config_hash: evaluatorConfigHash,
  };
}

export function areGroundedEvaluatorIdentitiesDistinct(
  left: ShadowEvaluatorIdentity,
  right: ShadowEvaluatorIdentity,
): boolean {
  return left.provider_id !== right.provider_id &&
    left.operator_domain !== right.operator_domain;
}

function parseSpan(
  value: unknown,
  candidate: string,
  path: string,
): readonly [number, number] {
  const values = list(value, path);
  if (values.length !== 2) fail(path, "expected [start,end]");
  const start = finite(values[0], `${path}[0]`);
  const end = finite(values[1], `${path}[1]`);
  if (
    !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 ||
    end <= start || end > candidate.length
  ) {
    fail(path, "span is outside the exact candidate UTF-16 string");
  }
  return [start, end];
}

function parseContract(value: unknown): ShadowTaskContract {
  const contract = record(value, "contract");
  exactKeys(contract, [
    "schema_version",
    "task_id_hash",
    "task_type",
    "requirements",
    "available_evidence",
    "allowed_abstention_reasons",
    "abstention_taxonomy_version",
    "unsupported_claim_taxonomy_version",
    "prohibited_claim_types",
    "second_evaluator_confidence_below",
  ], "contract");
  if (contract.schema_version !== "quorum-router.shadow.contract.v1") {
    fail("contract.schema_version", "unsupported schema");
  }
  const taskIdHash = text(contract.task_id_hash, "contract.task_id_hash");
  if (!/^sha256:[0-9a-f]{64}$/.test(taskIdHash)) {
    fail("contract.task_id_hash", "expected sha256 identifier");
  }
  const taskType = text(contract.task_type, "contract.task_type");
  const rawRequirements = list(contract.requirements, "contract.requirements");
  if (rawRequirements.length < 1 || rawRequirements.length > 32) {
    fail("contract.requirements", "expected 1..32 requirements");
  }
  const requirements = rawRequirements.map((raw, index) => {
    const path = `contract.requirements[${index}]`;
    const item = record(raw, path);
    exactKeys(item, ["id", "description", "required", "impact"], path);
    const id = text(item.id, `${path}.id`);
    const description = text(item.description, `${path}.description`, 2_000);
    if (item.required !== true) fail(`${path}.required`, "must be true");
    const impact: "standard" | "high" = item.impact === "standard"
      ? "standard"
      : item.impact === "high"
      ? "high"
      : fail(`${path}.impact`, "unsupported impact");
    return { id, description, required: true as const, impact };
  });
  if (
    new Set(requirements.map((item) => item.id)).size !== requirements.length
  ) {
    fail("contract.requirements", "duplicate requirement id");
  }
  const rawEvidence = list(
    contract.available_evidence,
    "contract.available_evidence",
  );
  if (rawEvidence.length > 64) {
    fail("contract.available_evidence", "expected at most 64 evidence records");
  }
  const availableEvidence = rawEvidence.map((raw, index) => {
    const path = `contract.available_evidence[${index}]`;
    const item = record(raw, path);
    exactKeys(item, ["id", "description"], path);
    return {
      id: text(item.id, `${path}.id`),
      description: text(item.description, `${path}.description`, 2_000),
    };
  });
  if (
    new Set(availableEvidence.map((item) => item.id)).size !==
      availableEvidence.length
  ) {
    fail("contract.available_evidence", "duplicate evidence id");
  }
  if (
    contract.abstention_taxonomy_version !== "quorum-router.abstention.v1" ||
    contract.unsupported_claim_taxonomy_version !==
      "quorum-router.unsupported-claim.v1"
  ) {
    fail("contract", "unsupported taxonomy version");
  }
  const allowedAbstentionReasons = uniqueTextList(
    contract.allowed_abstention_reasons,
    "contract.allowed_abstention_reasons",
  );
  const prohibitedClaimTypes = uniqueTextList(
    contract.prohibited_claim_types,
    "contract.prohibited_claim_types",
  );
  if (
    allowedAbstentionReasons.length > 32 || prohibitedClaimTypes.length > 32
  ) {
    fail("contract", "taxonomy lists must contain at most 32 values");
  }
  const threshold = finite(
    contract.second_evaluator_confidence_below,
    "contract.second_evaluator_confidence_below",
  );
  if (threshold < 0 || threshold > 1) {
    fail("contract.second_evaluator_confidence_below", "must be in [0,1]");
  }
  return {
    schema_version: "quorum-router.shadow.contract.v1",
    task_id_hash: taskIdHash,
    task_type: taskType,
    requirements,
    available_evidence: availableEvidence,
    allowed_abstention_reasons: allowedAbstentionReasons,
    abstention_taxonomy_version: "quorum-router.abstention.v1",
    unsupported_claim_taxonomy_version: "quorum-router.unsupported-claim.v1",
    prohibited_claim_types: prohibitedClaimTypes,
    second_evaluator_confidence_below: threshold,
  };
}

function parseQualification(
  value: unknown,
  input: ResolveGroundedShadowInput,
  index: number,
  candidateSha256: string,
): ShadowQualification {
  const path = `evaluator_results[${index}]`;
  const item = record(value, path);
  exactKeys(item, [
    "schema_version",
    "advisory_only",
    "candidate_sha256",
    "task_id_hash",
    "status",
    "requirements",
    "asks_for_available_evidence",
    "unsupported_claims",
    "unsupported_claim_count",
    "abstention_reason",
    "confidence",
    "evaluator",
  ], path);
  if (item.schema_version !== "quorum-router.shadow-qualification.v1") {
    fail(`${path}.schema_version`, "unsupported schema");
  }
  if (bool(item.advisory_only, `${path}.advisory_only`) !== true) {
    fail(`${path}.advisory_only`, "must remain true");
  }
  if (item.candidate_sha256 !== candidateSha256) {
    fail(`${path}.candidate_sha256`, "does not bind the frozen candidate");
  }
  if (item.task_id_hash !== input.contract.task_id_hash) {
    fail(`${path}.task_id_hash`, "does not bind the frozen contract");
  }
  const status = text(item.status, `${path}.status`) as ShadowStatus;
  if (!["qualified", "abstained", "non_answer", "invalid"].includes(status)) {
    fail(`${path}.status`, "unsupported status");
  }
  const evaluator = parseIdentity(item.evaluator, `${path}.evaluator`);
  const confidence = finite(item.confidence, `${path}.confidence`);
  if (confidence < 0 || confidence > 1) {
    fail(`${path}.confidence`, "must be in [0,1]");
  }
  const requirementIds = new Set(
    input.contract.requirements.map((entry) => entry.id),
  );
  const evidenceIds = new Set(
    input.contract.available_evidence.map((entry) => entry.id),
  );
  const requirementResults = list(item.requirements, `${path}.requirements`);
  if (requirementResults.length !== requirementIds.size) {
    fail(`${path}.requirements`, "must cover every requirement exactly once");
  }
  const seenRequirements = new Set<string>();
  let satisfiedCount = 0;
  const requirements = requirementResults.map((raw, requirementIndex) => {
    const resultPath = `${path}.requirements[${requirementIndex}]`;
    const result = record(raw, resultPath);
    exactKeys(
      result,
      ["id", "satisfied", "candidate_span", "evidence_ids"],
      resultPath,
    );
    const id = text(result.id, `${resultPath}.id`);
    if (!requirementIds.has(id) || seenRequirements.has(id)) {
      fail(`${resultPath}.id`, "unknown or duplicate requirement id");
    }
    seenRequirements.add(id);
    const satisfied = bool(result.satisfied, `${resultPath}.satisfied`);
    const evidence = uniqueTextList(
      result.evidence_ids,
      `${resultPath}.evidence_ids`,
    );
    if (evidence.some((evidenceId) => !evidenceIds.has(evidenceId))) {
      fail(`${resultPath}.evidence_ids`, "unknown evidence id");
    }
    let candidateSpan: readonly [number, number] | null = null;
    if (satisfied) {
      satisfiedCount++;
      candidateSpan = parseSpan(
        result.candidate_span,
        input.candidate,
        `${resultPath}.candidate_span`,
      );
      if (evidence.length === 0) {
        fail(
          `${resultPath}.evidence_ids`,
          "satisfied result requires evidence",
        );
      }
    } else if (result.candidate_span !== null) {
      fail(
        `${resultPath}.candidate_span`,
        "unsatisfied result requires null span",
      );
    }
    return {
      id,
      satisfied,
      candidate_span: candidateSpan,
      evidence_ids: evidence,
    };
  });

  const unsupportedRaw = list(
    item.unsupported_claims,
    `${path}.unsupported_claims`,
  );
  const unsupportedClaims = unsupportedRaw.map((raw, claimIndex) => {
    const claimPath = `${path}.unsupported_claims[${claimIndex}]`;
    const claim = record(raw, claimPath);
    exactKeys(claim, ["claim_type", "candidate_span"], claimPath);
    const claimType = text(claim.claim_type, `${claimPath}.claim_type`);
    if (!input.contract.prohibited_claim_types.includes(claimType)) {
      fail(`${claimPath}.claim_type`, "unknown prohibited claim type");
    }
    return {
      claim_type: claimType,
      candidate_span: parseSpan(
        claim.candidate_span,
        input.candidate,
        `${claimPath}.candidate_span`,
      ),
    };
  });
  const claimKeys = unsupportedClaims.map((claim) => JSON.stringify(claim));
  if (new Set(claimKeys).size !== claimKeys.length) {
    fail(`${path}.unsupported_claims`, "duplicate unsupported claim");
  }
  const unsupportedClaimCount = finite(
    item.unsupported_claim_count,
    `${path}.unsupported_claim_count`,
  );
  if (
    !Number.isSafeInteger(unsupportedClaimCount) ||
    unsupportedClaimCount !== unsupportedClaims.length
  ) {
    fail(
      `${path}.unsupported_claim_count`,
      "must equal unsupported_claims length",
    );
  }
  const asksForAvailableEvidence = bool(
    item.asks_for_available_evidence,
    `${path}.asks_for_available_evidence`,
  );
  const abstentionReason = item.abstention_reason === null
    ? null
    : text(item.abstention_reason, `${path}.abstention_reason`);

  if (status === "qualified") {
    if (
      satisfiedCount !== requirementIds.size || asksForAvailableEvidence ||
      unsupportedClaims.length !== 0 || abstentionReason !== null
    ) fail(path, "qualified result violates grounding invariants");
  } else if (status === "abstained") {
    if (
      satisfiedCount !== 0 || asksForAvailableEvidence ||
      unsupportedClaims.length !== 0 || abstentionReason === null ||
      !input.contract.allowed_abstention_reasons.includes(abstentionReason)
    ) fail(path, "abstained result violates grounding invariants");
  } else if (status === "non_answer") {
    if (
      satisfiedCount === requirementIds.size ||
      unsupportedClaims.length !== 0 ||
      abstentionReason !== null
    ) fail(path, "non_answer result violates grounding invariants");
  } else if (
    unsupportedClaims.length === 0 || abstentionReason !== null
  ) {
    fail(path, "invalid result requires a prohibited-claim record");
  }

  return {
    schema_version: "quorum-router.shadow-qualification.v1",
    advisory_only: true,
    candidate_sha256: candidateSha256,
    task_id_hash: input.contract.task_id_hash,
    status,
    requirements,
    asks_for_available_evidence: asksForAvailableEvidence,
    unsupported_claims: unsupportedClaims,
    unsupported_claim_count: unsupportedClaimCount,
    abstention_reason: abstentionReason,
    confidence,
    evaluator,
  };
}

function canonicalQualification(value: ShadowQualification): string {
  return JSON.stringify({
    status: value.status,
    abstention_reason: value.abstention_reason,
    unsupported_claims: value.unsupported_claims
      .map((claim) => ({
        claim_type: claim.claim_type,
        candidate_span: [...claim.candidate_span],
      }))
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right))
      ),
    requirements: value.requirements
      .map((result) => ({
        id: result.id,
        satisfied: result.satisfied,
        candidate_span: result.candidate_span === null
          ? null
          : [...result.candidate_span],
        evidence_ids: [...result.evidence_ids].sort(),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  });
}

type UnevaluatedReason = ShadowEvaluationEnvelope["evaluation_reasons"][number];

function unavailable(
  reason: "no_independent_evaluator" | "insufficient_valid_independent_results",
  evaluationReasons: ReadonlyArray<UnevaluatedReason>,
  results: ReadonlyArray<ShadowQualification> = [],
): ShadowEvaluationEnvelope {
  return {
    schema_version: "quorum-router.shadow-evaluation-envelope.v1",
    advisory_only: true,
    evaluation_state: "unevaluated",
    evaluation_reason: reason,
    evaluation_reasons: [...new Set(evaluationReasons)],
    qualification: null,
    evaluator_results: results,
    shadow_disposition: "offline_unavailable",
    simulation_result: "NO_QUALIFIED_ANSWER",
    selection_changed: false,
  };
}

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `sha256:${
    Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")
  }`;
}

async function candidateSha256(candidate: string): Promise<string> {
  const bytes = new Uint8Array(candidate.length * 2);
  for (let index = 0; index < candidate.length; index++) {
    const codeUnit = candidate.charCodeAt(index);
    bytes[index * 2] = codeUnit & 0xff;
    bytes[index * 2 + 1] = codeUnit >>> 8;
  }
  return await sha256(bytes);
}

async function contractSha256(contract: ShadowTaskContract): Promise<string> {
  const canonical = JSON.stringify({
    task_type: contract.task_type,
    requirements: contract.requirements,
    available_evidence: contract.available_evidence,
    allowed_abstention_reasons: contract.allowed_abstention_reasons,
    abstention_taxonomy_version: contract.abstention_taxonomy_version,
    unsupported_claim_taxonomy_version:
      contract.unsupported_claim_taxonomy_version,
    prohibited_claim_types: contract.prohibited_claim_types,
    second_evaluator_confidence_below:
      contract.second_evaluator_confidence_below,
  });
  return await sha256(new TextEncoder().encode(canonical));
}

export async function resolveGroundedShadowEvaluations(
  input: ResolveGroundedShadowInput,
): Promise<ShadowEvaluationEnvelope> {
  const contract = parseContract(input.contract);
  if (await contractSha256(contract) !== contract.task_id_hash) {
    fail("contract.task_id_hash", "does not match canonical contract JSON");
  }
  if (typeof input.candidate !== "string" || input.candidate.length > 16_000) {
    fail("candidate", "expected string up to 16000 UTF-16 code units");
  }
  const candidateSource = parseIdentity(
    input.candidate_source,
    "candidate_source",
  );
  const normalizedInput: ResolveGroundedShadowInput = {
    ...input,
    contract,
    candidate_source: candidateSource,
  };
  if (
    !Array.isArray(input.evaluator_results) ||
    input.evaluator_results.length > 2
  ) {
    fail("evaluator_results", "expected at most two bounded results");
  }
  if (input.evaluator_results.length === 0) {
    return unavailable("no_independent_evaluator", ["no_evaluator_result"]);
  }

  const frozenCandidateSha256 = await candidateSha256(input.candidate);
  const valid: ShadowQualification[] = [];
  const evaluationReasons: UnevaluatedReason[] = [];
  for (let index = 0; index < input.evaluator_results.length; index++) {
    try {
      const parsed = parseQualification(
        input.evaluator_results[index],
        normalizedInput,
        index,
        frozenCandidateSha256,
      );
      if (
        areGroundedEvaluatorIdentitiesDistinct(
          candidateSource,
          parsed.evaluator,
        )
      ) {
        valid.push(parsed);
      } else {
        evaluationReasons.push("candidate_identity_collision");
      }
    } catch (error) {
      evaluationReasons.push(
        error instanceof Error && error.message.includes(".candidate_sha256:")
          ? "candidate_binding_mismatch"
          : error instanceof Error && error.message.includes(".task_id_hash:")
          ? "contract_binding_mismatch"
          : "malformed_evaluator_output",
      );
    }
  }
  if (valid.length === 2) {
    if (
      !areGroundedEvaluatorIdentitiesDistinct(
        valid[0].evaluator,
        valid[1].evaluator,
      )
    ) {
      return unavailable("insufficient_valid_independent_results", [
        ...evaluationReasons,
        "pairwise_identity_collision",
      ], valid);
    }
  } else {
    return unavailable("insufficient_valid_independent_results", [
      ...evaluationReasons,
      "insufficient_valid_independent_results",
    ], valid);
  }
  if (canonicalQualification(valid[0]) !== canonicalQualification(valid[1])) {
    return {
      schema_version: "quorum-router.shadow-evaluation-envelope.v1",
      advisory_only: true,
      evaluation_state: "disputed",
      evaluation_reason: "valid_independent_disagreement",
      evaluation_reasons: [],
      qualification: null,
      evaluator_results: valid,
      shadow_disposition: "offline_disputed",
      simulation_result: "NO_QUALIFIED_ANSWER",
      selection_changed: false,
    };
  }
  const qualification = valid[0];
  const qualifying = qualification.status === "qualified";
  return {
    schema_version: "quorum-router.shadow-evaluation-envelope.v1",
    advisory_only: true,
    evaluation_state: "evaluated",
    evaluation_reason: "completed",
    evaluation_reasons: [],
    qualification,
    evaluator_results: valid,
    shadow_disposition: qualifying
      ? "offline_match_qualified"
      : "offline_match_non_qualified",
    simulation_result: qualifying
      ? "QUALIFIED_CANDIDATES_PRESENT"
      : "NO_QUALIFIED_ANSWER",
    selection_changed: false,
  };
}
