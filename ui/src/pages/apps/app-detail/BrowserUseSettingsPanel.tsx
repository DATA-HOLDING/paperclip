import { useEffect, useId, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  ConnectionGrantsResponse,
  ToolConnection,
} from "@paperclipai/shared";
import { browserUseApi } from "@/api/browser-use";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { t } from "@/i18n";

function CredentialSettings({
  companyId,
  grantId,
}: {
  companyId: string;
  grantId: string;
}) {
  const id = useId();
  const saved = useQuery({
    queryKey: ["browser-use-cloud-settings", grantId],
    queryFn: () => browserUseApi.settings(companyId, grantId),
  });
  const profiles = useQuery({
    queryKey: ["browser-use-cloud-profiles", grantId],
    queryFn: () => browserUseApi.profiles(companyId, grantId),
  });
  const savedView = useQueryView(saved);
  const profilesView = useQueryView(profiles);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [limit, setLimit] = useState("");
  useEffect(() => {
    if (saved.data) {
      setAllowed(saved.data.allowedProfileIds);
      setLimit(saved.data.maxCostUsd?.toString() ?? "");
    }
  }, [saved.data]);
  const save = useMutation({
    mutationFn: () =>
      browserUseApi.saveSettings(companyId, grantId, {
        allowedProfileIds: allowed,
        maxCostUsd: limit ? Number(limit) : null,
      }),
    onSuccess: () => {
      void saved.refetch();
    },
  });
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${id}-limit`}>
          {t("pagesAppsAppDetail.browserUse.maxCost")}
        </Label>
        <Input
          id={`${id}-limit`}
          type="number"
          min="0"
          step="0.01"
          value={limit}
          placeholder={t("pagesAppsAppDetail.browserUse.maxCostPlaceholder")}
          onChange={(e) => setLimit(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          {t("pagesAppsAppDetail.browserUse.maxCostHelp")}
        </p>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("pagesAppsAppDetail.browserUse.allowedProfiles")}</legend>
        <p className="text-sm text-muted-foreground">
          {t("pagesAppsAppDetail.browserUse.profilesHelp")}{" "}
          <a
            href="https://cloud.browser-use.com"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Browser Use Cloud
          </a>
          .
        </p>
        {profiles.data?.map((p) => (
          <Label key={p.id} className="flex items-center gap-2">
            <Checkbox
              checked={allowed.includes(p.id)}
              onCheckedChange={(checked) =>
                setAllowed((previous) =>
                  checked
                    ? [...previous, p.id]
                    : previous.filter((id) => id !== p.id),
                )
              }
            />
            {p.name ?? p.id}
          </Label>
        ))}
        {profiles.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("pagesAppsAppDetail.browserUse.noProfiles")}</p>
        )}
        {(profiles.isLoading || profilesView.kind === "reconnecting") && (
          <p className="text-sm text-muted-foreground">{t("pagesAppsAppDetail.browserUse.loadingProfiles")}</p>
        )}
        {profilesView.kind === "error" && (
          <QueryErrorState
            size="inline"
            error={profiles.error}
            action={t("pagesAppsAppDetail.browserUse.loadProfilesAction")}
            onRetry={profilesView.retry}
            retrying={profilesView.isFetching}
          />
        )}
      </fieldset>
      {savedView.kind === "error" ? (
        <QueryErrorState
          error={saved.error}
          action={t("pagesAppsAppDetail.browserUse.loadSettingsAction")}
          onRetry={savedView.retry}
          retrying={savedView.isFetching}
        />
      ) : null}
      {save.error ? (
        <p role="alert" className="text-sm text-destructive">
          {t("pagesAppsAppDetail.browserUse.saveError")}
        </p>
      ) : null}
      {save.isSuccess && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("pagesAppsAppDetail.browserUse.saved")}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={
            !saved.data ||
            save.isPending ||
            Boolean(
              limit && (!Number.isFinite(Number(limit)) || Number(limit) <= 0),
            )
          }
          onClick={() => save.mutate()}
        >
          {t("pagesAppsAppDetail.browserUse.save")}
        </Button>
      </div>
    </div>
  );
}
export function BrowserUseSettingsPanel({
  connection,
  grants,
}: {
  connection: ToolConnection;
  grants?: ConnectionGrantsResponse;
}) {
  const eligible =
    grants?.grants.filter(
      (g) =>
        g.status === "active" &&
        ((g.kind === "organization" && g.capabilities?.canEditAudience) ||
          g.subjectUserId === grants.currentUserId ||
          g.createdByUserId === grants.currentUserId),
    ) ?? [];
  const [selected, setSelected] = useState("");
  const grantId = selected || eligible[0]?.id;
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{t("pagesAppsAppDetail.browserUse.title")}</h2>
      {eligible.length > 1 && (
        <Label className="flex flex-col gap-2">
          {t("pagesAppsAppDetail.browserUse.credential")}
          <select
            value={grantId}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border bg-background p-2"
          >
            {eligible.map((g, i) => (
              <option key={g.id} value={g.id}>
                {g.kind === "user" ? t("pagesAppsAppDetail.browserUse.personalCredential", { number: i + 1 }) : t("pagesAppsAppDetail.browserUse.sharedCredential", { number: i + 1 })}
              </option>
            ))}
          </select>
        </Label>
      )}
      {grantId ? (
        <CredentialSettings
          key={grantId}
          companyId={connection.companyId}
          grantId={grantId}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("pagesAppsAppDetail.browserUse.cannotConfigure")}
        </p>
      )}
    </section>
  );
}
