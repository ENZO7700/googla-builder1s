import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import WPPlanDialog from "./WPPlanDialog";

interface Props { siteId: string; }

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export default function WPRestRunner({ siteId }: Props) {
  const [method, setMethod] = useState<Method>("GET");
  const [path, setPath] = useState("posts?per_page=1");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");
  const [plan, setPlan] = useState<null | { method: Method; path: string; body?: unknown }>(null);

  async function runReadOnly() {
    setBusy(true); setResult("");
    try {
      // Split query
      const [p, qs] = path.split("?", 2);
      const query: Record<string, string> = {};
      new URLSearchParams(qs ?? "").forEach((v, k) => { query[k] = v; });
      const { data, error } = await supabase.functions.invoke("wordpress-proxy", { body: { siteId, method, path: p, query } });
      if (error) throw error;
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      toast.error(`Chyba: ${e instanceof Error ? e.message : "?"}`);
    } finally { setBusy(false); }
  }

  function openPlan() {
    let parsed: unknown = undefined;
    if (body.trim()) {
      try { parsed = JSON.parse(body); }
      catch { toast.error("Body musí byť validný JSON"); return; }
    }
    const [p] = path.split("?", 1);
    setPlan({ method, path: p, body: parsed });
  }

  const isMutation = method !== "GET";

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select value={method} onChange={(e) => setMethod(e.target.value as Method)} className="bg-muted/30 border border-border rounded px-2 py-1.5 text-sm">
          <option>GET</option><option>POST</option><option>PATCH</option><option>DELETE</option>
        </select>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="posts, posts/12, settings, categories?per_page=5"
          className="flex-1 bg-muted/30 border border-border rounded px-3 py-1.5 text-sm font-mono"
        />
        {isMutation ? (
          <button onClick={openPlan} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm">
            <Send size={14} /> Naplánuj
          </button>
        ) : (
          <button onClick={runReadOnly} disabled={busy} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Spustiť
          </button>
        )}
      </div>
      {isMutation && (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder='{ "title": "Nový nadpis" }'
          rows={5}
          className="w-full bg-muted/30 border border-border rounded p-2 text-xs font-mono"
        />
      )}
      {result && (
        <pre className="max-h-80 overflow-auto text-xs bg-muted/20 border border-border/60 rounded p-3">{result}</pre>
      )}
      {plan && (
        <WPPlanDialog
          siteId={siteId}
          call={{ scope: "rest", method: plan.method, path: plan.path, body: plan.body }}
          onClose={() => setPlan(null)}
          onApplied={(r) => setResult(JSON.stringify(r, null, 2))}
        />
      )}
    </div>
  );
}
