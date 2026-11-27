/**
 * Single source of truth for adapter display metadata.
 *
 * Built-in adapters have entries in `adapterDisplayMap`. External (plugin)
 * adapters get sensible defaults derived from their type string via
 * `getAdapterDisplay()`.
 */
import { t } from "@/i18n";
import type { ComponentType } from "react";
import { agentHarnessType } from "@paperclipai/shared";
import {
  Bot,
  Code,
  Gem,
  Moon,
  MousePointer2,
  Sparkles,
  Terminal,
  Cpu,
} from "lucide-react";
import { OpenCodeLogoIcon } from "@/components/OpenCodeLogoIcon";
import { pendingAgentSetupDisplayAdapter } from "@/lib/agent-setup-choice";

// ---------------------------------------------------------------------------
// Type suffix parsing
// ---------------------------------------------------------------------------

// Suffixes stripped from type ids when deriving a human-readable label for
// unknown (plugin) adapter types. "_local" is a legacy qualifier from before
// first-class Environments and is never displayed; "_gateway" is re-appended
// as " (gateway)" to disambiguate gateway variants. Known adapters in
// `adapterDisplayMap` have final labels and never get a derived suffix.
const STRIPPED_TYPE_SUFFIXES = ["_local", "_gateway"] as const;

const DISPLAY_SUFFIXES: Record<string, string> = {
  _gateway: "gateway",
};

function getTypeSuffix(type: string): string | null {
  for (const [suffix, mode] of Object.entries(DISPLAY_SUFFIXES)) {
    if (type.endsWith(suffix)) return mode;
  }
  return null;
}

function withSuffix(label: string, suffix: string | null): string {
  return suffix ? `${label} (${suffix})` : label;
}

// ---------------------------------------------------------------------------
// Display metadata per adapter type
// ---------------------------------------------------------------------------

export interface AdapterDisplayInfo {
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  recommended?: boolean;
  comingSoon?: boolean;
  disabledLabel?: string;
  experimental?: boolean;
  hideFromVisualSelection?: boolean;
}

const adapterDisplayMap: Record<string, AdapterDisplayInfo> = {
  antigravity_runtime: { label: "Google Antigravity", description: t("adaptersAdapterDisplayRegistry.description.antigravityRuntime"), icon: Gem, hideFromVisualSelection: true },
  copilot_runtime: { label: "GitHub Copilot", description: t("adaptersAdapterDisplayRegistry.description.copilotRuntime"), icon: Code, hideFromVisualSelection: true },
  kimi_runtime: { label: t("adaptersAdapterDisplayRegistry.label.kimiRuntime"), description: t("adaptersAdapterDisplayRegistry.description.kimiRuntime"), icon: Moon, hideFromVisualSelection: true },
  acpx_local: {
    label: t("adaptersAdapterDisplayRegistry.label.acpxLocal"),
    description: t("adaptersAdapterDisplayRegistry.description.acpxLocal"),
    icon: Bot,
    comingSoon: true,
    disabledLabel: t("adaptersAdapterDisplayRegistry.disabledLabel.acpxLocal"),
    hideFromVisualSelection: true,
  },
  claude_local: {
    label: "Claude Code",
    description: t("adaptersAdapterDisplayRegistry.description.claudeLocal"),
    icon: Sparkles,
    recommended: true,
  },
  codex_local: {
    label: "Codex",
    description: t("adaptersAdapterDisplayRegistry.description.codexLocal"),
    icon: Code,
    recommended: true,
  },
  paperclip_runner: {
    label: "Paperclip Runner",
    description: t("adaptersAdapterDisplayRegistry.description.paperclipRunner"),
    icon: Cpu,
    experimental: true,
  },
  gemini_local: {
    label: "Gemini CLI",
    description: t("adaptersAdapterDisplayRegistry.description.geminiLocal"),
    icon: Gem,
  },
  grok_local: {
    label: "Grok Build",
    description: t("adaptersAdapterDisplayRegistry.description.grokLocal"),
    icon: Bot,
  },
  kimi_local: {
    label: "Kimi Code",
    description: t("adaptersAdapterDisplayRegistry.description.kimiLocal"),
    icon: Moon,
  },
  hermes_gateway: {
    label: "Hermes Gateway",
    description: t("adaptersAdapterDisplayRegistry.description.hermesGateway"),
    icon: Bot,
    hideFromVisualSelection: true,
  },
  hermes_local: {
    label: "Hermes",
    description: t("adaptersAdapterDisplayRegistry.description.hermesLocal"),
    icon: Bot,
  },
  opencode_local: {
    label: "OpenCode",
    description: t("adaptersAdapterDisplayRegistry.description.opencodeLocal"),
    icon: OpenCodeLogoIcon,
  },
  pi_local: {
    label: "Pi",
    description: t("adaptersAdapterDisplayRegistry.description.piLocal"),
    icon: Terminal,
  },
  cursor: {
    label: "Cursor",
    description: t("adaptersAdapterDisplayRegistry.description.cursor"),
    icon: MousePointer2,
  },
  // Display-only choice: persisted as paperclip_runner with provider openai_dot.
  grok_bot: { label: "Grok Bot", experimental: true, icon: Bot, description: t("adaptersAdapterDisplayRegistry.description.grokBot") },
  openai_dot: {
    label: "OpenAI Dot",
    description: t("adaptersAdapterDisplayRegistry.description.openaiDot"),
    icon: Bot,
    experimental: true,
  },
  muse: {
    label: t("adaptersAdapterDisplayRegistry.label.muse"),
    description: t("adaptersAdapterDisplayRegistry.description.muse"),
    icon: Bot,
    experimental: true,
  },
  cursor_cloud: {
    label: "Cursor Cloud",
    description: t("adaptersAdapterDisplayRegistry.description.cursorCloud"),
    icon: MousePointer2,
  },
  openclaw_gateway: {
    label: "OpenClaw Gateway",
    description: t("adaptersAdapterDisplayRegistry.description.openclawGateway"),
    icon: Bot,
    comingSoon: true,
    disabledLabel: t("adaptersAdapterDisplayRegistry.disabledLabel.openclawGateway"),
    hideFromVisualSelection: true,
  },
  process: {
    label: t("adaptersAdapterDisplayRegistry.label.process"),
    description: t("adaptersAdapterDisplayRegistry.description.process"),
    icon: Cpu,
    comingSoon: true,
  },
  http: {
    label: "HTTP",
    description: t("adaptersAdapterDisplayRegistry.description.http"),
    icon: Cpu,
    comingSoon: true,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function humanizeType(type: string): string {
  // Strip known type suffixes so "droid_local" → "Droid", not "Droid Local"
  let base = type;
  for (const suffix of STRIPPED_TYPE_SUFFIXES) {
    if (base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length);
      break;
    }
  }
  return base.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getAdapterLabel(type: string): string {
  // Known labels are final — only unknown (plugin) types get a derived
  // suffix, so labels like "OpenClaw Gateway" don't become
  // "OpenClaw Gateway (gateway)".
  const known = adapterDisplayMap[type];
  if (known) return known.label;
  return withSuffix(humanizeType(type), getTypeSuffix(type));
}

export function getAdapterLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const [type, info] of Object.entries(adapterDisplayMap)) {
    labels[type] = info.label;
  }
  return labels;
}

export function getAdapterDisplay(type: string): AdapterDisplayInfo {
  const known = adapterDisplayMap[type];
  if (known) return known;

  const suffix = getTypeSuffix(type);
  const label = withSuffix(humanizeType(type), suffix);
  return {
    label,
    description: suffix ? t("adaptersAdapterDisplayRegistry.externalSuffixAdapter", { suffix }) : t("adaptersAdapterDisplayRegistry.externalAdapter"),
    icon: Cpu,
  };
}

export function agentDisplayAdapterType(agent: { adapterType: string; adapterConfig: Record<string, unknown>; pauseReason?: unknown; metadata?: unknown }): string {
  const pendingSetup = pendingAgentSetupDisplayAdapter(agent);
  if (pendingSetup) return pendingSetup;
  if (agent.adapterType !== "paperclip_runner") return agent.adapterType;
  if (agent.adapterConfig.provider === "openai_dot" || agent.adapterConfig.provider === "grok_bot" || agent.adapterConfig.provider === "muse") {
    return agent.adapterConfig.provider;
  }
  const harness = agentHarnessType(agent.adapterType, agent.adapterConfig);
  return ["codex_local", "claude_local", "opencode_local", "pi_local", "antigravity_runtime"].includes(harness) ? harness : agent.adapterType;
}

export function isKnownAdapterType(type: string): boolean {
  return type in adapterDisplayMap;
}
