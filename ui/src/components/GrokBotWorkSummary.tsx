import { describeError } from "@/api/errors";
import { useQuery } from "@tanstack/react-query";
import { grokBotApi } from "@/api/grokBot";
import { Link } from "@/lib/router";
import { t } from "@/i18n";
/** Reports observed Paperclip activity; this is not a provider availability indicator. */
export function GrokBotWorkSummary({ companyId, agentId }: { companyId: string; agentId: string }) {
  const state = useQuery({ queryKey: ["grok-binding", companyId, agentId], queryFn: ({ signal }) => grokBotApi.connection(companyId, agentId, signal), refetchInterval: 10000 });
  const data = state.data, binding = data?.binding, routine = binding?.routine;
  return <div className="space-y-2 text-sm">
    {state.error && <p role="alert" className="text-destructive">{t("componentsGrokBotWorkSummary.refreshFailed")} {describeError(state.error).body}</p>}
    <p>{data?.recoveryNeeded ? t("componentsGrokBotWorkSummary.status.recoveryNeeded") : binding?.assignment?.status === "offered" ? t("componentsGrokBotWorkSummary.status.awaitingAcknowledgement") : binding?.assignment ? t("componentsGrokBotWorkSummary.status.working") : routine?.verified ? t("componentsGrokBotWorkSummary.status.noActiveSession") : t("componentsGrokBotWorkSummary.status.setupIncomplete")}</p>
    {data?.currentTask && <Link className="underline" to={`/issues/${data.currentTask.id}`}>{data.currentTask.identifier}: {data.currentTask.title}</Link>}
    <p className="text-muted-foreground">{t("componentsGrokBotWorkSummary.queuedTasks")} {data?.queuedTaskCount ?? t("componentsGrokBotWorkSummary.checking")}</p>
    <p className="text-muted-foreground">{t("componentsGrokBotWorkSummary.lastContact")} {routine?.lastContactAt ? new Date(routine.lastContactAt).toLocaleString() : t("componentsGrokBotWorkSummary.notObserved")}</p>
    <p className="text-xs text-muted-foreground">{t("componentsGrokBotWorkSummary.footnote")}</p>
  </div>;
}
