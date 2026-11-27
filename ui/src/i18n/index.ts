import i18n, { type InitOptions, type TOptions } from "i18next";
import { initReactI18next, useTranslation as useReactI18nextTranslation } from "react-i18next";

import { DEFAULT_LOCALE, i18nextResources, localeMessages, supportedLocales } from "./locales";

/** Where the person's language choice is kept (per browser). */
export const LOCALE_STORAGE_KEY = "paperclip.locale";

/**
 * Locales offered in the language menu: English plus the catalogs that
 * translate whole UI areas (`locales/<locale>/<area>.json`). The other
 * bundled catalogs only cover a few strings, so offering them would show an
 * almost fully English UI under another language's name.
 */
export const selectableLocales: string[] = [
  DEFAULT_LOCALE,
  ...supportedLocales.filter((locale) => {
    if (locale === DEFAULT_LOCALE) return false;
    const messages = localeMessages[locale] ?? {};
    return Object.keys(messages).some((area) => area !== "app");
  }),
];

/** The locale's own name, e.g. "Português (Brasil)". */
export function localeDisplayName(locale: string) {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(locale);
    return name ? name.charAt(0).toLocaleUpperCase(locale) + name.slice(1) : locale;
  } catch {
    return locale;
  }
}

function storedLocale() {
  try {
    return globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Matches a browser tag ("pt-BR", "pt", "en-US") to an offered locale. */
export function matchLocale(tag: string | null | undefined, offered: string[] = selectableLocales) {
  if (!tag) return null;
  const exact = offered.find((locale) => locale.toLowerCase() === tag.toLowerCase());
  if (exact) return exact;
  const base = tag.split("-")[0]?.toLowerCase();
  return offered.find((locale) => locale.split("-")[0]?.toLowerCase() === base) ?? null;
}

/**
 * The language the UI starts in: the person's saved choice, else the first
 * browser language with a translated catalog, else English. Decided once at
 * startup, before anything renders, so module-level `t()` calls already see
 * it; changing the language reloads the page (`setLocale`).
 */
export function initialLocale() {
  const saved = matchLocale(storedLocale());
  if (saved) return saved;
  const browser =
    typeof navigator === "undefined" ? [] : [...(navigator.languages ?? []), navigator.language];
  for (const tag of browser) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

const i18nextOptions: InitOptions = {
  resources: i18nextResources,
  lng: initialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: supportedLocales,
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  returnObjects: false,
  initAsync: false,
};

void i18n.use(initReactI18next).init(i18nextOptions).catch((error: unknown) => {
  console.error("Failed to initialize i18next", error);
});

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language;
}

export function t(key: string, options: TOptions = {}) {
  return i18n.t(key, options);
}

/** Saves the choice and reloads, so every string is rendered again in it. */
export function setLocale(locale: string) {
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Private mode: the choice lasts only for this page.
  }
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

export const useTranslation = useReactI18nextTranslation;
export { i18n };
