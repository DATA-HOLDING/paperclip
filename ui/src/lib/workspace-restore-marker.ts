import { t } from "@/i18n";
import { safeWorkspaceRestorePath } from "@paperclipai/shared";

export function workspaceRestoreMarkerDetail(input: {
  result: Record<string, unknown> | null | undefined;
  savedPlan: boolean;
  hasResponse: boolean;
}): string {
  const parts = [input.savedPlan
    ? t("libWorkspaceRestoreMarker.failedAfterPlanSaved")
    : t("libWorkspaceRestoreMarker.failed")];
  parts.push(t("libWorkspaceRestoreMarker.filesNeedRecovery"));
  if (!input.hasResponse && input.result?.finalResponseRecorded === false) {
    parts.push(t("libWorkspaceRestoreMarker.noFinalResponse"));
  }
  const relativePath = safeWorkspaceRestorePath(input.result?.workspaceRestorePath);
  if (relativePath) parts.push(t("libWorkspaceRestoreMarker.affectedPath", { path: relativePath }));
  return parts.join(" ");
}
