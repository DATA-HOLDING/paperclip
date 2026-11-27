import { t } from "@/i18n";
import { useAuthorizationWindow } from "@/hooks/useAuthorizationWindow";
import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  SlackSearchStatus,
  SlackToolCapabilities,
} from "@paperclipai/shared";
import { describeError } from "@/api/errors";
import { slackToolsApi } from "@/api/slackTools";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SlackCapabilitiesView({
  capabilities,
  error,
}: {
  capabilities?: SlackToolCapabilities;
  error?: string;
}) {
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("pagesAppsChatSlackToolSettings.capabilities.description")}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!capabilities && !error && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("pagesAppsChatSlackToolSettings.capabilities.checking")}
        </p>
      )}
      {capabilities && (
        <>
          {capabilities.missingScopes.length > 0 && (
            <div className="rounded-lg border border-border bg-muted p-3 space-y-2">
              <p className="text-sm font-medium">
                {t("pagesAppsChatSlackToolSettings.capabilities.addPermissionsTitle")}
              </p>
              <p className="text-sm">
                {t("pagesAppsChatSlackToolSettings.capabilities.missingScopesPrefix")}{" "}
                <a
                  className="underline underline-offset-4"
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("pagesAppsChatSlackToolSettings.capabilities.slackAppSettings")}
                </a>
                {t("pagesAppsChatSlackToolSettings.capabilities.missingScopesSuffix")}
              </p>
              <p className="text-xs font-mono break-words">
                {capabilities.missingScopes.join(", ")}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function SlackSearchView({
  status,
  onConnect,
  onDisconnect,
  onConfigure,
}: {
  status: SlackSearchStatus;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onConfigure: (input: {
    clientId: string;
    clientSecret: string;
  }) => Promise<void>;
}) {
  const id = useId();
  const [clientId, setClientId] = useState(status.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const perform = async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(
        describeError(e).body,
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{t("pagesAppsChatSlackToolSettings.search.title")}</h3>
      <p className="text-sm text-muted-foreground">
        {t("pagesAppsChatSlackToolSettings.search.description")}
      </p>
      {!status.nativeSearchAvailable && (
        <p role="status" className="text-sm text-muted-foreground">
          {status.limitation}
        </p>
      )}
      {status.connected ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{t("pagesAppsChatSlackToolSettings.search.connected")}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void perform(onDisconnect)}
          >
            {t("pagesAppsChatSlackToolSettings.search.disconnect")}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          disabled={pending || !status.configured}
          onClick={() => void perform(onConnect)}
        >
          {t("pagesAppsChatSlackToolSettings.search.connect")}
        </Button>
      )}
      {!status.configured && (
        <p className="text-sm text-muted-foreground">
          {t("pagesAppsChatSlackToolSettings.search.notConfigured")}
        </p>
      )}
      {status.canConfigure && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {t("pagesAppsChatSlackToolSettings.search.oauthConfigTitle")}
          </summary>
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                await onConfigure({ clientId, clientSecret });
                setClientSecret("");
              });
            }}
          >
            <p className="text-sm">
              {t("pagesAppsChatSlackToolSettings.search.redirectInstructionsPrefix")}{" "}
              <code>search:read.public</code>,{" "}
              <code>search:read.private</code>{" "}{t("pagesAppsChatSlackToolSettings.search.and")}{" "}
              <code>search:read.files</code>{t("pagesAppsChatSlackToolSettings.search.redirectInstructionsSuffix")}
            </p>
            <p className="text-xs font-mono break-all">
              {status.redirectUri ?? t("pagesAppsChatSlackToolSettings.search.configurePublicUrl")}
            </p>
            <div className="space-y-2">
              <label htmlFor={`${id}-client`}>{t("pagesAppsChatSlackToolSettings.search.clientId")}</label>
              <Input
                id={`${id}-client`}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-secret`}>{t("pagesAppsChatSlackToolSettings.search.clientSecret")}</label>
              <Input
                id={`${id}-secret`}
                type="password"
                autoComplete="new-password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button
                type="submit"
                size="sm"
                disabled={pending || !clientId || !clientSecret}
              >
                {t("pagesAppsChatSlackToolSettings.search.saveOAuth")}
              </Button>
            </div>
          </form>
        </details>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
export function SlackToolsSettings({
  companyId,
  endpointId,
}: {
  companyId: string;
  endpointId: string;
}) {
  const query = useQuery({
    queryKey: ["slack-capabilities", companyId, endpointId],
    queryFn: () => slackToolsApi.capabilities(companyId, endpointId),
    staleTime: 60_000,
  });
  const view = useQueryView(query);
  return (
    <div className="space-y-3">
      <SlackCapabilitiesView
        capabilities={query.data}
        error={view.kind === "error" ? describeError(query.error).body : undefined}
      />

    </div>
  );
}
export function SlackSearchAccess({
  companyId,
  endpointId,
}: {
  companyId: string;
  endpointId: string;
}) {
  const query = useQuery({
    queryKey: ["slack-search", companyId, endpointId],
    queryFn: () => slackToolsApi.search(companyId, endpointId),
  });
  const authorization = useAuthorizationWindow();
  const view = useQueryView(query);
  if (view.kind === "error")
    return (
      <QueryErrorState
        error={query.error}
        action={t("pagesAppsChatSlackToolSettings.search.loadAction")}
        onRetry={view.retry}
        retrying={view.isFetching}
      />
    );
  if (!query.data)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("pagesAppsChatSlackToolSettings.search.loading")}
      </p>
    );
  return (<>
    {authorization.fallback}
    <SlackSearchView
      status={query.data}
      onConnect={async () => {
        authorization.reserve();
        try {
          const result = await slackToolsApi.connect(companyId, endpointId);
          await authorization.open(result.url);
        } catch (error) { authorization.cancel(); throw error; }
      }}
      onDisconnect={async () => {
        await slackToolsApi.disconnect(companyId, endpointId);
        await query.refetch();
      }}
      onConfigure={async (input) => {
        await slackToolsApi.configure(companyId, endpointId, input);
        await query.refetch();
      }}
    />
  </>);
}
