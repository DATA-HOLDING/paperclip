import {
  AlertTriangle,
  BookOpen,
  Bot,
  CircleCheck,
  CircleDashed,
  CircleX,
  Box,
  Clock3,
  Database,
  FileCheck2,
  FilePenLine,
  FileText,
  Globe,
  Info,
  ListChecks,
  PackageCheck,
  Search,
  TerminalSquare,
  Users,
} from "lucide-react";
import type {
  TaskChatMaterializedResourceItem,
  TaskChatProtocolItem,
  TaskChatProviderActivityItem,
  TaskChatWorkspaceChangeItem,
  TaskChatWorkspaceFileItem,
} from "./task-chat-model";
import {
  humanizeToolName,
  isGenericToolName,
  retriedLabel,
  sentenceRowLabel,
  SUBJECT_FAMILIES,
  subjectRowLabel,
  toolActivityPresentation,
  type ToolIcon,
} from "./tool-taxonomy";
import { governancePresentation, type GovernanceTone } from "./governance-presentation";
import { t } from "@/i18n";

export interface TaskChatActivityPresentation {
  icon: ToolIcon;
  runningLabel: string;
  completedLabel: string;
  failedLabel?: string;
  interruptedLabel?: string;
  detail?: string;
  /** Governance rows tint a stopped action and carry its reason as a note. */
  tone?: GovernanceTone;
  note?: string;
}

export function providerNoticeSeverity(item: TaskChatProviderActivityItem): "info" | "warning" | "error" {
  const severity = item.details.find((entry) => entry.label === "Severity")?.value;
  if (item.status === "failed" || severity === "error") return "error";
  return severity === "info" ? "info" : "warning";
}

function providerDetail(item: TaskChatProviderActivityItem, ...labels: string[]): string | undefined {
  return item.details.find((entry) => labels.includes(entry.label))?.value;
}

function meaningfulToolDetail(value: string | undefined): string | undefined {
  if (!value || isGenericToolName(value) || /^tool(?:\s+|_)call\b/i.test(value)) return undefined;
  return value;
}

/** Host and path without scheme or query, for one-line web activity. */
export function compactUrl(href: string): string {
  try {
    const url = new URL(href);
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${url.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return href;
  }
}

/** Whole-second duration such as "30s" or "2m 5s" from a millisecond detail. */
export function durationLabel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return undefined;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function modelRouteDetail(item: TaskChatProviderActivityItem): string | undefined {
  const from = providerDetail(item, "From Model") ?? providerDetail(item, "Requested Model");
  const to = providerDetail(item, "Effective Model");
  if (!to || to === "unknown") return undefined;
  const reason = providerDetail(item, "Reason");
  const route = from && from !== "unknown" && from !== to ? `${from} → ${to}` : to;
  return reason && reason !== "provider reroute" ? `${route} · ${reason}` : route;
}

export function providerActivityPresentation(item: TaskChatProviderActivityItem): TaskChatActivityPresentation {
  const detail = item.summary
    ?? providerDetail(item, "Query", "URL", "Target", "Name", "Reference", "Reason", "Summary");
  switch (item.family) {
    case "research": {
      const action = providerDetail(item, "Action")?.toLowerCase();
      const query = providerDetail(item, "Query");
      const url = providerDetail(item, "Url");
      if (action === "open_page") {
        return { icon: Globe, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.openingAWebPage"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.openedAWebPage"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.couldntOpenTheWebPage"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.stoppedOpeningTheWebPage"), detail: url ? compactUrl(url) : detail };
      }
      if (action === "find_in_page") {
        const pattern = providerDetail(item, "Pattern");
        return { icon: Search, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.searchingThePage"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.searchedThePage"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.pageSearchFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.pageSearchStopped"), detail: [pattern ? `“${pattern}”` : undefined, url ? compactUrl(url) : undefined].filter(Boolean).join(t("componentsTaskChatTaskChatActivityPresentation.patternInPage")) || detail };
      }
      return { icon: Search, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.searchingTheWeb"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.searchedTheWeb"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.webSearchFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.webSearchStopped"), detail: query ? `“${query}”` : detail };
    }
    case "tool_execution": {
      const name = providerDetail(item, "Name");
      const target = providerDetail(item, "Target");
      const progress = providerDetail(item, "Progress");
      const tool = toolActivityPresentation({
        name,
        transport: providerDetail(item, "Transport"),
        namespace: providerDetail(item, "Namespace"),
        operation: providerDetail(item, "Operation"),
        target,
        progress,
      });
      const subject = meaningfulToolDetail(providerDetail(item, "Subject"));
      // The tool's own name repeated as its activity says nothing new.
      const describes = (value: string | undefined) =>
        value && !(name && humanizeToolName(value) === humanizeToolName(name)) ? value : undefined;
      const boundedActivity = describes(subject)
        ?? describes(meaningfulToolDetail(item.summary))
        ?? describes(meaningfulToolDetail(progress))
        ?? describes(meaningfulToolDetail(target));
      // People read what a tool did, never its technical name; another
      // server's tools still say where they came from.
      const source = tool.sourceLabel && tool.sourceLabel !== "Paperclip" ? tool.sourceLabel : undefined;
      // With a concrete subject the row reads like a settled one: "Read u1.txt",
      // "$ npm test" (TaskChatRunnerActivityGroup's tool rows).
      // Settled rows classify by the name alone (TaskChatRunnerActivityGroup).
      const settled = toolActivityPresentation({ name, target });
      if (settled.sentenceSubject && subject && boundedActivity === subject) {
        return {
          icon: settled.icon,
          runningLabel: sentenceRowLabel(settled.runningLabel),
          completedLabel: sentenceRowLabel(settled.completedLabel),
          failedLabel: sentenceRowLabel(settled.failedLabel),
          interruptedLabel: sentenceRowLabel(settled.interruptedLabel),
          detail: [subject, source].filter(Boolean).join(" · "),
        };
      }
      const concrete = Boolean(boundedActivity && (boundedActivity === subject || boundedActivity === meaningfulToolDetail(target)))
        && SUBJECT_FAMILIES.has(settled.family);
      if (concrete) {
        const terminal = settled.family === "terminal";
        return {
          icon: settled.icon,
          runningLabel: subjectRowLabel(settled.runningLabel, false),
          completedLabel: subjectRowLabel(settled.completedLabel, terminal),
          failedLabel: subjectRowLabel(settled.failedLabel, false),
          interruptedLabel: subjectRowLabel(settled.interruptedLabel, false),
          detail: [terminal ? `$ ${boundedActivity}` : boundedActivity, source].filter(Boolean).join(" · "),
        };
      }
      return {
        icon: tool.icon,
        runningLabel: tool.runningLabel,
        completedLabel: tool.completedLabel,
        failedLabel: tool.failedLabel,
        interruptedLabel: tool.interruptedLabel,
        detail: [boundedActivity, source].filter(Boolean).join(" · ") || undefined,
      };
    }
    case "plan_proposal":
      return { icon: FileText, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.writingAPlan"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.proposedAPlan"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.planProposalFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.planProposalStopped"), detail };
    case "plan":
      return { icon: ListChecks, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.updatingThePlan"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.updatedThePlan"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.planUpdateFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.planUpdateStopped"), detail };
    case "delegation": {
      const action = providerDetail(item, "Action")?.toLowerCase();
      if (action === "message") return { icon: Users, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.messagingASubagent"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.messagedASubagent"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.subagentMessageFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.subagentMessageStopped"), detail };
      if (action === "resume") return { icon: Users, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.resumingASubagent"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.resumedASubagent"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.couldntResumeTheSubagent"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.subagentResumeStopped"), detail };
      if (action === "close") return { icon: Users, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.closingASubagent"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.closedASubagent"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.couldntCloseTheSubagent"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.subagentCloseStopped"), detail };
      if (action === "wait") return { icon: Users, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.waitingForSubagents"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.finishedWaitingForSubagents"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.subagentWaitFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.stoppedWaitingForSubagents"), detail };
      return { icon: Users, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.startingASubagent"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.startedASubagent"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.subagentStartFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.subagentStartStopped"), detail };
    }
    case "model_identity":
      return item.eventType === "model.route.changed"
        ? { icon: Bot, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.switchingModels"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.switchedModels"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.modelSwitchFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.modelSwitchStopped"), detail: modelRouteDetail(item) ?? detail }
        : { icon: Bot, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.verifyingTheModel"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.verifiedTheModel"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.modelVerificationFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.modelVerificationStopped"), detail };
    case "context":
      return { icon: Database, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.compactingContext"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.compactedContext"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.contextCompactionFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.contextCompactionStopped"), detail };
    case "artifact": {
      const viewed = item.eventType === "artifact.viewed";
      return viewed
        ? { icon: Box, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.viewingAnArtifact"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.viewedAnArtifact"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.couldntViewTheArtifact"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.artifactViewStopped"), detail }
        : { icon: Box, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.generatingAnArtifact"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.generatedAnArtifact"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.artifactGenerationFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.artifactGenerationStopped"), detail };
    }
    case "review": {
      const state = providerDetail(item, "State")?.toLowerCase();
      return state === "exited"
        ? { icon: FileCheck2, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.leavingReviewMode"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.leftReviewMode"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.couldntLeaveReviewMode"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.reviewModeChangeStopped"), detail }
        : { icon: FileCheck2, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.enteringReviewMode"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.enteredReviewMode"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.couldntEnterReviewMode"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.reviewModeChangeStopped"), detail };
    }
    case "hook":
    case "safety": {
      const governance = governancePresentation(item)!;
      return {
        icon: governance.icon,
        runningLabel: governance.label,
        completedLabel: governance.label,
        failedLabel: governance.label,
        interruptedLabel: governance.label,
        detail: governance.detail,
        tone: governance.tone,
        note: governance.note,
      };
    }
    case "memory":
      return { icon: BookOpen, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.checkingMemory"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.referencedMemory"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.memoryLookupFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.memoryLookupStopped"), detail };
    case "terminal":
      return { icon: TerminalSquare, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.sendingTerminalInput"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.sentTerminalInput"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.terminalInputFailed"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.terminalInputStopped"), detail };
    case "wait": {
      const planned = durationLabel(providerDetail(item, "Planned Duration Ms"));
      const elapsed = durationLabel(providerDetail(item, "Elapsed Duration Ms"));
      return {
        icon: Clock3,
        runningLabel: planned ? t("componentsTaskChatTaskChatActivityPresentation.wait.waitingFor", { duration: planned }) : t("componentsTaskChatTaskChatActivityPresentation.labels.waiting"),
        completedLabel: elapsed ?? planned ? t("componentsTaskChatTaskChatActivityPresentation.wait.waitedFor", { duration: elapsed ?? planned }) : t("componentsTaskChatTaskChatActivityPresentation.labels.finishedWaiting"),
        failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.waitFailed"),
        interruptedLabel: elapsed ? t("componentsTaskChatTaskChatActivityPresentation.wait.stoppedAfter", { duration: elapsed }) : t("componentsTaskChatTaskChatActivityPresentation.labels.waitStopped"),
      };
    }
    case "verification": {
      const status = providerDetail(item, "Status");
      return {
        icon: status === "passed" ? CircleCheck : status === "failed" ? CircleX : CircleDashed,
        runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.runningACheck"),
        completedLabel: status === "not_run" ? t("componentsTaskChatTaskChatActivityPresentation.labels.checkNotRun") : t("componentsTaskChatTaskChatActivityPresentation.labels.checkPassed"),
        failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.checkFailed"),
        interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.checkNotRun"),
        detail: item.summary,
      };
    }
    case "provider_notice":
      return { icon: providerNoticeSeverity(item) === "info" ? Info : AlertTriangle, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.providerNotice"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.providerNotice"), failedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.providerError"), interruptedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.providerNotice"), detail };
  }
}

function workspaceChangePresentation(item: TaskChatWorkspaceChangeItem): TaskChatActivityPresentation {
  const count = item.totals.files || item.files.length;
  const detail = count > 0 ? t("componentsTaskChatTaskChatActivityPresentation.fileCount", { count }) : undefined;
  return { icon: FilePenLine, runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.editingFiles"), completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.editedFiles"), detail };
}

function workspaceFilePresentation(item: TaskChatWorkspaceFileItem): TaskChatActivityPresentation {
  return {
    icon: FileText,
    runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.referencingAFile"),
    completedLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.referencedAFile"),
    detail: item.line == null ? item.path : `${item.path}:${item.line}`,
  };
}

function resourcePresentation(item: TaskChatMaterializedResourceItem): TaskChatActivityPresentation {
  return {
    icon: item.resourceKind === "document" ? FileText : PackageCheck,
    runningLabel: t("componentsTaskChatTaskChatActivityPresentation.labels.savingAResource"),
    completedLabel: item.resourceKind === "document" ? t("componentsTaskChatTaskChatActivityPresentation.labels.addedADocument") : t("componentsTaskChatTaskChatActivityPresentation.labels.addedADeliverable"),
    detail: item.title,
  };
}

export function protocolActivityPresentation(item: TaskChatProtocolItem): TaskChatActivityPresentation | null {
  switch (item.surface) {
    case "provider_activity": return providerActivityPresentation(item);
    case "workspace_change": return workspaceChangePresentation(item);
    case "workspace_file": return workspaceFilePresentation(item);
    case "resource": return resourcePresentation(item);
    case "runtime_request":
    case "run_result":
    case "run_terminal":
      return null;
  }
}

export function protocolActivityIsRunning(item: TaskChatProtocolItem): boolean {
  if (item.surface === "provider_activity") return item.status === "running";
  if (item.surface === "workspace_change") return !item.complete;
  return false;
}

export function protocolActivityLabel(item: TaskChatProtocolItem, presentation: TaskChatActivityPresentation): string {
  if (item.surface !== "provider_activity") {
    return protocolActivityIsRunning(item) ? presentation.runningLabel : presentation.completedLabel;
  }
  if (item.status === "failed") {
    const failed = presentation.failedLabel ?? t("componentsTaskChatTaskChatActivityPresentation.withFailed", { label: presentation.completedLabel });
    return item.retried ? retriedLabel(failed) : failed;
  }
  if (item.status === "interrupted") return presentation.interruptedLabel ?? t("componentsTaskChatTaskChatActivityPresentation.withInterrupted", { label: presentation.completedLabel });
  return item.status === "running" ? presentation.runningLabel : presentation.completedLabel;
}
