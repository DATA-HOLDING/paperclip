import type { StatusCard, StatusCardRefreshPolicy } from "@paperclipai/shared";
import { t } from "@/i18n";

/**
 * The lifecycle states a status card renders as on the board (plan §7,
 * wireframe `07-card-states.svg`). Derived from the stored `status_cards` row:
 * the persisted `state` enum plus `archivedAt`, `generatingIssueId` and
 * `pendingChangeCount`. Kept in one place so the board tile, detail drawer and
 * tests agree on the mapping.
 */
export type StatusCardLifecycle =
  | "compiling"
  | "fresh"
  | "stale"
  | "updating"
  | "error"
  | "paused_budget"
  | "paused_hours"
  | "archived";

/**
 * Map a card row to its display lifecycle. Precedence, highest first:
 * archived → compiling → error → paused → updating (a run is in flight) →
 * stale (pending changes) → fresh.
 */
export function deriveStatusCardLifecycle(
  card: Pick<StatusCard, "state" | "archivedAt" | "generatingIssueId" | "pendingChangeCount">,
): StatusCardLifecycle {
  if (card.archivedAt) return "archived";
  if (card.state === "compiling") return "compiling";
  if (card.state === "error") return "error";
  if (card.state === "paused_budget") return "paused_budget";
  if (card.state === "paused_hours") return "paused_hours";
  if (card.generatingIssueId) return "updating";
  if (card.pendingChangeCount > 0) return "stale";
  return "fresh";
}

export interface StatusCardLifecyclePresentation {
  label: string;
  /** Tailwind classes for the leading state dot. */
  dotClassName: string;
  /** Short human description used in the states reference and empty affordances. */
  description: string;
  /** Whether the tile should render a dashed "building" border. */
  dashedBorder: boolean;
  /** Whether the last-good summary should stay visible under a banner. */
  keepsLastSummary: boolean;
}

export const STATUS_CARD_LIFECYCLE_PRESENTATION: Record<
  StatusCardLifecycle,
  StatusCardLifecyclePresentation
> = {
  compiling: {
    label: t("libStatusCardState.lifecycle.compiling.label"),
    dotClassName: "bg-cyan-400 animate-pulse",
    description: t("libStatusCardState.lifecycle.compiling.description"),
    dashedBorder: true,
    keepsLastSummary: false,
  },
  fresh: {
    label: t("libStatusCardState.lifecycle.fresh.label"),
    dotClassName: "bg-emerald-400",
    description: t("libStatusCardState.lifecycle.fresh.description"),
    dashedBorder: false,
    keepsLastSummary: true,
  },
  stale: {
    label: t("libStatusCardState.lifecycle.stale.label"),
    dotClassName: "bg-amber-400",
    description: t("libStatusCardState.lifecycle.stale.description"),
    dashedBorder: false,
    keepsLastSummary: true,
  },
  updating: {
    // Blue (distinct from fresh-emerald and compiling-cyan) so an in-flight
    // update never reads as "fresh" on a glance-scan of the board.
    label: t("libStatusCardState.lifecycle.updating.label"),
    dotClassName: "bg-blue-500 animate-pulse",
    description: t("libStatusCardState.lifecycle.updating.description"),
    dashedBorder: false,
    keepsLastSummary: true,
  },
  error: {
    label: t("libStatusCardState.lifecycle.error.label"),
    dotClassName: "bg-red-500",
    description: t("libStatusCardState.lifecycle.error.description"),
    dashedBorder: false,
    keepsLastSummary: true,
  },
  paused_budget: {
    label: t("libStatusCardState.lifecycle.pausedBudget.label"),
    dotClassName: "bg-orange-400",
    description: t("libStatusCardState.lifecycle.pausedBudget.description"),
    dashedBorder: false,
    keepsLastSummary: true,
  },
  paused_hours: {
    label: t("libStatusCardState.lifecycle.pausedHours.label"),
    dotClassName: "bg-orange-400",
    description: t("libStatusCardState.lifecycle.pausedHours.description"),
    dashedBorder: false,
    keepsLastSummary: true,
  },
  archived: {
    label: t("libStatusCardState.lifecycle.archived.label"),
    dotClassName: "bg-muted-foreground/50",
    description: t("libStatusCardState.lifecycle.archived.description"),
    dashedBorder: false,
    keepsLastSummary: true,
  },
};

/** Compact token count, e.g. `1.1k`, `950`, `12.4k`. */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

/** US-dollar cost from integer cents, e.g. `$0.09`, `$1.20`. Sub-cent → `<$0.01`. */
export function formatUsdFromCents(cents: number): string {
  if (cents <= 0) return "$0.00";
  if (cents < 1) return "<$0.01";
  return `$${(cents / 100).toFixed(2)}`;
}

/** A one-line, human summary of a card's refresh policy for chips and footers. */
export function describeRefreshPolicy(policy: StatusCardRefreshPolicy): string {
  switch (policy.mode) {
    case "manual":
      return t("libStatusCardState.refresh.manual");
    case "interval":
      return policy.intervalMinutes
        ? t("libStatusCardState.refresh.everyMinutes", { minutes: policy.intervalMinutes })
        : t("libStatusCardState.refresh.onSchedule");
    case "reactive": {
      const debounce = policy.debounceSeconds ?? 60;
      return t("libStatusCardState.refresh.onChange", { seconds: debounce });
    }
    default:
      return t("libStatusCardState.refresh.manual");
  }
}
