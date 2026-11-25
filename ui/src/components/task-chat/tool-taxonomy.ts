/**
 * Provider-neutral tool vocabulary shared by live status, transcript rows,
 * and canonical provider activity. Exact semantic tools get purpose-specific
 * copy; ACP kinds and normalized name prefixes cover future adapters.
 */
import {
  BookOpen,
  Brain,
  ChevronsLeftRightEllipsis,
  CircleHelp,
  Clock3,
  FilePenLine,
  Image,
  ListChecks,
  MessageSquareReply,
  Network,
  Search,
  SearchCode,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { McpIcon } from "./McpIcon";
import { t } from "@/i18n";

/** Lucide icons and hand-rolled SVGs (the MCP logo) share this shape. */
export type ToolIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type ToolFamily =
  | "terminal"
  | "grep"
  | "search"
  | "read"
  | "edit"
  | "web"
  | "plan"
  | "question"
  | "agent"
  | "safety"
  | "image"
  | "wait"
  | "mcp"
  | "other";

export interface ToolTaxonomyEntry {
  family: ToolFamily;
  icon: ToolIcon;
  /** Progressive verb for the status pill, without the trailing ellipsis. */
  verbLabel: string;
}

export type ToolClassificationConfidence = "exact" | "kind" | "inferred" | "fallback" | "unnamed";

export interface ToolActivityPresentationInput {
  name?: string | null;
  transport?: string | null;
  namespace?: string | null;
  /** ACP kind or canonical operation. */
  operation?: string | null;
  target?: string | null;
  progress?: string | null;
}

export interface ToolSummaryGroup {
  key: string;
  singular: string;
  plural: string;
}

export interface ToolActivityPresentation {
  icon: ToolIcon;
  family: ToolFamily;
  runningLabel: string;
  completedLabel: string;
  failedLabel: string;
  interruptedLabel: string;
  displayName: string;
  sourceLabel?: string;
  technicalName?: string;
  confidence: ToolClassificationConfidence;
  summaryGroup: ToolSummaryGroup;
  sentenceSubject?: boolean;
}

/** Families whose rows read as "<verb> <subject>", for example "Read README.md". */
export const SUBJECT_FAMILIES: ReadonlySet<ToolFamily> = new Set(["terminal", "read", "edit", "grep", "search", "web"]);

/**
 * The label of a row that shows a concrete subject, for live and settled rows
 * alike: only the verb and any outcome ("Read · failed" beside "u1.txt"), or
 * nothing for a settled command, whose "$ " subject says it ran.
 */
export function subjectRowLabel(label: string, settledCommand: boolean): string {
  if (settledCommand) return "";
  const [action, marker] = label.split(" · ");
  return `${action!.split(" ")[0]}${marker ? ` · ${marker}` : ""}`;
}

export function sentenceRowLabel(label: string): string {
  return label.includes(" · ") ? label : "";
}

/** "Read · failed" → "Read · retried", for a failure a later call of the same tool recovered. */
export function retriedLabel(failedLabel: string): string {
  const failedSuffix = ` · ${t("componentsTaskChatToolTaxonomy.markers.failed")}`;
  return failedLabel.endsWith(failedSuffix)
    ? `${failedLabel.slice(0, -failedSuffix.length)} · ${t("componentsTaskChatToolTaxonomy.markers.retried")}`
    : failedLabel;
}

/** ACPX's placeholder title must never displace real lifecycle identity. */
const GENERIC_TOOL_NAMES = new Set(["tool", "tool call", "tool_call", "acp_tool"]);

export function isGenericToolName(name: string | undefined | null): boolean {
  const raw = (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*\((?:pending|in[_ -]?progress|completed|failed|cancelled|canceled)\)$/, "");
  return !raw || GENERIC_TOOL_NAMES.has(raw);
}

interface McpIdentity {
  namespace: string;
  name: string;
}

export function mcpToolIdentity(name: string): McpIdentity | null {
  const doubleUnderscore = name.match(/^mcp__(.+?)__(.+)$/i);
  if (doubleUnderscore) return { namespace: doubleUnderscore[1], name: doubleUnderscore[2] };
  const dotted = name.match(/^mcp\.([^.]+)\.(.+)$/i);
  return dotted ? { namespace: dotted[1], name: dotted[2] } : null;
}

function identifierWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function sentenceCase(words: readonly string[]): string {
  if (words.length === 0) return "";
  const text = words.map((word) => {
    if (["api", "id", "lsp", "mcp", "pr", "url"].includes(word)) return word.toUpperCase();
    return word;
  }).join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function humanizeToolName(name: string | undefined | null): string {
  const raw = (name ?? "").trim();
  if (isGenericToolName(raw)) return t("componentsTaskChatToolTaxonomy.unnamedTool");
  const mcp = mcpToolIdentity(raw);
  return sentenceCase(identifierWords(mcp?.name ?? raw));
}

/** Humanized MCP tool segment for both mcp__server__tool and mcp.server.tool. */
export function mcpToolSegment(name: string): string | null {
  const identity = mcpToolIdentity(name);
  return identity ? humanizeToolName(identity.name) : null;
}

type Action =
  | "read" | "list" | "search" | "fetch" | "open" | "update" | "create"
  | "delete" | "move" | "run" | "request" | "post" | "start" | "stop"
  | "wait" | "finish" | "block" | "think" | "switch" | "other";

interface ExactAction {
  action: Action;
  running?: string;
  completed?: string;
  group?: ToolSummaryGroup;
  family?: ToolFamily;
  sentence?: boolean;
}

const group =(key: string, singular: string, plural: string): ToolSummaryGroup => ({ key, singular, plural });

const EXACT_ACTIONS: Record<string, ExactAction> = {
  bash: { action: "run" },
  terminal: { action: "run" },
  shell: { action: "run" },
  command: { action: "run" },
  run: { action: "run" },
  execute: { action: "run" },
  exec_command: { action: "run" },
  apply_patch: { action: "update", running: t("componentsTaskChatToolTaxonomy.exactActions.applyPatch.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.applyPatch.completed") },
  read: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.read.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.read.completed") },
  write: { action: "update", running: t("componentsTaskChatToolTaxonomy.exactActions.write.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.write.completed") },
  edit: { action: "update", running: t("componentsTaskChatToolTaxonomy.exactActions.edit.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.edit.completed") },
  notebook_read: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.notebookRead.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.notebookRead.completed") },
  notebook_edit: { action: "update", running: t("componentsTaskChatToolTaxonomy.exactActions.notebookEdit.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.notebookEdit.completed") },
  glob: { action: "search", running: t("componentsTaskChatToolTaxonomy.exactActions.glob.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.glob.completed") },
  grep: { action: "search", running: t("componentsTaskChatToolTaxonomy.exactActions.grep.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.grep.completed"), family: "grep" },
  tool_search: { action: "search", running: t("componentsTaskChatToolTaxonomy.exactActions.toolSearch.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.toolSearch.completed"), group: group("tool_search", t("componentsTaskChatToolTaxonomy.groups.toolSearch.singular"), t("componentsTaskChatToolTaxonomy.groups.toolSearch.plural")) },
  web_search: { action: "search", running: t("componentsTaskChatToolTaxonomy.exactActions.webSearch.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.webSearch.completed"), family: "web" },
  web_fetch: { action: "fetch", running: t("componentsTaskChatToolTaxonomy.exactActions.webFetch.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.webFetch.completed"), family: "web" },
  todo_write: { action: "update", running: t("componentsTaskChatToolTaxonomy.exactActions.todoWrite.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.todoWrite.completed"), family: "plan", group: group("task_operation", t("componentsTaskChatToolTaxonomy.groups.taskOperation.singular"), t("componentsTaskChatToolTaxonomy.groups.taskOperation.plural")) },
  task_create: { action: "create", running: t("componentsTaskChatToolTaxonomy.exactActions.taskCreate.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.taskCreate.completed"), family: "plan", group: group("task_operation", t("componentsTaskChatToolTaxonomy.groups.taskOperation.singular"), t("componentsTaskChatToolTaxonomy.groups.taskOperation.plural")) },
  task_update: { action: "update", running: t("componentsTaskChatToolTaxonomy.exactActions.taskUpdate.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.taskUpdate.completed"), family: "plan", group: group("task_operation", t("componentsTaskChatToolTaxonomy.groups.taskOperation.singular"), t("componentsTaskChatToolTaxonomy.groups.taskOperation.plural")) },
  task_list: { action: "list", running: t("componentsTaskChatToolTaxonomy.exactActions.taskList.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.taskList.completed"), family: "plan", group: group("task_operation", t("componentsTaskChatToolTaxonomy.groups.taskOperation.singular"), t("componentsTaskChatToolTaxonomy.groups.taskOperation.plural")) },
  task_get: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.taskGet.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.taskGet.completed"), family: "plan", group: group("task_operation", t("componentsTaskChatToolTaxonomy.groups.taskOperation.singular"), t("componentsTaskChatToolTaxonomy.groups.taskOperation.plural")) },
  enter_plan_mode: { action: "switch", running: t("componentsTaskChatToolTaxonomy.exactActions.enterPlanMode.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.enterPlanMode.completed"), family: "plan" },
  exit_plan_mode: { action: "switch", running: t("componentsTaskChatToolTaxonomy.exactActions.exitPlanMode.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.exitPlanMode.completed"), family: "plan" },
  skill: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.skill.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.skill.completed") },
  ask_user_question: { action: "request", running: t("componentsTaskChatToolTaxonomy.exactActions.askUserQuestion.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.askUserQuestion.completed"), family: "question" },
  request_human_input: { action: "request", running: t("componentsTaskChatToolTaxonomy.exactActions.requestHumanInput.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.requestHumanInput.completed"), family: "question", group: group("task_operation", t("componentsTaskChatToolTaxonomy.groups.taskOperation.singular"), t("componentsTaskChatToolTaxonomy.groups.taskOperation.plural")) },
  agent: { action: "start", running: t("componentsTaskChatToolTaxonomy.exactActions.agent.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.agent.completed"), family: "agent" },
  task: { action: "start", running: t("componentsTaskChatToolTaxonomy.exactActions.task.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.task.completed"), family: "agent" },
  task_output: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.taskOutput.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.taskOutput.completed"), family: "agent" },
  task_stop: { action: "stop", running: t("componentsTaskChatToolTaxonomy.exactActions.taskStop.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.taskStop.completed"), family: "agent" },
  send_message: { action: "post", running: t("componentsTaskChatToolTaxonomy.exactActions.sendMessage.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.sendMessage.completed"), family: "agent" },
  spawn_agent: { action: "start", running: t("componentsTaskChatToolTaxonomy.exactActions.spawnAgent.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.spawnAgent.completed"), family: "agent" },
  wait_agent: { action: "wait", running: t("componentsTaskChatToolTaxonomy.exactActions.waitAgent.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.waitAgent.completed"), family: "agent" },
  wait_threads: { action: "wait", running: t("componentsTaskChatToolTaxonomy.exactActions.waitThreads.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.waitThreads.completed"), family: "agent" },
  interrupt_agent: { action: "stop", running: t("componentsTaskChatToolTaxonomy.exactActions.interruptAgent.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.interruptAgent.completed"), family: "agent" },
  report_findings: { action: "post", running: t("componentsTaskChatToolTaxonomy.exactActions.reportFindings.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.reportFindings.completed"), family: "safety" },
  guardian_review: { action: "think", running: t("componentsTaskChatToolTaxonomy.exactActions.guardianReview.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.guardianReview.completed"), family: "safety" },
  lsp: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.lsp.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.lsp.completed") },
  compact_conversation: { action: "think", running: t("componentsTaskChatToolTaxonomy.exactActions.compactConversation.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.compactConversation.completed") },
  image_generation: { action: "create", running: t("componentsTaskChatToolTaxonomy.exactActions.imageGeneration.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.imageGeneration.completed"), family: "image" },
  view_image: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.viewImage.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.viewImage.completed"), family: "image" },
  multi_tool_use_parallel: { action: "run", running: t("componentsTaskChatToolTaxonomy.exactActions.multiToolUseParallel.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.multiToolUseParallel.completed") },
  get_task_context: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.getTaskContext.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.getTaskContext.completed") },
  get_task_history: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.getTaskHistory.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.getTaskHistory.completed") },
  list_documents: { action: "list", running: t("componentsTaskChatToolTaxonomy.exactActions.listDocuments.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.listDocuments.completed") },
  read_document: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.readDocument.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.readDocument.completed") },
  list_document_revisions: { action: "list", running: t("componentsTaskChatToolTaxonomy.exactActions.listDocumentRevisions.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.listDocumentRevisions.completed") },
  report_progress: { action: "post", running: t("componentsTaskChatToolTaxonomy.exactActions.reportProgress.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.reportProgress.completed") },
  answer_status_question: { action: "post", running: t("componentsTaskChatToolTaxonomy.exactActions.answerStatusQuestion.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.answerStatusQuestion.completed") },
  write_document: { action: "update", running: t("componentsTaskChatToolTaxonomy.exactActions.writeDocument.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.writeDocument.completed") },
  // With the file as its subject the row reads "Attached u1.txt".
  register_deliverable: { action: "create", running: t("componentsTaskChatToolTaxonomy.exactActions.registerDeliverable.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.registerDeliverable.completed") },
  // Antigravity's swarm progress lines; the subject is the whole plain sentence.
  swarm_update: { action: "other", running: t("componentsTaskChatToolTaxonomy.exactActions.swarmUpdate.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.swarmUpdate.completed"), family: "agent", sentence: true, group: group("swarm_update", t("componentsTaskChatToolTaxonomy.groups.swarmUpdate.singular"), t("componentsTaskChatToolTaxonomy.groups.swarmUpdate.plural")) },
  finish_task: { action: "finish", running: t("componentsTaskChatToolTaxonomy.exactActions.finishTask.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.finishTask.completed") },
  paperclip_finish: { action: "finish", running: t("componentsTaskChatToolTaxonomy.exactActions.paperclipFinish.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.paperclipFinish.completed") },
  block_task: { action: "block", running: t("componentsTaskChatToolTaxonomy.exactActions.blockTask.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.blockTask.completed") },
  paperclip_block: { action: "block", running: t("componentsTaskChatToolTaxonomy.exactActions.paperclipBlock.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.paperclipBlock.completed") },
  request_review: { action: "request", running: t("componentsTaskChatToolTaxonomy.exactActions.requestReview.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.requestReview.completed") },
  list_agents: { action: "list", running: t("componentsTaskChatToolTaxonomy.exactActions.listAgents.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.listAgents.completed") },
  get_agent: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.getAgent.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.getAgent.completed") },
  search_tasks: { action: "search", running: t("componentsTaskChatToolTaxonomy.exactActions.searchTasks.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.searchTasks.completed") },
  list_approvals: { action: "list", running: t("componentsTaskChatToolTaxonomy.exactActions.listApprovals.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.listApprovals.completed") },
  get_approval: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.getApproval.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.getApproval.completed") },
  get_approval_context: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.getApprovalContext.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.getApprovalContext.completed") },
  get_workspace_runtime: { action: "read", running: t("componentsTaskChatToolTaxonomy.exactActions.getWorkspaceRuntime.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.getWorkspaceRuntime.completed") },
  control_workspace_service: { action: "run", running: t("componentsTaskChatToolTaxonomy.exactActions.controlWorkspaceService.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.controlWorkspaceService.completed") },
  set_dependencies: { action: "update", running: t("componentsTaskChatToolTaxonomy.exactActions.setDependencies.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.setDependencies.completed") },
  set_task_title: { action: "update", running: t("componentsTaskChatToolTaxonomy.exactActions.setTaskTitle.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.setTaskTitle.completed") },
  create_task: { action: "create", running: t("componentsTaskChatToolTaxonomy.exactActions.createTask.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.createTask.completed") },
  request_approval: { action: "request", running: t("componentsTaskChatToolTaxonomy.exactActions.requestApproval.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.requestApproval.completed") },
  decide_approval: { action: "update", running: t("componentsTaskChatToolTaxonomy.exactActions.decideApproval.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.decideApproval.completed") },
  comment_on_approval: { action: "post", running: t("componentsTaskChatToolTaxonomy.exactActions.commentOnApproval.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.commentOnApproval.completed") },
  schedule_wake: { action: "create", running: t("componentsTaskChatToolTaxonomy.exactActions.scheduleWake.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.scheduleWake.completed"), family: "wait" },
  generic_api_request: { action: "request", running: t("componentsTaskChatToolTaxonomy.exactActions.genericApiRequest.running"), completed: t("componentsTaskChatToolTaxonomy.exactActions.genericApiRequest.completed") },
};

const ACTION_PREFIXES: Record<Action, readonly string[]> = {
  read: ["get", "read", "inspect", "view"],
  list: ["list", "glob"],
  search: ["find", "search", "grep", "query", "lookup"],
  fetch: ["fetch", "browse"],
  open: ["open"],
  update: ["write", "edit", "update", "set", "patch", "upsert", "sync"],
  create: ["create", "add", "register", "upload"],
  delete: ["delete", "remove"],
  move: ["move", "rename"],
  run: ["run", "execute", "bash", "shell", "command"],
  request: ["request", "ask", "prompt"],
  post: ["send", "message", "comment", "report", "answer"],
  start: ["start", "spawn", "delegate"],
  stop: ["stop", "cancel", "interrupt"],
  wait: ["wait", "sleep", "poll"],
  finish: ["finish", "complete"],
  block: ["block"],
  think: ["think", "reason", "compact", "review"],
  switch: ["switch", "enter", "exit"],
  other: [],
};

const OPERATION_ACTIONS: Record<string, Action> = {
  read: "read",
  edit: "update",
  delete: "delete",
  move: "move",
  search: "search",
  list: "list",
  execute: "run",
  think: "think",
  fetch: "fetch",
  switch_mode: "switch",
};

function normalizedKey(name: string): string {
  return identifierWords(name).join("_");
}

function inferredAction(words: readonly string[]): Action | null {
  const first = words[0];
  if (!first) return null;
  for (const [action, prefixes] of Object.entries(ACTION_PREFIXES) as Array<[Action, readonly string[]]>) {
    if (prefixes.includes(first)) return action;
  }
  return null;
}

function actionFamily(action: Action): ToolFamily {
  if (action === "run") return "terminal";
  if (action === "read" || action === "list") return "read";
  if (action === "search") return "search";
  if (action === "fetch" || action === "open") return "web";
  if (["update", "create", "delete", "move"].includes(action)) return "edit";
  if (action === "request") return "question";
  if (action === "start" || action === "stop") return "agent";
  if (action === "wait") return "wait";
  return "other";
}

const FAMILY_ICONS: Record<ToolFamily, ToolIcon> = {
  terminal: Terminal,
  grep: SearchCode,
  search: Search,
  read: BookOpen,
  edit: FilePenLine,
  web: ChevronsLeftRightEllipsis,
  plan: ListChecks,
  question: CircleHelp,
  agent: Network,
  safety: ShieldCheck,
  image: Image,
  wait: Clock3,
  mcp: McpIcon,
  other: Wrench,
};

function actionCopy(action: Action, object: string | undefined): { running: string; completed: string } {
  if (object && OBJECT_ACTIONS.has(action)) {
    return {
      running: t(`componentsTaskChatToolTaxonomy.actions.${action}.runningObject`, { object }),
      completed: t(`componentsTaskChatToolTaxonomy.actions.${action}.completedObject`, { object }),
    };
  }
  return { running: t(`componentsTaskChatToolTaxonomy.actions.${action}.running`), completed: t(`componentsTaskChatToolTaxonomy.actions.${action}.completed`) };
}

/** Actions whose copy names the object the tool acts on ("Reading issue comments"). */
const OBJECT_ACTIONS: ReadonlySet<Action> = new Set<Action>(["read", "list", "search", "fetch", "open", "update", "create", "delete", "move", "request", "post", "start", "stop", "switch"]);

function defaultSummaryGroup(action: Action): ToolSummaryGroup {
  switch (action) {
    case "run": return group("command", t("componentsTaskChatToolTaxonomy.groups.command.singular"), t("componentsTaskChatToolTaxonomy.groups.command.plural"));
    case "read":
    case "list": return group("read", t("componentsTaskChatToolTaxonomy.groups.read.singular"), t("componentsTaskChatToolTaxonomy.groups.read.plural"));
    case "search": return group("search", t("componentsTaskChatToolTaxonomy.groups.search.singular"), t("componentsTaskChatToolTaxonomy.groups.search.plural"));
    case "update":
    case "create":
    case "delete":
    case "move": return group("file_change", t("componentsTaskChatToolTaxonomy.groups.fileChange.singular"), t("componentsTaskChatToolTaxonomy.groups.fileChange.plural"));
    case "start":
    case "stop": return group("delegation", t("componentsTaskChatToolTaxonomy.groups.delegation.singular"), t("componentsTaskChatToolTaxonomy.groups.delegation.plural"));
    case "wait": return group("wait", t("componentsTaskChatToolTaxonomy.groups.wait.singular"), t("componentsTaskChatToolTaxonomy.groups.wait.plural"));
    default: return group("tool_action", t("componentsTaskChatToolTaxonomy.groups.toolAction.singular"), t("componentsTaskChatToolTaxonomy.groups.toolAction.plural"));
  }
}

function paperclipSummaryGroup(action: Action): ToolSummaryGroup {
  if (action === "read" || action === "list") return group("paperclip_read", t("componentsTaskChatToolTaxonomy.groups.paperclipRead.singular"), t("componentsTaskChatToolTaxonomy.groups.paperclipRead.plural"));
  return group("task_operation", t("componentsTaskChatToolTaxonomy.groups.taskOperation.singular"), t("componentsTaskChatToolTaxonomy.groups.taskOperation.plural"));
}

/**
 * Resolve one tool into status-specific copy and iconography. Precedence is:
 * exact aliases, canonical ACP operation/kind, normalized verb, then a named
 * fallback. MCP remains visible as the source icon without losing semantics.
 */
export function toolActivityPresentation(input: ToolActivityPresentationInput): ToolActivityPresentation {
  const rawName = (input.name ?? "").trim();
  const parsedMcp = mcpToolIdentity(rawName);
  const namespace = (input.namespace ?? parsedMcp?.namespace ?? "").trim();
  // The name itself is authoritative for historical ACPX records that were
  // persisted as builtin before MCP transport normalization existed.
  const transport = (parsedMcp ? "mcp" : input.transport ?? "builtin").toLowerCase();
  const semanticName = (parsedMcp?.name ?? rawName).trim();
  const words = identifierWords(semanticName);
  const key = normalizedKey(semanticName);
  const exact = EXACT_ACTIONS[key];
  const operationAction = OPERATION_ACTIONS[(input.operation ?? "").trim().toLowerCase()];
  const inferred = inferredAction(words);
  const action = exact?.action ?? operationAction ?? inferred ?? "other";
  const confidence: ToolClassificationConfidence = exact
    ? "exact"
    : operationAction
      ? "kind"
      : inferred
        ? "inferred"
        : isGenericToolName(semanticName)
          ? "unnamed"
          : "fallback";
  const displayName = isGenericToolName(semanticName) ? t("componentsTaskChatToolTaxonomy.unnamedTool") : humanizeToolName(semanticName);
  const identifierLikeName = /^[A-Za-z][A-Za-z0-9_.:-]*$/.test(semanticName);
  const objectWords = inferred && identifierLikeName && words.length > 1 ? words.slice(1) : [];
  const object = objectWords.length ? sentenceCase(objectWords).replace(/^./, (letter) => letter.toLowerCase()) : undefined;
  const copy = exact?.running && exact.completed
    ? { running: exact.running, completed: exact.completed }
    : action === "other"
      ? isGenericToolName(semanticName)
        ? { running: t("componentsTaskChatToolTaxonomy.runningUnnamed"), completed: t("componentsTaskChatToolTaxonomy.ranUnnamed") }
        : { running: t("componentsTaskChatToolTaxonomy.runningNamed", { name: displayName }), completed: t("componentsTaskChatToolTaxonomy.ranNamed", { name: displayName }) }
      : actionCopy(action, exact ? undefined : object);
  const semanticFamily = exact?.family ?? actionFamily(action);
  const family = transport === "mcp" ? "mcp" : semanticFamily;
  const sourceLabel = namespace
    ? humanizeToolName(namespace)
    : transport === "mcp"
      ? "MCP"
      : undefined;
  const summaryGroup = namespace.toLowerCase() === "paperclip"
    ? paperclipSummaryGroup(action)
    : exact?.group ?? defaultSummaryGroup(action);

  return {
    icon: FAMILY_ICONS[family],
    family,
    runningLabel: copy.running,
    completedLabel: copy.completed,
    failedLabel: `${copy.completed} · ${t("componentsTaskChatToolTaxonomy.markers.failed")}`,
    interruptedLabel: `${copy.running} · ${t("componentsTaskChatToolTaxonomy.markers.stopped")}`,
    displayName,
    sourceLabel,
    technicalName: rawName || undefined,
    confidence,
    summaryGroup,
    ...(exact?.sentence ? { sentenceSubject: true } : {}),
  };
}

/** Compact compatibility mapping used by legacy tool rows and live pills. */
export function toolTaxonomy(name: string | undefined | null): ToolTaxonomyEntry {
  const presentation = toolActivityPresentation({ name });
  return {
    family: presentation.family,
    icon: presentation.icon,
    verbLabel: presentation.runningLabel,
  };
}

/** Icons for tool-free informative statuses. */
export function statusLabelIcon(label: string | undefined | null): ToolIcon | null {
  const raw = (label ?? "").trim().toLowerCase();
  if (raw === "thinking") return Brain;
  if (raw === "responding" || raw.startsWith("responding (")) return MessageSquareReply;
  return null;
}
