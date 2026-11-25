import { useEffect } from "react";
import { useParams } from "@/lib/router";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { advancedTabHref } from "../tool-tabs";
import { ToolsAdminGate } from "./ToolsAdminGate";
import { ProfileDetail } from "./ProfileDetail";
import { t } from "@/i18n";

export function ProfileDetailRoute() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const params = useParams<{ profileId?: string }>();

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? t("pagesToolsProfiles.breadcrumbs.company"), href: "/dashboard" },
      { label: t("pagesToolsProfiles.breadcrumbs.apps"), href: "/apps" },
      { label: t("pagesToolsProfiles.breadcrumbs.accessProfiles"), href: advancedTabHref("profiles") },
      { label: t("pagesToolsProfiles.breadcrumbs.profileDetail") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  if (!selectedCompanyId || !params.profileId) {
    return <div className="p-6 text-sm text-muted-foreground">{t("pagesToolsProfiles.detailRoute.selectOrganizationAndProfile")}</div>;
  }

  return (
    <ToolsAdminGate>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
        <ProfileDetail companyId={selectedCompanyId} profileId={params.profileId} />
      </div>
    </ToolsAdminGate>
  );
}
