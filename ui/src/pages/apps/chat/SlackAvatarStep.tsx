import { useId, useState } from "react";
import {
  Download,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export interface SlackAvatarProps {
  agentName: string;
  appName: string;
  avatarUrl: string;
}

/** Manual fallback shared by Slack onboarding and its Settings page. */
export function SlackAvatarContent({
  agentName,
  appName,
  avatarUrl,
  compact = false,
}: SlackAvatarProps & { compact?: boolean }) {
  const id = useId();
  const filename = `${appName.replace(/[^a-zA-Z0-9_-]+/g, "-") || "agent"}-avatar.png`;
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(false);
    try {
      const response = await fetch(avatarUrl);
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/png")
      )
        throw new Error("Avatar unavailable");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="space-y-8">
      <section
        aria-labelledby={`${id}-download`}
        className="flex flex-col items-start gap-6 sm:flex-row sm:items-center"
      >
        <img
          src={avatarUrl}
          width={512}
          height={512}
          alt={t("pagesAppsChatSlackAvatarStep.avatarAlt", { name: agentName })}
          className="size-40 shrink-0 rounded-lg bg-muted object-contain"
        />
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 id={`${id}-download`} className="text-sm font-semibold">
              {compact
                ? t("pagesAppsChatSlackAvatarStep.downloadHeading")
                : t("pagesAppsChatSlackAvatarStep.downloadHeadingNumbered")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("pagesAppsChatSlackAvatarStep.imageSpecs")}
            </p>
          </div>
          <Button variant="outline" asChild>
            <a
              href={avatarUrl}
              download={filename}
              aria-disabled={downloading}
              onClick={(event) => {
                event.preventDefault();
                void download();
              }}
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {t("pagesAppsChatSlackAvatarStep.downloadButton")}
            </a>
          </Button>
          {downloadError && (
            <p role="alert" className="text-sm text-destructive">
              {t("pagesAppsChatSlackAvatarStep.downloadError")}
            </p>
          )}
        </div>
      </section>

      <details open={compact ? undefined : true} className="space-y-4">
        <summary
          className={
            compact
              ? "cursor-pointer text-sm underline underline-offset-4"
              : "hidden"
          }
        >
          {t("pagesAppsChatSlackAvatarStep.howToUpload")}
        </summary>
        <section aria-labelledby={`${id}-upload`} className="space-y-4">
          <div className="space-y-1">
            <h2 id={`${id}-upload`} className="text-sm font-semibold">
              {compact ? t("pagesAppsChatSlackAvatarStep.uploadHeading") : t("pagesAppsChatSlackAvatarStep.uploadHeadingNumbered")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("pagesAppsChatSlackAvatarStep.uploadDescription")}
            </p>
          </div>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                {t("pagesAppsChatSlackAvatarStep.steps.openSettings")}{" "}
                <ExternalLink className="inline size-3" />
              </a>{" "}
              {t("pagesAppsChatSlackAvatarStep.steps.andChoose")} <strong>{appName}</strong>.
            </li>
            <li>
              {t("pagesAppsChatSlackAvatarStep.steps.choose")} <strong>{t("pagesAppsChatSlackAvatarStep.steps.basicInformation")}</strong>{t("pagesAppsChatSlackAvatarStep.steps.thenScrollTo")}{" "}
              <strong>{t("pagesAppsChatSlackAvatarStep.steps.displayInformation")}</strong>.
            </li>
            <li>
              {t("pagesAppsChatSlackAvatarStep.steps.under")} <strong>{t("pagesAppsChatSlackAvatarStep.steps.appIconPreview")}</strong>{t("pagesAppsChatSlackAvatarStep.steps.clickAndUpload")}{" "}
              <span className="break-all font-mono text-xs">{filename}</span>.
            </li>
            <li>
              {t("pagesAppsChatSlackAvatarStep.steps.confirmCrop")} <strong>{t("pagesAppsChatSlackAvatarStep.steps.saveChanges")}</strong> {t("pagesAppsChatSlackAvatarStep.steps.inSlack")}
            </li>
          </ol>
        </section>
      </details>
    </div>
  );
}


export function SlackAvatarSettings(props: SlackAvatarProps) {
  return (
    <section className="space-y-4" aria-label={t("pagesAppsChatSlackAvatarStep.settingsAriaLabel")}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("pagesAppsChatSlackAvatarStep.settingsTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("pagesAppsChatSlackAvatarStep.settingsDescription", { name: props.agentName })}
        </p>
      </div>
      <SlackAvatarContent {...props} compact />
    </section>
  );
}
