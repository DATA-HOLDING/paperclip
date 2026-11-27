import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tailscaleApi, type TailscaleConnection } from "@/api/tailscale";
import { describeError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { tailscaleConnectionsKey, useTailscaleConnections } from "@/hooks/useTailscaleConnections";
import { Link, useSearchParams } from "@/lib/router";
import { useAuthorizationWindow } from "@/hooks/useAuthorizationWindow";
import { AppLogo } from "./AppLogo";
import { TailscaleDeviceSignIn } from "./TailscaleDeviceSignIn";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

export const TAILSCALE_CONNECTOR_PATH = "/apps/tailscale";

export function TailscaleConnectorCard({ onNavigate }: { onNavigate: (href: string) => void }) {
  const { selectedCompanyId } = useCompany();
  const connections = useTailscaleConnections(selectedCompanyId);
  const connected = connections.data?.filter(connection => connection.status === "connected") ?? [];
  if (!connections.canManage) return null;
  return <div role="listitem" data-app-slug="tailscale" data-connected={String(connected.length > 0)} className="overflow-hidden rounded-xl border border-border">
    <div className="flex flex-wrap items-center gap-3 px-4 py-4">
      <AppLogo name="Tailscale" brandKey="tailscale" size={36} />
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-foreground">Tailscale</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("pagesApps.tailscale.cardDescription")}</p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => onNavigate(TAILSCALE_CONNECTOR_PATH)} aria-label={t("pagesApps.tailscale.cardAction", { action: connected.length ? t("pagesApps.common.manage") : t("pagesApps.common.connect") })}>{connected.length ? t("pagesApps.common.manage") : t("pagesApps.common.connect")}</Button>
    </div>
    {connected.length > 0 && <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground"><span className={ANALYTICS_MASK_CLASS}>{connected.map(connection => connection.name).join(", ")}</span>{t("pagesApps.tailscale.connectedSuffix")}</p>}
    {connections.error && <p role="alert" className="border-t border-border px-4 py-3 text-sm text-destructive">{describeError(connections.error, { action: t("pagesApps.errorActions.loadTailscaleConnections") }).body}</p>}
  </div>;
}

export function TailscaleConnector() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const client = useQueryClient();
  const [searchParams] = useSearchParams();
  const connections = useTailscaleConnections(selectedCompanyId);
  const authorization = useAuthorizationWindow();
  const company = useRef(selectedCompanyId);
  company.current = selectedCompanyId;
  const connect = useMutation({ mutationFn: async (input: { companyId: string; connectionId?: string }) => {
    const result = await tailscaleApi.connect(input.companyId, input.connectionId);
    client.setQueryData<TailscaleConnection[]>(tailscaleConnectionsKey(input.companyId), rows => [
      ...(rows ?? []).filter(row => row.id !== result.connection.id), result.connection,
    ]);
    if (company.current !== input.companyId) return;
    if (result.authorizationUrl) await authorization.open(result.authorizationUrl);
    else authorization.cancel();
  }, onError: () => authorization.cancel() });
  const start = (connectionId?: string) => {
    if (!selectedCompanyId) return;
    authorization.reserve();
    connect.mutate({ companyId: selectedCompanyId, connectionId });
  };
  const disconnect = useMutation({ mutationFn: (connectionId: string) => tailscaleApi.disconnect(selectedCompanyId!, connectionId),
    onSuccess: () => { authorization.cancel(); return client.invalidateQueries({ queryKey: tailscaleConnectionsKey(selectedCompanyId) }); } });
  useEffect(() => authorization.cancel, [selectedCompanyId, authorization.cancel]);
  useEffect(() => {
    setBreadcrumbs([{ label: t("pagesApps.common.connectors"), href: "/apps" }, { label: "Tailscale" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);
  if (!selectedCompanyId) return <p className="text-sm text-muted-foreground">{t("pagesApps.tailscale.selectOrganization")}</p>;
  if (connections.access.isPending) return <p className="text-sm text-muted-foreground">{t("pagesApps.tailscale.checkingAccess")}</p>;
  if (connections.access.error) return <p role="alert" className="text-sm text-destructive">{describeError(connections.access.error, { action: t("pagesApps.errorActions.checkTailscaleAccess") }).body}</p>;
  if (!connections.canManage) return <p className="text-sm text-muted-foreground">{t("pagesApps.tailscale.askAdmin")}</p>;
  const error = connect.error ?? disconnect.error ?? connections.error;
  const outcome = searchParams.get("tailscale_error");
  const returnError = outcome === "cancelled" ? t("pagesApps.tailscale.cancelled")
    : outcome === "failed" ? t("pagesApps.tailscale.failed") : null;
  const retryConnection = connections.data?.find(connection => connection.id === searchParams.get("tailscale_connection"));
  return <div className="max-w-3xl space-y-6 pb-8">
    <header className="flex items-center gap-3"><AppLogo name="Tailscale" brandKey="tailscale" size={36} /><h1 className="text-xl font-semibold">Tailscale</h1></header>
    <p className="text-sm text-muted-foreground">{t("pagesApps.tailscale.intro")}</p>
    {connections.isPending && <p className="text-sm text-muted-foreground">{t("pagesApps.tailscale.loading")}</p>}
    {returnError && <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{returnError}</p>{retryConnection && <Button variant="outline" disabled={connect.isPending} onClick={() => start(retryConnection.id)}>{t("pagesApps.common.tryAgain")}</Button>}</div>}
    {error && <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{describeError(error, { action: t("pagesApps.errorActions.connectTailscale") }).body}</p><Button variant="outline" onClick={() => void connections.refetch()}>{t("pagesApps.tailscale.refreshConnections")}</Button></div>}
    <div className={cn("divide-y divide-border", ANALYTICS_MASK_CLASS)}>{(connections.data ?? []).map(connection => <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-1"><p className={cn("font-medium", ANALYTICS_MASK_CLASS)}>{connection.name}</p><p className="text-sm text-muted-foreground">{connection.status === "connected" ? t("pagesApps.tailscale.status.connected") : connection.status === "authorizing" ? t("pagesApps.tailscale.status.authorizing") : connection.status === "connecting" ? t("pagesApps.tailscale.status.connecting") : connection.status === "disconnected" ? t("pagesApps.tailscale.status.disconnected") : connection.status === "expired" ? t("pagesApps.tailscale.status.expired") : t("pagesApps.tailscale.status.incomplete")}</p></div>
      {connection.status === "connected" ? <>
        <Button variant="outline" asChild><Link to={`/company/settings/instance/environments/new?tailscale_connection=${encodeURIComponent(connection.id)}`}>{t("pagesApps.tailscale.createEnvironment")}</Link></Button>
        <Button variant="ghost" disabled={disconnect.isPending} onClick={() => disconnect.mutate(connection.id)}>{t("pagesApps.tailscale.disconnect")} <span className={ANALYTICS_MASK_CLASS}>{connection.name}</span></Button>
      </> : connection.status === "authorizing" ? <TailscaleDeviceSignIn key={`${selectedCompanyId}:${connection.id}`} connection={connection} cancel={() => disconnect.mutate(connection.id)} disabled={disconnect.isPending} />
        : <Button variant="outline" disabled={connect.isPending} onClick={() => start(connection.id)}>{t("pagesApps.tailscale.reconnect")} <span className={ANALYTICS_MASK_CLASS}>{connection.name}</span></Button>}
    </div>)}</div>
    <footer className="flex items-center justify-between gap-3 border-t border-border pt-4">
      <Button variant="ghost" asChild><Link to="/apps">{t("pagesApps.tailscale.backToConnectors")}</Link></Button>
      <Button disabled={connect.isPending || connections.isError || connections.data?.some(connection => connection.status === "authorizing")} onClick={() => start()}>{connect.isPending ? t("pagesApps.tailscale.connecting") : t("pagesApps.tailscale.connectNetwork")}</Button>
    </footer>
  </div>;
}
