import { revealWordProgress } from "./word-reveal";
import type { HeartbeatRunEvent } from "@paperclipai/shared";
import type { TranscriptEntry } from "../../adapters";
import { nativeRunEventsToTranscript } from "../transcript/native-run-events";
import type { TaskChatMessageItem } from "../task-chat/task-chat-model";
import { t } from "@/i18n";

const L = (key: string, options?: Record<string, unknown>) => t(`componentsDesignSandbox.fixtures.${key}`, options);
const W = (value: string) => L(`words.${value}`, { defaultValue: value.replaceAll("_", " ") });

/** Synthetic transport snapshots, not saved runs or copies of the chat-lab UI. */
export interface ThreadPreviewSnapshot {
  entries: TranscriptEntry[];
  status: "queued" | "running" | "succeeded" | "failed" | "timed_out" | "cancelled";
  renderer?: "native";
  emptyMessage?: string;
  activityUnavailable?: boolean;
  paused?: "leaf" | "subtree";
  messageState?: "pending" | "queued";
  notice?: "neutral" | "info" | "success" | "warning" | "danger";
  continuedAfterSteering?: boolean;
}
export interface ThreadPreviewCase {
  id: string;
  label: string;
  group: string;
  build: () => ThreadPreviewSnapshot;
}
const ts = (second: number) => new Date(Date.UTC(2026, 9, 15, 17, 12, second)).toISOString();
const event = (seq: number, type: string, payload: Record<string, unknown>, itemId?: string): HeartbeatRunEvent => ({
  id: seq, companyId: "synthetic-company", agentId: "synthetic-agent", runId: "synthetic-run", seq,
  eventType: type, stream: "system", level: "info", color: null, message: null, createdAt: new Date(ts(seq)),
  payload: { prpEvent: {
    schema: "paperclip.prp.event.v1", sourceEventId: `synthetic-event-${seq}`, sourceSeq: seq,
    sourceInstanceId: "synthetic-runner", sourceKind: "runner", runId: "synthetic-run",
    normalizedSessionId: "synthetic-session", eventType: type, schemaVersion: 1, priority: 1,
    emittedAt: ts(seq), payload, ...(itemId ? { itemId } : {}),
  } },
});
const reasoning = (complete = true, channel = "summary", text = "I’ll check the component alias and file list before explaining how the count was obtained.") => [
  event(1, "item.started", { kind: "reasoning", channel, text: "" }, "reasoning-1"),
  event(2, "item.delta", { text }, "reasoning-1"),
  ...(complete ? [event(3, "item.completed", { kind: "reasoning", channel, text }, "reasoning-1")] : []),
];
const commentary = (seq: number, text: string, final = false) => event(seq, "item.completed", {
  kind: "assistant_message", channel: final ? "final" : "progress", text,
}, `message-${seq}`);
const tool = (seq: number, name = "read_file", done = true, failed = false, options: { command?: string; result?: string } = {}) => [
  event(seq, "item.started", { kind: "dynamicToolCall", item: {
    type: "tool_use", id: `tool-${seq}`, name,
    input: name === "exec_command" ? { command: options.command ?? "rg --files ui/src/components/ui" } : { path: "ui/components.json" },
  } }, `tool-${seq}`),
  ...(done ? [event(seq + 1, "item.completed", { kind: "dynamicToolCall", item: {
    type: "tool_result", id: `tool-${seq}`, tool_use_id: `tool-${seq}`,
    result: failed ? "Synthetic command failed: the reconnect test timed out." : options.result ?? (name === "read_file" ? '{ "aliases": { "ui": "@/components/ui" } }' : "26 component source files · three project-specific wrappers"),
    is_error: failed,
  } }, `tool-${seq}`)] : []),
];
const progressText = "The follow-up asks how I arrived at the count. I’ll check the repository configuration and file list, then explain the method.";
export const SYNTHETIC_FINAL = "## Done\n\nI checked the configured component directory and excluded test files.\n\n- **26 component source files** in `ui/src/components/ui/`.\n- Three are project-specific wrappers; 23 are registry-style components.\n- No code changes were needed.\n\n```sh\nrg --files ui/src/components/ui | rg \"\\.tsx$\"\n```";
const workingEvents = () => [
  ...reasoning(), commentary(4, progressText), ...tool(5),
  commentary(8, "The alias points to `ui/src/components/ui/`. I’m checking the filenames and separating registry components from local wrappers."),
  ...tool(9, "exec_command", false),
];
const completedEvents = () => [...workingEvents().slice(0, -1), ...tool(9, "exec_command"), commentary(12, SYNTHETIC_FINAL, true)];
const snapshot = (events: HeartbeatRunEvent[], status: ThreadPreviewSnapshot["status"] = "running", extra: Partial<ThreadPreviewSnapshot> = {}): ThreadPreviewSnapshot => ({
  entries: nativeRunEventsToTranscript(events), status, ...extra,
});
const example = (id: string, label: string, group: string, build: () => ThreadPreviewSnapshot): ThreadPreviewCase => ({ id, label, group, build });
const direct = (id: string, label: string, group: string, entries: TranscriptEntry[], extra: Partial<ThreadPreviewSnapshot> = {}) => example(id, label, group, () => ({ entries, status: "running", ...extra }));

/** The prior exchange makes each state a realistic conversation, like staging. */
export function previewHistory(agentName: string): { human: TaskChatMessageItem; response: TaskChatMessageItem; entries: TranscriptEntry[] } {
  return {
    human: { id: "preview-request", kind: "message", author: "human", isCurrentUser: true, text: "How many UI components are in this project?", timestamp: "10:10 AM" },
    response: { id: "preview-response", kind: "message", author: "agent", authorName: agentName, text: "Done\n\n- Counted **26 component source files** in `ui/src/components/ui/`.\n- The count excludes test files. Three files are project-specific wrappers.\n- Verified the list directly from the repository; no changes were needed.", timestamp: "10:11 AM", channel: "final" },
    entries: nativeRunEventsToTranscript(completedEvents()),
  };
}

const permission = (status: "pending" | "resolved" | "expired" | "cancelled", input = false): Extract<TranscriptEntry, { kind: "runtime_request" }> => ({
  kind: "runtime_request", ts: ts(15), requestId: `preview-${input ? "question" : "permission"}`, requestKind: input ? "elicitation" : "command_approval",
  turnId: "synthetic-turn", requestType: input ? "input" : "permission", status,
  prompt: input ? "Which reconnect behavior should I verify?" : "Allow running the focused reconnect tests?",
  choices: input ? [] : [{ key: "accept", label: "Allow once" }, { key: "decline", label: "Deny" }], fields: [],
  questionSet: input ? { schema: "paperclip.question_set.v1", title: "Choose a reconnect policy", questions: [{
    id: "policy", prompt: "Which reconnect policy should I test?", required: true, answerMode: "single_select",
    options: [{ id: "bounded", label: "Bounded retry", description: "Stop after three attempts." }, { id: "manual", label: "Manual recovery", description: "Ask before reconnecting." }],
  }] } : null,
  resolvedAction: status === "resolved" ? "accept" : null,
});
const providerFamilies = ["plan", "tool_execution", "research", "delegation", "model_identity", "context", "artifact", "review", "hook", "memory", "safety", "terminal", "wait", "provider_notice"] as const;

export const THREAD_PREVIEW_CASES: ThreadPreviewCase[] = [
  example("staging-conversation", L("cases.stagingConversation"), L("groups.conversation"), () => snapshot(workingEvents())),
  example("session-start", L("cases.sessionStart"), L("groups.conversation"), () => snapshot([], "running")),
  example("runner-queued", L("cases.runnerQueued"), L("groups.conversation"), () => snapshot([], "queued", { emptyMessage: L("emptyMessage.waitingToStart") })),
  example("thinking", L("cases.thinking"), L("groups.conversation"), () => snapshot(reasoning(false))),
  ...(["summary", "detail", "unknown"] as const).map(channel => example(`reasoning-${channel}`, L("cases.reasoning", { detail: channel === "unknown" ? L("words.lifecycleOnly") : W(channel) }), L("groups.reasoningAndTools"), () => snapshot(reasoning(false, channel, channel === "unknown" ? "" : undefined)))),
  example("tool-call", L("cases.toolCall"), L("groups.reasoningAndTools"), () => snapshot([...reasoning(), commentary(4, progressText), ...tool(5, "read_file", false)])),
  example("working", L("cases.working"), L("groups.reasoningAndTools"), () => snapshot(workingEvents())),
  example("tool-completed", L("cases.toolCompleted"), L("groups.reasoningAndTools"), () => snapshot([...reasoning(), commentary(4, progressText), ...tool(5)])),
  example("tool-failed", L("cases.toolFailed"), L("groups.reasoningAndTools"), () => snapshot([...reasoning(), commentary(4, progressText), ...tool(5, "exec_command", true, true)])),
  example("tool-interrupted", L("cases.toolInterrupted"), L("groups.reasoningAndTools"), () => snapshot([...tool(5, "exec_command", false)], "cancelled")),
  example("responding", L("cases.responding"), L("groups.conversation"), () => snapshot([
    ...reasoning(), commentary(4, progressText), ...tool(5), event(8, "item.started", { kind: "assistant_message", channel: "progress", text: "" }, "streaming"),
    event(9, "item.delta", { text: "The earlier answer counted files in the directory configured for UI components. I’m checking the exact filenames so the explanation is reproducible." }, "streaming"),
  ])),
  example("streaming-final", L("cases.streamingFinal"), L("groups.conversation"), () => snapshot([
    ...completedEvents().slice(0, -1), event(12, "item.started", { kind: "assistant_message", channel: "final", text: "" }, "final"),
    event(13, "item.delta", { text: SYNTHETIC_FINAL }, "final"),
  ])),
  example("completed", L("cases.completed"), L("groups.conversation"), () => snapshot(completedEvents(), "succeeded")),
  example("activity-phases", L("cases.activityPhases"), L("groups.conversation"), () => snapshot(completedEvents(), "succeeded")),
  ...(["failed", "timed_out", "cancelled"] as const).map(status => example(`runner-${status}`, L("cases.run", { detail: W(status) }), L("groups.runOutcomes"), () => snapshot([...reasoning(), ...tool(5, "exec_command", false)], status))),
  example("runner-running", L("cases.runnerRunning"), L("groups.nativeRunner"), () => snapshot(workingEvents(), "running", { renderer: "native" })),
  example("runner-succeeded", L("cases.runnerSucceeded"), L("groups.nativeRunner"), () => snapshot(completedEvents(), "succeeded", { renderer: "native" })),
  ...(["failed", "timed_out", "cancelled"] as const).map(status => example(`native-${status}`, L("cases.nativeRunner", { detail: W(status) }), L("groups.nativeRunner"), () => snapshot([...reasoning(), ...tool(5, "exec_command", false), event(15, "run.terminal", { schema: "paperclip.prp.terminal.v1", turnTerminalState: status === "cancelled" ? "cancelled" : "failed", runTerminalState: status === "cancelled" ? "cancelled" : "failed", reportedWorkDisposition: "needs_review", stopReason: { schema: "paperclip.stop_reason.v1", code: "synthetic_provider_stop", message: status === "cancelled" ? "The synthetic run was cancelled." : "The synthetic test process stopped before a final reply." } })], status, { renderer: "native" }))),
  example("native-streaming", L("cases.nativeStreaming"), L("groups.nativeRunner"), () => snapshot([...reasoning(), ...tool(5), event(12, "item.started", { kind: "assistant_message", channel: "final", text: "" }, "final"), event(13, "item.delta", { text: SYNTHETIC_FINAL }, "final")], "running", { renderer: "native" })),
  example("native-starting", L("cases.nativeStarting"), L("groups.nativeRunner"), () => snapshot([], "queued", { renderer: "native" })),
  example("native-reconnecting", L("cases.nativeReconnecting"), L("groups.nativeRunner"), () => snapshot(workingEvents(), "running", { renderer: "native", activityUnavailable: true })),
  example("native-steering", L("cases.nativeSteering"), L("groups.nativeRunner"), () => snapshot(workingEvents(), "running", { renderer: "native", continuedAfterSteering: true })),
  ...(["pending", "queued"] as const).map(messageState => example(`message-${messageState}`, L("cases.humanMessage", { detail: W(messageState) }), L("groups.messagesAndComposer"), () => snapshot([], "queued", { messageState }))),
  ...(["leaf", "subtree"] as const).map(paused => example(`paused-${paused}`, paused === "leaf" ? L("cases.taskPaused") : L("cases.subtreePaused"), L("groups.messagesAndComposer"), () => snapshot([], "cancelled", { paused }))),
  ...(["neutral", "info", "success", "warning", "danger"] as const).map(notice => example(`notice-${notice}`, L("cases.systemNotice", { detail: W(notice) }), L("groups.messagesAndComposer"), () => snapshot([], "succeeded", { notice }))),
  ...(["pending", "resolved", "expired", "cancelled"] as const).map(status => direct(`permission-${status}`, L("cases.permissionRequest", { detail: W(status) }), L("groups.requestsAndResults"), [permission("pending"), ...(status !== "pending" ? [permission(status)] : [])], { emptyMessage: L("emptyMessage.waitingForPermission") })),
  direct("permission-denied", L("cases.permissionDenied"), L("groups.requestsAndResults"), [{ ...permission("resolved"), resolvedAction: "decline" }]),
  direct("question-text", L("cases.questionText"), L("groups.requestsAndResults"), [{ ...permission("pending", true), questionSet: null, fields: [{ name: "delay", label: "Reconnect delay", placeholder: "For example, 30 seconds" }] }], { emptyMessage: L("emptyMessage.waitingForAnswer") }),
  ...(["pending", "resolved", "expired", "cancelled"] as const).map(status => direct(`question-${status}`, L("cases.question", { detail: W(status) }), L("groups.requestsAndResults"), [permission("pending", true), ...(status !== "pending" ? [{ ...permission(status, true), response: status === "resolved" ? { schema: "paperclip.question_response.v1" as const, answers: { policy: { selectedOptionIds: ["bounded"] } } } : null }] : [])], { emptyMessage: L("emptyMessage.waitingForAnswer") })),
  ...(["done", "blocked", "needs_review", "yielded"] as const).map(disposition => direct(`result-${disposition}`, L("cases.runResult", { detail: W(disposition) }), L("groups.requestsAndResults"), [{
    kind: "run_result", ts: ts(20), disposition, summary: "The reconnect implementation is ready for review.", objectiveSatisfied: disposition === "done",
    verification: [{ commandOrCheck: "Reconnect tests", status: "passed", detail: "12 cases passed" }, { commandOrCheck: "Live provider smoke test", status: "not_run", detail: "No provider is contacted by this preview" }],
    remainingWork: disposition === "done" ? [] : [{ description: "Review the recovery message.", blocksCompletion: true }],
    blocker: disposition === "blocked" ? { reasonCode: "review_required", unblockAction: "Confirm the recovery behavior.", scope: "current_track" } : null, artifacts: [],
  }], { renderer: "native", status: disposition === "yielded" ? "running" : "succeeded" })),
  ...providerFamilies.map(family => direct(`provider-${family}`, L("cases.providerActivity", { detail: W(family) }), L("groups.providerAndWorkspace"), [{
    kind: "provider_activity", ts: ts(10), family, eventType: `synthetic.${family}`, status: "completed", title: `${family.replaceAll("_", " ")} activity`,
    summary: "Synthetic provider activity using the shipped transcript contract.", payload: family === "plan" ? { steps: [{ stepId: "read", body: "Inspect the reconnect boundary", status: "completed" }, { stepId: "test", body: "Run focused tests", status: "in_progress" }, { stepId: "review", body: "Review recovery messages", status: "pending" }] } : family === "delegation" ? { children: [{ childId: "reviewer", role: "Test reviewer", status: "completed", summary: "Checked the reconnect cases." }, { childId: "writer", role: "Documentation writer", status: "running", activitySummary: "Updating recovery examples" }] } : family === "tool_execution" ? { name: "pnpm test:run", operation: "execute", transport: "process", output: "PASS reconnect.test.ts\n12 tests passed", outputTruncated: false } : { summary: "Synthetic provider activity details.", message: "No provider or agent is contacted." },
  }], { renderer: "native" })),
  ...(["running", "failed", "interrupted", "informational"] as const).map(status => direct(`provider-status-${status}`, L("cases.providerActivity", { detail: W(status) }), L("groups.providerAndWorkspace"), [{ kind: "provider_activity", ts: ts(10), family: "tool_execution", eventType: "synthetic.tool", status, title: "Running reconnect tests", summary: status === "failed" ? "The reconnect test timed out." : "Checking reconnect behavior.", payload: { name: "pnpm test:run", operation: "execute", transport: "process", output: status === "failed" ? "FAIL reconnect.test.ts\nExpected reconnect after 3 attempts; received timeout." : "Checking reconnect tests…" } }], { renderer: "native" })),
  direct("workspace-changes", L("cases.workspaceChanges"), L("groups.providerAndWorkspace"), [{
    kind: "workspace_change", ts: ts(15), changeSetId: "synthetic-changes", revision: 1, source: "runner_verified", complete: true, patchArtifactRef: null,
    totals: { files: 1, additions: 1, deletions: 1 }, files: [{ path: "connectors/reconnect.ts", operation: "modify", previousPath: null, additions: 1, deletions: 1, binary: false, diff: "- const delay = 1000;\n+ const delay = Math.min(attempt * 1000, 30_000);" }],
  }], { renderer: "native" }),
  direct("workspace-file", L("cases.workspaceFile"), L("groups.providerAndWorkspace"), [{
    kind: "workspace_file_reference", ts: ts(15), referenceId: "synthetic-file", source: "harness_reported", path: "connectors/reconnect.ts", displayName: "Reconnect implementation", mediaType: "text/typescript", presentation: "code", line: 12,
    preview: "export const retryDelay = (attempt: number) => Math.min(attempt * 1000, 30_000);", previewTruncated: false, contentDigest: null,
  }], { renderer: "native" }),
  direct("live-token-cost", L("cases.liveTokenCost"), L("groups.providerAndWorkspace"), [{ kind: "result", ts: ts(18), text: "", inputTokens: 12000, outputTokens: 1800, cachedTokens: 4000, costUsd: 0.042, subtype: "paperclip_runner_usage", isError: false, errors: [] }, { kind: "result", ts: ts(19), text: "Cumulative provider usage includes earlier turns.", inputTokens: 50000, outputTokens: 6000, cachedTokens: 16000, costUsd: 0.19, subtype: "paperclip_runner_session_usage", isError: false, errors: [] }]),
];

// Keep links shared during the first preview usable without retaining lab-only UI.
export const THREAD_PREVIEW_ALIASES: Record<string, string> = {
  "human-message": "staging-conversation", "agent-message": "completed", "responding-burst": "responding",
  "running": "working", "diff": "workspace-changes", "awaiting-approval": "permission-pending", "runtime-input": "question-pending",
  "interrupted": "runner-cancelled", "refused": "permission-denied", "truncated": "runner-failed", "plan-todo": "provider-plan",
  "tool-pending": "tool-call", "tool-in_progress": "working", "tool-rejected": "permission-denied",
};

/** One cumulative, successful conversation for the watchable preview. Timing
 * uses units of --motion-sandbox-playback-step; no agent/provider is contacted. */
export const CONVERSATION_PLAYBACK_STAGES = [
  { label: L("stages.starting"), units: 0.25 },
  { label: L("stages.thinking"), units: 0.5 },
  { label: L("stages.commentary"), units: 0.5 },
  { label: L("stages.readingFiles"), units: 0.5 },
  { label: L("stages.reviewingTheComponentList"), units: 0.5 },
  { label: L("stages.runningACommand"), units: 0.75 },
  { label: L("stages.writingTheAnswer"), units: 1 },
  { label: L("stages.followupQueued"), units: 0.5 },
  { label: L("stages.planningTheVerification"), units: 0.5 },
  { label: L("stages.clarificationDemoAnswerFollowsAutomatically"), units: 0.75 },
  { label: L("stages.answeredBoundedRetry"), units: 0.5 },
  { label: L("stages.permissionDemoApprovalFollowsAutomatically"), units: 0.75 },
  { label: L("stages.runningFocusedTests"), units: 0.75 },
  { label: L("stages.testFailedInspectingTheTimeout"), units: 0.75 },
  { label: L("stages.explainingTheRetry"), units: 0.5 },
  { label: L("stages.retryingTheFocusedTest"), units: 0.75 },
  { label: L("stages.reviewingTheFilePreviewAndUsage"), units: 0.75 },
  { label: L("stages.writingTheVerificationResult"), units: 1 },
] as const;

export const PLAYBACK_FOLLOW_UP_STAGE = 7;
export const PLAYBACK_FOLLOW_UP = "Thanks. Can you also verify the reconnect behavior and show me the relevant code?";
export const PLAYBACK_VERIFICATION_FINAL = "## Verification complete\n\nThe bounded retry behavior passed the focused checks on retry.\n\n- The first test attempt timed out; the second passed.\n- The implementation caps the reconnect delay at 30 seconds.\n- No source files were changed.\n\nThis is synthetic preview data; no command or provider was contacted.";

export function conversationPlaybackSnapshot(stage: number, progress: number): ThreadPreviewSnapshot {
  const thought = "I’ll check the component directory configured for this project, then count the source files and exclude tests.";
  const update = "I’ll inspect the component alias first, then check the file list. No code changes are needed.";
  const next = "The alias points to `ui/src/components/ui/`. I’m separating registry components from local wrappers.";
  if (stage === 0) return { entries: [], status: "queued" };
  // Burst through whole words, then leave a short reading dwell. Transport
  // deltas themselves are not guaranteed to align with word boundaries.
  const text = (value: string) => revealWordProgress(value, Math.min(1, progress * 2));
  if (stage >= PLAYBACK_FOLLOW_UP_STAGE) {
    if (stage === 7) return snapshot([], "queued", { emptyMessage: L("emptyMessage.waitingToStart") });
    const entries: TranscriptEntry[] = [...THREAD_PREVIEW_CASES.find(item => item.id === "provider-plan")!.build().entries];
    if (stage >= 9) entries.push({ ...permission(stage > 9 ? "resolved" : "pending", true), response: stage > 9 ? { schema: "paperclip.question_response.v1", answers: { policy: { selectedOptionIds: ["bounded"] } } } : null });
    if (stage >= 11) entries.push(permission(stage > 11 ? "resolved" : "pending"));
    const test = (seq: number, done: boolean, failed = false) => tool(seq, "exec_command", done, failed, {
      command: "pnpm exec vitest run reconnect.test.ts", result: "PASS reconnect.test.ts · 12 cases passed",
    });
    if (stage >= 12) entries.push(...nativeRunEventsToTranscript(test(20, stage > 12, true)));
    if (stage >= 14) entries.push(...nativeRunEventsToTranscript([commentary(23, stage === 14 ? text("The test process timed out before returning a result. I’ll retry the focused check once and inspect the bounded delay implementation.") : "The test process timed out before returning a result. I’ll retry the focused check once and inspect the bounded delay implementation.")]));
    if (stage >= 15) entries.push(...nativeRunEventsToTranscript(test(24, stage > 15)));
    if (stage >= 16) entries.push(...THREAD_PREVIEW_CASES.find(item => item.id === "workspace-file")!.build().entries, ...THREAD_PREVIEW_CASES.find(item => item.id === "live-token-cost")!.build().entries);
    if (stage >= 17) entries.push(...nativeRunEventsToTranscript([
      event(28, "item.started", { kind: "assistant_message", channel: "final", text: "" }, "verification-final"),
      event(29, "item.delta", { text: stage === 17 ? text(PLAYBACK_VERIFICATION_FINAL) : PLAYBACK_VERIFICATION_FINAL }, "verification-final"),
      ...(stage > 17 ? [event(30, "item.completed", { kind: "assistant_message", channel: "final", text: PLAYBACK_VERIFICATION_FINAL }, "verification-final")] : []),
    ]));
    return { entries, status: stage >= CONVERSATION_PLAYBACK_STAGES.length ? "succeeded" : "running" };
  }
  const events = reasoning(stage > 1, "summary", stage === 1 ? text(thought) : thought);
  if (stage >= 2) events.push(commentary(4, stage === 2 ? text(update) : update));
  if (stage >= 3) events.push(...tool(5, "read_file", stage > 3));
  if (stage >= 4) events.push(commentary(8, stage === 4 ? text(next) : next));
  if (stage >= 5) events.push(...tool(9, "exec_command", stage > 5));
  if (stage === 6) events.push(
    event(12, "item.started", { kind: "assistant_message", channel: "final", text: "" }, "playback-final"),
    event(13, "item.delta", { text: text(SYNTHETIC_FINAL) }, "playback-final"),
  );
  return snapshot(events);
}
