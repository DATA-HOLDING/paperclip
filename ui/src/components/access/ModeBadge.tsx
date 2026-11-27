import type { DeploymentExposure, DeploymentMode } from "@paperclipai/shared";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";

export function ModeBadge({
  deploymentMode,
  deploymentExposure,
}: {
  deploymentMode?: DeploymentMode;
  deploymentExposure?: DeploymentExposure;
}) {
  if (!deploymentMode) return null;

  const label =
    deploymentMode === "local_trusted"
      ? t("componentsAccess.modeBadge.localTrusted")
      : t("componentsAccess.modeBadge.authenticated", { exposure: deploymentExposure === "public" ? t("componentsAccess.modeBadge.exposure.public") : deploymentExposure ?? t("componentsAccess.modeBadge.exposure.private") });

  return <Badge variant="outline">{label}</Badge>;
}
