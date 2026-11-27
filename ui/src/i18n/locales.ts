import type { Resource } from "i18next";

import { assertValidLocaleMessages } from "./locale-validation";

export const DEFAULT_LOCALE = "en" as const;

type Messages = Record<string, unknown>;

// Two layouts are read:
//
// * `locales/<locale>.json` — the original single-file catalogs;
// * `locales/<locale>/<area>.json` — one file per UI area. The file name is
//   the top-level key, so `locales/pt-BR/issues.json` holds `issues.*`. One
//   area per file lets translations land in small, independent changes
//   instead of one catalog every contributor edits at once.
const singleFileModules = import.meta.glob("./locales/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const areaModules = import.meta.glob("./locales/*/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

function isPlainObject(value: unknown): value is Messages {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeInto(target: Messages, source: Messages) {
  for (const [key, value] of Object.entries(source)) {
    const current = target[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      mergeInto(current, value);
    } else {
      target[key] = value;
    }
  }
}

function buildLocaleMessages() {
  const messages: Record<string, Messages> = {};

  for (const [path, catalog] of Object.entries(singleFileModules)) {
    const locale = path.match(/\/([A-Za-z0-9_-]+)\.json$/)?.[1];
    if (!locale) {
      throw new Error(`Invalid locale file path: ${path}`);
    }
    if (!isPlainObject(catalog)) {
      throw new Error(`Invalid ${locale} locale messages: <root> must be an object`);
    }
    mergeInto((messages[locale] ??= {}), structuredClone(catalog));
  }

  for (const [path, catalog] of Object.entries(areaModules)) {
    const match = path.match(/\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\.json$/);
    if (!match) {
      throw new Error(`Invalid locale file path: ${path}`);
    }
    const [, locale, area] = match;
    if (!isPlainObject(catalog)) {
      throw new Error(`Invalid ${locale} locale messages: ${area} must be an object`);
    }
    mergeInto((messages[locale] ??= {}), { [area]: structuredClone(catalog) });
  }

  return messages;
}

export const localeMessages = buildLocaleMessages();

if (!(DEFAULT_LOCALE in localeMessages)) {
  throw new Error(`Missing default locale messages for ${DEFAULT_LOCALE}`);
}

for (const [locale, messages] of Object.entries(localeMessages)) {
  try {
    assertValidLocaleMessages(messages, localeMessages[DEFAULT_LOCALE]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${locale} locale messages: ${message}`);
  }
}

export const supportedLocales = Object.keys(localeMessages);

export const i18nextResources: Resource = Object.fromEntries(
  Object.entries(localeMessages).map(([locale, messages]) => [locale, { translation: messages }]),
) as Resource;

export type SupportedLocale = keyof typeof localeMessages;
