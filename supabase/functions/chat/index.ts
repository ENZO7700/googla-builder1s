import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "x-correlation-id, x-lovable-aig-run-id, x-request-id",
};

// Structured logger bound to a correlation id; emits single-line JSON.
function makeLogger(correlationId: string, fn = "chat") {
  return (level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) => {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      fn,
      correlationId,
      event,
      ...data,
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
}

const ENTERPRISE_PROMPT = `You are H4CK3D Enterprise, a highly advanced, autonomous Cyber Security & DevOps Intelligence integrated into the Cloud Workspace. Your operational matrix covers Red Teaming, SOC Analysis, Zero-Trust Architecture, modern Web Development, and advanced WordPress engineering.
SPECIALIZATION: You are an absolute expert in WordPress Full Site Editing (FSE), theme.json dimensions and formatting, block.json configurations, and WP REST API JSON structures.
TONE & PERSONA: Professional, helpful, highly technical, concise. Speak like an elite enterprise cloud assistant.
Language: Respond in Slovak (Slovenčina), but keep all technical terms, code, and CLI commands in English.
OUTPUT FORMAT: Always use highly structured Markdown. Use code blocks with correct syntax highlighting for any CLI commands, scripts, config files, or payloads.`;

const ALLOWED_MODELS = new Set([
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-pro",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
]);
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

serve(async (req) => {
  // Correlation ID: prefer client-provided, else generate one. Propagated to
  // edge logs, AI gateway request, AI gateway response (run id), and response headers.
  const correlationId =
    req.headers.get("x-correlation-id")?.trim() ||
    (globalThis.crypto?.randomUUID?.() ?? `cid_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const log = makeLogger(correlationId);
  const baseHeaders = { ...corsHeaders, "x-correlation-id": correlationId };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: baseHeaders });
  }

  const t0 = performance.now();
  log("info", "request.start", { method: req.method, url: req.url });

  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      log("warn", "auth.missing");
      return new Response(JSON.stringify({ error: "Unauthorized", correlationId }), {
        status: 401,
        headers: { ...baseHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      log("warn", "auth.invalid", { error: userErr?.message });
      return new Response(JSON.stringify({ error: "Unauthorized", correlationId }), {
        status: 401,
        headers: { ...baseHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { messages, prompt, systemOverride, model } = body;

    let conversationMessages: Array<{role: string; content: string}>;

    if (messages && Array.isArray(messages)) {
      conversationMessages = messages.map((m: any) => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.content,
      }));
    } else if (prompt && typeof prompt === "string") {
      conversationMessages = [{ role: "user", content: prompt }];
    } else {
      log("warn", "request.invalid", { reason: "missing prompt/messages" });
      return new Response(JSON.stringify({ error: "Missing prompt or messages", correlationId }), {
        status: 400,
        headers: { ...baseHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = typeof systemOverride === "string" && systemOverride.length > 0 && systemOverride.length < 4000
      ? ENTERPRISE_PROMPT + "\n" + systemOverride
      : ENTERPRISE_PROMPT;

    const selectedModel = (typeof model === "string" && ALLOWED_MODELS.has(model)) ? model : DEFAULT_MODEL;

    log("info", "gateway.request", {
      userId,
      model: selectedModel,
      messageCount: conversationMessages.length,
    });

    const tGateway = performance.now();
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
        // Correlation propagated to gateway as run-id + custom header
        "X-Lovable-AIG-Run-ID": correlationId,
        "X-Correlation-ID": correlationId,
      },
      body: JSON.stringify({
        model: selectedModel,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationMessages,
        ],
      }),
    });

    const upstreamRunId =
      response.headers.get("x-lovable-aig-run-id") ||
      response.headers.get("x-request-id") ||
      response.headers.get("cf-ray") ||
      null;

    if (!response.ok) {
      const errorText = await response.text();
      let parsedBody: unknown = errorText;
      try { parsedBody = JSON.parse(errorText); } catch {
        if (typeof errorText === "string" && errorText.length > 2000) {
          parsedBody = errorText.slice(0, 2000) + "…[truncated]";
        }
      }
      log("error", "gateway.error", {
        status: response.status,
        statusText: response.statusText,
        upstreamRunId,
        model: selectedModel,
        latencyMs: Math.round(performance.now() - tGateway),
        body: parsedBody,
      });

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Skúste to neskôr.", correlationId, upstreamRunId }), {
          status: 429,
          headers: { ...baseHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Nedostatok kreditov.", correlationId, upstreamRunId }), {
          status: 402,
          headers: { ...baseHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          error: "AI gateway error",
          correlationId,
          upstream: {
            status: response.status,
            statusText: response.statusText,
            requestId: upstreamRunId,
            model: selectedModel,
            body: parsedBody,
          },
        }),
        {
          status: 502,
          headers: {
            ...baseHeaders,
            "Content-Type": "application/json",
            ...(upstreamRunId ? { "x-lovable-aig-run-id": upstreamRunId } : {}),
          },
        },
      );
    }

    log("info", "gateway.stream.start", {
      upstreamRunId,
      model: selectedModel,
      latencyMs: Math.round(performance.now() - tGateway),
      totalMs: Math.round(performance.now() - t0),
    });

    return new Response(response.body, {
      headers: {
        ...baseHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        ...(upstreamRunId ? { "x-lovable-aig-run-id": upstreamRunId } : {}),
      },
    });
  } catch (e) {
    log("error", "exception", { message: e instanceof Error ? e.message : String(e) });
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", correlationId }),
      { status: 500, headers: { ...baseHeaders, "Content-Type": "application/json" } }
    );
  }
});

