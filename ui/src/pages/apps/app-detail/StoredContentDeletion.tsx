import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { ToolConnectionStoredContent } from "@paperclipai/shared";
import { toolsApi } from "@/api/tools";
import { describeError } from "@/api/errors";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import { relativeTime } from "@/lib/utils";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { t } from "@/i18n";

function plural(count: number, key: string) {
  return t(`pagesAppsAppDetail.storedContent.${key}`, { count, n: count.toLocaleString() });
}

export function storedContentSummary(content: ToolConnectionStoredContent, appName: string): string {
  const { toolCalls, approvals, appViews, runs } = content.stored;
  const parts = [
    toolCalls > 0 ? plural(toolCalls, "toolCalls") : null,
    approvals > 0 ? plural(approvals, "approvalRequests") : null,
    appViews > 0 ? plural(appViews, "appViews") : null,
    runs > 0 ? t("pagesAppsAppDetail.storedContent.fullTranscripts", { runs: plural(runs, "runs") }) : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return t("pagesAppsAppDetail.storedContent.nothingFound", { appName });
  const list = parts.length > 1 ? t("pagesAppsAppDetail.storedContent.listAnd", { rest: parts.slice(0, -1).join(", "), last: parts[parts.length - 1] }) : parts[0];
  return runs > 0
    ? t("pagesAppsAppDetail.storedContent.willDeleteWithResults", { list, appName })
    : t("pagesAppsAppDetail.storedContent.willDelete", { list, appName });
}

export function storedContentStatus(content: ToolConnectionStoredContent): string | null {
  const deletion = content.deletion;
  if (deletion?.status === "pending" && deletion.reason !== "requested") {
    return t("pagesAppsAppDetail.storedContent.autoDeleting");
  }
  if (deletion?.status === "pending") {
    return deletion.retrying
      ? t("pagesAppsAppDetail.storedContent.interrupted")
      : t("pagesAppsAppDetail.storedContent.deletingNow");
  }
  if (deletion?.status === "completed" && deletion.completedAt) {
    const skipped = deletion.counts.runsInProgress;
    return skipped > 0
      ? `${t("pagesAppsAppDetail.storedContent.lastDeleted", { when: relativeTime(deletion.completedAt) })} ${plural(skipped, "skippedRuns")}`
      : t("pagesAppsAppDetail.storedContent.lastDeleted", { when: relativeTime(deletion.completedAt) });
  }
  return null;
}

export function StoredContentDeletionRow({ connectionId, appName }: { connectionId: string; appName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div>
        <p className="text-sm font-medium text-foreground">{t("pagesAppsAppDetail.storedContent.rowTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("pagesAppsAppDetail.storedContent.rowDescription")}
        </p>
      </div>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        {t("pagesAppsAppDetail.storedContent.deleteData")}
      </Button>
      {open ? (
        <StoredContentDeletionDialog connectionId={connectionId} appName={appName} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}

export function StoredContentDeletionDialog({
  connectionId,
  appName,
  onClose,
}: {
  connectionId: string;
  appName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const countsKey = queryKeys.tools.connectionStoredContent(connectionId);
  const statusKey = queryKeys.tools.connectionStoredContentDeletion(connectionId);
  const query = useQuery({
    queryKey: countsKey,
    queryFn: () => toolsApi.getStoredContent(connectionId),
    staleTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
  const [tracking, setTracking] = useState(false);
  const watching = tracking || query.data?.deletion?.status === "pending";
  const statusQuery = useQuery({
    queryKey: statusKey,
    queryFn: () => toolsApi.getStoredContentDeletion(connectionId),
    enabled: watching,
    refetchInterval: (current) => current.state.data?.deletion?.status === "completed" ? false : 2_000,
  });
  const latest = statusQuery.data?.deletion ?? query.data?.deletion ?? null;
  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!watching || latest?.status !== "completed" || refreshedFor.current === latest.id) return;
    refreshedFor.current = latest.id;
    setTracking(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.tools.connectionStoredContent(connectionId) });
  }, [watching, latest?.status, latest?.id, queryClient, connectionId]);
  const deletion = useMutation({
    mutationFn: () => toolsApi.deleteStoredContent(connectionId),
    onSuccess: (result) => {
      queryClient.setQueryData(statusKey, result);
      setTracking(true);
    },
    onError: (error) => pushToast({ title: t("pagesAppsAppDetail.storedContent.deleteFailed"), body: describeError(error).body, tone: "error" }),
  });
  const content = query.data ? { ...query.data, deletion: latest } : undefined;
  const pending = deletion.isPending || latest?.status === "pending";
  const inProgress = content?.stored.runsInProgress ?? 0;
  const status = content ? storedContentStatus(content) : null;

  return (
    <AlertDialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <AlertDialogContent className={ANALYTICS_MASK_CLASS}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("pagesAppsAppDetail.storedContent.dialogTitle", { appName })}</AlertDialogTitle>
          <AlertDialogDescription>
            {content ? storedContentSummary(content, appName) : t("pagesAppsAppDetail.storedContent.counting")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {query.error ? (
          <p role="alert" className="text-sm text-destructive">{describeError(query.error).body}</p>
        ) : null}
        {content ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t("pagesAppsAppDetail.storedContent.wholeTranscripts")}</p>
            <p className="font-medium text-foreground">{t("pagesAppsAppDetail.storedContent.notRemoved")}</p>
            {inProgress > 0 ? (
              <p>{plural(inProgress, "inProgress")}</p>
            ) : null}
            <p className="font-medium text-foreground">{t("pagesAppsAppDetail.storedContent.cannotUndo")}</p>
          </div>
        ) : null}
        {status ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {content?.deletion?.status === "pending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {status}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus>{pending ? t("pagesAppsAppDetail.storedContent.close") : t("pagesAppsAppDetail.storedContent.cancel")}</AlertDialogCancel>
          {content ? (
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={pending || !content || query.isFetching}
              onClick={(event) => {
                event.preventDefault();
                deletion.mutate();
              }}
            >
              {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t("pagesAppsAppDetail.storedContent.deleteData")}
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
