import { Languages } from "lucide-react";

import { i18n, localeDisplayName, selectableLocales, setLocale, t } from "@/i18n";

/**
 * Account-menu row that switches the interface language. A native select
 * keeps it keyboard- and screen-reader-friendly; choosing a language saves
 * it and reloads the page so every string renders again in it.
 */
export function LanguageMenuAction() {
  if (selectableLocales.length < 2) return null;
  const current = selectableLocales.includes(i18n.language) ? i18n.language : "en";

  return (
    <label className="relative flex h-(--profile-popover-row-height) w-full cursor-pointer items-center gap-(--profile-popover-row-gap) rounded-lg px-2.5 text-left text-(length:--text-compact) font-medium leading-(--profile-popover-label-line-height) text-foreground transition-colors hover:bg-accent">
      <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
        <Languages className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{t("language.menuLabel")}</span>
      <span className="shrink-0 text-muted-foreground">{localeDisplayName(current)}</span>
      <select
        aria-label={t("language.selectLabel")}
        className="absolute inset-0 cursor-pointer opacity-0"
        value={current}
        onChange={(event) => setLocale(event.target.value)}
      >
        {selectableLocales.map((locale) => (
          <option key={locale} value={locale}>
            {localeDisplayName(locale)}
          </option>
        ))}
      </select>
    </label>
  );
}
