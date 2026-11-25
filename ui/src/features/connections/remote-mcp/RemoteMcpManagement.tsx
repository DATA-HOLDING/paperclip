import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { t } from "@/i18n";

/** Shared by the saved connection and its interactive review stories. */
export function RemoteMcpManagement({ providerName, connected = true, canReconnect = true, canDisconnect = true, busy = false, onReconnect, onManage, onDisconnect }: {
  providerName: string;
  connected?: boolean;
  canReconnect?: boolean;
  canDisconnect?: boolean;
  busy?: boolean;
  onReconnect: () => void;
  onManage: () => void;
  onDisconnect: () => void | Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  return <section className="space-y-4">
    <h2 className="text-sm font-semibold">{t("featuresConnectionsRemoteMcp.management.title")}</h2>
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" disabled={!canReconnect || busy} onClick={onReconnect}>{t("featuresConnectionsRemoteMcp.management.reconnect")}</Button>
      <Button variant="outline" onClick={onManage}>{t("featuresConnectionsRemoteMcp.management.manageIn", { provider: providerName })}</Button>
      {connected && canDisconnect && <AlertDialog open={confirming} onOpenChange={(open) => { if (!busy) setConfirming(open); }}>
        <AlertDialogTrigger asChild><Button variant="ghost" className="text-destructive">{t("featuresConnectionsRemoteMcp.management.disconnect")}</Button></AlertDialogTrigger>
        <AlertDialogContent className={ANALYTICS_MASK_CLASS}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("featuresConnectionsRemoteMcp.management.confirmTitle", { provider: providerName })}</AlertDialogTitle>
            <AlertDialogDescription>{t("featuresConnectionsRemoteMcp.management.confirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("featuresConnectionsRemoteMcp.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={async (event) => {
              event.preventDefault();
              try { await onDisconnect(); setConfirming(false); } catch { /* The controller displays the failure. */ }
            }}>{busy ? t("featuresConnectionsRemoteMcp.management.disconnecting") : t("featuresConnectionsRemoteMcp.management.disconnectConnection")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
    </div>
  </section>;
}
