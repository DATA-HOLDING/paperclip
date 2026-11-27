import type { ProviderTraceMetadata } from "@paperclipai/shared";
import { Bug, CircleOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

export function runRequestedProviderTrace(
  contextSnapshot: Record<string, unknown> | null | undefined,
) {
  if (!contextSnapshot) return false;
  const debug = contextSnapshot.debug;
  return (
    typeof debug === "object" &&
    debug !== null &&
    !Array.isArray(debug) &&
    (debug as Record<string, unknown>).providerTrace === "raw"
  );
}

export function ProviderTraceStatusBadge({
  trace,
  requested = false,
  showOff = false,
  className,
}: {
  trace?: ProviderTraceMetadata | null;
  requested?: boolean;
  showOff?: boolean;
  className?: string;
}) {
  const status = trace?.status;
  const expired = trace
    ? new Date(trace.expiresAt).getTime() <= Date.now()
    : false;
  const labelKind = expired
    ? "expired"
    : status === "capturing"
      ? "capturing"
      : status === "complete"
        ? "complete"
        : status === "incomplete"
          ? "incomplete"
          : status === "truncated"
            ? "truncated"
            : status === "expired"
              ? "expired"
              : status === "deleted"
                ? "deleted"
                : requested
                  ? "requested"
                  : showOff
                    ? "off"
                    : null;
  if (!labelKind) return null;
  const label = t(`componentsProviderTraceStatusBadge.label.${labelKind}`);
  const warning =
    status === "incomplete" ||
    status === "truncated" ||
    status === "expired" ||
    status === "deleted" ||
    expired;
  const Icon = labelKind === "off" ? CircleOff : Bug;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-(length:--text-micro) font-medium",
        labelKind === "off" || labelKind === "deleted" || labelKind === "expired"
          ? "border-border bg-background text-muted-foreground"
          : warning
            ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        className,
      )}
      title={
        trace
          ? t("componentsProviderTraceStatusBadge.title.summary", {
              frameCount: trace.frameCount,
              byteCount: trace.byteCount,
              expiresAt: new Date(trace.expiresAt).toLocaleString(),
            })
          : requested
            ? t("componentsProviderTraceStatusBadge.title.requested")
            : t("componentsProviderTraceStatusBadge.title.disabled")
      }
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
