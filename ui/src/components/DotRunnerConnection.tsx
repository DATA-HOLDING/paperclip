import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { describeError } from "../api/errors";
import { Button } from "./ui/button";
import { buildDotSetupPrompt } from "../lib/dot-setup-prompt";
import { AgentSetupPrompt } from "./AgentSetupPrompt";
import { QueryErrorState, useQueryView } from "./QueryView";
import { t } from "@/i18n";

interface Connection {
  enabled: boolean;
  resourceUrl: string | null;
  binding: { id: string; status: string; connected: boolean; subscriptionVerified: boolean; hasPendingChallenge: boolean;
    assignment?: { status: string; attentionRequired: boolean } | null } | null;
}

/** Pairing codes stay in component memory and expire; never save them in config. */
export function DotRunnerConnection({ companyId, agentId, bindingId, onBinding }: {
  companyId?: string; agentId?: string; bindingId?: string; onBinding: (id: string) => void;
}) {
  const client = useQueryClient();
  const [pairing, setPairing] = useState<{ pairingCode: string; expiresAt: string } | null>(null);
  const path = `/companies/${companyId}/agents/${agentId}/dot-binding`;
  const key = ["dot-binding", companyId, agentId];
  const state = useQuery({ queryKey: key, enabled: !!companyId && !!agentId,
    queryFn: () => api.get<Connection>(path),
    refetchInterval: query => query.state.data?.binding?.status === "pairing" ||
      (query.state.data?.binding?.connected && !query.state.data.binding.subscriptionVerified) ||
      query.state.data?.binding?.hasPendingChallenge || query.state.data?.binding?.assignment ? 5000 : false });
  // Read the connection state through the shared view: cached data stays
  // visible while a transient refetch fails,and a no-data failure shows
  // readable copy with Retry.
  const stateView = useQueryView(state);
  const pair = useMutation({ mutationFn: () => api.post<{ bindingId: string; pairingCode: string; expiresAt: string }>(path, {}),
    onSuccess: result => { setPairing(result); onBinding(result.bindingId); void client.invalidateQueries({ queryKey: key }); } });
  const test = useMutation({ mutationFn: () => api.post(path + "/event-test", {}),
    onSuccess: () => { void client.invalidateQueries({ queryKey: key }); } });
  const revoke = useMutation({ mutationFn: () => api.delete(path),
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<Connection>(key, previous => previous ? { ...previous, binding: null } : previous);
      setPairing(null); onBinding("");
      await client.invalidateQueries({ queryKey: key });
    } });
  useEffect(() => {
    if (!pairing) return;
    const timer = window.setTimeout(() => setPairing(null), Math.max(0, Date.parse(pairing.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [pairing]);
  const existingBindingId = state.data?.binding?.id;
  useEffect(() => {
    if (existingBindingId && existingBindingId !== bindingId && !revoke.isPending) onBinding(existingBindingId);
  }, [existingBindingId, bindingId, onBinding, revoke.isPending]);
  if (!agentId) return <p className="text-sm text-muted-foreground">{t("componentsDotRunnerConnection.saveFirst")}</p>;
  const mutationError = pair.error ?? test.error ?? revoke.error;
  const b = state.data?.binding;
  const setupPrompt = pairing && state.data?.resourceUrl && companyId && agentId
    ? buildDotSetupPrompt({ companyId, agentId, resourceUrl: state.data.resourceUrl, ...pairing })
    : "";
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">{t("componentsDotRunnerConnection.intro")}</p>
    {state.data && !state.data.enabled && <p className="text-sm text-muted-foreground">{t("componentsDotRunnerConnection.enableExperimental")}</p>}
    {state.data?.resourceUrl && <p className="text-sm break-all">{t("componentsDotRunnerConnection.mcpUrl")} <code>{state.data.resourceUrl}</code></p>}
    {b && <p className="text-sm">{t("componentsDotRunnerConnection.connectionStatus", { status: b.status, subscription: b.subscriptionVerified ? t("componentsDotRunnerConnection.subscription.verified") : t("componentsDotRunnerConnection.subscription.required") })}</p>}
    {b?.assignment && <p className="text-sm">{t("componentsDotRunnerConnection.assignmentStatus", { status: b.assignment.status === "offered" ? t("componentsDotRunnerConnection.assignment.offered") : t("componentsDotRunnerConnection.assignment.accepted") })}</p>}
    {b?.assignment?.attentionRequired && <p className="text-sm text-destructive" role="alert">{t("componentsDotRunnerConnection.attentionRequired")}</p>}
    {pairing && setupPrompt && b?.status === "pairing" && <div className="space-y-2">
      <AgentSetupPrompt
        prompt={setupPrompt}
        label={t("componentsDotRunnerConnection.setup.label")}
        agent={{ name: "Dot", src: "/brands/adapters/openai-dot.svg" }}
        title={t("componentsDotRunnerConnection.setup.title")}
        description={t("componentsDotRunnerConnection.setup.description")}
        side="bottom"
      />
      <p className="text-xs text-muted-foreground">{t("componentsDotRunnerConnection.setup.expires", { time: new Date(pairing.expiresAt).toLocaleTimeString() })}</p>
    </div>}
    {!pairing && b?.status === "pairing" && <p className="text-sm text-muted-foreground">{t("componentsDotRunnerConnection.revokeAndRepair")}</p>}
    <div className="flex flex-wrap items-center gap-2">
      {!b && <Button type="button" variant="outline" disabled={!state.data?.enabled || !state.data?.resourceUrl || pair.isPending} onClick={() => pair.mutate()}>{t("componentsDotRunnerConnection.actions.pair")}</Button>}
      {b?.subscriptionVerified && <Button type="button" variant="outline" disabled={test.isPending || b.hasPendingChallenge} onClick={() => test.mutate()}>{t("componentsDotRunnerConnection.actions.test")}</Button>}
      <Button type="button" variant="outline" onClick={() => { void state.refetch(); }}>{t("componentsDotRunnerConnection.actions.refresh")}</Button>
      {b && <Button type="button" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate()}>{t("componentsDotRunnerConnection.actions.revoke")}</Button>}
    </div>
    {b?.hasPendingChallenge && <p className="text-sm text-muted-foreground">{t("componentsDotRunnerConnection.pendingChallenge")}</p>}
    {stateView.kind === "error" && (
      <QueryErrorState
        size="inline"
        error={stateView.error}
        action={t("componentsDotRunnerConnection.loadAction")}
        onRetry={stateView.retry}
        retrying={stateView.isFetching}
      />
    )}
    {mutationError && <p role="alert" className="text-sm text-destructive">{describeError(mutationError).body}</p>}
  </div>;
}
