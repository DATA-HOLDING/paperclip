/** Redacted presentation contracts shared with the production API. */
import { isAiConnectionCompatible, type AiConnectionMetadata, type AiProvider, type AiAuthMethod, type AiManagedConnectionSummary, type AiConnectionBinding } from "@paperclipai/shared";
import { t } from "@/i18n";
export type { AiProvider, AiAuthMethod, AiConnectionBinding } from "@paperclipai/shared";
export type AiConnectionStatus = AiManagedConnectionSummary["status"];

export const AI_PROVIDERS: Record<
  AiProvider,
  { name: string; subscriptionName?: string; logo?: string }
> = {
  github: { name: "GitHub Copilot", logo: "/brands/apps/github-copilot.svg" },
  google: { name: "Google", subscriptionName: t("componentsAiConnections.model.subscriptionGoogle"), logo: "/brands/apps/google.svg" },
  anthropic: {
    name: "Claude",
    subscriptionName: t("componentsAiConnections.model.subscriptionClaude"),
    logo: "/brands/claude-color.svg",
  },
  openai: {
    name: "OpenAI",
    subscriptionName: t("componentsAiConnections.model.subscriptionChatGpt"),
    logo: "/brands/codex-color.svg",
  },
  openrouter: { name: "OpenRouter", logo: "/brands/apps/openrouter.svg" },
  xai: {
    name: "Grok",
    subscriptionName: t("componentsAiConnections.model.subscriptionGrok"),
    logo: "/brands/adapters/grok.svg",
  },
};

export type AiConnectionSummary = Omit<AiManagedConnectionSummary, "isDefault"> & { isDefault?: boolean };

/** Before model selection, test harness support without excluding multi-provider accounts. */
export function isAiConnectionCompatibleForSelection(
  connection: AiConnectionMetadata | AiConnectionBinding,
  adapterType: string,
  model?: string,
) {
  return isAiConnectionCompatible(connection, adapterType, model || `${connection.provider}/`);
}

export interface AiConnectionRequirement {
  companyId: string;
  provider: AiProvider;
  method?: AiAuthMethod;
}

export const AI_CONNECTION_STATUS: Record<AiConnectionStatus, string> = {
  connected: t("componentsAiConnections.model.status.connected"),
  needs_attention: t("componentsAiConnections.model.status.needsAttention"),
  expired: t("componentsAiConnections.model.status.expired"),
  revoked: t("componentsAiConnections.model.status.revoked"),
};

export function defaultAiConnectionName(ownerName: string | undefined, provider: AiProvider, method: AiAuthMethod) {
  const owner = ownerName?.trim();
  const providerName = method === "subscription"
    ? AI_PROVIDERS[provider].subscriptionName ?? AI_PROVIDERS[provider].name
    : t("componentsAiConnections.model.apiName", { provider: AI_PROVIDERS[provider].name });
  return owner && owner !== "You"
    ? t("componentsAiConnections.model.nameOther", { owner, provider: providerName })
    : t("componentsAiConnections.model.nameOwn", { provider: providerName });
}

export function aiMethodLabel(provider: AiProvider, method: AiAuthMethod) {
  return method === "subscription"
    ? (AI_PROVIDERS[provider].subscriptionName ?? t("componentsAiConnections.model.subscriptionUnavailable"))
    : provider === "github" ? t("componentsAiConnections.model.personalAccessToken") : t("componentsAiConnections.model.apiKey");
}

export function aiConnectionDisplayLabel(connection: AiConnectionSummary) {
  const personal = connection.ownership === "personal";
  return [
    connection.name,
    aiMethodLabel(connection.provider, connection.method),
    personal ? t("componentsAiConnections.model.personal") : t("componentsAiConnections.model.companyShared"),
    connection.accountLabel || connection.ownerName,
  ].filter(Boolean).join(" · ");
}

export function matchesAiRequirement(
  connection: AiConnectionSummary,
  requirement: AiConnectionRequirement,
) {
  return (
    connection.companyId === requirement.companyId &&
    connection.provider === requirement.provider &&
    (requirement.method === undefined || connection.method === requirement.method)
  );
}

export function personalAiDefault(
  connections: AiConnectionSummary[],
  requirement: AiConnectionRequirement,
  userId: string,
) {
  // Never choose another account because the declared default is unhealthy.
  return connections.find(
    (connection) =>
      matchesAiRequirement(connection, { ...requirement, method: undefined }) &&
      connection.ownership === "personal" &&
      connection.ownerUserId === userId &&
      connection.isDefault,
  );
}

export function aiConnectionProblem(connection?: AiConnectionSummary) {
  if (!connection)
    return t("componentsAiConnections.model.noConnection");
  return (
    connection.unavailableReason ??
    (connection.status === "connected"
      ? null
      : t("componentsAiConnections.model.reconnectToContinue", { status: AI_CONNECTION_STATUS[connection.status] }))
  );
}

export function bindingProblem(
  binding: AiConnectionBinding,
  requirement: AiConnectionRequirement,
  connections: AiConnectionSummary[],
  userId: string,
  _agentId: string,
) {
  if (
    binding.provider !== requirement.provider ||
    (binding.mode !== "responsible_user" && requirement.method !== undefined && binding.method !== requirement.method)
  )
    return t("componentsAiConnections.model.chooseCompatible");
  if (binding.mode === "responsible_user")
    return aiConnectionProblem(
      personalAiDefault(connections, requirement, userId),
    );
  const connection = connections.find(
    (item) =>
      item.id === binding.connectionId &&
      item.grantId === binding.grantId &&
      item.method === binding.method &&
      matchesAiRequirement(item, requirement),
  );
  if (!connection)
    return t("componentsAiConnections.model.noLongerAvailable");
  if (binding.mode === "shared" && connection.ownership !== "shared")
    return t("componentsAiConnections.model.chooseShared");
  if (
    binding.mode === "delegated" &&
    (connection.ownership !== "personal" ||
      connection.ownerUserId !== userId)
  )
    return t("componentsAiConnections.model.notShared");
  return aiConnectionProblem(connection);
}
