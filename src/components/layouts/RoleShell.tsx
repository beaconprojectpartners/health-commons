import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useRoleView } from "@/contexts/RoleView";
import SpecialistSidebar from "@/components/SpecialistSidebar";

const RoleShell = ({ children }: { children: ReactNode }) => {
  const { role } = useRoleView();

  if (role !== "specialist") return <>{children}</>;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <SpecialistSidebar />
        <div className="flex-1 relative">
          <SidebarTrigger className="absolute left-2 top-2 z-50 md:hidden" />
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default RoleShell;