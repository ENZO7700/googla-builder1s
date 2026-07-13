import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, MinusCircle } from "lucide-react";

interface Props { siteId: string; }

type CheckResult = {
  id: string; title: string; status: "pass" | "warn" | "fail" | "skip";
  weight: number; detail?: string; duration_ms: number;
};

export default function WPReadinessPanel({ siteId }: Props) {
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [results, setResults] = useState<CheckResult[]>([]);

  async function run() {
    setRunning(true); setScore(null); setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("wp-prod-readiness", { body: { siteId } });
      if (error) throw error;
      const r = data as { score: number; results: CheckResult[] };
      setScore(r.score); setResults(r.results);
      if (r.score >= 80) toast.success(`Readiness ${r.score}/100 — Green light`);
      else toast.warning(`Readiness ${r.score}/100 — Nepúšťať na prod`);
    } catch (e) {
      toast.error(`Readiness zlyhal: ${e instanceof Error ? e.message : "?"}`);
    } finally { setRunning(false); }
  }

  const barColor = score == null ? "bg-muted" : score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2"><ShieldCheck size={18} /> Production Readiness</h3>
          <p className="text-xs text-muted-foreground">Green-Light Gate: 12 probov končí scorecardom.</p>
        </div>
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50">
          {running ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Spustiť test
        </button>
      </div>

      {score != null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Score</span>
            <span className="font-mono">{score} / 100</span>
          </div>
          <div className="h-2 rounded bg-muted/40 overflow-hidden"><div className={`h-full ${barColor}`} style={{ width: `${score}%` }} /></div>
          {score < 80 && <p className="text-xs text-amber-500">NEPÚŠŤAŤ NA PROD — score pod 80.</p>}
        </div>
      )}

      {results.length > 0 && (
        <div className="border border-border/60 rounded divide-y divide-border/40 bg-muted/10">
          {results.map((r) => {
            const Icon = r.status === "pass" ? CheckCircle2 : r.status === "warn" ? AlertTriangle : r.status === "fail" ? XCircle : MinusCircle;
            const color = r.status === "pass" ? "text-emerald-500" : r.status === "warn" ? "text-amber-500" : r.status === "fail" ? "text-red-500" : "text-muted-foreground";
            return (
              <div key={r.id} className="p-3 flex items-start gap-3">
                <Icon size={16} className={`mt-0.5 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{r.title}</div>
                  {r.detail && <div className="text-xs text-muted-foreground">{r.detail}</div>}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">{r.weight}b · {r.duration_ms}ms</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
