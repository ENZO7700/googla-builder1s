import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";
import { encryptSecret, decryptSecret } from "../_shared/wordpress-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MAX_DIFF_BYTES = 120_000;

// Type definitions for GitHub API responses to prevent ESLint warning: "Unexpected any"
interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  private: boolean;
  default_branch: string;
  description: string | null;
  pushed_at: string | null;
  updated_at: string | null;
  open_issues_count: number;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
}

interface GitHubWorkflowRun {
  id: number;
  name: string | null;
  status: string;
  conclusion: string | null;
  head_branch: string;
  head_sha: string;
  head_commit: {
    message: string;
  } | null;
  triggering_actor: {
    login: string;
  } | null;
  run_started_at: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  user: {
    login: string;
    avatar_url: string;
  } | null;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
  additions?: number;
  deletions?: number;
  created_at: string;
  html_url: string;
}

interface GitHubCheckRun {
  status: string;
  conclusion: string | null;
}

interface GitHubReview {
  state: string;
}

const SYSTEM_PROMPT = `Si senior code reviewer pre projekt LarsenEvans-wpBOX.
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Helper to make GitHub REST API calls
async function fetchGithub<T = unknown>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<{ data: T | null; headers: Headers; ok: boolean; status: number }> {
  const url = path.startsWith("http") ? path : `https://api.github.com/${path.replace(/^\/+/, "")}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "User-Agent": "LarsenEvans-wpBOX-Connection",
      ...options.headers,
    },
  });
  let data: T | null = null;
  if (response.status !== 204) {
    data = await response.json().catch(() => null) as T;
  }
  return {
    data,
    headers: response.headers,
    ok: response.ok,
    status: response.status,
  };
}

async function getUserConnection(userId: string) {
  const { data, error } = await supabase
    .from("github_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Nepodarilo sa načítať GitHub pripojenie z DB");
  return data;
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Invalid token" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (!action) {
      return jsonResponse({ error: "Chýba parameter 'action'" }, 400);
    }

    // --- Action: connect ---
    if (action === "connect") {
      const gitToken = body?.token?.trim();
      if (!gitToken) {
        return jsonResponse({ error: "Token je povinný" }, 400);
      }

      // Validácia tokenu cez GitHub API
      const userRes = await fetchGithub<GitHubUser>("user", gitToken);
      if (!userRes.ok || !userRes.data) {
        return jsonResponse({ error: "GitHub odmietol Personal Access Token." }, 400);
      }

      const gitUser = userRes.data;
      const scopesHeader = userRes.headers.get("x-oauth-scopes") || "";
      const scopes = scopesHeader.split(",").map((s) => s.trim()).filter(Boolean);

      // Uloženie šifrovaného tokenu
      const tokenEncrypted = await encryptSecret(gitToken);
      const connPayload = {
        user_id: user.id,
        token_encrypted: tokenEncrypted,
        username: gitUser.login,
        name: gitUser.name || gitUser.login,
        avatar_url: gitUser.avatar_url,
        scopes,
        connected_at: new Date().toISOString(),
      };

      const { data: connection, error: dbErr } = await supabase
        .from("github_connections")
        .upsert(connPayload, { onConflict: "user_id" })
        .select("status:connected_at,username,name,avatar_url,scopes,connected_at")
        .single();

      if (dbErr || !connection) {
        return jsonResponse({ error: dbErr?.message ?? "Nepodarilo sa uložiť pripojenie." }, 500);
      }

      // Zápis do audit logu
      await supabase.from("github_audit_log").insert({
        user_id: user.id,
        event_type: "connection_change",
        message: `Pripojený GitHub účet @${gitUser.login}`,
        actor: user.email || "system",
        status: "success",
      });

      return jsonResponse({
        status: "connected",
        account: {
          login: connection.username,
          name: connection.name,
          avatarUrl: connection.avatar_url,
          type: "User",
        },
        scopes: connection.scopes,
        connectedAt: connection.connected_at,
      });
    }

    // --- Action: get_connection ---
    if (action === "get_connection") {
      const conn = await getUserConnection(user.id);
      if (!conn) {
        return jsonResponse({ status: "disconnected" });
      }

      return jsonResponse({
        status: "connected",
        account: {
          login: conn.username,
          name: conn.name,
          avatarUrl: conn.avatar_url,
          type: "User",
        },
        scopes: conn.scopes,
        connectedAt: conn.connected_at,
        lastSyncAt: conn.last_sync_at,
        webhookHealthy: true,
      });
    }

    // --- Action: disconnect ---
    if (action === "disconnect") {
      const conn = await getUserConnection(user.id);
      if (conn) {
        await supabase.from("github_connections").delete().eq("user_id", user.id);
        await supabase.from("github_audit_log").insert({
          user_id: user.id,
          event_type: "connection_change",
          message: `Odpojený GitHub účet @${conn.username}`,
          actor: user.email || "system",
          status: "info",
        });
      }
      return jsonResponse({ ok: true });
    }

    // Načítanie tokenu pre proxy operácie
    const connection = await getUserConnection(user.id);
    if (!connection) {
      return jsonResponse({ error: "GitHub nie je pripojený" }, 400);
    }
    const decryptedToken = await decryptSecret(connection.token_encrypted);

    // --- Action: list_repositories ---
    if (action === "list_repositories") {
      const reposRes = await fetchGithub<GitHubRepo[]>("user/repos?per_page=100&sort=pushed", decryptedToken);
      if (!reposRes.ok || !reposRes.data) {
        return jsonResponse({ error: "Zlyhalo načítanie repozitárov z GitHubu" }, 400);
      }

      const rawRepos = reposRes.data;
      const topRepos = rawRepos.slice(0, 10); // Optimalizácia pre detailný sync

      // Paralelné dotazy na posledný commit pre najaktívnejších 5 repozitárov
      const mappedRepos = await Promise.all(
        rawRepos.map(async (r: GitHubRepo) => {
          const isTop = topRepos.some((tr) => tr.id === r.id);
          let lastCommit: { sha: string; message: string; author: string; date: string } | null = null;

          if (isTop) {
            const commitsRes = await fetchGithub<GitHubCommit[]>(`repos/${r.full_name}/commits?per_page=1`, decryptedToken);
            if (commitsRes.ok && Array.isArray(commitsRes.data) && commitsRes.data.length > 0) {
              const c = commitsRes.data[0];
              lastCommit = {
                sha: c.sha.slice(0, 7),
                message: c.commit.message.split("\n")[0],
                author: c.commit.author.name,
                date: c.commit.author.date,
              };
            }
          }

          return {
            id: String(r.id),
            name: r.name,
            fullName: r.full_name,
            url: r.html_url,
            visibility: r.private ? "private" : "public",
            defaultBranch: r.default_branch,
            description: r.description,
            lastCommit,
            lastActivityAt: r.pushed_at || r.updated_at,
            openIssues: r.open_issues_count,
            openPRs: r.open_issues_count, // Fallback/hrubý odhad z GitHubu (issues zahŕňajú aj PR)
          };
        })
      );

      // Aktualizácia času poslednej synchronizácie
      await supabase
        .from("github_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("user_id", user.id);

      await supabase.from("github_audit_log").insert({
        user_id: user.id,
        event_type: "repo_sync",
        message: `Synchronizácia ${mappedRepos.length} repozitárov`,
        actor: "system",
        status: "success",
      });

      return jsonResponse(mappedRepos);
    }

    // --- Action: sync_repository ---
    if (action === "sync_repository") {
      const repoId = body?.repoId;
      if (!repoId) return jsonResponse({ error: "Chýba repoId" }, 400);

      await supabase
        .from("github_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("user_id", user.id);

      await supabase.from("github_audit_log").insert({
        user_id: user.id,
        event_type: "repo_sync",
        message: `Synchronizácia konkrétneho repozitára (ID: ${repoId})`,
        actor: user.email || "system",
        status: "success",
      });

      return jsonResponse({ ok: true });
    }

    // --- Action: list_workflow_runs ---
    if (action === "list_workflow_runs") {
      const reposRes = await fetchGithub<GitHubRepo[]>("user/repos?per_page=5&sort=pushed", decryptedToken);
      if (!reposRes.ok || !reposRes.data) return jsonResponse([]);

      const reposList = reposRes.data;
      const runsPromises = reposList.map(async (r: GitHubRepo) => {
        interface WorkflowRunsResponse {
          workflow_runs: GitHubWorkflowRun[];
        }
        const res = await fetchGithub<WorkflowRunsResponse>(`repos/${r.full_name}/actions/runs?per_page=3`, decryptedToken);
        if (!res.ok || !res.data?.workflow_runs) return [];
        return res.data.workflow_runs.map((w: GitHubWorkflowRun) => {
          const duration = w.updated_at && w.run_started_at
            ? Math.round((new Date(w.updated_at).getTime() - new Date(w.run_started_at).getTime()) / 1000)
            : 0;

          let status = "queued";
          if (w.status === "completed") {
            status = w.conclusion === "success" ? "success" : w.conclusion === "cancelled" ? "cancelled" : "failed";
          } else if (w.status === "in_progress") {
            status = "running";
          }

          return {
            id: String(w.id),
            repoFullName: r.full_name,
            workflowName: w.name || "Build",
            status,
            branch: w.head_branch,
            commitSha: w.head_sha.slice(0, 7),
            commitMessage: w.head_commit?.message?.split("\n")[0] || "",
            triggeredBy: w.triggering_actor?.login || "system",
            startedAt: w.run_started_at || w.created_at,
            durationSec: duration,
            url: w.html_url,
          };
        });
      });

      const results = await Promise.all(runsPromises);
      const allRuns = results.flat().sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
      return jsonResponse(allRuns.slice(0, 15));
    }

    // --- Action: list_prs ---
    if (action === "list_prs") {
      const reposRes = await fetchGithub<GitHubRepo[]>("user/repos?per_page=5&sort=pushed", decryptedToken);
      if (!reposRes.ok || !reposRes.data) return jsonResponse([]);

      const reposList = reposRes.data;
      const prsPromises = reposList.map(async (r: GitHubRepo) => {
        const pullsRes = await fetchGithub<GitHubPullRequest[]>(`repos/${r.full_name}/pulls?state=open`, decryptedToken);
        if (!pullsRes.ok || !Array.isArray(pullsRes.data)) return [];

        const pulls = pullsRes.data;
        return Promise.all(
          pulls.map(async (p: GitHubPullRequest) => {
            // Check status / check-runs
            let checks = "none";
            interface CheckRunsResponse {
              check_runs: GitHubCheckRun[];
            }
            const checksRes = await fetchGithub<CheckRunsResponse>(`repos/${r.full_name}/commits/${p.head.sha}/check-runs`, decryptedToken);
            if (checksRes.ok && Array.isArray(checksRes.data?.check_runs)) {
              const runs = checksRes.data.check_runs;
              if (runs.length > 0) {
                const hasFailed = runs.some((cr: GitHubCheckRun) => cr.conclusion === "failure");
                const hasPending = runs.some((cr: GitHubCheckRun) => cr.status === "in_progress" || cr.status === "queued");
                checks = hasFailed ? "failing" : hasPending ? "pending" : "passing";
              }
            }

            // Reviews status
            let review = "review_required";
            const reviewsRes = await fetchGithub<GitHubReview[]>(`repos/${r.full_name}/pulls/${p.number}/reviews`, decryptedToken);
            if (reviewsRes.ok && Array.isArray(reviewsRes.data)) {
              const reviews = reviewsRes.data;
              if (reviews.some((rv: GitHubReview) => rv.state === "APPROVED")) {
                review = "approved";
              } else if (reviews.some((rv: GitHubReview) => rv.state === "CHANGES_REQUESTED")) {
                review = "changes_requested";
              } else if (reviews.length > 0) {
                review = "commented";
              }
            }

            return {
              id: String(p.id),
              number: p.number,
              repoFullName: r.full_name,
              title: p.title,
              author: {
                login: p.user?.login || "unknown",
                avatarUrl: p.user?.avatar_url || "",
              },
              branch: p.head.ref,
              baseBranch: p.base.ref,
              checks,
              review,
              additions: p.additions || 0,
              deletions: p.deletions || 0,
              createdAt: p.created_at,
              url: p.html_url,
            };
          })
        );
      });

      const results = await Promise.all(prsPromises);
      const allPRs = results.flat().sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return jsonResponse(allPRs);
    }

    // --- Action: review_pr ---
    if (action === "review_pr") {
      const prId = body?.prId;
      if (!prId) return jsonResponse({ error: "Chýba prId" }, 400);

      // Získame repos a pulls pre nájdenie PR detailu
      const reposRes = await fetchGithub<GitHubRepo[]>("user/repos?per_page=20&sort=pushed", decryptedToken);
      if (!reposRes.ok || !reposRes.data) return jsonResponse({ error: "Zlyhalo načítanie repozitárov pre PR review" }, 400);

      const reposList = reposRes.data;
      let foundPr: GitHubPullRequest | null = null;
      let foundRepoName = "";

      for (const r of reposList) {
        const pullsRes = await fetchGithub<GitHubPullRequest[]>(`repos/${r.full_name}/pulls?state=open`, decryptedToken);
        if (pullsRes.ok && Array.isArray(pullsRes.data)) {
          const match = pullsRes.data.find((p: GitHubPullRequest) => String(p.id) === String(prId));
          if (match) {
            foundPr = match;
            foundRepoName = r.full_name;
            break;
          }
        }
      }

      if (!foundPr) {
        return jsonResponse({ error: "PR sa nenašiel v aktívnych repozitároch" }, 404);
      }

      // Fetch diff
      const diffUrl = `https://api.github.com/repos/${foundRepoName}/pulls/${foundPr.number}`;
      const diffRes = await fetch(diffUrl, {
        headers: {
          Authorization: `Bearer ${decryptedToken}`,
          Accept: "application/vnd.github.v3.diff",
          "User-Agent": "LarsenEvans-wpBOX-Connection",
        },
      });

      if (!diffRes.ok) {
        return jsonResponse({ error: "Zlyhalo stiahnutie diff súboru pre PR" }, 400);
      }

      let diff = await diffRes.text();
      if (diff.length > MAX_DIFF_BYTES) {
        diff = diff.slice(0, MAX_DIFF_BYTES) + "\n\n[Diff bol orezaný kvôli veľkosti]";
      }

      // Generovanie AI review
      const reviewText = await runAIReview(
        foundRepoName,
        foundPr.number,
        foundPr.title,
        foundPr.user?.login || "unknown",
        diff
      );

      // Odoslanie komentára na GitHub
      const commentRes = await fetch(`https://api.github.com/repos/${foundRepoName}/issues/${foundPr.number}/comments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${decryptedToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "LarsenEvans-wpBOX-Connection",
        },
        body: JSON.stringify({ body: reviewText }),
      });

      if (!commentRes.ok) {
        return jsonResponse({ error: `Komentár na GitHub zlyhal: ${commentRes.status}` }, 400);
      }

      await supabase.from("github_audit_log").insert({
        user_id: user.id,
        event_type: "pr_review",
        message: `AI review odoslaná pre PR #${foundPr.number} v repozitári ${foundRepoName}`,
        actor: "h4ck3d-bot",
        target: `${foundRepoName}#${foundPr.number}`,
        status: "success",
      });

      return jsonResponse({ summary: `AI Review pre PR #${foundPr.number} bolo úspešne odoslané.` });
    }

    // --- Action: list_audit_log ---
    if (action === "list_audit_log") {
      const { data: logs, error: logsErr } = await supabase
        .from("github_audit_log")
        .select("id,event_type,message,actor,target,status,timestamp:created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (logsErr) {
        return jsonResponse({ error: logsErr.message }, 500);
      }

      return jsonResponse(logs || []);
    }

    return jsonResponse({ error: "Neznáma akcia" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznáma chyba";
    return jsonResponse({ error: message }, 500);
  }
});
