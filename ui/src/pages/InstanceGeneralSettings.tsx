import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PatchInstanceGeneralSettings, BackupRetentionPolicy } from "@paperclipai/shared";
import {
  DAILY_RETENTION_PRESETS,
  WEEKLY_RETENTION_PRESETS,
  MONTHLY_RETENTION_PRESETS,
  DEFAULT_BACKUP_RETENTION,
} from "@paperclipai/shared";
import { LogOut, SlidersHorizontal } from "lucide-react";
import { describeError } from "@/api/errors";
import { healthApi } from "@/api/health";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import { ModeBadge } from "@/components/access/ModeBadge";
import { Button } from "../components/ui/button";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { cn } from "../lib/utils";
import { useSignOut } from "@/hooks/useSignOut";
import { t } from "@/i18n";

const FEEDBACK_TERMS_URL = import.meta.env.VITE_FEEDBACK_TERMS_URL?.trim() || "https://paperclip.ing/tos";

export function InstanceGeneralSettings({ embedded = false }: { embedded?: boolean }) {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const signOutMutation = useSignOut();

  useEffect(() => {
    if (embedded) return;
    setBreadcrumbs([
      { label: t("pagesInstanceGeneralSettings.breadcrumbs.settings"), href: "/company/settings" },
      { label: t("pagesInstanceGeneralSettings.breadcrumbs.general") },
    ]);
  }, [embedded, setBreadcrumbs]);

  const generalQuery = useQuery({
    queryKey: queryKeys.instance.generalSettings,
    queryFn: () => instanceSettingsApi.getGeneral(),
  });
  const generalView = useQueryView(generalQuery);
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
  });

  const updateGeneralMutation = useMutation({
    mutationFn: instanceSettingsApi.updateGeneral,
    onMutate: () => {
      setActionError(null);
      signOutMutation.reset();
    },
    onSuccess: async () => {
      setActionError(null);
      signOutMutation.reset();
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings });
    },
    onError: (error) => {
      setActionError(describeError(error).body);
    },
  });

  if (generalQuery.isLoading || generalView.kind === "reconnecting" || healthQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("pagesInstanceGeneralSettings.loading")}</div>;
  }

  if (generalView.kind === "error") {
    return (
      <QueryErrorState
        size={embedded ? "panel" : "page"}
        error={generalQuery.error}
        action={t("pagesInstanceGeneralSettings.loadAction")}
        onRetry={generalView.retry}
        retrying={generalView.isFetching}
      />
    );
  }

  const censorUsernameInLogs = generalQuery.data?.censorUsernameInLogs === true;
  const feedbackDataSharingPreference = generalQuery.data?.feedbackDataSharingPreference ?? "prompt";
  const backupRetention: BackupRetentionPolicy = generalQuery.data?.backupRetention ?? DEFAULT_BACKUP_RETENTION;
  const hiddenSettings = new Set(healthQuery.data?.hiddenSettings ?? []);
  const showDeploymentStatus = !hiddenSettings.has("instance.general.deploymentStatus");
  const showCensorUsernameInLogs = !hiddenSettings.has("instance.general.censorUsernameInLogs");
  const showBackupRetention = !hiddenSettings.has("instance.general.backupRetention");
  const showFeedbackDataSharing = !hiddenSettings.has("instance.general.feedbackDataSharingPreference");
  const showSignOut = !hiddenSettings.has("instance.general.signOut");
  const visibleTopics = [
    ...(showCensorUsernameInLogs ? [t("pagesInstanceGeneralSettings.topics.logDisplay")] : []),
    ...(showBackupRetention ? [t("pagesInstanceGeneralSettings.topics.backupRetention")] : []),
    ...(showFeedbackDataSharing ? [t("pagesInstanceGeneralSettings.topics.dataSharing")] : []),
  ];
  const topicSummary = visibleTopics.length > 2
    ? t("pagesInstanceGeneralSettings.topics.listWithLast", { list: visibleTopics.slice(0, -1).join(", "), last: visibleTopics[visibleTopics.length - 1] })
    : visibleTopics.length === 2
      ? t("pagesInstanceGeneralSettings.topics.pair", { first: visibleTopics[0], second: visibleTopics[1] })
      : visibleTopics.join("");
  const visibleActionError = signOutMutation.error
    ? describeError(signOutMutation.error).body
    : actionError;

  return (
    <div className={embedded ? "space-y-8" : "max-w-4xl space-y-8"}>
      {!embedded ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">{t("pagesInstanceGeneralSettings.title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {visibleTopics.length > 0
              ? t("pagesInstanceGeneralSettings.descriptionWithTopics", { topics: topicSummary })
              : t("pagesInstanceGeneralSettings.description")}
          </p>
        </div>
      ) : null}

      {visibleActionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {visibleActionError}
        </div>
      )}

      {showDeploymentStatus && (
      <section>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{t("pagesInstanceGeneralSettings.deployment.title")}</h2>
            <ModeBadge
              deploymentMode={healthQuery.data?.deploymentMode}
              deploymentExposure={healthQuery.data?.deploymentExposure}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {healthQuery.data?.deploymentMode === "local_trusted"
              ? t("pagesInstanceGeneralSettings.deployment.localTrusted")
              : healthQuery.data?.deploymentExposure === "public"
                ? t("pagesInstanceGeneralSettings.deployment.authenticatedPublic")
                : t("pagesInstanceGeneralSettings.deployment.authenticatedPrivate")}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <StatusBox
              label={t("pagesInstanceGeneralSettings.deployment.authReadiness")}
              value={healthQuery.data?.authReady ? t("pagesInstanceGeneralSettings.deployment.ready") : t("pagesInstanceGeneralSettings.deployment.notReady")}
            />
            <StatusBox
              label={t("pagesInstanceGeneralSettings.deployment.bootstrapStatus")}
              value={healthQuery.data?.bootstrapStatus === "bootstrap_pending" ? t("pagesInstanceGeneralSettings.deployment.setupRequired") : t("pagesInstanceGeneralSettings.deployment.ready")}
            />
            <StatusBox
              label={t("pagesInstanceGeneralSettings.deployment.bootstrapInvite")}
              value={healthQuery.data?.bootstrapInviteActive ? t("pagesInstanceGeneralSettings.deployment.active") : t("pagesInstanceGeneralSettings.deployment.none")}
            />
          </div>
        </div>
      </section>
      )}

      {showCensorUsernameInLogs && (
      <section>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("pagesInstanceGeneralSettings.censor.title")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("pagesInstanceGeneralSettings.censor.description")}
            </p>
          </div>
          <ToggleSwitch
            checked={censorUsernameInLogs}
            onCheckedChange={() => updateGeneralMutation.mutate({ censorUsernameInLogs: !censorUsernameInLogs })}
            disabled={updateGeneralMutation.isPending || signOutMutation.isPending}
            aria-label={t("pagesInstanceGeneralSettings.censor.toggle")}
          />
        </div>
      </section>
      )}

      {showBackupRetention && (
      <section>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("pagesInstanceGeneralSettings.backup.title")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("pagesInstanceGeneralSettings.backup.description")}
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("pagesInstanceGeneralSettings.backup.daily")}</h3>
            <div className="flex flex-wrap gap-2">
              {DAILY_RETENTION_PRESETS.map((days) => {
                const active = backupRetention.dailyDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    disabled={updateGeneralMutation.isPending || signOutMutation.isPending}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() =>
                      updateGeneralMutation.mutate({
                        backupRetention: { ...backupRetention, dailyDays: days },
                      })
                    }
                  >
                    <div className="text-sm font-medium">{t("pagesInstanceGeneralSettings.backup.days", { count: days })}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("pagesInstanceGeneralSettings.backup.weekly")}</h3>
            <div className="flex flex-wrap gap-2">
              {WEEKLY_RETENTION_PRESETS.map((weeks) => {
                const active = backupRetention.weeklyWeeks === weeks;
                const label = t("pagesInstanceGeneralSettings.backup.weeks", { count: weeks });
                return (
                  <button
                    key={weeks}
                    type="button"
                    disabled={updateGeneralMutation.isPending || signOutMutation.isPending}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() =>
                      updateGeneralMutation.mutate({
                        backupRetention: { ...backupRetention, weeklyWeeks: weeks },
                      })
                    }
                  >
                    <div className="text-sm font-medium">{label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("pagesInstanceGeneralSettings.backup.monthly")}</h3>
            <div className="flex flex-wrap gap-2">
              {MONTHLY_RETENTION_PRESETS.map((months) => {
                const active = backupRetention.monthlyMonths === months;
                const label = t("pagesInstanceGeneralSettings.backup.months", { count: months });
                return (
                  <button
                    key={months}
                    type="button"
                    disabled={updateGeneralMutation.isPending || signOutMutation.isPending}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() =>
                      updateGeneralMutation.mutate({
                        backupRetention: { ...backupRetention, monthlyMonths: months },
                      })
                    }
                  >
                    <div className="text-sm font-medium">{label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      )}

      {showFeedbackDataSharing && (
      <section>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("pagesInstanceGeneralSettings.feedback.title")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("pagesInstanceGeneralSettings.feedback.description")}
            </p>
            {FEEDBACK_TERMS_URL ? (
              <a
                href={FEEDBACK_TERMS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {t("pagesInstanceGeneralSettings.feedback.terms")}
              </a>
            ) : null}
          </div>
          {feedbackDataSharingPreference === "prompt" ? (
            <div className="rounded-lg bg-accent/20 px-3 py-2 text-sm text-muted-foreground">
              {t("pagesInstanceGeneralSettings.feedback.noDefault")}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {[
              {
                value: "allowed",
                label: t("pagesInstanceGeneralSettings.feedback.allow"),
                description: t("pagesInstanceGeneralSettings.feedback.allowDescription"),
              },
              {
                value: "not_allowed",
                label: t("pagesInstanceGeneralSettings.feedback.deny"),
                description: t("pagesInstanceGeneralSettings.feedback.denyDescription"),
              },
            ].map((option) => {
              const active = feedbackDataSharingPreference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={updateGeneralMutation.isPending || signOutMutation.isPending}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    active
                      ? "border-foreground bg-accent text-foreground"
                      : "border-border bg-background hover:bg-accent/50",
                  )}
                  onClick={() =>
                    updateGeneralMutation.mutate({
                      feedbackDataSharingPreference: option.value as
                        | "allowed"
                        | "not_allowed",
                    })
                  }
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("pagesInstanceGeneralSettings.devHint.removeThe")}{" "}
            <code>feedbackDataSharingPreference</code>{" "}{t("pagesInstanceGeneralSettings.devHint.keyFromThe")}{" "}
            <code>instance_settings.general</code>{" "}{t("pagesInstanceGeneralSettings.devHint.jsonRow")}{" "}
            <code>"prompt"</code>{t("pagesInstanceGeneralSettings.devHint.unsetAnd")}{" "}<code>"prompt"</code>{" "}{t("pagesInstanceGeneralSettings.devHint.bothMean")}
          </p>
        </div>
      </section>

      )}

      {showSignOut && (
      <section>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("pagesInstanceGeneralSettings.signOut.title")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("pagesInstanceGeneralSettings.signOut.description")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={signOutMutation.isPending || updateGeneralMutation.isPending}
            onClick={() => {
              setActionError(null);
              signOutMutation.mutate();
            }}
          >
            <LogOut className="size-4" />
            {signOutMutation.isPending ? t("pagesInstanceGeneralSettings.signOut.signingOut") : t("pagesInstanceGeneralSettings.signOut.action")}
          </Button>
        </div>
      </section>
      )}
    </div>
  );
}

function StatusBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
