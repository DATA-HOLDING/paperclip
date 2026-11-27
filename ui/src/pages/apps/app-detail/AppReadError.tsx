import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/router";
import { QueryErrorState, type QueryViewSize, type QueryViewState } from "@/components/QueryView";
import { t } from "@/i18n";

export function AppReadError({ failure, onRetry, action = t("pagesAppsAppDetail.appReadError.defaultAction"), size = "panel" }: {
  failure: QueryViewState<unknown>;
  onRetry?: () => void;
  action?: string;
  size?: QueryViewSize;
}) {
  return <div className={size === "page" ? undefined : "py-8"}>
    <QueryErrorState size={size} error={failure.error} action={action}
      onRetry={() => { failure.retry(); onRetry?.(); }} retrying={failure.isFetching} />
  </div>;
}

export function AppNotFound() {
  const navigate = useNavigate();
  return <div className="max-w-3xl p-6">
    <p className="text-sm text-muted-foreground">{t("pagesAppsAppDetail.appReadError.notFound")}</p>
    <Button className="mt-4" variant="outline" onClick={() => navigate("/apps")}>{t("pagesAppsAppDetail.appReadError.backToConnectors")}</Button>
  </div>;
}
