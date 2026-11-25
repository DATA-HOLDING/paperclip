import { useMemo, useState } from "react";
import { Clock, X } from "lucide-react";
import type { Issue, IssueWorkProduct } from "@paperclipai/shared";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { InlineBanner } from "@/components/InlineBanner";
import { IssuePullRequestLinks } from "@/components/IssuePullRequestLinks";
import { getIssuePullRequests, pullRequestNeedsReview } from "@/lib/issue-pull-requests";
import { cn } from "@/lib/utils";
import {
  areAutomaticMonitorChecksPaused,
  canCheckIssueMonitorNow,
  deriveMonitorState,
  formatMonitorAbsolute,
  formatMonitorEta,
  useMonitorCountdown,
  type DerivedMonitorState,
  type MonitorDisplayState,
} from "@/lib/issue-monitor";
import { t } from "@/i18n";

/** Matches the `Date | string` inputs accepted by the issue-monitor helpers. */
type MonitorDate = Date | string;

/**
 * States in which the waiting-monitor surfaces (top banner + composer strip)
 * are shown. `cleared` and `none` hide both surfaces entirely — see
 * wireframe 04 (PAP-14557).
 */
const WAITING_STATES: readonly MonitorDisplayState[] = [
  "scheduled",
  "retrying",
  "due-now",
  "overdue",
];

export function isWaitingMonitorState(state: MonitorDisplayState): boolean {
  return WAITING_STATES.includes(state);
}

export function hasVisibleMonitorSurface(issue: Issue): boolean {
  const derived = deriveMonitorState(issue);
  return isWaitingMonitorState(derived.state) && derived.nextCheckAt !== null;
}

export interface MonitorSurfaceCopy {
  /** Prominent lead for the top banner, e.g. "Waiting on monitor — resumes in 2h 12m". */
  bannerTitle: string;
  /** Prominent lead for the composer strip, e.g. "Resumes in 2h 12m". */
  stripTitle: string;
  /** Muted detail line for the banner (absolute time carries a "(your time)" hint). */
  bannerMeta: string[];
  /** Muted detail line for the composer strip. */
  stripMeta: string[];
  /** `warning` (amber) once overdue, `info` (blue) while still on schedule. */
  tone: "info" | "warning";
  workspaceWait?: boolean;
  pullRequestReview?: boolean;
  automaticChecksPaused?: boolean;
  checkUnavailable?: boolean;
  executionWait?: boolean;
  /** Waiting for AI account usage; a reply rechecks usage instead of starting work outright. */
  usageWait?: boolean;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

/**
 * Pure copy builder shared by the banner and the composer strip so both
 * surfaces render one consistent copy system (see wireframe 04). Kept free of
 * hooks/`Date.now()` so it is deterministic under test.
 */
export function buildMonitorSurfaceCopy(
  derived: DerivedMonitorState,
  now: MonitorDate,
  scheduledRetryReason?: string | null,
  pendingPullRequestReviews = 0,
  issueStatus?: string,
  hasActiveRun = false,
): MonitorSurfaceCopy | null {
  if (!isWaitingMonitorState(derived.state) || !derived.nextCheckAt) return null;

  if (derived.source === "monitor" && areAutomaticMonitorChecksPaused({ status: issueStatus })) {
    const canCheckNow = canCheckIssueMonitorNow({ status: issueStatus }, derived.serviceName);
    const hint = canCheckNow
      ? t("componentsIssueMonitorBanner.paused.canCheckHint")
      : t("componentsIssueMonitorBanner.paused.resumeHint");
    return {
      bannerTitle: t("componentsIssueMonitorBanner.paused.title"),
      stripTitle: t("componentsIssueMonitorBanner.paused.title"),
      bannerMeta: [hint],
      stripMeta: [hint],
      tone: "info",
      automaticChecksPaused: true,
      checkUnavailable: !canCheckNow,
    };
  }

  if (derived.source === "scheduled-retry" && scheduledRetryReason === "environment_provider_wait") {
    return {
      bannerTitle: t("componentsIssueMonitorBanner.provider.title"),
      stripTitle: t("componentsIssueMonitorBanner.provider.title"),
      bannerMeta: [t("componentsIssueMonitorBanner.provider.bannerMeta")],
      stripMeta: [t("componentsIssueMonitorBanner.provider.stripMeta")],
      tone: "info",
      workspaceWait: true,
    };
  }

  if (derived.source === "scheduled-retry" && scheduledRetryReason === "workspace_busy") {
    return {
      bannerTitle: t("componentsIssueMonitorBanner.workspace.title"),
      stripTitle: t("componentsIssueMonitorBanner.workspace.title"),
      bannerMeta: [t("componentsIssueMonitorBanner.workspace.bannerMeta")],
      stripMeta: [t("componentsIssueMonitorBanner.workspace.stripMeta")],
      tone: "info",
      workspaceWait: true,
    };
  }

  const eta = formatMonitorEta(derived.nextCheckAt, now); // "in 2h 12m" | "due now" | "overdue by 18m"
  const absolute = formatMonitorAbsolute(derived.nextCheckAt, {}, now); // local time, e.g. "Today, 4:08 PM"
  const awaitingPullRequestReview = derived.source === "monitor" && derived.serviceName?.toLowerCase() === "github" && pendingPullRequestReviews > 0;
  if (derived.source === "monitor" && hasActiveRun) {
    const hint = t("componentsIssueMonitorBanner.executionWait.hint");
    return {
      bannerTitle: t("componentsIssueMonitorBanner.executionWait.title"),
      stripTitle: t("componentsIssueMonitorBanner.executionWait.title"),
      bannerMeta: [hint, t("componentsIssueMonitorBanner.executionWait.scheduledYourTime", { absolute })],
      stripMeta: [hint, t("componentsIssueMonitorBanner.executionWait.scheduled", { absolute })],
      tone: "info",
      executionWait: true,
      checkUnavailable: true,
      pullRequestReview: awaitingPullRequestReview,
    };
  }
  if (awaitingPullRequestReview) {
    return {
      bannerTitle: t("componentsIssueMonitorBanner.review.title"),
      stripTitle: t("componentsIssueMonitorBanner.review.title"),
      bannerMeta: [t("componentsIssueMonitorBanner.review.nextCheckYourTime", { eta, absolute })],
      stripMeta: [t("componentsIssueMonitorBanner.review.nextCheck", { eta, absolute })],
      tone: derived.state === "overdue" ? "warning" : "info",
      pullRequestReview: true,
    };
  }
  if (derived.source === "scheduled-retry" && scheduledRetryReason === "ai_connection_pool_wait") {
    return {
      bannerTitle: t("componentsIssueMonitorBanner.pool.title"),
      stripTitle: t("componentsIssueMonitorBanner.pool.title"),
      bannerMeta: [t("componentsIssueMonitorBanner.pool.recheckYourTime", { eta, absolute }), t("componentsIssueMonitorBanner.pool.bannerHint")],
      stripMeta: [t("componentsIssueMonitorBanner.pool.recheck", { eta, absolute }), t("componentsIssueMonitorBanner.pool.stripHint")],
      tone: "info",
      usageWait: true,
    };
  }

  const isScheduledRetryOnly = derived.source === "scheduled-retry";

  let bannerTitle: string;
  let stripTitle: string;
  let statusHint: string | null = null;
  switch (derived.state) {
    case "scheduled":
    case "retrying":
      bannerTitle = isScheduledRetryOnly ? t("componentsIssueMonitorBanner.state.agentResumes", { eta }) : t("componentsIssueMonitorBanner.state.waitingResumes", { eta });
      stripTitle = t("componentsIssueMonitorBanner.state.resumes", { eta });
      break;
    case "due-now":
      bannerTitle = isScheduledRetryOnly ? t("componentsIssueMonitorBanner.state.agentRetryDueNow") : t("componentsIssueMonitorBanner.state.waitingDueNow");
      stripTitle = t("componentsIssueMonitorBanner.state.dueNow");
      statusHint = t("componentsIssueMonitorBanner.state.checkingMomentarily");
      break;
    case "overdue":
    default:
      bannerTitle = isScheduledRetryOnly ? t("componentsIssueMonitorBanner.state.agentRetry", { eta }) : t("componentsIssueMonitorBanner.state.waiting", { eta });
      stripTitle = capitalize(eta);
      statusHint = t("componentsIssueMonitorBanner.state.firesNextTick");
      break;
  }

  const attemptLabel = derived.attemptCount >= 1 ? t("componentsIssueMonitorBanner.meta.attempt", { count: derived.attemptCount }) : null;
  const serviceLabel = derived.serviceName ? t("componentsIssueMonitorBanner.meta.watching", { service: derived.serviceName }) : null;

  const bannerMeta = [statusHint, t("componentsIssueMonitorBanner.meta.yourTime", { absolute }), attemptLabel, serviceLabel].filter(
    (piece): piece is string => Boolean(piece),
  );
  const stripMeta = [statusHint, absolute, attemptLabel, serviceLabel].filter(
    (piece): piece is string => Boolean(piece),
  );

  return {
    bannerTitle,
    stripTitle,
    bannerMeta,
    stripMeta,
    tone: derived.state === "overdue" ? "warning" : "info",
  };
}

function useMonitorSurfaceCopy(issue: Issue, pendingPullRequestReviews: number, hasActiveRun: boolean): MonitorSurfaceCopy | null {
  // `nextCheckAt` is stable for a given issue; derive once to seed the ticking
  // countdown cadence, then re-derive against the live clock so the surfaces
  // roll scheduled → due → overdue on their own.
  const nextCheckAt = useMemo(() => {
    const derived = deriveMonitorState(issue);
    return derived.source === "monitor" && areAutomaticMonitorChecksPaused(issue) ? null : derived.nextCheckAt;
  }, [issue]);
  const now = useMonitorCountdown(nextCheckAt);
  return useMemo(() => buildMonitorSurfaceCopy(deriveMonitorState(issue, now), now, issue.scheduledRetry?.scheduledRetryReason, pendingPullRequestReviews, issue.status, hasActiveRun), [issue, now, pendingPullRequestReviews, hasActiveRun]);
}

function CheckNowButton({
  onCheckNow,
  checkingNow,
  reviewRequested = false,
}: {
  onCheckNow: () => void;
  checkingNow: boolean;
  reviewRequested?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 shadow-none"
      onClick={onCheckNow}
      disabled={checkingNow}
    >
      {checkingNow ? t("componentsIssueMonitorBanner.actions.checking") : reviewRequested ? t("componentsIssueMonitorBanner.actions.checkStatus") : t("componentsIssueMonitorBanner.actions.checkNow")}
    </Button>
  );
}

function CancelMonitorButton({ onCancel }: { onCancel: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = async () => {
    setPending(true);
    setError(null);
    try {
      await onCancel();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("componentsIssueMonitorBanner.cancel.failed"));
    } finally {
      setPending(false);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); setError(null); } }}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2" aria-label={t("componentsIssueMonitorBanner.cancel.button")} title={t("componentsIssueMonitorBanner.cancel.button")}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("componentsIssueMonitorBanner.cancel.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("componentsIssueMonitorBanner.cancel.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("componentsIssueMonitorBanner.cancel.keep")}</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => void cancel()}>{pending ? t("componentsIssueMonitorBanner.cancel.cancelling") : t("componentsIssueMonitorBanner.cancel.button")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface IssueMonitorSurfaceProps {
  issue: Issue;
  hasActiveRun?: boolean;
  onCheckNow?: (() => void) | null;
  checkingNow?: boolean;
  workProducts?: IssueWorkProduct[] | null;
  checkError?: string | null;
  onCancelMonitor?: (() => Promise<unknown>) | null;
}

/**
 * Pinned banner rendered between the issue title and description while a
 * monitor is waiting. Replaces the description-area "Monitor scheduled" card
 * for the waiting state (PAP-14557 decision 1) — the two never render at once.
 */
export function IssueMonitorBanner({
  issue,
  hasActiveRun = false,
  onCheckNow = null,
  checkingNow = false,
  workProducts,
  checkError,
  onCancelMonitor,
}: IssueMonitorSurfaceProps) {
  const reviews = getIssuePullRequests(workProducts).filter(pullRequestNeedsReview);
  const copy = useMonitorSurfaceCopy(issue, reviews.length, hasActiveRun);
  if (!copy) return null;

  // A busy workspace is a transient system wait the user cannot act on. It stays
  // a quiet status (composer strip, properties row), never a pinned notice.
  if (copy.workspaceWait) return null;

  const canCancel = onCancelMonitor && deriveMonitorState(issue).source === "monitor";

  return (
    <InlineBanner
      tone={copy.tone}
      icon={Clock}
      title={copy.bannerTitle}
      className={cn("relative my-3", canCancel && "pr-12")}
      actions={onCheckNow && !copy.workspaceWait && !copy.checkUnavailable ? <CheckNowButton onCheckNow={onCheckNow} checkingNow={checkingNow} reviewRequested={copy.pullRequestReview} /> : null}
    >
      {canCancel ? <CancelMonitorButton key={issue.id} onCancel={onCancelMonitor} /> : null}
      <div className="flex flex-col gap-2">
        {copy.pullRequestReview ? <IssuePullRequestLinks products={reviews} /> : null}
        <span>{copy.bannerMeta.join("  ·  ")}</span>
        {checkError ? <p role="alert">{checkError}</p> : null}
      </div>
    </InlineBanner>
  );
}

/**
 * Slim, inline (not sticky) strip anchored directly above the reply composer.
 * Mirrors the banner's monitor state and reminds the reader that replying wakes
 * the agent early (PAP-14557 decisions 2 + wireframe 02).
 */
export function IssueMonitorComposerStrip({
  issue,
  hasActiveRun = false,
  onCheckNow = null,
  checkingNow = false,
  workProducts,
  checkError,
  className,
}: IssueMonitorSurfaceProps & { className?: string }) {
  const reviews = getIssuePullRequests(workProducts).filter(pullRequestNeedsReview);
  const copy = useMonitorSurfaceCopy(issue, reviews.length, hasActiveRun);
  if (!copy) return null;

  return (
    <div
      role="note"
      data-testid="issue-monitor-composer-strip"
      className={cn("rounded-lg border border-border bg-muted/30 px-3 py-2", className)}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Clock className={cn("mt-0.5 h-4 w-4 shrink-0", issue.displayStatus === "monitoring" ? "text-(--status-task-icon-monitoring)" : "text-muted-foreground")} aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="text-sm font-medium text-foreground">{copy.stripTitle}</div>
            {copy.pullRequestReview ? <IssuePullRequestLinks products={reviews} /> : null}
            <div className="text-xs text-muted-foreground">{copy.stripMeta.join(" · ")}</div>
          </div>
        </div>
        {onCheckNow && !copy.workspaceWait && !copy.checkUnavailable ? <CheckNowButton onCheckNow={onCheckNow} checkingNow={checkingNow} reviewRequested={copy.pullRequestReview} /> : null}
      </div>
      {!copy.automaticChecksPaused ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {copy.pullRequestReview && copy.executionWait
            ? t("componentsIssueMonitorBanner.footer.reviewWhileRun")
            : copy.pullRequestReview
            ? t("componentsIssueMonitorBanner.footer.reviewThenCheck")
            : copy.workspaceWait || copy.executionWait
            ? t("componentsIssueMonitorBanner.footer.keepSending")
            : copy.usageWait
            ? t("componentsIssueMonitorBanner.footer.usageWait")
            : t("componentsIssueMonitorBanner.footer.wakesNow")}
        </p>
      ) : null}
      {checkError ? <p role="alert" className="text-sm text-destructive">{checkError}</p> : null}
    </div>
  );
}
