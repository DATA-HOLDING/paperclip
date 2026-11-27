import { useState } from "react";
import { ArrowUpDown, Check, Columns3, Filter, Layers, Plus } from "lucide-react";
import { Link } from "@/lib/router";
import { t } from "@/i18n";
import { defaultRoutineView, routineColumns, routineFilterKeys, type RoutineColumn, type RoutineFilterKey, type RoutineViewState, type RoutineGroupBy, type RoutineSortField, type RoutineSortDir } from "@/lib/routine-list-view";
import { ToolbarSearch } from "./ToolbarSearch";
import { FilterGroup, FilterRow } from "./CollectionFilterOptions";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { FlyoutAppearanceProvider, FlyoutHeader } from "./ui/flyout";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
export type { RoutineGroupBy, RoutineSortField, RoutineSortDir } from "@/lib/routine-list-view";
export type RoutineFilterOptions = Partial<Record<RoutineFilterKey, { id: string; name: string }[]>>;

export function RoutinesToolbar({ query, onQueryChange, sortField, sortDir, groupBy, onSortChange, onGroupChange, onNewFolder, onCreateRoutine, tasksHref, filters = defaultRoutineView, filterOptions = {}, onFiltersChange, columns = defaultRoutineView.columns, onColumnsChange, showListControls = true }: {
  showListControls?: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  sortField: RoutineSortField;
  sortDir: RoutineSortDir;
  groupBy: RoutineGroupBy;
  onSortChange: (field: RoutineSortField, direction: RoutineSortDir) => void;
  onGroupChange: (value: RoutineGroupBy) => void;
  onNewFolder?: () => void;
  onCreateRoutine: () => void;
  tasksHref?: string;
  filters?: Pick<RoutineViewState, RoutineFilterKey>;
  filterOptions?: RoutineFilterOptions;
  onFiltersChange?: (patch: Partial<RoutineViewState>) => void;
  columns?: RoutineColumn[];
  onColumnsChange?: (columns: RoutineColumn[]) => void;
}) {
  const [optionQueries, setOptionQueries] = useState<Record<string, string>>({});
  const activeFilters = routineFilterKeys.reduce((count, key) => count + filters[key].length, 0);
  return <FlyoutAppearanceProvider appearance="refreshed"><div data-canonical-toolbar="routines" role="toolbar" aria-label={t("componentsRoutinesToolbar.controls")} className="design-page-toolbar">
    <Button variant="outline" className="design-toolbar-button" data-toolbar-primary onClick={onCreateRoutine}><Plus aria-hidden />{t("componentsRoutinesToolbar.newRoutine")}</Button>
    <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
      {showListControls ? <>
      <ToolbarSearch query={query} onQueryChange={onQueryChange} label={t("componentsRoutinesToolbar.searchLabel")} placeholder={t("componentsRoutinesToolbar.searchPlaceholder")} />
      <Popover>
        <PopoverTrigger asChild><Button variant="outline" className="design-toolbar-button design-toolbar-icon" title={t("componentsRoutinesToolbar.sort.title")} aria-label={t("componentsRoutinesToolbar.sort.ariaLabel")}><ArrowUpDown aria-hidden /></Button></PopoverTrigger>
        <PopoverContent align="end" className="w-44 p-0">
          <FlyoutHeader>{t("componentsRoutinesToolbar.sort.title")}</FlyoutHeader>
          <div className="p-2 space-y-0.5">
            {([["updated", t("componentsRoutinesToolbar.sort.updated")], ["created", t("componentsRoutinesToolbar.sort.created")], ["lastRun", t("componentsRoutinesToolbar.sort.lastRun")], ["title", t("componentsRoutinesToolbar.sort.titleField")]] as const).map(([field, label]) => (
              <button type="button" key={field} className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm ${sortField === field ? "bg-accent/50 text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
                onClick={() => onSortChange(field, sortField === field ? sortDir === "asc" ? "desc" : "asc" : field === "title" ? "asc" : "desc")}>
                <span>{label}</span>{sortField === field ? <span className="text-xs text-muted-foreground">{sortDir === "asc" ? t("componentsRoutinesToolbar.sort.asc") : t("componentsRoutinesToolbar.sort.desc")}</span> : null}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild><Button variant="outline" className="design-toolbar-button design-toolbar-icon" title={t("componentsRoutinesToolbar.filter.title")} aria-label={activeFilters ? t("componentsRoutinesToolbar.filter.ariaLabelCount", { count: activeFilters }) : t("componentsRoutinesToolbar.filter.ariaLabel")} data-active={activeFilters > 0}><Filter aria-hidden /></Button></PopoverTrigger>
        <PopoverContent align="end" className="task-filters-popover">
          <FlyoutHeader className="task-filters-header"><span>{t("componentsRoutinesToolbar.filter.header")}{activeFilters ? ` (${activeFilters})` : ""}</span>{activeFilters ? <Button variant="ghost" onClick={() => onFiltersChange?.(Object.fromEntries(routineFilterKeys.map(key => [key, []])))}>{t("componentsRoutinesToolbar.filter.clear")}</Button> : null}</FlyoutHeader>
          <div className="task-filters-grid">
            {([["projects", t("componentsRoutinesToolbar.filter.project")], ["agents", t("componentsRoutinesToolbar.filter.agent")], ["statuses", t("componentsRoutinesToolbar.filter.enabled")], ["responsibleUsers", t("componentsRoutinesToolbar.filter.responsibleUser")], ["origins", t("componentsRoutinesToolbar.filter.source")]] as const).map(([key, title]) => {
              const selected = new Set(filters[key]);
              const options = filterOptions[key] ?? [];
              const visible = options.filter(option => option.name.toLowerCase().includes((optionQueries[key] ?? "").toLowerCase()));
              return <FilterGroup key={key} title={title} optionsKey={key} searchLabel={options.length > 6 ? title.toLowerCase() : undefined} query={optionQueries[key] ?? ""} onQueryChange={value => setOptionQueries(current => ({ ...current, [key]: value }))}>
                {visible.map(option => <FilterRow key={option.id} label={option.name} checked={selected.has(option.id)} onToggle={() => onFiltersChange?.({ [key]: selected.has(option.id) ? filters[key].filter(value => value !== option.id) : [...filters[key], option.id] })} />)}
                {!visible.length ? <p className="text-xs text-muted-foreground">{t("componentsRoutinesToolbar.filter.noOptions")}</p> : null}
              </FilterGroup>;
            })}
          </div>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild><Button variant="outline" className="design-toolbar-button design-toolbar-icon" title={t("componentsRoutinesToolbar.group.title")} aria-label={t("componentsRoutinesToolbar.group.ariaLabel")}><Layers aria-hidden /></Button></PopoverTrigger>
        <PopoverContent align="end" className="w-44 p-0"><FlyoutHeader>{t("componentsRoutinesToolbar.group.title")}</FlyoutHeader><div className="p-2 space-y-0.5">
          {([["folder", t("componentsRoutinesToolbar.group.folder")], ["project", t("componentsRoutinesToolbar.group.project")], ["assignee", t("componentsRoutinesToolbar.group.agent")], ["none", t("componentsRoutinesToolbar.group.none")]] as const).map(([value, label]) => <button type="button" key={value} className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm ${groupBy === value ? "bg-accent/50 text-foreground" : "text-muted-foreground hover:bg-accent/50"}`} onClick={() => onGroupChange(value)}><span>{label}</span>{groupBy === value ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}</button>)}
          {onNewFolder ? <Button variant="ghost" size="sm" onClick={onNewFolder}><Plus className="h-3.5 w-3.5" />{t("componentsRoutinesToolbar.group.newFolder")}</Button> : null}
        </div></PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" className="design-toolbar-button design-toolbar-icon" title={t("componentsRoutinesToolbar.columns.title")} aria-label={t("componentsRoutinesToolbar.columns.ariaLabel")}><Columns3 aria-hidden /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end"><DropdownMenuLabel>{t("componentsRoutinesToolbar.columns.title")}</DropdownMenuLabel>
          {routineColumns.map(column => <DropdownMenuCheckboxItem key={column.id} checked={columns.includes(column.id)} onSelect={event => event.preventDefault()} onCheckedChange={checked => onColumnsChange?.(checked ? routineColumns.filter(item => item.id === column.id || columns.includes(item.id)).map(item => item.id) : columns.filter(id => id !== column.id))}>{column.label}</DropdownMenuCheckboxItem>)}
          <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => onColumnsChange?.([...defaultRoutineView.columns])}>{t("componentsRoutinesToolbar.columns.reset")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </> : null}
      {tasksHref ? <Button variant="outline" className="design-toolbar-button" asChild><Link to={tasksHref}>{t("componentsRoutinesToolbar.viewAllTasks")}</Link></Button> : null}
    </div>
  </div></FlyoutAppearanceProvider>;
}
