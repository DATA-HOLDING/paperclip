import { t } from "@/i18n";
/**
 * Prosumer copy for the Apps surface (PAP-10856).
 *
 * The P1a gallery manifest carries developer-flavoured taglines and credential
 * labels (e.g. "Connect Zapier-hosted MCP actions", "Zapier MCP token"). Those
 * strings would fail the vocabulary gate from PAP-10827 — no "MCP", "server",
 * "profile", "policy", "gateway", or "transport" anywhere on this surface. So
 * the UI never renders the raw manifest copy directly: it looks up plain copy
 * here, and `sanitizeProsumerCopy` is a final backstop for any free-text we do
 * surface (app names, fallback taglines).
 */

/** Words that must never appear in prosumer-facing copy on the Apps surface. */
const BANNED_WORDS = [
  "mcp",
  "server",
  "profile",
  "policy",
  "gateway",
  "transport",
  "stdio",
  "endpoint",
];

const BANNED_RE = new RegExp(`\\b(${BANNED_WORDS.join("|")})s?\\b`, "gi");

/**
 * Strip banned vocabulary from a free-text string as a last-resort backstop.
 * Prefer curated copy below; this only protects against manifest text we can't
 * fully control (e.g. a newly added gallery app with no curated entry yet).
 */
export function sanitizeProsumerCopy(text: string): string {
  return text
    .replace(BANNED_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

export interface AppCopy {
  /** Two short lines for the gallery card (M2). */
  tagline: string;
  /** Single line for the connect step header (M3b). */
  short: string;
}

/**
 * Curated prosumer copy keyed by gallery key. Taken from the M-series wires
 * (https://happy-grove-jzyc.here.now/). Apps without an entry fall back to a
 * generic, gate-safe line.
 */
const APP_COPY: Record<string, AppCopy> = {
  zapier: {
    tagline: t("libAppGalleryCopy.apps.zapier.tagline"),
    short: t("libAppGalleryCopy.apps.zapier.short"),
  },
  github: {
    tagline: t("libAppGalleryCopy.apps.github.tagline"),
    short: t("libAppGalleryCopy.apps.github.short"),
  },
  slack: {
    tagline: t("libAppGalleryCopy.apps.slack.tagline"),
    short: t("libAppGalleryCopy.apps.slack.short"),
  },
  notion: {
    tagline: t("libAppGalleryCopy.apps.notion.tagline"),
    short: t("libAppGalleryCopy.apps.notion.short"),
  },
  railway: {
    tagline: t("libAppGalleryCopy.apps.railway.tagline"),
    short: t("libAppGalleryCopy.apps.railway.short"),
  },
  posthog: {
    tagline: t("libAppGalleryCopy.apps.posthog.tagline"),
    short: t("libAppGalleryCopy.apps.posthog.short"),
  },
  ditto: {
    tagline: t("libAppGalleryCopy.apps.ditto.tagline"),
    short: t("libAppGalleryCopy.apps.ditto.short"),
  },
  circleback: {
    tagline: t("libAppGalleryCopy.apps.circleback.tagline"),
    short: t("libAppGalleryCopy.apps.circleback.short"),
  },
  gauge: {
    tagline: t("libAppGalleryCopy.apps.gauge.tagline"),
    short: t("libAppGalleryCopy.apps.gauge.short"),
  },
  neon: {
    tagline: t("libAppGalleryCopy.apps.neon.tagline"),
    short: t("libAppGalleryCopy.apps.neon.short"),
  },
  superagent: {
    tagline: t("libAppGalleryCopy.apps.superagent.tagline"),
    short: t("libAppGalleryCopy.apps.superagent.short"),
  },
  linear: {
    tagline: t("libAppGalleryCopy.apps.linear.tagline"),
    short: t("libAppGalleryCopy.apps.linear.short"),
  },
  "google-sheets": {
    tagline: t("libAppGalleryCopy.apps.googleSheets.tagline"),
    short: t("libAppGalleryCopy.apps.googleSheets.short"),
  },
  gmail: {
    tagline: t("libAppGalleryCopy.apps.gmail.tagline"),
    short: t("libAppGalleryCopy.apps.gmail.short"),
  },
  "google-drive": {
    tagline: t("libAppGalleryCopy.apps.googleDrive.tagline"),
    short: t("libAppGalleryCopy.apps.googleDrive.short"),
  },
  "google-docs": {
    tagline: t("libAppGalleryCopy.apps.googleDocs.tagline"),
    short: t("libAppGalleryCopy.apps.googleDocs.short"),
  },
  "google-slides": {
    tagline: t("libAppGalleryCopy.apps.googleSlides.tagline"),
    short: t("libAppGalleryCopy.apps.googleSlides.short"),
  },
  "google-calendar": {
    tagline: t("libAppGalleryCopy.apps.googleCalendar.tagline"),
    short: t("libAppGalleryCopy.apps.googleCalendar.short"),
  },
  "google-chat": {
    tagline: t("libAppGalleryCopy.apps.googleChat.tagline"),
    short: t("libAppGalleryCopy.apps.googleChat.short"),
  },
  "google-people": {
    tagline: t("libAppGalleryCopy.apps.googlePeople.tagline"),
    short: t("libAppGalleryCopy.apps.googlePeople.short"),
  },
  "google-workspace-search": {
    tagline: t("libAppGalleryCopy.apps.googleWorkspaceSearch.tagline"),
    short: t("libAppGalleryCopy.apps.googleWorkspaceSearch.short"),
  },
  hubspot: {
    tagline: t("libAppGalleryCopy.apps.hubspot.tagline"),
    short: t("libAppGalleryCopy.apps.hubspot.short"),
  },
  intercom: {
    tagline: t("libAppGalleryCopy.apps.intercom.tagline"),
    short: t("libAppGalleryCopy.apps.intercom.short"),
  },
  figma: {
    tagline: t("libAppGalleryCopy.apps.figma.tagline"),
    short: t("libAppGalleryCopy.apps.figma.short"),
  },
  stripe: {
    tagline: t("libAppGalleryCopy.apps.stripe.tagline"),
    short: t("libAppGalleryCopy.apps.stripe.short"),
  },
  context7: {
    tagline: t("libAppGalleryCopy.apps.context7.tagline"),
    short: t("libAppGalleryCopy.apps.context7.short"),
  },
};

const GENERIC: AppCopy = {
  tagline: t("libAppGalleryCopy.generic"),
  short: t("libAppGalleryCopy.generic"),
};

/** Curated, gate-safe copy for a gallery app. */
export function appCopyFor(key: string, fallbackTagline?: string | null): AppCopy {
  const curated = APP_COPY[key];
  if (curated) return curated;
  if (fallbackTagline) {
    const cleaned = sanitizeProsumerCopy(fallbackTagline);
    if (cleaned) return { tagline: cleaned, short: cleaned };
  }
  return GENERIC;
}

/**
 * Label for a single credential field on the key-paste step (M3b). The raw
 * manifest label can contain banned vocab ("Zapier MCP token"), so for the
 * common single-field case we present "Your {App} key" per the wires; multi-
 * field apps fall back to a sanitized version of the manifest label.
 */
export function credentialFieldLabel(
  appName: string,
  rawLabel: string,
  fieldCount: number,
): string {
  if (/^Paste your\b/.test(rawLabel)) return sanitizeProsumerCopy(rawLabel);
  if (fieldCount <= 1) return t("libAppGalleryCopy.yourKey", { appName });
  const cleaned = sanitizeProsumerCopy(rawLabel);
  return cleaned || t("libAppGalleryCopy.yourKey", { appName });
}
