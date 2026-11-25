import { googleWorkspaceToolTitle, type Agent } from "@paperclipai/shared";
import type { CompanyUserProfile } from "./company-members";
import { formatReviewPolicyValue } from "./review-policy";
import { t } from "@/i18n";

type ActivityDetails = Record<string, unknown> | null | undefined;

type ActivityParticipant = {
  type: "agent" | "user";
  agentId?: string | null;
  userId?: string | null;
};

type ActivityIssueReference = {
  id?: string | null;
  identifier?: string | null;
  title?: string | null;
};

interface ActivityFormatOptions {
  agentMap?: Map<string, Agent>;
  userProfileMap?: Map<string, CompanyUserProfile>;
  currentUserId?: string | null;
}

const ACTIVITY_ROW_VERBS: Record<string, string> = {
  "case.created": t("libActivityFormat.rowVerbs.caseCreated"),
  "case.updated": t("libActivityFormat.rowVerbs.caseUpdated"),
  "case.fields_changed": t("libActivityFormat.rowVerbs.caseFieldsChanged"),
  "case.status_changed": t("libActivityFormat.rowVerbs.caseStatusChanged"),
  "case.issue_linked": t("libActivityFormat.rowVerbs.caseIssueLinked"),
  "case.issue_unlinked": t("libActivityFormat.rowVerbs.caseIssueUnlinked"),
  "case.child_linked": t("libActivityFormat.rowVerbs.caseChildLinked"),
  "case.attachment_added": t("libActivityFormat.rowVerbs.caseAttachmentAdded"),
  "case.label_added": t("libActivityFormat.rowVerbs.caseLabelAdded"),
  "case.label_removed": t("libActivityFormat.rowVerbs.caseLabelRemoved"),
  "case.document_revised": t("libActivityFormat.rowVerbs.caseDocumentRevised"),
  "case.handoff_requested": t("libActivityFormat.rowVerbs.caseHandoffRequested"),
  "case.handoff_applied": t("libActivityFormat.rowVerbs.caseHandoffApplied"),
  "case.handoff_delivered": t("libActivityFormat.rowVerbs.caseHandoffDelivered"),
  "case.handoff_retry_requested": t("libActivityFormat.rowVerbs.caseHandoffRetryRequested"),
  "case.handoff_cancelled": t("libActivityFormat.rowVerbs.caseHandoffCancelled"),
  "case.handoff_completed": t("libActivityFormat.rowVerbs.caseHandoffCompleted"),
  "issue.created": t("libActivityFormat.rowVerbs.issueCreated"),
  "issue.updated": t("libActivityFormat.rowVerbs.issueUpdated"),
  "issue.read_marked": t("libActivityFormat.rowVerbs.issueReadMarked"),
  "issue.read_unmarked": t("libActivityFormat.rowVerbs.issueReadUnmarked"),
  "issue.checked_out": t("libActivityFormat.rowVerbs.issueCheckedOut"),
  "issue.released": t("libActivityFormat.rowVerbs.issueReleased"),
  "issue.comment_added": t("libActivityFormat.rowVerbs.issueCommentAdded"),
  "issue.comment_cancelled": t("libActivityFormat.rowVerbs.issueCommentCancelled"),
  "issue.queued_comment_edited": t("libActivityFormat.rowVerbs.issueQueuedCommentEdited"),
  "issue.queued_comments_reordered": t("libActivityFormat.rowVerbs.issueQueuedCommentsReordered"),
  "issue.queued_comment_discarded": t("libActivityFormat.rowVerbs.issueQueuedCommentDiscarded"),
  "issue.comment_deleted": t("libActivityFormat.rowVerbs.issueCommentDeleted"),
  "issue.attachment_added": t("libActivityFormat.rowVerbs.issueAttachmentAdded"),
  "issue.attachment_removed": t("libActivityFormat.rowVerbs.issueAttachmentRemoved"),
  "issue.document_created": t("libActivityFormat.rowVerbs.issueDocumentCreated"),
  "issue.document_updated": t("libActivityFormat.rowVerbs.issueDocumentUpdated"),
  "issue.document_locked": t("libActivityFormat.rowVerbs.issueDocumentLocked"),
  "issue.document_unlocked": t("libActivityFormat.rowVerbs.issueDocumentUnlocked"),
  "issue.document_deleted": t("libActivityFormat.rowVerbs.issueDocumentDeleted"),
  "issue.monitor_scheduled": t("libActivityFormat.rowVerbs.issueMonitorScheduled"),
  "issue.monitor_triggered": t("libActivityFormat.rowVerbs.issueMonitorTriggered"),
  "issue.monitor_cleared": t("libActivityFormat.rowVerbs.issueMonitorCleared"),
  "issue.monitor_skipped": t("libActivityFormat.rowVerbs.issueMonitorSkipped"),
  "issue.monitor_exhausted": t("libActivityFormat.rowVerbs.issueMonitorExhausted"),
  "issue.monitor_recovery_wake_queued": t("libActivityFormat.rowVerbs.issueMonitorRecoveryWakeQueued"),
  "issue.monitor_recovery_issue_created": t("libActivityFormat.rowVerbs.issueMonitorRecoveryIssueCreated"),
  "issue.monitor_escalated_to_board": t("libActivityFormat.rowVerbs.issueMonitorEscalatedToBoard"),
  "issue.commented": t("libActivityFormat.rowVerbs.issueCommented"),
  "issue.deleted": t("libActivityFormat.rowVerbs.issueDeleted"),
  "issue.successful_run_handoff_required": t("libActivityFormat.rowVerbs.issueSuccessfulRunHandoffRequired"),
  "issue.successful_run_handoff_resolved": t("libActivityFormat.rowVerbs.issueSuccessfulRunHandoffResolved"),
  "issue.successful_run_handoff_escalated": t("libActivityFormat.rowVerbs.issueSuccessfulRunHandoffEscalated"),
  "issue.accepted_plan_decomposition_updated": t("libActivityFormat.rowVerbs.issueAcceptedPlanDecompositionUpdated"),
  "issue.recovery_action_opened": t("libActivityFormat.rowVerbs.issueRecoveryActionOpened"),
  "issue.workspace_recovered": t("libActivityFormat.rowVerbs.issueWorkspaceRecovered"),
  "issue.retry_continued_from_saved_work": t("libActivityFormat.rowVerbs.issueRetryContinuedFromSavedWork"),
  "issue.workspace_recovery_requested": t("libActivityFormat.rowVerbs.issueWorkspaceRecoveryRequested"),
  "issue.previous_run_files_waiting": t("libActivityFormat.rowVerbs.issuePreviousRunFilesWaiting"),
  "issue.previous_run_files_lost": t("libActivityFormat.rowVerbs.issuePreviousRunFilesLost"),
  "issue.recovery_action_resolved": t("libActivityFormat.rowVerbs.issueRecoveryActionResolved"),
  "issue.recovery_action_escalated": t("libActivityFormat.rowVerbs.issueRecoveryActionEscalated"),
  "agent.created": t("libActivityFormat.rowVerbs.agentCreated"),
  "agent.updated": t("libActivityFormat.rowVerbs.agentUpdated"),
  "agent.paused": t("libActivityFormat.rowVerbs.agentPaused"),
  "agent.resumed": t("libActivityFormat.rowVerbs.agentResumed"),
  "agent.error_cleared": t("libActivityFormat.rowVerbs.agentErrorCleared"),
  "agent.terminated": t("libActivityFormat.rowVerbs.agentTerminated"),
  "agent.key_created": t("libActivityFormat.rowVerbs.agentKeyCreated"),
  "agent.budget_updated": t("libActivityFormat.rowVerbs.agentBudgetUpdated"),
  "agent.runtime_session_reset": t("libActivityFormat.rowVerbs.agentRuntimeSessionReset"),
  "heartbeat.invoked": t("libActivityFormat.rowVerbs.heartbeatInvoked"),
  "heartbeat.cancelled": t("libActivityFormat.rowVerbs.heartbeatCancelled"),
  "heartbeat.output_stale_source_resolved": t("libActivityFormat.rowVerbs.heartbeatOutputStaleSourceResolved"),
  "heartbeat.output_stale_recovery_recursion_refused": t("libActivityFormat.rowVerbs.heartbeatOutputStaleRecoveryRecursionRefused"),
  "approval.created": t("libActivityFormat.rowVerbs.approvalCreated"),
  "approval.approved": t("libActivityFormat.rowVerbs.approvalApproved"),
  "approval.rejected": t("libActivityFormat.rowVerbs.approvalRejected"),
  // Interaction outcomes (PAP-16506). An agent may now resolve one — including a
  // review of its own work — so these must read as outcomes in the feed instead
  // of falling through to the raw "issue thread interaction accepted" action id.
  // `details.interactionKind` sharpens the wording; see INTERACTION_OUTCOME_LABELS.
  "issue.thread_interaction_created": t("libActivityFormat.rowVerbs.issueThreadInteractionCreated"),
  "issue.thread_interaction_accepted": t("libActivityFormat.rowVerbs.issueThreadInteractionAccepted"),
  "issue.thread_interaction_rejected": t("libActivityFormat.rowVerbs.issueThreadInteractionRejected"),
  "issue.thread_interaction_answered": t("libActivityFormat.rowVerbs.issueThreadInteractionAnswered"),
  "issue.thread_interaction_withdrawn": t("libActivityFormat.rowVerbs.issueThreadInteractionWithdrawn"),
  "issue.thread_interaction_cancelled": t("libActivityFormat.rowVerbs.issueThreadInteractionCancelled"),
  "issue.thread_interaction_skipped": t("libActivityFormat.rowVerbs.issueThreadInteractionSkipped"),
  "issue.thread_interaction_dismissed": t("libActivityFormat.rowVerbs.issueThreadInteractionDismissed"),
  "issue.thread_interaction_expired": t("libActivityFormat.rowVerbs.issueThreadInteractionExpired"),
  "issue.thread_interaction_item_verdicts_submitted": t("libActivityFormat.rowVerbs.issueThreadInteractionItemVerdictsSubmitted"),
  "issue.stalled_review_decided": t("libActivityFormat.rowVerbs.issueStalledReviewDecided"),
  "project.created": t("libActivityFormat.rowVerbs.projectCreated"),
  "project.updated": t("libActivityFormat.rowVerbs.projectUpdated"),
  "project.deleted": t("libActivityFormat.rowVerbs.projectDeleted"),
  "goal.created": t("libActivityFormat.rowVerbs.goalCreated"),
  "goal.updated": t("libActivityFormat.rowVerbs.goalUpdated"),
  "goal.deleted": t("libActivityFormat.rowVerbs.goalDeleted"),
  "cost.reported": t("libActivityFormat.rowVerbs.costReported"),
  "cost.recorded": t("libActivityFormat.rowVerbs.costRecorded"),
  "company.created": t("libActivityFormat.rowVerbs.companyCreated"),
  "company.updated": t("libActivityFormat.rowVerbs.companyUpdated"),
  "company.archived": t("libActivityFormat.rowVerbs.companyArchived"),
  "company.reactivated": t("libActivityFormat.rowVerbs.companyReactivated"),
  "company.budget_updated": t("libActivityFormat.rowVerbs.companyBudgetUpdated"),
  "audit.exported": t("libActivityFormat.rowVerbs.auditExported"),
  "tool_app.connected": t("libActivityFormat.rowVerbs.toolAppConnected"),
  "tool_app.oauth_connected": t("libActivityFormat.rowVerbs.toolAppOauthConnected"),
  "tool_app.oauth_failed": t("libActivityFormat.rowVerbs.toolAppOauthFailed"),
  "tool_app.oauth_access_finalized": t("libActivityFormat.rowVerbs.toolAppOauthAccessFinalized"),
  "tool_app.finished": t("libActivityFormat.rowVerbs.toolAppFinished"),
  "tool_app.reconnected": t("libActivityFormat.rowVerbs.toolAppReconnected"),
  "tool_application.archived": t("libActivityFormat.rowVerbs.toolApplicationArchived"),
  "tool_connection.created": t("libActivityFormat.rowVerbs.toolConnectionCreated"),
  "tool_connection.updated": t("libActivityFormat.rowVerbs.toolConnectionUpdated"),
  "tool_connection.archived": t("libActivityFormat.rowVerbs.toolConnectionArchived"),
  "tool_connection.sign_in_cancelled": t("libActivityFormat.rowVerbs.toolConnectionSignInCancelled"),
  "tool_connection.catalog_refresh": t("libActivityFormat.rowVerbs.toolConnectionCatalogRefresh"),
  "tool_connection.installs_synced": t("libActivityFormat.rowVerbs.toolConnectionInstallsSynced"),
  "tool_connection.install_access_extended": t("libActivityFormat.rowVerbs.toolConnectionInstallAccessExtended"),
  "tool_connection.grant_audience_replaced": t("libActivityFormat.rowVerbs.toolConnectionGrantAudienceReplaced"),
  "tool_connection.grant_added": t("libActivityFormat.rowVerbs.toolConnectionGrantAdded"),
  "tool_connection.grant_revoked": t("libActivityFormat.rowVerbs.toolConnectionGrantRevoked"),
  "tool_connection.google_access_ended": t("libActivityFormat.rowVerbs.toolConnectionGoogleAccessEnded"),
  "tool_connection.google_access_not_ended": t("libActivityFormat.rowVerbs.toolConnectionGoogleAccessNotEnded"),
  "tool_connection.grant_delegated": t("libActivityFormat.rowVerbs.toolConnectionGrantDelegated"),
  "tool_connection.grant_delegation_revoked": t("libActivityFormat.rowVerbs.toolConnectionGrantDelegationRevoked"),
  "tool_connection.content_deletion_requested": t("libActivityFormat.rowVerbs.toolConnectionContentDeletionRequested"),
  "tool_connection.content_deletion_started": t("libActivityFormat.rowVerbs.toolConnectionContentDeletionStarted"),
  "tool_connection.content_deleted": t("libActivityFormat.rowVerbs.toolConnectionContentDeleted"),
  "issue.connection_content_deleted": t("libActivityFormat.rowVerbs.issueConnectionContentDeleted"),
  "issue.connection_content_deletion_incomplete": t("libActivityFormat.rowVerbs.issueConnectionContentDeletionIncomplete"),
};

const ISSUE_ACTIVITY_LABELS: Record<string, string> = {
  "issue.created": t("libActivityFormat.issueLabels.issueCreated"),
  "issue.updated": t("libActivityFormat.issueLabels.issueUpdated"),
  "issue.checked_out": t("libActivityFormat.issueLabels.issueCheckedOut"),
  "issue.released": t("libActivityFormat.issueLabels.issueReleased"),
  "issue.comment_added": t("libActivityFormat.issueLabels.issueCommentAdded"),
  "issue.comment_cancelled": t("libActivityFormat.issueLabels.issueCommentCancelled"),
  "issue.queued_comment_edited": t("libActivityFormat.issueLabels.issueQueuedCommentEdited"),
  "issue.queued_comments_reordered": t("libActivityFormat.issueLabels.issueQueuedCommentsReordered"),
  "issue.queued_comment_discarded": t("libActivityFormat.issueLabels.issueQueuedCommentDiscarded"),
  "issue.comment_deleted": t("libActivityFormat.issueLabels.issueCommentDeleted"),
  "issue.feedback_vote_saved": t("libActivityFormat.issueLabels.issueFeedbackVoteSaved"),
  "issue.attachment_added": t("libActivityFormat.issueLabels.issueAttachmentAdded"),
  "issue.attachment_removed": t("libActivityFormat.issueLabels.issueAttachmentRemoved"),
  "issue.document_created": t("libActivityFormat.issueLabels.issueDocumentCreated"),
  "issue.document_updated": t("libActivityFormat.issueLabels.issueDocumentUpdated"),
  "issue.document_locked": t("libActivityFormat.issueLabels.issueDocumentLocked"),
  "issue.document_unlocked": t("libActivityFormat.issueLabels.issueDocumentUnlocked"),
  "issue.document_deleted": t("libActivityFormat.issueLabels.issueDocumentDeleted"),
  "issue.monitor_scheduled": t("libActivityFormat.issueLabels.issueMonitorScheduled"),
  "issue.monitor_triggered": t("libActivityFormat.issueLabels.issueMonitorTriggered"),
  "issue.monitor_cleared": t("libActivityFormat.issueLabels.issueMonitorCleared"),
  "issue.monitor_skipped": t("libActivityFormat.issueLabels.issueMonitorSkipped"),
  "issue.monitor_exhausted": t("libActivityFormat.issueLabels.issueMonitorExhausted"),
  "issue.monitor_recovery_wake_queued": t("libActivityFormat.issueLabels.issueMonitorRecoveryWakeQueued"),
  "issue.monitor_recovery_issue_created": t("libActivityFormat.issueLabels.issueMonitorRecoveryIssueCreated"),
  "issue.monitor_escalated_to_board": t("libActivityFormat.issueLabels.issueMonitorEscalatedToBoard"),
  "issue.deleted": t("libActivityFormat.issueLabels.issueDeleted"),
  "issue.successful_run_handoff_required": t("libActivityFormat.issueLabels.issueSuccessfulRunHandoffRequired"),
  "issue.successful_run_handoff_resolved": t("libActivityFormat.issueLabels.issueSuccessfulRunHandoffResolved"),
  "issue.successful_run_handoff_escalated": t("libActivityFormat.issueLabels.issueSuccessfulRunHandoffEscalated"),
  "issue.cross_issue_influence_cap_rejected": t("libActivityFormat.issueLabels.issueCrossIssueInfluenceCapRejected"),
  "issue.cross_issue_influence_observed": t("libActivityFormat.issueLabels.issueCrossIssueInfluenceObserved"),
  "issue.attribution_spoof_rejected": t("libActivityFormat.issueLabels.issueAttributionSpoofRejected"),
  "issue.recovery_action_opened": t("libActivityFormat.issueLabels.issueRecoveryActionOpened"),
  "issue.workspace_recovered": t("libActivityFormat.issueLabels.issueWorkspaceRecovered"),
  "issue.retry_continued_from_saved_work": t("libActivityFormat.issueLabels.issueRetryContinuedFromSavedWork"),
  "issue.workspace_recovery_requested": t("libActivityFormat.issueLabels.issueWorkspaceRecoveryRequested"),
  "issue.previous_run_files_waiting": t("libActivityFormat.issueLabels.issuePreviousRunFilesWaiting"),
  "issue.previous_run_files_lost": t("libActivityFormat.issueLabels.issuePreviousRunFilesLost"),
  "issue.recovery_action_resolved": t("libActivityFormat.issueLabels.issueRecoveryActionResolved"),
  "issue.recovery_action_escalated": t("libActivityFormat.issueLabels.issueRecoveryActionEscalated"),
  "issue.accepted_plan_decomposition_updated": t("libActivityFormat.issueLabels.issueAcceptedPlanDecompositionUpdated"),
  "agent.created": t("libActivityFormat.issueLabels.agentCreated"),
  "agent.updated": t("libActivityFormat.issueLabels.agentUpdated"),
  "agent.paused": t("libActivityFormat.issueLabels.agentPaused"),
  "agent.resumed": t("libActivityFormat.issueLabels.agentResumed"),
  "agent.error_cleared": t("libActivityFormat.issueLabels.agentErrorCleared"),
  "agent.terminated": t("libActivityFormat.issueLabels.agentTerminated"),
  "heartbeat.invoked": t("libActivityFormat.issueLabels.heartbeatInvoked"),
  "heartbeat.cancelled": t("libActivityFormat.issueLabels.heartbeatCancelled"),
  "heartbeat.output_stale_source_resolved": t("libActivityFormat.issueLabels.heartbeatOutputStaleSourceResolved"),
  "heartbeat.output_stale_recovery_recursion_refused": t("libActivityFormat.issueLabels.heartbeatOutputStaleRecoveryRecursionRefused"),
  "approval.created": t("libActivityFormat.issueLabels.approvalCreated"),
  "approval.approved": t("libActivityFormat.issueLabels.approvalApproved"),
  "approval.rejected": t("libActivityFormat.issueLabels.approvalRejected"),
  "issue.thread_interaction_created": t("libActivityFormat.issueLabels.issueThreadInteractionCreated"),
  "issue.thread_interaction_accepted": t("libActivityFormat.issueLabels.issueThreadInteractionAccepted"),
  "issue.thread_interaction_rejected": t("libActivityFormat.issueLabels.issueThreadInteractionRejected"),
  "issue.thread_interaction_answered": t("libActivityFormat.issueLabels.issueThreadInteractionAnswered"),
  "issue.thread_interaction_withdrawn": t("libActivityFormat.issueLabels.issueThreadInteractionWithdrawn"),
  "issue.thread_interaction_cancelled": t("libActivityFormat.issueLabels.issueThreadInteractionCancelled"),
  "issue.thread_interaction_skipped": t("libActivityFormat.issueLabels.issueThreadInteractionSkipped"),
  "issue.thread_interaction_dismissed": t("libActivityFormat.issueLabels.issueThreadInteractionDismissed"),
  "issue.thread_interaction_expired": t("libActivityFormat.issueLabels.issueThreadInteractionExpired"),
  "issue.thread_interaction_item_verdicts_submitted": t("libActivityFormat.issueLabels.issueThreadInteractionItemVerdictsSubmitted"),
  "issue.stalled_review_decided": t("libActivityFormat.issueLabels.issueStalledReviewDecided"),
  "issue.connection_content_deleted": t("libActivityFormat.issueLabels.issueConnectionContentDeleted"),
  "issue.connection_content_deletion_incomplete": t("libActivityFormat.issueLabels.issueConnectionContentDeletionIncomplete"),
};

const ENTITY_LABELS: Record<string, string> = {
  company: t("libActivityFormat.entityLabels.company"),
  agent: t("libActivityFormat.entityLabels.agent"),
  goal: t("libActivityFormat.entityLabels.goal"),
  project: t("libActivityFormat.entityLabels.project"),
  routine: t("libActivityFormat.entityLabels.routine"),
  heartbeat_run: t("libActivityFormat.entityLabels.heartbeatRun"),
  approval: t("libActivityFormat.entityLabels.approval"),
  tool_connection: t("libActivityFormat.entityLabels.toolConnection"),
  tool_application: t("libActivityFormat.entityLabels.toolApplication"),
};

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function googleProviderAccessResult(details: ActivityDetails): string | null {
  const access = asRecord(details?.providerAccess);
  return access?.provider === "google" ? readText(access.result) : null;
}

function formatToolLabel(details: ActivityDetails): string {
  const name = readText(details?.upstreamToolName)
    ?? readText(details?.tool)?.replace(/^(?:mcp|app)\.[^:]*:|^(?:mcp|app)\.[a-z0-9-]*-[0-9a-f]{8}\./, "").replace(/-[0-9a-f]{16}$/, "");
  const title = readText(details?.toolTitle);
  if (!name) return title ?? t("libActivityFormat.tool.anAppAction");
  return googleWorkspaceToolTitle(name, title) ?? name.replace(/[._-]+/g, " ");
}

export function formatActivityEntityLabel(entityType: string, details?: Record<string, unknown> | null): string {
  const name = readText(details?.name);
  if (entityType === "tool_application" && name) return name;
  if (entityType === "tool_connection" && googleProviderAccessResult(details)) return t("libActivityFormat.entity.googleWorkspaceConnection");
  return ENTITY_LABELS[entityType] ?? entityType.replace(/[._]+/g, " ");
}

export function formatActivityOutcome(action: string, details?: Record<string, unknown> | null): string | null {
  if (action === "tool_application.archived" && details?.reason === "last_connection_removed") {
    return t("libActivityFormat.outcome.lastConnectionRemoved");
  }
  return null;
}

/**
 * `issue.stalled_review_decided` carries the verb the actor chose, so the line
 * names the verdict ("approved the review") rather than the generic action.
 * Mirrors `StalledReviewDecisionAction` in shared.
 */
const STALLED_REVIEW_DECISION_LABELS: Record<string, string> = {
  approve: t("libActivityFormat.stalledReview.approve"),
  request_changes: t("libActivityFormat.stalledReview.requestChanges"),
  send_back: t("libActivityFormat.stalledReview.sendBack"),
};

/**
 * `issue.thread_interaction_accepted` / `_rejected` fire for *every* interaction
 * kind, not only for a review. A task suggestion or a question is accepted, not
 * approved, so the kind on the event picks the verb. Kinds absent from a map
 * keep the neutral "accepted the request" wording from the tables above, which
 * is also the fallback for an event that carries no kind.
 */
const INTERACTION_ACCEPTED_LABELS: Record<string, string> = {
  request_confirmation: t("libActivityFormat.interactionAccepted.requestConfirmation"),
  request_checkbox_confirmation: t("libActivityFormat.interactionAccepted.requestCheckboxConfirmation"),
  suggest_tasks: t("libActivityFormat.interactionAccepted.suggestTasks"),
  ask_user_questions: t("libActivityFormat.interactionAccepted.askUserQuestions"),
};

const INTERACTION_REJECTED_LABELS: Record<string, string> = {
  request_confirmation: t("libActivityFormat.interactionRejected.requestConfirmation"),
  request_checkbox_confirmation: t("libActivityFormat.interactionRejected.requestCheckboxConfirmation"),
  suggest_tasks: t("libActivityFormat.interactionRejected.suggestTasks"),
  ask_user_questions: t("libActivityFormat.interactionRejected.askUserQuestions"),
};

/**
 * Kind-aware wording for an interaction outcome, or `null` when the tables
 * above already say it well enough.
 */
function formatInteractionOutcomeLabel(action: string, details: ActivityDetails): string | null {
  const table = action === "issue.thread_interaction_accepted"
    ? INTERACTION_ACCEPTED_LABELS
    : action === "issue.thread_interaction_rejected"
      ? INTERACTION_REJECTED_LABELS
      : null;
  if (!table) return null;
  const kind = typeof details?.interactionKind === "string" ? details.interactionKind : null;
  return kind ? table[kind] ?? null : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function humanizeValue(value: unknown): string {
  if (typeof value !== "string") return String(value ?? t("libActivityFormat.value.none"));
  return value.replace(/_/g, " ");
}

function isActivityParticipant(value: unknown): value is ActivityParticipant {
  const record = asRecord(value);
  if (!record) return false;
  return record.type === "agent" || record.type === "user";
}

function isActivityIssueReference(value: unknown): value is ActivityIssueReference {
  return asRecord(value) !== null;
}

function readParticipants(details: ActivityDetails, key: string): ActivityParticipant[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isActivityParticipant);
}

function readIssueReferences(details: ActivityDetails, key: string): ActivityIssueReference[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isActivityIssueReference);
}

function formatUserLabel(userId: string | null | undefined, options: ActivityFormatOptions = {}): string {
  if (!userId || userId === "local-board") return t("libActivityFormat.user.board");
  if (options.currentUserId && userId === options.currentUserId) return t("libActivityFormat.user.you");
  const profile = options.userProfileMap?.get(userId);
  if (profile) return profile.label;
  return t("libActivityFormat.user.short", { id: userId.slice(0, 5) });
}

function formatParticipantLabel(participant: ActivityParticipant, options: ActivityFormatOptions): string {
  if (participant.type === "agent") {
    const agentId = participant.agentId ?? "";
    return options.agentMap?.get(agentId)?.name ?? t("libActivityFormat.participant.agent");
  }
  return formatUserLabel(participant.userId, options);
}

function formatIssueReferenceLabel(reference: ActivityIssueReference): string {
  if (reference.identifier) return reference.identifier;
  if (reference.title) return reference.title;
  if (reference.id) return reference.id.slice(0, 8);
  return t("libActivityFormat.reference.task");
}

function formatChangedEntityLabel(
  singular: string,
  plural: string,
  labels: string[],
): string {
  if (labels.length <= 0) return plural;
  if (labels.length === 1) return t("libActivityFormat.changed.single", { noun: singular, label: labels[0] });
  return t("libActivityFormat.changed.many", { n: labels.length, noun: plural });
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function readStringArrayLength(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((entry) => typeof entry === "string" && entry.length > 0).length;
}

function formatAcceptedPlanDecompositionDetail(details: ActivityDetails): string | null {
  if (!details) return null;
  const status = typeof details.status === "string" ? details.status : null;
  const requested = readNumber(details.requestedChildCount);
  const totalChildren = readStringArrayLength(details.childIssueIds);
  const newlyCreated = readStringArrayLength(details.newlyCreatedChildIssueIds);
  const reused = Math.max(0, totalChildren - newlyCreated);
  const parts: string[] = [];
  if (newlyCreated > 0) parts.push(t("libActivityFormat.decomposition.createdNew", { n: newlyCreated }));
  if (reused > 0) parts.push(t("libActivityFormat.decomposition.reusedExisting", { n: reused }));
  if (parts.length === 0 && requested !== null) parts.push(t("libActivityFormat.decomposition.requested", { n: requested }));
  const summary = parts.length > 0 ? parts.join(", ") : null;
  if (status === "completed" && summary) return t("libActivityFormat.decomposition.completedWithSummary", { summary });
  if (status === "completed") return t("libActivityFormat.decomposition.completed");
  if (status === "in_flight" && summary) return t("libActivityFormat.decomposition.inFlight", { summary });
  return summary;
}

function formatIssueUpdatedVerb(details: ActivityDetails): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  if (details.status !== undefined) {
    const from = previous.status;
    const to = humanizeValue(details.status === "in_review" && details.externalConversationState === "waiting" ? "idle" : details.status);
    return from
      ? t("libActivityFormat.rowUpdate.statusFromTo", { from: humanizeValue(from), to })
      : t("libActivityFormat.rowUpdate.statusTo", { to });
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    return from
      ? t("libActivityFormat.rowUpdate.priorityFromTo", { from: humanizeValue(from), to: humanizeValue(details.priority) })
      : t("libActivityFormat.rowUpdate.priorityTo", { to: humanizeValue(details.priority) });
  }
  return null;
}

function formatAssigneeName(details: ActivityDetails, options: ActivityFormatOptions): string | null {
  if (!details) return null;
  const agentId = details.assigneeAgentId;
  const userId = details.assigneeUserId;
  if (typeof agentId === "string" && agentId) {
    return options.agentMap?.get(agentId)?.name ?? t("libActivityFormat.participant.agent");
  }
  if (typeof userId === "string" && userId) {
    return formatUserLabel(userId, options);
  }
  return null;
}

function formatIssueUpdatedAction(details: ActivityDetails, options: ActivityFormatOptions = {}): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  const parts: string[] = [];

  if (details.status !== undefined) {
    const from = previous.status;
    const to = humanizeValue(details.status === "in_review" && details.externalConversationState === "waiting" ? "idle" : details.status);
    parts.push(
      from
        ? t("libActivityFormat.issueUpdate.statusFromTo", { from: humanizeValue(from), to })
        : t("libActivityFormat.issueUpdate.statusTo", { to }),
    );
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    parts.push(
      from
        ? t("libActivityFormat.issueUpdate.priorityFromTo", { from: humanizeValue(from), to: humanizeValue(details.priority) })
        : t("libActivityFormat.issueUpdate.priorityTo", { to: humanizeValue(details.priority) }),
    );
  }
  if (details.assigneeAgentId !== undefined || details.assigneeUserId !== undefined) {
    const assigneeName = formatAssigneeName(details, options);
    parts.push(assigneeName ? t("libActivityFormat.issueUpdate.assignee", { name: assigneeName }) : t("libActivityFormat.issueUpdate.assigneeCleared"));
  }
  if (details.reviewPolicy !== undefined) {
    // `null` is the default ("anyone can approve"), so it must not read as
    // "changed the review policy to none" (PAP-16506).
    parts.push(t("libActivityFormat.issueUpdate.reviewPolicy", { policy: formatReviewPolicyValue(details.reviewPolicy) }));
  }
  if (details.title !== undefined) parts.push(t("libActivityFormat.issueUpdate.title"));
  if (details.description !== undefined) parts.push(t("libActivityFormat.issueUpdate.description"));

  return parts.length > 0 ? parts.join(", ") : null;
}

function formatStructuredIssueChange(input: {
  action: string;
  details: ActivityDetails;
  options: ActivityFormatOptions;
  forIssueDetail: boolean;
}): string | null {
  const details = input.details;
  if (!details) return null;

  if (input.action === "issue.blockers_updated") {
    const added = readIssueReferences(details, "addedBlockedByIssues").map(formatIssueReferenceLabel);
    const removed = readIssueReferences(details, "removedBlockedByIssues").map(formatIssueReferenceLabel);
    if (added.length > 0 && removed.length === 0) {
      const changed = formatChangedEntityLabel(t("libActivityFormat.nouns.blocker"), t("libActivityFormat.nouns.blockers"), added);
      return input.forIssueDetail ? t("libActivityFormat.structured.added", { changed }) : t("libActivityFormat.structured.addedTo", { changed });
    }
    if (removed.length > 0 && added.length === 0) {
      const changed = formatChangedEntityLabel(t("libActivityFormat.nouns.blocker"), t("libActivityFormat.nouns.blockers"), removed);
      return input.forIssueDetail ? t("libActivityFormat.structured.removed", { changed }) : t("libActivityFormat.structured.removedFrom", { changed });
    }
    return input.forIssueDetail ? t("libActivityFormat.structured.updated", { noun: t("libActivityFormat.nouns.blockers") }) : t("libActivityFormat.structured.updatedOn", { noun: t("libActivityFormat.nouns.blockers") });
  }

  if (input.action === "issue.reviewers_updated" || input.action === "issue.approvers_updated") {
    const added = readParticipants(details, "addedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const removed = readParticipants(details, "removedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const singular = input.action === "issue.reviewers_updated" ? t("libActivityFormat.nouns.reviewer") : t("libActivityFormat.nouns.approver");
    const plural = input.action === "issue.reviewers_updated" ? t("libActivityFormat.nouns.reviewers") : t("libActivityFormat.nouns.approvers");
    if (added.length > 0 && removed.length === 0) {
      const changed = formatChangedEntityLabel(singular, plural, added);
      return input.forIssueDetail ? t("libActivityFormat.structured.added", { changed }) : t("libActivityFormat.structured.addedTo", { changed });
    }
    if (removed.length > 0 && added.length === 0) {
      const changed = formatChangedEntityLabel(singular, plural, removed);
      return input.forIssueDetail ? t("libActivityFormat.structured.removed", { changed }) : t("libActivityFormat.structured.removedFrom", { changed });
    }
    return input.forIssueDetail ? t("libActivityFormat.structured.updated", { noun: plural }) : t("libActivityFormat.structured.updatedOn", { noun: plural });
  }

  return null;
}

export function formatActivityVerb(
  action: string,
  details?: Record<string, unknown> | null,
  options: ActivityFormatOptions = {},
): string {
  if (action.startsWith("tool_gateway.")) {
    const tool = formatToolLabel(details);
    const isTest = details?.source === "test";
    if (action === "tool_gateway.call_completed") return isTest ? t("libActivityFormat.gateway.tested", { tool }) : t("libActivityFormat.gateway.used", { tool });
    if (action === "tool_gateway.call_allowed") return isTest ? t("libActivityFormat.gateway.startedTest", { tool }) : t("libActivityFormat.gateway.allowed", { tool });
    if (action === "tool_gateway.call_denied") return t("libActivityFormat.gateway.denied", { tool });
    if (action === "tool_gateway.approval_requested") return t("libActivityFormat.gateway.approvalRequested", { tool });
    if (action === "tool_gateway.call_failed") return isTest ? t("libActivityFormat.gateway.failedTest", { tool }) : t("libActivityFormat.gateway.failed", { tool });
    if (action === "tool_gateway.call_deferred") return isTest ? t("libActivityFormat.gateway.deferredTest", { tool }) : t("libActivityFormat.gateway.deferred", { tool });
    if (action === "tool_gateway.session_created") return t("libActivityFormat.gateway.sessionCreated");
    if (action === "tool_gateway.session_rejected") return t("libActivityFormat.gateway.sessionRejected");
    if (action === "tool_gateway.discovery") return t("libActivityFormat.gateway.discovery");
  }

  if (action === "issue.updated") {
    const issueUpdatedVerb = formatIssueUpdatedVerb(details);
    if (issueUpdatedVerb) return issueUpdatedVerb;
  }

  if (action === "issue.stalled_review_decided") {
    const decision = typeof details?.action === "string" ? details.action : null;
    const label = decision ? STALLED_REVIEW_DECISION_LABELS[decision] : null;
    if (label) return t("libActivityFormat.withOn", { label });
  }

  const outcomeLabel = formatInteractionOutcomeLabel(action, details);
  if (outcomeLabel) return t("libActivityFormat.withOn", { label: outcomeLabel });

  const structuredChange = formatStructuredIssueChange({
    action,
    details,
    options,
    forIssueDetail: false,
  });
  if (structuredChange) return structuredChange;

  return ACTIVITY_ROW_VERBS[action] ?? action.replace(/[._]/g, " ");
}

export function formatIssueActivityAction(
  action: string,
  details?: Record<string, unknown> | null,
  options: ActivityFormatOptions = {},
): string {
  if (action === "issue.updated") {
    const issueUpdatedAction = formatIssueUpdatedAction(details, options);
    if (issueUpdatedAction) return issueUpdatedAction;
  }

  const structuredChange = formatStructuredIssueChange({
    action,
    details,
    options,
    forIssueDetail: true,
  });
  if (structuredChange) return structuredChange;

  if (action === "issue.accepted_plan_decomposition_updated") {
    const detail = formatAcceptedPlanDecompositionDetail(details);
    if (detail) return detail;
  }

  if (action === "issue.stalled_review_decided") {
    const decision = typeof details?.action === "string" ? details.action : null;
    const label = decision ? STALLED_REVIEW_DECISION_LABELS[decision] : null;
    if (label) return label;
  }

  const outcomeLabel = formatInteractionOutcomeLabel(action, details);
  if (outcomeLabel) return outcomeLabel;

  if (action.startsWith("issue.monitor_") && details) {
    const serviceName = typeof details.serviceName === "string" && details.serviceName.trim()
      ? details.serviceName.trim()
      : null;
    const base = ISSUE_ACTIVITY_LABELS[action] ?? action.replace(/[._]/g, " ");
    return serviceName ? t("libActivityFormat.monitorFor", { base, service: serviceName }) : base;
  }

  if (
    (
      action === "issue.document_created" ||
      action === "issue.document_updated" ||
      action === "issue.document_locked" ||
      action === "issue.document_unlocked" ||
      action === "issue.document_deleted"
    ) &&
    details
  ) {
    const key = typeof details.key === "string" ? details.key : t("libActivityFormat.documentFallback");
    const title = typeof details.title === "string" && details.title ? ` (${details.title})` : "";
    return `${ISSUE_ACTIVITY_LABELS[action] ?? action} ${key}${title}`;
  }

  return ISSUE_ACTIVITY_LABELS[action] ?? action.replace(/[._]/g, " ");
}
