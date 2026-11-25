import { aiConnectionCatalogSlug } from "@paperclipai/shared";
import { AppLogo } from "@/pages/apps/AppLogo";
import { ConnectionChoiceList } from "@/features/connections/ConnectionChoiceList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AI_PROVIDERS,
  aiConnectionProblem,
  aiMethodLabel,
  bindingProblem,
  matchesAiRequirement,
  personalAiDefault,
  isAiConnectionCompatibleForSelection,
  type AiConnectionBinding,
  type AiConnectionRequirement,
  type AiConnectionSummary,
} from "./model";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { t } from "@/i18n";

export interface AiConnectionPickerProps {
  requirement: AiConnectionRequirement;
  connections: AiConnectionSummary[];
  value?: AiConnectionBinding;
  currentUserId: string;
  agentId: string;
  agentName: string;
  adapterType?: string;
  model?: string;
  loading?: boolean;
  error?: string;
  readOnly?: boolean;
  onChange: (binding: AiConnectionBinding) => void;
  onConnect: () => void;
  onReconnect?: () => void;
  onRetry?: () => void;
}

export function AiConnectionPicker({
  requirement,
  connections,
  value,
  currentUserId,
  agentId,
  loading,
  error,
  readOnly,
  onChange,
  onConnect,
  onReconnect,
  onRetry,
  adapterType,
  model,
}: AiConnectionPickerProps) {
  const compatible = connections.filter((connection) =>
    matchesAiRequirement(connection, requirement)
      && (!adapterType || isAiConnectionCompatibleForSelection(connection, adapterType, model)),
  );
  const personalDefault = personalAiDefault(
    connections,
    requirement,
    currentUserId,
  );
  const defaultCompatible = !adapterType || isAiConnectionCompatibleForSelection(personalDefault ?? {
    provider: requirement.provider, method: requirement.method ?? "api_key", mode: "responsible_user",
  }, adapterType, model);
  const problem = value ? bindingProblem(
    value,
    requirement,
    connections,
    currentUserId,
    agentId,
  ) : undefined;
  const select = (
    mode: "shared",
    connection: AiConnectionSummary,
  ) =>
    onChange({
      provider: requirement.provider,
      method: connection.method,
      mode,
      connectionId: connection.id,
      grantId: connection.grantId,
    });
  return (
    <section className="flex flex-col gap-4" aria-label={t("componentsAiConnections.picker.aiConnection")}>
      <div className="flex items-center gap-3">
        <AppLogo
          name={AI_PROVIDERS[requirement.provider].name}
          brandKey={aiConnectionCatalogSlug(requirement.provider)}
          logoUrl={AI_PROVIDERS[requirement.provider].logo}
          darkLogoUrl={requirement.provider === "xai" ? "/brands/adapters/grok-dark.svg" : undefined}
          size={32}
        />
        <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-sm font-semibold">{t("componentsAiConnections.picker.aiConnection")}</h3>
        <p className="text-xs text-muted-foreground">
          {AI_PROVIDERS[requirement.provider].name}
          {value && value.mode !== "responsible_user" && ` · ${aiMethodLabel(value.provider, value.method)}`}
        </p>
        </div>
      </div>
      {loading ? (
        <div role="status" aria-label={t("componentsAiConnections.picker.loading")}>
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          {onRetry && (
            <Button type="button" variant="outline" onClick={onRetry}>
              {t("componentsAiConnections.picker.retry")}
            </Button>
          )}
        </div>
      ) : (
        <>
          <ConnectionChoiceList
            disabled={readOnly}
            selectedId={value?.mode === "responsible_user" ? "responsible_user" : value?.connectionId}
            choices={[
              { id: "responsible_user", name: t("componentsAiConnections.picker.responsibleUser"), disabled: !defaultCompatible, description: <>
                <span className="block">{t("componentsAiConnections.picker.forYou")}{" "}<span className={ANALYTICS_MASK_CLASS}>{personalDefault?.name ?? t("componentsAiConnections.picker.notConnected")}</span></span>
                <span className="block">{t("componentsAiConnections.picker.otherUsers", { provider: AI_PROVIDERS[requirement.provider].name })}</span>
                {!defaultCompatible && <span className="block">{t("componentsAiConnections.picker.incompatible")}</span>}
              </> },
              ...compatible.filter((connection) => connection.ownership === "shared").map((connection) => ({
                id: connection.id, name: connection.name,
                disabled: Boolean(aiConnectionProblem(connection)),
                description: <>{t("componentsAiConnections.picker.companyShared")}{aiMethodLabel(connection.provider, connection.method)}{connection.accountLabel ? <span className={ANALYTICS_MASK_CLASS}>{` · ${connection.accountLabel}`}</span> : ""}{aiConnectionProblem(connection) ? ` · ${aiConnectionProblem(connection)}` : ""}</>,
              })),
            ]}
            onSelect={(id) => {
              if (id === "responsible_user") { if (defaultCompatible) onChange({provider: requirement.provider, method: personalDefault?.method ?? requirement.method ?? ((requirement.provider === "openrouter" || requirement.provider === "github") ? "api_key" : "subscription"), mode: "responsible_user"}); }
              else { const connection = compatible.find((item) => item.id === id); if (connection && !aiConnectionProblem(connection)) select("shared", connection); }
            }}
          />
          {problem && (
            <p role="status" className="text-sm text-destructive">
              {problem}
            </p>
          )}
          {!readOnly && (
            <div className="flex justify-end gap-2">
              {onReconnect && <Button type="button" variant="outline" onClick={onReconnect}>{t("componentsAiConnections.picker.reconnectAccount")}</Button>}
              <Button
                type="button"
                variant="outline"
                onClick={onConnect}
              >
                {t("componentsAiConnections.picker.connectAnother")}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
