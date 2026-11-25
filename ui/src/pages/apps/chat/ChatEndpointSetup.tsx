import { t } from "@/i18n";
import { SpekoProviderSetup } from "@/components/voice/SpekoProviderSetup";
import { NativeVoiceConversation } from "@/components/voice/NativeVoiceConversation";
import { buildSlackAppManifest, defaultSlackAppConfiguration } from "@paperclipai/shared";
import { SlackAppDetails, SlackSetupAdvanced } from "./SlackAppDetails";
import { SlackSetup } from "./slack/SlackSetup";
import { isProvisionedSlackSetup, slackSetupState } from "./slack/setup-state";
import { slackConversationUrl } from "./slack/conversation-url";
import { useAccountIdentity } from "@/api/companies-query";
import { defaultSlackAppName } from "./slack-app-name";
import { GitHubChatSetup } from "./GitHubChatSetup";
import { GitHubAgentTrustWarning } from "@/components/GitHubAgentTrustWarning";
import { SetupWizardFooter } from "@/components/SetupWizard";
import { ChatSetupNavigation } from "@/components/chat/ChatSetupNavigation";
import { SlackIdentityStep } from "./SlackIdentityStep";
import { PhotonConnectStep } from "./PhotonConnectStep";
import { EmailEndpointSetup } from "./EmailEndpointSetup";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryView } from "@/components/QueryView";
import { AlertTriangle, CheckCircle2, Copy, CircleHelp, ExternalLink, Eye, EyeOff, Hammer, Loader2 } from "lucide-react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { AgentCharacter } from "@/components/AgentCharacter";
import { AgentSelect } from "@/components/AgentMultiSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { useToast } from "@/context/ToastContext";
import { agentsApi } from "@/api/agents";
import { instanceSettingsApi } from "@/api/instanceSettings";
import {
  chatEndpointsApi,
  type ChatEndpoint,
  type ChatProvider,
  type ChatEndpointSetupAction,
} from "@/api/chatEndpoints";
import { useNavigate, useSearchParams } from "@/lib/router";
import { queryKeys } from "@/lib/queryKeys";
import { copyTextToClipboard } from "@/lib/clipboard";
import { useCopyAction } from "@/lib/use-copy-action";
import { isAgentStatusInvokable, slackAppConfigurationSchema, type SlackAppConfiguration } from "@paperclipai/shared";
import { sanitizedSetupErrorMessage } from "./chat-setup-error";
import {
  createGitHubPrivateKeyReadGuard,
  readGitHubPrivateKeyFile,
} from "./github-private-key-file";
import { describeError } from "@/api/errors";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { cn } from "@/lib/utils";

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

const knownProviders = new Set(Object.keys(providerNames));

function isProvider(value: string | null): value is ChatProvider {
  return value !== null && knownProviders.has(value);
}

function publicOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isChatEndpointRepairing(
  endpoint: Pick<
    ChatEndpoint,
    "provider" | "status" | "providerAccountId" | "botExternalId"
  > | null,
  resumeEndpointId: string | null,
  reconnectRequested: boolean,
): boolean {
  if (!resumeEndpointId || !endpoint) return false;
  const recoveringStatus =
    endpoint.status === "attention" || endpoint.status === "revoked";
  // A secret-only GitHub draft affected by setup trouble has no App identity
  // or reusable App credentials. It must remain first-time setup, where App ID
  // and private key are required, rather than offering a misleading reconnect.
  if (
    endpoint.provider === "github" &&
    recoveringStatus &&
    !endpoint.providerAccountId &&
    !endpoint.botExternalId
  ) {
    return false;
  }
  return (
    recoveringStatus ||
    (reconnectRequested &&
      (endpoint.status === "active" || endpoint.status === "paused"))
  );
}

export function ChatConnectionPurpose({ provider, onChat, onTools, slackLabels }: {
  provider: ChatProvider;
  onChat: () => void;
  onTools: () => void;
  slackLabels?: string[];
}) {
  const { setBreadcrumbs } = useBreadcrumbs();
  useEffect(() => {
    setBreadcrumbs([{ label: t("pagesAppsChatChatEndpointSetup.breadcrumbs.connectors"), href: "/apps" }, { label: t("pagesAppsChatChatEndpointSetup.breadcrumbs.chooseConnection") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);
  return (
      <div className="max-w-2xl space-y-6">
        <ChatSetupNavigation labels={provider === "slack" ? slackLabels ?? [t("pagesAppsChatChatEndpointSetup.purpose.chooseAgent"), t("pagesAppsChatChatEndpointSetup.purpose.connect")] : undefined} step={0} availableStep={0} onSelect={onChat} />
        <div>
          <h1 className="text-xl font-bold">{t("pagesAppsChatChatEndpointSetup.purpose.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("pagesAppsChatChatEndpointSetup.purpose.question", { provider: providerNames[provider] })}
          </p>
        </div>
        <div className="grid gap-3">
          <button
            type="button"
            className="flex items-center gap-4 rounded-xl border border-border p-4 text-left hover:bg-accent/40"
            onClick={onChat}
          >
            <AgentAvatar size={48} />
            <span>
              <span className="block text-sm font-semibold">
                {t("pagesAppsChatChatEndpointSetup.purpose.chatWithAgent")}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t("pagesAppsChatChatEndpointSetup.purpose.chatDescription", { provider: providerNames[provider] })}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="flex items-center gap-4 rounded-xl border border-border p-4 text-left hover:bg-accent/40"
            onClick={onTools}
          >
            <span className="flex size-12 shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
              <Hammer className="size-8" />
            </span>
            <span>
              <span className="block text-sm font-semibold">
                {t("pagesAppsChatChatEndpointSetup.purpose.useAsTool")}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t("pagesAppsChatChatEndpointSetup.purpose.toolDescription", { provider: providerNames[provider] })}
              </span>
            </span>
          </button>
        </div>
      </div>
  );
}

export function ChatEndpointSetup() {
  const [params] = useSearchParams();
  if (params.get("provider") === "github") return <GitHubChatSetup />;
  return params.get("provider") === "agentmail" ? <EmailEndpointSetup /> : <ChatSdkEndpointSetup />;
}

function ChatSdkEndpointSetup() {
  const { userId, settled: identitySettled } = useAccountIdentity();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const provider = isProvider(params.get("provider"))
    ? (params.get("provider") as ChatProvider)
    : null;
  const toolHref = params.get("toolHref") || "/apps";
  const preselectedAgent = params.get("agentId") ?? "";
  const resumeEndpointId = params.get("resume") ?? "";
  const reconnectRequested = params.get("reconnect") === "1";
  const [purpose, setPurpose] = useState<"choice" | "chat">(
    params.get("purpose") === "chat" ? "chat" : "choice",
  );
  const [agentId, setAgentId] = useState(preselectedAgent);
  const [slackCredentialsReady, setSlackCredentialsReady] = useState(params.get("stage") === "credentials");
  const [viewedStep, setViewedStep] = useState<number | null>(null);
  const [slackIdentityReady, setSlackIdentityReady] = useState(false);
  const [automaticBusy, setAutomaticBusy] = useState(false);
  const [managedAutoStart, setManagedAutoStart] = useState(Boolean(resumeEndpointId));
  const [slackDraft, setSlackDraft] = useState<{ agentId: string; app: SlackAppConfiguration } | null>(null);
  const [endpoint, setEndpoint] = useState<ChatEndpoint | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [generatedWebhookSecret, setGeneratedWebhookSecret] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("pagesAppsChatChatEndpointSetup.breadcrumbs.connectors"), href: "/apps" },
      { label: t("pagesAppsChatChatEndpointSetup.breadcrumbs.connectChat") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const agentsQuery = useQuery({
    queryKey: ["chat-endpoint-setup-agents", selectedCompanyId],
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });
  const resumeQuery = useQuery({
    queryKey: ["chat-endpoint-setup-resume", resumeEndpointId],
    queryFn: () => chatEndpointsApi.get(resumeEndpointId),
    enabled: Boolean(resumeEndpointId),
    refetchInterval: query => ["creating", "install", "credentials_saved"].includes(query.state.data?.setup?.slackRegistration?.status ?? "") ? 1_500 : false,
  });
  useEffect(() => {
    if (!resumeQuery.data) return;
    setEndpoint(current => {
      if (isProvisionedSlackSetup(current?.setup?.slackSetupMethod) && !current?.providerAccountId && resumeQuery.data.providerAccountId) setViewedStep(null);
      return resumeQuery.data;
    });
    setAgentId(resumeQuery.data.assignedAgentId);
    setPurpose("chat");
  }, [resumeQuery.data]);
  const githubVerificationQuery = useQuery({
    queryKey: ["chat-endpoint-github-webhook-verification", endpoint?.id],
    queryFn: () => chatEndpointsApi.get(endpoint!.id),
    enabled: Boolean(
      provider === "github" &&
      endpoint?.id &&
      endpoint.setup?.step === "provider_setup" &&
      endpoint.setup?.webhookSecretConfigured &&
      !endpoint.setup.webhookVerifiedAt,
    ),
    refetchInterval: 1_500,
  });
  useEffect(() => {
    if (
      !githubVerificationQuery.data ||
      provider !== "github" ||
      !endpoint ||
      endpoint.id !== githubVerificationQuery.data.id ||
      endpoint.setup?.step !== "provider_setup" ||
      !endpoint.setup?.webhookSecretConfigured ||
      endpoint.setup.webhookVerifiedAt
    )
      return;
    setEndpoint(githubVerificationQuery.data);
  }, [endpoint, githubVerificationQuery.data, provider]);
  const experimentalSettingsQuery = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
    enabled: endpoint?.setup?.step === "test",
  });
  const experimentalSettingsView = useQueryView(experimentalSettingsQuery);
  const activeAgents = useMemo(
    () =>
      (agentsQuery.data ?? []).filter((agent) =>
        isAgentStatusInvokable(agent.status),
      ),
    [agentsQuery.data],
  );
  const selectedAgent = agentsQuery.data?.find(agent => agent.id === agentId);
  const slackDetails = slackDraft?.agentId === agentId ? slackDraft.app
    : endpoint?.setup?.slackApp ?? defaultSlackAppConfiguration(selectedAgent?.name ?? endpoint?.assignedAgentName ?? "");
  const slackDetailsValidation = slackAppConfigurationSchema.safeParse(slackDetails);
  const slackDetailsEditable = !automaticBusy && (!endpoint || endpoint.status === "draft" && !endpoint.botExternalId
    && (!endpoint.setup?.slackRegistration || endpoint.setup.slackRegistration.status === "failed"));
  const syncEndpointSnapshot = (
    next: ChatEndpoint,
    onlyIfStillVisible = false,
  ) => {
    if (next.setup?.slackSetupMethod === "managed" && endpoint && endpoint.setup?.slackSetupMethod !== "managed") setManagedAutoStart(true);
    if (isProvisionedSlackSetup(next.setup?.slackSetupMethod) && next.setup?.slackRegistration?.status === "configured"
      && endpoint?.setup?.slackRegistration?.status !== "configured") setViewedStep(null);
    setEndpoint((visible) =>
      onlyIfStillVisible && visible?.id !== next.id ? visible : next,
    );
    queryClient.setQueryData(["chat-endpoint-setup-resume", next.id], next);
    queryClient.setQueryData(queryKeys.chatEndpoints.detail(next.id), next);
    if (next.provider === "github") {
      queryClient.setQueryData(
        ["chat-endpoint-github-webhook-verification", next.id],
        next,
      );
    }
  };
  const slackChoices = useQuery({
    queryKey: ["slack-setup-options", selectedCompanyId],
    queryFn: () => chatEndpointsApi.slackSetupOptions(selectedCompanyId!),
    enabled: provider === "slack" && Boolean(selectedCompanyId),
    });
  const slackChoicesView = useQueryView(slackChoices);
  const createEndpoint = useMutation({
    mutationFn: ({ ownApp = false }: { ownApp?: boolean; exit?: boolean }) => {
      if (provider === "slack" && !slackChoices.data) throw new Error(t("pagesAppsChatChatEndpointSetup.errors.slackSetupLoading"));
      return chatEndpointsApi.create(selectedCompanyId!, {
        provider: provider!,
        assignedAgentId: agentId,
        ...(provider === "slack" ? { slackSetupMethod: ownApp ? "automatic" : slackChoices.data!.defaultMethod, slackApp: slackDetailsValidation.success ? slackDetailsValidation.data : slackDetails } : {}),
      });
    },
    onSuccess: (next, { exit }) => {
      setManagedAutoStart(!exit);
      setViewedStep(exit ? 0 : null);
      syncEndpointSnapshot(next);
      if (next.provider === "imessage-photon" || next.provider === "slack" || next.provider === "speko") {
        const resumed = new URLSearchParams(params);
        resumed.set("resume", next.id);
        setParams(resumed, { replace: true });
      }
      if (exit) navigate("/apps");
    },
    onError: (error) =>
      pushToast({
        title: t("pagesAppsChatChatEndpointSetup.toasts.startSetupFailed"),
        body: describeError(error).body,
        tone: "error",
      }),
  });
  const saveSlackDetails = useMutation({
    scope: { id: `slack-app-details:${endpoint?.id}` },
    mutationFn: (details: SlackAppConfiguration) => chatEndpointsApi.update(endpoint!.id, { slackApp: details }),
    onSuccess: next => syncEndpointSnapshot(next),
  });
  const persistSlackDetails = async () => {
    if (endpoint && slackDetailsEditable && slackDetailsValidation.success
      && JSON.stringify(slackDetailsValidation.data) !== JSON.stringify(endpoint.setup?.slackApp))
      await saveSlackDetails.mutateAsync(slackDetailsValidation.data);
  };
  const continueFromAgent = async (exit: boolean) => {
    if (exit && provider !== "slack") { navigate("/apps"); return; }
    if (!endpoint) {
      if (!agentId) { if (exit) navigate("/apps"); return; }
      createEndpoint.mutate({ exit });
      return;
    }
    try { if (provider === "slack") await persistSlackDetails(); }
    catch { return; }
    if (exit) navigate("/apps"); else { setManagedAutoStart(true); setViewedStep(null); }
  };
  const useOwnSlackApp = useMutation({
    mutationFn: async () => {
      if (!endpoint) return createEndpoint.mutateAsync({ ownApp: true });
      await persistSlackDetails();
      return chatEndpointsApi.update(endpoint.id, { slackSetupMethod: "automatic" });
    },
    onSuccess: next => { setManagedAutoStart(false); syncEndpointSnapshot(next); setViewedStep(1); },
    onError: () => pushToast({ title: t("pagesAppsChatChatEndpointSetup.toasts.switchSlackSetupFailed"), body: t("pagesAppsChatChatEndpointSetup.toasts.tryAgain"), tone: "error" }),
  });
  const setupAction = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: ChatEndpointSetupAction;
      values?: Record<string, string>;
    }) => {
      const endpointId = endpoint!.id;
      try {
        return await chatEndpointsApi.setup(endpointId, provider === "imessage-photon" ? {
      action,
      ...(values?.projectSecret ? { credentials: { projectSecret: values.projectSecret } } : {}),
      ...(values?.projectId && values.allocation === "shared" ? { photon: { allocation: "shared" as const, projectId: values.projectId } } : values?.projectId && values?.lineId ? { photon: { allocation: "dedicated" as const, projectId: values.projectId, lineId: values.lineId } } : {}),
        } : { action, credentials: values });
      } catch (error) {
        // Another open tab may have completed verification, or the successful
        // response may have been lost. Read the canonical state before retrying.
        if (action === "verify") {
          const current = await chatEndpointsApi.get(endpointId).catch(() => null);
          if (current?.setup?.step === "test" || current?.setup?.step === "complete") return current;
        }
        throw error;
      }
    },
    onMutate: () => setSetupError(null),
    onSuccess: (next) => {
      setSetupError(null);
      setViewedStep(null);
      syncEndpointSnapshot(next);
      setCredentials({});
      if (next.setup?.step !== "test" && next.setup?.step !== "complete") setSlackIdentityReady(false);
    },
    onError: (error, variables) =>
      setSetupError(sanitizedSetupErrorMessage(error, variables.values)),
  });
  const generateSetupSecret = useMutation({
    mutationFn: () => chatEndpointsApi.generateSetupSecret(endpoint!.id),
    onMutate: async () => {
      const endpointId = endpoint!.id;
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: ["chat-endpoint-github-webhook-verification", endpointId],
          exact: true,
        }),
        queryClient.cancelQueries({
          queryKey: ["chat-endpoint-setup-resume", endpointId],
          exact: true,
        }),
        queryClient.cancelQueries({
          queryKey: queryKeys.chatEndpoints.detail(endpointId),
          exact: true,
        }),
      ]);
      return { endpointId };
    },
    onSuccess: async ({ webhookSecret }, _variables, context) => {
      const endpointId = context.endpointId;
      const markRotated = (current: ChatEndpoint) => ({
        ...current,
        setup: {
          ...current.setup,
          step: "provider_setup" as const,
          webhookSecretConfigured: true,
          webhookVerifiedAt: null,
        },
      });

      queryClient.removeQueries({
        queryKey: ["chat-endpoint-github-webhook-verification", endpointId],
        exact: true,
      });
      setGeneratedWebhookSecret(webhookSecret);
      setEndpoint((current) =>
        current && current.id === endpointId ? markRotated(current) : current,
      );
      queryClient.setQueryData<ChatEndpoint>(
        ["chat-endpoint-setup-resume", endpointId],
        (current) => (current ? markRotated(current) : current),
      );
      queryClient.setQueryData<ChatEndpoint>(
        queryKeys.chatEndpoints.detail(endpointId),
        (current) => (current ? markRotated(current) : current),
      );

      try {
        const current = await chatEndpointsApi.get(endpointId);
        syncEndpointSnapshot(current, true);
      } catch {
        // Keep the one-time secret copyable. Verification polling will retry the
        // canonical endpoint read without restoring a pre-rotation snapshot.
      }
    },
    onError: (error) =>
      pushToast({
        title: t("pagesAppsChatChatEndpointSetup.toasts.generateSecretFailed"),
        body: describeError(error).body,
        tone: "error",
      }),
  });
  const testConnection = useMutation({
    mutationFn: () => provider === "slack" ? chatEndpointsApi.finishSlackSetup(endpoint!.id) : chatEndpointsApi.test(endpoint!.id),
    onSuccess: (next) => {
      syncEndpointSnapshot(next);
      if (next.status === "active") navigate(`/apps/chat/${next.id}/settings`);
    },
    onError: (error) =>
      pushToast({
        title: provider === "slack" ? t("pagesAppsChatChatEndpointSetup.toasts.finishSetupFailed") : t("pagesAppsChatChatEndpointSetup.toasts.testNotComplete"),
        body: describeError(error).body,
        tone: "error",
      }),
  });
  const finishSetup = () => {
    if (provider === "slack" && endpoint?.setup?.step === "complete") {
      navigate(`/apps/chat/${endpoint.id}/settings`);
      return;
    }
    testConnection.mutate();
  };

  const repairing = isChatEndpointRepairing(
    endpoint,
    resumeEndpointId,
    reconnectRequested,
  );
  const isSlack = provider === "slack";
  const slackNavigation = slackSetupState({ endpoint, repairing, credentialsReady: slackCredentialsReady, identityReady: slackIdentityReady, defaultMethod: slackChoices.data?.defaultMethod });
  const automaticSlack = isSlack && slackNavigation.provisioned;
  const automaticSlackComplete = automaticSlack && slackNavigation.complete;
  const tryStep = isSlack ? slackNavigation.finalStage : 2;
  const availableStep = isSlack ? slackNavigation.availableStage : !endpoint ? 0
    : !repairing && (endpoint.setup?.step === "test" || endpoint.setup?.step === "complete") ? tryStep : 1;
  const step = Math.min(viewedStep ?? availableStep, availableStep);
  const agentStepBusy = automaticBusy || createEndpoint.isPending || saveSlackDetails.isPending || useOwnSlackApp.isPending;
  const slackVerificationQuery = useQuery({
    queryKey: ["chat-endpoint-slack-webhook-verification", endpoint?.id],
    queryFn: () => chatEndpointsApi.get(endpoint!.id),
    enabled: Boolean(isSlack && step === 3 && endpoint?.setup?.step === "provider_setup" &&
      !endpoint.setup.webhookVerifiedAt && !setupAction.isPending),
    refetchInterval: 1_500,
  });
  const slackVerificationView = useQueryView(slackVerificationQuery);
  useEffect(() => {
    const next = slackVerificationQuery.data;
    if (!next || !endpoint || next.id !== endpoint.id || setupAction.isPending ||
      endpoint.setup?.step !== "provider_setup" || endpoint.setup.webhookVerifiedAt ||
      !next.setup?.webhookVerifiedAt) return;
    setEndpoint(next);
  }, [slackVerificationQuery.data, endpoint, setupAction.isPending]);
  const autoVerificationAttempt = useRef<string | null>(null);
  useEffect(() => {
    if (!isSlack || step !== 3 || endpoint?.setup?.step !== "provider_setup" ||
      !endpoint.setup.webhookVerifiedAt || setupAction.isPending) return;
    const attempt = `${endpoint.id}:${endpoint.setup.webhookVerifiedAt}`;
    if (autoVerificationAttempt.current === attempt) return;
    autoVerificationAttempt.current = attempt;
    setupAction.mutate({ action: "verify" });
  }, [isSlack, step, endpoint, setupAction]);

  if (!provider)
    return (
      <p className="text-sm text-destructive">
        {t("pagesAppsChatChatEndpointSetup.unsupportedProvider")}
      </p>
    );
  if (!selectedCompanyId)
    return (
      <p className="text-sm text-muted-foreground">
        {t("pagesAppsChatChatEndpointSetup.selectOrganization")}
      </p>
    );

  if (purpose === "choice" && provider !== "speko") {
    return <ChatConnectionPurpose provider={provider} slackLabels={slackNavigation.labels} onChat={() => setPurpose("chat")} onTools={() => navigate(toolHref)} />;
  }

  return (
    <div className={automaticSlackComplete && step === tryStep ? "mx-auto w-full max-w-2xl space-y-6" : "max-w-2xl space-y-6"}>
      <ChatSetupNavigation
        labels={isSlack ? slackNavigation.labels : undefined}
        step={isSlack ? slackNavigation.toVisible(step) : step}
        availableStep={isSlack ? slackNavigation.toVisible(availableStep) : availableStep}
        disabled={agentStepBusy || setupAction.isPending || generateSetupSecret.isPending || testConnection.isPending}
        onSelect={value => setViewedStep(isSlack ? slackNavigation.toStage(value) : value)}
      />
      <div className="min-w-0 space-y-6">
        {step === 0 ? (
          <>
            <div>
              <h1 className="text-xl font-bold">
                {t("pagesAppsChatChatEndpointSetup.agentStep.title")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("pagesAppsChatChatEndpointSetup.agentStep.description")}
              </p>
            </div>
            {endpoint ? (
              <Input aria-label={t("pagesAppsChatChatEndpointSetup.agentStep.assignedAgent")} value={endpoint.assignedAgentName ?? selectedAgent?.name ?? agentId} readOnly />
            ) : <AgentSelect
              agents={activeAgents}
              value={agentId}
              onChange={setAgentId}
              placeholder={t("pagesAppsChatChatEndpointSetup.agentStep.chooseActiveAgent")}
              emptyMessage={t("pagesAppsChatChatEndpointSetup.agentStep.noActiveAgents")}
            />}
            {isSlack && (selectedAgent || endpoint) && <SlackSetupAdvanced>
              <SlackAppDetails value={slackDetails} readOnly={!slackDetailsEditable || agentStepBusy}
                onChange={app => setSlackDraft({ agentId, app })}
                onBlur={() => void persistSlackDetails().catch(() => {})} />
              {saveSlackDetails.error && <p role="alert" className="text-sm text-destructive">{t("pagesAppsChatChatEndpointSetup.agentStep.saveSlackDetailsFailed")}</p>}
              {slackChoices.data?.defaultMethod === "managed" && (!endpoint || endpoint.setup?.slackSetupMethod === "managed") && !endpoint?.setup?.slackRegistration && <Button
                variant="link" className="h-auto p-0 text-muted-foreground"
                disabled={agentStepBusy || !slackDetailsValidation.success}
                onClick={() => useOwnSlackApp.mutate()}
              >{t("pagesAppsChatChatEndpointSetup.agentStep.useOwnApp")}</Button>}
            </SlackSetupAdvanced>}
            {isSlack && !endpoint && !slackChoices.data && ((slackChoicesView.kind === "error")
              ? <div role="alert" className="text-sm text-destructive">{t("pagesAppsChatChatEndpointSetup.agentStep.loadSlackSetupFailed")}{" "}<Button variant="link" disabled={slackChoices.isFetching} onClick={() => void slackChoices.refetch()}>{t("pagesAppsChatChatEndpointSetup.retry")}</Button></div>
              : <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t("pagesAppsChatChatEndpointSetup.agentStep.loadingSlack")}</p>)}
            {provider === "github" && <GitHubAgentTrustWarning agent={selectedAgent} />}
            <SetupWizardFooter disabled={agentStepBusy || isSlack && !endpoint && Boolean(agentId) && !slackChoices.data} onSaveExit={() => void continueFromAgent(true)}>
              <Button
                disabled={!agentId || agentStepBusy || isSlack && (!slackDetailsValidation.success || !endpoint && !slackChoices.data)}
                onClick={() => void continueFromAgent(false)}
              >
                {createEndpoint.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t("pagesAppsChatChatEndpointSetup.continue")}
              </Button>
            </SetupWizardFooter>
          </>
        ) : null}
        {endpoint && !(automaticSlackComplete && step === tryStep) && (
          <div hidden={step !== 1 && !(isSlack && (step === 2 || step === 3))} className="space-y-6">
            {setupError ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              >
                <p className="font-medium">{t("pagesAppsChatChatEndpointSetup.connectionFailed")}</p>
                <p className="mt-1">{setupError}</p>
              </div>
            ) : null}
            <ProviderConnectStep
              key={`${provider}:${endpoint.id}`}
              provider={provider}
              managedAutoStart={managedAutoStart && step !== 0}
              slackStage={step === 1 ? "app" : step === 3 ? "finish" : "credentials"}
              onSlackCredentialsContinue={() => setViewedStep(3)}
              onSlackVerificationContinue={() => setViewedStep(4)}
              slackVerificationError={slackVerificationView.kind === "error"}
              onSlackAppCreated={() => {
                setSlackCredentialsReady(true);
                setViewedStep(2);
                const resumed = new URLSearchParams(params);
                resumed.set("resume", endpoint.id);
                resumed.set("stage", "credentials");
                setParams(resumed, { replace: true });
              }}
              agentName={selectedAgent?.name ?? endpoint.assignedAgentName}
              endpoint={endpoint}
              onEndpointSaved={syncEndpointSnapshot}
              credentials={credentials}
              setCredentials={setCredentials}
              repairing={repairing}
              pending={setupAction.isPending}
              onAutomaticBusy={setAutomaticBusy}
              generatedWebhookSecret={generatedWebhookSecret}
              generatingSetupSecret={generateSetupSecret.isPending}
              onGenerateSetupSecret={() => generateSetupSecret.mutate()}
              onAction={(action, values) =>
                setupAction.mutate({ action, values })
              }
            />
          </div>
        )}
        {endpoint && isSlack && !automaticSlack && step === 4 && (
          <SlackIdentityStep
            endpointId={endpoint.id}
            command={endpoint.setup?.slackApp?.command ?? endpoint.setup?.command ?? "/paperclip"}
            testStartedAt={endpoint.setup?.testStartedAt}
            onSaveExit={() => navigate("/apps")}
            onConnected={() => {
              setSlackIdentityReady(true);
              setViewedStep(5);
            }}
          />
        )}
        {endpoint && step === tryStep && provider === "speko" && (
          <div className="space-y-5">
            <h1 className="text-xl font-bold">{t("pagesAppsChatChatEndpointSetup.speko.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("pagesAppsChatChatEndpointSetup.speko.description")}</p>
            <NativeVoiceConversation companyId={endpoint.companyId} endpointId={endpoint.id} agentName={selectedAgent?.name ?? endpoint.assignedAgentName} />
            <SetupWizardFooter onSaveExit={() => navigate("/apps")}><Button disabled={testConnection.isPending} onClick={() => testConnection.mutate()}>{t("pagesAppsChatChatEndpointSetup.speko.verify")}</Button></SetupWizardFooter>
          </div>
        )}
        {endpoint && step === tryStep && provider !== "speko" && (!automaticSlack || automaticSlackComplete) && (
          automaticSlack ? <div className="flex flex-col items-center gap-6 py-8 text-center">
            <AgentCharacter
              agent={selectedAgent ?? { id: endpoint.assignedAgentId, name: endpoint.assignedAgentName }}
              size={256} state="success" trackingScope="page"
              label={t("pagesAppsChatChatEndpointSetup.success.avatarLabel", { name: selectedAgent?.name ?? endpoint.assignedAgentName })}
            />
            <div className="flex flex-col items-center gap-3">
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <CheckCircle2 aria-hidden="true" className="size-6 text-(--status-task-done)" />
                {t("pagesAppsChatChatEndpointSetup.success.title")}
              </h1>
              <p className="flex flex-wrap items-center justify-center gap-2 text-base text-muted-foreground">
                <span>{t("pagesAppsChatChatEndpointSetup.success.talkInSlack", { name: selectedAgent?.name ?? endpoint.assignedAgentName })}</span>
                <img src="/brands/apps/slack.svg" alt="" aria-hidden="true" className="size-6" />
              </p>
              <Button asChild variant="link"><a href={slackConversationUrl(endpoint, identitySettled ? userId : null)} target="_blank" rel="noopener noreferrer">{t("pagesAppsChatChatEndpointSetup.openSlack")} <ExternalLink className="size-4" /></a></Button>
            </div>
            <Button disabled={testConnection.isPending} onClick={finishSetup}>
              {testConnection.isPending && <Loader2 className="size-4 animate-spin" />}{t("pagesAppsChatChatEndpointSetup.done")}
            </Button>
          </div> : <TryStep
            endpointId={endpoint.id}
            provider={provider}
            agentName={selectedAgent?.name ?? endpoint.assignedAgentName}
            botLabel={endpoint.botLabel}
            botUsername={endpoint.botUsername}
            slackAccount={endpoint.setup?.slackAccount}
            photonAllocation={endpoint.photonAllocation}
            providerUrl={endpoint.setup?.slackAccount?.dmChannelId && endpoint.providerAccountId ? `https://app.slack.com/client/${encodeURIComponent(endpoint.providerAccountId)}/${encodeURIComponent(endpoint.setup.slackAccount.dmChannelId)}` : endpoint.setup?.providerUrl}
            guestIsolationState={
              experimentalSettingsQuery.isPending || experimentalSettingsView.kind === "reconnecting"
                ? "loading"
                : experimentalSettingsView.kind === "error"
                  ? "unknown"
                  : experimentalSettingsQuery.data?.enableIsolatedWorkspaces ===
                      true
                    ? "enabled"
                    : "disabled"
            }
            pending={testConnection.isPending}
            onOpenAccess={() => navigate(`/apps/chat/${endpoint.id}/access`)}
            onTest={finishSetup}
            onSaveExit={() => navigate("/apps")}
          />
        )}
        {step !== 0 && !isSlack && provider !== "speko" && <div className="flex justify-start">
          <Button className="text-muted-foreground" variant="ghost" onClick={() => navigate("/apps")}>
            {t("pagesAppsChatChatEndpointSetup.saveAndExit")}
          </Button>
        </div>}
      </div>
    </div>
  );
}

function ProviderConnectStep({
  provider,
  slackStage,
  onSlackCredentialsContinue,
  onSlackVerificationContinue,
  slackVerificationError,
  onSlackAppCreated,
  agentName,
  endpoint,
  credentials,
  setCredentials,
  repairing,
  pending,
  onAutomaticBusy,
  managedAutoStart = false,
  onEndpointSaved,
  generatedWebhookSecret,
  generatingSetupSecret,
  onGenerateSetupSecret,
  onAction,
}: {
  provider: ChatProvider;
  slackStage: "app" | "credentials" | "finish";
  onSlackCredentialsContinue: () => void;
  onSlackVerificationContinue: () => void;
  slackVerificationError: boolean;
  onSlackAppCreated: () => void;
  agentName: string;
  endpoint: ChatEndpoint;
  credentials: Record<string, string>;
  setCredentials: Dispatch<SetStateAction<Record<string, string>>>;
  repairing: boolean;
  pending: boolean;
  managedAutoStart?: boolean;
  onAutomaticBusy: (busy: boolean) => void;
  onEndpointSaved: (endpoint: ChatEndpoint) => void;
  generatedWebhookSecret: string;
  generatingSetupSecret: boolean;
  onGenerateSetupSecret: () => void;
  onAction: (
    action: ChatEndpointSetupAction,
    values?: Record<string, string>,
  ) => void;
}) {
  const { userId, settled: identitySettled } = useAccountIdentity();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const slackBotToken = (credentials.botToken ?? "").trim();
  const slackBotTokenInvalid = provider === "slack" && slackBotToken.length > 0 &&
    !slackBotToken.startsWith("xoxb-");
  const slackSigningSecretHasTokenPrefix = provider === "slack" &&
    /^x[a-z0-9]*-/i.test((credentials.signingSecret ?? "").trim());
  const slackCredentialsSaved = provider === "slack" && Boolean(endpoint.providerAccountId);
  const continueWithSavedSlackCredentials = slackCredentialsSaved && !repairing &&
    !slackBotToken && !credentials.signingSecret?.trim();
  const reportCopyFailure = () =>
    pushToast({
      title: t("pagesAppsChatChatEndpointSetup.toasts.copyFailed"),
      body: t("pagesAppsChatChatEndpointSetup.toasts.copyManually"),
      tone: "error",
    });
  const field = (key: string, label: string, type = "password") => (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Input
        type={type}
        value={credentials[key] ?? ""}
        onChange={(event) =>
          setCredentials({ ...credentials, [key]: event.target.value })
        }
      />
    </label>
  );
  const openProviderSetup = (fallback: string) =>
    window.open(
      endpoint.setup?.authorizationUrl ??
        endpoint.setup?.providerUrl ??
        fallback,
      "_blank",
      "noopener,noreferrer",
    );
  const endpointValue = (label: string, value: string | null | undefined) => (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="rounded-lg border border-border bg-muted p-3 font-mono text-xs break-all">
        {value ??
          t("pagesAppsChatChatEndpointSetup.endpointUnavailable")}
      </div>
    </div>
  );
  const [manifestCopied, setManifestCopied] = useState(false);
  // A hook rather than a sticky boolean: this step stays mounted when the
  // secret is regenerated, so a latched "copied" would keep vouching for a
  // value the reader never copied. The status resets itself, and a refused
  // clipboard reads as a failure instead of a success.
  const webhookSecretCopy = useCopyAction();
  const [openingSlackApp, setOpeningSlackApp] = useState(false);
  const slackAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setOpeningSlackApp(false);
    return () => {
      if (slackAdvanceTimer.current !== null) {
        clearTimeout(slackAdvanceTimer.current);
        slackAdvanceTimer.current = null;
      }
    };
  }, [slackStage]);
  const [privateKeyVisible, setPrivateKeyVisible] = useState(false);
  const [privateKeyFileError, setPrivateKeyFileError] = useState<string | null>(
    null,
  );
  const [privateKeyFileLoaded, setPrivateKeyFileLoaded] = useState(false);
  const [privateKeyFileLoading, setPrivateKeyFileLoading] = useState(false);
  const privateKeyFileInputRef = useRef<HTMLInputElement>(null);
  const privateKeyReadGuard = useRef(createGitHubPrivateKeyReadGuard()).current;
  useEffect(
    () => () => {
      privateKeyReadGuard.invalidate();
    },
    [privateKeyReadGuard],
  );
  const loadPrivateKeyFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const readRevision = privateKeyReadGuard.start();
    setPrivateKeyFileError(null);
    setPrivateKeyFileLoaded(false);
    setPrivateKeyFileLoading(true);
    try {
      const privateKey = await readGitHubPrivateKeyFile(file);
      if (!privateKeyReadGuard.isCurrent(readRevision)) return;
      setCredentials((current) => ({ ...current, privateKey }));
      setPrivateKeyVisible(false);
      setPrivateKeyFileLoaded(true);
    } catch (error) {
      if (!privateKeyReadGuard.isCurrent(readRevision)) return;
      setPrivateKeyFileError(
        describeError(error).body,
      );
    } finally {
      if (privateKeyReadGuard.isCurrent(readRevision)) {
        setPrivateKeyFileLoading(false);
      }
    }
  };
  const replacePrivateKey = (privateKey: string) => {
    privateKeyReadGuard.invalidate();
    setPrivateKeyFileError(null);
    setPrivateKeyFileLoaded(false);
    setPrivateKeyFileLoading(false);
    setCredentials((current) => ({ ...current, privateKey }));
  };
  const slackApp = endpoint.setup?.slackApp ?? {
    ...defaultSlackAppConfiguration(agentName),
    ...(endpoint.setup?.command ? { command: endpoint.setup.command } : {}),
  };
  const automaticSlack = isProvisionedSlackSetup(endpoint.setup?.slackSetupMethod);
  const slackValidation = slackAppConfigurationSchema.safeParse(slackApp);
  const saveSlackAndExit = () => navigate("/apps");
  const slackAppName = slackApp.appName.trim();
  const slackBotName = slackApp.botName.trim();
  const slackCommand = slackApp.command.trim();
  const slackWebhookUrl =
    endpoint.setup?.webhookUrl ?? "<paperclip-webhook-url>";
  const slackManifest = JSON.stringify(buildSlackAppManifest({
    app: { appName: slackAppName, botName: slackBotName, command: slackCommand }, agentName,
    webhookUrl: slackWebhookUrl,
    ...(automaticSlack && endpoint.setup?.slackOAuthCallbackUri ? { redirectUri: endpoint.setup.slackOAuthCallbackUri } : {}),
  }), null, 2);
  const slackCreateUrl = `https://api.slack.com/apps?new_app=1&manifest_json=${encodeURIComponent(slackManifest)}`;
  useEffect(() => setManifestCopied(false), [slackManifest]);
  const teamsClientId =
    credentials.clientId?.trim() || "<application-client-id>";
  const teamsManifestSettings = JSON.stringify(
    {
      bots: [
        {
          botId: teamsClientId,
          scopes: ["personal", "team", "groupChat"],
          supportsFiles: true,
          isNotificationOnly: false,
          commandLists: [
            {
              scopes: ["personal", "groupChat"],
              commands: [
                {
                  title: "/status",
                  description: "Show the active Paperclip task status",
                },
                {
                  title: "/new",
                  description: "Start a new Paperclip task in this chat",
                },
                {
                  title: "/close",
                  description: "Close the active chat conversation",
                },
              ],
            },
          ],
        },
      ],
      webApplicationInfo: {
        id: teamsClientId,
        resource: "https://paperclip.ing",
      },
      authorization: {
        permissions: {
          resourceSpecific: [
            { name: "ChannelMessage.Read.Group", type: "Application" },
            { name: "ChatMessage.Read.Chat", type: "Application" },
          ],
        },
      },
    },
    null,
    2,
  );
  if (provider === "speko") return <SpekoProviderSetup onSaveExit={() => navigate("/apps")} agentName={agentName} credentials={credentials} onChange={setCredentials} onConnect={(values) => onAction(repairing ? "reconnect" : "configure", values)} callbackUrl={endpoint.setup?.webhookUrl} pending={pending} repairing={repairing} signingSecretConfigured={endpoint.setup?.webhookSecretConfigured} />;
  if (provider === "imessage-photon") return <PhotonConnectStep endpoint={endpoint} agentName={agentName} repairing={repairing} pending={pending} onAction={onAction} />;
  if (provider === "discord") {
    const applicationId = credentials.applicationId?.trim() ?? "";
    const guildId = credentials.guildId?.trim() ?? "";
    const installUrl = applicationId
      ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(applicationId)}&permissions=309237763136&scope=bot${guildId ? `&guild_id=${encodeURIComponent(guildId)}&disable_guild_select=true` : ""}`
      : null;
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">{t("pagesAppsChatChatEndpointSetup.discord.title", { agent: agentName })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {repairing
              ? t("pagesAppsChatChatEndpointSetup.discord.reconnectDescription")
              : t("pagesAppsChatChatEndpointSetup.discord.description")}
          </p>
        </div>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>{t("pagesAppsChatChatEndpointSetup.discord.steps.createApp")}</li>
          <li>{t("pagesAppsChatChatEndpointSetup.discord.steps.createBot")}</li>
          <li>{t("pagesAppsChatChatEndpointSetup.discord.steps.serverId")}</li>
          <li>{t("pagesAppsChatChatEndpointSetup.discord.steps.install")}</li>
        </ol>
        <Button
          variant="outline"
          onClick={() =>
            openProviderSetup("https://discord.com/developers/applications")
          }
        >
          {t("pagesAppsChatChatEndpointSetup.discord.openPortal")} <ExternalLink />
        </Button>
        {field("applicationId", t("pagesAppsChatChatEndpointSetup.discord.applicationId"), "text")}
        {field("guildId", t("pagesAppsChatChatEndpointSetup.discord.serverId"), "text")}
        {field("botToken", t("pagesAppsChatChatEndpointSetup.botToken"))}
        {installUrl && (
          <Button asChild variant="outline">
            <a href={installUrl} target="_blank" rel="noreferrer">
              {t("pagesAppsChatChatEndpointSetup.discord.installBot")} <ExternalLink />
            </a>
          </Button>
        )}
        <p className="text-sm text-muted-foreground">
          {t("pagesAppsChatChatEndpointSetup.discord.permissionsNote")}
        </p>
        <Button
          disabled={
            (!repairing &&
              (!credentials.applicationId ||
                !credentials.guildId ||
                !credentials.botToken)) ||
            pending
          }
          onClick={() =>
            onAction(repairing ? "reconnect" : "configure", credentials)
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {repairing ? t("pagesAppsChatChatEndpointSetup.discord.reconnect") : t("pagesAppsChatChatEndpointSetup.discord.connect")}
        </Button>
      </div>
    );
  }
  if (provider === "telegram")
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">{t("pagesAppsChatChatEndpointSetup.telegram.title", { agent: agentName })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {repairing
              ? t("pagesAppsChatChatEndpointSetup.telegram.reconnectDescription")
              : t("pagesAppsChatChatEndpointSetup.telegram.description")}
          </p>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            {t("pagesAppsChatChatEndpointSetup.telegram.steps.openAndSend")} <code>/newbot</code>.
          </li>
          <li>{t("pagesAppsChatChatEndpointSetup.telegram.steps.displayName")}</li>
          <li>
            {t("pagesAppsChatChatEndpointSetup.telegram.steps.username")} <code>bot</code>.
          </li>
        </ol>
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {t("pagesAppsChatChatEndpointSetup.telegram.privacyNote")}{" "}
          <code>/task@bot_username &lt;request&gt;</code>{t("pagesAppsChatChatEndpointSetup.telegram.privacyNoteEnd")}
        </p>
        <Button
          variant="outline"
          onClick={() => openProviderSetup("https://t.me/BotFather")}
        >
          {t("pagesAppsChatChatEndpointSetup.telegram.openBotFather")} <ExternalLink />
        </Button>
        {field("botToken", t("pagesAppsChatChatEndpointSetup.botToken"))}
        {(!endpoint.setup?.webhookUrl || automaticSlack && !endpoint.setup?.slackOAuthCallbackUri?.startsWith("https://")) && (
          <p className="text-sm text-destructive">
            {t("pagesAppsChatChatEndpointSetup.httpsBeforeConnecting", { provider: "Telegram" })}
          </p>
        )}
        <Button
          disabled={
            (!repairing && !credentials.botToken) ||
            !endpoint.setup?.webhookUrl ||
            pending
          }
          onClick={() =>
            onAction(repairing ? "reconnect" : "configure", credentials)
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {repairing ? t("pagesAppsChatChatEndpointSetup.telegram.reconnect") : t("pagesAppsChatChatEndpointSetup.telegram.connect")}
        </Button>
      </div>
    );
  if (provider === "microsoft-teams")
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">
            {t("pagesAppsChatChatEndpointSetup.teams.title", { agent: agentName })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {repairing
              ? t("pagesAppsChatChatEndpointSetup.teams.reconnectDescription")
              : t("pagesAppsChatChatEndpointSetup.teams.description")}
          </p>
        </div>
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {t("pagesAppsChatChatEndpointSetup.teams.requirements")}
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>{t("pagesAppsChatChatEndpointSetup.teams.steps.entra")}</li>
          <li>{t("pagesAppsChatChatEndpointSetup.teams.steps.azure")}</li>
          <li>{t("pagesAppsChatChatEndpointSetup.teams.steps.portal")}</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a
              href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
              target="_blank"
              rel="noreferrer"
            >
              {t("pagesAppsChatChatEndpointSetup.teams.openEntra")} <ExternalLink />
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href="https://portal.azure.com/#create/Microsoft.AzureBot"
              target="_blank"
              rel="noreferrer"
            >
              {t("pagesAppsChatChatEndpointSetup.teams.createAzureBot")} <ExternalLink />
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href="https://dev.teams.microsoft.com/apps"
              target="_blank"
              rel="noreferrer"
            >
              {t("pagesAppsChatChatEndpointSetup.teams.openPortal")} <ExternalLink />
            </a>
          </Button>
        </div>
        {endpointValue(
          t("pagesAppsChatChatEndpointSetup.teams.messagingEndpoint"),
          endpoint.setup?.messagingEndpoint,
        )}
        {field("clientId", t("pagesAppsChatChatEndpointSetup.teams.clientId"), "text")}
        {field("tenantId", t("pagesAppsChatChatEndpointSetup.teams.tenantId"), "text")}
        {field("clientSecret", t("pagesAppsChatChatEndpointSetup.teams.clientSecret"))}
        <section className="space-y-3 rounded-lg border border-border p-4">
          <div>
            <h2 className="text-sm font-semibold">
              {t("pagesAppsChatChatEndpointSetup.teams.fieldMap.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("pagesAppsChatChatEndpointSetup.teams.fieldMap.description")}
            </p>
          </div>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              <strong>Microsoft Entra admin center · App registrations</strong>:{" "}
              {t("pagesAppsChatChatEndpointSetup.teams.fieldMap.select")}{" "}<strong>New registration</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.entra.choose")}{" "}
              <strong>Accounts in this organizational directory only (Single tenant)</strong>
              {t("pagesAppsChatChatEndpointSetup.teams.fieldMap.entra.thenSelect")}{" "}<strong>Register</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.entra.copy")}{" "}
              <strong>Application (client) ID</strong>{" "}{t("pagesAppsChatChatEndpointSetup.and")}{" "}
              <strong>Directory (tenant) ID</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.under")}{" "}
              <strong>Certificates &amp; secrets · Client secrets</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.entra.selectNew")}{" "}
              <strong>New client secret</strong>{" "}{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.entra.copyIts")}{" "}
              <strong>Value</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.entra.notSecretId")}
            </li>
            <li>
              <strong>Azure · Create Azure Bot</strong>:{" "}{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.azure.set")}{" "}
              <strong>Microsoft App ID</strong>{" "}{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.azure.to")}{" "}
              <strong>Single Tenant</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.azure.setAgain")}{" "}<strong>Creation type</strong>{" "}
              {t("pagesAppsChatChatEndpointSetup.teams.fieldMap.azure.to")}{" "}<strong>Use existing app registration</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.azure.enterIds")}{" "}
              <strong>Settings · Configuration</strong>{" "}{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.azure.pasteEndpoint")}{" "}
              <strong>Messaging endpoint</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.azure.thenOpen")}{" "}
              <strong>Settings · Channels</strong>{" "}{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.azure.enable")}{" "}
              <strong>Microsoft Teams</strong>.
            </li>
            <li>
              <strong>Teams Developer Portal · Apps</strong>:{" "}{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.select")}{" "}
              <strong>New app</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.under")}{" "}
              <strong>Configure · App features · Bot</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.portal.addBot")}{" "}
              <strong>Personal</strong>, <strong>Team</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.portal.commaAnd")}{" "}
              <strong>Group chat</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.portal.scopes")}{" "}
              <strong>Configure · Permissions</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.portal.addRsc")}{" "}
              <strong>Application</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.portal.complete")}
            </li>
            <li>
              <strong>Microsoft Teams · Apps · Manage your apps</strong>:{" "}{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.select")}{" "}
              <strong>Upload an app · Upload a custom app</strong>{t("pagesAppsChatChatEndpointSetup.teams.fieldMap.upload.rest")}
            </li>
          </ol>
        </section>
        <label className="grid gap-2 text-sm font-medium">
          {t("pagesAppsChatChatEndpointSetup.teams.manifestBlock")}
          <Textarea
            className="min-h-80 font-mono text-xs"
            readOnly
            value={teamsManifestSettings}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!credentials.clientId?.trim()}
            onClick={() => {
              void copyTextToClipboard(teamsManifestSettings).then(
                () => setManifestCopied(true),
                reportCopyFailure,
              );
            }}
          >
            {manifestCopied
              ? t("pagesAppsChatChatEndpointSetup.teams.manifestCopied")
              : t("pagesAppsChatChatEndpointSetup.teams.copyManifest")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("pagesAppsChatChatEndpointSetup.teams.manifestNote")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("pagesAppsChatChatEndpointSetup.teams.ssoNote")}{" "}<code>webApplicationInfo</code>{" "}
          {t("pagesAppsChatChatEndpointSetup.teams.ssoNoteEnd")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("pagesAppsChatChatEndpointSetup.teams.rscNote")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("pagesAppsChatChatEndpointSetup.teams.scopeNote")}{" "}<code>supportsFiles: true</code>{" "}
          {t("pagesAppsChatChatEndpointSetup.teams.scopeNoteEnd")}
        </p>
        {!endpoint.setup?.messagingEndpoint && (
          <p className="text-sm text-destructive">
            {t("pagesAppsChatChatEndpointSetup.httpsBeforeConnecting", { provider: "Microsoft Teams" })}
          </p>
        )}
        <Button
          disabled={
            (!repairing &&
              (!credentials.clientId ||
                !credentials.tenantId ||
                !credentials.clientSecret)) ||
            !endpoint.setup?.messagingEndpoint ||
            pending
          }
          onClick={() =>
            onAction(repairing ? "reconnect" : "configure", credentials)
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {repairing
            ? t("pagesAppsChatChatEndpointSetup.teams.reconnect")
            : t("pagesAppsChatChatEndpointSetup.teams.verify")}
        </Button>
      </div>
    );
  if (provider === "github")
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">
            {repairing
              ? t("pagesAppsChatChatEndpointSetup.github.reconnectTitle")
              : t("pagesAppsChatChatEndpointSetup.github.createTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {repairing
              ? t("pagesAppsChatChatEndpointSetup.github.reconnectDescription")
              : t("pagesAppsChatChatEndpointSetup.github.description")}
          </p>
        </div>
        {!repairing && (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>{t("pagesAppsChatChatEndpointSetup.github.steps.create")}</li>
            <li>
              {t("pagesAppsChatChatEndpointSetup.github.steps.keep")}{" "}<strong>Webhooks · Active</strong>{t("pagesAppsChatChatEndpointSetup.github.steps.webhookOn")}{" "}
              <strong>Enable SSL verification</strong>{t("pagesAppsChatChatEndpointSetup.github.steps.selected")}
            </li>
            <li>
              {t("pagesAppsChatChatEndpointSetup.github.steps.underRepo")}{" "}<strong>Issues</strong>{" "}{t("pagesAppsChatChatEndpointSetup.and")}{" "}
              <strong>Pull requests</strong>{" "}{t("pagesAppsChatChatEndpointSetup.github.steps.to")}{" "}
              <strong>Read &amp; write</strong>{t("pagesAppsChatChatEndpointSetup.github.steps.leaveDefault")}
            </li>
            <li>
              {t("pagesAppsChatChatEndpointSetup.github.steps.subscribe")}{" "}<strong>Issue comment</strong> (
              <code>issue_comment</code>),{" "}
              <strong>Pull request review comment</strong> (
              <code>pull_request_review_comment</code>){t("pagesAppsChatChatEndpointSetup.github.steps.githubSends")}{" "}
              <code>installation</code>{" "}{t("pagesAppsChatChatEndpointSetup.and")}{" "}
              <code>installation_repositories</code>{t("pagesAppsChatChatEndpointSetup.github.steps.toEveryApp")}
            </li>
            <li>
              {t("pagesAppsChatChatEndpointSetup.github.steps.choose")}{" "}<strong>Only on this account</strong>{t("pagesAppsChatChatEndpointSetup.github.steps.install")}
            </li>
          </ol>
        )}
        {endpointValue(
          t("pagesAppsChatChatEndpointSetup.github.homepageUrl"),
          publicOrigin(endpoint.setup?.webhookUrl),
        )}
        {endpointValue(t("pagesAppsChatChatEndpointSetup.paperclipWebhookUrl"), endpoint.setup?.webhookUrl)}
        <Button
          variant="outline"
          onClick={() =>
            window.open(
              repairing
                ? "https://github.com/settings/apps"
                : (endpoint.setup?.authorizationUrl ??
                    "https://github.com/settings/apps/new"),
              "_blank",
              "noopener,noreferrer",
            )
          }
        >
          {repairing ? t("pagesAppsChatChatEndpointSetup.github.openSettings") : t("pagesAppsChatChatEndpointSetup.github.openNewForm")}{" "}
          <ExternalLink />
        </Button>
        {field("appId", t("pagesAppsChatChatEndpointSetup.github.appId"), "text")}
        <div className="grid gap-2 text-sm font-medium">
          <label htmlFor="github-private-key">{t("pagesAppsChatChatEndpointSetup.github.privateKey")}</label>
          <div className="relative">
            {privateKeyVisible ? (
              <Textarea
                id="github-private-key"
                className="min-h-24 pr-11 font-mono text-xs"
                value={credentials.privateKey ?? ""}
                onChange={(event) => replacePrivateKey(event.target.value)}
              />
            ) : (
              <Input
                id="github-private-key"
                type="password"
                className="pr-11 font-mono text-xs"
                value={credentials.privateKey ?? ""}
                onChange={(event) => replacePrivateKey(event.target.value)}
                onPaste={(event) => {
                  event.preventDefault();
                  replacePrivateKey(event.clipboardData.getData("text"));
                }}
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1"
              aria-label={
                privateKeyVisible ? t("pagesAppsChatChatEndpointSetup.github.hidePrivateKey") : t("pagesAppsChatChatEndpointSetup.github.showPrivateKey")
              }
              onClick={() => setPrivateKeyVisible((visible) => !visible)}
            >
              {privateKeyVisible ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <input
            ref={privateKeyFileInputRef}
            type="file"
            accept=".pem,.key,application/x-pem-file,application/pkcs8,text/plain"
            className="hidden"
            aria-label={t("pagesAppsChatChatEndpointSetup.github.choosePrivateKeyFile")}
            onChange={loadPrivateKeyFile}
          />
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => privateKeyFileInputRef.current?.click()}
            >
              {t("pagesAppsChatChatEndpointSetup.github.choosePemFile")}
            </Button>
          </div>
          {privateKeyFileError ? (
            <p role="alert" className="text-sm text-destructive">
              {privateKeyFileError}
            </p>
          ) : null}
          {privateKeyFileLoading ? (
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              {t("pagesAppsChatChatEndpointSetup.github.readingPrivateKey")}
            </p>
          ) : privateKeyFileLoaded ? (
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              {t("pagesAppsChatChatEndpointSetup.github.privateKeyLoaded")}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium">{t("pagesAppsChatChatEndpointSetup.github.webhookSecret")}</p>
          {generatedWebhookSecret ? (
            <>
              <Input
                aria-label={t("pagesAppsChatChatEndpointSetup.github.generatedWebhookSecret")}
                className="font-mono text-xs"
                readOnly
                value={generatedWebhookSecret}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // Both signals, and each covers the other's blind spot.
                    // The toast is the loud one, the way this step's other two
                    // copy buttons report failure — but the provider dedupes an
                    // identical toast inside 3.5s, so a reader who clicks twice
                    // on a blocked clipboard would see nothing the second time.
                    // The inline state answers every click.
                    void webhookSecretCopy
                      .copy(generatedWebhookSecret)
                      .then((status) => {
                        if (status === "failed") reportCopyFailure();
                      });
                  }}
                >
                  {webhookSecretCopy.copied
                    ? t("pagesAppsChatChatEndpointSetup.github.webhookSecretCopied")
                    : webhookSecretCopy.failed
                      ? t("pagesAppsChatChatEndpointSetup.github.copyFailedInline")
                      : t("pagesAppsChatChatEndpointSetup.github.copyWebhookSecret")}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("pagesAppsChatChatEndpointSetup.github.copyNow")}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {endpoint.setup?.webhookSecretConfigured
                ? t("pagesAppsChatChatEndpointSetup.github.secretConfigured")
                : t("pagesAppsChatChatEndpointSetup.github.generateHint")}
            </p>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={generatingSetupSecret}
              onClick={onGenerateSetupSecret}
            >
              {generatingSetupSecret && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {endpoint.setup?.webhookSecretConfigured
                ? t("pagesAppsChatChatEndpointSetup.github.regenerateSecret")
                : t("pagesAppsChatChatEndpointSetup.github.generateSecret")}
            </Button>
          </div>
          {endpoint.setup?.webhookSecretConfigured && (
            <p className="text-sm text-muted-foreground">
              {endpoint.providerAccountId || endpoint.botExternalId
                ? t("pagesAppsChatChatEndpointSetup.github.regenerateWarning")
                : t("pagesAppsChatChatEndpointSetup.github.generateAnotherWarning")}
            </p>
          )}
          {endpoint.setup?.webhookSecretConfigured && (
            <p
              className={`text-sm ${endpoint.setup.webhookVerifiedAt ? "text-foreground" : "text-muted-foreground"}`}
            >
              {endpoint.setup.webhookVerifiedAt
                ? t("pagesAppsChatChatEndpointSetup.github.webhookVerified")
                : t("pagesAppsChatChatEndpointSetup.github.waitingForPing")}
            </p>
          )}
        </div>
        {(!endpoint.setup?.webhookUrl || automaticSlack && !endpoint.setup?.slackOAuthCallbackUri?.startsWith("https://")) && (
          <p className="text-sm text-destructive">
            {t("pagesAppsChatChatEndpointSetup.httpsBeforeConnecting", { provider: "GitHub" })}
          </p>
        )}
        <Button
          disabled={
            (!repairing && (!credentials.appId || !credentials.privateKey)) ||
            !endpoint.setup?.webhookSecretConfigured ||
            !endpoint.setup?.webhookVerifiedAt ||
            !endpoint.setup?.webhookUrl ||
            privateKeyFileLoading ||
            generatingSetupSecret ||
            pending
          }
          onClick={() =>
            onAction(repairing ? "reconnect" : "configure", credentials)
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {repairing ? t("pagesAppsChatChatEndpointSetup.github.reconnectAndVerify") : t("pagesAppsChatChatEndpointSetup.github.connectAndVerify")}
        </Button>
      </div>
    );
  const slackRequestUrlInstructions = <ol className="list-decimal space-y-2 pl-5 text-sm">
      <li><a className="underline underline-offset-4" href={endpoint.setup?.slackRegistration?.appId ? `https://api.slack.com/apps/${encodeURIComponent(endpoint.setup.slackRegistration.appId)}/event-subscriptions` : "https://api.slack.com/apps"} target="_blank" rel="noopener noreferrer">{t("pagesAppsChatChatEndpointSetup.slack.openAppSettings")} <ExternalLink className="inline size-3" /></a>{" "}{t("pagesAppsChatChatEndpointSetup.slack.andChoose")}{" "}<strong>{slackApp.appName}</strong>.</li>
      <li>{t("pagesAppsChatChatEndpointSetup.slack.choose")}{" "}<strong>Event Subscriptions</strong>.</li>
      <li>{t("pagesAppsChatChatEndpointSetup.slack.besidePrefilled")}{" "}<strong>Request URL</strong>{t("pagesAppsChatChatEndpointSetup.slack.click")}{" "}<strong>Retry</strong>{" "}{t("pagesAppsChatChatEndpointSetup.slack.ifNotVerified")}</li>
    </ol>;
  if (slackStage === "finish")
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">{automaticSlack ? t("pagesAppsChatChatEndpointSetup.slack.sendMessageToAgent") : t("pagesAppsChatChatEndpointSetup.slack.verifyConnection")}</h1>
          {!automaticSlack && <p className="mt-1 text-sm text-muted-foreground">{t("pagesAppsChatChatEndpointSetup.slack.confirmReach")}</p>}
        </div>
        {automaticSlack ? <Button asChild variant="outline"><a href={slackConversationUrl(endpoint, identitySettled ? userId : null)} target="_blank" rel="noopener noreferrer">{t("pagesAppsChatChatEndpointSetup.openSlack")} <ExternalLink className="size-4" /></a></Button> : slackRequestUrlInstructions}
        {endpoint.setup?.webhookVerifiedAt ? (
          <p role="status" className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-(--status-task-done)" />
            {t("pagesAppsChatChatEndpointSetup.slack.connectionWorking")}{pending ? automaticSlack ? t("pagesAppsChatChatEndpointSetup.slack.finishingSetup") : t("pagesAppsChatChatEndpointSetup.slack.openingMessageTest") : ""}
          </p>
        ) : slackVerificationError ? (
          <p role="alert" className="text-sm text-destructive">{t("pagesAppsChatChatEndpointSetup.slack.checkVerificationFailed")}</p>
        ) : (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {automaticSlack ? t("pagesAppsChatChatEndpointSetup.slack.waitingForMessage") : t("pagesAppsChatChatEndpointSetup.slack.waitingForSlack")}
          </p>
        )}
        <SlackSetupAdvanced label={automaticSlack ? t("pagesAppsChatChatEndpointSetup.slack.didntWork") : t("pagesAppsChatChatEndpointSetup.slack.troubleshooting")}>
          {automaticSlack && slackRequestUrlInstructions}
          <p className="text-muted-foreground">{t("pagesAppsChatChatEndpointSetup.slack.troubleshootingHelp")}</p>
          {endpointValue(t("pagesAppsChatChatEndpointSetup.paperclipWebhookUrl"), endpoint.setup?.webhookUrl)}
        </SlackSetupAdvanced>
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" className="text-muted-foreground" onClick={() => navigate("/apps")}>{t("pagesAppsChatChatEndpointSetup.saveAndExit")}</Button>
          {(!automaticSlack || endpoint.setup?.webhookVerifiedAt) && <Button disabled={pending || !endpoint.setup?.webhookVerifiedAt} onClick={() =>
            endpoint.setup?.step === "provider_setup" ? onAction("verify") : onSlackVerificationContinue()
          }>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {t("pagesAppsChatChatEndpointSetup.continue")}
          </Button>}
        </div>
      </div>
    );

  return (
    <div className="space-y-5">
      {(!endpoint.setup?.webhookUrl || automaticSlack && !endpoint.setup?.slackOAuthCallbackUri?.startsWith("https://")) && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertTriangle className="size-5 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">{t("pagesAppsChatChatEndpointSetup.slack.httpsRequired")}</p>
            <p className="text-sm">
              {t("pagesAppsChatChatEndpointSetup.slack.httpsRequiredDescription")}
            </p>
            <a
              href="https://docs.paperclip.ing/reference/deploy/https/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline underline-offset-4"
            >
              {t("pagesAppsChatChatEndpointSetup.slack.learnHttps")}
            </a>
          </div>
        </div>
      )}
      <div>
        <h1 className="text-xl font-bold">{endpoint.setup?.slackSetupMethod === "managed" ? t("pagesAppsChatChatEndpointSetup.slack.titles.connect") : slackStage === "app" ? automaticSlack ? t("pagesAppsChatChatEndpointSetup.slack.titles.configToken") : t("pagesAppsChatChatEndpointSetup.slack.titles.createApp") : automaticSlack ? t("pagesAppsChatChatEndpointSetup.slack.titles.installApp") : t("pagesAppsChatChatEndpointSetup.slack.titles.addCredentials")}</h1>
        {repairing && !automaticSlack && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("pagesAppsChatChatEndpointSetup.slack.reconnectDescription")}
          </p>
        )}
      </div>
      <div hidden={slackStage !== "app" || automaticSlack} className="space-y-5">
        <div className="space-y-3 text-sm">
          <div className="flex justify-end">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground underline underline-offset-4">
                  {t("pagesAppsChatChatEndpointSetup.slack.viewManifest")}
                </Button>
              </DialogTrigger>
              <DialogContent className={cn("sm:max-w-2xl", ANALYTICS_MASK_CLASS)}>
                <DialogHeader>
                  <DialogTitle>{t("pagesAppsChatChatEndpointSetup.slack.manifestTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("pagesAppsChatChatEndpointSetup.slack.manifestDescription")}
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  aria-label={t("pagesAppsChatChatEndpointSetup.slack.manifestTitle")}
                  className="h-80 font-mono text-xs"
                  readOnly
                  value={slackManifest}
                />
                <DialogFooter>
                  <Button
                    variant="outline"
                    disabled={!slackValidation.success}
                    onClick={() => {
                      void copyTextToClipboard(slackManifest).then(
                        () => setManifestCopied(true),
                        reportCopyFailure,
                      );
                    }}
                  >
                    {manifestCopied ? t("pagesAppsChatChatEndpointSetup.slack.manifestCopied") : t("pagesAppsChatChatEndpointSetup.slack.copyManifest")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {!automaticSlack && <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
          <Button variant="ghost" className="text-muted-foreground" onClick={() => void saveSlackAndExit()}>
            {t("pagesAppsChatChatEndpointSetup.saveAndExit")}
          </Button>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" disabled={openingSlackApp || !endpoint.setup?.webhookUrl || !slackValidation.success} onClick={onSlackAppCreated}>
              {t("pagesAppsChatChatEndpointSetup.slack.alreadyCreated")}
            </Button>
            {!repairing && (
              <Button
                disabled={openingSlackApp || !endpoint.setup?.webhookUrl || !slackValidation.success}
                onClick={() => {
                  window.open(slackCreateUrl, "_blank", "noopener,noreferrer");
                  setOpeningSlackApp(true);
                  // Let Slack open before changing the step behind its new tab.
                  slackAdvanceTimer.current = setTimeout(() => {
                    slackAdvanceTimer.current = null;
                    setOpeningSlackApp(false);
                    onSlackAppCreated();
                  }, 1000);
                }}
              >
                {t("pagesAppsChatChatEndpointSetup.slack.createApp")} <ExternalLink />
              </Button>
            )}
          </div>
        </div>}
      </div>
      {automaticSlack && <SlackSetup
        key={endpoint.id}
        autoStart={managedAutoStart}
        reconnect={repairing}
        endpoint={endpoint} stage={slackStage} disabled={!endpoint.setup?.webhookUrl || !endpoint.setup?.slackOAuthCallbackUri?.startsWith("https://") || !slackValidation.success}
        saveDetails={async () => {}}
        onBusy={onAutomaticBusy} onSaved={onEndpointSaved} onContinue={onSlackAppCreated}
        onManual={async existing => {
          onEndpointSaved(await chatEndpointsApi.update(endpoint.id, { slackSetupMethod: existing ? "existing" : "manual" }));
          if (existing) onSlackAppCreated();
        }}
        onSaveExit={() => void saveSlackAndExit()}
      />}
      {!automaticSlack && <div hidden={slackStage !== "credentials"} className="space-y-5">
        <p className="text-sm">
          {t("pagesAppsChatChatEndpointSetup.slack.findTwoSecrets")}
        </p>
        {slackCredentialsSaved && !repairing && (
          <p className="text-sm text-muted-foreground">{t("pagesAppsChatChatEndpointSetup.slack.credentialsSaved")}</p>
        )}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold"><label htmlFor="slack-bot-token">Bot User OAuth Token</label></h2>
          <ul id="slack-bot-token-help" className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                {t("pagesAppsChatChatEndpointSetup.slack.openAppSettings")} <ExternalLink className="inline size-3" />
              </a>{" "}{t("pagesAppsChatChatEndpointSetup.slack.andChoose")}{" "}<strong>{slackApp.appName}</strong>.
            </li>
            <li>{t("pagesAppsChatChatEndpointSetup.slack.choose")}{" "}<strong>OAuth &amp; Permissions</strong></li>
            <li>{t("pagesAppsChatChatEndpointSetup.slack.copyAndPaste")}{" "}<strong>Bot OAuth Token</strong></li>
          </ul>
          <Input
            id="slack-bot-token"
            type="password"
            placeholder={slackCredentialsSaved ? t("pagesAppsChatChatEndpointSetup.slack.savedPlaceholder") : undefined}
            value={credentials.botToken ?? ""}
            aria-invalid={slackBotTokenInvalid || undefined}
            aria-describedby={`slack-bot-token-help${slackBotTokenInvalid ? " slack-bot-token-warning" : ""}`}
            onChange={(event) => setCredentials({ ...credentials, botToken: event.target.value })}
          />
          {slackBotTokenInvalid && (
            <p id="slack-bot-token-warning" role="alert" className="text-sm text-destructive">
              {t("pagesAppsChatChatEndpointSetup.slack.botTokenPrefixWarning")}{" "}<code>xoxb-</code>{t("pagesAppsChatChatEndpointSetup.slack.copyItFrom")}{" "}<strong>OAuth &amp; Permissions</strong>.
            </p>
          )}
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold"><label htmlFor="slack-signing-secret">Signing Secret</label></h2>
          <ul id="slack-signing-secret-help" className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                {t("pagesAppsChatChatEndpointSetup.slack.openAppSettings")} <ExternalLink className="inline size-3" />
              </a>{" "}{t("pagesAppsChatChatEndpointSetup.slack.andChoose")}{" "}<strong>{slackApp.appName}</strong>.
            </li>
            <li>{t("pagesAppsChatChatEndpointSetup.slack.choose")}{" "}<strong>Basic Information</strong></li>
            <li>{t("pagesAppsChatChatEndpointSetup.slack.copyAndPaste")}{" "}<strong>Signing Secret</strong></li>
          </ul>
          <Input
            id="slack-signing-secret"
            type="password"
            placeholder={slackCredentialsSaved ? t("pagesAppsChatChatEndpointSetup.slack.savedPlaceholder") : undefined}
            value={credentials.signingSecret ?? ""}
            aria-invalid={slackSigningSecretHasTokenPrefix || undefined}
            aria-describedby={`slack-signing-secret-help${slackSigningSecretHasTokenPrefix ? " slack-signing-secret-warning" : ""}`}
            onChange={(event) => setCredentials({ ...credentials, signingSecret: event.target.value })}
          />
          {slackSigningSecretHasTokenPrefix && (
            <p id="slack-signing-secret-warning" role="alert" className="text-sm text-destructive">
              {t("pagesAppsChatChatEndpointSetup.slack.useThe")}{" "}<strong>Signing Secret</strong>{t("pagesAppsChatChatEndpointSetup.slack.signingSecretWarning")}
            </p>
          )}
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="text-muted-foreground" onClick={() => navigate("/apps")}>
            {t("pagesAppsChatChatEndpointSetup.saveAndExit")}
          </Button>
          <Button
            className="ml-auto"
            disabled={
              (!repairing && !slackCredentialsSaved && (!slackBotToken || !credentials.signingSecret?.trim())) ||
              !endpoint.setup?.webhookUrl || !slackValidation.success ||
              pending || slackSigningSecretHasTokenPrefix || slackBotTokenInvalid
            }
            onClick={() => continueWithSavedSlackCredentials
              ? onSlackCredentialsContinue()
              : onAction(repairing || slackCredentialsSaved ? "reconnect" : "configure", credentials)}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {continueWithSavedSlackCredentials ? t("pagesAppsChatChatEndpointSetup.continue") : repairing || slackCredentialsSaved ? t("pagesAppsChatChatEndpointSetup.slack.reconnectApp") : t("pagesAppsChatChatEndpointSetup.slack.connectApp")}
          </Button>
        </div>
      </div>}
    </div>
  );
}

function TryStep({
  endpointId,
  provider,
  agentName,
  botLabel,
  botUsername,
  slackAccount,
  photonAllocation,
  providerUrl,
  guestIsolationState,
  pending,
  onOpenAccess,
  onTest,
  onSaveExit,
}: {
  endpointId: string;
  provider: ChatProvider;
  agentName: string;
  botLabel?: string | null;
  botUsername?: string | null;
  slackAccount?: import("@paperclipai/shared").SlackAccountState;
  photonAllocation?: "dedicated" | "shared";
  providerUrl?: string | null;
  guestIsolationState: "loading" | "enabled" | "disabled" | "unknown";
  pending: boolean;
  onOpenAccess: () => void;
  onTest: () => void;
  onSaveExit: () => void;
}) {
  const [commandCopied, setCommandCopied] = useState(false);
  const [commandCopyError, setCommandCopyError] = useState(false);
  const principalsQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.principals(endpointId),
    queryFn: () => chatEndpointsApi.listPrincipals(endpointId),
    enabled: provider !== "slack",
    refetchInterval: 1_500,
  });
  const principalsView = useQueryView(principalsQuery);
  const principalsLoaded = principalsView.kind === "ready" || principalsView.kind === "stale";
  const principalsFailed = principalsView.kind === "error";
  const [numberCopied, setNumberCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const identities = principalsQuery.data ?? [];
  const unlinkedIdentities = identities.filter(
    (identity) => identity.status !== "linked",
  );
  const freshConversationInstruction =
    provider === "imessage-photon" ? t("pagesAppsChatChatEndpointSetup.try.fresh.photon") : provider === "telegram"
      ? t("pagesAppsChatChatEndpointSetup.try.fresh.telegram")
      : provider === "github"
        ? t("pagesAppsChatChatEndpointSetup.try.fresh.github")
        : provider === "microsoft-teams"
          ? t("pagesAppsChatChatEndpointSetup.try.fresh.teams")
          : t("pagesAppsChatChatEndpointSetup.try.fresh.other");
  const identityGuidance = provider === "slack" ? null : provider === "imessage-photon" && principalsLoaded && (identities.length === 0 || unlinkedIdentities.length > 0)
    ? { tone: "info" as const, title: t("pagesAppsChatChatEndpointSetup.try.identity.photon.title"), body: t("pagesAppsChatChatEndpointSetup.try.identity.photon.body") }
    : principalsFailed
    ? {
        tone: "warning" as const,
        title: t("pagesAppsChatChatEndpointSetup.try.identity.checkFailed.title"),
        body: t("pagesAppsChatChatEndpointSetup.try.identity.checkFailed.body", { instruction: freshConversationInstruction }),
      }
    : !principalsLoaded || guestIsolationState === "loading"
      ? null
      : identities.length === 0
        ? guestIsolationState === "disabled"
          ? {
              tone: "warning" as const,
              title: t("pagesAppsChatChatEndpointSetup.try.identity.linkTesting.title"),
              body:
                provider === "telegram"
                  ? t("pagesAppsChatChatEndpointSetup.try.identity.linkTesting.telegramBody")
                  : t("pagesAppsChatChatEndpointSetup.try.identity.linkTesting.body", { provider: providerNames[provider], agent: agentName, instruction: freshConversationInstruction }),
            }
          : {
              tone: "info" as const,
              title: t("pagesAppsChatChatEndpointSetup.try.identity.firstMessage.title"),
              body:
                provider === "telegram"
                  ? t("pagesAppsChatChatEndpointSetup.try.identity.firstMessage.telegramBody")
                  : t("pagesAppsChatChatEndpointSetup.try.identity.firstMessage.body", { instruction: freshConversationInstruction }),
            }
        : unlinkedIdentities.length > 0
          ? guestIsolationState === "disabled"
            ? {
                tone: "warning" as const,
                title: t("pagesAppsChatChatEndpointSetup.try.identity.linkTesting.title"),
                body: t("pagesAppsChatChatEndpointSetup.try.identity.unlinkedOff.body", { agent: agentName, instruction: freshConversationInstruction }),
              }
            : {
                tone: "info" as const,
                title: t("pagesAppsChatChatEndpointSetup.try.identity.unlinked.title"),
                body: t("pagesAppsChatChatEndpointSetup.try.identity.unlinked.body", { instruction: freshConversationInstruction }),
              }
          : null;
  const providerBotUsername = botUsername?.replace(/^@/, "");
  const normalizedBotUsername =
    provider === "github"
      ? providerBotUsername?.replace(/\[bot\]$/i, "")
      : providerBotUsername;
  const botMention = normalizedBotUsername
    ? `@${normalizedBotUsername}`
    : (botLabel ?? agentName);
  const slackTestMessage = slackAccount?.status === "linked" ? t("pagesAppsChatChatEndpointSetup.try.slack.testMessage") : `${botMention.startsWith("@") ? botMention : `@${botMention}`} ${t("pagesAppsChatChatEndpointSetup.try.slack.testMessage")}`;
  const instructions =
    provider === "imessage-photon" ? [
      photonAllocation === "shared" ? t("pagesAppsChatChatEndpointSetup.try.photon.sharedEnroll") : t("pagesAppsChatChatEndpointSetup.try.photon.openMessages", { target: botUsername ?? botLabel ?? t("pagesAppsChatChatEndpointSetup.try.photon.dedicatedNumber") }),
      t("pagesAppsChatChatEndpointSetup.try.photon.linkSender"),
      t("pagesAppsChatChatEndpointSetup.try.photon.waitForReply"),
      ...(photonAllocation === "shared" ? [t("pagesAppsChatChatEndpointSetup.try.photon.dmsOnly")] : [t("pagesAppsChatChatEndpointSetup.try.photon.group")]),
    ] : provider === "discord"
      ? [
          t("pagesAppsChatChatEndpointSetup.try.discord.openChannel"),
          t("pagesAppsChatChatEndpointSetup.try.discord.mention", { bot: botMention }),
          t("pagesAppsChatChatEndpointSetup.try.discord.reply", { agent: agentName }),
        ]
      : provider === "telegram"
        ? [
            t("pagesAppsChatChatEndpointSetup.try.telegram.openChat"),
            t("pagesAppsChatChatEndpointSetup.try.telegram.tapStart"),
            t("pagesAppsChatChatEndpointSetup.try.telegram.send"),
          ]
        : provider === "github"
          ? [
              t("pagesAppsChatChatEndpointSetup.try.github.open"),
              t("pagesAppsChatChatEndpointSetup.try.github.mention", { bot: botMention }),
              t("pagesAppsChatChatEndpointSetup.try.github.continue"),
            ]
          : provider === "microsoft-teams"
            ? [
                t("pagesAppsChatChatEndpointSetup.try.teams.open"),
                t("pagesAppsChatChatEndpointSetup.try.teams.mention", { bot: botMention }),
                t("pagesAppsChatChatEndpointSetup.try.teams.reply"),
              ]
            : [
                t("pagesAppsChatChatEndpointSetup.try.slack.invite", { bot: botMention }),
                t("pagesAppsChatChatEndpointSetup.try.slack.mention", { bot: botMention }),
                t("pagesAppsChatChatEndpointSetup.try.slack.reply", { agent: agentName }),
              ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">
          {t("pagesAppsChatChatEndpointSetup.try.title", { agent: agentName, provider: providerNames[provider] })}
        </h1>
        {provider !== "slack" && <p className="mt-1 text-sm text-muted-foreground">
          {t("pagesAppsChatChatEndpointSetup.try.description")}
        </p>}
      </div>
      {provider !== "slack" && (!principalsLoaded || guestIsolationState === "loading") &&
      !principalsFailed ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("pagesAppsChatChatEndpointSetup.try.checkingReadiness")}
        </p>
      ) : null}
      {identityGuidance ? (
        <div
          role={identityGuidance.tone === "warning" ? "alert" : "status"}
          className={
            identityGuidance.tone === "warning"
              ? "rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"
              : "rounded-lg border border-border bg-muted/30 p-4 text-sm"
          }
        >
          <h2 className="font-medium">{identityGuidance.title}</h2>
          <p className="mt-1 text-muted-foreground">{identityGuidance.body}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={onOpenAccess}
          >
            {t("pagesAppsChatChatEndpointSetup.try.reviewAccess")}
          </Button>
        </div>
      ) : null}
      {provider === "imessage-photon" && botUsername && <div className="space-y-2"><Button variant="outline" onClick={() => { void copyTextToClipboard(botUsername).then(() => { setNumberCopied(true); setCopyError(null); }, () => setCopyError(t("pagesAppsChatChatEndpointSetup.try.photon.copyNumberFailed"))); }}>{numberCopied ? t("pagesAppsChatChatEndpointSetup.try.photon.numberCopied") : t("pagesAppsChatChatEndpointSetup.try.photon.copyNumber", { number: botUsername })}</Button>{copyError && <p role="alert" className="text-sm text-destructive">{copyError}</p>}</div>}
      {provider === "slack" ? (
        <>
          <ol className="list-decimal space-y-4 pl-5 text-sm">
            <li>{slackAccount?.status === "linked" ? <Button asChild variant="outline"><a href={providerUrl ?? "https://app.slack.com"} target="_blank" rel="noopener noreferrer">{slackAccount.dmChannelId ? t("pagesAppsChatChatEndpointSetup.try.slack.openDm") : t("pagesAppsChatChatEndpointSetup.openSlack")}<ExternalLink /></a></Button> : <>{t("pagesAppsChatChatEndpointSetup.try.slack.invite", { bot: botMention })}</>}</li>
            <li>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <code>{slackTestMessage}</code>
                <Button size="sm" variant="ghost" onClick={() => {
                  void copyTextToClipboard(slackTestMessage).then(() => { setCommandCopied(true); setCommandCopyError(false); }, () => setCommandCopyError(true));
                }}><Copy className="size-4" />{commandCopied ? t("pagesAppsChatChatEndpointSetup.try.slack.copied") : t("pagesAppsChatChatEndpointSetup.try.slack.copyMessage")}</Button>
              </div>
              {slackAccount?.status !== "linked" && <p className="mt-2 text-muted-foreground">{t("pagesAppsChatChatEndpointSetup.try.slack.selectBot")}</p>}
            </li>
            <li>{t("pagesAppsChatChatEndpointSetup.try.slack.continueThread")}</li>
          </ol>
          {commandCopyError && <p role="alert" className="text-sm text-destructive">{t("pagesAppsChatChatEndpointSetup.try.slack.copyFailed")}</p>}
          <SetupWizardFooter onSaveExit={onSaveExit} disabled={pending}>
            <Button disabled={pending} onClick={onTest}>{pending && <Loader2 className="size-4 animate-spin" />}{t("pagesAppsChatChatEndpointSetup.done")}</Button>
          </SetupWizardFooter>
        </>
      ) : <>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {instructions.map((item) => <li key={item}>{item}</li>)}
      </ol>
      <div className="flex flex-wrap gap-2">
        {providerUrl && (
          <Button asChild variant="outline">
            <a href={providerUrl} target="_blank" rel="noopener noreferrer">
              {t("pagesAppsChatChatEndpointSetup.try.openProvider", { provider: providerNames[provider] })} <ExternalLink />
            </a>
          </Button>
        )}
        <Button disabled={pending} onClick={onTest}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("pagesAppsChatChatEndpointSetup.try.sentTestMessage")}
        </Button>
      </div>
      </>}
    </div>
  );
}
