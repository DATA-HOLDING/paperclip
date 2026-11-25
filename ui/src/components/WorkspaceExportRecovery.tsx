import { useLayoutEffect, useRef, useState } from "react";
import { t } from "@/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IssueRecoveryAction, WorkspaceSourceInspection } from "@paperclipai/shared";
import { isNativeWorkspaceExportRepairCause } from "@paperclipai/shared";
import { isTransientError } from "../api/errors";
import { useQueryView } from "./QueryView";
import { accessApi } from "../api/access";
import { issuesApi } from "../api/issues";
import { useDraftOwner, useDraftOwnerReader } from "../hooks/useDraftOwner";
import { canBoardConfirmOwnerStop, canBoardResolveRecoveryAction, isRetainedWorkspaceExportCause } from "../lib/recovery-reconcile";
import { queryKeys } from "../lib/queryKeys";
import { classifySendFailure, pendingSendKeyFor, readPendingSend, writePendingSend } from "../lib/pending-send";
import { asObject, cn } from "../lib/utils";
import { createUuid } from "../lib/uuid";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

/** Reports whether this surface owns the task's next recovery action. The task's
 * generic Retry stays hidden only while this surface offers its own control. */
function ReportRecoveryControl({ owns, onChange }: { owns: boolean; onChange?: (owns: boolean) => void }) {
  useLayoutEffect(() => {
    onChange?.(owns);
    return () => onChange?.(false);
  }, [owns, onChange]);
  return null;
}

const CONTROLLER_HOST_UNVERIFIED = "native_controller_host_unverified";
const OWNER_UNPROVABLE = "ownership_owner_unprovable";

/** What the stuck record is, by ownership kind, for the board's confirmation. */
const OWNER_GONE_RESOURCE: Record<string, { what: string; releasing: string }> = {
  environment_run_lease_active: { what: t("componentsWorkspaceExportRecovery.resources.sandboxLease.what"), releasing: t("componentsWorkspaceExportRecovery.resources.sandboxLease.releasing") },
  legacy_controller_lease: { what: t("componentsWorkspaceExportRecovery.resources.controllerLease.what"), releasing: t("componentsWorkspaceExportRecovery.resources.controllerLease.releasing") },
  environment_teardown_claim: { what: t("componentsWorkspaceExportRecovery.resources.teardown.what"), releasing: t("componentsWorkspaceExportRecovery.resources.teardown.releasing") },
  sandbox_creation_intent: { what: t("componentsWorkspaceExportRecovery.resources.sandboxCreation.what"), releasing: t("componentsWorkspaceExportRecovery.resources.sandboxCreation.releasing") },
  workspace_runtime_control_operation: { what: t("componentsWorkspaceExportRecovery.resources.runtimeControl.what"), releasing: t("componentsWorkspaceExportRecovery.resources.runtimeControl.releasing") },
  native_workspace_finalize_attempt: { what: t("componentsWorkspaceExportRecovery.resources.finalize.what"), releasing: t("componentsWorkspaceExportRecovery.resources.finalize.releasing") },
  native_finalizer_lease: { what: t("componentsWorkspaceExportRecovery.resources.finalizer.what"), releasing: t("componentsWorkspaceExportRecovery.resources.finalizer.releasing") },
  native_cleanup_lease: { what: t("componentsWorkspaceExportRecovery.resources.cleanup.what"), releasing: t("componentsWorkspaceExportRecovery.resources.cleanup.releasing") },
};
const OWNER_GONE_DEFAULT = { what: t("componentsWorkspaceExportRecovery.resources.default.what"), releasing: t("componentsWorkspaceExportRecovery.resources.default.releasing") };

/** Causes whose one action is the board's previous-server stop confirmation;
 * the generic recovery card must not offer other resolutions for them. */
export function isPreviousServerStopCause(cause: string | null | undefined) {
  return cause === "native_workspace_finalization_owner_unverified" || cause === CONTROLLER_HOST_UNVERIFIED
    || cause === OWNER_UNPROVABLE;
}

/** Requests preservation; the existing worker owns stop, copyback and verification. */
export function WorkspaceExportRecovery({ action, className, issueId, companyId, showStatus = true, onRecoveryControlChange }: {
  className?: string; action: IssueRecoveryAction | null; issueId?: string; companyId?: string; showStatus?: boolean;
  onRecoveryControlChange?: (owns: boolean) => void;
}) {
  // A restart killed the copyback owner of retained saved-work recovery. Recovery
  // and any accepted Retry wait on its receipt; the confirmation is the one action.
  const retainedOwnerToken = action && issueId && companyId && isRetainedExport(action, issueId, companyId)
    ? retainedOwnerStopToken(action) : null;
  if (action && issueId && companyId && retainedOwnerToken) {
    return <><ReportRecoveryControl owns onChange={onRecoveryControlChange} />
      <PreviousServerStopConfirmation key={`${action.id}:${String(action.evidence.runId)}:${retainedOwnerToken}`}
        action={action} ownerToken={retainedOwnerToken} issueId={issueId} companyId={companyId} className={className} /></>;
  }
  if (action && issueId && companyId && isRetainedExport(action, issueId, companyId)) {
    return <RetainedFilesRecovery key={`${companyId}:${issueId}:${action.id}:${action.evidence.runId}`}
      action={action} issueId={issueId} companyId={companyId} className={className}
      onRecoveryControlChange={onRecoveryControlChange} />;
  }
  // An ephemeral server cannot judge a pre-upgrade controller row by PID.
  if (action?.cause === CONTROLLER_HOST_UNVERIFIED && issueId && companyId
    && isControllerStopRequired(action, issueId, companyId)) {
    return <><ReportRecoveryControl owns onChange={onRecoveryControlChange} />
      <PreviousServerStopConfirmation key={`${action.id}:${String(action.evidence.runId)}`}
        action={action} issueId={issueId} companyId={companyId} className={className}
        confirmStop={stopEvidence => issuesApi.confirmControllerStopped(issueId, {
          actionId: action.id, runId: action.evidence.runId as string, stopEvidence })}
        copy={{ waiting: t("componentsWorkspaceExportRecovery.controller.waiting"),
          question: t("componentsWorkspaceExportRecovery.confirmQuestion"),
          placeholder: t("componentsWorkspaceExportRecovery.confirmPlaceholder"),
          resuming: t("componentsWorkspaceExportRecovery.controller.resuming") }} /></>;
  }
  // A resource held by a server recorded before Paperclip stored which server held it.
  if (action?.cause === OWNER_UNPROVABLE && issueId && companyId && isOwnerGoneRequired(action, issueId, companyId)) {
    const resource = OWNER_GONE_RESOURCE[String(action.evidence.kind)] ?? OWNER_GONE_DEFAULT;
    return <><ReportRecoveryControl owns onChange={onRecoveryControlChange} />
      {/* Keyed by the record version: a request refreshed to a newer version resets an open form, so
          the board never confirms a version it was not shown. */}
      <PreviousServerStopConfirmation key={`${action.id}:${String(action.evidence.recordId)}:${String(action.evidence.recordUpdatedAt ?? "")}`}
        action={action} issueId={issueId} companyId={companyId} className={className}
        confirmStop={stopEvidence => issuesApi.confirmOwnerGone(issueId, {
          actionId: action.id, recordId: action.evidence.recordId as string, stopEvidence,
          // The version shown here: a request refreshed since must be confirmed again.
          ...(typeof action.evidence.recordUpdatedAt === "string" ? { recordVersion: action.evidence.recordUpdatedAt } : {}) })}
        copy={{ waiting: t("componentsWorkspaceExportRecovery.ownerGone.waiting", { what: resource.what }),
          question: t("componentsWorkspaceExportRecovery.confirmQuestion"),
          placeholder: t("componentsWorkspaceExportRecovery.confirmPlaceholder"),
          resuming: resource.releasing }} /></>;
  }
  const ownerRecovery = action?.cause === "native_workspace_finalization_owner_unverified";
  // The task's interruption names this wait; the confirmation is its one action.
  if (ownerRecovery && issueId && companyId && isOwnerStopRequired(action, issueId, companyId)) {
    return <><ReportRecoveryControl owns onChange={onRecoveryControlChange} />
      <PreviousServerStopConfirmation key={`${action.id}:${String(action.evidence.runId)}`}
        action={action} ownerToken={asObject(action.evidence.owner).token as string}
        issueId={issueId} companyId={companyId} className={className} /></>;
  }
  if (!showStatus) return <ReportRecoveryControl owns={false} onChange={onRecoveryControlChange} />;
  if (!action || (!ownerRecovery && !isNativeWorkspaceExportRepairCause(action.cause)) || action.ownerType !== "board"
    || !["active", "escalated"].includes(action.status) || typeof action.evidence.runId !== "string")
    return <ReportRecoveryControl owns={false} onChange={onRecoveryControlChange} />;
  const queued = !!action.evidence.workspaceOwnerStop || action.wakePolicy?.kind === "resume_native_run";
  const automatic = queued || (ownerRecovery && asObject(action.evidence.workspaceOwnerRecovery).state === "resuming");
  return <><ReportRecoveryControl owns={false} onChange={onRecoveryControlChange} />
    <p role="status" className={cn("text-sm text-muted-foreground", className)}>
      {automatic ? t("componentsWorkspaceExportRecovery.restoringSavedWork") : t("componentsWorkspaceExportRecovery.notRecoveredYet")}
    </p></>;
}

function isRetainedExport(action: IssueRecoveryAction, issueId: string, companyId: string) {
  return action.companyId === companyId && action.sourceIssueId === issueId
    && action.kind === "active_run_watchdog" && ["active", "escalated"].includes(action.status)
    && ["board", "system"].includes(action.ownerType)
    && isRetainedWorkspaceExportCause(action.cause)
    && typeof action.evidence.runId === "string" && action.evidence.runId.length > 0;
}

/** Saved-work recovery ended on a deterministic workspace state requiring user action before Retry. */
function userActionWorkspaceSaveRestCause(action: IssueRecoveryAction): "sandbox_disk_full" | "git_operation_in_progress" | null {
  const system = asObject(action.evidence.systemRecovery);
  const failure = asObject(system.failure);
  if (system.state !== "exhausted" || failure.retryClass !== "user_action_required") return null;
  const label = asObject(failure.cause).label;
  return label === "sandbox_disk_full" || label === "git_operation_in_progress" ? label : null;
}

function isControllerStopRequired(action: IssueRecoveryAction, issueId: string, companyId: string) {
  return action.companyId === companyId && action.sourceIssueId === issueId
    && action.ownerType === "board" && ["active", "escalated"].includes(action.status)
    && typeof action.evidence.runId === "string" && !action.evidence.controllerStop;
}

function isOwnerGoneRequired(action: IssueRecoveryAction, issueId: string, companyId: string) {
  return action.companyId === companyId && action.sourceIssueId === issueId
    && action.ownerType === "board" && ["active", "escalated"].includes(action.status)
    && typeof action.evidence.recordId === "string" && !action.evidence.ownerGone;
}

function isOwnerStopRequired(action: IssueRecoveryAction, issueId: string, companyId: string) {
  return action.companyId === companyId && action.sourceIssueId === issueId
    && action.ownerType === "board" && ["active", "escalated"].includes(action.status)
    && typeof action.evidence.runId === "string" && typeof asObject(action.evidence.owner).token === "string"
    && !action.evidence.workspaceOwnerStop && asObject(action.evidence.workspaceOwnerRecovery).state !== "resuming";
}

/** The exact receipt #19721 records when retained recovery waits on a stopped copyback owner. */
function retainedOwnerStopToken(action: IssueRecoveryAction): string | null {
  const hold = asObject(action.evidence.workspaceOwnerRecovery);
  const token = asObject(hold.owner).token;
  return hold.state === "operator_required" && !action.evidence.workspaceOwnerStop
    && typeof action.evidence.runId === "string" && typeof token === "string" && token.length > 0 ? token : null;
}

/** A previous server that can no longer report cannot confirm its own stop.
 * The board confirms it once; the saved result then finishes without another agent turn. */
export function PreviousServerStopConfirmation({ action, runId: givenRunId, formId: givenFormId, ownerToken, issueId, companyId, className, confirmStop, copy }: {
  action?: IssueRecoveryAction; runId?: string; formId?: string; issueId: string; companyId: string; className?: string;
  /** Saved-work copyback owner; used when no custom confirmation is given. */
  ownerToken?: string;
  confirmStop?: (stopEvidence: string) => Promise<unknown>;
  copy?: { waiting: string; question: string; placeholder: string; resuming: string; confirm?: string };
}) {
  const runId = givenRunId ?? action!.evidence.runId as string;
  const formId = givenFormId ?? action!.id;
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  const access = useQuery({ queryKey: queryKeys.access.currentBoardAccess,
    queryFn: () => accessApi.getCurrentBoardAccess() });
  const accessView = useQueryView(access);
  const canConfirm = (accessView.kind === "ready" || accessView.kind === "stale") && canBoardConfirmOwnerStop(companyId, access.data);
  const confirm = useMutation({ retry: false, // query-error-ok: an explicit board confirmation; the error is shown below.
    mutationFn: () => confirmStop ? confirmStop(evidence.trim())
      : issuesApi.resumeWorkspaceFinalization(issueId, { actionId: action!.id, runId, ownerToken: ownerToken!,
        controllerAndCopybackStopped: true, stopEvidence: evidence.trim() }),
    onSuccess: () => {
      setOpen(false);
      void client.invalidateQueries({ queryKey: queryKeys.issues.detail(issueId) });
      void client.invalidateQueries({ queryKey: queryKeys.issues.runs(issueId) });
      void client.invalidateQueries({ queryKey: queryKeys.runDetail(runId) });
    } });
  const ready = evidence.trim().length >= 20;
  return <div className={cn("flex flex-col gap-2 text-sm", className)} data-testid="previous-server-stop">
    <p role="status">{confirm.isSuccess ? copy?.resuming ?? t("componentsWorkspaceExportRecovery.restoringSavedWork")
      : copy?.waiting ?? t("componentsWorkspaceExportRecovery.stop.waiting")}</p>
    {confirm.isSuccess ? null : !canConfirm
      ? <p className="text-xs text-muted-foreground">{accessView.kind === "loading" || accessView.kind === "reconnecting"
        ? t("componentsWorkspaceExportRecovery.stop.checkingAccess") : t("componentsWorkspaceExportRecovery.stop.waitingConfirm")}</p>
      : !open ? <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
        {copy?.confirm ?? t("componentsWorkspaceExportRecovery.stop.confirmButton")}</Button>
      : <form className="flex flex-col gap-2" onSubmit={event => { event.preventDefault(); if (ready && !confirm.isPending) confirm.mutate(); }}>
        <label htmlFor={`previous-server-stop-${formId}`} className="text-xs text-muted-foreground">
          {copy?.question ?? t("componentsWorkspaceExportRecovery.stop.question")}</label>
        <Textarea id={`previous-server-stop-${formId}`} value={evidence} onChange={event => setEvidence(event.target.value)}
          placeholder={copy?.placeholder ?? t("componentsWorkspaceExportRecovery.stop.placeholder")} maxLength={12000} rows={3} />
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={confirm.isPending} onClick={() => setOpen(false)}>{t("componentsWorkspaceExportRecovery.cancel")}</Button>
          <Button type="submit" size="sm" disabled={!ready || confirm.isPending}>
            {confirm.isPending ? t("componentsWorkspaceExportRecovery.stop.confirming") : t("componentsWorkspaceExportRecovery.stop.confirmAndResume")}</Button>
        </div>
      </form>}
    {confirm.error ? <p role="alert" className="text-sm text-destructive">
      {confirm.error instanceof Error ? confirm.error.message : t("componentsWorkspaceExportRecovery.stop.notAccepted")}</p> : null}
  </div>;
}

type RecoveryInput = { actionId: string; runId: string };

/** Plain wording for a source inspection that did not verify. The code stays visible for support. */
function unverifiedSourceText(inspected: WorkspaceSourceInspection | undefined): string {
  if (!inspected || inspected.status === "verified") return "";
  if (inspected.status === "not_inspected")
    return t("componentsWorkspaceExportRecovery.source.notInspected");
  const code = inspected.sourceVerification?.reason ?? inspected.failureCode;
  return code === "allocation_ownership_ambiguous"
    ? t("componentsWorkspaceExportRecovery.source.ambiguous")
    : t("componentsWorkspaceExportRecovery.source.unverified", { code });
}

function RetainedFilesRecovery({ action, issueId, companyId, className, onRecoveryControlChange }: {
  action: IssueRecoveryAction; issueId: string; companyId: string; className?: string;
  onRecoveryControlChange?: (owns: boolean) => void;
}) {
  const runId = action.evidence.runId as string;
  const owner = useDraftOwner();
  const readOwner = useDraftOwnerReader();
  const client = useQueryClient();
  const busy = useRef(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [checkedUnconfirmed, setCheckedUnconfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const access = useQuery({ queryKey: queryKeys.access.currentBoardAccess,
    queryFn: () => accessApi.getCurrentBoardAccess() });
  const accessView = useQueryView(access);
  const accessReady = accessView.kind === "ready" || accessView.kind === "stale";
  const canMutate = Boolean(accessReady && owner && (access.data?.source === "local_implicit"
    || owner !== "signed-out" && access.data?.userId === owner)
    && canBoardResolveRecoveryAction(companyId, access.data));
  const source = useQuery({ queryKey: queryKeys.issues.recoveryActions(issueId, action.id, runId),
    queryFn: () => issuesApi.recoveryActions(issueId, { runId, actionId: action.id }), enabled: canMutate });
  const sourceView = useQueryView(source);
  const sourceReady = sourceView.kind === "ready" || sourceView.kind === "stale";
  const storageKey = owner ? pendingSendKeyFor(`workspace-file-recovery:${companyId}:${issueId}:${action.id}:${runId}`, owner) : null;
  const matchesInput = (value: unknown): value is RecoveryInput => {
    const input = asObject(value);
    return input.actionId === action.id && input.runId === runId;
  };
  const pending = storageKey ? readPendingSend(storageKey, matchesInput) : null;
  // The recovery record is bound by its own identity. Source inspection is a
  // separate read-only probe: it gates only the physical file-recovery request.
  // It legitimately reports "blocked" after files were recovered, or when a
  // sandbox predates ownership receipts; the recorded state stays authoritative.
  function boundAction(data: typeof source.data) {
    const current = data?.actions.find(item => item.id === action.id);
    const inspected = data?.sourceInspection;
    const state = asObject(current?.evidence.workspaceRecovery);
    return current && isRetainedExport(current, issueId, companyId) && current.evidence.runId === runId
      && state.runId === runId && state.schema === "paperclip.workspace-recovery.v1"
      && inspected?.actionId === action.id && inspected.runId === runId ? current : null;
  }
  const sourceVerified = (data: typeof source.data) => Boolean(boundAction(data)) && data?.sourceInspection?.status === "verified";
  const current = sourceReady ? boundAction(source.data) : null;
  const verified = sourceReady && sourceVerified(source.data);
  const recovery = asObject(current?.evidence.workspaceRecovery);
  const system = asObject(current?.evidence.systemRecovery);
  const serverAcknowledged = Boolean(pending && Array.isArray(recovery.requestIds) && recovery.requestIds.includes(pending.idempotencyKey));
  const restoring = ["queued", "recovering"].includes(String(recovery.status));
  const saved = recovery.status === "recovered" && system.state === "complete"
    && Array.isArray(system.preservationOperationIds) && system.preservationOperationIds.length > 0
    && system.preservationOperationIds.every(id => typeof id === "string" && id.length > 0);
  const retryable = recovery.status === "blocked" && recovery.retryable === true;
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: queryKeys.issues.detail(issueId) });
    void client.invalidateQueries({ queryKey: queryKeys.issues.runs(issueId) });
    void client.invalidateQueries({ queryKey: queryKeys.runDetail(runId) });
  };
  const request = useMutation({ retry: false, mutationFn: async (restartFailedAttempt: boolean) => { // query-error-ok: recovery requests require an explicit action and receipt reconciliation.
    if (busy.current) return;
    busy.current = true;
    setNotice(null);
    setCheckedUnconfirmed(false);
    setAcknowledged(false);
    try {
      const observed = await source.refetch();
      const fresh = boundAction(observed.data);
      const state = asObject(fresh?.evidence.workspaceRecovery);
      if (observed.error || !fresh || state.status !== "blocked" || state.retryable !== true)
        throw new Error(t("componentsWorkspaceExportRecovery.errors.changed"));
      if (!sourceVerified(observed.data))
        throw new Error(unverifiedSourceText(observed.data?.sourceInspection) || t("componentsWorkspaceExportRecovery.errors.sourceNotVerified"));
      if (!canMutate || !owner || readOwner() !== owner || !storageKey)
        throw new Error(t("componentsWorkspaceExportRecovery.errors.accountChanged"));
      const previous = readPendingSend(storageKey, matchesInput);
      if (restartFailedAttempt && (!previous || !Array.isArray(state.requestIds)
        || !state.requestIds.includes(previous.idempotencyKey)
        || asObject(fresh.evidence.systemRecovery).state !== "exhausted"))
        throw new Error(t("componentsWorkspaceExportRecovery.errors.previousNotConfirmed"));
      // Unknown acceptance reuses its identity. A new bounded request requires
      // an explicit operator click and a freshly confirmed exhausted attempt.
      const record = (!restartFailedAttempt && previous) || {
        idempotencyKey: createUuid(), payload: { actionId: action.id, runId }, createdAt: Date.now(),
      };
      if (!writePendingSend(storageKey, record))
        throw new Error(t("componentsWorkspaceExportRecovery.errors.couldNotSave"));
      try {
        const result = await issuesApi.recoverWorkspace(issueId, { ...record.payload, idempotencyKey: record.idempotencyKey });
        if (result.actionId !== action.id || !["queued", "recovering", "blocked", "recovered"].includes(result.status))
          throw new Error(t("componentsWorkspaceExportRecovery.errors.ackNotConfirmed"));
        setAcknowledged(true);
        setCheckedUnconfirmed(false);
        invalidate();
        await source.refetch();
      } catch (error) {
        setNotice(classifySendFailure(error) === "rejected"
          ? t("componentsWorkspaceExportRecovery.errors.requestNotConfirmed", { reason: error instanceof Error ? error.message : t("componentsWorkspaceExportRecovery.errors.inspectStatus") })
          : t("componentsWorkspaceExportRecovery.errors.requestCouldNotConfirm"));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("componentsWorkspaceExportRecovery.errors.unableToInspect"));
    } finally { busy.current = false; }
  } });
  const check = useMutation({ retry: false, mutationFn: async () => { // query-error-ok: operator checks run once; the source read uses the shared query retry policy.
    const observed = await source.refetch();
    if (observed.error) throw observed.error;
    const fresh = boundAction(observed.data);
    if (!fresh) {
      // The task's current recovery replaced this record. Reload the task so it
      // shows that recovery, instead of asking for a refresh that changes nothing.
      invalidate();
      throw new Error(t("componentsWorkspaceExportRecovery.errors.replaced"));
    }
    const state = asObject(fresh.evidence.workspaceRecovery);
    const ids = state.requestIds;
    const unconfirmed = Boolean(pending && Array.isArray(ids) && !ids.includes(pending.idempotencyKey));
    setCheckedUnconfirmed(unconfirmed);
    setNotice(unconfirmed ? t("componentsWorkspaceExportRecovery.errors.noneConfirmed") : null);
    invalidate();
  } });
  const checkError = isTransientError(check.error) ? null : check.error;
  const failedReceipt = serverAcknowledged && recovery.status === "blocked";
  const confirmedFailedAttempt = failedReceipt && retryable && system.state === "exhausted";
  const waiting = !failedReceipt && !saved && (restoring || acknowledged || serverAcknowledged);
  const unconfirmed = Boolean(pending && !acknowledged && !serverAcknowledged);
  const sourceLoading = sourceView.kind === "loading" || sourceView.kind === "reconnecting";
  // A save that rested on a deterministic workspace state (such as a full
  // sandbox disk or an in-progress Git operation) is resumed by the task's
  // Retry, which saves the files again and then applies the saved result. Its
  // note names Retry, so this panel offers no separate control for it.
  const userActionSaveRest = userActionWorkspaceSaveRestCause(current ?? action);
  // A verified source makes this panel the governed recovery path. Otherwise the
  // task's own Retry (renewed, re-verified recovery) remains the next action.
  const ownsRecoveryControl = canMutate && !userActionSaveRest && (sourceLoading || Boolean(current && verified && !saved));
  // `waiting` already excludes a failed accepted request, so the reason stays
  // visible after a failed attempt and hides only while recovery is running.
  const unverified = Boolean(current && !verified && !saved && !waiting);
  return <div className={cn("flex flex-col gap-2 text-sm", className)} data-testid="retained-file-recovery">
    <ReportRecoveryControl owns={ownsRecoveryControl} onChange={onRecoveryControlChange} />
    <p role="status">{saved ? t("componentsWorkspaceExportRecovery.retained.saved")
      : userActionSaveRest === "sandbox_disk_full" && !waiting
        ? t("componentsWorkspaceExportRecovery.retained.diskFull")
      : userActionSaveRest === "git_operation_in_progress" && !waiting
        ? t("componentsWorkspaceExportRecovery.retained.gitInProgress")
      : failedReceipt ? t("componentsWorkspaceExportRecovery.retained.failedReceipt")
      : restoring ? t("componentsWorkspaceExportRecovery.retained.restoring")
        : waiting ? t("componentsWorkspaceExportRecovery.retained.waiting")
          : t("componentsWorkspaceExportRecovery.retained.needsRecovery")}</p>
    {canMutate ? <>
      {current && verified && retryable && !waiting && !userActionSaveRest && (!pending || unconfirmed && checkedUnconfirmed || confirmedFailedAttempt) ? <Button variant="outline" size="sm"
        className="self-start" disabled={request.isPending || check.isPending}
        onClick={() => request.mutate(confirmedFailedAttempt)}>{request.isPending ? t("componentsWorkspaceExportRecovery.retained.requesting")
          : confirmedFailedAttempt ? t("componentsWorkspaceExportRecovery.retained.tryAgain") : t("componentsWorkspaceExportRecovery.retained.recover")}</Button> : null}
      {waiting || unconfirmed || failedReceipt || source.error || sourceReady && !current ? <Button variant="ghost" size="sm" className="self-start"
        disabled={request.isPending || check.isPending} onClick={() => check.mutate()}>
        {check.isPending ? t("componentsWorkspaceExportRecovery.retained.checking") : t("componentsWorkspaceExportRecovery.retained.checkStatus")}
      </Button> : null}
      {sourceView.kind === "loading" || sourceView.kind === "reconnecting" ? <p className="text-xs text-muted-foreground">{t("componentsWorkspaceExportRecovery.retained.inspecting")}</p> : null}
      {sourceView.kind === "error" || checkError || notice ? <p role="alert" className="text-sm text-destructive">
        {notice ?? (checkError instanceof Error ? checkError.message : t("componentsWorkspaceExportRecovery.retained.couldNotInspect"))}
      </p> : null}
      {current && recovery.status === "blocked" && (serverAcknowledged || recovery.retryable !== true)
        ? <p role="alert">{t("componentsWorkspaceExportRecovery.retained.notFinished")}</p> : null}
      {unverified ? <p role="status" className="text-muted-foreground">
        {unverifiedSourceText(source.data?.sourceInspection)} {t("componentsWorkspaceExportRecovery.retained.doesNotApply")}
      </p> : null}
      {sourceReady && !current ? <p role="alert">{t("componentsWorkspaceExportRecovery.retained.replaced")}</p> : null}
    </> : accessView.kind === "error" ? <p role="alert" className="text-sm text-destructive">{t("componentsWorkspaceExportRecovery.retained.accessError")}</p>
      : accessView.kind === "loading" || accessView.kind === "reconnecting" || !owner ? <p role="status" className="text-xs text-muted-foreground">{t("componentsWorkspaceExportRecovery.retained.checkingAccess")}</p>
        : <p className="text-xs text-muted-foreground">{t("componentsWorkspaceExportRecovery.retained.boardMemberCan")}</p>}
  </div>;
}
