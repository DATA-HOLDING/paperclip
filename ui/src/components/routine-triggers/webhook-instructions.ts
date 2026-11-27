import { t } from "@/i18n";
export type WebhookInstructionSender = "custom" | "github";
export type WebhookInstructionSigningMode = "app_webhook" | "bearer" | "fireflies_hmac" | "hmac_sha256" | "none";

const SIGNING_MODES: readonly WebhookInstructionSigningMode[] = ["app_webhook", "bearer", "fireflies_hmac", "hmac_sha256", "none"];

/** The instruction set for a saved webhook's signing mode; unknown modes read as the shared app flow. */
export function webhookInstructionSigningMode(mode: string | null | undefined): WebhookInstructionSigningMode {
  return SIGNING_MODES.includes(mode as WebhookInstructionSigningMode) ? mode as WebhookInstructionSigningMode : "app_webhook";
}

/** Copyable setup instructions for whoever (or whichever agent) connects the sending app. */
export function webhookAgentInstructions(
  sender: WebhookInstructionSender,
  routineTitle: string,
  webhookUrl: string,
  webhookSecret: string,
  setupPending = true,
  signingMode: WebhookInstructionSigningMode = "app_webhook",
) {
  const common = [
    t("componentsRoutineTriggers.instructions.connect", { title: JSON.stringify(routineTitle) }),
    t("componentsRoutineTriggers.instructions.webhookUrl", { url: webhookUrl }),
    t("componentsRoutineTriggers.instructions.sendPost"),
    "Content-Type: application/json",
  ];
  const auth =
    sender === "github"
      ? [
          t("componentsRoutineTriggers.instructions.github.open"),
          t("componentsRoutineTriggers.instructions.github.payloadUrl"),
          t("componentsRoutineTriggers.instructions.github.secret", { secret: webhookSecret }),
          t("componentsRoutineTriggers.instructions.github.pasteSecret"),
          t("componentsRoutineTriggers.instructions.github.selectEvents"),
          t("componentsRoutineTriggers.instructions.github.check"),
        ]
      : signingMode === "none"
        ? [
            t("componentsRoutineTriggers.instructions.none.noKey"),
            t("componentsRoutineTriggers.instructions.none.addWebhook"),
            t("componentsRoutineTriggers.instructions.idempotency"),
          ]
      : signingMode === "hmac_sha256"
        ? [
            t("componentsRoutineTriggers.instructions.secretKey", { secret: webhookSecret }),
            t("componentsRoutineTriggers.instructions.hmac.sign"),
            t("componentsRoutineTriggers.instructions.hmac.headers"),
            t("componentsRoutineTriggers.instructions.hmac.oldTimestamp"),
            t("componentsRoutineTriggers.instructions.idempotency"),
          ]
      : [
          t("componentsRoutineTriggers.instructions.secretKey", { secret: webhookSecret }),
          ...(signingMode === "bearer" ? [] : [
            t("componentsRoutineTriggers.instructions.app.signingSecret", { headers: signingMode === "fireflies_hmac" ? "X-Hub-Signature" : t("componentsRoutineTriggers.instructions.app.eitherHeader") }),
          ]),
          ...(signingMode === "fireflies_hmac" ? [] : [
            t("componentsRoutineTriggers.instructions.app.customHeaders", { secret: webhookSecret }),
          ]),
          t("componentsRoutineTriggers.instructions.app.subscribe"),
          t("componentsRoutineTriggers.instructions.app.addWebhook"),
          t("componentsRoutineTriggers.instructions.app.idempotency"),
          t("componentsRoutineTriggers.instructions.app.example", { example: '{"event":"deployment.completed","environment":"production"}' }),
          t("componentsRoutineTriggers.instructions.app.check"),
        ];
  return [
    ...common,
    ...auth,
    t("componentsRoutineTriggers.instructions.arrived"),
    ...(setupPending
      ? [
          t("componentsRoutineTriggers.instructions.pending.test"),
          t("componentsRoutineTriggers.instructions.pending.finish"),
        ]
      : [
          t("componentsRoutineTriggers.instructions.enabled"),
        ]),
    signingMode === "none"
      ? t("componentsRoutineTriggers.instructions.storeUrl")
      : t("componentsRoutineTriggers.instructions.storeKey"),
  ].join("\n");
}
