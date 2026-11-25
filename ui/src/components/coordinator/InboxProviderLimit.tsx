import type { ReactNode } from "react";
import type { AttentionItem, AttentionProviderLimit } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { t } from "@/i18n";

function RetryStatus({ limit }: { limit: AttentionProviderLimit }) {
  if (limit.state === "needs_retry") return t("componentsCoordinator.providerLimit.needsRetry");
  if (limit.state === "retry_requested") return t("componentsCoordinator.providerLimit.retryRequested");
  return <>{t("componentsCoordinator.providerLimit.retryScheduled")}
    {limit.retryAt && <>{t("componentsCoordinator.providerLimit.retryScheduledFor")}<time dateTime={limit.retryAt}>{formatDateTime(limit.retryAt)}</time></>}
  </>;
}

/** This disclosure has no dismissal or retry action. Both belong to the child cards. */
export function InboxLimitCards({ items, renderCard }: {
  items: readonly AttentionItem[];
  renderCard: (item: AttentionItem) => ReactNode;
}) {
  const chains = items.filter(item => item.providerLimit?.grouping === "retry_chain" && item.relatedIssue);
  const taskCount = new Set(chains.map(item => item.relatedIssue!.id)).size;
  if (taskCount < 2) return items.map(renderCard);
  const grouped = new Set(chains);
  return items.map(item => {
    if (!grouped.has(item)) return renderCard(item);
    if (item !== chains[0]) return null;
    return <details key="usage-limits" className="coordinator-decision-card">
      <summary className="cursor-pointer font-medium">{t("componentsCoordinator.providerLimit.tasksHitLimits", { count: taskCount })}</summary>
      <div className="mt-3 space-y-3">{chains.map(renderCard)}</div>
    </details>;
  });
}

export function InboxProviderLimit({ item, evidence }: { item: AttentionItem; evidence: readonly AttentionItem[] }) {
  const state = item.providerLimit!;
  if (state.grouping === "retry_chain" && item.relatedIssue) {
    const task = item.relatedIssue;
    return <div className="space-y-2">
      <h2><Link to={task.href!}>{task.identifier} {task.title}</Link></h2>
      <p className="text-sm"><RetryStatus limit={state} /></p>
      <p className="text-sm text-muted-foreground">{t("componentsCoordinator.providerLimit.attempts", { count: state.attempts })} · {state.resetAt
        ? <>{t("componentsCoordinator.providerLimit.providerResetAt")}<time dateTime={state.resetAt}>{formatDateTime(state.resetAt)}</time></>
        : t("componentsCoordinator.providerLimit.resetUnknown")}</p>
      <div className="flex flex-wrap items-center gap-3">
        {state.state === "needs_retry" && <Button size="sm" asChild><Link to={task.href!}>{t("componentsCoordinator.providerLimit.openTaskToRetry")}</Link></Button>}
        <Link to={`/agents/${state.agentId}/runs/${state.runId}`} className="text-sm underline">{t("componentsCoordinator.providerLimit.agentRunLog", { agent: state.agentName })}</Link>
      </div>
    </div>;
  }
  const members = [item, ...evidence].filter(member => member.providerLimit && member.relatedIssue);
  const tasks = [...new Map(members.map(member => [member.relatedIssue!.id, member])).values()];
  const manual = tasks.filter(task => task.providerLimit!.state === "needs_retry");
  const title = manual.length
    ? t("componentsCoordinator.providerLimit.titleNeedRetry", { count: manual.length })
    : t("componentsCoordinator.providerLimit.titlePaused", { count: tasks.length });
  const taskLabel = (count: number) => t("componentsCoordinator.providerLimit.taskWord", { count });
  const scheduled = tasks.filter(task => task.providerLimit!.state === "scheduled");
  const firstRetry = scheduled[0]?.providerLimit?.retryAt;
  const sharedRetryAt = firstRetry && scheduled.every(task => task.providerLimit!.retryAt === firstRetry) ? firstRetry : null;
  return <div className="space-y-3">
    <h2>{title}</h2>
    {state.resetAt && <p className="text-sm text-muted-foreground">{t("componentsCoordinator.providerLimit.providerResetAt")}<time dateTime={state.resetAt}>{formatDateTime(state.resetAt)}</time>.</p>}
    {scheduled.length > 0 && <p className="text-sm text-muted-foreground">{t("componentsCoordinator.providerLimit.retryScheduledForCount", { count: scheduled.length, tasks: taskLabel(scheduled.length) })}
      {sharedRetryAt && <>{t("componentsCoordinator.providerLimit.at")}<time dateTime={sharedRetryAt}>{formatDateTime(sharedRetryAt)}</time></>}.
    </p>}
    {!scheduled.length && !manual.length && <p className="text-sm text-muted-foreground">{t("componentsCoordinator.providerLimit.retryRequestedWaiting")}</p>}
    {manual.length > 0 && <p className="text-sm text-muted-foreground">{t("componentsCoordinator.providerLimit.openAffected")}</p>}
    <details><summary className="cursor-pointer text-sm">{t("componentsCoordinator.providerLimit.viewTasks", { count: tasks.length, tasks: taskLabel(tasks.length) })}</summary>
      <ul className="mt-2 space-y-2">{tasks.map(member => {
        const task = member.relatedIssue!;
        const limit = member.providerLimit!;
        return <li key={task.id} className="flex flex-wrap items-center gap-2 text-sm">
          <Link to={task.href!} className="underline">{task.identifier} {task.title}</Link>
          <span>{limit.agentName} · <RetryStatus limit={limit} /></span>
          <Link to={`/agents/${limit.agentId}/runs/${limit.runId}`} className="underline">{t("componentsCoordinator.providerLimit.runLog")}</Link>
        </li>;
      })}</ul>
    </details>
    {manual.length === 1 && <Button size="sm" asChild><Link to={manual[0]!.relatedIssue!.href!}>{t("componentsCoordinator.providerLimit.openTaskToRetry")}</Link></Button>}
  </div>;
}
