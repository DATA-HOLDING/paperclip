import { describeError } from "@/api/errors";
import { ShieldCheck, ShieldX, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { t } from "@/i18n";

export interface ProjectAccessNoticeProps {
  agentName?: string;
  projectName?: string;
  ready: boolean;
  canManage: boolean;
  canRetry: boolean;
  onManage: () => void;
  onRetry: () => void;
  error?: Error | null;
  className?: string;
}

export function ProjectAccessNotice({ agentName = t("componentsProjectAccessNotice.thisAgent"), projectName, ready, canManage, canRetry, onManage, onRetry, error, className }: ProjectAccessNoticeProps) {
  return <section role={ready ? "status" : "alert"} aria-label={t("componentsProjectAccessNotice.ariaLabel")} className={cn("space-y-4 rounded-lg border border-border p-4", className)}>
    <div className="flex items-start gap-3">
      {ready ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden /> : <ShieldX className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />}
      <div className="min-w-0 space-y-2">
        <h3 className="text-sm font-semibold">{ready ? t("componentsProjectAccessNotice.readyTitle") : t("componentsProjectAccessNotice.blockedTitle", { agentName })}</h3>
        <p className="text-sm text-muted-foreground">{ready
          ? t("componentsProjectAccessNotice.readyBody")
          : t("componentsProjectAccessNotice.blockedBody", { projectName: projectName ?? t("componentsProjectAccessNotice.aProject") })}</p>
        {!ready && !canManage && <p className="text-sm text-muted-foreground">{t("componentsProjectAccessNotice.needsManager")}</p>}
      </div>
    </div>
    <div className="flex flex-wrap gap-2 pl-8">
      {ready ? canRetry && <Button size="sm" onClick={onRetry}>{t("componentsProjectAccessNotice.retryTask")}<ArrowRight className="size-4" aria-hidden /></Button>
        : <Button size="sm" variant="outline" onClick={onManage}>{canManage ? t("componentsProjectAccessNotice.manageAccess") : t("componentsProjectAccessNotice.viewAccess")}<ArrowRight className="size-4" aria-hidden /></Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{describeError(error).body}</p>}
    {!ready && <details className="pl-8 text-xs text-muted-foreground"><summary className="cursor-pointer">{t("componentsProjectAccessNotice.runDetails")}</summary>
      <dl className="mt-3 grid grid-cols-2 gap-2"><dt>{t("componentsProjectAccessNotice.stoppedDuring")}</dt><dd>{t("componentsProjectAccessNotice.workspaceSetup")}</dd><dt>{t("componentsProjectAccessNotice.reason")}</dt><dd>{t("componentsProjectAccessNotice.outsideScope")}</dd><dt>{t("componentsProjectAccessNotice.providerStarted")}</dt><dd>{t("componentsProjectAccessNotice.no")}</dd></dl>
    </details>}
  </section>;
}
