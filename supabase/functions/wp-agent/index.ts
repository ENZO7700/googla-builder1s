// WordPress agent: Mistral-powered chat with WP tool-calling.
// Registers 5 tools; only wp_apply requires manual approval (needsApproval).
// All mutations go through wp_plan -> wp_apply (dry-run + rollback backbone).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@0.2.14";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "npm:ai@5.0.26";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id",
  "Access-Control-Expose-Headers": "x-correlation-id",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

const SYSTEM_PROMPT = `You are H4CK3D WP-Agent — an autonomous WordPress engineer operating over REST + WP-CLI (SSH).

RULES:
- All reads: use wp_rest_read (GET only) or wp_cli_read (whitelisted read commands).
- All mutations MUST go through wp_plan first (produces dry-run diff + proceed token), then wp_apply (requires human approval).
- NEVER attempt to bypass the plan/apply flow. Do not call wp_apply without a fresh proceedToken from wp_plan.
- Explain your plan in Slovak before calling tools; keep code, paths, and CLI commands in English.
- If a tool returns an error, surface the exact status and body to the user and propose a safer next step.
- Always confirm siteId with the user if ambiguous; never invent siteIds.`;

const CLI_READ_WHITELIST = new Set([
  "core-version",
  "core-check-update",
  "cron-status",
  "cron-event-list",
  "plugin-list",
  "plugin-status",
  "theme-list",
  "db-size",
  "option-get",
  "user-list",
  "site-info",
]);

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

async function callInternal(fn: string, authHeader: string, body: unknown) {
  const url = `${SUPABASE_URL}/functions/v1/${fn}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  return { status: res.status, ok: res.ok, data };
}

Deno.serve(async (req) => {
  const correlationId =
    req.headers.get("x-correlation-id")?.trim() ||
    (globalThis.crypto?.randomUUID?.() ?? `cid_${Date.now()}`);
  const baseHeaders = { ...corsHeaders, "x-correlation-id": correlationId };

  if (req.method === "OPTIONS") return new Response(null, { headers: baseHeaders });

  try {
    if (!MISTRAL_API_KEY) return json({ error: "MISTRAL_API_KEY not configured", correlationId }, 500, baseHeaders);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized", correlationId }, 401, baseHeaders);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.slice(7),
    );
    if (userErr || !userData?.user) {
      return json({ error: "Invalid token", correlationId }, 401, baseHeaders);
    }

    const { messages, siteId }: { messages: UIMessage[]; siteId?: string } =
      await req.json();

    const mistral = createOpenAICompatible({
      name: "mistral",
      baseURL: "https://api.mistral.ai/v1",
      headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` },
    });

    const tools = {
      wp_ssh_test: tool({
        description: "Test SSH connectivity to a WordPress site (read-only, safe).",
        inputSchema: z.object({
          siteId: z.string().uuid().describe("Target WP site id"),
        }),
        execute: async ({ siteId }) => {
          const r = await callInternal("wp-ssh-test", authHeader, { siteId });
          return { status: r.status, result: r.data };
        },
      }),

      wp_rest_read: tool({
        description:
          "Read data from WordPress REST API. GET only. Use for posts, pages, users, settings, etc.",
        inputSchema: z.object({
          siteId: z.string().uuid(),
          path: z.string().describe("REST path without /wp-json/wp/v2, e.g. 'posts/42'"),
          query: z.record(z.string(), z.string()).optional(),
        }),
        execute: async ({ siteId, path, query }) => {
          const r = await callInternal("wordpress-proxy", authHeader, {
            siteId, method: "GET", path, query,
          });
          return { status: r.status, data: r.data };
        },
      }),

      wp_cli_read: tool({
        description:
          "Run a read-only WP-CLI command over SSH. Whitelisted commands only: " +
          [...CLI_READ_WHITELIST].join(", "),
        inputSchema: z.object({
          siteId: z.string().uuid(),
          command: z.string().describe("Whitelisted read command name"),
        }),
        execute: async ({ siteId, command }) => {
          if (!CLI_READ_WHITELIST.has(command)) {
            return { error: `Command '${command}' not in read whitelist. Use wp_plan for mutations.` };
          }
          const r = await callInternal("wordpress-cli", authHeader, { siteId, command });
          return { status: r.status, result: r.data };
        },
      }),

      wp_plan: tool({
        description:
          "Plan a WordPress mutation (dry-run). Produces a diff, before-snapshot, and a proceedToken (TTL 60s) that must be passed to wp_apply. Use for ANY write/mutation, both REST and CLI.",
        inputSchema: z.object({
          siteId: z.string().uuid(),
          call: z.union([
            z.object({
              scope: z.literal("rest"),
              method: z.enum(["POST", "PATCH", "PUT", "DELETE"]),
              path: z.string(),
              body: z.unknown().optional(),
            }),
            z.object({
              scope: z.literal("cli"),
              command: z.string(),
            }),
          ]),
        }),
        execute: async ({ siteId, call }) => {
          const r = await callInternal("wp-plan-dryrun", authHeader, { siteId, call });
          return { status: r.status, plan: r.data };
        },
      }),

      wp_apply: tool({
        description:
          "Apply a previously planned WP mutation using its proceedToken. REQUIRES HUMAN APPROVAL. Auto-rollback runs on failure when revertible.",
        inputSchema: z.object({
          proceedToken: z.string().describe("Fresh token from wp_plan (TTL 60s)"),
        }),
        // no execute → AI SDK treats as needs-approval; UI must supply the tool result
        // via addToolResult() after the user approves.
      }),
    };

    const result = streamText({
      model: mistral("mistral-large-latest"),
      system: siteId ? `${SYSTEM_PROMPT}\n\nActive siteId: ${siteId}` : SYSTEM_PROMPT,
      messages: convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(50),
    });

    return result.toUIMessageStreamResponse({ headers: baseHeaders });
  } catch (e) {
    console.error(JSON.stringify({
      level: "error", fn: "wp-agent", correlationId,
      message: e instanceof Error ? e.message : String(e),
    }));
    return json(
      { error: e instanceof Error ? e.message : "Unknown error", correlationId },
      500,
      baseHeaders,
    );
  }
});
