import { t } from "@/i18n";
import type { ChatEndpoint } from "@/api/chatEndpoints";
import { isProvisionedSlackSetup } from "@paperclipai/shared";
export { isProvisionedSlackSetup };
export function slackSetupNavigation(method: string | undefined, availableStage = 1) {
  const managed = method === "managed";
  return {
    labels: managed ? [t("pagesAppsChatSlackSetupState.chooseAgent"), t("pagesAppsChatSlackSetupState.connect")] : isProvisionedSlackSetup(method)
      ? [t("pagesAppsChatSlackSetupState.chooseAgent"), t("pagesAppsChatSlackSetupState.appConfigurationToken"), t("pagesAppsChatSlackSetupState.installSlackApp"), t("pagesAppsChatSlackSetupState.sendMessage")]
      : [t("pagesAppsChatSlackSetupState.chooseAgent"), t("pagesAppsChatSlackSetupState.createSlackApp"), t("pagesAppsChatSlackSetupState.addCredentials"), t("pagesAppsChatSlackSetupState.verifyConnection"), t("pagesAppsChatSlackSetupState.connectAccount"), t("pagesAppsChatSlackSetupState.tryIt")],
    toVisible: (step: number) => managed ? Math.min(step, 1) : step,
    toStage: (step: number) => managed && step === 1 ? availableStage : step,
  };
}

/** Logical stages stay compatible with existing draft URLs; navigation is derived here. */
export function slackSetupState(input: { endpoint: ChatEndpoint | null; repairing: boolean; credentialsReady: boolean; identityReady: boolean; defaultMethod?: string }) {
  const { endpoint, repairing, credentialsReady, identityReady } = input;
  const method = endpoint ? endpoint.setup?.slackSetupMethod : input.defaultMethod ?? "managed";
  const provisioned = isProvisionedSlackSetup(method);
  const complete = provisioned && (endpoint?.setup?.step === "test" || endpoint?.setup?.step === "complete");
  const finalStage = provisioned ? 3 : 5;
  const availableStage = !endpoint ? 0
    : provisioned && endpoint.setup?.slackRegistration?.status === "configured" && endpoint.setup.slackAccount?.status !== "linked" && endpoint.setup.step !== "complete" ? 2
    : !repairing && (endpoint.setup?.step === "test" || endpoint.setup?.step === "complete")
      ? endpoint.setup.step !== "complete" && !provisioned && !identityReady ? 4 : finalStage
    : provisioned && endpoint.setup?.slackRegistration?.status === "credentials_saved" ? 2
    : endpoint.providerAccountId && !repairing ? 3
    : credentialsReady || repairing || method === "existing" || provisioned && endpoint.setup?.slackRegistration?.appId ? 2 : 1;
  return { ...slackSetupNavigation(method, availableStage), provisioned, complete, finalStage, availableStage };
}
