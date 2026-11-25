import { t } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { chatEndpointsApi } from "@/api/chatEndpoints";
import { queryKeys } from "@/lib/queryKeys";
import {
  Activity,
  GitPullRequest,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import { SidebarNavItem } from "../SidebarNavItem";
import { contextualSidebarStyles } from "../contextual-sidebar-styles";

export function ChatDetailSidebar({
  endpointId,
  NavItem = SidebarNavItem,
}: {
  endpointId: string;
  NavItem?: typeof SidebarNavItem;
}) {
  const endpoint = useQuery({
    queryKey: queryKeys.chatEndpoints.detail(endpointId),
    queryFn: () => chatEndpointsApi.get(endpointId),
    enabled: Boolean(endpointId),
  });
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-border bg-background">
      <nav
        aria-label={t("componentsChat.chatDetailSidebar.ariaLabel")}
        data-slot="contextual-sidebar-nav"
        className={contextualSidebarStyles.nav}
      >
        <div
          data-slot="contextual-sidebar-group"
          className={contextualSidebarStyles.group}
        >
          <NavItem
            to={`/apps/chat/${endpointId}/settings`}
            label={t("componentsChat.chatDetailSidebar.settings")}
            icon={Settings}
            end
          />
          <NavItem
            to={`/apps/chat/${endpointId}/access`}
            label={t("componentsChat.chatDetailSidebar.access")}
            icon={Users}
            end
          />
          {endpoint.data?.provider === "github" && (
            <NavItem
              to={`/apps/chat/${endpointId}/reviews`}
              label={t("componentsChat.chatDetailSidebar.reviews")}
              icon={GitPullRequest}
            />
          )}
          <NavItem
            to={`/apps/chat/${endpointId}/conversations`}
            label={t("componentsChat.chatDetailSidebar.conversations")}
            icon={MessageSquare}
            end
          />
          <NavItem
            to={`/apps/chat/${endpointId}/activity`}
            label={t("componentsChat.chatDetailSidebar.activity")}
            icon={Activity}
            end
          />
        </div>
      </nav>
    </aside>
  );
}
