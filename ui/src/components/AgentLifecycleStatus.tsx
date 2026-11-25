import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import type { Agent, AgentLifecycleState } from "@paperclipai/shared";
import { Loader2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { t } from "@/i18n";

const phases = {
  preparing: [t("componentsAgentLifecycleStatus.phases.preparing.label"), t("componentsAgentLifecycleStatus.phases.preparing.description")],
  verifying: [t("componentsAgentLifecycleStatus.phases.verifying.label"), t("componentsAgentLifecycleStatus.phases.verifying.description")],
  pausing: [t("componentsAgentLifecycleStatus.phases.pausing.label"), t("componentsAgentLifecycleStatus.phases.pausing.description")],
  resuming: [t("componentsAgentLifecycleStatus.phases.resuming.label"), t("componentsAgentLifecycleStatus.phases.resuming.description")],
  terminating: [t("componentsAgentLifecycleStatus.phases.terminating.label"), t("componentsAgentLifecycleStatus.phases.terminating.description")],
  cleaning_up: [t("componentsAgentLifecycleStatus.phases.cleaningUp.label"), t("componentsAgentLifecycleStatus.phases.cleaningUp.description")],
} satisfies Partial<Record<AgentLifecycleState, [string, string]>>;

const failedPhases = {
  preparing: t("componentsAgentLifecycleStatus.failed.preparing"),
  verifying: t("componentsAgentLifecycleStatus.failed.verifying"),
  pausing: t("componentsAgentLifecycleStatus.failed.pausing"),
  resuming: t("componentsAgentLifecycleStatus.failed.resuming"),
  terminating: t("componentsAgentLifecycleStatus.failed.terminating"),
  cleaning_up: t("componentsAgentLifecycleStatus.failed.cleaningUp"),
};

function pendingPhase(state?: AgentLifecycleState) {
  return state && state in phases ? phases[state as keyof typeof phases] : undefined;
}

export function agentLifecycleRefetchInterval(state?: AgentLifecycleState) {
  return pendingPhase(state) ? 2_000 : 30_000;
}

/** Poll lifecycle fields without refreshing the record used by editable forms. */
export function useAgentLifecycleStatus(agent?: Agent) {
  return useQuery({
    queryKey: [...queryKeys.agents.detail(agent?.id ?? ""), "lifecycle", agent?.companyId],
    queryFn: () => agentsApi.get(agent!.id, agent!.companyId),
    enabled: Boolean(agent),
    select: current => ({ status: current.status, pauseReason: current.pauseReason, pausedAt: current.pausedAt, lifecycleState: current.lifecycleState,
      lifecycleVersion: current.lifecycleVersion, lifecycleError: current.lifecycleError }),
    refetchInterval: query => agentLifecycleRefetchInterval(query.state.data?.lifecycleState ?? agent?.lifecycleState),
  });
}

export function AgentLifecycleStatus({ agent, onRetry, retryPending, refreshError = false }: {
  agent: Pick<Agent, "lifecycleState" | "lifecycleError">;
  onRetry: () => void;
  retryPending: boolean;
  refreshError?: boolean;
}) {
  const phase = pendingPhase(agent.lifecycleState);
  if (!phase && !refreshError) return null;
  return <div role="status" aria-live="polite" className="space-y-2 text-sm">
    {refreshError && <p className="text-destructive">{t("componentsAgentLifecycleStatus.refreshError")}</p>}
    {phase && <div className="flex flex-wrap items-center gap-2">
      <Badge variant={agent.lifecycleError ? "destructive" : "secondary"}>
        {!agent.lifecycleError && <Loader2 aria-hidden="true" className="mr-1 size-3 animate-spin motion-reduce:animate-none" />}
        {agent.lifecycleError ? failedPhases[agent.lifecycleState as keyof typeof failedPhases] : phase[0]}
      </Badge>
      {!agent.lifecycleError && <span className="text-muted-foreground">{phase[1]}</span>}
    </div>}
    {phase && agent.lifecycleError && <div className="flex flex-wrap items-center gap-2 text-destructive">
      <span>{agent.lifecycleError}</span>
      <Button variant="outline" size="sm" disabled={retryPending} onClick={onRetry}>
        {retryPending ? t("componentsAgentLifecycleStatus.retrying") : t("componentsAgentLifecycleStatus.retryNow")}
      </Button>
    </div>}
    {phase && agent.lifecycleError && <p className="text-muted-foreground">{agent.lifecycleState === "verifying" || agent.lifecycleState === "resuming"
      ? t("componentsAgentLifecycleStatus.retryHintManual")
      : t("componentsAgentLifecycleStatus.retryHintAuto")}</p>}
  </div>;
}
