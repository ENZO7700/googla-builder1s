import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-github-event, x-github-delivery",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ACTIONS = new Set(["opened", "synchronize", "reopened"]);
const MAX_DIFF_BYTES = 120_000;

const SYSTEM_PROMPT = `Si senior code reviewer pre projekt NEXIFY TECH CENTER / H4CK3D Builder.
Píš v slovenčine, technické termíny a kód v angličtine.
Buď stručný, konkrétny a praktický. Nikdy nekomentuj formátovanie (rieši ESLint/Prettier).

Špecifické pravidlá pre tento projekt:
- Všetky admin routes musia použiť useAdminAuth() z @/lib/admin.
- Žiadne console.log v produkčnom kóde (console.error / console.warn OK).
- Tokeny a API kľúče len v edge functions (Deno.env), nikdy v klientovi alebo localStorage.
- GitHub API volania musia ísť cez Edge Function, nie priamo z klienta.
- Platby výhradne cez NowPayments (nie Stripe).
- RLS policies sú povinné pre každú tabuľku s user dátami.

Maximálne 10 riadkov na kategóriu. Odkazuj na konkrétny súbor a riadok.`;

function buildUserPrompt(repo: string, prNumber: number, prTitle: string, author: string, diff: string) {
  return `Analyzuj tento GitHub Pull Request a vráť **iba** Markdown komentár v presne tejto štruktúre:

\`\`\`markdown
## 🤖 **AI Code Review** for PR #${prNumber}

---
### **🔴 Kritické chyby (Musí sa opraviť pred merge)**
| **#** | **Súbor** | **Riadok** | **Problém** | **Oprava** |
|-------|-----------|------------|-------------|------------|

---
### **🟡 Varovania (Odporúčané opravy)**
| **#** | **Súbor** | **Riadok** | **Problém** | **Oprava** |
|-------|-----------|------------|-------------|------------|

---
### **🟢 Návrhy (Vylepšenia)**
| **#** | **Súbor** | **Riadok** | **Návrh** | **Príklad** |
|-------|-----------|------------|------------|-------------|

---
**💡 Celkový dojem:**
✅ {konkrétna pochvala}
⚠️ **Pred merge:** Oprav **{počet} kritických chýb**.
\`\`\`

Ak je kategória prázdna, napíš do tabuľky jeden riadok "—".

---
**Repo:** ${repo}
**PR:** #${prNumber} – ${prTitle}
**Autor:** @${author}

**Diff:**
\`\`\`diff
${diff}
\`\`\``;
}

// Constant-time HMAC verification of GitHub webhook signature.
async function verifySignature(secret: string, body: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice(7);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

async function fetchPRDiff(repoFullName: string, prNumber: number, token: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3.diff",
      "User-Agent": "h4ck3d-pr-review",
    },
  });
  if (!res.ok) throw new Error(`GitHub diff fetch failed: ${res.status} ${await res.text()}`);
  return await res.text();
}

async function postPRComment(repoFullName: string, prNumber: number, body: string, token: string): Promise<number | null> {
  const res = await fetch(`https://api.github.com/repos/${repoFullName}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "h4ck3d-pr-review",
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`GitHub comment failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data?.id ?? null;
}

async function runAIReview(repo: string, prNumber: number, prTitle: string, author: string, diff: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(repo, prNumber, prTitle, author, diff) },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway error: ${res.status} ${text}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned empty response");
  return content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.text();
    const webhookSecret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
    const githubToken = Deno.env.get("GITHUB_TOKEN");
    const isDryRun = req.headers.get("x-dry-run") === "true";

    // Dry-run: lets the dashboard test the AI prompt without any GitHub calls.
    if (isDryRun) {
      const { repo, prNumber, prTitle, author, diff } = JSON.parse(rawBody || "{}");
      if (!repo || !prNumber) {
        return new Response(JSON.stringify({ error: "Missing repo/prNumber" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const review = await runAIReview(
        repo,
        Number(prNumber),
        prTitle ?? "Test PR",
        author ?? "tester",
        (diff ?? "diff --git a/test.ts b/test.ts\n+console.log('hello');\n").slice(0, MAX_DIFF_BYTES),
      );
      return new Response(JSON.stringify({ ok: true, dryRun: true, review }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Real webhook path: signature is mandatory.
    if (!webhookSecret) {
      console.error("GITHUB_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sigOk = await verifySignature(webhookSecret, rawBody, req.headers.get("x-hub-signature-256"));
    if (!sigOk) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.headers.get("x-github-event") !== "pull_request") {
      return new Response(JSON.stringify({ ok: true, ignored: "non-PR event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    if (!ALLOWED_ACTIONS.has(payload.action)) {
      return new Response(JSON.stringify({ ok: true, ignored: payload.action }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!githubToken) {
      console.error("GITHUB_TOKEN not configured");
      return new Response(JSON.stringify({ error: "GitHub token not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const repoFullName = payload.repository?.full_name;
    const prNumber = payload.pull_request?.number;
    const prTitle = payload.pull_request?.title ?? "(no title)";
    const author = payload.pull_request?.user?.login ?? "unknown";
    if (!repoFullName || !prNumber) {
      return new Response(JSON.stringify({ error: "Malformed payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let diff = await fetchPRDiff(repoFullName, prNumber, githubToken);
    let truncated = false;
    if (diff.length > MAX_DIFF_BYTES) {
      diff = diff.slice(0, MAX_DIFF_BYTES);
      truncated = true;
    }

    const review = await runAIReview(repoFullName, prNumber, prTitle, author, diff);
    const finalBody = truncated
      ? `${review}\n\n> _Diff bol orezaný na ${MAX_DIFF_BYTES.toLocaleString()} znakov pre AI kontext._`
      : review;

    const commentId = await postPRComment(repoFullName, prNumber, finalBody, githubToken);

    return new Response(JSON.stringify({ ok: true, commentId, truncated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("github-pr-review error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
