import { t } from "@/i18n";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { copyTextToClipboard } from "@/lib/clipboard";
import { AgentSetupPrompt } from "@/components/AgentSetupPrompt";
import { ANALYTICS_NO_CAPTURE_CLASS } from "@/lib/analytics/privacy";

export function CopyField({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
        <code title={value} className={`min-w-0 flex-1 truncate text-xs ${ANALYTICS_NO_CAPTURE_CLASS}`}>
          {value}
        </code>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("componentsRoutineTriggers.fields.copyLabel", { label })}
          onClick={async () => {
            try {
              await copyTextToClipboard(value);
              setCopied(true);
              setError(false);
            } catch {
              setError(true);
            }
          }}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? t("componentsRoutineTriggers.fields.copied") : t("componentsRoutineTriggers.fields.copy")}
        </Button>
      </div>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">
            {t("componentsRoutineTriggers.fields.copyFailed")}
          </p>
          <textarea
            readOnly
            aria-label={t("componentsRoutineTriggers.fields.textLabel", { label })}
            value={value}
            rows={5}
            className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}

export function AgentInstructions({ value }: { value: string }) {
  return (
    <section
      aria-label={t("componentsRoutineTriggers.fields.agentInstructions")}
      className="space-y-3 rounded-md bg-muted/40 p-4"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-medium">{t("componentsRoutineTriggers.fields.agentInstructions")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("componentsRoutineTriggers.fields.agentInstructionsDescription")}
        </p>
      </div>
      <AgentSetupPrompt
        prompt={value}
        label={t("componentsRoutineTriggers.fields.copyForAgent")}
        title={t("componentsRoutineTriggers.fields.webhookSetup")}
        description={t("componentsRoutineTriggers.fields.webhookSetupDescription")}
      />
    </section>
  );
}
