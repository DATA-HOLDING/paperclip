import type { ToolConnection } from "@paperclipai/shared";
import { t } from "@/i18n";

export function connectionTransportLabel(transport: ToolConnection["transport"]): string {
  if (transport === "mcp_remote") return t("libConnectionTransportLabel.remoteHttp");
  if (transport === "local_stdio") return t("libConnectionTransportLabel.localCommand");
  return t("libConnectionTransportLabel.unknown");
}

export function auditTransportLabel(transport: string): string {
  return transport === "mcp_remote" || transport === "local_stdio" ? connectionTransportLabel(transport) : transport;
}
