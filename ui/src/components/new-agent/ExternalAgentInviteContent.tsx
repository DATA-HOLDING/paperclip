import { useId } from "react";
import { AGENT_ROLES, AGENT_ROLE_LABELS } from "@paperclipai/shared";
import type { MuseInvitationDraft } from "@/lib/muse-invitation-draft";
import { Input } from "../ui/input";
import { Link } from "@/lib/router";
import { ArrowLeft, Bot, Check, Circle, CircleAlert, Loader2 } from "lucide-react";
import { AdapterMark } from "../AdapterMark";
import { AgentSetupPrompt } from "../AgentSetupPrompt";
import { Button } from "../ui/button";
import { DialogDescription, DialogTitle } from "../ui/dialog";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

export type ExternalAgentPreset = "dot" | "grok_bot" | "muse" | "hermes" | "other";
export type DotConnectionState = {
  phase: "waiting" | "connected" | "subscribed" | "testing" | "finishing" | "ready";
  problem?: "event_timeout" | "prompt_unavailable" | "offline" | "agent_unavailable";
};

const presets = [
  { id: "dot", name: "Dot", adapter: "openai_dot", description: t("componentsNewAgent.externalInvite.presets.dotDescription") },
  { id: "grok_bot", name: "Grok Bot", adapter: "grok_bot", description: t("componentsNewAgent.externalInvite.presets.grokBotDescription") },
  { id: "muse", name: t("componentsNewAgent.externalInvite.presets.museName"), adapter: "muse", description: t("componentsNewAgent.externalInvite.presets.museDescription") },
  { id: "hermes", name: "Hermes", adapter: "hermes_gateway", description: t("componentsNewAgent.externalInvite.presets.hermesDescription") },
  { id: "other", name: t("componentsNewAgent.externalInvite.presets.otherName"), adapter: "http", description: t("componentsNewAgent.externalInvite.presets.otherDescription") },
] as const;

export function ExternalAgentPresetPicker({ onSelect, dotDisabledReason, grokDisabledReason, museEnabled = false }: { onSelect: (preset: ExternalAgentPreset) => void; dotDisabledReason?: string; grokDisabledReason?: string; museEnabled?: boolean }) {
  return <div className={cn("grid grid-cols-2 gap-3", !museEnabled && "sm:grid-cols-4")}>
    {presets.filter(preset => preset.id !== "muse" || museEnabled).map(preset => <button
      key={preset.id}
      type="button"
      onClick={() => onSelect(preset.id)}
      disabled={preset.id === "dot" && !!dotDisabledReason || preset.id === "grok_bot" && !!grokDisabledReason}
      title={preset.id === "dot" ? dotDisabledReason : preset.id === "grok_bot" ? grokDisabledReason : undefined}
      className="flex aspect-square flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-3 py-4 text-center transition-colors disabled:opacity-50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <AdapterMark type={preset.adapter} className="size-8" />
      <span className="text-sm font-medium">{preset.name}</span>
      <span className="sr-only">{preset.description}</span>
    </button>)}
  </div>;
}

const checks = [
  { title: t("componentsNewAgent.externalInvite.dotChecks.connected.title"), description: t("componentsNewAgent.externalInvite.dotChecks.connected.description") },
  { title: t("componentsNewAgent.externalInvite.dotChecks.updates.title"), description: t("componentsNewAgent.externalInvite.dotChecks.updates.description") },
  { title: t("componentsNewAgent.externalInvite.dotChecks.test.title"), description: t("componentsNewAgent.externalInvite.dotChecks.test.description") },
];

/** Controlled by server evidence in the invite controller, never by copying a prompt. */
export function DotConnectionChecks({ state }: { state: DotConnectionState }) {
  const completed = { waiting: 0, connected: 1, subscribed: 2, testing: 2, finishing: 3, ready: 3 }[state.phase];
  const message = state.problem === "agent_unavailable" ? t("componentsNewAgent.externalInvite.dotMessages.agentUnavailable")
    : state.problem === "offline" ? t("componentsNewAgent.externalInvite.dotMessages.offline")
    : state.problem === "prompt_unavailable" ? t("componentsNewAgent.externalInvite.dotMessages.promptUnavailable")
    : state.problem === "event_timeout" ? t("componentsNewAgent.externalInvite.dotMessages.eventTimeout")
    : state.phase === "finishing" ? t("componentsNewAgent.externalInvite.dotMessages.finishing")
    : state.phase === "ready" ? t("componentsNewAgent.externalInvite.dotMessages.ready")
    : state.phase === "waiting" ? t("componentsNewAgent.externalInvite.dotMessages.waiting")
    : state.phase === "connected" ? t("componentsNewAgent.externalInvite.dotMessages.connected")
    : t("componentsNewAgent.externalInvite.dotMessages.testing");
  return <section aria-label={t("componentsNewAgent.externalInvite.dotChecksLabel")} className="space-y-4">
    <ol className="space-y-4">
      {checks.map((check, index) => {
        const done = index < completed;
        const failed = index === completed && state.problem === "event_timeout";
        const active = index === completed && !state.problem;
        const Icon = done ? Check : failed ? CircleAlert : active ? Loader2 : Circle;
        return <li key={check.title} className="flex items-start gap-3" aria-current={active ? "step" : undefined}>
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", done ? "bg-accent text-foreground" : failed ? "text-destructive" : "text-muted-foreground")}>
            <Icon className={cn("size-4", active && "animate-spin motion-reduce:animate-none")} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={cn("text-sm", done || active || failed ? "font-medium" : "text-muted-foreground")}>
              {check.title}<span className="sr-only">{done ? t("componentsNewAgent.externalInvite.checkState.complete") : failed ? t("componentsNewAgent.externalInvite.checkState.needsAttention") : active ? t("componentsNewAgent.externalInvite.checkState.inProgress") : t("componentsNewAgent.externalInvite.checkState.waiting")}</span>
            </p>
            {done && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{check.description}</p>}
          </div>
        </li>;
      })}
    </ol>
    <p role={state.problem && state.problem !== "prompt_unavailable" ? "alert" : "status"} aria-live="polite" className={cn("text-sm leading-relaxed", state.problem && state.problem !== "prompt_unavailable" ? "text-destructive" : "text-muted-foreground")}>{message}</p>
  </section>;
}

export type MuseConnectionState = {
  paired: boolean;
  receiverDetected: boolean;
  backgroundReplyVerified: boolean;
  ready: boolean;
  finishing?: boolean;
  testing?: boolean;
  problem?: "no_recent_response" | "prompt_unavailable" | "offline" | "agent_unavailable" | "disconnected" | "disabled" | "connection_expired";
};

/** Receiver contact is separate from an authenticated, independent worker reply. */
export function MuseConnectionChecks({ state }: { state: MuseConnectionState }) {
  const milestones = [
    { title: t("componentsNewAgent.externalInvite.museChecks.paired.title"), done: state.paired, description: t("componentsNewAgent.externalInvite.museChecks.paired.description") },
    { title: t("componentsNewAgent.externalInvite.museChecks.receiver.title"), done: state.receiverDetected, description: t("componentsNewAgent.externalInvite.museChecks.receiver.description") },
    { title: t("componentsNewAgent.externalInvite.museChecks.background.title"), done: state.backgroundReplyVerified, description: t("componentsNewAgent.externalInvite.museChecks.background.description") },
  ];
  const checksPassed = milestones.every(item => item.done);
  const message = state.problem === "offline" ? t("componentsNewAgent.externalInvite.museMessages.offline")
    : state.problem === "disconnected" ? t("componentsNewAgent.externalInvite.museMessages.disconnected")
    : state.problem === "connection_expired" ? t("componentsNewAgent.externalInvite.museMessages.expired")
    : state.problem === "disabled" ? t("componentsNewAgent.externalInvite.museMessages.disabled")
    : state.problem === "prompt_unavailable" ? t("componentsNewAgent.externalInvite.museMessages.promptUnavailable")
    : state.problem === "agent_unavailable" ? t("componentsNewAgent.externalInvite.museMessages.agentUnavailable")
    : state.problem === "no_recent_response" ? t("componentsNewAgent.externalInvite.museMessages.noRecentResponse")
    : state.testing ? t("componentsNewAgent.externalInvite.museMessages.testing")
    : checksPassed && state.ready ? t("componentsNewAgent.externalInvite.museMessages.ready")
    : checksPassed ? t("componentsNewAgent.externalInvite.museMessages.finishing")
    : !state.paired ? t("componentsNewAgent.externalInvite.museMessages.waitingPair")
    : !state.receiverDetected ? t("componentsNewAgent.externalInvite.museMessages.paired")
    : t("componentsNewAgent.externalInvite.museMessages.receiverDetected");
  return <section aria-label={t("componentsNewAgent.externalInvite.museChecksLabel")} className="space-y-4">
    <ol className="space-y-4">
      {milestones.map(item => <li key={item.title} className="flex items-start gap-3">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", item.done ? "bg-accent text-foreground" : "text-muted-foreground")}>
          {item.done ? <Check className="size-4" /> : <Circle className="size-4" />}
        </span>
        <div className="min-w-0 pt-0.5">
          <p className={cn("text-sm", item.done ? "font-medium" : "text-muted-foreground")}>
            {item.title}<span className="sr-only">{item.done ? t("componentsNewAgent.externalInvite.checkState.complete") : t("componentsNewAgent.externalInvite.checkState.waiting")}</span>
          </p>
          {item.done && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>}
        </div>
      </li>)}
    </ol>
    <p role="status" aria-live="polite" className="text-sm leading-relaxed text-muted-foreground">{message}</p>
  </section>;
}

/** Shared presentation for the invitation flow. The caller owns invitations and watching. */
export function ExternalAgentInviteContent({
  preset, prompt, companyName, connection, onSelect, onBack, onClose, onCopied, onRetry, onNewPrompt,
  dotDisabledReason, grokDisabledReason, busy = false, error, approvalHref, museEnabled = false, museConnection, museDraft, onMuseDraftChange, onMuseContinue,
}: {
  museEnabled?: boolean;
  museConnection?: MuseConnectionState;
  museDraft?: MuseInvitationDraft;
  onMuseDraftChange?: (draft: MuseInvitationDraft) => void;
  onMuseContinue?: () => void;
  dotDisabledReason?: string;
  grokDisabledReason?: string;
  busy?: boolean;
  error?: string;
  approvalHref?: string;
  preset: ExternalAgentPreset | null;
  prompt: string;
  companyName: string;
  connection: DotConnectionState;
  onSelect: (preset: ExternalAgentPreset) => void;
  onBack: () => void;
  onClose: () => void;
  onCopied: () => void;
  onRetry: () => void;
  onNewPrompt: () => void;
}) {
  const detailsId = useId();
  const muse = preset === "muse";
  const museDetails = muse && !!museDraft;
  const museAwaitingInvitation = muse && !museDetails && !museConnection && !approvalHref;
  const museReady = muse && !!museConnection?.ready && museConnection.paired && museConnection.receiverDetected && museConnection.backgroundReplyVerified && !museConnection.problem && !museConnection.testing;
  const provider = presets.find(item => item.id === preset);
  const dot = preset === "dot";
  const ready = museReady || (dot && connection.phase === "ready" && !connection.problem);
  const connecting = dot && connection.phase !== "waiting";
  const progressLabel = connection.problem === "agent_unavailable" ? t("componentsNewAgent.externalInvite.progress.agentUnavailable")
    : connection.problem === "offline" ? t("componentsNewAgent.externalInvite.progress.updatesPaused")
    : connection.problem === "event_timeout" ? t("componentsNewAgent.externalInvite.progress.needsAttention")
    : connection.phase === "finishing" ? t("componentsNewAgent.externalInvite.progress.finishing")
    : connection.phase === "connected" ? t("componentsNewAgent.externalInvite.progress.connecting") : t("componentsNewAgent.externalInvite.progress.confirming");
  return <>
    <div className="min-h-0 space-y-6 overflow-y-auto px-6 pb-6 pt-8 sm:px-8">
      <div className="space-y-3 pr-5">
        {muse && <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" />{t("componentsNewAgent.externalInvite.back")}</Button>}
        {provider && <AdapterMark type={provider.adapter} className="size-10" />}
        <div className="space-y-2">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {!provider ? t("componentsNewAgent.externalInvite.title.invite") : muse ? ready ? t("componentsNewAgent.externalInvite.title.museConnected") : museDetails || museAwaitingInvitation ? t("componentsNewAgent.externalInvite.title.inviteMuse") : t("componentsNewAgent.externalInvite.title.connectMuse") : dot ? ready ? t("componentsNewAgent.externalInvite.title.dotConnected") : t("componentsNewAgent.externalInvite.title.connectDot") : preset === "hermes" ? t("componentsNewAgent.externalInvite.title.inviteHermes") : t("componentsNewAgent.externalInvite.title.inviteAgent")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {!provider ? t("componentsNewAgent.externalInvite.description.bring", { companyName })
              : muse ? museDetails ? t("componentsNewAgent.externalInvite.description.museDetails", { companyName })
              : museAwaitingInvitation ? t("componentsNewAgent.externalInvite.description.museRequires")
              : ready ? t("componentsNewAgent.externalInvite.description.museReady", { companyName })
              : !prompt && !museConnection?.paired ? t("componentsNewAgent.externalInvite.description.museChecking")
              : t("componentsNewAgent.externalInvite.description.musePaste")
              : ready ? t("componentsNewAgent.externalInvite.description.dotReady", { companyName })
              : connection.problem === "agent_unavailable" ? t("componentsNewAgent.externalInvite.description.dotAgentUnavailable")
              : connection.phase === "finishing" ? t("componentsNewAgent.externalInvite.description.dotFinishing")
              : connecting ? t("componentsNewAgent.externalInvite.description.dotConnecting")
              : dot ? t("componentsNewAgent.externalInvite.description.dotCopy")
              : preset === "hermes" ? t("componentsNewAgent.externalInvite.description.hermesCopy") : t("componentsNewAgent.externalInvite.description.agentCopy")}
          </DialogDescription>
        </div>
      </div>
      {error && <div role="alert" className="space-y-3 text-sm text-destructive"><p>{error}</p>{!museAwaitingInvitation && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("componentsNewAgent.externalInvite.tryAgain")}</Button>}</div>}
      {!provider ? <><ExternalAgentPresetPicker onSelect={onSelect} dotDisabledReason={dotDisabledReason} grokDisabledReason={grokDisabledReason} museEnabled={museEnabled} />
        {dotDisabledReason && <p className="text-sm text-muted-foreground">{dotDisabledReason}</p>}{grokDisabledReason && grokDisabledReason !== dotDisabledReason && <p className="text-sm text-muted-foreground">{grokDisabledReason}</p>}</>
        : approvalHref ? <p className="text-sm text-muted-foreground">{t("componentsNewAgent.externalInvite.needsApproval", { agent: muse ? "Muse" : "Dot" })}</p>
        : museAwaitingInvitation ? busy ? <p role="status" className="text-sm text-muted-foreground">{t("componentsNewAgent.externalInvite.loadingMuseInvitation")}</p> : null
        : muse && busy && !museDetails && !prompt && !museConnection?.paired ? <p role="status" className="text-sm text-muted-foreground">{t("componentsNewAgent.externalInvite.loadingMuseSetup")}</p>
        : museDetails ? <form id={detailsId} className="space-y-4" onSubmit={event => { event.preventDefault(); if (museDraft.name.trim() && !busy) onMuseContinue?.(); }}>
          <div className="space-y-2">
            <label htmlFor={`${detailsId}-name`} className="text-sm font-medium">{t("componentsNewAgent.externalInvite.museForm.name")}</label>
            <Input id={`${detailsId}-name`} disabled={busy} autoFocus maxLength={100} value={museDraft.name} placeholder="Muse" onChange={event => onMuseDraftChange?.({ ...museDraft, name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <label htmlFor={`${detailsId}-role`} className="text-sm font-medium">{t("componentsNewAgent.externalInvite.museForm.role")}</label>
            <select id={`${detailsId}-role`} disabled={busy} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={museDraft.role} onChange={event => {
              const role = AGENT_ROLES.find(value => value === event.target.value);
              if (role) onMuseDraftChange?.({ ...museDraft, role });
            }}>{AGENT_ROLES.map(role => <option key={role} value={role}>{AGENT_ROLE_LABELS[role]}</option>)}</select>
          </div>
          <p className="text-xs text-muted-foreground">{t("componentsNewAgent.externalInvite.museForm.toolsNote")}</p>
        </form>
        : muse && museConnection ? <>
          <MuseConnectionChecks state={museConnection} />
          {museConnection.problem === "no_recent_response" && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("componentsNewAgent.externalInvite.museActions.testReply")}</Button>}
          {museConnection.problem === "offline" && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("componentsNewAgent.externalInvite.museActions.refresh")}</Button>}
          {!museConnection.paired && <a href="https://muse.ai" target="_blank" rel="noopener noreferrer" className="inline-flex text-sm text-foreground underline underline-offset-4">{t("componentsNewAgent.externalInvite.museActions.open")}</a>}
          <p className="text-xs text-muted-foreground">{t("componentsNewAgent.externalInvite.museActions.note")}</p>
        </>
        : busy && !prompt && connection.phase === "waiting" ? <p role="status" className="text-sm text-muted-foreground">{t("componentsNewAgent.externalInvite.preparingInvitation")}</p> : dot ? <>
        <div className="border-t pt-6"><DotConnectionChecks state={connection} />
          {connection.phase === "waiting" && <p className="mt-4 text-xs text-muted-foreground">{t("componentsNewAgent.externalInvite.dotNote")}</p>}</div>
        {connection.problem === "event_timeout" && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("componentsNewAgent.externalInvite.dotActions.retryTest")}</Button>}
        {connection.problem === "offline" && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("componentsNewAgent.externalInvite.dotActions.reconnect")}</Button>}
      </> : <p className="text-sm leading-relaxed text-muted-foreground">{t("componentsNewAgent.externalInvite.otherNote", { companyName })}</p>}
    </div>
    <div className="flex items-center justify-between gap-3 border-t px-6 py-4 sm:px-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={muse ? onClose : provider ? onBack : onClose}>
          {provider && !muse && <ArrowLeft className="size-4" />}{muse ? ready ? t("componentsNewAgent.externalInvite.footer.close") : t("componentsNewAgent.externalInvite.footer.saveExit") : provider ? t("componentsNewAgent.externalInvite.back") : t("componentsNewAgent.externalInvite.footer.cancel")}
        </Button>
      </div>
      {provider && (approvalHref ? <Button asChild><Link to={approvalHref} onClick={onClose}>{t("componentsNewAgent.externalInvite.footer.reviewApproval")}</Link></Button>
        : museDetails ? <Button type="submit" form={detailsId} disabled={busy || !museDraft.name.trim()}>{busy ? t("componentsNewAgent.externalInvite.footer.preparing") : t("componentsNewAgent.externalInvite.footer.continue")}</Button>
        : ready ? <Button onClick={onClose}>{t("componentsNewAgent.externalInvite.footer.done")}</Button>
        : museAwaitingInvitation ? <Button disabled={busy} onClick={onRetry}>{busy ? t("componentsNewAgent.externalInvite.footer.loadingSetup") : t("componentsNewAgent.externalInvite.footer.refreshSetup")}</Button>
        : muse ? museConnection?.problem === "disconnected" || museConnection?.problem === "connection_expired" ? <Button disabled={busy} onClick={onNewPrompt}>{t("componentsNewAgent.externalInvite.footer.reconnectMuse")}</Button>
          : museConnection?.problem === "prompt_unavailable" ? <Button disabled={busy} onClick={onNewPrompt}>{t("componentsNewAgent.externalInvite.footer.newPrompt")}</Button>
          : !museConnection?.paired && prompt ? <AgentSetupPrompt key={prompt} prompt={prompt} label={t("componentsNewAgent.externalInvite.prompt.copySetup")} title={t("componentsNewAgent.externalInvite.title.connectMuse")} agent={{ name: "Muse", icon: <Bot className="size-5" /> }} description={t("componentsNewAgent.externalInvite.prompt.museDescription")} align="end" className="min-w-0 shrink" onCopied={onCopied} />
          : busy ? <Button disabled>{t("componentsNewAgent.externalInvite.footer.preparing")}</Button>
          : <Button asChild><a href="https://muse.ai" target="_blank" rel="noopener noreferrer">{t("componentsNewAgent.externalInvite.museActions.open")}</a></Button>
        : connecting ? <Button disabled aria-live="polite">
          {!connection.problem && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {progressLabel}
        </Button>
        : dot && connection.problem === "prompt_unavailable" ? <Button disabled={busy} onClick={onNewPrompt}>{t("componentsNewAgent.externalInvite.footer.newPrompt")}</Button>
        : !prompt || busy ? <Button disabled>{busy ? t("componentsNewAgent.externalInvite.footer.preparing") : t("componentsNewAgent.externalInvite.footer.waitingDot")}</Button>
        : <AgentSetupPrompt
          key={preset}
          prompt={prompt}
          label={dot ? t("componentsNewAgent.externalInvite.prompt.copySetup") : t("componentsNewAgent.externalInvite.prompt.copyInvitation")}
          title={dot ? t("componentsNewAgent.externalInvite.title.connectDot") : t("componentsNewAgent.externalInvite.title.inviteAgent")}
          description={dot ? t("componentsNewAgent.externalInvite.prompt.dotDescription") : t("componentsNewAgent.externalInvite.prompt.agentDescription")}
          agent={dot ? { name: "Dot", src: "/brands/adapters/openai-dot.svg" } : undefined}
          align="end"
          className="min-w-0 shrink"
          onCopied={onCopied}
        />)}
    </div>
  </>;
}
