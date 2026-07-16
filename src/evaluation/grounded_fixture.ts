type JsonRecord = Record<string, unknown>;

type Identity = {
  principalType: "model";
  providerId: string;
  modelId: string;
  modelRevision: string;
  operatorDomain: string;
  evaluatorConfigHash: string;
};

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

function record(value: unknown, path: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, "expected object");
  }
  return value as JsonRecord;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "expected array");
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(path, "expected non-empty string");
  }
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "expected boolean");
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "expected finite number");
  }
  return value;
}

function exactKeys(value: JsonRecord, expected: string[], path: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    fail(path, `expected keys ${wanted.join(",")}; got ${actual.join(",")}`);
  }
}

function nullableString(value: unknown, path: string): string | null {
  if (value === null) return null;
  return string(value, path);
}

function identity(value: unknown, path: string): Identity {
  const item = record(value, path);
  exactKeys(item, [
    "principal_type",
    "provider_id",
    "model_id",
    "model_revision",
    "operator_domain",
    "evaluator_config_hash",
  ], path);
  if (item.principal_type !== "model") {
    fail(`${path}.principal_type`, "Phase 0 supports model principals only");
  }
  const evaluatorConfigHash = string(
    item.evaluator_config_hash,
    `${path}.evaluator_config_hash`,
  );
  if (!/^sha256:[0-9a-f]{64}$/.test(evaluatorConfigHash)) {
    fail(`${path}.evaluator_config_hash`, "expected sha256 identifier");
  }
  return {
    principalType: "model",
    providerId: string(item.provider_id, `${path}.provider_id`),
    modelId: string(item.model_id, `${path}.model_id`),
    modelRevision: string(item.model_revision, `${path}.model_revision`),
    operatorDomain: string(item.operator_domain, `${path}.operator_domain`),
    evaluatorConfigHash,
  };
}

function isIndependent(candidate: Identity, evaluator: Identity): boolean {
  return candidate.providerId !== evaluator.providerId &&
    candidate.operatorDomain !== evaluator.operatorDomain;
}

function uniqueStrings(values: unknown, path: string): string[] {
  const parsed = array(values, path).map((value, index) =>
    string(value, `${path}[${index}]`)
  );
  if (new Set(parsed).size !== parsed.length) fail(path, "duplicate value");
  return parsed;
}

export function validateGroundedNonAnswerCorpus(value: unknown): void {
  const corpus = record(value, "corpus");
  exactKeys(
    corpus,
    [
      "schema_version",
      "advisory_only",
      "routing_authority",
      "description",
      "label_policy",
      "cases",
    ],
    "corpus",
  );
  if (corpus.schema_version !== "quorum-router.shadow-evaluator-corpus.v1") {
    fail("corpus.schema_version", "unsupported schema");
  }
  if (boolean(corpus.advisory_only, "corpus.advisory_only") !== true) {
    fail("corpus.advisory_only", "must remain true");
  }
  if (boolean(corpus.routing_authority, "corpus.routing_authority") !== false) {
    fail("corpus.routing_authority", "must remain false");
  }
  string(corpus.description, "corpus.description");
  const labelPolicy = record(corpus.label_policy, "corpus.label_policy");
  exactKeys(labelPolicy, [
    "authority",
    "provisional",
    "training_use",
    "gold_measurement_use",
    "amendment_policy",
  ], "corpus.label_policy");
  if (
    labelPolicy.authority !== "schema_only" ||
    labelPolicy.provisional !== true ||
    labelPolicy.training_use !== "prohibited" ||
    labelPolicy.gold_measurement_use !== "prohibited" ||
    labelPolicy.amendment_policy !== "reviewed_and_versioned"
  ) {
    fail(
      "corpus.label_policy",
      "fixture labels must remain provisional and non-authoritative",
    );
  }

  const cases = array(corpus.cases, "corpus.cases");
  if (cases.length < 10 || cases.length > 100) {
    fail("corpus.cases", "expected 10..100 bounded cases");
  }
  const caseIds = new Set<string>();

  for (let index = 0; index < cases.length; index++) {
    const path = `corpus.cases[${index}]`;
    const testCase = record(cases[index], path);
    const allowedCaseKeys = new Set([
      "id",
      "contract",
      "candidate_source",
      "candidate",
      "label_provenance",
      "available_evaluators",
      "evaluator_results",
      "expected",
    ]);
    for (const key of Object.keys(testCase)) {
      if (!allowedCaseKeys.has(key)) fail(path, `unexpected key ${key}`);
    }
    for (
      const required of [
        "id",
        "contract",
        "candidate_source",
        "candidate",
        "label_provenance",
        "expected",
      ]
    ) {
      if (!(required in testCase)) fail(path, `missing key ${required}`);
    }

    const id = string(testCase.id, `${path}.id`);
    if (caseIds.has(id)) fail(`${path}.id`, "duplicate case id");
    caseIds.add(id);
    const candidate = string(testCase.candidate, `${path}.candidate`);
    if (candidate.length > 16_000) {
      fail(`${path}.candidate`, "candidate too large");
    }
    const candidateSource = identity(
      testCase.candidate_source,
      `${path}.candidate_source`,
    );
    const provenance = record(
      testCase.label_provenance,
      `${path}.label_provenance`,
    );
    exactKeys(
      provenance,
      ["source", "adjudication", "provisional"],
      `${path}.label_provenance`,
    );
    if (
      provenance.source !== "caller_authored" ||
      provenance.adjudication !== "none" ||
      provenance.provisional !== true
    ) {
      fail(
        `${path}.label_provenance`,
        "fixture case must remain provisional and unadjudicated",
      );
    }

    const contract = record(testCase.contract, `${path}.contract`);
    exactKeys(
      contract,
      [
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
      ],
      `${path}.contract`,
    );
    if (contract.schema_version !== "quorum-router.shadow.contract.v1") {
      fail(`${path}.contract.schema_version`, "unsupported schema");
    }
    if (
      !/^sha256:[0-9a-f]{64}$/.test(
        string(contract.task_id_hash, `${path}.contract.task_id_hash`),
      )
    ) {
      fail(
        `${path}.contract.task_id_hash`,
        "expected redacted sha256 identifier",
      );
    }
    string(contract.task_type, `${path}.contract.task_type`);
    const threshold = finiteNumber(
      contract.second_evaluator_confidence_below,
      `${path}.contract.second_evaluator_confidence_below`,
    );
    if (threshold < 0 || threshold > 1) {
      fail(
        `${path}.contract.second_evaluator_confidence_below`,
        "must be in [0,1]",
      );
    }

    const requirements = array(
      contract.requirements,
      `${path}.contract.requirements`,
    );
    if (requirements.length === 0 || requirements.length > 32) {
      fail(`${path}.contract.requirements`, "expected 1..32 requirements");
    }
    const requirementIds = new Set<string>();
    for (
      let requirementIndex = 0;
      requirementIndex < requirements.length;
      requirementIndex++
    ) {
      const requirementPath =
        `${path}.contract.requirements[${requirementIndex}]`;
      const requirement = record(
        requirements[requirementIndex],
        requirementPath,
      );
      exactKeys(
        requirement,
        ["id", "description", "required", "impact"],
        requirementPath,
      );
      const requirementId = string(requirement.id, `${requirementPath}.id`);
      if (requirementIds.has(requirementId)) {
        fail(`${requirementPath}.id`, "duplicate requirement id");
      }
      requirementIds.add(requirementId);
      string(requirement.description, `${requirementPath}.description`);
      if (
        boolean(requirement.required, `${requirementPath}.required`) !== true
      ) {
        fail(
          `${requirementPath}.required`,
          "fixture requirements must be required",
        );
      }
      if (requirement.impact !== "standard" && requirement.impact !== "high") {
        fail(`${requirementPath}.impact`, "unsupported impact");
      }
    }

    const evidence = array(
      contract.available_evidence,
      `${path}.contract.available_evidence`,
    );
    if (evidence.length > 64) {
      fail(`${path}.contract.available_evidence`, "too many evidence items");
    }
    const evidenceIds = new Set<string>();
    for (
      let evidenceIndex = 0;
      evidenceIndex < evidence.length;
      evidenceIndex++
    ) {
      const evidencePath =
        `${path}.contract.available_evidence[${evidenceIndex}]`;
      const item = record(evidence[evidenceIndex], evidencePath);
      exactKeys(item, ["id", "description"], evidencePath);
      const evidenceId = string(item.id, `${evidencePath}.id`);
      if (evidenceIds.has(evidenceId)) {
        fail(`${evidencePath}.id`, "duplicate evidence id");
      }
      evidenceIds.add(evidenceId);
      string(item.description, `${evidencePath}.description`);
    }
    const abstentionReasons = uniqueStrings(
      contract.allowed_abstention_reasons,
      `${path}.contract.allowed_abstention_reasons`,
    );
    if (
      contract.abstention_taxonomy_version !== "quorum-router.abstention.v1"
    ) {
      fail(
        `${path}.contract.abstention_taxonomy_version`,
        "unsupported taxonomy",
      );
    }
    if (
      contract.unsupported_claim_taxonomy_version !==
        "quorum-router.unsupported-claim.v1"
    ) {
      fail(
        `${path}.contract.unsupported_claim_taxonomy_version`,
        "unsupported taxonomy",
      );
    }
    const prohibitedClaims = uniqueStrings(
      contract.prohibited_claim_types,
      `${path}.contract.prohibited_claim_types`,
    );
    for (
      const requiredClaim of [
        "external_action_without_receipt",
        "verification_without_evidence",
        "fabricated_evidence_identifier",
      ]
    ) {
      if (!prohibitedClaims.includes(requiredClaim)) {
        fail(
          `${path}.contract.prohibited_claim_types`,
          `missing ${requiredClaim}`,
        );
      }
    }

    const expected = record(testCase.expected, `${path}.expected`);
    exactKeys(
      expected,
      [
        "evaluation_state",
        "evaluation_reason",
        "status",
        "shadow_disposition",
        "selection_changed",
        "simulation_eligible",
        "asks_for_available_evidence",
        "abstention_reason",
        "unsupported_claims",
        "unsupported_claim_count",
        "evaluator",
        "requirement_results",
      ],
      `${path}.expected`,
    );
    const state = string(
      expected.evaluation_state,
      `${path}.expected.evaluation_state`,
    );
    if (!["evaluated", "unevaluated", "disputed"].includes(state)) {
      fail(`${path}.expected.evaluation_state`, "unsupported state");
    }
    const evaluationReason = string(
      expected.evaluation_reason,
      `${path}.expected.evaluation_reason`,
    );
    const allowedEvaluationReasons = state === "evaluated"
      ? ["completed"]
      : state === "unevaluated"
      ? ["no_independent_evaluator", "insufficient_valid_independent_results"]
      : ["valid_independent_disagreement"];
    if (!allowedEvaluationReasons.includes(evaluationReason)) {
      fail(`${path}.expected.evaluation_reason`, "reason does not match state");
    }
    const status = nullableString(expected.status, `${path}.expected.status`);
    if (
      status !== null &&
      !["qualified", "abstained", "non_answer", "invalid"].includes(status)
    ) {
      fail(`${path}.expected.status`, "unsupported status");
    }
    const disposition = string(
      expected.shadow_disposition,
      `${path}.expected.shadow_disposition`,
    );
    if (
      !["qualifying", "non_qualifying", "unavailable", "disputed"].includes(
        disposition,
      )
    ) {
      fail(`${path}.expected.shadow_disposition`, "unsupported disposition");
    }
    if (
      boolean(
        expected.selection_changed,
        `${path}.expected.selection_changed`,
      ) !== false
    ) {
      fail(
        `${path}.expected.selection_changed`,
        "shadow fixture cannot change selection",
      );
    }
    const simulationEligible = boolean(
      expected.simulation_eligible,
      `${path}.expected.simulation_eligible`,
    );
    const asksForAvailableEvidence = boolean(
      expected.asks_for_available_evidence,
      `${path}.expected.asks_for_available_evidence`,
    );
    const abstentionReason = nullableString(
      expected.abstention_reason,
      `${path}.expected.abstention_reason`,
    );
    const unsupportedClaimCount = finiteNumber(
      expected.unsupported_claim_count,
      `${path}.expected.unsupported_claim_count`,
    );
    if (!Number.isInteger(unsupportedClaimCount) || unsupportedClaimCount < 0) {
      fail(
        `${path}.expected.unsupported_claim_count`,
        "expected non-negative integer",
      );
    }
    const unsupportedClaims = array(
      expected.unsupported_claims,
      `${path}.expected.unsupported_claims`,
    );
    if (unsupportedClaims.length !== unsupportedClaimCount) {
      fail(
        `${path}.expected.unsupported_claim_count`,
        "must be derived from unsupported_claims length",
      );
    }
    for (
      let claimIndex = 0;
      claimIndex < unsupportedClaims.length;
      claimIndex++
    ) {
      const claimPath = `${path}.expected.unsupported_claims[${claimIndex}]`;
      const claim = record(unsupportedClaims[claimIndex], claimPath);
      exactKeys(claim, ["claim_type", "candidate_span_text"], claimPath);
      const claimType = string(claim.claim_type, `${claimPath}.claim_type`);
      if (!prohibitedClaims.includes(claimType)) {
        fail(
          `${claimPath}.claim_type`,
          "claim type is not prohibited by the contract",
        );
      }
      const claimSpan = string(
        claim.candidate_span_text,
        `${claimPath}.candidate_span_text`,
      );
      if (!candidate.includes(claimSpan)) {
        fail(
          `${claimPath}.candidate_span_text`,
          "unsupported claim must bind an exact candidate span",
        );
      }
    }

    const results = array(
      expected.requirement_results,
      `${path}.expected.requirement_results`,
    );
    let unknownEvidenceCount = 0;
    let satisfiedCount = 0;
    if (state === "evaluated") {
      const evaluatorIdentity = identity(
        expected.evaluator,
        `${path}.expected.evaluator`,
      );
      if (!isIndependent(candidateSource, evaluatorIdentity)) {
        fail(`${path}.expected.evaluator`, "evaluator is not independent");
      }
      if (status === null) {
        fail(`${path}.expected.status`, "evaluated case requires status");
      }
      if (results.length !== requirementIds.size) {
        fail(
          `${path}.expected.requirement_results`,
          "must cover every requirement exactly once",
        );
      }
      const resultIds = new Set<string>();
      for (let resultIndex = 0; resultIndex < results.length; resultIndex++) {
        const resultPath =
          `${path}.expected.requirement_results[${resultIndex}]`;
        const item = record(results[resultIndex], resultPath);
        exactKeys(item, [
          "id",
          "satisfied",
          "candidate_span_text",
          "evidence_ids",
        ], resultPath);
        const resultId = string(item.id, `${resultPath}.id`);
        if (!requirementIds.has(resultId) || resultIds.has(resultId)) {
          fail(`${resultPath}.id`, "unknown or duplicate requirement id");
        }
        resultIds.add(resultId);
        const satisfied = boolean(item.satisfied, `${resultPath}.satisfied`);
        const span = nullableString(
          item.candidate_span_text,
          `${resultPath}.candidate_span_text`,
        );
        const citedEvidence = uniqueStrings(
          item.evidence_ids,
          `${resultPath}.evidence_ids`,
        );
        for (const evidenceId of citedEvidence) {
          if (!evidenceIds.has(evidenceId)) unknownEvidenceCount++;
        }
        if (satisfied) {
          satisfiedCount++;
          if (span === null || !candidate.includes(span)) {
            fail(
              `${resultPath}.candidate_span_text`,
              "satisfied result must ground an exact candidate span",
            );
          }
          if (
            citedEvidence.length === 0 ||
            citedEvidence.some((evidenceId) => !evidenceIds.has(evidenceId))
          ) {
            fail(
              `${resultPath}.evidence_ids`,
              "satisfied result requires known evidence",
            );
          }
        } else if (span !== null) {
          fail(
            `${resultPath}.candidate_span_text`,
            "unsatisfied result must not claim a span",
          );
        }
      }
    } else {
      if (expected.evaluator !== null) {
        fail(
          `${path}.expected.evaluator`,
          "non-evaluated case cannot have a chosen evaluator",
        );
      }
      if (status !== null || results.length !== 0) {
        fail(
          `${path}.expected`,
          "non-evaluated case must have null status and no requirement results",
        );
      }
    }

    if (state === "evaluated" && status === "qualified") {
      if (
        satisfiedCount !== requirementIds.size || unknownEvidenceCount !== 0 ||
        unsupportedClaimCount !== 0 || abstentionReason !== null ||
        asksForAvailableEvidence
      ) {
        fail(
          `${path}.expected`,
          "qualified case violates grounding invariants",
        );
      }
      if (!simulationEligible || disposition !== "qualifying") {
        fail(
          `${path}.expected`,
          "qualified case must be simulation-eligible and qualifying",
        );
      }
    } else if (state === "evaluated" && status === "abstained") {
      if (
        satisfiedCount !== 0 || abstentionReason === null ||
        !abstentionReasons.includes(abstentionReason) ||
        unsupportedClaimCount !== 0 || asksForAvailableEvidence ||
        unknownEvidenceCount !== 0
      ) {
        fail(`${path}.expected`, "abstention is not contract-grounded");
      }
      if (simulationEligible || disposition !== "non_qualifying") {
        fail(`${path}.expected`, "abstention cannot qualify");
      }
    } else if (state === "evaluated" && status === "non_answer") {
      if (
        satisfiedCount === requirementIds.size || unknownEvidenceCount !== 0 ||
        unsupportedClaimCount !== 0 || abstentionReason !== null
      ) {
        fail(`${path}.expected`, "non-answer invariants failed");
      }
      if (
        asksForAvailableEvidence &&
        ![...evidenceIds].some((evidenceId) => candidate.includes(evidenceId))
      ) {
        fail(
          `${path}.candidate`,
          "asks-for-available-evidence case must identify supplied evidence",
        );
      }
      if (simulationEligible || disposition !== "non_qualifying") {
        fail(`${path}.expected`, "non-answer cannot qualify");
      }
    } else if (state === "evaluated" && status === "invalid") {
      if (unknownEvidenceCount === 0 && unsupportedClaimCount === 0) {
        fail(
          `${path}.expected`,
          "invalid case requires a structural invalidity trigger",
        );
      }
      if (
        simulationEligible || disposition !== "non_qualifying" ||
        abstentionReason !== null
      ) fail(`${path}.expected`, "invalid case cannot qualify or abstain");
    } else if (state === "unevaluated") {
      const available = array(
        testCase.available_evaluators,
        `${path}.available_evaluators`,
      )
        .map((item, evaluatorIndex) =>
          identity(item, `${path}.available_evaluators[${evaluatorIndex}]`)
        );
      if (available.some((item) => isIndependent(candidateSource, item))) {
        fail(
          `${path}.available_evaluators`,
          "independent evaluator exists; case cannot be unevaluated",
        );
      }
      if (
        disposition !== "unavailable" || simulationEligible ||
        abstentionReason !== null || unsupportedClaimCount !== 0
      ) {
        fail(`${path}.expected`, "unevaluated invariants failed");
      }
    } else if (state === "disputed") {
      const evaluatorResults = array(
        testCase.evaluator_results,
        `${path}.evaluator_results`,
      );
      if (evaluatorResults.length !== 2) {
        fail(
          `${path}.evaluator_results`,
          "expected exactly two evaluator results",
        );
      }
      const disagreementSignatures = new Set<string>();
      const evaluatorIdentities: Identity[] = [];
      for (
        let evaluatorIndex = 0;
        evaluatorIndex < evaluatorResults.length;
        evaluatorIndex++
      ) {
        const evaluatorPath = `${path}.evaluator_results[${evaluatorIndex}]`;
        const item = record(evaluatorResults[evaluatorIndex], evaluatorPath);
        exactKeys(
          item,
          [
            "evaluator",
            "status",
            "abstention_reason",
            "unsupported_claims",
            "requirement_results",
          ],
          evaluatorPath,
        );
        const evaluatorIdentity = identity(
          item.evaluator,
          `${evaluatorPath}.evaluator`,
        );
        if (!isIndependent(candidateSource, evaluatorIdentity)) {
          fail(evaluatorPath, "evaluator is not independent from candidate");
        }
        evaluatorIdentities.push(evaluatorIdentity);

        const evaluatorStatus = string(item.status, `${evaluatorPath}.status`);
        if (
          !["qualified", "abstained", "non_answer", "invalid"].includes(
            evaluatorStatus,
          )
        ) {
          fail(`${evaluatorPath}.status`, "unsupported status");
        }
        const evaluatorAbstention = item.abstention_reason === null
          ? null
          : string(
            item.abstention_reason,
            `${evaluatorPath}.abstention_reason`,
          );
        if (
          evaluatorStatus === "abstained"
            ? evaluatorAbstention === null ||
              !abstentionReasons.includes(evaluatorAbstention)
            : evaluatorAbstention !== null
        ) {
          fail(
            `${evaluatorPath}.abstention_reason`,
            "reason does not match status or taxonomy",
          );
        }

        const unsupportedItems = array(
          item.unsupported_claims,
          `${evaluatorPath}.unsupported_claims`,
        );
        const canonicalUnsupported: string[] = [];
        for (
          let claimIndex = 0;
          claimIndex < unsupportedItems.length;
          claimIndex++
        ) {
          const claimPath =
            `${evaluatorPath}.unsupported_claims[${claimIndex}]`;
          const claim = record(unsupportedItems[claimIndex], claimPath);
          exactKeys(claim, ["claim_type", "candidate_span_text"], claimPath);
          const claimType = string(claim.claim_type, `${claimPath}.claim_type`);
          if (!prohibitedClaims.includes(claimType)) {
            fail(`${claimPath}.claim_type`, "unknown claim taxonomy value");
          }
          const spanText = string(
            claim.candidate_span_text,
            `${claimPath}.candidate_span_text`,
          );
          if (!candidate.includes(spanText)) {
            fail(
              `${claimPath}.candidate_span_text`,
              "span absent from candidate",
            );
          }
          canonicalUnsupported.push(JSON.stringify([claimType, spanText]));
        }
        if (
          new Set(canonicalUnsupported).size !== canonicalUnsupported.length
        ) {
          fail(`${evaluatorPath}.unsupported_claims`, "duplicate claim tuple");
        }
        canonicalUnsupported.sort();

        const evaluatorRequirementItems = array(
          item.requirement_results,
          `${evaluatorPath}.requirement_results`,
        );
        const canonicalRequirements: Array<{
          id: string;
          satisfied: boolean;
          evidence_ids: string[];
        }> = [];
        const evaluatorRequirementIds = new Set<string>();
        for (
          let resultIndex = 0;
          resultIndex < evaluatorRequirementItems.length;
          resultIndex++
        ) {
          const resultPath =
            `${evaluatorPath}.requirement_results[${resultIndex}]`;
          const result = record(
            evaluatorRequirementItems[resultIndex],
            resultPath,
          );
          exactKeys(result, ["id", "satisfied", "evidence_ids"], resultPath);
          const resultId = string(result.id, `${resultPath}.id`);
          if (
            !requirementIds.has(resultId) ||
            evaluatorRequirementIds.has(resultId)
          ) {
            fail(`${resultPath}.id`, "unknown or duplicate requirement id");
          }
          evaluatorRequirementIds.add(resultId);
          const resultEvidence = uniqueStrings(
            result.evidence_ids,
            `${resultPath}.evidence_ids`,
          );
          for (const evidenceId of resultEvidence) {
            if (!evidenceIds.has(evidenceId)) {
              fail(`${resultPath}.evidence_ids`, "unknown evidence id");
            }
          }
          resultEvidence.sort();
          canonicalRequirements.push({
            id: resultId,
            satisfied: boolean(result.satisfied, `${resultPath}.satisfied`),
            evidence_ids: resultEvidence,
          });
        }
        if (evaluatorRequirementIds.size !== requirementIds.size) {
          fail(
            `${evaluatorPath}.requirement_results`,
            "must cover every contract requirement exactly once",
          );
        }
        canonicalRequirements.sort((left, right) =>
          left.id < right.id ? -1 : left.id > right.id ? 1 : 0
        );
        disagreementSignatures.add(JSON.stringify({
          status: evaluatorStatus,
          abstention_reason: evaluatorAbstention,
          unsupported_claims: canonicalUnsupported,
          requirement_results: canonicalRequirements,
        }));
      }
      if (!isIndependent(evaluatorIdentities[0], evaluatorIdentities[1])) {
        fail(
          `${path}.evaluator_results`,
          "evaluators are not pairwise independent",
        );
      }
      if (disagreementSignatures.size < 2) {
        fail(
          `${path}.evaluator_results`,
          "disputed case requires actual disagreement",
        );
      }
      if (
        disposition !== "disputed" || simulationEligible ||
        abstentionReason !== null || unsupportedClaimCount !== 0
      ) {
        fail(`${path}.expected`, "disputed invariants failed");
      }
    }
  }
}
