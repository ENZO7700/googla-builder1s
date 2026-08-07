import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Bot, User, Check, X, Wrench, ShieldAlert } from "lucide-react";

interface Props {
  siteId: string;
  onRunLogged?: () => void;
}

const AGENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wp-agent`;

type ToolPart = {
  type: string;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function isToolPart(p: { type: string }): p is ToolPart {
  return p.type.startsWith("tool-");
}

export default function WPAgentPanel({ siteId, onRunLogged }: Props) {
  const [input, setInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const correlationRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      tokenRef.current = data.session?.access_token ?? null;
      setToken(tokenRef.current);
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: AGENT_URL,
        headers: () => ({
          Authorization: `Bearer ${tokenRef.current ?? ""}`,
          "Content-Type": "application/json",
          "x-correlation-id": correlationRef.current ?? "",
        }),
        body: () => ({ siteId }),
      }),
    [siteId],
  );

  const { messages, sendMessage, status, error, addToolResult } = useChat({
    id: `wp-agent-${siteId}`,
    transport,
    // After the user approves/rejects wp_apply we submit the tool result back
    // automatically so the agent can continue instead of stalling.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (e) => {
      toast.error(`Agent zlyhal: ${e.message}`);
      void finishRun("error", null, e.message);
    },
    onFinish: () => {
      void finishRun("done", null, null);
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy, siteId]);

  async function startRun(prompt: string) {
    const cid = globalThis.crypto?.randomUUID?.() ?? `cid_${Date.now()}`;
    correlationRef.current = cid;
    runIdRef.current = null;
    if (!userId) return;
    const { data, error: insErr } = await supabase
      .from("wp_agent_runs")
      .insert({ site_id: siteId, user_id: userId, correlation_id: cid, prompt, status: "running" })
      .select("id")
      .single();
    if (insErr) {
      console.error("wp_agent_runs insert failed", insErr);
      return;
    }
    runIdRef.current = data.id;
    onRunLogged?.();
  }

  async function finishRun(status: "done" | "error" | "rejected", result: unknown, err: string | null) {
    const id = runIdRef.current;
    if (!id) return;
    const { error: updErr } = await supabase
      .from("wp_agent_runs")
      .update({
        status,
        error: err,
        result_json: result === null ? null : (result as never),
        finished_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updErr) console.error("wp_agent_runs update failed", updErr);
    onRunLogged?.();
  }

  async function logToolCall(entry: Record<string, unknown>) {
    const id = runIdRef.current;
    if (!id) return;
    const { data } = await supabase.from("wp_agent_runs").select("tool_calls").eq("id", id).single();
    const prev = Array.isArray(data?.tool_calls) ? (data!.tool_calls as unknown[]) : [];
    await supabase
      .from("wp_agent_runs")
      .update({ tool_calls: [...prev, { ...entry, at: new Date().toISOString() }] as never })
      .eq("id", id);
    onRunLogged?.();
  }

  async function submit() {
    const text = input.trim();
    if (!text || busy) return;
    // Make sure we have a fresh access token before the first request.
    let authToken = token;
    if (!authToken) {
      const { data } = await supabase.auth.getSession();
      authToken = data.session?.access_token ?? null;
      tokenRef.current = authToken;
      setToken(authToken);
      setUserId(data.session?.user?.id ?? null);
      if (!authToken) {
        toast.error("Nie si prihlásený — prihlás sa a skús znova.");
        return;
      }
    }
    setInput("");
    await startRun(text);
    await sendMessage({ text });
  }

  async function approveApply(part: ToolPart) {
    const proceedToken = (part.input as { proceedToken?: string } | undefined)?.proceedToken;
    if (!proceedToken) {
      toast.error("Chýba proceedToken");
      return;
    }
    setApplying(part.toolCallId);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("wp-plan-apply", {
        body: { proceedToken },
      });
      if (fnErr) throw fnErr;
      await logToolCall({ tool: "wp_apply", decision: "approved", result: data });
      addToolResult({ tool: "wp_apply", toolCallId: part.toolCallId, output: data });
      toast.success("Apply vykonaný");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "chyba";
      await logToolCall({ tool: "wp_apply", decision: "approved", error: msg });
      addToolResult({
        tool: "wp_apply",
        toolCallId: part.toolCallId,
        output: { ok: false, error: msg },
      });
      toast.error(`Apply zlyhal: ${msg}`);
    } finally {
      setApplying(null);
    }
  }

  async function rejectApply(part: ToolPart) {
    await logToolCall({ tool: "wp_apply", decision: "rejected", input: part.input });
    addToolResult({
      tool: "wp_apply",
      toolCallId: part.toolCallId,
      output: { ok: false, rejected: true, error: "Užívateľ zamietol apply krok." },
    });
    await finishRun("rejected", null, "Užívateľ zamietol apply krok.");
    toast.message("Apply zamietnutý");
  }

  return (
    <div className="flex flex-col h-[70vh] min-h-0 border border-border rounded-xl bg-card overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-center gap-2">
        <Bot size={16} className="text-primary" />
        <div className="text-sm font-semibold">WP Agent</div>
        <div className="text-[11px] text-muted-foreground ml-auto font-mono">
          {correlationRef.current ? `cid: ${correlationRef.current.slice(0, 8)}` : "pripravený"}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-scroll p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Napíš, čo má agent na WordPresse zistiť alebo zmeniť. Mutácie idú vždy cez plán a musíš ich
            schváliť.
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              {m.role === "user" ? <User size={12} /> : <Bot size={12} />}
              {m.role === "user" ? "Ty" : "Agent"}
            </div>
            {m.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <p key={i} className="text-sm whitespace-pre-wrap leading-relaxed">
                    {part.text}
                  </p>
                );
              }
              if (isToolPart(part)) {
                const toolName = part.type.replace(/^tool-/, "");
                const needsApproval = toolName === "wp_apply" && part.state === "input-available";
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-center gap-2 font-mono">
                      <Wrench size={12} /> {toolName}
                      <span className="text-muted-foreground">· {part.state}</span>
                    </div>
                    {part.input !== undefined && (
                      <pre className="overflow-x-auto text-[11px] text-muted-foreground">
                        {JSON.stringify(part.input, null, 2)}
                      </pre>
                    )}
                    {part.output !== undefined && (
                      <pre className="overflow-x-auto text-[11px] max-h-48 overflow-y-auto">
                        {JSON.stringify(part.output, null, 2)}
                      </pre>
                    )}
                    {part.errorText && <div className="text-destructive">{part.errorText}</div>}

                    {needsApproval && (
                      <div className="pt-1 space-y-2">
                        <div className="flex items-center gap-2 text-amber-500">
                          <ShieldAlert size={12} /> Tento krok mení WordPress. Schváľ alebo zamietni.
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveApply(part)}
                            disabled={applying === part.toolCallId}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                          >
                            {applying === part.toolCallId ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            Schváliť a vykonať
                          </button>
                          <button
                            onClick={() => rejectApply(part)}
                            disabled={applying === part.toolCallId}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border disabled:opacity-50"
                          >
                            <X size={12} /> Zamietnuť
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> Agent premýšľa…
          </div>
        )}
        {error && <div className="text-xs text-destructive">{error.message}</div>}
      </div>

      <div className="shrink-0 border-t border-border p-3 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={2}
          placeholder="Napr. skontroluj verziu core a vypíš aktívne pluginy"
          className="flex-1 resize-none bg-background border border-border rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          onClick={() => void submit()}
          disabled={busy || !input.trim()}
          className="inline-flex items-center gap-2 px-4 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Poslať
        </button>
      </div>
    </div>
  );
}
