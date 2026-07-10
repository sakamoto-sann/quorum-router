export const ACTION_CLASSIFICATIONS = [
  "read_only",
  "local_temp_write",
  "repo_write",
  "shell_write",
  "github_write",
  "db_write",
  "external_api_write",
  "release",
  "policy_change",
  "credential_change",
] as const;
export type ActionClassification = typeof ACTION_CLASSIFICATIONS[number];

type BaseAction = {
  id: string;
  classification: ActionClassification;
  proposedBy: string;
};

/** Structured proposal only. QuorumRouter never executes this directly. */
export type ActionProposal =
  & BaseAction
  & (
    | { kind: "read_file"; path: string }
    | { kind: "write_file"; path: string; content: string }
    | { kind: "patch_file"; path: string; find: string; replace: string }
    | { kind: "run_command"; command: string[] }
  );
