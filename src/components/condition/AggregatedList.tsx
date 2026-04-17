import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AggregatedItem = {
  name: string;
  count: number;
};

interface AggregatedListProps {
  items: AggregatedItem[];
  totalSubmissions: number;
  showPercentages: boolean;
  initialLimit?: number;
}

const AggregatedList = ({ items, totalSubmissions, showPercentages, initialLimit = 15 }: AggregatedListProps) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialLimit);
  const hasMore = items.length > initialLimit;

  return (
    <div className="space-y-3">
      {visible.map((item) => {
        const pct = totalSubmissions > 0 ? Math.round((item.count / totalSubmissions) * 100) : 0;
        return (
          <div key={item.name} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">{item.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{item.count}</Badge>
                {showPercentages && (
                  <span className="w-10 text-right text-xs text-muted-foreground">{pct}%</span>
                )}
              </div>
            </div>
            {showPercentages && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
                <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}
      {hasMore && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : `Show all ${items.length}`}
        </Button>
      )}
    </div>
  );
};

export default AggregatedList;
