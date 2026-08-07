import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { RefreshCw, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Ban } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/dashboard/States";

interface Props {
  siteId: string;
}

interface RunRow {
  id: string;
  correlation_id: string;
  prompt: string | null;
  status: string;
  tool_calls: unknown;
  result_json: unknown;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "done") return <CheckCircle2 size={14} className="text-emerald-500" />;
  if (status === "error") return <XCircle size={14} className="text-destructive" />;
  if (status === "rejected") return <Ban size={14} className="text-amber-500" />;
  return <Loader2 size={14} className="animate-spin text-muted-foreground" />;
}

export default function WPAgentRuns({ siteId }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  const { data: runs = [], isLoading, refetch, isFetching } = useQuery<RunRow[]>({
    queryKey: ["wp_agent_runs", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wp_agent_runs")
        .select("id, correlation_id, prompt, status, tool_calls, result_json, error, created_at, finished_at")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as RunRow[];
    },
  });

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">História agent spustení</h3>
          <p className="text-[11px] text-muted-foreground">Stav, correlation ID, výsledky a dôvody chýb.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-md border border-border hover:bg-accent"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> Obnoviť
        </button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : runs.length === 0 ? (
        <EmptyState title="Žiadne spustenia" description="Spusti agenta v tabe AI Agent." />
      ) : (
        <div className="border border-border rounded-xl divide-y divide-border/60 overflow-hidden">
          {runs.map((r) => {
            const expanded = open === r.id;
            const tools = Array.isArray(r.tool_calls) ? (r.tool_calls as Record<string, unknown>[]) : [];
            return (
              <div key={r.id}>
                <button
                  onClick={() => setOpen(expanded ? null : r.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-accent/40 transition"
                >
                  {expanded ? <ChevronDown size={14} className="mt-0.5" /> : <ChevronRight size={14} className="mt-0.5" />}
                  <StatusIcon status={r.status} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{r.prompt ?? "(bez promptu)"}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {new Date(r.created_at).toLocaleString()} · cid: {r.correlation_id.slice(0, 8)} ·{" "}
                      {r.status}
                      {tools.length > 0 ? ` · ${tools.length} tool call(ov)` : ""}
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 space-y-3 text-xs">
                    <div className="font-mono text-[11px] text-muted-foreground">
                      correlationId: {r.correlation_id}
                      {r.finished_at ? ` · dokončené: ${new Date(r.finished_at).toLocaleString()}` : ""}
                    </div>
                    {r.error && (
                      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive">
                        {r.error}
                      </div>
                    )}
                    {tools.length > 0 && (
                      <div className="space-y-2">
                        {tools.map((t, i) => (
                          <pre
                            key={i}
                            className="overflow-x-auto rounded-md border border-border/60 bg-muted/20 p-2 text-[11px]"
                          >
                            {JSON.stringify(t, null, 2)}
                          </pre>
                        ))}
                      </div>
                    )}
                    {r.result_json !== null && r.result_json !== undefined && (
                      <pre className="overflow-auto max-h-64 rounded-md border border-border/60 bg-muted/20 p-2 text-[11px]">
                        {JSON.stringify(r.result_json, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
