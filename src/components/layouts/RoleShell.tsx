import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import RoleSidebar from "@/components/RoleSidebar";

const RoleShell = ({ children }: { children: ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <RoleSidebar />
        <div className="flex-1 relative min-w-0">
          <SidebarTrigger
            className="absolute left-2 top-2 z-50"
            style={{ color: "hsl(var(--role-accent))" }}
          />
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default RoleShell;