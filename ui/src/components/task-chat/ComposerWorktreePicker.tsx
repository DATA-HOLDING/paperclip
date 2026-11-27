import { useMemo, type CSSProperties } from "react";
import { Folder, GitBranch, GitBranchPlus, Monitor } from "lucide-react";
import type { ExecutionWorkspaceSummary } from "@paperclipai/shared";
import { SearchableSelect, type SearchableSelectOption } from "@/components/SearchableSelect";
import { orderReusableExecutionWorkspaces } from "@/lib/reusable-execution-workspaces";
import { t } from "@/i18n";

interface WorktreeOption extends SearchableSelectOption {
  mode: string;
  workspaceId?: string;
  description: string;
}

interface ComposerWorktreePickerProps {
  mode: string;
  workspaceId: string;
  workspaces: readonly ExecutionWorkspaceSummary[];
  onChange: (mode: string, workspaceId: string) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  disabled?: boolean;
  mobile?: boolean;
  contentStyle?: CSSProperties;
  selectedWorkspaceLabel?: string;
}

const MODE_OPTIONS: WorktreeOption[] = [
  { key: "isolated_workspace", value: "isolated_workspace", mode: "isolated_workspace", label: t("componentsTaskChatComposerWorktreePicker.modes.isolated.label"), description: t("componentsTaskChatComposerWorktreePicker.modes.isolated.description") },
  { key: "shared_workspace", value: "shared_workspace", mode: "shared_workspace", label: t("componentsTaskChatComposerWorktreePicker.modes.shared.label"), description: t("componentsTaskChatComposerWorktreePicker.modes.shared.description") },
  { key: "operator_branch", value: "operator_branch", mode: "operator_branch", label: t("componentsTaskChatComposerWorktreePicker.modes.operatorBranch.label"), description: t("componentsTaskChatComposerWorktreePicker.modes.operatorBranch.description") },
  { key: "agent_default", value: "agent_default", mode: "agent_default", label: t("componentsTaskChatComposerWorktreePicker.modes.agentDefault.label"), description: t("componentsTaskChatComposerWorktreePicker.modes.agentDefault.description") },
  { key: "inherit", value: "inherit", mode: "inherit", label: t("componentsTaskChatComposerWorktreePicker.modes.inherit.label"), description: t("componentsTaskChatComposerWorktreePicker.modes.inherit.description") },
];

/** Reuses the searchable selector and the existing workspace recency ordering. */
export function ComposerWorktreePicker({
  mode, workspaceId, workspaces, onChange, loading, error, onRetry,
  disabled, mobile, contentStyle, selectedWorkspaceLabel,
}: ComposerWorktreePickerProps) {
  const groups = useMemo(() => [
    { id: "new", options: [MODE_OPTIONS[0]!] },
    {
      id: "reuse", label: t("componentsTaskChatComposerWorktreePicker.groups.reuse"),
      options: orderReusableExecutionWorkspaces(workspaces).map((workspace): WorktreeOption => ({
        key: `reuse:${workspace.id}`, value: `reuse:${workspace.id}`,
        workspaceId: workspace.id, mode: "reuse_existing", label: workspace.name,
        description: workspace.branchName ?? t("componentsTaskChatComposerWorktreePicker.existingWorkspace"),
        searchText: `${workspace.branchName ?? ""} ${workspace.id}`,
      })),
    },
    {
      id: "other", label: t("componentsTaskChatComposerWorktreePicker.groups.other"),
      options: MODE_OPTIONS.filter((option) => option.mode === "shared_workspace"
        || (option.mode !== "isolated_workspace" && option.mode === mode)),
    },
  ], [mode, workspaces]);

  const value = mode === "reuse_existing" ? `reuse:${workspaceId}` : mode;
  return (
    <SearchableSelect<string, WorktreeOption>
      value={value}
      groups={groups}
      onValueChange={(_, option) => onChange(option.mode, option.workspaceId ?? "")}
      placeholder={t("componentsTaskChatComposerWorktreePicker.worktrees")}
      triggerAriaLabel={t("componentsTaskChatComposerWorktreePicker.worktrees")}
      mobileTitle={t("componentsTaskChatComposerWorktreePicker.worktrees")}
      searchPlaceholder={t("componentsTaskChatComposerWorktreePicker.searchPlaceholder")}
      emptyMessage={t("componentsTaskChatComposerWorktreePicker.noMatches")}
      disabled={disabled}
      modal={mobile}
      contentStyle={contentStyle}
      contentWidth="auto"
      className="min-w-0 flex-1 sm:flex-none sm:max-w-72"
      triggerClassName="h-8 gap-1.5 border-0 bg-transparent px-2 text-xs font-medium shadow-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-0"
      renderValue={(option) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <GitBranch className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            <span className="hidden text-muted-foreground sm:inline">{t("componentsTaskChatComposerWorktreePicker.valuePrefix")}</span>
            {option?.label ?? selectedWorkspaceLabel ?? t("componentsTaskChatComposerWorktreePicker.selectWorktree")}
          </span>
        </span>
      )}
      renderOption={(option) => {
        const Icon = option.workspaceId ? GitBranch : option.mode === "isolated_workspace" ? GitBranchPlus
          : option.mode === "agent_default" ? Monitor : option.mode === "operator_branch" ? GitBranch : Folder;
        return (
          <>
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{option.label}</span>
              <span className="truncate text-xs text-muted-foreground">{option.description}</span>
            </span>
          </>
        );
      }}
      listFooter={loading || error || workspaces.length === 0 ? (
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground" role="status">
          {loading ? t("componentsTaskChatComposerWorktreePicker.loading") : error ? (
            <span className="flex items-center justify-between gap-2">
              {t("componentsTaskChatComposerWorktreePicker.loadFailed")}
              <button type="button" className="rounded px-2 py-1 text-foreground hover:bg-accent" onClick={onRetry}>{t("componentsTaskChatComposerWorktreePicker.retry")}</button>
            </span>
          ) : t("componentsTaskChatComposerWorktreePicker.empty")}
        </div>
      ) : undefined}
    />
  );
}
