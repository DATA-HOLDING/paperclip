import { useState } from "react";
import { AlertTriangle, CircleHelp, ExternalLink, Loader2 } from "lucide-react";
import type { ChatEndpoint } from "@/api/chatEndpoints";
import { chatEndpointsApi } from "@/api/chatEndpoints";
import { CopyText } from "@/components/CopyText";
import { SetupWizardFooter } from "@/components/SetupWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/lib/router";
import { gitHubAppSettingsUrl } from "./GitHubAppIdentity";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

export function GitHubConnectionRecoveryNotice({ endpoint }: { endpoint: ChatEndpoint }) {
  if (!["attention", "revoked"].includes(endpoint.status)) return null;
  return (
    <section aria-label={t("pagesAppsChatGitHubConnectionRecovery.notice.needsRepair")} className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0 space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{endpoint.status === "revoked" ? t("pagesAppsChatGitHubConnectionRecovery.notice.disconnected") : t("pagesAppsChatGitHubConnectionRecovery.notice.needsRepair")}</h2>
          <p className="text-sm">{t("pagesAppsChatGitHubConnectionRecovery.notice.body")}</p>
        </div>
        <Button asChild><Link to={`/apps/chat/connect?provider=github&resume=${endpoint.id}&reconnect=1`}>{t("pagesAppsChatGitHubConnectionRecovery.notice.reconnect")}</Link></Button>
        {(endpoint.lastError || endpoint.healthMessage) && <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t("pagesAppsChatGitHubConnectionRecovery.notice.details")}</summary>
          <p className="mt-2 break-words">{endpoint.lastError ?? endpoint.healthMessage}</p>
        </details>}
      </div>
    </section>
  );
}

export const GITHUB_APP_CREDENTIAL_FIELDS = ["privateKey", "webhookSecret", "clientSecret"] as const;
export type GitHubAppCredentialField = typeof GITHUB_APP_CREDENTIAL_FIELDS[number];
export type GitHubAppCredentials = { appId: string; privateKey: string; webhookSecret: string; clientSecret?: string };

function CredentialLabel({ id, label, help }: { id: string; label: string; help: string }) {
  return <div className="flex items-center gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Tooltip><TooltipTrigger asChild><button type="button" aria-label={t("pagesAppsChatGitHubConnectionRecovery.credential.helpAria", { label })} className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
      <CircleHelp className="size-3.5" aria-hidden="true" />
    </button></TooltipTrigger><TooltipContent className={cn("max-w-xs", ANALYTICS_MASK_CLASS)}>{help}</TooltipContent></Tooltip>
  </div>;
}

export function GitHubAppRecovery({ endpoint, reconnect, credentialFields, requireAllCredentialFields = false, rotateWebhookSecret = false, rotationAlreadyCommitted = false, onConnect, onExit }: {
  endpoint: ChatEndpoint;
  reconnect: boolean;
  credentialFields?: readonly GitHubAppCredentialField[];
  requireAllCredentialFields?: boolean;
  rotateWebhookSecret?: boolean;
  rotationAlreadyCommitted?: boolean;
  onConnect: (credentials?: GitHubAppCredentials) => Promise<void>;
  onExit: () => void;
}) {
  const [replace, setReplace] = useState(!!credentialFields || !reconnect);
  const [credentials, setCredentials] = useState<GitHubAppCredentials>({ appId: endpoint.botExternalId ?? "", privateKey: "", webhookSecret: "" });
  const [privateKeyDraft, setPrivateKeyDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const [rotationSecret, setRotationSecret] = useState("");
  const [rotationGeneration, setRotationGeneration] = useState<string | null>(null);
  const [rotationUncertain, setRotationUncertain] = useState(false);
  const needsPrivateKey = !credentialFields || credentialFields.includes("privateKey");
  const needsWebhookSecret = credentialFields ? credentialFields.includes("webhookSecret") : !reconnect && !["active", "paused", "revoked"].includes(endpoint.status);
  const appName = endpoint.botLabel ?? endpoint.setup?.github?.appName ?? t("pagesAppsChatGitHubConnectionRecovery.recovery.existingAppFallback");
  const appIdInvalid = !!credentials.appId.trim() && !/^\d+$/.test(credentials.appId.trim());
  const keyInvalid = !!credentials.privateKey.trim() && !/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(credentials.privateKey);
  const keyLoaded = !!credentials.privateKey.trim() && !keyInvalid && !privateKeyDraft;
  const incomplete = credentialFields
    ? !credentialFields.length || appIdInvalid || keyInvalid || (requireAllCredentialFields
      ? credentialFields.some(field => !credentials[field]?.trim())
      : credentialFields.every(field => !credentials[field]?.trim()))
    : replace && (!credentials.appId.trim() || !credentials.privateKey.trim() || appIdInvalid || keyInvalid || (needsWebhookSecret && !credentials.webhookSecret.trim()));
  const actionLabel = pending ? t("pagesAppsChatGitHubConnectionRecovery.actions.checkingGithub") : replace ? (reconnect ? t("pagesAppsChatGitHubConnectionRecovery.actions.verifyAndReconnect") : t("pagesAppsChatGitHubConnectionRecovery.actions.connectExisting")) : t("pagesAppsChatGitHubConnectionRecovery.actions.reconnectSaved");
  async function connect() {
    setPending(true);
    setError("");
    try { await onConnect(replace ? credentials : undefined); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("pagesAppsChatGitHubConnectionRecovery.errors.reconnectFailed")); }
    finally { setPending(false); }
  }
  async function checkSavedRotation(expected: string | null | undefined) {
    try {
      const saved = await chatEndpointsApi.get(endpoint.id);
      if (expected !== undefined && (saved.setup?.credentialRotationId ?? null) === expected) {
        setRotationUncertain(false);
        return true;
      }
      setRotationSecret("");
      setRotationGeneration(null);
      setError(t("pagesAppsChatGitHubConnectionRecovery.errors.secretChangedUnseen"));
    } catch {
      // A failed status read cannot establish that the earlier secret is current.
    }
    setRotationUncertain(true);
    return false;
  }
  async function generateSecret() {
    const previousGeneration = rotationGeneration ?? (rotationSecret ? undefined : endpoint.setup?.credentialRotationId ?? null);
    setPending(true);
    setError("");
    try {
      const result = await chatEndpointsApi.generateSetupSecret(endpoint.id);
      setRotationSecret(result.webhookSecret);
      setRotationGeneration(result.credentialRotationId ?? null);
      setRotationUncertain(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("pagesAppsChatGitHubConnectionRecovery.errors.generateFailed"));
      setRotationUncertain(true);
      await checkSavedRotation(previousGeneration);
    }
    finally { setPending(false); }
  }
  return <div className="space-y-6">
    {reconnect && <div className="space-y-3">
      <p className="text-sm">{t("pagesAppsChatGitHubConnectionRecovery.recovery.restoreBefore")}<strong>{appName}</strong>{t("pagesAppsChatGitHubConnectionRecovery.recovery.restoreAfter")}</p>
      <p className="text-sm text-muted-foreground">{t("pagesAppsChatGitHubConnectionRecovery.recovery.staysAttached")}</p>
    </div>}
    {rotateWebhookSecret && <section aria-label={t("pagesAppsChatGitHubConnectionRecovery.rotation.aria")} className="space-y-3">
      <h2 className="text-base font-semibold">{t("pagesAppsChatGitHubConnectionRecovery.rotation.title")}</h2>
      <p className="text-sm">{rotationAlreadyCommitted ? t("pagesAppsChatGitHubConnectionRecovery.rotation.committed") : <>{t("pagesAppsChatGitHubConnectionRecovery.rotation.instructionsBefore")}<a href={gitHubAppSettingsUrl(endpoint)} target="_blank" rel="noreferrer" className="underline">{t("pagesAppsChatGitHubConnectionRecovery.rotation.appSettingsLink")}</a>{t("pagesAppsChatGitHubConnectionRecovery.rotation.instructionsAfter")}</>}</p>
      <p className="text-sm text-muted-foreground">{t("pagesAppsChatGitHubConnectionRecovery.rotation.warning")}</p>
      <Button type="button" variant="outline" disabled={pending} onClick={() => void generateSecret()}>{rotationSecret || rotationAlreadyCommitted ? t("pagesAppsChatGitHubConnectionRecovery.rotation.generateAnother") : t("pagesAppsChatGitHubConnectionRecovery.rotation.generate")}</Button>
      {rotationUncertain && <p role="status" className="text-sm">{t("pagesAppsChatGitHubConnectionRecovery.rotation.uncertain")}</p>}
      {rotationUncertain && rotationSecret && <Button type="button" variant="outline" disabled={pending} onClick={async () => {
        setPending(true);
        try { if (await checkSavedRotation(rotationGeneration ?? undefined)) setError(""); }
        finally { setPending(false); }
      }}>{t("pagesAppsChatGitHubConnectionRecovery.rotation.checkStatus")}</Button>}
      {rotationSecret && !rotationUncertain && <div className="space-y-2">
        <Label htmlFor="github-rotation-secret">{t("pagesAppsChatGitHubConnectionRecovery.rotation.newSecret")}</Label>
        <Input id="github-rotation-secret" type="password" autoComplete="off" disabled={pending} readOnly value={rotationSecret} />
        {!pending && <CopyText text={rotationSecret} ariaLabel={t("pagesAppsChatGitHubConnectionRecovery.rotation.copy")} className="text-sm underline">{t("pagesAppsChatGitHubConnectionRecovery.rotation.copy")}</CopyText>}
      </div>}
    </section>}
    {error && <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="font-medium">{rotateWebhookSecret ? t("pagesAppsChatGitHubConnectionRecovery.errors.rotationTitle") : replace ? t("pagesAppsChatGitHubConnectionRecovery.errors.reconnectAppTitle") : t("pagesAppsChatGitHubConnectionRecovery.errors.reconnectSavedTitle")}</p>
      <p className="break-words">{error}</p>
      <p>{rotateWebhookSecret ? t("pagesAppsChatGitHubConnectionRecovery.errors.rotationHint") : t("pagesAppsChatGitHubConnectionRecovery.errors.reconnectHint")}</p>
    </div>}
    {reconnect && !rotateWebhookSecret && !credentialFields && <Button variant="link" className="h-auto p-0" disabled={pending} onClick={() => { setReplace(!replace); setError(""); }}>
      {replace ? t("pagesAppsChatGitHubConnectionRecovery.recovery.useSaved") : t("pagesAppsChatGitHubConnectionRecovery.recovery.replaceCredentials")}
    </Button>}
    {replace && <div className="space-y-6">
      <div className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">{reconnect ? t("pagesAppsChatGitHubConnectionRecovery.credentials.titleReplace") : t("pagesAppsChatGitHubConnectionRecovery.credentials.titleConnect")}</h2>
        <p><a href={gitHubAppSettingsUrl(endpoint)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">{t("pagesAppsChatGitHubConnectionRecovery.credentials.openSettings")}<ExternalLink className="size-3.5" /></a>{t("pagesAppsChatGitHubConnectionRecovery.credentials.andChoose")}<strong>{appName}</strong>.</p>
        <p className="text-muted-foreground">{t("pagesAppsChatGitHubConnectionRecovery.credentials.orgOwned")}</p>
        {credentialFields && <p className="text-muted-foreground">{t("pagesAppsChatGitHubConnectionRecovery.credentials.requested")}</p>}
      </div>
      {needsPrivateKey && <div className="space-y-2">
        <CredentialLabel id="github-app-id" label={t("pagesAppsChatGitHubConnectionRecovery.credentials.appId.label")} help={t("pagesAppsChatGitHubConnectionRecovery.credentials.appId.help")} />
        <p id="github-app-id-help" className="text-sm text-muted-foreground">{t("pagesAppsChatGitHubConnectionRecovery.credentials.appId.copyBefore")}<strong>{t("pagesAppsChatGitHubConnectionRecovery.credentials.appId.label")}</strong>{t("pagesAppsChatGitHubConnectionRecovery.credentials.appId.copyAfter")} {reconnect && t("pagesAppsChatGitHubConnectionRecovery.credentials.appId.savedFilled")}</p>
        <Input id="github-app-id" aria-describedby="github-app-id-help" inputMode="numeric" value={credentials.appId} disabled={pending} aria-invalid={appIdInvalid} onChange={event => setCredentials({ ...credentials, appId: event.target.value })} />
        {appIdInvalid && <p role="alert" className="text-sm text-destructive">{t("pagesAppsChatGitHubConnectionRecovery.credentials.appId.invalid")}</p>}
      </div>}
      {needsPrivateKey && <div className="space-y-2">
        <CredentialLabel id="github-private-key" label={t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.label")} help={t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.help")} />
        <ol id="github-private-key-help" className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>{t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.step1Before")}<strong>{t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.step1Path")}</strong>{t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.step1Middle")}<strong>{t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.step1OldPath")}</strong>.</li>
          <li>{t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.step2Before")}<strong>.pem</strong>{t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.step2After")}</li>
        </ol>
        <p className="text-sm text-muted-foreground">{t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.reuse")}</p>
        <Input type="file" accept=".pem" aria-label={t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.uploadAria")} disabled={pending} onChange={async event => {
          const file = event.target.files?.[0];
          if (!file) return;
          setFileError("");
          try {
            const privateKey = await file.text();
            setCredentials(current => ({ ...current, privateKey }));
            setPrivateKeyDraft("");
          } catch { setFileError(t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.readFailed")); }
        }} />
        <Input id="github-private-key" type="password" autoComplete="off" placeholder={keyLoaded ? t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.pasteReplacement") : t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.paste")} aria-describedby="github-private-key-help" disabled={pending} value={privateKeyDraft} aria-invalid={keyInvalid}
          onPaste={event => { event.preventDefault(); setCredentials({ ...credentials, privateKey: event.clipboardData.getData("text") }); setPrivateKeyDraft(""); setFileError(""); }}
          onChange={event => { setPrivateKeyDraft(event.target.value); setCredentials({ ...credentials, privateKey: event.target.value }); }} />
        {keyLoaded && <p role="status" className="text-sm">{t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.loaded")}</p>}
        {keyInvalid && <p role="alert" className="text-sm text-destructive">{t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.invalid")}</p>}
        {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
        <a className="inline-flex items-center gap-1 text-sm underline" href="https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps" target="_blank" rel="noreferrer">{t("pagesAppsChatGitHubConnectionRecovery.credentials.privateKey.docsLink")}<ExternalLink className="size-3.5" /></a>
      </div>}
      {needsWebhookSecret && <div className="space-y-2">
        <CredentialLabel id="github-webhook-secret" label={t("pagesAppsChatGitHubConnectionRecovery.credentials.webhookSecret.label")} help={t("pagesAppsChatGitHubConnectionRecovery.credentials.webhookSecret.help")} />
        <p className="text-sm text-muted-foreground">{t("pagesAppsChatGitHubConnectionRecovery.credentials.webhookSecret.body")}</p>
        <Input id="github-webhook-secret" type="password" autoComplete="off" disabled={pending} value={credentials.webhookSecret} onChange={event => setCredentials({ ...credentials, webhookSecret: event.target.value })} />
      </div>}
      {credentialFields?.includes("clientSecret") && <div className="space-y-2">
        <CredentialLabel id="github-client-secret" label={t("pagesAppsChatGitHubConnectionRecovery.credentials.clientSecret.label")} help={t("pagesAppsChatGitHubConnectionRecovery.credentials.clientSecret.help")} />
        <Input id="github-client-secret" type="password" autoComplete="off" disabled={pending} value={credentials.clientSecret ?? ""} onChange={event => setCredentials({ ...credentials, clientSecret: event.target.value })} />
      </div>}
    </div>}
    <SetupWizardFooter onSaveExit={onExit} disabled={pending}>
      <Button aria-label={actionLabel} disabled={pending || incomplete || rotationUncertain || (rotateWebhookSecret && !rotationSecret && !rotationAlreadyCommitted)} onClick={() => void connect()}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        <span className="sm:hidden" aria-hidden="true">{pending ? t("pagesAppsChatGitHubConnectionRecovery.actions.checking") : reconnect ? t("pagesAppsChatGitHubConnectionRecovery.actions.reconnect") : t("pagesAppsChatGitHubConnectionRecovery.actions.connect")}</span>
        <span className="hidden sm:inline" aria-hidden="true">{actionLabel}</span>
      </Button>
    </SetupWizardFooter>
  </div>;
}
