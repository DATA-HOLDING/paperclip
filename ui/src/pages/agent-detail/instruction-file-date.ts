import type { AgentInstructionsFileSummary } from "@paperclipai/shared";
import { formatDate } from "@/lib/utils";
import { t } from "@/i18n";

/** Missing historical metadata must never become an invented creation date. */
export function instructionFileDateLabel(file?: Pick<AgentInstructionsFileSummary, "createdAt" | "updatedAt"> | null) {
  if (file?.updatedAt && Number.isFinite(Date.parse(file.updatedAt))) return t("pagesAgentDetail.instructionFileDate.lastUpdated", { date: formatDate(file.updatedAt) });
  if (file?.createdAt && Number.isFinite(Date.parse(file.createdAt))) return t("pagesAgentDetail.instructionFileDate.dateCreated", { date: formatDate(file.createdAt) });
  return t("pagesAgentDetail.instructionFileDate.dateUnavailable");
}
