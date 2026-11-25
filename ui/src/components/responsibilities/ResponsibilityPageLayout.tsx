import { useMemo, useState, type ReactNode } from "react";
import type {
  Agent,
  LinkResponsibility,
  ResponsibilityArea,
  ResponsibilityDetail,
  ResponsibilityProjectSummary,
  ResponsibilityRoutineSummary,
  ResponsibilityStatus,
  ResponsibilityTaskSummary,
  ResponsibilityWorkSignal,
} from "@paperclipai/shared";
import { RESPONSIBILITY_DETAIL_TASK_LIMIT } from "@paperclipai/shared";
import { ChevronDown, FolderOpen, MoreHorizontal, Repeat, SquarePen, X } from "lucide-react";
import { EntityRow } from "@/components/EntityRow";
import { InlineEditor } from "@/components/InlineEditor";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusIcon } from "@/components/StatusIcon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/lib/router";
import {
  agentsWorkingUnder,
  describeNextDue,
  givableFromSignal,
  isTerminalTaskStatus,
  routinePath,
  splitResponsibilityTasks,
} from "@/lib/responsibilities";
import { taskStatusIconProps } from "@/lib/task-status-presentation";
import { cn, issueUrl, projectUrl } from "@/lib/utils";
import { AddExistingWorkPicker, type ResponsibilityWorkKind } from "./AddExistingWorkPicker";
import { AgentsAtWorkList } from "./AgentsWorking";
import { GiveToAgentMenu } from "./GiveToAgent";
import { AreaControl } from "./MoveToArea";
import { ProposedResponsibilitiesReview } from "./ProposedResponsibilitiesReview";
import { ResponsibilityBarCard } from "./ResponsibilityBarCard";
import { ResponsibilityArtifacts, ResponsibilitySkills } from "./ResponsibilitySkillsAndArtifacts";
import { WorkSignalList } from "./WorkSignalList";
import { t } from "@/i18n";

type AreaRef = Pick<ResponsibilityArea, "id" | "title" | "status">;

export interface UnlinkRequest {
  linkId: string;
  label: string;
  /** How to file it here again (undo). */
  relink: LinkResponsibility;
}

/** What the responsibility page can do; the page component implements each one. */
export interface ResponsibilityPageActions {
  saveTitle: (title: string) => Promise<unknown> | void;
  saveDescription: (description: string | null) => Promise<unknown> | void;
  setStatus: (status: ResponsibilityStatus) => void;
  requestDelete: () => void;
  /** Open "New task for an agent" under this responsibility. */
  newTask: (launch: { defaultTitle: string; projectId?: string | null }) => void;
  unlink: (request: UnlinkRequest) => void;
  /** The link being removed right now, if any. */
  unlinkingId: string | null;
  /** The person decided a proposal here; dismissing it leaves the page. */
  onProposalReviewed: (result: { dismissed: readonly unknown[] }) => void;
}

export interface ResponsibilityPageLayoutProps {
  responsibility: ResponsibilityDetail;
  companyId: string;
  agents: readonly Agent[];
  agentsById: ReadonlyMap<string, Agent>;
  /** Areas it can move to. */
  areas: readonly AreaRef[];
  now: Date;
  actions: ResponsibilityPageActions;
  /** Results of the page's own actions (a removal with undo, errors), shown above the work lists. */
  notices?: ReactNode;
}

function SectionHeading({
  id,
  title,
  count,
  question,
  action,
}: {
  id: string;
  title: string;
  count?: number;
  question?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={id} className="text-base font-semibold text-foreground">
          {title}
          {count !== undefined ? <> <span className="text-sm font-normal tabular-nums text-muted-foreground">{count}</span></> : null}
        </h2>
        {question ? <p className="text-sm text-muted-foreground">{question}</p> : null}
      </div>
      {action}
    </div>
  );
}

function RemoveLinkButton({ label, pending, onRemove }: { label: string; pending: boolean; onRemove: () => void }) {
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-label={t("componentsResponsibilitiesResponsibilityPageLayout.removeLinkAriaLabel", { label })}
      title={t("componentsResponsibilitiesResponsibilityPageLayout.removeLinkTitle")}
      disabled={pending}
      onClick={onRemove}
    >
      <X aria-hidden="true" />
    </Button>
  );
}

/** One row: the shared entity row for the item, with actions beside it (not inside the link). */
function WorkRow({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <li className="flex items-center gap-1 pr-3">
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </li>
  );
}

/**
 * The responsibility page: the bar first, then what the work says, then the
 * work in this order: routines and skills first, then projects and tasks,
 * then artifacts. Routines, projects and tasks are lists (each item can be
 * given to an agent); skills and artifacts are grids of cards. Takes loaded
 * data and the page's actions as props.
 */
export function ResponsibilityPageLayout({
  responsibility,
  companyId,
  agents,
  agentsById,
  areas,
  now,
  actions,
  notices,
}: ResponsibilityPageLayoutProps) {
  const [showDone, setShowDone] = useState(false);
  const projectNames = useMemo(() => new Map(responsibility.projects.map((project) => [project.id, project])), [responsibility.projects]);
  const tasks = useMemo(() => splitResponsibilityTasks(responsibility.tasks), [responsibility.tasks]);
  const working = useMemo(() => agentsWorkingUnder(responsibility), [responsibility]);
  const linkedIds = useMemo(
    () => ({
      project: new Set(responsibility.projects.map((project) => project.id)),
      task: new Set(responsibility.tasks.filter((task) => task.membership === "direct").map((task) => task.id)),
      routine: new Set(responsibility.routines.filter((routine) => routine.membership === "direct").map((routine) => routine.id)),
      skill: new Set(responsibility.skills.filter((skill) => skill.linkId).map((skill) => skill.id)),
    }),
    [responsibility.projects, responsibility.tasks, responsibility.routines, responsibility.skills],
  );

  const isActive = responsibility.status === "active";
  const editable = responsibility.status !== "dismissed";

  const picker = (kind: ResponsibilityWorkKind) => (
    <AddExistingWorkPicker companyId={companyId} responsibilityId={responsibility.id} kind={kind} linkedIds={linkedIds[kind]} />
  );
  const unlinkRow = (linkId: string | null, label: string, relink: LinkResponsibility) =>
    linkId && editable ? (
      <RemoveLinkButton label={label} pending={actions.unlinkingId === linkId} onRemove={() => actions.unlink({ linkId, label, relink })} />
    ) : null;
  const giveRow = (item: Parameters<typeof GiveToAgentMenu>[0]["item"]) =>
    editable ? <GiveToAgentMenu companyId={companyId} agents={agents} item={item} size="icon-xs" /> : null;
  const signalAction = (signal: ResponsibilityWorkSignal) => {
    if (!isActive || signal.tone !== "attention") return null;
    const givable = givableFromSignal(signal);
    if (givable) return <GiveToAgentMenu companyId={companyId} agents={agents} item={givable} />;
    return (
      <Button
        size="xs"
        variant="ghost"
        className="shrink-0 text-muted-foreground"
        onClick={() => actions.newTask({ defaultTitle: signal.text })}
        aria-label={t("componentsResponsibilitiesResponsibilityPageLayout.newTaskForSignalAriaLabel", { text: signal.text })}
      >
        <SquarePen aria-hidden="true" />
        {t("componentsResponsibilitiesResponsibilityPageLayout.newTaskForAgent")}
      </Button>
    );
  };

  const renderTask = (task: ResponsibilityTaskSummary) => {
    const viaProject = task.membership === "project" && task.projectId ? projectNames.get(task.projectId) : null;
    return (
      <WorkRow
        key={task.id}
        actions={
          <>
            {isTerminalTaskStatus(task.status) ? null : giveRow({ kind: "task", id: task.id, label: task.title, currentAgentId: task.assigneeAgentId })}
            {unlinkRow(task.linkId, task.title, { issueId: task.id })}
          </>
        }
      >
        <EntityRow
          className="border-b-0"
          leading={<StatusIcon {...taskStatusIconProps(task)} />}
          identifier={task.identifier ?? undefined}
          title={task.title}
          to={issueUrl(task)}
          trailing={task.status === "blocked" ? <span className="text-xs text-(--status-task-icon-blocked)">{t("componentsResponsibilitiesResponsibilityPageLayout.blocked")}</span> : null}
        />
        {viaProject ? (
          <p className="pb-2 pl-12 text-xs text-muted-foreground">
            {t("componentsResponsibilitiesResponsibilityPageLayout.hereThrough")}{" "}
            <Link to={projectUrl(viaProject)} className="underline-offset-4 hover:underline">
              {viaProject.name}
            </Link>
          </p>
        ) : null}
      </WorkRow>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      {responsibility.status === "proposed" ? (
        <ProposedResponsibilitiesReview
          companyId={companyId}
          proposed={[responsibility]}
          areas={responsibility.area ? [responsibility.area] : []}
          heading={t("componentsResponsibilitiesResponsibilityPageLayout.proposedHeading")}
          description={t("componentsResponsibilitiesResponsibilityPageLayout.proposedDescription")}
          onReviewed={actions.onProposalReviewed}
        />
      ) : null}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <InlineEditor
              value={responsibility.title}
              onSave={(title) => {
                const next = title.trim();
                if (next && next !== responsibility.title) return actions.saveTitle(next);
              }}
              as="h1"
              className="text-2xl font-semibold text-foreground"
            />
            <InlineEditor
              value={responsibility.description ?? ""}
              onSave={(description) => actions.saveDescription(description.trim() || null)}
              as="p"
              className="text-sm text-muted-foreground"
              placeholder={t("componentsResponsibilitiesResponsibilityPageLayout.descriptionPlaceholder")}
              multiline
              nullable
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isActive ? (
              <Button variant="outline" onClick={() => actions.newTask({ defaultTitle: "" })}>
                <SquarePen aria-hidden="true" />
                {t("componentsResponsibilitiesResponsibilityPageLayout.newTaskForAgent")}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label={t("componentsResponsibilitiesResponsibilityPageLayout.moreActions")}>
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isActive ? (
                  <DropdownMenuItem onSelect={() => actions.setStatus("let_go")}>{t("componentsResponsibilitiesResponsibilityPageLayout.letGo")}</DropdownMenuItem>
                ) : responsibility.status === "let_go" || responsibility.status === "dismissed" ? (
                  <DropdownMenuItem onSelect={() => actions.setStatus("active")}>{t("componentsResponsibilitiesResponsibilityPageLayout.takeBackOn")}</DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={actions.requestDelete}>
                  {t("componentsResponsibilitiesResponsibilityPageLayout.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-1">
            <dt className="text-xs text-muted-foreground">{t("componentsResponsibilitiesResponsibilityPageLayout.area")}</dt>
            <dd>
              <AreaControl responsibilityId={responsibility.id} area={responsibility.area} areas={areas} />
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-xs text-muted-foreground">{t("componentsResponsibilitiesResponsibilityPageLayout.agentsOnThis")}</dt>
            <dd>
              <AgentsAtWorkList agents={working} agentsById={agentsById} />
            </dd>
          </div>
        </dl>
        {responsibility.status === "let_go" ? (
          <p className="text-sm text-muted-foreground">{t("componentsResponsibilitiesResponsibilityPageLayout.letGoNotice")}</p>
        ) : responsibility.status === "dismissed" ? (
          <p className="text-sm text-muted-foreground">{t("componentsResponsibilitiesResponsibilityPageLayout.dismissedNotice")}</p>
        ) : null}
      </header>

      <ResponsibilityBarCard responsibility={responsibility} agentsById={agentsById} now={now} editable={editable} />

      <section aria-labelledby="responsibility-work-summary-heading" className="flex flex-col gap-3">
        <SectionHeading
          id="responsibility-work-summary-heading"
          title={t("componentsResponsibilitiesResponsibilityPageLayout.acrossTheWork")}
          question={t("componentsResponsibilitiesResponsibilityPageLayout.acrossTheWorkQuestion")}
        />
        {responsibility.rollup.workSummary.length > 0 ? (
          <WorkSignalList
            signals={responsibility.rollup.workSummary}
            renderAction={signalAction}
            responsibilityHref={() => "#responsibility-bar"}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("componentsResponsibilitiesResponsibilityPageLayout.nothingToReport")}
          </p>
        )}
      </section>

      {notices}

      <section aria-labelledby="responsibility-routines-heading" className="flex flex-col gap-2">
        <SectionHeading
          id="responsibility-routines-heading"
          title={t("componentsResponsibilitiesResponsibilityPageLayout.routines")}
          count={responsibility.routines.length}
          question={t("componentsResponsibilitiesResponsibilityPageLayout.routinesQuestion")}
          action={editable ? picker("routine") : null}
        />
        {responsibility.routines.length > 0 ? (
          <ul className="flex flex-col">
            {responsibility.routines.map((routine: ResponsibilityRoutineSummary) => (
              <WorkRow
                key={routine.id}
                actions={
                  <>
                    {routine.status === "archived" ? null : giveRow({ kind: "routine", id: routine.id, label: routine.title, currentAgentId: routine.assigneeAgentId })}
                    {unlinkRow(routine.linkId, routine.title, { routineId: routine.id })}
                  </>
                }
              >
                <EntityRow
                  className="border-b-0"
                  leading={<Repeat className="size-4 text-muted-foreground" aria-hidden="true" />}
                  title={routine.title}
                  to={routinePath(routine.id)}
                  trailing={<StatusBadge status={routine.status} />}
                />
              </WorkRow>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("componentsResponsibilitiesResponsibilityPageLayout.noRoutines")}
          </p>
        )}
      </section>

      <ResponsibilitySkills
        skills={responsibility.skills}
        agentsById={agentsById}
        addControl={editable ? picker("skill") : null}
        removeControl={(skill) => unlinkRow(skill.linkId, skill.name, { skillId: skill.id })}
      />

      <section aria-labelledby="responsibility-projects-heading" className="flex flex-col gap-2">
        <SectionHeading
          id="responsibility-projects-heading"
          title={t("componentsResponsibilitiesResponsibilityPageLayout.projects")}
          count={responsibility.projects.length}
          question={t("componentsResponsibilitiesResponsibilityPageLayout.projectsQuestion")}
          action={editable ? picker("project") : null}
        />
        {responsibility.projects.length > 0 ? (
          <ul className="flex flex-col">
            {responsibility.projects.map((project: ResponsibilityProjectSummary) => {
              const projectDue = describeNextDue(project.targetDate, now);
              return (
                <WorkRow
                  key={project.id}
                  actions={
                    <>
                      {giveRow({ kind: "project", id: project.id, label: project.name, currentAgentId: project.leadAgentId })}
                      {unlinkRow(project.linkId, project.name, { projectId: project.id })}
                    </>
                  }
                >
                  <EntityRow
                    className="border-b-0"
                    leading={<FolderOpen className="size-4 text-muted-foreground" aria-hidden="true" />}
                    title={project.name}
                    to={projectUrl(project)}
                    meta={
                      projectDue ? (
                        <span className={cn("text-xs tabular-nums", projectDue.late ? "text-(--status-task-icon-blocked)" : "text-muted-foreground")}>
                          {projectDue.late ? t("componentsResponsibilitiesResponsibilityPageLayout.late", { label: projectDue.label }) : t("componentsResponsibilitiesResponsibilityPageLayout.due", { label: projectDue.label })}
                        </span>
                      ) : null
                    }
                    trailing={<StatusBadge status={project.status} />}
                  />
                </WorkRow>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("componentsResponsibilitiesResponsibilityPageLayout.noProjects")}
          </p>
        )}
      </section>

      <section aria-labelledby="responsibility-tasks-heading" className="flex flex-col gap-2">
        <SectionHeading
          id="responsibility-tasks-heading"
          title={t("componentsResponsibilitiesResponsibilityPageLayout.tasks")}
          count={responsibility.rollup.openTasks}
          question={t("componentsResponsibilitiesResponsibilityPageLayout.tasksQuestion")}
          action={editable ? picker("task") : null}
        />
        {tasks.blocked > 0 ? (
          <p className="text-sm text-(--status-task-icon-blocked)">
            {tasks.blocked === 1 ? t("componentsResponsibilitiesResponsibilityPageLayout.oneTaskBlocked") : t("componentsResponsibilitiesResponsibilityPageLayout.tasksBlocked", { count: tasks.blocked })}
          </p>
        ) : null}
        {tasks.open.length > 0 ? (
          <ul className="flex flex-col">{tasks.open.map(renderTask)}</ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("componentsResponsibilitiesResponsibilityPageLayout.noOpenTasks")}{" "}{isActive ? t("componentsResponsibilitiesResponsibilityPageLayout.createOrAdd") : t("componentsResponsibilitiesResponsibilityPageLayout.addExisting")}
          </p>
        )}
        {tasks.done.length > 0 ? (
          <div className="flex flex-col gap-1">
            <Button size="sm" variant="ghost" className="w-fit" aria-expanded={showDone} onClick={() => setShowDone((value) => !value)}>
              <ChevronDown aria-hidden="true" className={cn("transition-transform", !showDone && "-rotate-90")} />
              {showDone ? t("componentsResponsibilitiesResponsibilityPageLayout.hideDone", { count: tasks.done.length }) : t("componentsResponsibilitiesResponsibilityPageLayout.showDone", { count: tasks.done.length })}
            </Button>
            {showDone ? <ul className="flex flex-col">{tasks.done.map(renderTask)}</ul> : null}
          </div>
        ) : null}
        {responsibility.tasksTruncated ? (
          <p className="text-xs text-muted-foreground">
            {t("componentsResponsibilitiesResponsibilityPageLayout.truncated", { limit: RESPONSIBILITY_DETAIL_TASK_LIMIT })}
          </p>
        ) : null}
      </section>

      <ResponsibilityArtifacts
        artifacts={responsibility.artifacts}
        total={responsibility.artifactsTotal}
        truncated={responsibility.artifactsTruncated}
      />
    </div>
  );
}
