import { useQuery } from "@tanstack/react-query";
import type { DecisionHistoryEntry } from "@paperclipai/shared";
import { decisionModelsApi } from "@/api/decision-models";
import { Link } from "@/lib/router";
import { formatDateTime, formatTokens, formatDetailedCents } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { t } from "@/i18n";

export function DecisionHistoryTable({ entries, fastResponse = false, fastResponsesEnabled = true }: { entries: (DecisionHistoryEntry & { publicationStatus?: string; connectionName?: string | null })[]; fastResponse?: boolean; fastResponsesEnabled?: boolean }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">{fastResponse ? t("componentsDecisionModels.history.noFastResponses") : t("componentsDecisionModels.history.noRequests")} <Link to={fastResponse && !fastResponsesEnabled ? "/company/settings/instance/experimental" : "/company/settings/connections"} className="underline underline-offset-4">{fastResponse ? fastResponsesEnabled ? t("componentsDecisionModels.history.configureFastResponse") : t("componentsDecisionModels.history.enableFastResponses") : t("componentsDecisionModels.history.configureModel")}</Link>{t("componentsDecisionModels.history.toRunTest")}</p>;
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">{t("componentsDecisionModels.history.recentRequests")}</p>
    <div className="overflow-x-auto"><table className="w-full text-sm" aria-label={fastResponse ? t("componentsDecisionModels.history.fastResponses") : t("componentsDecisionModels.history.decisionRequests")}>
      <thead><tr className="border-b border-border text-muted-foreground">{[t("componentsDecisionModels.history.columns.when"), t("componentsDecisionModels.history.columns.responsible"), t("componentsDecisionModels.history.columns.task"), ...(fastResponse ? [t("componentsDecisionModels.history.columns.connection")] : []), t("componentsDecisionModels.history.columns.model"), t("componentsDecisionModels.history.columns.status"), t("componentsDecisionModels.history.columns.duration"), t("componentsDecisionModels.history.columns.tokens"), t("componentsDecisionModels.history.columns.cost")].map(label => <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>)}</tr></thead>
      <tbody>{entries.map(row => <tr key={row.id} className="border-b border-border last:border-0">
        <td className="px-3 py-3"><div className="whitespace-nowrap">{formatDateTime(row.startedAt)}</div><div className="text-xs text-muted-foreground">{row.feature === "settings.test" ? t("componentsDecisionModels.history.setupTest") : row.feature}</div></td>
        <td className="px-3 py-3">{row.actorType === "system" ? t("componentsDecisionModels.history.paperclipServices") : row.userName ?? (row.responsibleUserId === "local-board" ? t("componentsDecisionModels.history.board") : t("componentsDecisionModels.history.formerUser"))}</td>
        <td className="px-3 py-3">{row.issueId ? <Link className="underline underline-offset-4" to={`/issues/${row.issueIdentifier ?? row.issueId}`}>{row.issueIdentifier ?? t("componentsDecisionModels.history.viewTask")}</Link> : "—"}</td>
        {fastResponse && <td className={`px-3 py-3 ${ANALYTICS_MASK_CLASS}`}>{row.connectionName ?? (row.connectionId ? t("componentsDecisionModels.history.removedConnection") : "—")}</td>}
        <td className="px-3 py-3 font-mono text-xs">{row.model}</td>
        <td className="px-3 py-3"><div>{row.status === "succeeded" ? t("componentsDecisionModels.history.status.succeeded") : row.status === "running" ? t("componentsDecisionModels.history.status.running") : row.status === "unknown" ? t("componentsDecisionModels.history.status.unresolved") : row.status === "skipped" ? t("componentsDecisionModels.history.status.skipped") : row.status === "pending" ? t("componentsDecisionModels.history.status.pending") : t("componentsDecisionModels.history.status.failed")}</div>{row.publicationStatus && <div className="text-xs text-muted-foreground">{row.publicationStatus}</div>}{row.errorCode && <div className="text-xs text-muted-foreground">{row.errorCode.replaceAll("_", " ")}</div>}</td>
        <td className="px-3 py-3 font-mono">{row.durationMs === null ? "—" : `${(row.durationMs / 1000).toFixed(1)}s`}</td>
        <td className="whitespace-nowrap px-3 py-3 font-mono">{row.inputTokens === null ? "—" : formatTokens(row.inputTokens)} / {row.outputTokens === null ? "—" : formatTokens(row.outputTokens)}</td>
        <td className="px-3 py-3 font-mono"><div>{row.costCents === null ? t("componentsDecisionModels.history.unknown") : formatDetailedCents(row.costCents)}</div>{row.costStatus !== "unpriced" && row.costStatus && <span className="text-xs text-muted-foreground">{row.costStatus === "estimated" ? t("componentsDecisionModels.history.estimated") : t("componentsDecisionModels.history.reported")}</span>}</td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}
export function DecisionHistory({ companyId, from, to }: { companyId: string; from?: string | null; to?: string | null }) {
  const query = useQuery({ queryKey: ["decision-history", companyId, from, to], queryFn: () => decisionModelsApi.history(companyId, from, to), refetchInterval: q => q.state.data?.some(row => row.status === "running") ? 5000 : false });
  if (query.isPending) return <p className="text-sm text-muted-foreground">{t("componentsDecisionModels.history.loading")}</p>;
  if (query.error) return <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{t("componentsDecisionModels.history.loadFailed")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("componentsDecisionModels.history.tryAgain")}</Button></div>;
  return <DecisionHistoryTable entries={query.data ?? []} />;
}
