import { SpekoPhoneLine } from "@/components/voice/SpekoPhoneLine";
import { SpekoIncomingCalls } from "@/components/voice/SpekoIncomingCalls";
import { SpekoCallActivityItem, SpekoUnapprovedCallActivityItem, useSpekoCallHistory } from "@/components/voice/SpekoCallHistory";
import { SpekoPhoneCallback } from "@/components/voice/SpekoPhoneCallback";
import { deriveInitials } from "@/components/Identity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { agentAvatarUrl } from "@/lib/agent-avatar-url";
import { resolveAgentAppearance } from "@paperclipai/shared";
import { SlackTestMessageButton } from "./SlackTestMessageButton";
import { slackConversationUrl } from "./slack/conversation-url";
import { useAccountIdentity } from "@/api/companies-query";
import { AgentAvatar } from "@/components/AgentAvatar";
import { SlackSetupAdvanced } from "./SlackAppDetails";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SlackToolsSettings, SlackSearchAccess } from "./SlackToolSettings";
import { ChatCommunicationInstructions } from "./ChatCommunicationInstructions";
import { ChatExecutionDefaults } from "./ChatExecutionDefaults";
import { agentsApi } from "@/api/agents";
import { ChatConversationList } from "./ChatConversationList";
import { GitHubConnectionRecoveryNotice } from "./GitHubConnectionRecovery";
import { GitHubBotManagement, GitHubReviews } from "./GitHubBotManagement";
import { GitHubBotMention, GitHubAppIdentityActions } from "./GitHubAppIdentity";
import { GitHubConnectionComplete, type GitHubConnectionCompleteLocationState } from "./GitHubConnectionComplete";
import { EmailEndpointSettings } from "./EmailEndpointSetup";
import { EmailConnectionAccess } from "@/components/EmailConnectionAccess";
import { emailApi } from "@/api/email";
import { toolsApi } from "@/api/tools";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Check,
  Activity as ActivityIcon,
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Unlink,
} from "lucide-react";
import {
  chatEndpointsApi,
  type ChatActivityItem,
  type ChatEndpoint,
  type ChatEndpointResource,
  type ChatProvider,
} from "@/api/chatEndpoints";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { AppLogo } from "../AppLogo";
import { StatusBadge } from "@/components/StatusBadge";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useToast } from "@/context/ToastContext";
import { formatDateTime } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { copyTextToClipboard } from "@/lib/clipboard";
import { Link, Navigate, useLocation, useNavigate, useParams } from "@/lib/router";
import { describeError } from "@/api/errors";
import { ANALYTICS_MASK_CLASS, ANALYTICS_NO_CAPTURE_CLASS } from "@/lib/analytics/privacy";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

const tabs = ["settings", "access", "reviews", "conversations", "activity"] as const;
type ChatTab = (typeof tabs)[number];
const tabItems = tabs.map((value) => ({
  value,
  label: t(`pagesAppsChatChatEndpointDetail.tabs.${value}`),
}));
const providerNames: Record<ChatProvider, string> = {
  speko: "Speko",
  agentmail: "AgentMail",
  slack: "Slack",
  github: "GitHub",
  discord: "Discord",
  "microsoft-teams": "Microsoft Teams",
  telegram: "Telegram",
  "imessage-photon": "iMessage Photon",
};

const providerLifecycleGuidance: Record<
  ChatProvider,
  { reconnect: string; remove: string }
> = {
  speko: {
    reconnect: t("pagesAppsChatChatEndpointDetail.lifecycle.speko.reconnect"),
    remove: t("pagesAppsChatChatEndpointDetail.lifecycle.speko.remove"),
  },
  agentmail: { reconnect: t("pagesAppsChatChatEndpointDetail.lifecycle.agentmail.reconnect"), remove: t("pagesAppsChatChatEndpointDetail.lifecycle.agentmail.remove") },
  slack: {
    reconnect: t("pagesAppsChatChatEndpointDetail.lifecycle.slack.reconnect"),
    remove: t("pagesAppsChatChatEndpointDetail.lifecycle.slack.remove"),
  },
  github: {
    reconnect: t("pagesAppsChatChatEndpointDetail.lifecycle.github.reconnect"),
    remove: t("pagesAppsChatChatEndpointDetail.lifecycle.github.remove"),
  },
  discord: {
    reconnect: t("pagesAppsChatChatEndpointDetail.lifecycle.discord.reconnect"),
    remove: t("pagesAppsChatChatEndpointDetail.lifecycle.discord.remove"),
  },
  "microsoft-teams": {
    reconnect: t("pagesAppsChatChatEndpointDetail.lifecycle.microsoftTeams.reconnect"),
    remove: t("pagesAppsChatChatEndpointDetail.lifecycle.microsoftTeams.remove"),
  },
  "imessage-photon": {
    reconnect: t("pagesAppsChatChatEndpointDetail.lifecycle.imessagePhoton.reconnect"),
    remove: t("pagesAppsChatChatEndpointDetail.lifecycle.imessagePhoton.remove"),
  },
  telegram: {
    reconnect: t("pagesAppsChatChatEndpointDetail.lifecycle.telegram.reconnect"),
    remove: t("pagesAppsChatChatEndpointDetail.lifecycle.telegram.remove"),
  },
};

const activityKindLabels: Record<ChatActivityItem["kind"], string> = {
  delivery: t("pagesAppsChatChatEndpointDetail.activityKinds.delivery"),
  publication: t("pagesAppsChatChatEndpointDetail.activityKinds.publication"),
  action: t("pagesAppsChatChatEndpointDetail.activityKinds.action"),
  health: t("pagesAppsChatChatEndpointDetail.activityKinds.health"),
  repair: t("pagesAppsChatChatEndpointDetail.activityKinds.repair"),
};

const replayableFailureStates = new Set(["failed"]);
// Provider callbacks do not necessarily emit a Board activity event. Refresh
// only mounted operational views, and stop polling when the browser is hidden.
const liveChatQueryOptions = {
  staleTime: 0,
  refetchInterval: 5_000,
  refetchIntervalInBackground: false,
} as const;

export function isReplayEligible(item: ChatActivityItem): boolean {
  if (
    item.fileTransfer ||
    !item.replayable ||
    !replayableFailureStates.has(item.status)
  ) {
    return false;
  }
  if (item.kind === "delivery") return item.status === "failed";
  return item.kind === "publication";
}

export function activityResolutionActions(item: ChatActivityItem) {
  const offered = item.resolutionActions ?? [];
  if (!item.fileTransfer) return offered;
  if (
    item.kind !== "publication" ||
    !Number.isSafeInteger(item.fileTransfer.version) ||
    item.fileTransfer.version < 1
  )
    return [];
  if (
    ![
      "consent_unknown",
      "upload_unknown",
      "file_info_unknown",
      "conflict",
    ].includes(item.fileTransfer.phase)
  )
    return [];
  // Only the file-info stage can use ordinary visible-delivery resolution.
  // Earlier consent/upload evidence must not be fabricated by these buttons.
  return item.fileTransfer.phase === "file_info_unknown"
    ? offered
    : offered.filter((action) => action === "cancel");
}

export function activityResolutionDescription(item: ChatActivityItem): string {
  const phase = item.fileTransfer?.phase;
  if (phase === "file_info_unknown")
    return t("pagesAppsChatChatEndpointDetail.resolution.fileInfoUnknown");
  if (phase === "consent_unknown")
    return t("pagesAppsChatChatEndpointDetail.resolution.consentUnknown");
  if (phase)
    return t("pagesAppsChatChatEndpointDetail.resolution.uploadUnknown");
  return t("pagesAppsChatChatEndpointDetail.resolution.default");
}

export function isResolutionEligible(item: ChatActivityItem): boolean {
  return (
    (item.kind === "publication" || item.kind === "action") &&
    item.status === "delivery_unknown" &&
    activityResolutionActions(item).length > 0
  );
}

export function isIndividuallyToggleableResource(
  provider: ChatProvider,
  resourceType: string,
): boolean {
  return !(
    provider === "microsoft-teams" &&
    (resourceType === "direct_message" || resourceType === "group_chat")
  );
}

function activityDetailLabel(item: ChatActivityItem): string {
  return replayableFailureStates.has(item.status) ? t("pagesAppsChatChatEndpointDetail.health.reason") : t("pagesAppsChatChatEndpointDetail.activity.details");
}

export function connectionHealthPresentation(
  endpoint: Pick<ChatEndpoint, "status" | "healthMessage" | "lastError">,
) {
  // Health events outlive pause/removal. They are history, not lifecycle state.
  const lifecycleMessages = {
    draft: t("pagesAppsChatChatEndpointDetail.lifecycleStatus.draft"),
    verifying: t("pagesAppsChatChatEndpointDetail.lifecycleStatus.verifying"),
    paused: t("pagesAppsChatChatEndpointDetail.lifecycleStatus.paused"),
    attention: t("pagesAppsChatChatEndpointDetail.lifecycleStatus.attention"),
    revoked: t("pagesAppsChatChatEndpointDetail.lifecycleStatus.revoked"),
    archived: t("pagesAppsChatChatEndpointDetail.lifecycleStatus.archived"),
  };
  const lifecycleMessage =
    endpoint.status === "active" ? null : lifecycleMessages[endpoint.status];
  return {
    message: lifecycleMessage ?? endpoint.healthMessage ?? null,
    previousHealth: lifecycleMessage ? (endpoint.healthMessage ?? null) : null,
    error: endpoint.lastError ?? null,
    errorLabel: ["active", "attention", "revoked"].includes(endpoint.status)
      ? t("pagesAppsChatChatEndpointDetail.health.reason")
      : t("pagesAppsChatChatEndpointDetail.health.lastReportedError"),
  };
}

export function ChatEndpointDetail() {
  const { userId, settled: identitySettled } = useAccountIdentity();
  const { endpointId = "", tab: routeTab, reviewId } = useParams<{
    endpointId: string;
    tab?: string;
    reviewId?: string;
  }>();
  const tab = reviewId ? "reviews" : (routeTab ?? "settings");
  const activeTab = tabs.includes(tab as ChatTab) ? (tab as ChatTab) : null;
  const navigate = useNavigate();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const completion = (location.state as GitHubConnectionCompleteLocationState | null)?.githubConnectionComplete;
  const { setBreadcrumbs } = useBreadcrumbs();
  const endpointQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.detail(endpointId),
    queryFn: () => chatEndpointsApi.get(endpointId),
    enabled: Boolean(endpointId && activeTab),
    ...liveChatQueryOptions,
    refetchInterval:
      activeTab === "activity" || activeTab === "conversations"
        ? liveChatQueryOptions.refetchInterval
        : false,
  });
  const endpoint = endpointQuery.data;
  const endpointView = useQueryView(endpointQuery);
  const avatarAgent = useQuery({
    queryKey: queryKeys.agents.detail(endpoint?.assignedAgentId ?? ""),
    queryFn: () => agentsApi.get(endpoint!.assignedAgentId),
    enabled: endpoint?.provider === "github",
  });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const agentQuery = useQuery({
    queryKey: queryKeys.agents.detail(endpoint?.assignedAgentId ?? ""),
    queryFn: () => agentsApi.get(endpoint!.assignedAgentId, endpoint!.companyId),
    enabled: Boolean(endpoint?.assignedAgentId),
  });

  useEffect(() => {
    if (!endpoint || !activeTab) return;
    setBreadcrumbs([
      { label: t("pagesAppsChatChatEndpointDetail.breadcrumbs.connectors"), href: "/apps" },
      {
        label: `${endpoint.assignedAgentName} · ${providerNames[endpoint.provider]}`,
        href: `/apps/chat/${endpoint.id}/settings`,
      },
      ...(reviewId ? [{ label: t("pagesAppsChatChatEndpointDetail.tabs.reviews"), href: `/apps/chat/${endpoint.id}/reviews` }, { label: t("pagesAppsChatChatEndpointDetail.breadcrumbs.review") }] : [{
        label:
          tabItems.find((item) => item.value === activeTab)?.label ??
          t("pagesAppsChatChatEndpointDetail.tabs.settings"),
      }]),
    ]);
    return () => setBreadcrumbs([]);
  }, [activeTab, endpoint, reviewId, setBreadcrumbs]);

  if (!activeTab)
    return <Navigate replace to={`/apps/chat/${endpointId}/settings`} />;
  if (endpointQuery.isLoading || endpointView.kind === "reconnecting")
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("pagesAppsChatChatEndpointDetail.loadingConnection")}
      </div>
    );
  if (endpointView.kind === "error" || !endpoint)
    return (
      <QueryErrorState
        size="page"
        error={endpointQuery.error}
        action={t("pagesAppsChatChatEndpointDetail.loadAction")}
        onRetry={endpointView.retry}
        retrying={endpointView.isFetching}
      />
    );
  if (endpoint.provider === "agentmail" && activeTab === "settings")
    return <div className="space-y-7"><EmailEndpointSettings key={endpoint.id} endpointId={endpoint.id} companyId={endpoint.companyId} assignedAgentName={endpoint.assignedAgentName} /><EndpointExecutionDefaults endpoint={endpoint} /></div>;
  const setupIncomplete =
    endpoint.setup?.step !== "complete" &&
    !(endpoint.provider === "slack" && endpoint.setup?.step === "test") &&
    ["draft", "verifying", "attention", "revoked"].includes(endpoint.status);
  const slackAppId = endpoint.setup?.slackRegistration?.appId;
  const slackUrl = endpoint.provider === "slack"
    ? slackAppId ? `https://api.slack.com/apps/${encodeURIComponent(slackAppId)}/oauth` : "https://api.slack.com/apps"
    : null;

  return (
    <div className="max-w-5xl space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <AgentAvatar agent={agentQuery.data ?? { id: endpoint.assignedAgentId, name: endpoint.assignedAgentName }} size={endpoint.provider === "github" ? 64 : 48} />
          <div className="min-w-0">
          <h1 ref={heading} tabIndex={-1} className={endpoint.provider === "speko" ? "flex items-center gap-3 text-xl font-bold" : "text-xl font-bold"}>
            {endpoint.provider === "speko" && <AppLogo name="Speko" brandKey="speko" size={36} />}
            {endpoint.provider === "github" ? (endpoint.botLabel ?? endpoint.assignedAgentName) : endpoint.assignedAgentName}{endpoint.provider === "speko" ? t("pagesAppsChatChatEndpointDetail.header.inSpeko") : ""}
          </h1>
          <p className={cn("mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground", ANALYTICS_MASK_CLASS)}>
            {endpoint.provider === "github" ? <><AppLogo name="GitHub" brandKey="github" compact className="size-4! rounded-sm bg-transparent" /><Link to={`/agents/${endpoint.assignedAgentId}`} className="hover:underline">{endpoint.assignedAgentName}</Link>{endpoint.providerAccountLabel && <span>· {endpoint.providerAccountLabel}</span>}</> : endpoint.providerAccountLabel ?? (endpoint.provider === "agentmail" ? endpoint.botExternalId ?? t("pagesAppsChatChatEndpointDetail.header.emailConnection") : t("pagesAppsChatChatEndpointDetail.header.chatConnection"))}
          </p>
          {endpoint.provider === "github" && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <GitHubBotMention endpoint={endpoint} />
            <GitHubAppIdentityActions endpoint={endpoint} avatarUrl={avatarAgent.data ? agentAvatarUrl(resolveAgentAppearance(avatarAgent.data.appearance, endpoint.assignedAgentId), 512, 1, "rest") : undefined} />
          </div>}
          {endpoint.provider === "imessage-photon" && endpoint.botExternalId && endpoint.photonAllocation !== "shared" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>{endpoint.botExternalId}</span>
              <Button variant="ghost" size="sm" aria-label={t("pagesAppsChatChatEndpointDetail.header.copyNumberAria")} onClick={async () => {
                try { await copyTextToClipboard(endpoint.botExternalId!); setCopyStatus(t("pagesAppsChatChatEndpointDetail.header.numberCopied")); }
                catch { setCopyStatus(t("pagesAppsChatChatEndpointDetail.header.numberCopyFailed")); }
              }}><Copy className="size-4" />{t("pagesAppsChatChatEndpointDetail.header.copyNumber")}</Button>
              <span role="status" className="text-muted-foreground">{copyStatus}</span>
            </div>
          )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {endpoint.provider === "speko" && <a href="https://platform.speko.ai/agents" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline">{t("pagesAppsChatChatEndpointDetail.header.openSpeko")}<ExternalLink className="size-3.5" aria-hidden="true" /></a>}
          {endpoint.provider === "slack" && !setupIncomplete && <Button asChild variant="outline"><a href={slackConversationUrl(endpoint, identitySettled ? userId : null)} target="_blank" rel="noopener noreferrer">{t("pagesAppsChatChatEndpointDetail.header.openSlack")}{" "}<ExternalLink className="size-4" /></a></Button>}
          {slackUrl && <Button asChild variant="outline"><a href={slackUrl} target="_blank" rel="noopener noreferrer">{t("pagesAppsChatChatEndpointDetail.header.openSlackConfiguration")}{" "}<ExternalLink className="size-4" /></a></Button>}
          {setupIncomplete ? (
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  `/apps/chat/connect?provider=${endpoint.provider}&purpose=chat&resume=${endpoint.id}`,
                )
              }
            >
              {t("pagesAppsChatChatEndpointDetail.header.continueSetup")}
            </Button>
          ) : null}
          {endpoint.status !== "active" && <StatusBadge status={endpoint.status} className={endpoint.provider === "speko" ? "text-foreground" : undefined} />}
        </div>
      </header>
      <div className={cn("space-y-6", ANALYTICS_MASK_CLASS)}>
      {endpoint.provider === "github" && <GitHubConnectionRecoveryNotice endpoint={endpoint} />}
      {activeTab === "settings" && endpoint.provider === "speko" && endpoint.status === "active" && <div className="space-y-6"><SpekoPhoneCallback companyId={endpoint.companyId} endpointId={endpoint.id} /><SpekoPhoneLine companyId={endpoint.companyId} endpointId={endpoint.id} /><SpekoIncomingCalls companyId={endpoint.companyId} endpointId={endpoint.id} agentId={endpoint.assignedAgentId} /></div>}
      {endpoint.provider === "slack" && <SlackTestMessageButton key={endpoint.id} endpointId={endpoint.id} />}
      {endpoint.provider === "github" && <div hidden={activeTab !== "settings" && activeTab !== "access"}>
        <GitHubBotManagement key={endpoint.id} endpoint={endpoint} view={activeTab === "access" ? "access" : "settings"} />
      </div>}
      {activeTab === "settings" && endpoint.provider !== "github" && <Settings endpointId={endpoint.id} endpoint={endpoint} />}
      {activeTab === "settings" && <EndpointExecutionDefaults endpoint={endpoint} />}
      {activeTab === "reviews" && endpoint.provider === "github" && <GitHubReviews endpointId={endpoint.id} reviewId={reviewId} />}
      {activeTab === "access" && endpoint.provider === "speko" && (
        <section className="max-w-3xl space-y-3">
          <h2 className="text-lg font-semibold">{t("pagesAppsChatChatEndpointDetail.voice.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.voice.browserCalls")}</p>
          <p className="text-sm text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.voice.phoneCalls")}</p>
        </section>
      )}
{activeTab === "access" && endpoint.provider === "agentmail" && <EmailAccess endpoint={endpoint} />}
{activeTab === "access" && endpoint.provider !== "speko" && endpoint.provider !== "github" && endpoint.provider !== "agentmail" && (
        <Access
          endpointId={endpoint.id}
          allowUnlinked={endpoint.allowUnlinkedPeople}
          endpoint={endpoint}
        />
      )}
      {activeTab === "conversations" && (
        <Conversations endpointId={endpoint.id} provider={endpoint.provider} />
      )}
      {activeTab === "activity" && (
        <Activity endpointId={endpoint.id} endpoint={endpoint} />
      )}
      {endpoint.provider === "github" && activeTab === "settings" && endpoint.status === "active" &&
        endpoint.setup?.step === "complete" && completion?.endpointId === endpoint.id && (
        <GitHubConnectionComplete
          endpoint={endpoint}
          agent={avatarAgent.data}
          runtimeChecks={completion.runtimeChecks}
          onClose={() => {
            const { githubConnectionComplete: _complete, ...rest } = location.state as GitHubConnectionCompleteLocationState;
            navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: rest });
          }}
          onCloseAutoFocus={() => heading.current?.focus()}
        />
      )}
      </div>
    </div>
  );
}

function EndpointExecutionDefaults({ endpoint }: { endpoint: ChatEndpoint }) {
  const queryClient = useQueryClient();
  return <section className="max-w-3xl py-5"><ChatExecutionDefaults
    key={endpoint.id}
    companyId={endpoint.companyId}
    value={endpoint.executionDefaults}
    onSave={async (executionDefaults) => {
      const next = await chatEndpointsApi.update(endpoint.id, { executionDefaults });
      queryClient.setQueryData(queryKeys.chatEndpoints.detail(endpoint.id), next);
    }}
  /></section>;
}

function EmailAccess({ endpoint }: { endpoint: ChatEndpoint }) {
  const connection = useQuery({
    queryKey: queryKeys.tools.connection(endpoint.connectionId ?? ""),
    queryFn: () => toolsApi.getConnection(endpoint.connectionId!),
    enabled: Boolean(endpoint.connectionId),
  });
  const agents = useQuery({
    queryKey: queryKeys.agents.list(endpoint.companyId),
    queryFn: () => agentsApi.list(endpoint.companyId),
  });
  const agentsView = useQueryView(agents);
  const connectionView = useQueryView(connection);
  if (!endpoint.connectionId) return <p role="alert" className="text-sm text-destructive">{t("pagesAppsChatChatEndpointDetail.emailAccess.loadFailed")}</p>;
  if (agentsView.kind === "error" || connectionView.kind === "error") return (
    <QueryErrorState
      error={agentsView.kind === "error" ? agents.error : connection.error}
      action={t("pagesAppsChatChatEndpointDetail.emailAccess.loadAction")}
      onRetry={() => { agentsView.retry(); connectionView.retry(); }}
      retrying={agents.isFetching || connection.isFetching}
    />
  );
  if (agents.isPending || connection.isPending || agentsView.kind === "reconnecting" || connectionView.kind === "reconnecting") {
    return <p role="status" className="text-sm text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.emailAccess.loading")}</p>;
  }
  const sourceId = connection.data?.config?.credentialConnectionId;
  const credentialId = typeof sourceId === "string" ? sourceId : endpoint.connectionId;
  return <section className="max-w-3xl space-y-4">
    <h2 className="text-lg font-semibold">{t("pagesAppsChatChatEndpointDetail.tabs.access")}</h2>
    {credentialId !== endpoint.connectionId && <p className="text-sm text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.emailAccess.sharedAccount")}</p>}
    <EmailConnectionAccess key={credentialId} companyId={endpoint.companyId} connectionId={credentialId} agents={agents.data ?? []} />
  </section>;
}

function Settings({
  endpointId,
  endpoint,
}: {
  endpointId: string;
  endpoint: Awaited<ReturnType<typeof chatEndpointsApi.get>>;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const resourcesQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.resources(endpointId),
    queryFn: () => chatEndpointsApi.listResources(endpointId),
    enabled: endpoint.provider !== "speko",
    ...(endpoint.provider === "slack" ? liveChatQueryOptions : {}),
  });
  const resourcesView = useQueryView(resourcesQuery);
  const saveResources = useMutation({
    mutationFn: (resource: Pick<ChatEndpointResource, "id" | "enabled">) =>
      chatEndpointsApi.updateResources(endpointId, [resource]),
    onSuccess: (resources) =>
      queryClient.setQueryData(
        queryKeys.chatEndpoints.resources(endpointId),
        resources,
      ),
    onError: (error) =>
      pushToast({
        title: t("pagesAppsChatChatEndpointDetail.settings.updateDestinationFailed"),
        body: describeError(error).body,
        tone: "error",
      }),
  });
  const updateEndpoint = useMutation({
    mutationFn: chatEndpointsApi.update.bind(null, endpointId),
    onSuccess: (next) =>
      queryClient.setQueryData(
        queryKeys.chatEndpoints.detail(endpointId),
        next,
      ),
    onError: (error) =>
      pushToast({
        title: t("pagesAppsChatChatEndpointDetail.settings.updateFailed"),
        body: describeError(error).body,
        tone: "error",
      }),
  });
  if (endpoint.provider === "speko") return null;
  const resources = resourcesQuery.data ?? [];
  const destinationResources = resources.filter((resource) =>
    isIndividuallyToggleableResource(endpoint.provider, resource.type),
  );
  const toggleResource = (resource: ChatEndpointResource, enabled: boolean) =>
    // A cached inventory must not overwrite another operator's unrelated edits.
    saveResources.mutate({ id: resource.id, enabled });
  return (
    <section className="max-w-3xl space-y-7">
      {endpoint.provider === "imessage-photon" && <p className="text-sm text-muted-foreground">{endpoint.photonAllocation === "shared" ? t("pagesAppsChatChatEndpointDetail.settings.photonShared") : t("pagesAppsChatChatEndpointDetail.settings.photonDedicated")}</p>}
      {endpoint.provider === "telegram" && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("pagesAppsChatChatEndpointDetail.settings.telegramCommand")}</h2>
          <div className="rounded-lg border border-border p-3 text-sm">
            <code>
              /task@
              {endpoint.botUsername?.replace(/^@/, "") ?? "bot_username"}{" "}
              &lt;request&gt;
            </code>
            <p className="mt-2 text-muted-foreground">
              {t("pagesAppsChatChatEndpointDetail.settings.telegramPrivacy")}
            </p>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{endpoint.provider === "slack" ? t("pagesAppsChatChatEndpointDetail.settings.allowedChannels") : t("pagesAppsChatChatEndpointDetail.settings.destinations")}</h3>
        {resourcesView.kind === "error" ? <QueryErrorState size="inline" error={resourcesQuery.error} action={endpoint.provider === "slack" ? t("pagesAppsChatChatEndpointDetail.settings.loadChannelsAction") : t("pagesAppsChatChatEndpointDetail.settings.loadDestinationsAction")} onRetry={resourcesView.retry} retrying={resourcesView.isFetching} /> : resourcesQuery.isLoading || resourcesView.kind === "reconnecting" ? (
          <p className="text-sm text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.settings.loadingDestinations")}</p>
        ) : destinationResources.length === 0 && endpoint.provider !== "slack" ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("pagesAppsChatChatEndpointDetail.settings.noDestinations")}
          </p>
        ) : (
          <div className={endpoint.provider === "slack" ? "space-y-1" : "divide-y divide-border border-y border-border"}>
            {destinationResources.map((resource) => (
              <div key={resource.id} className="py-3 space-y-3">
              <div className="flex items-center gap-3">
                <div className={cn("min-w-0 flex-1", ANALYTICS_MASK_CLASS)}>
                  <p className="truncate text-sm font-medium">
                    {resource.label}
                  </p>
                  {(resource.availability !== "available" || resource.detail) && <p className="text-xs text-muted-foreground">
                    {resource.availability === "available"
                      ? resource.detail
                      : t("pagesAppsChatChatEndpointDetail.settings.unavailableAtProvider")}
                  </p>}
                  {resource.participants?.length ? <p className="mt-1 break-words text-xs text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.settings.participants", { list: resource.participants.join(", ") })}</p> : null}
                </div>
                <ToggleSwitch
                  aria-label={t("pagesAppsChatChatEndpointDetail.settings.enableResource", { label: resource.label })}
                  checked={resource.enabled}
                  disabled={
                    endpoint.photonAllocation === "shared" ||
                    resource.availability !== "available" ||
                    saveResources.isPending
                  }
                  onCheckedChange={(enabled) =>
                    toggleResource(resource, enabled)
                  }
                />
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.settings.taskDefaults")}</summary>
                <div className="pt-3"><ChatExecutionDefaults
                  companyId={endpoint.companyId}
                  value={resource.executionDefaults}
                  resource
                  onSave={async (executionDefaults) => {
                    const next = await chatEndpointsApi.updateResources(endpointId, [{ id: resource.id, executionDefaults }]);
                    queryClient.setQueryData(queryKeys.chatEndpoints.resources(endpointId), next);
                  }}
                /></div>
              </details>
              </div>
            ))}
            {endpoint.provider === "slack" && (
              <p className="py-3 text-sm text-muted-foreground">
                {t("pagesAppsChatChatEndpointDetail.settings.inviteToChannel", { name: endpoint.assignedAgentName })}
              </p>
            )}
          </div>
        )}
      </div>
      {endpoint.provider !== "github" && (
        <div className="space-y-3">
          <SettingToggle
            label={t("pagesAppsChatChatEndpointDetail.settings.allowDirectMessages")}
            detail={
              endpoint.provider === "discord"
                ? t("pagesAppsChatChatEndpointDetail.settings.discordDirectMessages")
                : undefined
            }
            checked={endpoint.allowDirectMessages ?? false}
            pending={updateEndpoint.isPending}
            onChange={(allowDirectMessages) =>
              updateEndpoint.mutate({ allowDirectMessages })
            }
          />
          {endpoint.provider === "slack" && (
            <SettingToggle
              label={t("pagesAppsChatChatEndpointDetail.settings.requireAtMention")}
              detail={t("pagesAppsChatChatEndpointDetail.settings.requireAtMentionDetail")}
              checked={endpoint.requireAtMention ?? false}
              pending={updateEndpoint.isPending}
              onChange={(requireAtMention) =>
                updateEndpoint.mutate({ requireAtMention })
              }
            />
          )}
          {endpoint.provider === "microsoft-teams" && (
            <SettingToggle
              label={t("pagesAppsChatChatEndpointDetail.settings.allowGroupChats")}
              detail={t("pagesAppsChatChatEndpointDetail.settings.allowGroupChatsDetail")}
              checked={endpoint.allowGroupChats ?? false}
              pending={updateEndpoint.isPending}
              onChange={(allowGroupChats) =>
                updateEndpoint.mutate({ allowGroupChats })
              }
            />
          )}
        </div>
      )}
      {endpoint.provider === "slack" && <ChatCommunicationInstructions
        key={endpoint.id}
        value={endpoint.communicationInstructions ?? ""}
        onSave={async (communicationInstructions) => {
          const next = await chatEndpointsApi.update(endpointId, { communicationInstructions });
          queryClient.setQueryData(queryKeys.chatEndpoints.detail(endpointId), next);
        }}
      />}
      {endpoint.provider === "slack" && <SlackSetupAdvanced label={t("pagesAppsChatChatEndpointDetail.settings.slackTools")}><SlackToolsSettings companyId={endpoint.companyId} endpointId={endpointId} /></SlackSetupAdvanced>}
    </section>
  );
}

function SettingToggle({
  label,
  detail,
  checked,
  pending,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  pending: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <ToggleSwitch
        aria-label={label}
        checked={checked}
        disabled={pending}
        onCheckedChange={onChange}
      />
    </div>
  );
}

function Access({
  endpointId,
  allowUnlinked,
  endpoint,
}: {
  endpointId: string;
  allowUnlinked: boolean;
  endpoint: ChatEndpoint;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [confirmationUrl, setConfirmationUrl] = useState<string | null>(null);
  const [joinCommandCopied, setJoinCommandCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [confirmationFor, setConfirmationFor] = useState<string | null>(null);
  const joinCommand = `${endpoint.setup?.slackApp?.command ?? endpoint.setup?.command ?? "/paperclip"} connect`;
  const linksQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.principals(endpointId),
    queryFn: () => chatEndpointsApi.listPrincipals(endpointId),
    refetchInterval: 5000,
  });
  const linksView = useQueryView(linksQuery);
  const updatePolicy = useMutation({
    mutationFn: (value: boolean) =>
      chatEndpointsApi.update(endpointId, { allowUnlinkedPeople: value }),
    onSuccess: (next) =>
      queryClient.setQueryData(
        queryKeys.chatEndpoints.detail(endpointId),
        next,
      ),
    onError: (error) => pushToast({ title: t("pagesAppsChatChatEndpointDetail.access.updateFailed"), body: describeError(error).body, tone: "error" }),
  });
  const createIntent = useMutation({
    mutationFn: (principalId: string) =>
      chatEndpointsApi.createLinkIntent(endpointId, principalId),
    onSuccess: ({ confirmationUrl }) => {
      setConfirmationUrl(
        new URL(confirmationUrl, window.location.origin).toString(),
      );

    },
    onError: (error) =>
      pushToast({
        title: t("pagesAppsChatChatEndpointDetail.access.createLinkFailed"),
        body: describeError(error).body,
        tone: "error",
      }),
  });
  const revoke = useMutation({
    mutationFn: (principalId: string) =>
      chatEndpointsApi.revokeLink(endpointId, principalId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.chatEndpoints.principals(endpointId) }),
    onError: (error) => pushToast({ title: t("pagesAppsChatChatEndpointDetail.access.disconnectFailed"), body: describeError(error).body, tone: "error" }),
  });
  const links = linksQuery.data ?? [];
  return (
    <section className="max-w-3xl space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("pagesAppsChatChatEndpointDetail.access.people")}</h2>
        {endpoint.provider === "slack" && <Dialog>
          <DialogTrigger asChild><Button>{t("pagesAppsChatChatEndpointDetail.access.invitePeople")}</Button></DialogTrigger>
          <DialogContent className={ANALYTICS_MASK_CLASS}>
            <DialogHeader>
              <DialogTitle>{t("pagesAppsChatChatEndpointDetail.access.inviteTitle", { name: endpoint.assignedAgentName })}</DialogTitle>
              <DialogDescription>{t("pagesAppsChatChatEndpointDetail.access.inviteDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <ol className="list-decimal space-y-3 pl-5">
                <li>{t("pagesAppsChatChatEndpointDetail.access.steps.send")}{" "}<code className="font-mono">{joinCommand}</code>{" "}{t("pagesAppsChatChatEndpointDetail.access.steps.inSlack")}</li>
                <li>{t("pagesAppsChatChatEndpointDetail.access.steps.openLink")}</li>
                <li>{t("pagesAppsChatChatEndpointDetail.access.steps.requestAccess")}</li>
              </ol>
              <p className="text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.access.linkExpires")}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => {
                  void copyTextToClipboard(joinCommand).then(() => setJoinCommandCopied(true), () => pushToast({ title: t("pagesAppsChatChatEndpointDetail.access.copyCommandFailed"), tone: "error" }));
                }}>{joinCommandCopied ? <Check className="size-4" /> : <Copy className="size-4" />}{joinCommandCopied ? t("pagesAppsChatChatEndpointDetail.access.copied") : t("pagesAppsChatChatEndpointDetail.access.copyCommand")}</Button>
                <Button onClick={() => {
                  const workspace = endpoint.providerAccountId ? `https://app.slack.com/client/${encodeURIComponent(endpoint.providerAccountId)}` : "https://app.slack.com/";
                  void copyTextToClipboard(t("pagesAppsChatChatEndpointDetail.access.invitationText", { name: endpoint.assignedAgentName, workspace, command: joinCommand })).then(() => setInviteCopied(true), () => pushToast({ title: t("pagesAppsChatChatEndpointDetail.access.copyInvitationFailed"), tone: "error" }));
                }}>{inviteCopied ? <Check className="size-4" /> : <Copy className="size-4" />}{inviteCopied ? t("pagesAppsChatChatEndpointDetail.access.invitationCopied") : t("pagesAppsChatChatEndpointDetail.access.copyInvitation")}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>}
      </div>
      <p className="text-sm text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.access.linkedPermissions")}{" "}<Link className="underline underline-offset-4" to="/company/settings/members">{t("pagesAppsChatChatEndpointDetail.access.manageMembers")}</Link></p>
      {confirmationUrl && (
        <div className="space-y-2 border-y border-border py-3">
          <p className={cn("text-sm font-medium", ANALYTICS_MASK_CLASS)}>{t("pagesAppsChatChatEndpointDetail.access.confirmAccount", { name: confirmationFor ?? t("pagesAppsChatChatEndpointDetail.access.thisAccount") })}</p>
          <p className="text-xs text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.access.shareOnly")}</p>
          <p className={cn("break-all text-xs text-muted-foreground", ANALYTICS_NO_CAPTURE_CLASS)}>
            {confirmationUrl}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void copyTextToClipboard(confirmationUrl).then(
                () =>
                  pushToast({
                    title: t("pagesAppsChatChatEndpointDetail.access.linkCopied"),
                    tone: "success",
                  }),
                () =>
                  pushToast({
                    title: t("pagesAppsChatChatEndpointDetail.access.copyLinkFailed"),
                    body: t("pagesAppsChatChatEndpointDetail.access.copyManually"),
                    tone: "error",
                  }),
              );
            }}
          >
            <Copy />
            {t("pagesAppsChatChatEndpointDetail.access.copyLink")}
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {linksQuery.isPending || linksView.kind === "reconnecting" ? <p role="status" className="text-sm text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.access.loadingPeople")}</p> : linksView.kind === "error" ? <QueryErrorState size="inline" error={linksQuery.error} action={t("pagesAppsChatChatEndpointDetail.access.loadPeopleAction")} onRetry={linksView.retry} retrying={linksView.isFetching} /> : links.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("pagesAppsChatChatEndpointDetail.access.noLinkedAccounts")}
          </p>
        ) : (
          <div role="list" aria-label={t("pagesAppsChatChatEndpointDetail.access.people")} className="divide-y divide-border border-y border-border">
            {links.map((link) => (
              <div
                key={link.id}
                role="listitem"
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Avatar aria-hidden="true">
                    {link.paperclipUserImage && <AvatarImage src={link.paperclipUserImage} alt="" />}
                    <AvatarFallback>{deriveInitials(link.paperclipUserLabel ?? link.externalLabel)}</AvatarFallback>
                  </Avatar>
                  <div className={cn("min-w-0", ANALYTICS_MASK_CLASS)}>
                    <p className="truncate text-sm" title={link.paperclipUserLabel ?? link.externalLabel}>{link.paperclipUserLabel ?? link.externalLabel}</p>
                    {(link.status !== "linked" || link.externalLabel !== link.paperclipUserLabel) && <p className="text-xs text-muted-foreground">
                      {link.status === "revoked" ? t("pagesAppsChatChatEndpointDetail.access.disconnected") : link.status === "linked"
                        ? link.externalLabel
                        : t("pagesAppsChatChatEndpointDetail.access.waitingConfirmation")}
                    </p>}
                  </div>
                </div>
                {link.status === "linked" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(link.principalId)}
                  >
                    <Unlink />
                    {t("pagesAppsChatChatEndpointDetail.access.disconnect")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={createIntent.isPending}
                    onClick={() => { setConfirmationUrl(null); setConfirmationFor(link.externalLabel); createIntent.mutate(link.principalId); }}
                  >
                    {t("pagesAppsChatChatEndpointDetail.access.createConfirmationLink")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <SlackSetupAdvanced label={t("pagesAppsChatChatEndpointDetail.access.guestAccess")}>
        <SettingToggle label={t("pagesAppsChatChatEndpointDetail.access.allowUnlinked")}
          detail={t("pagesAppsChatChatEndpointDetail.access.allowUnlinkedDetail")}
          checked={allowUnlinked} pending={updatePolicy.isPending} onChange={value => updatePolicy.mutate(value)} />
      </SlackSetupAdvanced>
      {endpoint.provider === "slack" && <SlackSetupAdvanced label={t("pagesAppsChatChatEndpointDetail.access.personalSlackSearch")}><SlackSearchAccess companyId={endpoint.companyId} endpointId={endpointId} /></SlackSetupAdvanced>}
    </section>
  );
}

function Conversations({
  endpointId,
  provider,
}: {
  endpointId: string;
  provider: ChatProvider;
}) {
  const query = useQuery({
    queryKey: queryKeys.chatEndpoints.conversations(endpointId),
    queryFn: () => chatEndpointsApi.listConversations(endpointId),
    ...liveChatQueryOptions,
  });
  const view = useQueryView(query);
  return (
    <section className="space-y-4">
      {query.isPending || view.kind === "reconnecting" ? <p role="status" className="text-sm text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.conversations.loading")}</p> : view.kind === "error" ? (
        <QueryErrorState error={query.error} action={t("pagesAppsChatChatEndpointDetail.conversations.loadAction")} onRetry={view.retry} retrying={view.isFetching} />
      ) : <ChatConversationList rows={query.data ?? []} provider={provider} />}
    </section>
  );
}

function Activity({
  endpointId,
  endpoint,
}: {
  endpointId: string;
  endpoint: Awaited<ReturnType<typeof chatEndpointsApi.get>>;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [resolutionItem, setResolutionItem] = useState<ChatActivityItem | null>(
    null,
  );
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors[cursors.length - 1];
  useEffect(() => setCursors([undefined]), [endpointId]);
  const query = useQuery({
    queryKey: [...queryKeys.chatEndpoints.activity(endpointId), cursor ?? null],
    queryFn: () => chatEndpointsApi.listActivityPage(endpointId, cursor),
    ...liveChatQueryOptions,
    refetchInterval: cursor ? false : liveChatQueryOptions.refetchInterval,
  });
  const view = useQueryView(query);
  const activityLoaded = view.kind === "ready" || view.kind === "stale";
  const calls = useSpekoCallHistory(endpoint.companyId, endpointId, endpoint.provider === "speko" && !cursor);
  const replay = useMutation({
    mutationFn: (item: ChatActivityItem) =>
      item.kind === "publication"
        ? chatEndpointsApi.replayPublication(endpointId, item.id)
        : chatEndpointsApi.replayDelivery(endpointId, item.id),
    onSuccess: async (_result, item) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.activity(endpointId),
      });
      pushToast({
        title: item.kind === "publication" ? t("pagesAppsChatChatEndpointDetail.activity.publicationQueued") : t("pagesAppsChatChatEndpointDetail.activity.deliveryQueued"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("pagesAppsChatChatEndpointDetail.activity.replayFailed"),
        body: describeError(error).body,
        tone: "error",
      }),
  });
  const resolveActivity = useMutation({
    mutationFn: (input: {
      item: ChatActivityItem;
      action: "mark_delivered" | "retry_anyway" | "cancel";
    }) => {
      if (input.item.kind === "publication") {
        return chatEndpointsApi.resolvePublication(
          endpointId,
          input.item.id,
          input.action,
          input.item.fileTransfer
            ? {
                phase: input.item.fileTransfer.phase,
                version: input.item.fileTransfer.version,
              }
            : undefined,
        );
      }
      return chatEndpointsApi.resolveAction(
        endpointId,
        input.item.id,
        input.action,
      );
    },
    onSuccess: async (_result, input) => {
      setResolutionItem(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.activity(endpointId),
      });
      pushToast({
        title:
          input.item.actionType === "slash_task_start" &&
          input.action === "retry_anyway"
            ? t("pagesAppsChatChatEndpointDetail.activity.resolved.taskStartRetried")
            : input.item.actionType === "slash_task_start"
              ? t("pagesAppsChatChatEndpointDetail.activity.resolved.taskStartCancelled")
              : input.item.actionType === "provider_effect" &&
                  input.action === "mark_delivered"
                ? t("pagesAppsChatChatEndpointDetail.activity.resolved.providerReplyDelivered")
                : input.item.actionType === "provider_effect" &&
                    input.action === "retry_anyway"
                  ? t("pagesAppsChatChatEndpointDetail.activity.resolved.providerReplyRetried")
                  : input.item.actionType === "provider_effect"
                    ? t("pagesAppsChatChatEndpointDetail.activity.resolved.providerReplyCancelled")
                    : input.action === "mark_delivered"
                      ? t("pagesAppsChatChatEndpointDetail.activity.resolved.publicationDelivered")
                      : input.action === "retry_anyway"
                        ? t("pagesAppsChatChatEndpointDetail.activity.resolved.publicationRetried")
                        : t("pagesAppsChatChatEndpointDetail.activity.resolved.publicationCancelled"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("pagesAppsChatChatEndpointDetail.activity.resolveFailed"),
        body: describeError(error).body,
        tone: "error",
      }),
  });
  const lifecycle = useMutation({
    mutationFn: async (action: "pause" | "resume" | "remove") =>
      endpoint.provider === "agentmail"
        ? emailApi.control(endpointId, action)
        : chatEndpointsApi.setup(endpointId, { action }),
    onSuccess: async (next, action) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.list(next.companyId),
      });
      if (endpoint.provider === "agentmail") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["email-inboxes", next.companyId] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.chatEndpoints.detail(endpointId) }),
        ]);
      }
      if (action === "remove") {
        navigate("/apps");
        return;
      }
      if (endpoint.provider !== "agentmail") queryClient.setQueryData(queryKeys.chatEndpoints.detail(endpointId), next);
      pushToast({
        title: action === "pause" ? t("pagesAppsChatChatEndpointDetail.lifecycleToasts.paused") : t("pagesAppsChatChatEndpointDetail.lifecycleToasts.resumed"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("pagesAppsChatChatEndpointDetail.lifecycleToasts.updateFailed"),
        body: describeError(error).body,
        tone: "error",
      }),
  });
  const rows = query.data?.items ?? [];
  // Calls use their own caller-authorized API and appear once in recent activity.
  // Older connection-event pages retain the existing cursor contract.
  const activityEntries = [
    ...(view.kind !== "error" ? rows.map(item => ({ kind: "connection" as const, id: `connection:${item.id}`, createdAt: item.createdAt, item })) : []),
    ...(!cursor && !calls.error ? calls.entries.map(entry => ({ kind: "call" as const, id: `call:${entry.session.id}`, createdAt: entry.session.createdAt, entry })) : []),
    ...(!cursor && !calls.incomingError ? calls.unapprovedCalls.map(call => ({ kind: "unapproved_call" as const, id: `unapproved:${call.id}`, createdAt: call.createdAt, call })) : []),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));

  const { status } = endpoint;
  const health = connectionHealthPresentation(endpoint);
  const lifecycleAction = lifecycle.variables;
  const callbackSurfaceRows = endpoint.setup?.callbackSurfaces
    ? ([
        [t("pagesAppsChatChatEndpointDetail.callbacks.events"), endpoint.setup.callbackSurfaces.events],
        [t("pagesAppsChatChatEndpointDetail.callbacks.interactivity"), endpoint.setup.callbackSurfaces.interactivity],
        [t("pagesAppsChatChatEndpointDetail.callbacks.slashCommand"), endpoint.setup.callbackSurfaces.slashCommands],
      ] as const)
    : [];
  return (
    <section className="space-y-5" aria-label={t("pagesAppsChatChatEndpointDetail.activity.title")}>
      <h2 className="text-lg font-semibold">{t("pagesAppsChatChatEndpointDetail.activity.title")}</h2>
      {((status !== "active" && health.message) || health.error) && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${status === "attention" || status === "revoked" ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-muted/30 text-foreground"}`}
        >
          {(status === "attention" || status === "revoked") && (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            {health.message && <p>{health.message}</p>}
            {health.previousHealth && (
              <p className="mt-1 text-xs opacity-80">
                <span className="font-medium">{t("pagesAppsChatChatEndpointDetail.health.lastReportedHealth")}</span>{" "}
                {health.previousHealth}
              </p>
            )}
            {health.error && (
              <p className="mt-1 text-xs opacity-80">
                <span className="font-medium">{health.errorLabel}:</span>{" "}
                {health.error}
              </p>
            )}
          </div>
        </div>
      )}
      <details className="group rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium chat-connection-health-summary">
          <span>{t("pagesAppsChatChatEndpointDetail.health.controls")}</span>
          <span className="flex items-center gap-2">
            {endpoint.setup?.callbacksNeedUpdate && <span className="text-xs text-(--status-task-blocked)">{t("pagesAppsChatChatEndpointDetail.callbacks.needAttention")}</span>}
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="space-y-5 border-t border-border p-4">
      {endpoint.provider === "slack" && callbackSurfaceRows.length > 0 && (
        <div
          className="space-y-3 text-sm"
        >
          <p className="font-medium">{t("pagesAppsChatChatEndpointDetail.callbacks.title")}</p>
          <p className="text-xs text-muted-foreground">
            {endpoint.setup?.callbacksNeedUpdate
              ? t("pagesAppsChatChatEndpointDetail.callbacks.needUpdate")
              : t("pagesAppsChatChatEndpointDetail.callbacks.recordsIndependently")}
          </p>
          <div className="divide-y divide-border border-y border-border">
            {callbackSurfaceRows.map(([label, surface]) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <p className="text-xs font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {surface.status === "current"
                    ? t("pagesAppsChatChatEndpointDetail.callbacks.current")
                    : surface.status === "stale"
                      ? t("pagesAppsChatChatEndpointDetail.callbacks.stale")
                      : t("pagesAppsChatChatEndpointDetail.callbacks.notObserved")}
                </p>
                {surface.observedAt && (
                  <p className="text-xs text-muted-foreground">
                    {t("pagesAppsChatChatEndpointDetail.callbacks.lastObserved")}{" "}
                    <time
                      dateTime={surface.observedAt}
                      title={surface.observedAt}
                      className="font-mono"
                    >
                      {formatDateTime(surface.observedAt, {
                        includeSeconds: true,
                      })}
                    </time>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {status !== "archived" && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            {status === "active" && (
              <Button
                variant="outline"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate("pause")}
              >
                {lifecycle.isPending && lifecycleAction === "pause" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Pause />
                )}
                {t("pagesAppsChatChatEndpointDetail.controls.pause")}
              </Button>
            )}
            {status === "paused" && (
              <Button
                variant="outline"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate("resume")}
              >
                {lifecycle.isPending && lifecycleAction === "resume" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Play />
                )}
                {t("pagesAppsChatChatEndpointDetail.controls.resume")}
              </Button>
            )}
            {[
              "active",
              "paused",
              "attention",
              "revoked",
              "draft",
              "verifying",
            ].includes(status) && (
              <Button
                variant="outline"
                disabled={lifecycle.isPending}
                onClick={() =>
                  navigate(
                    endpoint.provider === "agentmail" && status !== "draft" && status !== "verifying"
                      ? `/apps/chat/${endpoint.id}/settings`
                      : `/apps/chat/connect?provider=${endpoint.provider}&purpose=chat&resume=${endpoint.id}${status === "draft" || status === "verifying" ? "" : "&reconnect=1"}`,
                  )
                }
              >
                <RefreshCw />
                {status === "draft" || status === "verifying"
                  ? t("pagesAppsChatChatEndpointDetail.controls.finishSetup")
                  : t("pagesAppsChatChatEndpointDetail.controls.reconnect")}
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={lifecycle.isPending}
              onClick={() => setRemoveOpen(true)}
            >
              <Trash2 />
              {t("pagesAppsChatChatEndpointDetail.controls.remove")}
            </Button>
          </div>
          {status !== "draft" && status !== "verifying" && (
            <p className="text-xs text-muted-foreground">
              {providerLifecycleGuidance[endpoint.provider].reconnect}
            </p>
          )}
        </div>
      )}
        </div>
      </details>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{t("pagesAppsChatChatEndpointDetail.activity.recent")}</h3>
          {endpoint.provider === "speko" && !cursor && <Button size="sm" variant="ghost" onClick={() => { void query.refetch(); calls.onRetry(); }} disabled={query.isFetching || calls.loading}>{t("pagesAppsChatChatEndpointDetail.activity.refresh")}</Button>}
        </div>
        {endpoint.provider === "agentmail" && rows.some((item) => item.kind === "publication" && item.status === "delivery_unknown") && (
          <p className="text-sm text-muted-foreground">
            {t("pagesAppsChatChatEndpointDetail.activity.reviewEmailPrefix")}{" "}
            <Link to={`/apps/chat/${endpointId}/conversations`} className="underline underline-offset-4">{t("pagesAppsChatChatEndpointDetail.activity.reviewEmailLink")}</Link>{t("pagesAppsChatChatEndpointDetail.activity.reviewEmailSuffix")}
          </p>
        )}
        <div className="divide-y divide-border border-y border-border">
          {(query.isLoading || view.kind === "reconnecting" || calls.loading) && (
            <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("pagesAppsChatChatEndpointDetail.activity.loading")}
            </div>
          )}
          {view.kind === "error" && (
            <div className="py-4">
              <QueryErrorState
                error={query.error}
                action={t("pagesAppsChatChatEndpointDetail.activity.loadAction")}
                onRetry={view.retry}
                retrying={view.isFetching}
              />
            </div>
          )}
          {endpoint.provider === "speko" && !cursor && [
            calls.error && t("pagesAppsChatChatEndpointDetail.calls.loadFailed", { error: calls.error }),
            calls.incomingError && t("pagesAppsChatChatEndpointDetail.calls.unapprovedLoadFailed", { error: calls.incomingError }),
            calls.endError && t("pagesAppsChatChatEndpointDetail.calls.endFailed", { error: calls.endError }),
          ].filter(Boolean).map((message) => <div key={String(message)} className="flex flex-wrap items-center justify-between gap-3 py-4"><p role="alert" className="text-sm text-destructive">{message}</p><Button size="sm" variant="outline" onClick={calls.onRetry}>{t("pagesAppsChatChatEndpointDetail.calls.retry")}</Button></div>)}
          {activityEntries.map(entry => {
            if (entry.kind === "call") return <SpekoCallActivityItem key={entry.id} entry={entry.entry} presentation="activity" onEnd={calls.onEnd} ending={calls.endingSessionId === entry.entry.session.id} />;
            if (entry.kind === "unapproved_call") return <SpekoUnapprovedCallActivityItem key={entry.id} call={entry.call} presentation="activity" />;
            const item = entry.item;
            return (
              <div
                key={entry.id}
                data-activity-kind="connection"
                className="flex items-start gap-3 px-2 py-3 transition-colors hover:bg-accent/50"
              >
                <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
                  {item.kind === "delivery" ? <ArrowDownLeft className="size-4" /> : item.kind === "publication" ? <ArrowUpRight className="size-4" /> : <ActivityIcon className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="min-w-0 flex-1 text-sm font-medium">{item.summary}</p>
                    <StatusBadge status={item.status} />
                    <time dateTime={item.createdAt} title={item.createdAt} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(item.createdAt, { includeSeconds: true })}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{activityKindLabels[item.kind]}</p>
                  {item.fileTransfer && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.fileTransfer.filename} —{" "}
                      {item.fileTransfer.phase.replaceAll("_", " ")}
                    </p>
                  )}
                  {item.detail && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {activityDetailLabel(item)}:
                      </span>{" "}
                      {item.detail}
                    </p>
                  )}
                </div>
                {endpoint.provider !== "agentmail" && isReplayEligible(item) && (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={t(`pagesAppsChatChatEndpointDetail.activity.replayFailedAria.${item.kind}`, { defaultValue: `Replay failed ${item.kind}` })}
                    disabled={replay.isPending}
                    onClick={() => replay.mutate(item)}
                  >
                    {replay.isPending && replay.variables?.id === item.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <RefreshCw />
                    )}
                    {t("pagesAppsChatChatEndpointDetail.activity.replay")}
                  </Button>
                )}
                {endpoint.provider !== "agentmail" && isResolutionEligible(item) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResolutionItem(item)}
                  >
                    {t("pagesAppsChatChatEndpointDetail.activity.resolve")}
                  </Button>
                )}
              </div>
            );
          })}
          {activityLoaded && !calls.loading && !calls.error && !calls.incomingError && activityEntries.length === 0 && (
            <p className="py-5 text-sm text-muted-foreground">
              {t("pagesAppsChatChatEndpointDetail.activity.empty")}
            </p>
          )}
        </div>
      </div>
      <nav aria-label={t("pagesAppsChatChatEndpointDetail.pagination.aria")} className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{t("pagesAppsChatChatEndpointDetail.pagination.page", { page: cursors.length })}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={cursors.length === 1 || query.isFetching} onClick={() => setCursors((pages) => pages.slice(0, -1))}>{t("pagesAppsChatChatEndpointDetail.pagination.previous")}</Button>
          <Button size="sm" variant="outline" disabled={!query.data?.nextCursor || query.isFetching || view.kind === "error"} onClick={() => { if (query.data?.nextCursor) setCursors((pages) => [...pages, query.data.nextCursor!]); }}>{t("pagesAppsChatChatEndpointDetail.pagination.next")}</Button>
        </div>
      </nav>
      <AlertDialog
        open={resolutionItem !== null}
        onOpenChange={(open) => !open && setResolutionItem(null)}
      >
        <AlertDialogContent className={ANALYTICS_MASK_CLASS}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resolutionItem?.actionType === "slash_task_start"
                ? t("pagesAppsChatChatEndpointDetail.resolveDialog.titleTaskStart")
                : resolutionItem?.actionType === "provider_effect"
                  ? t("pagesAppsChatChatEndpointDetail.resolveDialog.titleProviderReply")
                  : t("pagesAppsChatChatEndpointDetail.resolveDialog.titleDelivery")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resolutionItem?.actionType === "slash_task_start"
                ? t("pagesAppsChatChatEndpointDetail.resolveDialog.taskStartDescription")
                : resolutionItem?.actionType === "provider_effect"
                  ? t("pagesAppsChatChatEndpointDetail.resolveDialog.providerReplyDescription")
                  : resolutionItem
                    ? activityResolutionDescription(resolutionItem)
                    : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-wrap">
            <AlertDialogCancel disabled={resolveActivity.isPending}>
              {t("pagesAppsChatChatEndpointDetail.resolveDialog.keepUnresolved")}
            </AlertDialogCancel>
            {resolutionItem &&
              activityResolutionActions(resolutionItem).includes("cancel") && (
                <Button
                  variant="outline"
                  disabled={resolveActivity.isPending}
                  onClick={() =>
                    resolutionItem &&
                    resolveActivity.mutate({
                      item: resolutionItem,
                      action: "cancel",
                    })
                  }
                >
                  {resolutionItem.actionType === "slash_task_start"
                    ? t("pagesAppsChatChatEndpointDetail.resolveDialog.cancelTaskStart")
                    : resolutionItem.actionType === "provider_effect"
                      ? t("pagesAppsChatChatEndpointDetail.resolveDialog.cancelProviderReply")
                      : resolutionItem.fileTransfer
                        ? t("pagesAppsChatChatEndpointDetail.resolveDialog.cancelFileTransfer")
                        : t("pagesAppsChatChatEndpointDetail.resolveDialog.cancelPublication")}
                </Button>
              )}
            {resolutionItem &&
              activityResolutionActions(resolutionItem).includes(
                "retry_anyway",
              ) && (
                <Button
                  variant="outline"
                  disabled={resolveActivity.isPending}
                  onClick={() =>
                    resolutionItem &&
                    resolveActivity.mutate({
                      item: resolutionItem,
                      action: "retry_anyway",
                    })
                  }
                >
                  {resolutionItem.fileTransfer
                    ? t("pagesAppsChatChatEndpointDetail.resolveDialog.retryFileNotification")
                    : t("pagesAppsChatChatEndpointDetail.resolveDialog.retryAnyway")}
                </Button>
              )}
            {resolutionItem &&
              activityResolutionActions(resolutionItem).includes(
                "mark_delivered",
              ) && (
                <AlertDialogAction
                  disabled={resolveActivity.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    if (resolutionItem) {
                      resolveActivity.mutate({
                        item: resolutionItem,
                        action: "mark_delivered",
                      });
                    }
                  }}
                >
                  {t("pagesAppsChatChatEndpointDetail.resolveDialog.markDelivered")}
                </AlertDialogAction>
              )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent className={ANALYTICS_MASK_CLASS}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pagesAppsChatChatEndpointDetail.removeDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pagesAppsChatChatEndpointDetail.removeDialog.description", { name: endpoint.assignedAgentName, provider: providerNames[endpoint.provider] })}{" "}
              {providerLifecycleGuidance[endpoint.provider].remove}
              {endpoint.provider === "slack" && (
                <> <a
                  href={endpoint.setup?.slackRegistration?.managementUrl ?? "https://api.slack.com/apps"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >{t("pagesAppsChatChatEndpointDetail.removeDialog.openSlackSettings")}</a>{" "}{t("pagesAppsChatChatEndpointDetail.removeDialog.slackSuffix")}</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("pagesAppsChatChatEndpointDetail.removeDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={lifecycle.isPending}
              onClick={() => lifecycle.mutate("remove")}
            >
              {lifecycle.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t("pagesAppsChatChatEndpointDetail.controls.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
