import { Copy } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { copyTextToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

export function gatewayEndpointUrl(endpointPath: string): string {
  if (typeof window === "undefined") return endpointPath;
  try {
    return new URL(endpointPath, window.location.origin).toString();
  } catch {
    return endpointPath;
  }
}

export function CopyableGatewayUrl({
  endpointPath,
  className,
}: {
  endpointPath: string;
  className?: string;
}) {
  const { pushToast } = useToast();
  const url = gatewayEndpointUrl(endpointPath);

  async function copy() {
    try {
      await copyTextToClipboard(url);
      pushToast({ title: t("pagesAppsGateways.copyUrl.copied"), tone: "success" });
    } catch {
      pushToast({
        title: t("pagesAppsGateways.copyUrl.copyFailed"),
        body: t("pagesAppsGateways.copyUrl.clipboardUnavailable"),
        tone: "error",
      });
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void copy();
      }}
      className={cn(
        "flex min-w-0 max-w-full items-center gap-1 text-left font-mono text-xs text-muted-foreground hover:text-foreground",
        className,
      )}
      title={t("pagesAppsGateways.copyUrl.title", { url })}
      aria-label={t("pagesAppsGateways.copyUrl.ariaLabel")}
    >
      <span className="min-w-0 truncate">{url}</span>
      <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </button>
  );
}
