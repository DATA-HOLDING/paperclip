import { t } from "@/i18n";
import { InlineBanner } from "@/components/InlineBanner";
import { webhookUrlWarningReason } from "@/lib/webhook-url-warning";

const warnings = () => ({
  loopback: {
    title: t("componentsRoutineTriggers.urlWarning.loopback.title"),
    message: t("componentsRoutineTriggers.urlWarning.loopback.message"),
  },
  private: {
    title: t("componentsRoutineTriggers.urlWarning.private.title"),
    message: t("componentsRoutineTriggers.urlWarning.private.message"),
  },
  tailscale: {
    title: t("componentsRoutineTriggers.urlWarning.tailscale.title"),
    message: t("componentsRoutineTriggers.urlWarning.tailscale.message"),
  },
  https: {
    title: t("componentsRoutineTriggers.urlWarning.https.title"),
    message: t("componentsRoutineTriggers.urlWarning.https.message"),
  },
  invalid: {
    title: t("componentsRoutineTriggers.urlWarning.invalid.title"),
    message: t("componentsRoutineTriggers.urlWarning.invalid.message"),
  },
});

export function WebhookUrlWarning({ url }: { url: string }) {
  const reason = webhookUrlWarningReason(url);
  if (!reason) return null;
  const warning = warnings()[reason];
  return <InlineBanner tone="warning" title={warning.title}>
    <div className="space-y-2">
      <p>{warning.message}</p>
      <p>{t("componentsRoutineTriggers.urlWarning.continueNote")}</p>
      <a className="underline underline-offset-4" href="https://docs.paperclip.ing/reference/deploy/https/" target="_blank" rel="noopener noreferrer">{t("componentsRoutineTriggers.urlWarning.learnHttps")}</a>
    </div>
  </InlineBanner>;
}
