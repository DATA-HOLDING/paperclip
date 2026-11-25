import type { IssueChatLinkedRun } from "./issue-chat-messages";
import type { TaskChatMarkerItem } from "../components/task-chat/task-chat-model";
import { t } from "@/i18n";

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

/** Presentation only: older runs can carry the original sharing-denial message. */
export function credentialAccessNotice(
  run: IssueChatLinkedRun | undefined,
  currentUserId: string | null | undefined,
  userLabels?: ReadonlyMap<string, string> | null,
): TaskChatMarkerItem["credentialAccess"] | undefined {
  if (!run || run.status !== "failed") return undefined;
  const configuration = object(run.resultJson?.configurationIncomplete);
  if (configuration.selectionFailure !== "ai_connection_credential_not_shared" &&
      run.error !== "This credential is not shared with the responsible user") return undefined;
  const credential = object(configuration.credentialAccess);
  const responsibleUserId = typeof configuration.responsibleUserId === "string"
    ? configuration.responsibleUserId : run.responsibleUserId;
  return {
    agentName: run.agentName?.trim() || t("libCredentialAccessNotice.thisAgent"),
    credentialName: typeof credential.connectionName === "string" && credential.connectionName.trim()
      ? credential.connectionName : undefined,
    deniedUser: responsibleUserId && responsibleUserId === currentUserId
      ? "you" : responsibleUserId ? userLabels?.get(responsibleUserId) || t("libCredentialAccessNotice.taskOwner") : t("libCredentialAccessNotice.taskOwner"),
    settingsHref: `/agents/${encodeURIComponent(run.agentId)}/runtime`,
  };
}
