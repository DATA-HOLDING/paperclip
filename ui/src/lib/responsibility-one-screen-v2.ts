import { t } from "@/i18n";
import type {
  ResponsibilityProjectSummary,
  ResponsibilityRecentRun,
  ResponsibilityRoutineSummary,
  ResponsibilityTaskSummary,
} from "@paperclipai/shared";
import { isTerminalTaskStatus, localDateKey } from "./responsibilities";

/**
 * The one fact each row of the "One screen v2" responsibility tables shows
 * (experimental, `enableResponsibilities`), in plain words.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

/** "just now", "5m ago", "8h ago", "2d ago", "3w ago", "2mo ago", against `now`. */
export function ago(at: Date | string, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - new Date(at).getTime());
  if (elapsed < MINUTE) return t("libResponsibilityOneScreenV2.ago.justNow");
  if (elapsed < HOUR) return t("libResponsibilityOneScreenV2.ago.minutes", { count: Math.floor(elapsed / MINUTE) });
  if (elapsed < DAY) return t("libResponsibilityOneScreenV2.ago.hours", { count: Math.floor(elapsed / HOUR) });
  if (elapsed < WEEK) return t("libResponsibilityOneScreenV2.ago.days", { count: Math.floor(elapsed / DAY) });
  if (elapsed < MONTH) return t("libResponsibilityOneScreenV2.ago.weeks", { count: Math.floor(elapsed / WEEK) });
  return t("libResponsibilityOneScreenV2.ago.months", { count: Math.floor(elapsed / MONTH) });
}

/** "Paused", "Not run yet", "Last successful run 8h ago", "Failed 2d ago", "Running, started 3h ago". */
export function routineStat(routine: Pick<ResponsibilityRoutineSummary, "status" | "lastRun">, now: Date): string {
  if (routine.status === "paused") return t("libResponsibilityOneScreenV2.routine.paused");
  const run = routine.lastRun;
  if (!run) return t("libResponsibilityOneScreenV2.routine.notRunYet");
  const when = ago(run.at, now);
  if (run.outcome === "succeeded") return t("libResponsibilityOneScreenV2.routine.lastSuccessfulRun", { when });
  if (run.outcome === "failed") return t("libResponsibilityOneScreenV2.routine.failed", { when });
  return t("libResponsibilityOneScreenV2.routine.running", { when });
}

/** Whole calendar days from today (local) to a `YYYY-MM-DD` date; negative once it has passed. */
function daysUntil(date: string, now: Date): number | null {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  const [todayYear, todayMonth, todayDay] = localDateKey(now).split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(todayYear!, todayMonth! - 1, todayDay!)) / DAY);
}

/** "Due in 14 days", "Due tomorrow", "Due today", "1 day late", "5 days late"; null without a date. */
export function projectDueStat(project: Pick<ResponsibilityProjectSummary, "targetDate">, now: Date): string | null {
  if (!project.targetDate) return null;
  const days = daysUntil(project.targetDate, now);
  if (days === null) return null;
  if (days === 0) return t("libResponsibilityOneScreenV2.due.today");
  if (days === 1) return t("libResponsibilityOneScreenV2.due.tomorrow");
  if (days > 1) return t("libResponsibilityOneScreenV2.due.inDays", { count: days });
  return days === -1 ? t("libResponsibilityOneScreenV2.due.oneDayLate") : t("libResponsibilityOneScreenV2.due.daysLate", { count: -days });
}

/** "4 of 10 tasks done", for the progress meter's words. */
export function projectProgressLabel(progress: NonNullable<ResponsibilityProjectSummary["progress"]>): string {
  return t("libResponsibilityOneScreenV2.progress", { count: progress.total, done: progress.done, total: progress.total });
}

/** Open tasks in the order given, and the done ones the table can reveal (cancelled ones are not shown). */
export function splitTasksForTable(tasks: readonly ResponsibilityTaskSummary[]): {
  open: ResponsibilityTaskSummary[];
  done: ResponsibilityTaskSummary[];
} {
  return {
    open: tasks.filter((task) => !isTerminalTaskStatus(task.status)),
    done: tasks.filter((task) => task.status === "done"),
  };
}

const RUN_ENDED: Record<string, string> = {
  succeeded: t("libResponsibilityOneScreenV2.runEnded.succeeded"),
  failed: t("libResponsibilityOneScreenV2.runEnded.failed"),
  cancelled: t("libResponsibilityOneScreenV2.runEnded.cancelled"),
  timed_out: t("libResponsibilityOneScreenV2.runEnded.timedOut"),
};

/** "Succeeded 1d ago", "Failed 2d ago", "Running, started 3m ago", "Queued 3m ago". */
export function runStat(run: Pick<ResponsibilityRecentRun, "status" | "createdAt" | "startedAt" | "finishedAt">, now: Date): string {
  if (run.status === "running") return t("libResponsibilityOneScreenV2.routine.running", { when: ago(run.startedAt ?? run.createdAt, now) });
  if (run.status === "queued") return t("libResponsibilityOneScreenV2.run.queued", { when: ago(run.createdAt, now) });
  const word = RUN_ENDED[run.status] ?? `${run.status.charAt(0).toUpperCase()}${run.status.slice(1).replace(/_/g, " ")}`;
  return t("libResponsibilityOneScreenV2.run.ended", { word, when: ago(run.finishedAt ?? run.startedAt ?? run.createdAt, now) });
}
