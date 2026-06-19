import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import RoleSidebar from "@/components/RoleSidebar";
import { useAuth } from "@/hooks/useAuth";

const RoleShell = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  if (!user) {
    return <div className="min-h-screen w-full">{children}</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <RoleSidebar />
        <div className="flex-1 relative min-w-0">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default RoleShell;