import type { RoutineDetail, RoutineTrigger } from "@paperclipai/shared";
import { describeSchedule } from "@/components/ScheduleEditor";
import { t } from "@/i18n";

export type RoutineAutomationState = "active" | "paused" | "draft" | "archived";

/** A routine without a default agent cannot run automatically, whatever its saved status. */
export function routineAutomationState(routine: Pick<RoutineDetail, "status" | "assigneeAgentId">): RoutineAutomationState {
  if (routine.status === "archived") return "archived";
  if (!routine.assigneeAgentId) return "draft";
  return routine.status === "active" ? "active" : "paused";
}

export const ROUTINE_STATE_LABELS: Record<RoutineAutomationState, string> = {
  active: t("componentsRoutinePage.state.active"),
  paused: t("componentsRoutinePage.state.paused"),
  draft: t("componentsRoutinePage.state.draft"),
  archived: t("componentsRoutinePage.state.archived"),
};

/** What a paused or draft routine skips; null when it would not run on its own anyway. */
export function routinePausedNotice({
  state,
  hasWebhooks,
  hasSchedule,
}: {
  state: RoutineAutomationState;
  hasWebhooks: boolean;
  hasSchedule: boolean;
}): string | null {
  if (state !== "paused" && state !== "draft") return null;
  if (hasWebhooks && hasSchedule) return t("componentsRoutinePage.pausedNotice.both");
  if (hasWebhooks) return t("componentsRoutinePage.pausedNotice.webhooks");
  if (hasSchedule) return t("componentsRoutinePage.pausedNotice.schedule");
  return null;
}

/** The line beside the status switch: when the routine runs next, or why it does not. */
export function routineStatusDetail({
  state,
  nextRun,
  hasEnabledWebhook,
  hasStandingCheck,
  now,
}: {
  state: RoutineAutomationState;
  nextRun: Date | null;
  hasEnabledWebhook: boolean;
  hasStandingCheck: boolean;
  now?: Date;
}): string | null {
  if (state === "draft") return null;
  if (state === "archived") return t("componentsRoutinePage.statusDetail.archived");
  if (state === "paused") return t("componentsRoutinePage.statusDetail.paused");
  if (nextRun) return t("componentsRoutinePage.statusDetail.nextRun", { when: formatNextRun(nextRun, now) });
  if (hasEnabledWebhook) return t("componentsRoutinePage.statusDetail.webhook");
  if (hasStandingCheck) return t("componentsRoutinePage.statusDetail.standingCheck");
  return t("componentsRoutinePage.statusDetail.manual");
}

export function nextScheduledRun(triggers: readonly RoutineTrigger[]): Date | null {
  return triggers
    .filter((trigger) => trigger.kind === "schedule" && trigger.enabled && trigger.nextRunAt)
    .map((trigger) => new Date(trigger.nextRunAt as Date))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
}

/** "today at 9:36 AM", "tomorrow at 2:00 PM", otherwise a short dated form. */
export function formatNextRun(date: Date, now: Date = new Date()): string {
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days === 0) return t("componentsRoutinePage.nextRun.today", { time });
  if (days === 1) return t("componentsRoutinePage.nextRun.tomorrow", { time });
  const day = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return t("componentsRoutinePage.nextRun.onDay", { day, time });
}

export function describeScheduleTrigger(trigger: Pick<RoutineTrigger, "cronExpression">): string {
  return trigger.cronExpression ? describeSchedule(trigger.cronExpression) : t("componentsRoutinePage.scheduleFallback");
}

export function webhookTitle(trigger: Pick<RoutineTrigger, "signingMode" | "label">): string {
  const kind = trigger.signingMode === "github_hmac" ? t("componentsRoutinePage.webhook.github") : t("componentsRoutinePage.webhook.generic");
  return trigger.label ? `${kind} · ${trigger.label}` : kind;
}

export type WebhookHealth = "setup" | "testing" | "paused" | "rejected" | "receiving" | "waiting";

/** A webhook that went live before and was put back into test mode (it has a real delivery on record). */
export function webhookRetesting(trigger: Pick<RoutineTrigger, "setupPending" | "lastWebhookDelivery">): boolean {
  const delivery = trigger.lastWebhookDelivery;
  if (!trigger.setupPending || !delivery) return false;
  return delivery.test ? delivery.previous != null : true;
}

export function webhookHealth(trigger: RoutineTrigger): WebhookHealth {
  if (trigger.setupPending) return webhookRetesting(trigger) ? "testing" : "setup";
  if (!trigger.enabled) return "paused";
  if (trigger.lastWebhookDelivery?.status === "rejected") return "rejected";
  if (trigger.lastWebhookDelivery?.status === "received" && !trigger.lastWebhookDelivery.test) return "receiving";
  return "waiting";
}

export const WEBHOOK_HEALTH_LABELS: Record<WebhookHealth, string> = {
  setup: t("componentsRoutinePage.webhookHealth.setup"),
  testing: t("componentsRoutinePage.webhookHealth.testing"),
  paused: t("componentsRoutinePage.webhookHealth.paused"),
  rejected: t("componentsRoutinePage.webhookHealth.rejected"),
  receiving: t("componentsRoutinePage.webhookHealth.receiving"),
  waiting: t("componentsRoutinePage.webhookHealth.waiting"),
};

/** Which status the webhook dialog shows; each key has one entry in WEBHOOK_STATUS_COPY. */
export type WebhookStatusKey =
  | WebhookHealth
  | "setup_testing"
  | "test_received"
  | "test_rejected"
  | "ignored_while_paused";

export function webhookStatusKey(
  trigger: RoutineTrigger,
  { routineActive, testing }: { routineActive: boolean; testing: boolean },
): WebhookStatusKey {
  const health = webhookHealth(trigger);
  // Only test deliveries count: a webhook put back into test mode still carries its last real delivery.
  const testDelivery = trigger.setupPending && trigger.lastWebhookDelivery?.test ? trigger.lastWebhookDelivery : null;
  if (testDelivery?.status === "received") return "test_received";
  if (testDelivery?.status === "rejected") return "test_rejected";
  if (!routineActive && health !== "setup" && health !== "testing") return "ignored_while_paused";
  if (health === "setup" && testing) return "setup_testing";
  return health;
}

export const WEBHOOK_STATUS_COPY: Record<WebhookStatusKey, { title: string; detail: string }> = {
  setup: { title: t("componentsRoutinePage.webhookStatus.setup.title"), detail: t("componentsRoutinePage.webhookStatus.setup.detail") },
  setup_testing: {
    title: t("componentsRoutinePage.webhookStatus.setupTesting.title"),
    detail: t("componentsRoutinePage.webhookStatus.setupTesting.detail"),
  },
  testing: {
    title: t("componentsRoutinePage.webhookStatus.testing.title"),
    detail: t("componentsRoutinePage.webhookStatus.testing.detail"),
  },
  waiting: { title: t("componentsRoutinePage.webhookStatus.waiting.title"), detail: t("componentsRoutinePage.webhookStatus.waiting.detail") },
  receiving: { title: t("componentsRoutinePage.webhookStatus.receiving.title"), detail: t("componentsRoutinePage.webhookStatus.receiving.detail") },
  rejected: {
    title: t("componentsRoutinePage.webhookStatus.rejected.title"),
    detail: t("componentsRoutinePage.webhookStatus.rejected.detail"),
  },
  test_rejected: {
    title: t("componentsRoutinePage.webhookStatus.rejected.title"),
    detail: t("componentsRoutinePage.webhookStatus.rejected.detail"),
  },
  test_received: { title: t("componentsRoutinePage.webhookStatus.testReceived.title"), detail: t("componentsRoutinePage.webhookStatus.testReceived.detail") },
  ignored_while_paused: {
    title: t("componentsRoutinePage.webhookStatus.ignoredWhilePaused.title"),
    detail: t("componentsRoutinePage.webhookStatus.ignoredWhilePaused.detail"),
  },
  paused: { title: t("componentsRoutinePage.webhookStatus.paused.title"), detail: t("componentsRoutinePage.webhookStatus.paused.detail") },
};

/** Plain-language lines for saved run rules that differ from the defaults. Empty for most routines. */
export function customRunRules(
  routine: Pick<RoutineDetail, "concurrencyPolicy" | "catchUpPolicy" | "activityGatePolicy" | "activityGateScope">,
): string[] {
  const rules: string[] = [];
  if (routine.concurrencyPolicy === "always_enqueue") rules.push(t("componentsRoutinePage.runRules.alwaysEnqueue"));
  if (routine.concurrencyPolicy === "skip_if_active") rules.push(t("componentsRoutinePage.runRules.skipIfActive"));
  if (routine.catchUpPolicy === "enqueue_missed_with_cap") rules.push(t("componentsRoutinePage.runRules.catchUp"));
  if (routine.activityGatePolicy === "require_external_activity") {
    rules.push(
      routine.activityGateScope === "project"
        ? t("componentsRoutinePage.runRules.activityGateProject")
        : t("componentsRoutinePage.runRules.activityGate"),
    );
  }
  return rules;
}

/** First paragraph of the instructions; a leading heading keeps the paragraph under it. */
export function instructionsPreview(markdown: string): { preview: string; truncated: boolean } {
  const blocks = markdown.trim().split(/\n\s*\n/);
  if (blocks.length <= 1) return { preview: markdown.trim(), truncated: false };
  const take = /^#{1,6}\s/.test(blocks[0] ?? "") ? 2 : 1;
  return { preview: blocks.slice(0, take).join("\n\n"), truncated: blocks.length > take };
}
