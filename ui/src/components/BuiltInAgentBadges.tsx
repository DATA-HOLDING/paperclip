import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { brandChipBadge } from "@/lib/status-colors";
import type { BuiltInAgentStatus } from "@/api/builtInAgents";
import { t } from "@/i18n";

/**
 * Derived lifecycle chip. Rendered for the amber attention states
 * (`needs_setup`, `pending_approval`). Kept separate from the real agent status
 * (`idle/active/…`) per ux-spec D1.
 */
export function BuiltInLifecycleChip({
  status,
  compact = false,
  className,
}: {
  status: BuiltInAgentStatus;
  compact?: boolean;
  className?: string;
}) {
  if (status !== "needs_setup" && status !== "pending_approval") return null;
  const isPendingApproval = status === "pending_approval";
  return (
    <Badge
      variant="outline"
      className={cn(
        brandChipBadge.amber,
        compact && "px-1.5 py-0 text-(length:--text-nano)",
        className,
      )}
      title={
        isPendingApproval
          ? t("componentsBuiltInAgentBadges.pendingApprovalTitle")
          : t("componentsBuiltInAgentBadges.needsSetupTitle")
      }
    >
      {isPendingApproval ? (compact ? t("componentsBuiltInAgentBadges.approvalShort") : t("componentsBuiltInAgentBadges.pendingApproval")) : compact ? t("componentsBuiltInAgentBadges.setupShort") : t("componentsBuiltInAgentBadges.needsSetup")}
    </Badge>
  );
}
