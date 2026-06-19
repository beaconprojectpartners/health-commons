import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, ShieldCheck, Layers, Users, FileText, Gavel, Vote, BookOpen, Settings,
  Stethoscope, ClipboardList, MessageSquare, UserCircle, Search, Database, Star, Code2,
} from "lucide-react";
import { useRoleView, type RoleView } from "@/contexts/RoleView";

type Item = { title: string; url: string; icon: any };
type Group = { label: string; items: Item[] };

const groupsByRole: Record<RoleView, Group[]> = {
  patient: [
    {
      label: "Patient",
      items: [
        { title: "My Profile",    url: "/profile",    icon: UserCircle },
        { title: "Submit Data",   url: "/submit",     icon: ClipboardList },
        { title: "Conditions",    url: "/conditions", icon: Stethoscope },
        { title: "Community",     url: "/community",  icon: MessageSquare },
      ],
    },
  ],
  specialist: [
    {
      label: "Specialist",
      items: [
        { title: "Hub",        url: "/specialists",            icon: LayoutDashboard },
        { title: "Moderation", url: "/specialists/moderation", icon: ShieldCheck },
        { title: "Panels",     url: "/specialists/panels",     icon: Users },
        { title: "Clusters",   url: "/specialists/clusters",   icon: Layers },
        { title: "Apply",      url: "/specialists/apply",      icon: FileText },
      ],
    },
    {
      label: "Governance",
      items: [
        { title: "Governance",   url: "/governance",            icon: BookOpen },
        { title: "Transparency", url: "/governance/log",        icon: FileText },
        { title: "Elections",    url: "/governance/elections",  icon: Vote },
        { title: "Juries",       url: "/governance/juries",     icon: Gavel },
      ],
    },
    {
      label: "Admin",
      items: [
        { title: "Specialists",  url: "/admin/specialists",     icon: Settings },
      ],
    },
  ],
  researcher: [
    {
      label: "Researcher",
      items: [
        { title: "Researcher Hub", url: "/researchers",  icon: LayoutDashboard },
        { title: "Dataset Search", url: "/researchers#search", icon: Search },
        { title: "Conditions",     url: "/conditions",   icon: Database },
        { title: "Favorites",      url: "/researchers#favorites", icon: Star },
        { title: "API Access",     url: "/researchers#api", icon: Code2 },
      ],
    },
  ],
};

const RoleSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role } = useRoleView();
  const groups = groupsByRole[role];

  const isActive = (p: string) => {
    const [path] = p.split("#");
    return pathname === path || (path !== "/" && path.length > 1 && pathname.startsWith(path));
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent
        className="border-r-2"
        style={{ borderColor: "hsl(var(--role-accent) / 0.25)" }}
      >
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--role-accent))" }} />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
};

export default RoleSidebar;