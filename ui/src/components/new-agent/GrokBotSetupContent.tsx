import { useId } from "react";
import { Check, Circle, Loader2 } from "lucide-react";
import { AGENT_ROLES, type CreateGrokInvitation, type DotPairing, type GrokConnection } from "@paperclipai/shared";
import { AdapterMark } from "../AdapterMark";
import { AgentSetupPrompt } from "../AgentSetupPrompt";
import { Button, buttonVariants } from "../ui/button";
import { CopyText } from "../CopyText";
import { Input } from "../ui/input";
import { NativeSelect } from "../ui/select";
import { DialogDescription, DialogTitle } from "../ui/dialog";
import { buildGrokAccessPrompt, buildGrokRoutinePrompt } from "@/lib/grok-bot-setup-prompt";
import { Link } from "@/lib/router";
import { t } from "@/i18n";

export type GrokSetupStep = 0 | 1 | 2 | 3;
export interface GrokBotSetupContentProps {
  step: GrokSetupStep; companyName: string; details: CreateGrokInvitation;
  created: boolean; loading?: boolean; busy?: boolean; error?: string;
  managers: Array<{ id: string; name: string }>;
  connection?: GrokConnection; pairing: DotPairing | null; approvalHref?: string;
  webhookUrl: string; webhookKey: string; editingCredentials?: boolean;
  onEditCredentials?: () => void;
  onDetails: (details: CreateGrokInvitation) => void;
  onCredentials: (url: string, key: string) => void;
  onBack: () => void; onExit: () => void; onNext: () => void; onRetry: () => void;
}
const steps = [t("componentsNewAgent.grokBot.steps.identify"), t("componentsNewAgent.grokBot.steps.connect"), t("componentsNewAgent.grokBot.steps.enable"), t("componentsNewAgent.grokBot.steps.verify")];
export function GrokBotSetupContent(p: GrokBotSetupContentProps) {
  const pairingCodeId = useId();
  const binding = p.connection?.binding;
  const routine = binding?.routine;
  const exchange = routine?.lastExchange;
  const delivered = exchange?.status === "accepted" || exchange?.status === "acknowledged";
  const replied = !!routine?.verified && exchange?.status === "acknowledged";
  const ready = replied && p.connection?.agentLifecycleState === "ready" && !!p.connection.canConfigureConnection && !routine?.recoveryNeeded;
  const pending = exchange && ["prepared", "sending", "accepted"].includes(exchange.status) && Date.parse(exchange.expiresAt) > Date.now();
  const nextDisabled = p.busy || p.loading || !!p.approvalHref
    || p.step === 0 && (!p.details.name.trim() || !p.details.botName.trim())
    || p.step === 1 && !binding?.connected
    || p.step === 2 && ((!routine?.configured || p.editingCredentials) && (!p.webhookUrl || !p.webhookKey))
    || p.step === 3 && !ready && (!!pending || !!routine?.recoveryNeeded || !!replied);
  return <>
    <div className="min-h-0 space-y-6 overflow-y-auto px-6 pb-6 pt-8 sm:px-8">
      <div className="space-y-3 pr-5">
        <AdapterMark type="grok_bot" className="size-10" />
        <DialogTitle className="text-xl font-semibold tracking-tight">{ready ? t("componentsNewAgent.grokBot.title.connected") : t("componentsNewAgent.grokBot.title.connect")}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">{ready ? t("componentsNewAgent.grokBot.description.connected", { botName: p.details.botName, companyName: p.companyName }) : t("componentsNewAgent.grokBot.description.connect", { companyName: p.companyName })}</DialogDescription>
      </div>
      <ol aria-label={t("componentsNewAgent.grokBot.setupLabel")} className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
        {steps.map((label, index) => <li key={label} aria-current={p.step === index ? "step" : undefined} className={p.step === index ? "font-medium text-foreground" : ""}>{index + 1}. {label}</li>)}
      </ol>
      {p.error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{p.error}</p><Button variant="outline" disabled={p.busy} onClick={p.onRetry}>{t("componentsNewAgent.grokBot.tryAgain")}</Button></div>}
      {p.loading ? <p role="status" className="text-sm text-muted-foreground">{t("componentsNewAgent.grokBot.restoring")}</p> : p.approvalHref ? <p className="text-sm text-muted-foreground">{t("componentsNewAgent.grokBot.needsApproval")}</p> : <>
        {p.step === 0 && <div className="space-y-4">
          <label className="block space-y-2 text-sm"><span>{t("componentsNewAgent.grokBot.fields.paperclipName")}</span><Input value={p.details.name} disabled={p.created} onChange={e => p.onDetails({ ...p.details, name: e.target.value })} autoComplete="off" maxLength={100} /></label>
          <label className="block space-y-2 text-sm"><span>{t("componentsNewAgent.grokBot.fields.botName")}</span><Input value={p.details.botName} disabled={p.created} onChange={e => p.onDetails({ ...p.details, botName: e.target.value })} autoComplete="off" maxLength={100} /></label>
          <p className="text-xs text-muted-foreground">{t("componentsNewAgent.grokBot.fields.botNameHint")}</p>
          <label className="block space-y-2 text-sm"><span>{t("componentsNewAgent.grokBot.fields.role")}</span><NativeSelect disabled={p.created} value={p.details.role ?? "general"} onChange={e => p.onDetails({ ...p.details, role: e.target.value as CreateGrokInvitation["role"] })}>{AGENT_ROLES.map(role => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</NativeSelect></label>
          <label className="block space-y-2 text-sm"><span>{t("componentsNewAgent.grokBot.fields.manager")}</span><NativeSelect disabled={p.created} value={p.details.reportsTo ?? ""} onChange={e => p.onDetails({ ...p.details, reportsTo: e.target.value || null })}><option value="">{t("componentsNewAgent.grokBot.fields.noManager")}</option>{p.managers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</NativeSelect></label>
        </div>}
        {p.step === 1 && <div className="space-y-4 text-sm">
          <p>{t("componentsNewAgent.grokBot.access.intro")}</p>
          {p.connection?.resourceUrl && <AgentSetupPrompt prompt={buildGrokAccessPrompt(p.connection.resourceUrl, p.details.botName)} label={t("componentsNewAgent.grokBot.access.copyInstructions")} title={t("componentsNewAgent.grokBot.access.promptTitle")} description={t("componentsNewAgent.grokBot.access.promptDescription")} />}
          {!binding?.connected && p.pairing && <div className="space-y-2">
            <label htmlFor={pairingCodeId}>{t("componentsNewAgent.grokBot.access.pairingCode")}</label>
            <div className="flex items-center gap-2">
              <Input id={pairingCodeId} value={p.pairing.pairingCode} readOnly type="password" autoComplete="off" />
              <CopyText text={p.pairing.pairingCode} ariaLabel={t("componentsNewAgent.grokBot.access.copyPairingCode")} className={buttonVariants({ variant: "outline", size: "sm" })}>{t("componentsNewAgent.grokBot.access.copyCode")}</CopyText>
            </div>
            <p className="text-xs text-muted-foreground">{t("componentsNewAgent.grokBot.access.pairingHint", { time: new Date(p.pairing.expiresAt).toLocaleTimeString() })}</p>
          </div>}
          <p role="status" aria-live="polite" className="text-muted-foreground">{binding?.connected ? t("componentsNewAgent.grokBot.access.connected") : t("componentsNewAgent.grokBot.access.watching")}</p>
          <p className="text-xs text-muted-foreground">{t("componentsNewAgent.grokBot.access.accountWide")}</p>
        </div>}
        {p.step === 2 && <div className="space-y-4 text-sm">
          <p>{t("componentsNewAgent.grokBot.routine.intro")}</p>
          {binding && <AgentSetupPrompt prompt={buildGrokRoutinePrompt(binding.id, p.details.botName)} label={t("componentsNewAgent.grokBot.routine.copyInstructions")} title={t("componentsNewAgent.grokBot.routine.promptTitle")} description={t("componentsNewAgent.grokBot.routine.promptDescription")} />}
          <p className="text-xs text-muted-foreground">{t("componentsNewAgent.grokBot.routine.clickHint")}</p>
          {routine?.configured && !p.editingCredentials && !p.webhookUrl && !p.webhookKey ? <div className="space-y-2"><p role="status" className="text-muted-foreground">{t("componentsNewAgent.grokBot.routine.stored")}</p>{p.onEditCredentials && <Button variant="outline" onClick={p.onEditCredentials} disabled={p.busy}>{t("componentsNewAgent.grokBot.routine.replace")}</Button>}</div> : <>
            <label className="block space-y-2"><span>{t("componentsNewAgent.grokBot.routine.webhookUrl")}</span><Input value={p.webhookUrl} onChange={e => p.onCredentials(e.target.value, p.webhookKey)} type="password" autoComplete="off" spellCheck={false} /></label>
            <label className="block space-y-2"><span>{t("componentsNewAgent.grokBot.routine.webhookKey")}</span><Input value={p.webhookKey} onChange={e => p.onCredentials(p.webhookUrl, e.target.value)} type="password" autoComplete="off" spellCheck={false} /></label>
          </>}
          <p className="text-xs text-muted-foreground">{t("componentsNewAgent.grokBot.routine.copyFields")}</p>
        </div>}
        {p.step === 3 && <section aria-label={t("componentsNewAgent.grokBot.verify.checksLabel")} className="space-y-4 text-sm">
          {[{ label: t("componentsNewAgent.grokBot.verify.delivered"), done: delivered }, { label: t("componentsNewAgent.grokBot.verify.replied"), done: replied }].map(check => <p key={check.label} className="flex items-center gap-3">{check.done ? <Check className="size-4" /> : pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Circle className="size-4 text-muted-foreground" />}{check.label}<span className="text-muted-foreground">{check.done ? t("componentsNewAgent.grokBot.verify.complete") : t("componentsNewAgent.grokBot.verify.waiting")}</span></p>)}
          <p role="status" aria-live="polite" className="text-muted-foreground">{routine?.recoveryNeeded ? t("componentsNewAgent.grokBot.verify.recovery") : ready ? t("componentsNewAgent.grokBot.verify.ready") : replied ? t("componentsNewAgent.grokBot.verify.finishing") : exchange?.status === "rejected" ? t("componentsNewAgent.grokBot.verify.rejected") : delivered ? t("componentsNewAgent.grokBot.verify.accepted") : t("componentsNewAgent.grokBot.verify.sendChallenge")}</p>
          <p className="text-xs text-muted-foreground">{t("componentsNewAgent.grokBot.verify.external")}</p>
        </section>}
      </>}
    </div>
    <div className="flex items-center justify-between gap-3 border-t px-6 py-4 sm:px-8">
      <div className="flex items-center gap-2"><Button variant="ghost" onClick={p.onBack} disabled={p.busy}>{t("componentsNewAgent.grokBot.footer.back")}</Button><Button variant="ghost" onClick={p.onExit} disabled={p.busy}>{t("componentsNewAgent.grokBot.footer.saveExit")}</Button></div>
      {p.approvalHref ? <Button asChild><Link to={p.approvalHref} onClick={p.onExit}>{t("componentsNewAgent.grokBot.footer.reviewApproval")}</Link></Button> : <Button onClick={p.onNext} disabled={nextDisabled}>{p.busy ? t("componentsNewAgent.grokBot.footer.saving") : ready ? t("componentsNewAgent.grokBot.footer.done") : p.step === 3 ? pending ? t("componentsNewAgent.grokBot.footer.waitingReply") : replied ? t("componentsNewAgent.grokBot.footer.finishing") : t("componentsNewAgent.grokBot.footer.verify") : t("componentsNewAgent.grokBot.footer.continue")}</Button>}
    </div>
  </>;
}
