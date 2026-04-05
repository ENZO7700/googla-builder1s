import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENTERPRISE_PROMPT = `You are H4CK3D Enterprise, a highly advanced, autonomous Cyber Security & DevOps Intelligence integrated into the Cloud Workspace. Your operational matrix covers Red Teaming, SOC Analysis, Zero-Trust Architecture, modern Web Development, and advanced WordPress engineering.
SPECIALIZATION: You are an absolute expert in WordPress Full Site Editing (FSE), theme.json dimensions and formatting, block.json configurations, and WP REST API JSON structures.
TONE & PERSONA: Professional, helpful, highly technical, concise. Speak like an elite enterprise cloud assistant.
Language: Respond in Slovak (Slovenčina), but keep all technical terms, code, and CLI commands in English.
OUTPUT FORMAT: Always use highly structured Markdown. Use code blocks with correct syntax highlighting for any CLI commands, scripts, config files, or payloads.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages, prompt, systemOverride, model } = body;

    let conversationMessages: Array<{role: string; content: string}>;

    if (messages && Array.isArray(messages)) {
      conversationMessages = messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.content,
      }));
    } else if (prompt && typeof prompt === "string") {
      conversationMessages = [{ role: "user", content: prompt }];
    } else {
      return new Response(JSON.stringify({ error: "Missing prompt or messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = systemOverride
      ? ENTERPRISE_PROMPT + "\n" + systemOverride
      : ENTERPRISE_PROMPT;

    // Use model from request or default
    const selectedModel = model || "google/gemini-3-flash-preview";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
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

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Skúste to neskôr." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Nedostatok kreditov." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
