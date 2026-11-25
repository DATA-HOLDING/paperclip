import { t } from "@/i18n";
export interface ConfigurationStep { label: string; apply: () => Promise<unknown> }
export type AddConfigurationStep = (label: string, apply: ConfigurationStep["apply"]) => void;

export function unique(values: string[], field: string) {
  if (new Set(values).size !== values.length) throw new Error(t("libAgentConfiguration.steps.duplicateEntries", { field }));
}

export function requireItem<T>(items: readonly T[], matches: (item: T) => boolean, label: string): T {
  const item = items.find(matches);
  if (!item) throw new Error(t("libAgentConfiguration.steps.itemNotSaved", { label }));
  return item;
}

export function requireExplicitFields(before: object, after: object, path: string) {
  for (const [key, value] of Object.entries(before)) {
    if (value !== undefined && !Object.hasOwn(after, key)) throw new Error(t("libAgentConfiguration.steps.keepExplicit", { path, key }));
  }
}
