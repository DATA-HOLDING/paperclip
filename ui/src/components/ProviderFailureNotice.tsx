import type { ReactNode } from "react";
import type { ProviderFailure } from "@paperclipai/shared";
import { InlineBanner } from "./InlineBanner";
import { t } from "@/i18n";

const labels: Record<ProviderFailure["category"], string> = {
  rate_limit: t("componentsProviderFailureNotice.category.rateLimit"), quota_exhausted: t("componentsProviderFailureNotice.category.quotaExhausted"),
  authentication: t("componentsProviderFailureNotice.category.authentication"), permission: t("componentsProviderFailureNotice.category.permission"),
  model_unavailable: t("componentsProviderFailureNotice.category.modelUnavailable"), invalid_request: t("componentsProviderFailureNotice.category.invalidRequest"),
  overloaded: t("componentsProviderFailureNotice.category.overloaded"), timeout: t("componentsProviderFailureNotice.category.timeout"), unknown: t("componentsProviderFailureNotice.category.unknown"),
};

export function ProviderFailureNotice({ failure, actions, children, className }: {
  failure: ProviderFailure; actions?: ReactNode; children?: ReactNode; className?: string;
}) {
  const provider = ({ anthropic: "Claude", openai: "OpenAI", antigravity: "Google Antigravity", google: "Google", sandbox: t("componentsProviderFailureNotice.sandboxProvider") } as Record<string, string>)[failure.provider] ?? failure.provider;
  return (
    <InlineBanner tone="danger" title={`${provider}: ${labels[failure.category]}`} actions={actions} className={className}>
      <div className="flex flex-col gap-2">
        <p className="whitespace-pre-wrap break-words">{failure.message}</p>
        <p className="text-xs text-muted-foreground">
          {/* Provider codes and HTTP statuses stay in the run's diagnostics, not in front of people. */}
          {failure.phase === "startup" ? t("componentsProviderFailureNotice.failedBeforeStart") : t("componentsProviderFailureNotice.failedDuring")}
        </p>
        {failure.requestId && <p className="font-mono text-xs text-muted-foreground">{t("componentsProviderFailureNotice.request", { id: failure.requestId })}</p>}
        {children}
      </div>
    </InlineBanner>
  );
}
