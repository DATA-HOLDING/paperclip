import { t } from "@/i18n";
import type { VoiceTranscriptEntry } from "@/lib/voice-transcript";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { cn } from "@/lib/utils";

export interface VoiceTranscriptProps {
  entries: readonly VoiceTranscriptEntry[];
  agentName: string;
  unavailable?: boolean;
}

/** Announcements belong to the session controller, once per final segment. */
export function VoiceTranscript({ entries, agentName, unavailable = false }: VoiceTranscriptProps) {
  if (unavailable) return <p className="text-sm text-muted-foreground">{t("componentsVoice.transcript.unavailable")}</p>;
  if (!entries.length) return <p className="text-sm text-muted-foreground">{t("componentsVoice.transcript.empty")}</p>;
  return (
    <ol aria-label={t("componentsVoice.transcript.label")} aria-live="off" className={cn("flex min-w-0 flex-col gap-4", ANALYTICS_MASK_CLASS)}>
      {entries.map((entry) => (
        <li key={entry.id} className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground break-words">
            {entry.source === "user" ? t("componentsVoice.transcript.you") : entry.source === "application" ? "Paperclip" : agentName}
            {!entry.final && !entry.interrupted && <span>{t("componentsVoice.transcript.speakingSuffix")}</span>}
            {entry.interrupted && <span>{t("componentsVoice.transcript.interruptedSuffix")}</span>}
          </span>
          <p className="whitespace-pre-wrap break-words text-sm">{entry.text}</p>
        </li>
      ))}
    </ol>
  );
}
