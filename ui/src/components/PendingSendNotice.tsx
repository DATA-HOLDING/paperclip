import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Shown above a composer while a send waits for the connection. The text stays
 * on this device and resends with its original request ID, so it cannot post
 * twice; the user can resend now or take the text back with Cancel.
 *
 * Without `onResendNow` (a send saved by an older version, with no stored
 * request to replay) it only says the outcome is unknown and offers Cancel.
 */
export function PendingSendNotice({
  noun = "message",
  resending,
  stalled,
  persisted = false,
  onResendNow,
  onCancel,
  className,
}: {
  /** What is being sent: "comment", "task", "update". */
  noun?: string;
  resending: boolean;
  stalled: boolean;
  persisted?: boolean;
  onResendNow?: () => void;
  onCancel: () => void;
  className?: string;
}) {
  const replayable = Boolean(onResendNow);
  const nounLabel = t(`componentsPendingSendNotice.nouns.${noun}`, { defaultValue: noun });
  const title = !replayable
    ? t("componentsPendingSendNotice.title.unconfirmed", { noun: nounLabel })
    : resending
      ? t("componentsPendingSendNotice.title.sending")
      : stalled
        ? t("componentsPendingSendNotice.title.stalled", { noun: nounLabel })
        : t("componentsPendingSendNotice.title.waiting");
  const detail = replayable
    ? persisted ? t("componentsPendingSendNotice.detail.saved", { noun: nounLabel })
      : t("componentsPendingSendNotice.detail.noStorage")
    : t("componentsPendingSendNotice.detail.maybeSent");
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pending-send-notice"
      className={cn("space-y-2 rounded-md border border-border bg-muted p-3 text-sm", className)}
    >
      <p className="flex items-center gap-2 font-medium">
        {resending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {title}
      </p>
      <p className="text-muted-foreground">{detail}</p>
      <div className="flex items-center gap-2">
        {onResendNow ? (
          <Button type="button" size="sm" variant="outline" disabled={resending} onClick={onResendNow}>
            {t("componentsPendingSendNotice.resendNow")}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" disabled={resending} onClick={onCancel}>
          {t("componentsPendingSendNotice.cancel")}
        </Button>
      </div>
    </div>
  );
}
