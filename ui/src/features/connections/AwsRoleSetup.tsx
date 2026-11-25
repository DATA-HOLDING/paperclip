import { t } from "@/i18n";
import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronRight, Download, Loader2 } from "lucide-react";
import { getAppStoreDefinition, type AwsConnectionSetup } from "@paperclipai/shared";
import { ApiError } from "@/api/client";
import { toolsApi } from "@/api/tools";
import { describeError } from "@/api/errors";
import { AgentSetupPrompt } from "@/components/AgentSetupPrompt";
import {
  AgentSetupProgressPanel,
  agentSetupProgressInstructions,
  useAgentSetupProgress,
  type AgentSetupProgressClient,
  type AgentSetupStep,
} from "@/components/AgentSetupProgress";
import { InlineBanner } from "@/components/InlineBanner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copyTextToClipboard } from "@/lib/clipboard";

/** The call this step makes. Stories and tests pass in-memory fakes. */
export interface AwsRoleSetupClient {
  setup(connectionId: string, accessLevel?: "read_only" | "full"): Promise<AwsConnectionSetup>;
}

export const awsRoleSetupApiClient: AwsRoleSetupClient = {
  setup: (connectionId, accessLevel) => toolsApi.getAwsSetup(connectionId, accessLevel),
};

const UNAVAILABLE_REASON: Record<Extract<AwsConnectionSetup, { available: false }>["reason"], string> = {
  no_public_url: t("featuresConnections.awsRoleSetup.unavailableReason.no_public_url"),
  not_https: t("featuresConnections.awsRoleSetup.unavailableReason.not_https"),
  has_port: t("featuresConnections.awsRoleSetup.unavailableReason.has_port"),
  loopback: t("featuresConnections.awsRoleSetup.unavailableReason.loopback"),
  address_changed: t("featuresConnections.awsRoleSetup.unavailableReason.address_changed"),
};

/**
 * A failed AWS test, in words that say what to fix. The server's AWS messages are
 * already plain language and never contain AWS's own text, so they are shown as
 * is; setup reports them with a gateway status that generic copy would replace.
 */
export function awsSetupErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.body && typeof error.body === "object") {
    const body = error.body as { error?: unknown; details?: { code?: unknown } };
    const code = typeof body.details?.code === "string" ? body.details.code : error.code;
    if (typeof code === "string" && code.startsWith("aws_") && typeof body.error === "string") return body.error;
  }
  return describeError(error).body;
}

export interface AwsRoleSetupProps {
  connectionId: string;
  /** The access level the test will submit, when it may differ from the saved one (reconnect). */
  accessLevel?: "read_only" | "full";
  client?: AwsRoleSetupClient;
  /** The last test's failure, shown in place. */
  error?: string | null;
  testing?: boolean;
  onBack: () => void;
  /** Tests the connection with the role ARN the customer pasted back. */
  onTest: (roleArn: string) => void;
  /** Shown above the footer, such as who gets access to the connection. */
  beforeFooter?: React.ReactNode;
  /** The company, for the agent's live progress checklist; without it the prompt has no progress reporting. */
  companyId?: string | null;
  progressClient?: AgentSetupProgressClient;
  /** The signed-in account for the checklist; stories and tests pass it, the app reads the session. */
  progressAccountId?: string;
}

/** The steps the agent is asked to report; it may adjust them. */
export const AWS_AGENT_SETUP_STEPS: AgentSetupStep[] = [
  { key: "check-account", title: t("featuresConnections.awsRoleSetup.steps.checkAccount") },
  { key: "check-provider", title: t("featuresConnections.awsRoleSetup.steps.checkProvider") },
  { key: "deploy-stack", title: t("featuresConnections.awsRoleSetup.steps.deployStack") },
  { key: "report-role", title: t("featuresConnections.awsRoleSetup.steps.reportRole") },
];

/**
 * The app definition's role ARN rule (a server test keeps it equal to the server's), so this
 * check matches what the server accepts. Without a definition the server alone decides.
 */
const ROLE_ARN_PATTERN = new RegExp(
  getAppStoreDefinition("aws")?.methods.find((method) => method.key === "aws-role")
    ?.tenantFields?.find((field) => field.key === "roleArn")?.validation?.pattern ?? "^arn:",
);

/**
 * The middle of AWS role setup: the connection is saved as a draft, so AWS can
 * now trust exactly this connection. By default the customer hands a prompt to
 * their own agent, which creates the role, then pastes back the role ARN; the
 * CloudFormation and by-hand steps are there for anyone who prefers them.
 */
export function AwsRoleSetup({
  connectionId,
  accessLevel,
  client = awsRoleSetupApiClient,
  error = null,
  testing = false,
  onBack,
  onTest,
  beforeFooter,
  companyId,
  progressClient,
  progressAccountId,
}: AwsRoleSetupProps) {
  const [setup, setSetup] = useState<AwsConnectionSetup | null>(null);
  const agentProgress = useAgentSetupProgress({
    companyId, purpose: "aws_connection", subjectId: connectionId,
    // Only when the role method is available: otherwise there is no prompt to carry the checklist.
    enabled: setup?.available === true,
    ...(progressClient ? { client: progressClient } : {}),
    ...(progressAccountId ? { accountId: progressAccountId } : {}),
  });
  // The prompt waits for the checklist (or its failure), so a copied prompt always carries progress reporting when it can.
  const promptReady = !companyId || Boolean(agentProgress.handoff) || Boolean(agentProgress.error);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roleArn, setRoleArn] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSetup(null);
    setLoadError(null);
    client.setup(connectionId, accessLevel).then(
      (value) => {
        if (cancelled) return;
        setSetup(value);
        if (value.available && value.savedRoleArn) setRoleArn((current) => current || value.savedRoleArn!);
      },
      (caught) => { if (!cancelled) setLoadError(describeError(caught).body); },
    );
    return () => { cancelled = true; };
  }, [client, connectionId, accessLevel]);

  const ready = setup?.available === true ? setup : null;
  const trimmedArn = roleArn.trim();
  const arnInvalid = trimmedArn.length > 0 && !ROLE_ARN_PATTERN.test(trimmedArn);

  return (
    <div className="space-y-5" data-testid="aws-role-setup">
      <p className="text-sm text-foreground">
        {t("featuresConnections.awsRoleSetup.intro")}
      </p>

      {error ? <InlineBanner tone="warning" title={t("featuresConnections.awsRoleSetup.notAcceptedTitle")}>{error}</InlineBanner> : null}
      {loadError ? <InlineBanner tone="danger" title={t("featuresConnections.awsRoleSetup.loadErrorTitle")}>{loadError}</InlineBanner> : null}
      {setup?.available === false ? (
        setup.reason === "address_changed" ? (
          <InlineBanner tone="warning" title={t("featuresConnections.awsRoleSetup.saveAgainTitle")}>
            {UNAVAILABLE_REASON[setup.reason]}{" "}{t("featuresConnections.awsRoleSetup.saveAgainBody")}
          </InlineBanner>
        ) : (
          <InlineBanner tone="warning" title={t("featuresConnections.awsRoleSetup.useAccessKeyTitle")}>
            {UNAVAILABLE_REASON[setup.reason]}{" "}{t("featuresConnections.awsRoleSetup.useAccessKeyBody")}
          </InlineBanner>
        )
      ) : null}

      {!setup && !loadError ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("featuresConnections.awsRoleSetup.preparingSetup")}
        </p>
      ) : null}

      {ready ? (
        <>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground">{t("featuresConnections.awsRoleSetup.promptLead")}</span>{" "}
              {ready.savedRoleArn
                ? (agentProgress.handoff ? t("featuresConnections.awsRoleSetup.promptBody.updatesWithProgress") : t("featuresConnections.awsRoleSetup.promptBody.updates"))
                : (agentProgress.handoff ? t("featuresConnections.awsRoleSetup.promptBody.createsWithProgress") : t("featuresConnections.awsRoleSetup.promptBody.creates"))}
            </p>
            {agentProgress.error ? (
              <InlineBanner tone="warning" title={t("featuresConnections.awsRoleSetup.liveProgressTitle")}>
                {agentProgress.error}{" "}{t("featuresConnections.awsRoleSetup.liveProgressBody")}{" "}
                <Button type="button" variant="outline" size="sm" className="ml-1" onClick={agentProgress.renew}>{t("featuresConnections.awsRoleSetup.tryAgain")}</Button>
              </InlineBanner>
            ) : null}
            {promptReady ? (
              <AgentSetupPrompt
                prompt={awsAgentSetupPrompt(ready, agentProgress.handoff ? agentSetupProgressInstructions(agentProgress.handoff, AWS_AGENT_SETUP_STEPS) : null)}
                label={t("featuresConnections.awsRoleSetup.agentPrompt.label")}
                title={t("featuresConnections.awsRoleSetup.agentPrompt.title")}
                description={t("featuresConnections.awsRoleSetup.agentPrompt.description")}
                side="bottom"
              />
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("featuresConnections.awsRoleSetup.preparingPrompt")}
              </p>
            )}
            {agentProgress.handoff ? (
              <AgentSetupProgressPanel
                progress={agentProgress.progress}
                subject="AWS"
                expired={agentProgress.expired}
                onRenew={agentProgress.renew}
                refreshError={agentProgress.refreshError}
                onRetryRefresh={agentProgress.retryRefresh}
              />
            ) : null}
            <div className="space-y-2">
              <label htmlFor="aws-role-arn" className="text-sm font-medium text-foreground">{t("featuresConnections.awsRoleSetup.roleArn")}</label>
              <Input
                id="aws-role-arn"
                value={roleArn}
                onChange={(event) => setRoleArn(event.target.value)}
                placeholder={t("featuresConnections.awsRoleSetup.roleArnPlaceholder", { roleName: ready.roleName })}
                aria-invalid={arnInvalid || undefined}
                className="font-mono text-base md:text-xs"
                autoComplete="off"
                spellCheck={false}
              />
              {arnInvalid ? (
                <p className="text-xs text-destructive">{t("featuresConnections.awsRoleSetup.roleArnInvalid", { roleName: ready.roleName })}</p>
              ) : null}
            </div>
          </div>

          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-1 text-sm font-medium text-foreground">
              <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
              {t("featuresConnections.awsRoleSetup.byHand")}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-6">
              <section className="space-y-3" aria-labelledby="aws-role-cloudformation">
                <h3 id="aws-role-cloudformation" className="text-sm font-medium text-foreground">{t("featuresConnections.awsRoleSetup.cloudFormation.title")}</h3>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>
                    <span className="text-foreground">{t("featuresConnections.awsRoleSetup.cloudFormation.downloadLead")}</span>{" "}
                    {ready.accessLevel === "read_only"
                      ? t("featuresConnections.awsRoleSetup.cloudFormation.readOnlyTemplate")
                      : t("featuresConnections.awsRoleSetup.cloudFormation.fullTemplate")}
                    <div className="mt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate(ready)}>
                        <Download className="mr-2 h-4 w-4" /> {t("featuresConnections.awsRoleSetup.cloudFormation.downloadButton")}
                      </Button>
                    </div>
                  </li>
                  <li>
                    <a
                      href={ready.cloudFormationConsoleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-foreground underline underline-offset-4"
                    >
                      {t("featuresConnections.awsRoleSetup.cloudFormation.open")} <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>{" "}
                    {t("featuresConnections.awsRoleSetup.cloudFormation.openRest")}
                  </li>
                  <li>
                    {ready.accessLevel === "read_only"
                      ? t("featuresConnections.awsRoleSetup.cloudFormation.readOnlyPolicy")
                      : t("featuresConnections.awsRoleSetup.cloudFormation.fullPolicy")}{" "}
                    {t("featuresConnections.awsRoleSetup.cloudFormation.parameters")}
                  </li>
                  <li>
                    {t("featuresConnections.awsRoleSetup.cloudFormation.finishBefore")}<span className="font-mono text-foreground">{ready.roleName}</span>{t("featuresConnections.awsRoleSetup.cloudFormation.finishAfter")}
                  </li>
                </ol>
              </section>

              <section className="space-y-3" aria-labelledby="aws-role-manual">
                <h3 id="aws-role-manual" className="text-sm font-medium text-foreground">{t("featuresConnections.awsRoleSetup.manual.title")}</h3>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>{t("featuresConnections.awsRoleSetup.manual.addProvider")}</li>
                  <li>
                    {ready.savedRoleArn ? t("featuresConnections.awsRoleSetup.manual.updateRole") : t("featuresConnections.awsRoleSetup.manual.createRole")}{" "}
                    <span className="font-mono text-foreground">{ready.savedRoleArn ?? ready.roleName}</span>{" "}
                    {ready.savedRoleArn ? t("featuresConnections.awsRoleSetup.manual.updateTrust") : t("featuresConnections.awsRoleSetup.manual.createTrust")}
                    {t("featuresConnections.awsRoleSetup.manual.replaceAccountId")}
                  </li>
                  <li>{t("featuresConnections.awsRoleSetup.manual.attach")}</li>
                </ol>
                <CopyRow label={t("featuresConnections.awsRoleSetup.manual.providerUrl")} value={ready.issuer} />
                <CopyRow label={t("featuresConnections.awsRoleSetup.manual.audience")} value={ready.audience} />
                <CopyRow label={t("featuresConnections.awsRoleSetup.manual.roleName")} value={ready.roleName} />
                <CopyRow label={t("featuresConnections.awsRoleSetup.manual.connectionSubject")} value={ready.subject} />
                <CopyBlock label={t("featuresConnections.awsRoleSetup.manual.trustPolicy")} value={JSON.stringify(ready.trustPolicy, null, 2)} />
                <CopyBlock label={t("featuresConnections.awsRoleSetup.manual.cliCommands")} value={awsCliCommands(ready)} />
              </section>
            </CollapsibleContent>
          </Collapsible>
        </>
      ) : null}

      {beforeFooter}

      <div className="flex items-center justify-between pt-3">
        <Button variant="ghost" onClick={onBack} disabled={testing}>{t("featuresConnections.awsRoleSetup.back")}</Button>
        <Button onClick={() => onTest(trimmedArn)} disabled={testing || !ready || !trimmedArn || arnInvalid}>
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {testing ? t("featuresConnections.awsRoleSetup.testing") : t("featuresConnections.awsRoleSetup.testConnection")}
        </Button>
      </div>
    </div>
  );
}

/**
 * The by-hand setup for the AWS CLI. It reads the account ID, reuses an existing identity
 * provider, and updates the role when it already exists (as on reconnect), so it can be pasted as is.
 */
export function awsCliCommands(setup: Extract<AwsConnectionSetup, { available: true }>): string {
  const { roleName } = setup;
  const policy = JSON.stringify(setup.trustPolicy, null, 2).replaceAll("ACCOUNT_ID", "${ACCOUNT_ID}");
  const accessPolicy = setup.accessLevel === "read_only" ? "arn:aws:iam::aws:policy/ReadOnlyAccess" : "REPLACE_WITH_POLICY_ARN";
  return [
    ...(setup.accessLevel === "read_only" ? [] : ["# Replace REPLACE_WITH_POLICY_ARN below with the managed policy agents should have."]),
    "ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)",
    `aws iam get-open-id-connect-provider --open-id-connect-provider-arn "arn:aws:iam::\${ACCOUNT_ID}:oidc-provider/${setup.providerHost}" >/dev/null 2>&1 \\`,
    `  || aws iam create-open-id-connect-provider --url ${setup.issuer} --client-id-list ${setup.audience}`,
    "cat > paperclip-trust-policy.json <<EOF",
    policy,
    "EOF",
    `if aws iam get-role --role-name ${roleName} >/dev/null 2>&1; then`,
    `  aws iam update-assume-role-policy --role-name ${roleName} --policy-document file://paperclip-trust-policy.json`,
    "else",
    `  aws iam create-role --role-name ${roleName} --max-session-duration 3600 --assume-role-policy-document file://paperclip-trust-policy.json`,
    "fi",
    `aws iam attach-role-policy --role-name ${roleName} --policy-arn arn:aws:iam::aws:policy/AWSMCPSignInOAuthAccessPolicy`,
    `aws iam attach-role-policy --role-name ${roleName} --policy-arn ${accessPolicy}`,
    `aws iam get-role --role-name ${roleName} --query Role.Arn --output text`,
  ].join("\n");
}

/**
 * A prompt for the user's own agent (on a machine already signed in to AWS) to
 * deploy this connection's template and report the role ARN. It holds no AWS
 * credential (AWS trusts the connection's signed identity). With progress
 * instructions it carries a short-lived token that can update this setup's
 * checklist, so it is for the person's own agent, not for sharing.
 */
export function awsAgentSetupPrompt(setup: Extract<AwsConnectionSetup, { available: true }>, progressInstructions: string | null = null): string {
  // One stack per connection, like the role, so two connections never share (and replace) a stack.
  const stack = setup.roleName;
  const policyStep = setup.accessLevel === "read_only"
    ? "The connection is read only, so keep the template's default AccessPolicyArn (ReadOnlyAccess)."
    : "The connection has full access, so ask me which managed policy agents should have, then pass it as AccessPolicyArn. Do not pick one yourself.";
  return [
    setup.savedRoleArn
      ? `Update the AWS IAM role ${setup.savedRoleArn} so Paperclip can connect to my AWS account again. Use the AWS CLI on this computer.`
      : "Set up an AWS IAM role so Paperclip can connect to my AWS account. Use the AWS CLI on this computer.",
    ...(progressInstructions ? ["", progressInstructions] : []),
    "",
    "Steps:",
    setup.savedRoleArn
      ? `1. Run \`aws sts get-caller-identity\` and tell me which account and identity it shows. The role is in account ${setup.savedRoleArn.split(":")[4]}: if the CLI uses a different account, or is not signed in, stop and ask me which profile to use.`
      : "1. Run `aws sts get-caller-identity` and tell me which account and identity it shows. If the CLI is not signed in, or I may want a different account, stop and ask me which profile to use.",
    `2. Choose CreateIdentityProvider. If the stack ${stack} already exists and its value is true (see \`aws cloudformation describe-stacks --stack-name ${stack}\`), keep true so the stack keeps owning its provider. Otherwise run \`aws iam list-open-id-connect-providers\`: if one already ends with ${setup.providerHost}, pass false; otherwise pass true.`,
    `3. ${policyStep}`,
    "4. Save the CloudFormation template below to a file and deploy it. This creates the stack, or updates it if it already exists:",
    `   aws cloudformation deploy --stack-name ${stack} --template-file <file> --capabilities CAPABILITY_NAMED_IAM --parameter-overrides CreateIdentityProvider=<true|false>${setup.accessLevel === "full" ? " AccessPolicyArn=<policy ARN>" : ""}`,
    `   If it fails because the role ${setup.roleName} already exists outside this stack, do not delete it. Instead update its trust policy with \`aws iam update-assume-role-policy\` to the trust policy in the template (with this account's ID and the identity provider's ARN), make sure AWSMCPSignInOAuthAccessPolicy and the access policy are attached, and use that role's ARN in step 5.`,
    `5. Give me the role's ARN (the stack's RoleArn output, or \`aws iam get-role --role-name ${setup.roleName} --query Role.Arn --output text\`), so I can paste it into Paperclip and press Test connection.${progressInstructions ? " Also put it in your finish summary, as \"Role ARN: <arn>\"." : ""}`,
    "",
    "The role trusts only this one Paperclip connection, and no AWS keys are created or shared:",
    `- Identity provider: ${setup.issuer} (audience ${setup.audience})`,
    `- Connection subject: ${setup.subject}`,
    `- Role name: ${setup.roleName}`,
    "",
    "CloudFormation template:",
    setup.cloudFormationTemplate.trimEnd(),
  ].join("\n");
}

function downloadTemplate(setup: Extract<AwsConnectionSetup, { available: true }>) {
  const blob = new Blob([setup.cloudFormationTemplate], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `paperclip-aws-${setup.roleName}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={t("featuresConnections.awsRoleSetup.copyAriaLabel", { label: label })}
      onClick={async () => {
        await copyTextToClipboard(value).then(() => setCopied(true), () => setCopied(false));
      }}
    >
      {copied ? t("featuresConnections.awsRoleSetup.copied") : t("featuresConnections.awsRoleSetup.copy")}
    </Button>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border px-3 py-2 font-mono text-xs text-foreground">{value}</code>
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <CopyButton value={value} label={label} />
      </div>
      <Textarea readOnly value={value} aria-label={label} rows={10} className="mt-2 font-mono text-xs" />
    </div>
  );
}
