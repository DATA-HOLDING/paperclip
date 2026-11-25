import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ResponsibilityArea } from "@paperclipai/shared";
import { describeError } from "@/api/errors";
import { responsibilityAreasApi } from "@/api/responsibilities";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useResolvedViewerId } from "@/hooks/useResolvedViewerId";
import { Input } from "@/components/ui/input";
import { queryKeys } from "@/lib/queryKeys";
import { t } from "@/i18n";

type AreaRef = Pick<ResponsibilityArea, "id" | "title" | "status">;

/** The viewer's areas that can take a responsibility (active and proposed). */
export function useResponsibilityAreas(companyId: string | null | undefined, enabled = true) {
  const { userId } = useResolvedViewerId({ enabled });
  return useQuery({
    queryKey: [...queryKeys.responsibilities.areas(companyId ?? "__none__"), userId],
    queryFn: () => responsibilityAreasApi.list(companyId!),
    enabled: enabled && !!companyId && !!userId,
  });
}

function useAreaMutationRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.responsibilities.all });
}

/** "Add an area": one name. An existing area with the same name is returned instead of a copy. */
export function AddAreaDialog({
  open,
  onOpenChange,
  companyId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onCreated?: (area: ResponsibilityArea) => void;
}) {
  const refresh = useAreaMutationRefresh();
  const [title, setTitle] = useState("");
  const create = useMutation({
    mutationFn: () => responsibilityAreasApi.create(companyId, { title: title.trim() }),
    onSuccess: (area) => {
      void refresh();
      onCreated?.(area);
      onOpenChange(false);
    },
  });
  const reset = create.reset;
  useEffect(() => {
    if (!open) return;
    setTitle("");
    reset();
  }, [open, reset]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || create.isPending) return;
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("componentsResponsibilitiesAreaDialogs.add.title")}</DialogTitle>
            <DialogDescription>
              {t("componentsResponsibilitiesAreaDialogs.add.description")}
            </DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">{t("componentsResponsibilitiesAreaDialogs.name")}</span>
            <Input
              autoFocus
              value={title}
              maxLength={200}
              placeholder={t("componentsResponsibilitiesAreaDialogs.add.placeholder")}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          {create.error ? (
            <p role="alert" className="text-sm text-destructive">
              {t("componentsResponsibilitiesAreaDialogs.add.failed", { error: describeError(create.error).body })}
            </p>
          ) : null}
          <DialogFooter className="items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("componentsResponsibilitiesAreaDialogs.cancel")}
            </Button>
            <Button type="submit" disabled={!title.trim() || create.isPending}>
              {create.isPending ? t("componentsResponsibilitiesAreaDialogs.add.adding") : t("componentsResponsibilitiesAreaDialogs.add.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Rename an area. Areas are company-wide, so everyone sees the new name. */
export function RenameAreaDialog({
  area,
  onOpenChange,
}: {
  /** The area to rename; null closes the dialog. */
  area: AreaRef | null;
  onOpenChange: (open: boolean) => void;
}) {
  const refresh = useAreaMutationRefresh();
  const [title, setTitle] = useState("");
  const rename = useMutation({
    mutationFn: () => responsibilityAreasApi.update(area!.id, { title: title.trim() }),
    onSuccess: () => {
      void refresh();
      onOpenChange(false);
    },
  });
  const reset = rename.reset;
  useEffect(() => {
    if (!area) return;
    setTitle(area.title);
    reset();
  }, [area, reset]);

  const unchanged = !area || title.trim() === area.title;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || unchanged || rename.isPending) return;
    rename.mutate();
  };

  return (
    <Dialog open={area !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("componentsResponsibilitiesAreaDialogs.rename.title")}</DialogTitle>
            <DialogDescription>{t("componentsResponsibilitiesAreaDialogs.rename.description")}</DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">{t("componentsResponsibilitiesAreaDialogs.name")}</span>
            <Input autoFocus value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
          </label>
          {rename.error ? (
            <p role="alert" className="text-sm text-destructive">
              {t("componentsResponsibilitiesAreaDialogs.rename.failed", { error: describeError(rename.error).body })}
            </p>
          ) : null}
          <DialogFooter className="items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("componentsResponsibilitiesAreaDialogs.cancel")}
            </Button>
            <Button type="submit" disabled={!title.trim() || unchanged || rename.isPending}>
              {rename.isPending ? t("componentsResponsibilitiesAreaDialogs.rename.saving") : t("componentsResponsibilitiesAreaDialogs.rename.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Archive an area. Its responsibilities stay filed under it (the server keeps
 * them), so say so and point at moving them first.
 */
export function ArchiveAreaDialog({
  area,
  ownedHere,
  onOpenChange,
}: {
  area: AreaRef | null;
  /** How many of this person's responsibilities sit in it. */
  ownedHere: number;
  onOpenChange: (open: boolean) => void;
}) {
  const refresh = useAreaMutationRefresh();
  const archive = useMutation({
    mutationFn: () => responsibilityAreasApi.update(area!.id, { status: "archived" }),
    onSuccess: () => {
      void refresh();
      onOpenChange(false);
    },
  });
  const reset = archive.reset;
  useEffect(() => {
    if (area) reset();
  }, [area, reset]);

  return (
    <AlertDialog open={area !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("componentsResponsibilitiesAreaDialogs.archive.title", { title: area?.title })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("componentsResponsibilitiesAreaDialogs.archive.description")}
            {ownedHere > 0
              ? ` ${t("componentsResponsibilitiesAreaDialogs.archive.ownedHere", { count: ownedHere })}`
              : ""}{" "}
            {t("componentsResponsibilitiesAreaDialogs.archive.restoreLater")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {archive.error ? (
          <p role="alert" className="text-sm text-destructive">
            {t("componentsResponsibilitiesAreaDialogs.archive.failed", { error: describeError(archive.error).body })}
          </p>
        ) : null}
        <AlertDialogFooter className="items-center sm:justify-between">
          <AlertDialogCancel>{t("componentsResponsibilitiesAreaDialogs.archive.keep")}</AlertDialogCancel>
          <Button disabled={archive.isPending} onClick={() => archive.mutate()}>
            {archive.isPending ? t("componentsResponsibilitiesAreaDialogs.archive.archiving") : t("componentsResponsibilitiesAreaDialogs.archive.submit")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Restore an archived area (one click; errors are returned to the caller). */
export function useRestoreArea() {
  const refresh = useAreaMutationRefresh();
  return useMutation({
    mutationFn: (areaId: string) => responsibilityAreasApi.update(areaId, { status: "active" }),
    onSuccess: () => void refresh(),
  });
}
