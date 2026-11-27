import { useEffect, useState } from "react";
import { t } from "@/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Paperclip } from "lucide-react";
import { Link, useParams } from "@/lib/router";
import type { McpConnection, McpConnectionRequest, McpDotPairingPreview } from "@paperclipai/shared";
import { deriveInitials, Identity } from "@/components/Identity";
import { assistantConnectionDisplayName } from "./apps/connection-owner";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CompanyPatternIcon } from "@/components/CompanyPatternIcon";
import { useResilientFetch } from "@/hooks/useResilientFetch";
import { api } from "../api/client";
import { describeError } from "../api/errors";
import { cn } from "@/lib/utils";
import { ANALYTICS_NO_CAPTURE_CLASS } from "@/lib/analytics/privacy";

const PAIRING_CODE_PATTERN = /^[A-Za-z0-9_-]{32}$/;

// Bundle known-origin icons so opening consent never contacts a client-selected site.
// Client-supplied names never select branding.
function ClientOrigin({ origin }: { origin: string }) {
  const [failed, setFailed] = useState(false);
  let favicon: string | undefined;
  try {
    const url = new URL(origin);
    if (url.origin === "https://claude.ai") favicon = "/brands/claude-color.svg";
    else if (["https://chatgpt.com", "https://chat.openai.com", "https://openai.com"].includes(url.origin)) favicon = "/brands/codex-color.svg";
  } catch { /* An unavailable origin keeps the neutral site icon. */ }
  return <div className="flex items-center gap-2 text-sm text-muted-foreground">
    {favicon && !failed ? <img src={favicon} alt="" className="size-4 shrink-0 object-contain" referrerPolicy="no-referrer" crossOrigin="anonymous" onError={() => setFailed(true)} /> : <Globe className="size-4 shrink-0" aria-hidden="true" />}
    <bdi className="min-w-0 break-all">{origin}</bdi>
  </div>;
}

export function McpConnectPage({ agentPairingOnly = false }: { agentPairingOnly?: boolean } = {}) {
  const { id = "" } = useParams();
  return <McpConnectRequest key={id} id={id} agentPairingOnly={agentPairingOnly} />;
}

export function McpDevicePage({ initialCode }: { initialCode?: string } = {}) {
  const [code, setCode] = useState(initialCode ?? new URLSearchParams(window.location.search).get("user_code") ?? "");
  const [submitted, setSubmitted] = useState(code);
  if (submitted) return <McpConnectRequest key={submitted} id={submitted} device onEditCode={() => setSubmitted("")} />;
  return <div className="mx-auto max-w-xl py-10"><Card className="space-y-4 p-6"><div className="flex items-center gap-3"><Paperclip className="size-8 shrink-0" /><h1 className="min-w-0 text-xl font-semibold">{t("pagesMcpConnect.device.title")}</h1></div>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); setSubmitted(code.trim()); }}>
      <label htmlFor="device-code" className="text-sm">{t("pagesMcpConnect.device.codeLabel")}</label>
      <Input id="device-code" autoComplete="off" value={code} onChange={event => setCode(event.target.value)} required maxLength={12} />
      <div className="flex justify-end"><Button type="submit">{t("pagesMcpConnect.device.continue")}</Button></div>
    </form></Card></div>;
}

function McpConnectRequest({ id, device = false, agentPairingOnly = false, onEditCode }: { id: string; device?: boolean; agentPairingOnly?: boolean; onEditCode?: () => void }) {
  const requestPrefix = agentPairingOnly ? "/dot-mcp/requests" : "/mcp/requests";
  const [companyId, setCompanyId] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [writeEnabled, setWriteEnabled] = useState(true);
  const [deviceResult, setDeviceResult] = useState<"approved" | "denied" | null>(null);
  const request = useQuery({ queryKey: [device ? "mcp-device" : agentPairingOnly ? "dot-mcp-request" : "mcp-request", id], queryFn: () => api.get<McpConnectionRequest>(device ? `/mcp/device?user_code=${encodeURIComponent(id)}` : `${requestPrefix}/${encodeURIComponent(id)}`) });
  const requestView = useQueryView(request);
  const data = request.data;
  const trimmedPairingCode = pairingCode.trim();
  const previewEnabled = Boolean(data?.agentConnection) && !device && PAIRING_CODE_PATTERN.test(trimmedPairingCode);
  // A read-only preview behind a POST. The code is part of the key so an older
  // preview is dropped the moment the code changes and a late response for an
  // old code is ignored; it stays in this component's memory, never in the
  // shared query cache.
  const preview = useResilientFetch({
    key: ["dot-pairing-preview", requestPrefix, id, trimmedPairingCode],
    enabled: previewEnabled,
    fetcher: (signal) => api.post<McpDotPairingPreview>(`${requestPrefix}/${encodeURIComponent(id)}/dot-pairing/preview`, { pairingCode: trimmedPairingCode }, { signal }),
  });
  const pairingPreview = previewEnabled && (preview.view.kind === "ready" || preview.view.kind === "stale") ? preview.data ?? null : null;
  const previewPending = previewEnabled && (preview.view.kind === "loading" || preview.view.kind === "reconnecting");
  const selectedCompanyId = data?.requestedCompanyId ?? (companyId || data?.companies[0]?.id || "");
  // Pin the default once loaded so a refetch cannot silently switch organizations.
  useEffect(() => {
    if (!companyId && !data?.requestedCompanyId && data?.companies[0]) setCompanyId(data.companies[0].id);
  }, [companyId, data]);
  const clientName = data?.clientName.trim();
  const assistantName = clientName && !/^(assistant|mcp client)$/i.test(clientName) ? clientName : t("pagesMcpConnect.yourAssistant");
  const clientOrigin = data?.clientOrigin || data?.redirectOrigin;
  const company = data?.companies.find((item) => item.id === selectedCompanyId);
  const canApproveWrites = Boolean(!data?.agentConnection && company?.canWrite && writeEnabled);
  const allowWrites = Boolean(data?.requestedWrite && canApproveWrites);
  const allowConfiguration = Boolean(data?.requestedConfigure && canApproveWrites);
  const consent = useMutation({
    mutationFn: (decision: "approve" | "deny") => api.post<{ redirectUrl?: string; status?: "approved" | "denied" }>(device ? "/mcp/device/consent" : `/mcp/requests/${encodeURIComponent(id)}/consent`, { decision, companyId: selectedCompanyId || undefined, allowWrites: decision === "approve" && allowWrites, allowConfiguration: decision === "approve" && allowConfiguration, ...(device ? { userCode: id } : {}) }),
    onSuccess: ({ redirectUrl, status }) => { if (device && status) setDeviceResult(status); else if (redirectUrl) window.location.assign(redirectUrl); },
  });
  const pairDot = useMutation({
    mutationFn: () => api.post<{ redirectUrl: string }>(`${requestPrefix}/${encodeURIComponent(id)}/dot-pairing`, { pairingCode: pairingCode.trim() }),
    onSuccess: ({ redirectUrl }) => { setPairingCode(""); window.location.assign(redirectUrl); },
  });
  if (deviceResult) return <div className="mx-auto max-w-xl py-10"><Card className="block space-y-4 p-6"><Paperclip className="size-8" /><h1 className="text-xl font-semibold">{deviceResult === "approved" ? t("pagesMcpConnect.device.approvedTitle") : t("pagesMcpConnect.device.declinedTitle")}</h1><p className="text-sm">{deviceResult === "approved" ? t("pagesMcpConnect.device.approvedBody") : t("pagesMcpConnect.device.declinedBody")}</p><Button variant="outline" asChild><Link to="/">{t("pagesMcpConnect.backToPaperclip")}</Link></Button></Card></div>;
  const returnPath = device ? `/mcp-device?user_code=${encodeURIComponent(id)}` : `${agentPairingOnly ? "/dot-connect" : "/mcp-connect"}/${id}`;
  return <div className="mx-auto max-w-xl py-10">
    <Card className="block space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Paperclip className="size-8 shrink-0 text-foreground" role="img" aria-label="Paperclip" />
        <h1 className="min-w-0 break-words text-xl font-semibold">{t("pagesMcpConnect.connectTitleBefore")}<bdi>{assistantName}</bdi>{t("pagesMcpConnect.connectTitleAfter")}</h1>
      </div>
      {clientOrigin && <ClientOrigin key={clientOrigin} origin={clientOrigin} />}
      {!device && data?.redirectOrigin && data.redirectOrigin !== clientOrigin && <ClientOrigin key={data.redirectOrigin} origin={data.redirectOrigin} />}
      {device && <p className="text-sm">{t("pagesMcpConnect.device.confirmMatches")}<strong className={cn("font-mono", ANALYTICS_NO_CAPTURE_CLASS)}>{id.toUpperCase()}</strong></p>}
      {(requestView.kind === "loading" || requestView.kind === "reconnecting") && <p role="status" className="text-sm text-muted-foreground">{t("pagesMcpConnect.loadingRequest")}</p>}
      {requestView.kind === "error" && <QueryErrorState error={requestView.error} action={t("pagesMcpConnect.loadRequestAction")} onRetry={requestView.retry} retrying={requestView.isFetching} />}
      {requestView.kind === "error" && <p className="text-sm text-muted-foreground">{t("pagesMcpConnect.startNew")}</p>}
      {device && requestView.kind === "error" && <Button variant="outline" onClick={onEditCode}>{t("pagesMcpConnect.device.differentCode")}</Button>}
      {data?.agentConnection && !device && <form className="space-y-3" onSubmit={event => { event.preventDefault(); pairDot.mutate(); }}>
        <p className="text-sm">{t("pagesMcpConnect.dot.intro")}</p>
        <label htmlFor="dot-pairing-code" className="text-sm">{t("pagesMcpConnect.dot.pairingCode")}</label>
        <Input id="dot-pairing-code" type="password" autoComplete="off" value={pairingCode} onChange={event => setPairingCode(event.target.value)} required maxLength={32} />
        {previewPending && <p role="status" className="text-sm text-muted-foreground">{t("pagesMcpConnect.dot.checking")}</p>}
        {pairingPreview?.providerKind === "grok_bot" && <p className="text-sm font-medium">{t("pagesMcpConnect.dot.allowAs", { agent: pairingPreview.agent.name, company: pairingPreview.company.name })}</p>}
        {pairingPreview && <dl className="space-y-2 rounded-md border border-border p-3 text-sm">
          <div><dt className="text-muted-foreground">{t("pagesMcpConnect.dot.company")}</dt><dd>{pairingPreview.company.name} <span className="text-xs text-muted-foreground">({pairingPreview.company.id})</span></dd></div>
          <div><dt className="text-muted-foreground">{t("pagesMcpConnect.dot.agent")}</dt><dd>{pairingPreview.agent.name} <span className="text-xs text-muted-foreground">({pairingPreview.agent.id})</span></dd></div>
          <div><dt className="text-muted-foreground">{t("pagesMcpConnect.dot.permissions")}</dt><dd>{pairingPreview.permissions}</dd></div>
          {pairingPreview.authorizingPerson && <div><dt className="text-muted-foreground">{t("pagesMcpConnect.dot.authorizedBy")}</dt><dd>{pairingPreview.authorizingPerson}</dd></div>}
          <div><dt className="text-muted-foreground">{t("pagesMcpConnect.dot.accessDuration")}</dt><dd>{pairingPreview.accessDuration}</dd></div>
        </dl>}
        {previewEnabled && preview.view.kind === "error" && <QueryErrorState size="inline" error={preview.error} action={t("pagesMcpConnect.dot.checkAction")} onRetry={preview.view.retry} retrying={preview.view.isFetching} />}
        {pairDot.error && <p role="alert" className="text-sm text-destructive">{describeError(pairDot.error, { action: t("pagesMcpConnect.dot.connectAction") }).body}</p>}
        <div className="flex justify-end"><Button type="submit" disabled={!pairingPreview || !PAIRING_CODE_PATTERN.test(trimmedPairingCode) || pairDot.isPending}>{pairDot.isPending ? t("pagesMcpConnect.connecting") : t("pagesMcpConnect.dot.allowButton")}</Button></div>
      </form>}
      {data && <>
        {data.requiresSignIn ? <Button asChild><Link to={`/auth?next=${encodeURIComponent(returnPath)}`}>{t("pagesMcpConnect.signIn")}</Link></Button> : <>
          {data.requestedCompanyId ? <div className="flex items-center gap-4 rounded-md border border-border p-4">
            {company && <CompanyPatternIcon companyName={company.name} logoUrl={company.logoUrl} className="size-14 shrink-0 rounded-lg text-xl" />}
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">{t("pagesMcpConnect.organization")}</p>
              {company ? <p className="break-words text-lg font-semibold">{company.name}</p> : <p className="text-sm text-destructive">{t("pagesMcpConnect.orgUnavailable")}</p>}
            </div>
          </div> : <fieldset className="space-y-2" disabled={consent.isPending}>
            <legend className="mb-2 text-sm font-medium">{t("pagesMcpConnect.organization")}</legend>
            {data.companies.map((item) => <label key={item.id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
              <input type="radio" name="company" aria-label={item.name} value={item.id} checked={selectedCompanyId === item.id} onChange={() => setCompanyId(item.id)} />
              <CompanyPatternIcon companyName={item.name} logoUrl={item.logoUrl} className="size-12 shrink-0 rounded-lg" />
              <span className="min-w-0 break-words font-medium">{item.name}</span>
            </label>)}
            {!data.companies.length && <p className="text-sm text-muted-foreground">{t("pagesMcpConnect.noOrganizations")}</p>}
          </fieldset>}
          <p className="text-sm">{data.agentConnection ? t("pagesMcpConnect.dot.scopeDescription") : t("pagesMcpConnect.readAll")}</p>
          {(data.requestedWrite || data.requestedConfigure) && !data.agentConnection && <label htmlFor="mcp-allow-writes" className="flex items-start gap-3 text-sm leading-6">
            <span className="flex h-6 shrink-0 items-center">
              <Checkbox id="mcp-allow-writes" checked={canApproveWrites} disabled={!company?.canWrite || consent.isPending} onCheckedChange={(checked) => setWriteEnabled(checked === true)} />
            </span>
            <span>{t("pagesMcpConnect.writeAll")}</span>
          </label>}
          {company && !company.canWrite && <p className="text-sm text-muted-foreground">{t("pagesMcpConnect.readOnlyRole")}</p>}
          {consent.error && <p role="alert" className="text-sm text-destructive">{describeError(consent.error).body}</p>}
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" disabled={consent.isPending} onClick={() => consent.mutate("deny")}>{t("pagesMcpConnect.cancel")}</Button>
            <Button className="h-auto min-h-10 min-w-0 shrink whitespace-normal" disabled={!company || (data.agentConnection && !company.canWrite) || consent.isPending} onClick={() => consent.mutate("approve")}>{consent.isPending ? t("pagesMcpConnect.connecting") : data.agentConnection ? t("pagesMcpConnect.dot.connectAgent") : t("pagesMcpConnect.connectOrganization")}</Button>
          </div>
        </>}
      </>}
    </Card>
  </div>;
}

export function AssistantConnectionsPage() {
  const client = useQueryClient();
  const connections = useQuery({ queryKey: ["mcp-connections"], queryFn: () => api.get<McpConnection[]>("/mcp/connections") });
  const connectionsView = useQueryView(connections);
  const active = connections.data?.filter(connection => !connection.revokedAt);
  const revoke = useMutation({ mutationFn: (id: string) => api.delete(`/mcp/connections/${id}`), onSuccess: (_, id) => {
    client.setQueryData<McpConnection[]>(["mcp-connections"], rows => rows?.filter(row => row.id !== id));
    return client.invalidateQueries({ queryKey: ["mcp-connections"] });
  } });
  return <div className="mx-auto max-w-xl space-y-4 py-10">
    <h1 className="text-xl font-semibold">{t("pagesMcpConnect.connections.title")}</h1>
    <p className="text-sm text-muted-foreground">{t("pagesMcpConnect.connections.description")}</p>
    {(connectionsView.kind === "loading" || connectionsView.kind === "reconnecting") && <p role="status" className="text-sm text-muted-foreground">{t("pagesMcpConnect.connections.loading")}</p>}
    {connectionsView.kind === "error" && <QueryErrorState error={connectionsView.error} action={t("pagesMcpConnect.connections.loadAction")} onRetry={connectionsView.retry} retrying={connectionsView.isFetching} />}
    {revoke.error && <p role="alert" className="text-sm text-destructive">{describeError(revoke.error, { action: t("pagesMcpConnect.connections.revokeAction") }).body}</p>}
    {active?.length === 0 && <p className="text-sm">{t("pagesMcpConnect.connections.empty")}</p>}
    {active?.map((connection) => <Card key={connection.id} className="block space-y-2 p-4">
      <h2 className="font-medium"><Identity name={assistantConnectionDisplayName(connection)} avatarUrl={connection.user?.image} initials={deriveInitials(connection.user?.name ?? t("pagesMcpConnect.connections.you"))} /></h2>
      <p className="text-sm text-muted-foreground">{t("pagesMcpConnect.connections.organization", { name: connection.companyName })}</p>
      {connection.agent && <p className="text-sm">{t("pagesMcpConnect.connections.worksAs")}<Link className="underline" to={`/${connection.companyPrefix ?? connection.companyId}/agents/${connection.agent.id}/runtime`}>{connection.agent.name}</Link>{connection.user ? t("pagesMcpConnect.connections.authorizedBy", { name: connection.user.name }) : ""}</p>}
      <p className="text-sm">{connection.scopes.includes("paperclip:agent") ? t("pagesMcpConnect.connections.agentConnection") : connection.scopes.includes("paperclip:write") ? t("pagesMcpConnect.connections.readEdit") : t("pagesMcpConnect.connections.readOnly")}</p>
      {connection.scopes.includes("paperclip:configure") && <p className="text-sm">{t("pagesMcpConnect.connections.configure")}</p>}
      <Button variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(connection.id)}>{t("pagesMcpConnect.connections.revoke")}</Button>
    </Card>)}
    <Link className="text-sm underline" to="/">{t("pagesMcpConnect.backToPaperclip")}</Link>
  </div>;
}
