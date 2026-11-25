import type { Issue } from "@paperclipai/shared";
import { Boxes, CircleCheck, CirclePlus, FolderOpen, History, LayoutDashboard, MessageCircle, Package, Repeat, Search, Unplug, Users } from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import { SidebarAccountMenu } from "./SidebarAccountMenu";
import { SidebarCompanyMenu } from "./SidebarCompanyMenu";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarSection } from "./SidebarSection";
import { RecentTaskNavItem, recentTaskPathRef } from "./RecentTaskNavItem";
import { TruncatedTextMarqueeProvider } from "./TruncatedText";
import { Button } from "./ui/button";
import { FlyoutAppearanceProvider } from "./ui/flyout";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useScrollbarWhileScrolling } from "./side-panel/use-scrollbar-while-scrolling";
import { t } from "@/i18n";

export type DesignSidebarRecentTask = Pick<Issue, "id" | "companyId" | "identifier" | "title">;

/** Shared staged sidebar. The caller supplies company-scoped recent tasks and actions. */
export function DesignSidebar({ onNewTask, recentTasks = [] }: { onNewTask: () => void; recentTasks?: readonly DesignSidebarRecentTask[] }) {
  const { selectedCompany } = useCompany();
  const root = `/${selectedCompany?.issuePrefix ?? "PAP"}`;
  const companyRecentTasks = recentTasks.filter(task => task.companyId === selectedCompany?.id);
  const handleRecentScroll = useScrollbarWhileScrolling();
  return (
    <FlyoutAppearanceProvider><TruncatedTextMarqueeProvider>
      <div className="design-sidebar">
        <div className="design-sidebar-brand">
          <SidebarCompanyMenu showChevron={false} />
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" className="design-sidebar-search" aria-label={t("componentsDesignSidebar.globalSearch")} onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true }))}><Search aria-hidden /></Button></TooltipTrigger><TooltipContent side="right">{t("componentsDesignSidebar.searchTooltip")}</TooltipContent></Tooltip>
        </div>
        <nav className="design-sidebar-navigation" aria-label={t("componentsDesignSidebar.mainNavigation")}>
          <div className="design-sidebar-primary">
            <Button variant="ghost" className="design-sidebar-new-task" onClick={onNewTask}><CirclePlus aria-hidden />{t("componentsDesignSidebar.newTask")}</Button>
            <SidebarNavItem className="design-sidebar-item" to={`${root}/dashboard`} label={t("componentsDesignSidebar.dashboard")} icon={LayoutDashboard} />
            <SidebarNavItem className="design-sidebar-item" to={`${root}/chats`} label={t("componentsDesignSidebar.chat")} icon={MessageCircle} />
          </div>
          <SidebarSection label={t("componentsDesignSidebar.work")}>
            <SidebarNavItem className="design-sidebar-item" to={`${root}/issues`} label={t("componentsDesignSidebar.tasks")} icon={CircleCheck} />
            <SidebarNavItem className="design-sidebar-item" to={`${root}/projects`} label={t("componentsDesignSidebar.projects")} icon={FolderOpen} />
            <SidebarNavItem className="design-sidebar-item" to={`${root}/routines`} label={t("componentsDesignSidebar.routines")} icon={Repeat} />
            <SidebarNavItem className="design-sidebar-item" to={`${root}/artifacts`} label={t("componentsDesignSidebar.artifacts")} icon={Package} />
          </SidebarSection>
          <SidebarSection label={t("componentsDesignSidebar.org")}>
            <SidebarNavItem className="design-sidebar-item" to={`${root}/agents`} label={t("componentsDesignSidebar.agents")} icon={Users} />
            <SidebarNavItem className="design-sidebar-item" to={`${root}/skills`} label={t("componentsDesignSidebar.skills")} icon={Boxes} />
            <SidebarNavItem className="design-sidebar-item" to={`${root}/apps`} label={t("componentsDesignSidebar.connectors")} icon={Unplug} />
            <SidebarNavItem className="design-sidebar-item" to={`${root}/activity`} label={t("componentsDesignSidebar.audit")} icon={History} />
          </SidebarSection>
          {companyRecentTasks.length > 0 ? <div className="design-sidebar-recents">
            <SidebarSection label={t("componentsDesignSidebar.recentTasks")}>
              <div onScroll={handleRecentScroll} className="design-sidebar-recent-list scrollbar-while-scrolling" role="region" aria-label={t("componentsDesignSidebar.recentTasksRegion")} tabIndex={0}>
              {companyRecentTasks.map(issue => <RecentTaskNavItem key={issue.id} task={issue} className="design-sidebar-item" to={`${root}/issues/${recentTaskPathRef(issue)}`} label={issue.title} />)}
              </div>
            </SidebarSection>
          </div> : null}
        </nav>
        <div className="design-sidebar-account"><SidebarAccountMenu /></div>
      </div>
    </TruncatedTextMarqueeProvider></FlyoutAppearanceProvider>
  );
}
