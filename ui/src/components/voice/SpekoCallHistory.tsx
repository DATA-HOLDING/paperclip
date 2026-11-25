import { t } from "@/i18n";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { VoiceCallHistoryEntry, VoiceCallReport, VoiceUnapprovedCallHistoryEntry } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { voiceSessionsApi } from "@/api/voiceSessions";
import { voicePhoneApi } from "@/api/voicePhone";
import { voiceHistoryApi } from "@/api/voiceHistory";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { cn } from "@/lib/utils";

function charge(amount: string | null) {
  if (amount === null) return t("componentsVoice.history.notYetReported");
  const value = BigInt(amount);
  const whole = value / 1_000_000n, fraction = (value % 1_000_000n).toString().padStart(6, "0");
  return t("componentsVoice.history.chargeUsd", { amount: `${whole}.${fraction}` });
}
export function SpekoCallReport({ report }: { report: VoiceCallReport }) {
  return <div className="space-y-3">
    <dl className="flex flex-wrap gap-4 text-sm"><div><dt className="text-muted-foreground">{t("componentsVoice.history.spekoCharge")}</dt><dd>{charge(report.costMicroUsd)}</dd></div>{report.durationSeconds !== null && <div><dt className="text-muted-foreground">{t("componentsVoice.history.duration")}</dt><dd>{t("componentsVoice.history.seconds", { count: report.durationSeconds })}</dd></div>}</dl>
    <p className="text-xs text-muted-foreground">{t("componentsVoice.history.agentCostsSeparate")}</p>
    {report.transcript.length ? <ol aria-label={t("componentsVoice.history.callTranscript")} className={cn("space-y-3", ANALYTICS_MASK_CLASS)}>{report.transcript.map(turn => <li key={turn.id} className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{turn.speaker === "caller" ? t("componentsVoice.history.you") : t("componentsVoice.history.agent")}{turn.interrupted ? t("componentsVoice.history.interruptedSuffix") : ""}</p><p className="whitespace-pre-wrap break-words text-sm">{turn.text}</p></li>)}</ol>
      : <p className="text-sm text-muted-foreground">{report.status === "unavailable" ? t("componentsVoice.history.transcriptUnavailable") : report.status === "pending" ? t("componentsVoice.history.transcriptPending") : t("componentsVoice.history.transcriptMissing")}</p>}
  </div>;
}
const modeNames = { browser: t("componentsVoice.history.mode.browser"), inbound_phone: t("componentsVoice.history.mode.inboundPhone"), outbound_phone: t("componentsVoice.history.mode.outboundPhone") } as const;
const stateNames = { reserved: t("componentsVoice.history.state.reserved"), creating: t("componentsVoice.history.state.connecting"), creation_unknown: t("componentsVoice.history.state.creationUnknown"), connecting: t("componentsVoice.history.state.connecting"), active: t("componentsVoice.history.state.active"), awaiting_approval: t("componentsVoice.history.state.awaitingApproval"), ending: t("componentsVoice.history.state.ending"), ended: t("componentsVoice.history.state.ended"), failed: t("componentsVoice.history.state.failed"), expired: t("componentsVoice.history.state.expired") } as const;
export function SpekoCallActivityItem({ entry: { session, report }, onEnd, ending, presentation = "history" }: { entry: VoiceCallHistoryEntry; onEnd?(sessionId: string): void; ending?: boolean; presentation?: "history" | "activity" }) {
  const summary = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (restoreFocus.current && ["ended", "failed", "expired"].includes(session.state)) { summary.current?.focus(); restoreFocus.current = false; }
  }, [session.state]);
  return <details data-activity-kind="call" className={presentation === "activity" ? "px-2 py-3 transition-colors hover:bg-accent/50" : "rounded-md border border-border p-3"}>
    <summary ref={summary} className="cursor-pointer break-words text-sm font-medium">{modeNames[session.mode]} · {stateNames[session.state]}<span className="ml-2 text-xs font-normal text-muted-foreground">{new Date(session.createdAt).toLocaleString()}</span></summary>
    <div className="mt-3 space-y-3"><Link className="text-sm text-primary underline" to={`/issues/${encodeURIComponent(session.issueId)}`}>{t("componentsVoice.history.conversationTask")}</Link>
      {session.errorCode && <p className="text-sm text-muted-foreground">{session.errorCode === "cleanup_pending" ? t("componentsVoice.history.cleanupPending") : t("componentsVoice.history.connectionProblem")}</p>}
      {!session.endedAt && !["ended", "failed", "expired"].includes(session.state) && session.callerAuthority !== "guest_intake" && onEnd && <Button size="sm" variant="outline" disabled={ending} onClick={() => { restoreFocus.current = true; onEnd(session.id); }}>{ending ? t("componentsVoice.history.endingCall") : t("componentsVoice.history.endCall")}</Button>}
      <SpekoCallReport report={report} />
    </div>
  </details>;
}
export function SpekoUnapprovedCallActivityItem({ call, presentation = "history" }: { call: VoiceUnapprovedCallHistoryEntry; presentation?: "history" | "activity" }) {
  return <div data-activity-kind="unapproved_call" className={presentation === "activity" ? "px-2 py-3 text-sm" : "rounded-md border border-border p-3 text-sm"}><p>{call.state === "denied" ? t("componentsVoice.history.callDenied") : call.state === "expired" ? t("componentsVoice.history.approvalExpired") : t("componentsVoice.history.missedCall")} · {new Date(call.createdAt).toLocaleString()}</p><p className="text-xs text-muted-foreground">{t("componentsVoice.history.noPrivateTask")}</p></div>;
}
export interface SpekoCallHistoryViewProps { entries?: VoiceCallHistoryEntry[]; unapprovedCalls?: VoiceUnapprovedCallHistoryEntry[]; loading?: boolean; error?: string; incomingError?: string; endError?: string; onRetry(): void; onEnd?(sessionId: string): void; endingSessionId?: string }
export function SpekoCallHistoryView({ entries = [], unapprovedCalls = [], loading, error, incomingError, endError, onRetry, onEnd, endingSessionId }: SpekoCallHistoryViewProps) {
  return <section className="max-w-xl space-y-3" aria-label={t("componentsVoice.history.yourCalls")}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t("componentsVoice.history.yourCalls")}</h2><Button size="sm" variant="ghost" onClick={onRetry} disabled={loading}>{t("componentsVoice.history.refresh")}</Button></div>
    {loading && <p role="status" className="text-sm text-muted-foreground">{t("componentsVoice.history.loadingCalls")}</p>}
    {error && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={onRetry}>{t("componentsVoice.history.tryAgain")}</Button></div>}
    {incomingError && <p role="alert" className="text-sm text-destructive">{t("componentsVoice.history.unapprovedLoadError")} {incomingError}</p>}
    {endError && <p role="alert" className="text-sm text-destructive">{t("componentsVoice.history.endError")} {endError}</p>}
    {!loading && !error && !incomingError && !entries.length && !unapprovedCalls.length && <p className="text-sm text-muted-foreground">{t("componentsVoice.history.empty")}</p>}
    {!error && entries.map(entry => <SpekoCallActivityItem key={entry.session.id} entry={entry} onEnd={onEnd} ending={endingSessionId === entry.session.id} />)}
    {!incomingError && unapprovedCalls.length > 0 && <div className="space-y-2"><h3 className="text-sm font-medium">{t("componentsVoice.history.unapprovedIncoming")}</h3><ul className="space-y-2">{unapprovedCalls.map(call => <li key={call.id}><SpekoUnapprovedCallActivityItem call={call} /></li>)}</ul></div>}
  </section>;
}
export function useSpekoCallHistory(companyId: string, endpointId: string, enabled = true) {
  const query = useQuery({ queryKey: ["speko-history", companyId, endpointId], queryFn: () => voiceHistoryApi.list(companyId, endpointId), enabled, refetchInterval: enabled ? 30_000 : false });
  const incoming = useQuery({queryKey: ["speko-unapproved-history", companyId, endpointId], queryFn: () => voicePhoneApi.history(companyId, endpointId), enabled: enabled && query.isSuccess, refetchInterval: enabled ? 30_000 : false});
  const ending = useMutation({mutationFn: (sessionId: string) => voiceSessionsApi.end(companyId, sessionId), onSuccess: () => query.refetch()});
  return { entries: query.data ?? [], unapprovedCalls: incoming.data ?? [], loading: query.isLoading || incoming.isLoading, error: query.error?.message, incomingError: incoming.error?.message, endError: ending.error?.message, endingSessionId: ending.isPending ? ending.variables : undefined,
    onEnd: (sessionId: string) => ending.mutate(sessionId), onRetry: () => { ending.reset(); void query.refetch(); void incoming.refetch(); } };
}
export function SpekoCallHistory({ companyId, endpointId }: { companyId: string; endpointId: string }) {
  return <SpekoCallHistoryView {...useSpekoCallHistory(companyId, endpointId)} />;
}
