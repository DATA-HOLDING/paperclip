import { t } from "@/i18n";
/** Presentation metadata only. Each provider will have its own catalog entry and connection. */
export type RemoteMcpProviderId = "zapier" | "arcade" | "composio" | "executor";

export interface RemoteMcpProvider {
  id: RemoteMcpProviderId;
  name: string;
  description: string;
  instructions: string[];
  setupUrl: string;
  dashboardUrl: string;
  defaultUrl: string;
  placeholder: string;
  urlHelp: string;
  authHelp: string;
  supportsBrowserAuth: boolean;
}

export const remoteMcpProviders: Record<RemoteMcpProviderId, RemoteMcpProvider> = {
  zapier: {
    id: "zapier", name: "Zapier", supportsBrowserAuth: false,
    description: t("featuresConnectionsRemoteMcp.providers.zapier.description"),
    instructions: [t("featuresConnectionsRemoteMcp.providers.zapier.instructions.0"), t("featuresConnectionsRemoteMcp.providers.zapier.instructions.1"), t("featuresConnectionsRemoteMcp.providers.zapier.instructions.2")],
    setupUrl: "https://docs.zapier.com/mcp/get-started/connect/other",
    dashboardUrl: "https://mcp.zapier.com",
    defaultUrl: "", placeholder: t("featuresConnectionsRemoteMcp.providers.zapier.placeholder"),
    urlHelp: t("featuresConnectionsRemoteMcp.providers.zapier.urlHelp"),
    authHelp: t("featuresConnectionsRemoteMcp.providers.zapier.authHelp"),
  },
  arcade: {
    id: "arcade", name: "Arcade", supportsBrowserAuth: true,
    description: t("featuresConnectionsRemoteMcp.providers.arcade.description"),
    instructions: [t("featuresConnectionsRemoteMcp.providers.arcade.instructions.0"), t("featuresConnectionsRemoteMcp.providers.arcade.instructions.1"), t("featuresConnectionsRemoteMcp.providers.arcade.instructions.2")],
    setupUrl: "https://docs.arcade.dev/en/operate/governance/mcp-gateways",
    dashboardUrl: "https://app.arcade.dev",
    defaultUrl: "", placeholder: "https://api.arcade.dev/mcp/your-gateway",
    urlHelp: t("featuresConnectionsRemoteMcp.providers.arcade.urlHelp"),
    authHelp: t("featuresConnectionsRemoteMcp.providers.arcade.authHelp"),
  },
  composio: {
    id: "composio", name: "Composio", supportsBrowserAuth: true,
    description: t("featuresConnectionsRemoteMcp.providers.composio.description"),
    instructions: [t("featuresConnectionsRemoteMcp.providers.composio.instructions.0"), t("featuresConnectionsRemoteMcp.providers.composio.instructions.1")],
    setupUrl: "https://docs.composio.dev/docs/composio-connect",
    dashboardUrl: "https://dashboard.composio.dev",
    defaultUrl: "https://connect.composio.dev/mcp", placeholder: "https://connect.composio.dev/mcp",
    urlHelp: t("featuresConnectionsRemoteMcp.providers.composio.urlHelp"),
    authHelp: t("featuresConnectionsRemoteMcp.providers.composio.authHelp"),
  },
  executor: {
    id: "executor", name: "Executor", supportsBrowserAuth: true,
    description: t("featuresConnectionsRemoteMcp.providers.executor.description"),
    instructions: [t("featuresConnectionsRemoteMcp.providers.executor.instructions.0"), t("featuresConnectionsRemoteMcp.providers.executor.instructions.1"), t("featuresConnectionsRemoteMcp.providers.executor.instructions.2")],
    setupUrl: "https://executor.sh/docs/mcp-proxy",
    dashboardUrl: "https://executor.sh",
    defaultUrl: "", placeholder: t("featuresConnectionsRemoteMcp.providers.executor.placeholder"),
    urlHelp: t("featuresConnectionsRemoteMcp.providers.executor.urlHelp"),
    authHelp: t("featuresConnectionsRemoteMcp.providers.executor.authHelp"),
  },
};
