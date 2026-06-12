/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENTERPRISE_PROMPT = `You are LarsenEvans-wpBOX, a highly advanced, autonomous WordPress, Cyber Security & DevOps Intelligence integrated into the Cloud Workspace. Your operational matrix covers Red Teaming, SOC Analysis, Zero-Trust Architecture, modern Web Development, and advanced WordPress engineering.
SPECIALIZATION: You are an absolute expert in WordPress Full Site Editing (FSE), theme.json dimensions and formatting, block.json configurations, and WP REST API JSON structures.
TONE & PERSONA: Professional, helpful, highly technical, concise. Speak like an elite enterprise cloud assistant.
Language: Respond in Slovak (Slovenčina), but keep all technical terms, code, and CLI commands in English.
OUTPUT FORMAT: Always use highly structured Markdown. Use code blocks with correct syntax highlighting for any CLI commands, scripts, config files, or payloads.`;

const ALLOWED_MODELS = new Set([
  "mistral-large-latest",
  "mistral-medium",
  "mistral-small",
  "mistral-tiny",
  "mixtral-8x7b-latest",
  "codestral-latest",
  "pixtral-12b-latest",
]);
const DEFAULT_MODEL = "mistral-large-latest";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("Failed to parse request JSON:", parseErr);
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: "Payload must be a JSON object" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, prompt, systemOverride, model } = body;

    let conversationMessages: Array<{role: string; content: string}> = [];

    if (messages && Array.isArray(messages)) {
      conversationMessages = messages
        .filter((m: any) => m && typeof m === 'object' && typeof m.role === 'string' && typeof m.content === 'string')
        .map((m: any) => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.content.substring(0, 32000), // Max length protection
        }));
      
      if (conversationMessages.length === 0) {
        return new Response(JSON.stringify({ error: "Messages array contains invalid format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (prompt && typeof prompt === "string" && prompt.trim().length > 0) {
      conversationMessages = [{ role: "user", content: prompt.substring(0, 32000) }];
    } else {
      return new Response(JSON.stringify({ error: "Missing or invalid prompt or messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) {
      throw new Error("MISTRAL_API_KEY is not configured");
    }

    const systemPrompt = typeof systemOverride === "string" && systemOverride.length > 0 && systemOverride.length < 4000
      ? ENTERPRISE_PROMPT + "\n" + systemOverride
      : ENTERPRISE_PROMPT;

    // Whitelist model selection
    const selectedModel = (typeof model === "string" && ALLOWED_MODELS.has(model)) ? model : DEFAULT_MODEL;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
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
