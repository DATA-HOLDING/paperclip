import type { LucideIcon } from "lucide-react";
import { Activity, Bot, MessageSquare, Plug, Repeat } from "lucide-react";
import { t } from "@/i18n";

/**
 * Where a secret came from, inferred from the naming conventions of the
 * server modules that create secrets on a person's behalf:
 * connection credentials (`tool_app.*`, `tool_oauth.*`, `slack_manager.*`),
 * chat channels (`chat.<platform>.*`), model sign-ins (`ai_*` / `ai-*`),
 * routine webhooks (`routine-<id>-*`) and the observability exporter
 * (`agent-observability.*`). Secrets do not record their origin yet, so this
 * is a presentation-only grouping: it never gates an action.
 */
export type SecretOrigin = "team" | "connections" | "chat" | "models" | "routines" | "observability";

export interface SecretOriginGroup {
  id: Exclude<SecretOrigin, "team">;
  label: string;
  detail: string;
  icon: LucideIcon;
}

export const SECRET_ORIGIN_GROUPS: SecretOriginGroup[] = [
  { id: "models", label: t("pagesSecretsSecretOrigin.groups.models.label"), detail: t("pagesSecretsSecretOrigin.groups.models.detail"), icon: Bot },
  { id: "connections", label: t("pagesSecretsSecretOrigin.groups.connections.label"), detail: t("pagesSecretsSecretOrigin.groups.connections.detail"), icon: Plug },
  { id: "chat", label: t("pagesSecretsSecretOrigin.groups.chat.label"), detail: t("pagesSecretsSecretOrigin.groups.chat.detail"), icon: MessageSquare },
  { id: "routines", label: t("pagesSecretsSecretOrigin.groups.routines.label"), detail: t("pagesSecretsSecretOrigin.groups.routines.detail"), icon: Repeat },
  { id: "observability", label: t("pagesSecretsSecretOrigin.groups.observability.label"), detail: t("pagesSecretsSecretOrigin.groups.observability.detail"), icon: Activity },
];

const UUID = "[0-9a-f]{8}[-_][0-9a-f]{4}[-_][0-9a-f]{4}[-_][0-9a-f]{4}[-_][0-9a-f]{12}";
const MODEL_KEY = new RegExp(`^ai[-_]${UUID}$`, "i");
const ROUTINE_NAME = new RegExp(`^routine-${UUID}-[0-9a-f]+$`, "i");

export function classifySecretOrigin(input: { key: string; name: string }): SecretOrigin {
  const key = input.key.toLowerCase();
  const name = input.name.toLowerCase();
  if (key.startsWith("tool_app.") || key.startsWith("tool_oauth.") || key.startsWith("slack_manager.")) return "connections";
  if (MODEL_KEY.test(key) || MODEL_KEY.test(name)) return "models";
  if (name.startsWith("chat.") || key.startsWith("chat_") || key.startsWith("chat.")) return "chat";
  if (ROUTINE_NAME.test(name)) return "routines";
  if (name.startsWith("agent-observability.") || key.startsWith("agent_observability_headers_")) return "observability";
  return "team";
}

function words(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
}

const PLATFORM_NAMES: Record<string, string> = { github: "GitHub" };

function platformName(value: string): string {
  return PLATFORM_NAMES[value.toLowerCase()] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);
}

/**
 * A readable name for a secret Paperclip created itself. Their stored names
 * carry record IDs; people should see what the secret is for instead.
 */
export function managedSecretLabel(input: { key: string; name: string }, origin: SecretOrigin): string {
  const name = input.name.trim();
  if (origin === "chat") {
    const [, platform, , field] = name.split(".");
    if (platform && field) return t("pagesSecretsSecretOrigin.managed.chatField", { platform: platformName(platform), field: words(field) });
  }
  if (origin === "routines") return t("pagesSecretsSecretOrigin.managed.routineWebhook");
  if (origin === "observability") return t("pagesSecretsSecretOrigin.managed.traceHeaders");
  if (origin === "models" && MODEL_KEY.test(name)) return t("pagesSecretsSecretOrigin.managed.modelKey");
  if (origin === "connections") return name.replace(/\s+[0-9a-f]{8}$/i, "");
  return name;
}
