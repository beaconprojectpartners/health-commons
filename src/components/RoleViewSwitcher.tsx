import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoleView, roleMeta, type RoleView } from "@/contexts/RoleView";

const order: RoleView[] = ["patient", "specialist", "researcher"];

const RoleViewSwitcher = ({ className }: { className?: string }) => {
  const { role, setRole } = useRoleView();
  return (
    <Select value={role} onValueChange={(v) => setRole(v as RoleView)}>
      <SelectTrigger
        className={className ?? "h-8 w-[170px] border-[hsl(var(--role-accent)/0.4)] bg-[hsl(var(--role-accent-soft))] text-xs font-medium"}
      >
        <span className="text-muted-foreground">View as</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {order.map((r) => (
          <SelectItem key={r} value={r}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: roleMeta[r].dot }} />
              {roleMeta[r].label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default RoleViewSwitcher;