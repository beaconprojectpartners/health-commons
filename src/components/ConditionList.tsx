import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const ConditionList = () => {
  const [search, setSearch] = useState("");

  const { data: conditions, isLoading } = useQuery({
    queryKey: ["conditions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conditions")
        .select("*")
        .eq("approved", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = conditions?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="py-16" id="conditions">
      <div className="container mx-auto px-4">
        <div className="mb-8 text-center">
          <h2 className="mb-3 text-3xl text-foreground">Condition Registry</h2>
          <p className="text-muted-foreground">
            Browse tracked conditions or submit data for any of them
          </p>
        </div>

        <div className="mx-auto mb-8 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search conditions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered?.map((condition) => (
              <Link
                key={condition.id}
                to={`/submit?condition=${condition.id}`}
                className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-card transition-all hover:border-primary/30 hover:shadow-elevated"
              >
                <div>
                  <h3 className="font-medium text-card-foreground group-hover:text-primary">
                    {condition.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {condition.icd10_code && <span>{condition.icd10_code}</span>}
                    <span>{condition.submission_count || 0} submissions</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ConditionList;
