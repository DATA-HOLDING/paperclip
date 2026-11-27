import { AlertTriangle } from "lucide-react";
import type { ToolProfileListItem } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/i18n";

export type ProfileActionDialogKind = "archive" | "delete" | "restore";

export function ProfileActionDialog({
  kind,
  profile,
  pending,
  onClose,
  onArchive,
  onRestore,
  onDelete,
}: {
  kind: ProfileActionDialogKind | null;
  profile: Pick<ToolProfileListItem, "summary"> | null;
  pending: boolean;
  onClose: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  if (!kind || !profile) return null;

  const defaultDeleteBlocked = kind === "delete" && profile.summary.isCompanyDefault;
  const copy = {
    archive: {
      title: t("pagesToolsProfiles.actionDialog.archive.title"),
      body: t("pagesToolsProfiles.actionDialog.archive.body", { count: profile.summary.appliesToAgentCount }),
      confirm: t("pagesToolsProfiles.actionDialog.archive.confirm"),
      action: onArchive,
    },
    restore: {
      title: t("pagesToolsProfiles.actionDialog.restore.title"),
      body: t("pagesToolsProfiles.actionDialog.restore.body"),
      confirm: t("pagesToolsProfiles.actionDialog.restore.confirm"),
      action: onRestore,
    },
    delete: {
      title: t("pagesToolsProfiles.actionDialog.delete.title"),
      body: defaultDeleteBlocked
        ? t("pagesToolsProfiles.actionDialog.delete.defaultBlockedBody")
        : t("pagesToolsProfiles.actionDialog.delete.body", { count: profile.summary.assignmentCount }),
      confirm: t("pagesToolsProfiles.actionDialog.delete.confirm"),
      action: onDelete,
    },
  }[kind];

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        {defaultDeleteBlocked ? (
          <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t("pagesToolsProfiles.actionDialog.delete.defaultBlockedHint")}</span>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("pagesToolsProfiles.actionDialog.cancel")}</Button>
          <Button
            variant={kind === "delete" ? "destructive" : "default"}
            disabled={pending || defaultDeleteBlocked}
            onClick={copy.action}
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
