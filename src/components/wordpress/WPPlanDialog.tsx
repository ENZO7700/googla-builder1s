import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Play, Undo2, AlertTriangle, ShieldAlert } from "lucide-react";

export type PlannedCall =
  | { scope: "rest"; method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; path: string; body?: unknown }
  | { scope: "cli"; command: string };

type PlanResponse = {
  snapshotId: string;
  proceedToken: string;
  expiresAt: string;
  target: string;
  risk: "low" | "medium" | "high";
  revertible: boolean;
  before: unknown;
  plannedPatch: Record<string, unknown> | null;
  diff: Array<{ key: string; before: unknown; after: unknown }>;
};

interface Props {
  siteId: string;
  call: PlannedCall | null;
  onClose: () => void;
  onApplied?: (r: { ok: boolean; rolled_back: boolean; result: unknown }) => void;
}

export default function WPPlanDialog({ siteId, call, onClose, onApplied }: Props) {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  async function runDryRun() {
    if (!call) return;
    setLoading(true);
    setPlan(null);
    try {
      const { data, error } = await supabase.functions.invoke("wp-plan-dryrun", { body: { siteId, call } });
      if (error) throw error;
      setPlan(data as PlanResponse);
    } catch (e) {
      toast.error(`Plán zlyhal: ${e instanceof Error ? e.message : "chyba"}`);
    } finally { setLoading(false); }
  }

  async function apply() {
    if (!plan) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("wp-plan-apply", { body: { proceedToken: plan.proceedToken } });
      if (error) throw error;
      const r = data as { ok: boolean; rolled_back: boolean; result: unknown; error?: string };
      if (r.ok) toast.success("Zmena aplikovaná");
      else if (r.rolled_back) toast.warning("Zmena zlyhala – automaticky rollbacknuté");
      else toast.error(`Zmena zlyhala: ${r.error ?? "chyba"}`);
      onApplied?.(r);
      onClose();
    } catch (e) {
      toast.error(`Apply zlyhal: ${e instanceof Error ? e.message : "chyba"}`);
    } finally { setApplying(false); }
  }

  if (!call) return null;

  const riskColor = plan?.risk === "high" ? "text-red-500" : plan?.risk === "medium" ? "text-amber-500" : "text-emerald-500";

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-2xl w-full bg-card border border-border rounded-xl shadow-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Plánovaná zmena</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">Zavrieť</button>
        </div>

        <div className="text-xs font-mono bg-muted/30 rounded p-2 border border-border/60">
          {call.scope === "rest" ? `${call.method} ${call.path}` : `wp ${call.command}`}
        </div>

        {!plan ? (
          <button
            onClick={runDryRun}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Naplánuj (dry-run + diff)
          </button>
        ) : (
          <>
            <div className="flex items-center gap-4 text-xs">
              <span className={`inline-flex items-center gap-1 ${riskColor}`}><ShieldAlert size={14} />risk: {plan.risk}</span>
              <span className={plan.revertible ? "text-emerald-500 inline-flex items-center gap-1" : "text-amber-500 inline-flex items-center gap-1"}>
                <Undo2 size={14} />{plan.revertible ? "revertible" : "non-revertible"}
              </span>
              <span className="text-muted-foreground">token TTL: {new Date(plan.expiresAt).toLocaleTimeString()}</span>
            </div>

            {plan.diff.length > 0 ? (
              <div className="max-h-64 overflow-auto border border-border/60 rounded bg-muted/20 divide-y divide-border/40">
                {plan.diff.map((d) => (
                  <div key={d.key} className="p-2 text-xs font-mono">
                    <div className="text-muted-foreground">{d.key}</div>
                    <div className="text-red-400">- {JSON.stringify(d.before)}</div>
                    <div className="text-emerald-400">+ {JSON.stringify(d.after)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <AlertTriangle size={14} /> Bez strukturálneho diffu (creation / CLI / žiadny snapshot).
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-border">Zrušiť</button>
              <button
                onClick={apply}
                disabled={applying}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50"
              >
                {applying ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Vykonať
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
