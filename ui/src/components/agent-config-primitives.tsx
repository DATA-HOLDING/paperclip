import { useState, useRef, useEffect, useCallback } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { AGENT_ROLE_LABELS } from "@paperclipai/shared";
import { t } from "@/i18n";

/* ---- Help text for (?) tooltips ---- */
export const help: Record<string, string> = {
  name: t("componentsAgentConfigPrimitives.help.name"),
  title: t("componentsAgentConfigPrimitives.help.title"),
  role: t("componentsAgentConfigPrimitives.help.role"),
  reportsTo: t("componentsAgentConfigPrimitives.help.reportsTo"),
  capabilities: t("componentsAgentConfigPrimitives.help.capabilities"),
  adapterType: t("componentsAgentConfigPrimitives.help.adapterType"),
  cwd: t("componentsAgentConfigPrimitives.help.cwd"),
  promptTemplate: t("componentsAgentConfigPrimitives.help.promptTemplate", { variables: "{{ agent.id }}, {{ agent.name }}, {{ agent.role }}" }),
  model: t("componentsAgentConfigPrimitives.help.model"),
  thinkingEffort: t("componentsAgentConfigPrimitives.help.thinkingEffort"),
  chrome: t("componentsAgentConfigPrimitives.help.chrome"),
  dangerouslySkipPermissions: t("componentsAgentConfigPrimitives.help.dangerouslySkipPermissions"),
  dangerouslyBypassSandbox: t("componentsAgentConfigPrimitives.help.dangerouslyBypassSandbox"),
  search: t("componentsAgentConfigPrimitives.help.search"),
  fastMode: t("componentsAgentConfigPrimitives.help.fastMode"),
  workspaceStrategy: t("componentsAgentConfigPrimitives.help.workspaceStrategy"),
  workspaceBaseRef: t("componentsAgentConfigPrimitives.help.workspaceBaseRef"),
  workspaceBranchTemplate: t("componentsAgentConfigPrimitives.help.workspaceBranchTemplate", { variables: "{{issue.identifier}}, {{issue.title}}, {{agent.name}}, {{project.id}}, {{workspace.repoRef}}, and {{slug}}" }),
  worktreeParentDir: t("componentsAgentConfigPrimitives.help.worktreeParentDir"),
  runtimeServicesJson: t("componentsAgentConfigPrimitives.help.runtimeServicesJson"),
  maxTurnsPerRun: t("componentsAgentConfigPrimitives.help.maxTurnsPerRun"),
  command: t("componentsAgentConfigPrimitives.help.command"),
  localCommand: t("componentsAgentConfigPrimitives.help.localCommand"),
  args: t("componentsAgentConfigPrimitives.help.args"),
  extraArgs: t("componentsAgentConfigPrimitives.help.extraArgs"),
  envVars: t("componentsAgentConfigPrimitives.help.envVars"),
  secretAccess: t("componentsAgentConfigPrimitives.help.secretAccess"),
  bootstrapPrompt: t("componentsAgentConfigPrimitives.help.bootstrapPrompt"),
  payloadTemplateJson: t("componentsAgentConfigPrimitives.help.payloadTemplateJson"),
  webhookUrl: t("componentsAgentConfigPrimitives.help.webhookUrl"),
  heartbeatInterval: t("componentsAgentConfigPrimitives.help.heartbeatInterval"),
  intervalSec: t("componentsAgentConfigPrimitives.help.intervalSec"),
  timeoutSec: t("componentsAgentConfigPrimitives.help.timeoutSec"),
  graceSec: t("componentsAgentConfigPrimitives.help.graceSec"),
  wakeOnDemand: t("componentsAgentConfigPrimitives.help.wakeOnDemand"),
  cooldownSec: t("componentsAgentConfigPrimitives.help.cooldownSec"),
  maxConcurrentRuns: t("componentsAgentConfigPrimitives.help.maxConcurrentRuns"),
  maxTurnContinuationEnabled: t("componentsAgentConfigPrimitives.help.maxTurnContinuationEnabled"),
  maxTurnContinuationMaxAttempts: t("componentsAgentConfigPrimitives.help.maxTurnContinuationMaxAttempts"),
  maxTurnContinuationDelaySec: t("componentsAgentConfigPrimitives.help.maxTurnContinuationDelaySec"),
  budgetMonthlyCents: t("componentsAgentConfigPrimitives.help.budgetMonthlyCents"),
};

import { getAdapterLabels } from "../adapters/adapter-display-registry";

export const adapterLabels = getAdapterLabels();

export const roleLabels = AGENT_ROLE_LABELS as Record<string, string>;

/* ---- Primitive components ---- */

export function HintIcon({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <HelpCircle className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode; configSection?: import("../adapters/types").AdapterConfigSection }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      {children}
    </div>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
  toggleTestId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  toggleTestId?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <HintIcon text={hint} />}
      </div>
      {/* Gallery feedback r3: was a hand-rolled h-5 w-9 pill with a bg-green-600
          track — the app's second switch implementation. Converged on the one
          canonical ToggleSwitch (status-green on-state), DESIGN.md principle 1. */}
      <ToggleSwitch
        data-testid={toggleTestId}
        aria-label={label}
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  );
}

export function ToggleWithNumber({
  label,
  hint,
  checked,
  onCheckedChange,
  number,
  onNumberChange,
  numberLabel,
  numberHint,
  numberPrefix,
  showNumber,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  number: number;
  onNumberChange: (v: number) => void;
  numberLabel: string;
  numberHint?: string;
  numberPrefix?: string;
  showNumber: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          {hint && <HintIcon text={hint} />}
        </div>
        <ToggleSwitch
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {showNumber && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {numberPrefix && <span>{numberPrefix}</span>}
          <input
            type="number"
            className="w-16 rounded-md border border-border px-2 py-0.5 bg-transparent outline-none text-xs font-mono text-center"
            value={number}
            onChange={(e) => onNumberChange(Number(e.target.value))}
          />
          <span>{numberLabel}</span>
          {numberHint && <HintIcon text={numberHint} />}
        </div>
      )}
    </div>
  );
}

export function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  bordered,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(bordered && "border-t border-border")}>
      <button
        type="button"
        aria-expanded={open}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {icon}
        {title}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export function AutoExpandTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  minRows,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      style={{ minHeight }}
    />
  );
}

/**
 * Text input that manages internal draft state.
 * Calls `onCommit` on blur (and optionally on every change if `immediate` is set).
 */
export function DraftInput({
  value,
  onCommit,
  immediate,
  className,
  ...props
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      {...props}
    />
  );
}

/**
 * Auto-expanding textarea with draft state and blur-commit.
 */
export function DraftTextarea({
  value,
  onCommit,
  immediate,
  placeholder,
  minRows,
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  placeholder?: string;
  minRows?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [draft, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      style={{ minHeight }}
    />
  );
}

/**
 * Number input with draft state and blur-commit.
 */
export function DraftNumberInput({
  value,
  onCommit,
  immediate,
  className,
  ...props
}: {
  value: number;
  onCommit: (v: number) => void;
  immediate?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "type">) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      type="number"
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(Number(e.target.value) || 0);
      }}
      onBlur={() => {
        const num = Number(draft) || 0;
        if (num !== value) onCommit(num);
      }}
      {...props}
    />
  );
}

/**
 * "Choose" button that opens a dialog explaining the user must manually
 * type the path due to browser security limitations.
 */
export function ChoosePathButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0"
        onClick={() => setOpen(true)}
      >
        {t("componentsAgentConfigPrimitives.choosePath.button")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("componentsAgentConfigPrimitives.choosePath.title")}</DialogTitle>
            <DialogDescription>
              {t("componentsAgentConfigPrimitives.choosePath.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section className="space-y-1.5">
              <p className="font-medium">{t("componentsAgentConfigPrimitives.choosePath.macTitle")}</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>{t("componentsAgentConfigPrimitives.choosePath.macFind")}</li>
                <li>{t("componentsAgentConfigPrimitives.choosePath.hold")} <kbd>Option</kbd> {t("componentsAgentConfigPrimitives.choosePath.andRightClick")}</li>
                <li>{t("componentsAgentConfigPrimitives.choosePath.macClick")}</li>
                <li>{t("componentsAgentConfigPrimitives.choosePath.paste")}</li>
              </ol>
              <p className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                /Users/yourname/Documents/project
              </p>
            </section>
            <section className="space-y-1.5">
              <p className="font-medium">{t("componentsAgentConfigPrimitives.choosePath.windowsTitle")}</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>{t("componentsAgentConfigPrimitives.choosePath.windowsFind")}</li>
                <li>{t("componentsAgentConfigPrimitives.choosePath.hold")} <kbd>Shift</kbd> {t("componentsAgentConfigPrimitives.choosePath.andRightClick")}</li>
                <li>{t("componentsAgentConfigPrimitives.choosePath.windowsClick")}</li>
                <li>{t("componentsAgentConfigPrimitives.choosePath.paste")}</li>
              </ol>
              <p className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                C:\Users\yourname\Documents\project
              </p>
            </section>
            <section className="space-y-1.5">
              <p className="font-medium">{t("componentsAgentConfigPrimitives.choosePath.terminalTitle")}</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>{t("componentsAgentConfigPrimitives.choosePath.run")} <code>cd /path/to/folder</code>.</li>
                <li>{t("componentsAgentConfigPrimitives.choosePath.run")} <code>pwd</code>.</li>
                <li>{t("componentsAgentConfigPrimitives.choosePath.copyOutput")}</li>
              </ol>
            </section>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Label + input rendered on the same line (inline layout for compact fields).
 */
export function InlineField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 shrink-0">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      <div className="w-24 ml-auto">{children}</div>
    </div>
  );
}
