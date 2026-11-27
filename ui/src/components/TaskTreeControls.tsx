import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PauseCircle, PlayCircle, Repeat, XCircle } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { t } from "@/i18n";

/** Shared by the task header and its Storybook composition. */
export function TaskTreeControlMenuItems({
  scope,
  canPause,
  canResume,
  canCancel,
  canRestore,
  pending,
  onPause,
  onResume,
  onCancel,
  onRestore,
}: {
  scope: "leaf" | "subtree";
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canRestore: boolean;
  pending?: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRestore: () => void;
}) {
  const itemClass =
    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 disabled:opacity-50 disabled:pointer-events-none";
  return (
    <>
      {canPause ? (
        <button disabled={pending} className={itemClass} onClick={onPause}>
          <PauseCircle className="h-3 w-3" />
          {scope === "leaf" ? t("componentsTaskTreeControls.pauseWork") : t("componentsTaskTreeControls.pauseSubtree")}
        </button>
      ) : null}
      {canResume ? (
        <button disabled={pending} className={itemClass} onClick={onResume}>
          <PlayCircle className="h-3 w-3" />
          {scope === "leaf" ? t("componentsTaskTreeControls.resumeWork") : t("componentsTaskTreeControls.resumeSubtree")}
        </button>
      ) : null}
      {canCancel ? (
        <button
          disabled={pending}
          className={`${itemClass} text-destructive`}
          onClick={onCancel}
        >
          <XCircle className="h-3 w-3" />
          {t("componentsTaskTreeControls.cancelSubtreeMenu")}
        </button>
      ) : null}
      {canRestore ? (
        <button disabled={pending} className={itemClass} onClick={onRestore}>
          <Repeat className="h-3 w-3" />
          {t("componentsTaskTreeControls.restoreSubtreeMenu")}
        </button>
      ) : null}
    </>
  );
}

export function TaskTreeControlDialog({
  open,
  onOpenChange,
  mode,
  scope,
  affectedCount,
  affectedAgentCount,
  warnings = [],
  loading,
  error,
  pending,
  valid,
  wakeAgents,
  onWakeAgentsChange,
  onRetry,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "resume" | "cancel" | "restore";
  scope: "leaf" | "subtree";
  affectedCount: number;
  affectedAgentCount: number;
  warnings?: string[];
  loading: boolean;
  error?: string | null;
  pending: boolean;
  valid: boolean;
  wakeAgents: boolean;
  onWakeAgentsChange: (wake: boolean) => void;
  onRetry: () => void;
  onApply: () => void;
}) {
  const cancel = mode === "cancel";
  const title = cancel
    ? t("componentsTaskTreeControls.cancelSubtreeTitle")
    : mode === "restore"
      ? t("componentsTaskTreeControls.restoreSubtree")
      : scope === "leaf"
        ? t("componentsTaskTreeControls.resumeWork")
        : t("componentsTaskTreeControls.resumeSubtree");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={!pending}
        className="max-h-(--sz-calc-18) overflow-y-auto sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {loading
              ? t("componentsTaskTreeControls.loading")
              : cancel
                ? (affectedCount === 1 ? t("componentsTaskTreeControls.willBeCancelled_one", { count: affectedCount }) : t("componentsTaskTreeControls.willBeCancelled_other", { count: affectedCount }))
                : mode === "restore"
                  ? (affectedCount === 1 ? t("componentsTaskTreeControls.willBeRestored_one", { count: affectedCount }) : t("componentsTaskTreeControls.willBeRestored_other", { count: affectedCount }))
                  : (affectedCount === 1 ? t("componentsTaskTreeControls.pauseRemoved_one", { count: affectedCount }) : t("componentsTaskTreeControls.pauseRemoved_other", { count: affectedCount }))}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onRetry}
            >
              {t("componentsTaskTreeControls.retryPreview")}
            </Button>
          </div>
        ) : null}
        {!cancel ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={wakeAgents && affectedAgentCount > 0}
              disabled={pending || loading || affectedAgentCount === 0}
              onChange={(event) => onWakeAgentsChange(event.target.checked)}
            />
            {t("componentsTaskTreeControls.wakeAgents", { count: affectedAgentCount })}
          </label>
        ) : null}
        {!loading ? warnings.map((warning) => (
          <p key={warning} className="text-sm text-muted-foreground">{warning}</p>
        )) : null}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancel ? t("componentsTaskTreeControls.keepTasks") : t("componentsTaskTreeControls.close")}
          </Button>
          <Button
            variant={cancel ? "destructive" : "default"}
            disabled={pending || loading || !!error || !valid}
            onClick={onApply}
          >
            {pending
              ? t("componentsTaskTreeControls.applying")
              : cancel
                ? (affectedCount === 1 ? t("componentsTaskTreeControls.cancelTasks_one", { count: affectedCount }) : t("componentsTaskTreeControls.cancelTasks_other", { count: affectedCount }))
                : mode === "restore"
                  ? (affectedCount === 1 ? t("componentsTaskTreeControls.restoreTasks_one", { count: affectedCount }) : t("componentsTaskTreeControls.restoreTasks_other", { count: affectedCount }))
                  : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Quiet, persistent pause feedback shared by the task page and previews. */
export function TaskPauseNotice({
  scope,
  onResume,
  pending,
  className,
  resumeLink,
}: {
  scope: "leaf" | "subtree";
  onResume?: () => void;
  pending?: boolean;
  className?: string;
  resumeLink?: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <span>
        {scope === "subtree" ? t("componentsTaskTreeControls.subtreePaused") : t("componentsTaskTreeControls.taskPaused")}
      </span>
      {resumeLink ??
        (onResume ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={onResume}
          >
            {scope === "subtree" ? t("componentsTaskTreeControls.resumeSubtree") : t("componentsTaskTreeControls.resumeWork")}
          </Button>
        ) : null)}
    </div>
  );
}
