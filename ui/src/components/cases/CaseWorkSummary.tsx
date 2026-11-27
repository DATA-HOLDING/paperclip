import { Clock3 } from "lucide-react";
import type { CaseDetail, CaseHandoffView } from "@/api/cases";
import { AgentIdentity } from "@/components/AgentIdentity";
import type { AvatarAgent } from "@/components/AgentAvatar";
import { IssueReferencePill } from "@/components/IssueReferencePill";
import { IssueStatusBadge } from "@/components/StatusBadge";
import { PropertyRow } from "@/components/issue-properties/primitives";
import { taskStatusIconProps } from "@/lib/task-status-presentation";
import { t } from "@/i18n";

export type CaseAgentMap = ReadonlyMap<string, AvatarAgent & { status?: string }>;

export function CaseWorkSummary({ caseData, pendingHandoff, agents }: {
  caseData: CaseDetail;
  pendingHandoff?: CaseHandoffView | null;
  agents?: CaseAgentMap;
}) {
  const task = caseData.workIssue;
  const pending = pendingHandoff === undefined ? caseData.pendingHandoff : pendingHandoff;
  const assignee = task?.assigneeAgentId ? agents?.get(task.assigneeAgentId) ?? {
    id: task.assigneeAgentId,
    name: task.assigneeAgentName ?? t("componentsCases.work.agent"),
  } : null;
  const from = pending?.fromAgentId ? agents?.get(pending.fromAgentId)?.name ?? pending.fromAgentName ?? t("componentsCases.work.previousAgent") : t("componentsCases.work.previousAgent");
  const to = pending ? (pending.toAgentId ? agents?.get(pending.toAgentId)?.name : null) ?? pending.toAgentName ?? t("componentsCases.work.receivingAgent") : null;
  const destination = pending?.toAgentId ? agents?.get(pending.toAgentId) : null;
  const waiting = pending?.destinationKind === "done" ? t("componentsCases.work.willClose") : pending?.lastError
    ?? (pending?.state === "awaiting_release" ? t("componentsCases.work.waitingToFinish", { name: from })
      : destination?.status === "paused" ? t("componentsCases.work.paused", { name: to }) : t("componentsCases.work.waitingToStart", { name: to }));

  return <section className="space-y-3" aria-label={t("componentsCases.work.ariaLabel")}>
    <h2 className="text-sm font-semibold">{t("componentsCases.work.title")}</h2>
    {caseData.workIssueId ? <div className="space-y-3">
      {task ? <div>
        <PropertyRow label={t("componentsCases.work.task")}><IssueReferencePill issue={task} className="min-h-11 md:min-h-0" /></PropertyRow>
        <PropertyRow label={t("componentsCases.work.workflow")}><span className="text-sm">{caseData.workflow?.name ?? t("componentsCases.work.caseInstructions")}</span></PropertyRow>
        {caseData.phase && <PropertyRow label={t("componentsCases.work.phase")}><span className="text-sm">{caseData.phase}</span></PropertyRow>}
        <PropertyRow label={t("componentsCases.work.agent")}>{assignee ? <AgentIdentity agent={assignee} size="xs" /> : <span className="text-sm text-muted-foreground">{t("componentsCases.work.unassigned")}</span>}</PropertyRow>
        <PropertyRow label={t("componentsCases.work.taskStatus")}><IssueStatusBadge {...taskStatusIconProps(task)} /></PropertyRow>
      </div> : <p className="text-sm text-muted-foreground">{t("componentsCases.work.primaryUnavailable")}</p>}
      {pending && pending.state !== "delivered" && pending.state !== "completed" && pending.state !== "cancelled" && <div className="flex items-start gap-2 text-sm">
        <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          {pending.state === "awaiting_release" && <p>{t("componentsCases.work.next", { name: pending.workflowTransition?.to.name ?? t("componentsCases.work.caseInstructions"), phase: pending.phase })}</p>}
          <p className="text-xs leading-relaxed text-muted-foreground">{waiting}</p>
        </div>
      </div>}
    </div> : <p className="text-sm text-muted-foreground">{t("componentsCases.work.noTaskLinked")}</p>}
  </section>;
}
