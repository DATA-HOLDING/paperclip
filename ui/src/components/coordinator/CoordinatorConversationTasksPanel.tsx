import { useQueryView } from "@/components/QueryView";
import { useMemo, useState } from "react";
import { useCoordinatorChatTaskHandoffs } from "./CoordinatorChatTaskHandoffs";
import { CoordinatorCreatedTaskLink } from "./CoordinatorTaskCommitment";
import { ToolbarSearch } from "@/components/ToolbarSearch";
import { NativeSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

/** The task list is source-conversation scoped, independent of reassignment. */
export function CoordinatorConversationTasksPanel({ conversationIssueId }: { conversationIssueId: string }) {
  const tasks = useCoordinatorChatTaskHandoffs(conversationIssueId);
  const tasksView = useQueryView(tasks);
  const waiting = ["loading", "reconnecting"].includes(tasksView.kind);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return tasks.handoffs.filter(task => (!status || task.status === status) && (!needle || `${task.identifier ?? ""} ${task.title}`.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : (sort === "oldest" ? 1 : -1) * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  }, [tasks.handoffs, query, status, sort]);
  return <section className="space-y-4" aria-label={t("componentsCoordinator.conversationTasks.ariaLabel")}>
    <div className="space-y-1"><h2 className="text-lg font-medium">{t("componentsCoordinator.conversationTasks.title")}</h2><p className="text-sm text-muted-foreground">{t("componentsCoordinator.conversationTasks.subtitle")}</p></div>
    <ToolbarSearch query={query} onQueryChange={setQuery} label={t("componentsCoordinator.conversationTasks.searchLabel")} placeholder={t("componentsCoordinator.conversationTasks.searchPlaceholder")} />
    <div className="flex flex-wrap gap-2">
      <NativeSelect value={status} onChange={event => setStatus(event.target.value)} aria-label={t("componentsCoordinator.conversationTasks.statusFilterLabel")} className="w-auto"><option value="">{t("componentsCoordinator.conversationTasks.status.all")}</option><option value="todo">{t("componentsCoordinator.conversationTasks.status.todo")}</option><option value="in_progress">{t("componentsCoordinator.conversationTasks.status.inProgress")}</option><option value="in_review">{t("componentsCoordinator.conversationTasks.status.inReview")}</option><option value="blocked">{t("componentsCoordinator.conversationTasks.status.blocked")}</option><option value="done">{t("componentsCoordinator.conversationTasks.status.done")}</option><option value="cancelled">{t("componentsCoordinator.conversationTasks.status.cancelled")}</option></NativeSelect>
      <NativeSelect value={sort} onChange={event => setSort(event.target.value)} aria-label={t("componentsCoordinator.conversationTasks.sortLabel")} className="w-auto"><option value="newest">{t("componentsCoordinator.conversationTasks.sort.newest")}</option><option value="oldest">{t("componentsCoordinator.conversationTasks.sort.oldest")}</option><option value="title">{t("componentsCoordinator.conversationTasks.sort.title")}</option></NativeSelect>
    </div>
    {waiting && <p role="status" className="text-sm text-muted-foreground">{t("componentsCoordinator.conversationTasks.loading")}</p>}
    {(tasksView.kind === "error") && <div role="alert" className="space-y-2"><p className="text-sm">{t("componentsCoordinator.conversationTasks.loadError")}</p><Button variant="outline" onClick={() => void tasks.refetch()}>{t("componentsCoordinator.common.retry")}</Button></div>}
    <div className="space-y-3">{visible.map(task => <div key={task.id} className="overflow-hidden rounded-xl border border-border bg-card"><CoordinatorCreatedTaskLink task={task} /></div>)}</div>
    {!waiting && !(tasksView.kind === "error") && !visible.length && <p className="py-4 text-sm text-muted-foreground">{query || status ? t("componentsCoordinator.conversationTasks.noMatch") : t("componentsCoordinator.conversationTasks.empty")}</p>}
    {tasks.hasNextPage && <Button variant="outline" disabled={tasks.isFetchingNextPage} onClick={() => void tasks.fetchNextPage()}>{tasks.isFetchingNextPage ? t("componentsCoordinator.common.loading") : t("componentsCoordinator.conversationTasks.loadMore")}</Button>}
  </section>;
}
