import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export function AiConnectionLegacyNotice({
  onAdopt,
  readOnly = false,
}: {
  onAdopt: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">
        {t("componentsAiConnections.legacyNotice.title")}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t("componentsAiConnections.legacyNotice.body")}
      </p>
      {!readOnly && (
        <Button variant="outline" className="self-start" onClick={onAdopt}>
          {t("componentsAiConnections.legacyNotice.choose")}
        </Button>
      )}
    </div>
  );
}
