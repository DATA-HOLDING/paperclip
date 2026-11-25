import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { describeError } from "@/api/errors";
import { toolsApi } from "@/api/tools";
import { useAccountIdentity } from "@/api/companies-query";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ToolConnection } from "@paperclipai/shared";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { t } from "@/i18n";

export function ArcadeDiscoverySetup({ connection, onClose }: { connection: ToolConnection; onClose: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [userId, setUserId] = useState("");
  const queries = useQueryClient();
  const { userId: viewingUserId, settled } = useAccountIdentity();
  const save = useMutation({ mutationFn: async () => {
      const result = await toolsApi.configureArcadeDiscovery(connection.id, { apiKey: apiKey.trim(), userId: userId.trim() });
      queries.setQueryData(queryKeys.tools.aggregatorApps(connection.id, viewingUserId), result);
    },
    onSuccess: onClose,
  });
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}><DialogContent className={ANALYTICS_MASK_CLASS}>
    <DialogHeader><DialogTitle>{t("pagesApps.arcade.title")}</DialogTitle>
      <DialogDescription>{t("pagesApps.arcade.descriptionBefore")}{" "}<span className={ANALYTICS_MASK_CLASS}>“{connection.name}”</span>{t("pagesApps.arcade.descriptionAfter")}</DialogDescription>
    </DialogHeader>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
      <div className="space-y-2"><Label htmlFor="arcade-discovery-key">{t("pagesApps.arcade.apiKey")}</Label>
        <p className="text-xs text-muted-foreground">{t("pagesApps.arcade.keyHelpBefore")}{" "}<a className="underline" href="https://app.arcade.dev" target="_blank" rel="noopener noreferrer">Arcade</a>{" "}{t("pagesApps.arcade.keyHelpAfter")}</p>
        <Input id="arcade-discovery-key" type="password" autoComplete="off" required value={apiKey} onChange={event => setApiKey(event.target.value)} />
      </div>
      <div className="space-y-2"><Label htmlFor="arcade-discovery-user">{t("pagesApps.arcade.userId")}</Label>
        <p className="text-xs text-muted-foreground">{t("pagesApps.arcade.userIdHelp")}</p>
        <Input id="arcade-discovery-user" autoComplete="off" required value={userId} onChange={event => setUserId(event.target.value)} />
      </div>
      {save.error ? <p role="alert" className="text-sm text-destructive">{describeError(save.error).body}</p> : null}
      <DialogFooter className="sm:justify-between"><Button type="button" variant="ghost" disabled={save.isPending} onClick={onClose}>{t("pagesApps.common.cancel")}</Button>
        <Button type="submit" disabled={!settled || save.isPending || !apiKey.trim() || !userId.trim()}>{save.isPending ? t("pagesApps.common.saving") : t("pagesApps.arcade.saveAndSync")}</Button>
      </DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
