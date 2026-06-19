import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, ShieldCheck, Layers, Users, FileText, Gavel, Vote, BookOpen, FlaskConical, Settings,
} from "lucide-react";

const specialistItems = [
  { title: "Hub",           url: "/specialists",            icon: LayoutDashboard },
  { title: "Moderation",    url: "/specialists/moderation", icon: ShieldCheck },
  { title: "Panels",        url: "/specialists/panels",     icon: Users },
  { title: "Clusters",      url: "/specialists/clusters",   icon: Layers },
  { title: "Apply",         url: "/specialists/apply",      icon: FileText },
];

const governanceItems = [
  { title: "Governance",    url: "/governance",            icon: BookOpen },
  { title: "Transparency",  url: "/governance/log",        icon: FileText },
  { title: "Elections",     url: "/governance/elections",  icon: Vote },
  { title: "Juries",        url: "/governance/juries",     icon: Gavel },
];

const adminItems = [
  { title: "Specialists",   url: "/admin/specialists",     icon: Settings },
];

const SpecialistSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (p: string) => pathname === p || (p !== "/specialists" && pathname.startsWith(p));

  const renderGroup = (label: string, items: typeof specialistItems) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
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
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="border-r-2" style={{ borderColor: "hsl(var(--role-accent) / 0.25)" }}>
        {renderGroup("Specialist", specialistItems)}
        {renderGroup("Governance", governanceItems)}
        {renderGroup("Admin", adminItems)}
      </SidebarContent>
    </Sidebar>
  );
};

export default SpecialistSidebar;