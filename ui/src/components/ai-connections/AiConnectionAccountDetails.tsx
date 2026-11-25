import { useQuery } from "@tanstack/react-query";
import type { AiManagedConnectionSummary, ConnectionGrant } from "@paperclipai/shared";
import { aiConnectionsApi } from "@/api/ai-connections";
import { describeError } from "@/api/errors";
import { retryTransientOnly } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import { AI_PROVIDERS, aiMethodLabel } from "./model";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/** Provider profile loading is independent of account access and maintenance controls. */
export function AiConnectionAccountDetails({ account, grant }: {
  account: AiManagedConnectionSummary;
  grant: ConnectionGrant;
}) {
  const isChatGpt = account.provider === "openai" && account.method === "subscription" && !account.routing;
  const canLookUp = !account.routing && (account.provider === "anthropic" || isChatGpt) && account.method === "subscription" && account.status === "connected";
  const identity = useQuery({
    queryKey: ["ai-account-identity", account.companyId, account.id, grant.id, grant.updatedAt],
    queryFn: ({ signal }) => aiConnectionsApi.accountIdentity(account.companyId, account.id, grant.id, { signal }),
    enabled: canLookUp,
    staleTime: 5 * 60_000,
    retry: retryTransientOnly(0),
  });
  const accountLabel = identity.data?.accountLabel ?? account.accountLabel;
  const message = identity.error ? describeError(identity.error).body : identity.data?.message;
  const retryable = identity.isError || identity.data?.status === "error";
  return (
    <section className="space-y-3" aria-label={t("componentsAiConnections.accountDetails.title")}>
      <h3 className="text-sm font-semibold">{t("componentsAiConnections.accountDetails.title")}</h3>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt className="text-muted-foreground">{t("componentsAiConnections.accountDetails.providerAccount", { provider: AI_PROVIDERS[account.provider].name })}</dt>
        <dd className={cn("break-words", ANALYTICS_MASK_CLASS)}>{accountLabel ?? t("componentsAiConnections.accountDetails.notAvailable")}</dd>
        {(isChatGpt || identity.data?.organizationLabel) && <>
          <dt className="text-muted-foreground">{isChatGpt ? t("componentsAiConnections.accountDetails.chatGptWorkspace") : t("componentsAiConnections.accountDetails.organization")}</dt>
          <dd className={cn("break-words", ANALYTICS_MASK_CLASS)}>{identity.data?.organizationLabel ?? (identity.isPending && canLookUp ? t("componentsAiConnections.accountDetails.checking") : t("componentsAiConnections.accountDetails.notAvailable"))}</dd>
        </>}
        <dt className="text-muted-foreground">{t("componentsAiConnections.accountDetails.signInMethod")}</dt>
        <dd>{aiMethodLabel(account.provider, account.method)}</dd>
        <dt className="text-muted-foreground">{t("componentsAiConnections.accountDetails.access")}</dt>
        <dd>{account.ownership === "shared" ? t("componentsAiConnections.accountDetails.companyShared") : t("componentsAiConnections.accountDetails.personal", { owner: account.ownerName ?? t("componentsAiConnections.accountDetails.accountOwner") })}</dd>
      </dl>
      {canLookUp && identity.isPending && <p role="status" className="text-xs text-muted-foreground">{t("componentsAiConnections.accountDetails.checkingDetails")}</p>}
      {message && <p role={retryable ? "alert" : undefined} className="text-xs text-muted-foreground">{message}</p>}
      {retryable && <Button variant="outline" size="sm" disabled={identity.isFetching} onClick={() => void identity.refetch()}>{t("componentsAiConnections.accountDetails.retry")}</Button>}
    </section>
  );
}
