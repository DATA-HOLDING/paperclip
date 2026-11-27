import { useId } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export const PRIVACY_POLICY_URL = "https://paperclip.ing/privacy/";

export function AnalyticsConsentBanner({
  recordings,
  onAccept,
  onDecline,
}: {
  recordings: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const textId = useId();
  return (
    <section
      aria-label={t("componentsAnalyticsConsentBanner.ariaLabel")}
      aria-describedby={textId}
      className="fixed inset-x-4 bottom-(--sz-calc-14) z-40 mx-auto max-w-xl rounded-md border bg-popover text-popover-foreground shadow-lg md:bottom-4"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <p id={textId} className="flex-1 text-sm text-muted-foreground">
          {recordings
            ? t("componentsAnalyticsConsentBanner.withRecordings")
            : t("componentsAnalyticsConsentBanner.analyticsOnly")}
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline underline-offset-4 hover:opacity-90"
          >
            {t("componentsAnalyticsConsentBanner.privacyPolicy")}
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onDecline}>
            {t("componentsAnalyticsConsentBanner.decline")}
          </Button>
          <Button type="button" size="sm" onClick={onAccept}>
            {t("componentsAnalyticsConsentBanner.accept")}
          </Button>
        </div>
      </div>
    </section>
  );
}
