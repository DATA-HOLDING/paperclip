import { Activity, LayoutGrid, KeyRound, Wrench, Boxes } from "lucide-react";
import { t } from "@/i18n";

/**
 * Gateway detail tabs (PAP-11200). Terminology is locked by the approved
 * PAP-11178 design of record: Overview · Apps & tools · Tokens · Activity ·
 * Advanced. Raw protocol / JSON / transport details live under Advanced.
 */
export const GATEWAY_TABS = [
  { key: "overview", label: t("pagesAppsGateways.tabs.overview"), icon: LayoutGrid },
  { key: "apps", label: t("pagesAppsGateways.tabs.apps"), icon: Boxes },
  { key: "tokens", label: t("pagesAppsGateways.tabs.tokens"), icon: KeyRound },
  { key: "activity", label: t("pagesAppsGateways.tabs.activity"), icon: Activity },
  { key: "advanced", label: t("pagesAppsGateways.tabs.advanced"), icon: Wrench },
] as const;

export type GatewayTabKey = (typeof GATEWAY_TABS)[number]["key"];

export function gatewayTabHref(gatewayId: string, tab: GatewayTabKey): string {
  return `/apps/gateways/${gatewayId}/${tab}`;
}

export function isGatewayTabKey(value: string | undefined): value is GatewayTabKey {
  return GATEWAY_TABS.some((tab) => tab.key === value);
}

export function gatewayTabLabel(tabKey: GatewayTabKey): string {
  return GATEWAY_TABS.find((tab) => tab.key === tabKey)?.label ?? t("pagesAppsGateways.tabs.overview");
}
