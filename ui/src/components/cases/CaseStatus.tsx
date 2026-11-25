import type { CaseStatus as CaseStatusValue } from "@/api/cases";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/i18n";

export const CASE_STATUS_LABELS: Record<CaseStatusValue, string> = {
  draft: t("componentsCases.status.draft"),
  in_progress: t("componentsCases.status.inProgress"),
  in_review: t("componentsCases.status.inReview"),
  approved: t("componentsCases.status.approved"),
  done: t("componentsCases.status.done"),
  cancelled: t("componentsCases.status.cancelled"),
};

export function CaseStatus({ status, className }: { status: CaseStatusValue; className?: string }) {
  return <StatusBadge status={status} label={CASE_STATUS_LABELS[status]} className={className} />;
}
