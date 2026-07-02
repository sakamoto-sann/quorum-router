import {
  createInMemoryAgentChatAuditSink,
  runAgentChatSimulator,
} from "../router.ts";

const audit = createInMemoryAgentChatAuditSink();
const result = runAgentChatSimulator({
  prompt: "Dry-run agent_chat skeleton only. No network or tools.",
  auditSink: audit.sink,
});

console.log(JSON.stringify(
  {
    decision: result.decision,
    transcript: result.transcript,
    auditMilestones: audit.events.map((event) => event.milestone),
  },
  null,
  2,
));
