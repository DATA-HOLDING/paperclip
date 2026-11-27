import { t } from "@/i18n";
import type { AiSignInRemoval, ManagedGoogleAccessRemoval } from "@paperclipai/shared";
import type { ToastAction, ToastInput, ToastTone } from "../../context/ToastContext";

export const GOOGLE_THIRD_PARTY_ACCESS_URL = "https://myaccount.google.com/connections";

export const GOOGLE_CONTENT_DELETION_NOTICE =
  t("featuresConnections.googleAccessRemoval.contentDeletionNotice");

export interface GoogleAccessRemovalNotice {
  body: string;
  tone: ToastTone;
  action?: ToastAction;
}

const openGoogleAccountConnections: ToastAction = {
  label: t("featuresConnections.googleAccessRemoval.openConnections"),
  onClick: () => { window.open(GOOGLE_THIRD_PARTY_ACCESS_URL, "_blank", "noopener,noreferrer"); },
};

export function googleAccessRemovalNotice(
  providerAccess: ManagedGoogleAccessRemoval | null | undefined,
  removed: "connection" | "credentials" = "connection",
): GoogleAccessRemovalNotice | null {
  if (providerAccess?.provider !== "google") return null;
  if (providerAccess.result === "ended") {
    return { tone: "success", body: t("featuresConnections.googleAccessRemoval.ended") };
  }
  if (providerAccess.result === "ended_unconfirmed") {
    return {
      tone: "info",
      body: t("featuresConnections.googleAccessRemoval.endedUnconfirmed"),
      action: openGoogleAccountConnections,
    };
  }
  if (providerAccess.result === "other_connections_remain") {
    return {
      tone: "success",
      body: t("featuresConnections.googleAccessRemoval.otherConnectionsRemain"),
    };
  }
  if (providerAccess.result === "retrying") {
    return {
      tone: "info",
      body: t("featuresConnections.googleAccessRemoval.retrying"),
    };
  }
  return {
    tone: "warn",
    body: t("featuresConnections.googleAccessRemoval.notEnded", { removed: t(`featuresConnections.googleAccessRemoval.removed.${removed}`) }),
    action: openGoogleAccountConnections,
  };
}

export function aiSignInRemovalNotice(removal: AiSignInRemoval | null | undefined): GoogleAccessRemovalNotice | null {
  if (removal?.provider !== "google") return null;
  if (removal.savedSignIn === "not_deleted") {
    return { tone: "warn", body: t("featuresConnections.googleAccessRemoval.signInNotDeleted") };
  }
  const kept = removal.savedSignIn === "kept_shared"
    ? t("featuresConnections.googleAccessRemoval.signInKeptShared")
    : t("featuresConnections.googleAccessRemoval.signInDeleted");
  return {
    tone: "info",
    body: t("featuresConnections.googleAccessRemoval.signInRemoval", { kept: kept }),
    action: openGoogleAccountConnections,
  };
}

export function connectionRemovalToast(input: {
  title: string;
  body: string;
  providerAccess: ManagedGoogleAccessRemoval | null | undefined;
  signInRemoval?: AiSignInRemoval | null;
}): ToastInput {
  const notice = googleAccessRemovalNotice(input.providerAccess) ?? aiSignInRemovalNotice(input.signInRemoval);
  return {
    title: input.title,
    body: notice ? `${input.body} ${notice.body}` : input.body,
    tone: notice?.tone ?? "success",
    ...(notice?.action ? { action: notice.action } : {}),
  };
}

export function googleAccessRetrySummary(type: "google_access_ended" | "google_access_not_ended", details: Record<string, unknown> | null): string {
  if (type === "google_access_ended") return t("featuresConnections.googleAccessRemoval.retrySummary.ended");
  if (details?.result === "other_connections_remain") return t("featuresConnections.googleAccessRemoval.retrySummary.otherConnectionsRemain");
  return t("featuresConnections.googleAccessRemoval.retrySummary.stopped");
}
