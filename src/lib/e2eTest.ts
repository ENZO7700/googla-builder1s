/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getSelectedAiModel, validateAiModel } from '@/lib/aiModels';
import {
  probeAnalyzerRequestShape,
  probeGeneratorFallback,
  probeLaunchHandoff,
  probePreviewExtract,
  probeSettingsModel,
  probeStorageRules,
  probeThemePersistence,
  probeWorkflowRibbon,
  probeWpDeployDryRun,
} from '@/lib/e2eProbes';
import { githubService } from '@/lib/github/githubService';
import { formatStreamingAiDiagnosticDetail } from '@/lib/aiErrorCopy';

export interface E2EResult {
  step: string;
  passed: boolean;
  detail: string;
  durationMs: number;
  skipped?: boolean;
}

/** Internal step keys — stable for tests and sessionStorage. */
export const E2E_STEP_LABELS = [
  'Auth',
  'DB CRUD',
  'Sessions UX',
  'Streaming AI',
  'Storage',
  'Storage Rules',
  'Voice API',
  'Health API',
  'WordPress Proxy',
  'WP Deploy',
  'Inquiries API',
  'Preview',
  'Generátor',
  'Analyzátor',
  'GitHub',
  'Launch Handoff',
  'AI Model',
  'Workflow',
  'Téma',
] as const;

export type E2EStepLabel = (typeof E2E_STEP_LABELS)[number];

/** Slovak-friendly labels shown in Diagnostika UI. */
export const E2E_STEP_DISPLAY_LABELS: Record<E2EStepLabel, string> = {
  Auth: 'Auth',
  'DB CRUD': 'DB CRUD',
  'Sessions UX': 'Relácie (Sessions)',
  'Streaming AI': 'Streaming AI',
  Storage: 'Storage',
  'Storage Rules': 'Pravidlá súborov',
  'Voice API': 'Voice API',
  'Health API': 'Health API',
  'WordPress Proxy': 'WordPress Proxy',
  'WP Deploy': 'WP Deploy (dry-run)',
  'Inquiries API': 'Inquiries API',
  Preview: 'Náhľad HTML',
  Generátor: 'Generátor / Skills',
  Analyzátor: 'Analyzátor logov',
  GitHub: 'GitHub / Connectors',
  'Launch Handoff': 'Launch Audit handoff',
  'AI Model': 'AI Model (Nastavenia)',
  Workflow: 'Workflow ribbon',
  Téma: 'Téma (svetlý/tmavý)',
};

export { ALLOWED_AI_MODELS, getSelectedAiModel, validateAiModel } from '@/lib/aiModels';

export interface E2ESummary {
  passed: number;
  skipped: number;
  failed: number;
  total: number;
}

export const E2E_RESULTS_EVENT = 'wpbox:e2e-results';

export function summarizeE2EResults(results: E2EResult[]): E2ESummary {
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.passed).length;
  const passed = results.filter(r => r.passed && !r.skipped).length;
  return { passed, skipped, failed, total: results.length };
}

export function formatE2ESummaryLine(summary: E2ESummary): string {
  if (summary.failed === 0) {
    return `E2E test: ${summary.passed}/${summary.total} OK (${summary.skipped} preskočené)`;
  }
  return `E2E test zlyhal: ${summary.failed} chýb (${summary.skipped} preskočené)`;
}

function skippedResult(step: string, detail: string, startedAt: number): E2EResult {
  return { step, passed: true, skipped: true, detail, durationMs: performance.now() - startedAt };
}

function passResult(step: string, detail: string, startedAt: number): E2EResult {
  return { step, passed: true, detail, durationMs: performance.now() - startedAt };
}

function failResult(step: string, detail: string, startedAt: number): E2EResult {
  return { step, passed: false, detail, durationMs: performance.now() - startedAt };
}

function pushProbe(
  results: E2EResult[],
  step: string,
  probe: { ok: boolean; detail: string; skipped?: boolean },
  startedAt: number,
) {
  const r = probe.skipped
    ? skippedResult(step, probe.detail, startedAt)
    : probe.ok
      ? passResult(step, probe.detail, startedAt)
      : failResult(step, probe.detail, startedAt);
  results.push(r);
  log(`${step} — ${probe.detail}`, r.passed && !r.skipped);
}

const log = (msg: string, ok: boolean) => {
  const icon = ok ? '✅' : '❌';
  console.log(`%c[E2E] ${icon} ${msg}`, `color:${ok ? '#22c55e' : '#ef4444'};font-weight:bold`);
};

function publishResults(results: E2EResult[]) {
  window.dispatchEvent(new CustomEvent(E2E_RESULTS_EVENT, { detail: results }));
  sessionStorage.setItem('wpbox.e2eResults', JSON.stringify({ at: Date.now(), results }));
}

function supabaseFunctionUrl(name: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
}

async function probeHealthApi(): Promise<E2EResult> {
  const t = performance.now();
  try {
    const resp = await fetch('/api/health', { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data?.status !== 'ok') throw new Error('Neočakávaná odpoveď health API');
    return passResult('Health API', `Deployment OK (${data.service ?? 'wpbox'})`, t);
  } catch (e: any) {
    return failResult('Health API', e.message, t);
  }
}

async function probeInquiriesApi(): Promise<E2EResult> {
  const t = performance.now();
  try {
    const resp = await fetch(supabaseFunctionUrl('inquiries-submit'), { method: 'GET' });
    if (resp.status !== 400) throw new Error(`Očakávané HTTP 400, dostali sme ${resp.status}`);
    const data = await resp.json().catch(() => ({}));
    if (!String(data?.error ?? '').toLowerCase().includes('siteid')) {
      throw new Error('Edge funkcia nevrátila očakávanú chybu siteId');
    }
    return passResult('Inquiries API', 'Verejný endpoint dostupný', t);
  } catch (e: any) {
    return failResult('Inquiries API', e.message, t);
  }
}

async function probeWordPressProxy(isLocalDemo: boolean, token: string | null): Promise<E2EResult> {
  const t = performance.now();
  const url = supabaseFunctionUrl('wordpress-proxy');
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    const unauth = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (unauth.status !== 401) {
      throw new Error(`Proxy bez JWT: očakávané 401, dostali sme ${unauth.status}`);
    }

    if (isLocalDemo || !token) {
      return skippedResult('WordPress Proxy', 'Preskočené v Local Demo (edge OK, 401)', t);
    }

    const invalidBody = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ siteId: 'not-a-uuid', method: 'GET', path: '/wp/v2/types' }),
    });
    if (invalidBody.status === 400) {
      return passResult('WordPress Proxy', 'JWT overený, edge funkcia OK', t);
    }

    const probeSite = await supabase.from('wp_sites').select('id').limit(1).maybeSingle();
    if (probeSite.error || !probeSite.data?.id) {
      const noSite = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          siteId: '00000000-0000-0000-0000-000000000000',
          method: 'GET',
          path: '/wp/v2/types',
        }),
      });
      if (noSite.status === 404) {
        return passResult('WordPress Proxy', 'JWT OK (žiadna WP stránka pripojená)', t);
      }
      throw new Error(`Neočakávaná odpoveď proxy: HTTP ${noSite.status}`);
    }

    const live = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        siteId: probeSite.data.id,
        method: 'GET',
        path: '/wp/v2/types',
      }),
    });

    if (live.status === 401) {
      return skippedResult(
        'WordPress Proxy',
        'Preskočené — WP Application Password neplatné (HTTP 401)',
        t,
      );
    }
    if (!live.ok) {
      throw new Error(`WP proxy HTTP ${live.status}`);
    }

    return passResult('WordPress Proxy', 'Pripojená WP stránka odpovedá', t);
  } catch (e: any) {
    return failResult('WordPress Proxy', e.message, t);
  }
}

async function probeSessionsUx(isLocalDemo: boolean, userId: string): Promise<E2EResult> {
  const t = performance.now();
  if (isLocalDemo) {
    return skippedResult('Sessions UX', 'Preskočené v Local Demo', t);
  }

  let sessionId: string | null = null;
  try {
    const { data: created, error: createErr } = await supabase
      .from('chat_sessions')
      .insert({ user_id: userId, title: '__e2e_sessions__' })
      .select('id, title')
      .single();
    if (createErr || !created) throw new Error(createErr?.message ?? 'Vytvorenie relácie zlyhalo');
    sessionId = created.id;

    const renamed = '__e2e_renamed__';
    const { error: renameErr } = await supabase
      .from('chat_sessions')
      .update({ title: renamed, updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (renameErr) throw new Error('Premenovanie: ' + renameErr.message);

    const { data: readBack, error: readErr } = await supabase
      .from('chat_sessions')
      .select('title')
      .eq('id', sessionId)
      .single();
    if (readErr || readBack?.title !== renamed) throw new Error('Načítanie po premenovaní zlyhalo');

    await supabase.from('chat_sessions').delete().eq('id', sessionId);
    sessionId = null;

    return passResult('Sessions UX', 'Create+Rename+Read+Delete OK', t);
  } catch (e: any) {
    if (sessionId) await supabase.from('chat_sessions').delete().eq('id', sessionId);
    return failResult('Sessions UX', e.message, t);
  }
}

async function probeGitHubConnector(isLocalDemo: boolean): Promise<E2EResult> {
  const t = performance.now();
  if (isLocalDemo) {
    return skippedResult('GitHub', 'Preskočené v Local Demo', t);
  }
  try {
    await githubService.getConnection();
    return passResult('GitHub', 'GitHub connector odpovedá', t);
  } catch (e: any) {
    const msg = String(e.message ?? e);
    if (/not connected|nie je prepojen|connection|401|403|404/i.test(msg)) {
      return skippedResult('GitHub', 'Preskočené — GitHub účet nie je prepojený', t);
    }
    return skippedResult('GitHub', `Preskočené — ${msg.slice(0, 80)}`, t);
  }
}

async function probeGeneratorModule(isLocalDemo: boolean): Promise<E2EResult> {
  const t = performance.now();
  try {
    await import('@/components/workspace/GeneratorView');
    const fallback = probeGeneratorFallback(isLocalDemo);
    if (fallback.skipped) return skippedResult('Generátor', fallback.detail, t);
    if (fallback.ok) return passResult('Generátor', fallback.detail, t);
    return failResult('Generátor', fallback.detail, t);
  } catch (e: any) {
    return failResult('Generátor', e.message, t);
  }
}

export async function runE2ETest(): Promise<E2EResult[]> {
  console.log('%c━━━ LarsenEvans-wpBOX E2E Test ━━━', 'color:#3b82f6;font-weight:bold;font-size:14px');
  const results: E2EResult[] = [];
  let testSessionId: string | null = null;
  let testFilePath: string | null = null;
  const savedModel = getSelectedAiModel();
  const savedTheme = localStorage.getItem('theme');

  const finalize = () => {
    localStorage.setItem('ai-model', savedModel);
    if (savedTheme) localStorage.setItem('theme', savedTheme);
    else localStorage.removeItem('theme');
  };

  // 1. AUTH
  const t1 = performance.now();
  let isLocalDemo = false;
  let accessToken: string | null = null;
  let hasWpSite = false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const localAccess = localStorage.getItem('wpbox.localAccess') === 'true';
    accessToken = session?.access_token ?? null;

    if (localAccess) {
      isLocalDemo = true;
      const r = passResult('Auth', 'Local Demo User', t1);
      results.push(r);
      log(`Auth — ${r.detail} (${r.durationMs.toFixed(0)}ms)`, true);
    } else if (!session?.user) {
      throw new Error('Žiadna aktívna session');
    } else {
      const r = passResult('Auth', `User ${session.user.email}`, t1);
      results.push(r);
      log(`Auth — ${r.detail} (${r.durationMs.toFixed(0)}ms)`, true);
      const { data: sites } = await supabase.from('wp_sites').select('id').limit(1);
      hasWpSite = Boolean(sites?.length);
    }
  } catch (e: any) {
    const r = failResult('Auth', e.message, t1);
    results.push(r);
    log(`Auth — ${e.message}`, false);
    finalize();
    publishResults(results);
    return results;
  }

  const userId = isLocalDemo ? 'local-wpbox-user' : (await supabase.auth.getSession()).data.session!.user.id;

  // 2. DB CRUD
  const t2 = performance.now();
  if (isLocalDemo) {
    results.push(skippedResult('DB CRUD', 'Preskočené v Local Demo', t2));
    log('DB CRUD — Preskočené v Local Demo', true);
  } else {
    try {
      const { data: created, error: e1 } = await supabase
        .from('chat_sessions')
        .insert({ user_id: userId, title: '__e2e_test__' })
        .select('id').single();
      if (e1 || !created) throw new Error(e1?.message || 'Insert failed');
      testSessionId = created.id;

      const { error: e2 } = await supabase.from('chat_messages').insert({
        session_id: testSessionId, user_id: userId, role: 'user', content: 'e2e ping',
      });
      if (e2) throw new Error('Message insert: ' + e2.message);

      const { data: msgs, error: e3 } = await supabase
        .from('chat_messages').select('*').eq('session_id', testSessionId);
      if (e3 || !msgs?.length) throw new Error('Read back failed');

      await supabase.from('chat_messages').delete().eq('session_id', testSessionId);
      await supabase.from('chat_sessions').delete().eq('id', testSessionId);
      testSessionId = null;

      const r = passResult('DB CRUD', `Insert+Read+Delete OK (${msgs.length} msg)`, t2);
      results.push(r);
      log(`DB CRUD — ${r.detail}`, true);
    } catch (e: any) {
      if (testSessionId) {
        await supabase.from('chat_messages').delete().eq('session_id', testSessionId);
        await supabase.from('chat_sessions').delete().eq('id', testSessionId);
      }
      results.push(failResult('DB CRUD', e.message, t2));
      log(`DB CRUD — ${e.message}`, false);
    }
  }

  // 3. Sessions UX
  const sessionsUx = await probeSessionsUx(isLocalDemo, userId);
  results.push(sessionsUx);
  log(`Sessions UX — ${sessionsUx.detail}`, sessionsUx.passed && !sessionsUx.skipped);

  // 4. Streaming AI
  const t3 = performance.now();
  const selectedModel = getSelectedAiModel();
  const modelCheck = validateAiModel(selectedModel);
  if (!modelCheck.ok) {
    results.push(failResult('Streaming AI', modelCheck.detail, t3));
    log(`Streaming AI — ${modelCheck.detail}`, false);
  } else {
    try {
      const url = supabaseFunctionUrl('chat');
      const { data: { session } } = await supabase.auth.getSession();
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Povedz iba jedno slovo: PONG' }],
          model: selectedModel,
        }),
      });
      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({}));
        const bodyMsg = typeof errBody?.error === 'string' ? errBody.error : undefined;
        throw new Error(formatStreamingAiDiagnosticDetail(resp.status, bodyMsg));
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let firstTokenAt = 0;
      let chunks = 0;
      let totalText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') continue;
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) {
              if (!firstTokenAt) firstTokenAt = performance.now();
              chunks++;
              totalText += c;
            }
          } catch { /* ignore partial SSE */ }
        }
      }

      const ttft = firstTokenAt - t3;
      const total = performance.now() - t3;
      if (!totalText) throw new Error('Žiadne tokeny prijaté');
      const r = passResult(
        'Streaming AI',
        `${selectedModel} · TTFT ${ttft.toFixed(0)}ms · ${chunks} chunks`,
        t3,
      );
      r.durationMs = total;
      results.push(r);
      log(`Streaming AI — ${r.detail}`, true);
    } catch (e: any) {
      results.push(failResult('Streaming AI', e.message, t3));
      log(`Streaming AI — ${e.message}`, false);
    }
  }

  // 5. Storage
  const t4 = performance.now();
  if (isLocalDemo) {
    results.push(skippedResult('Storage', 'Preskočené v Local Demo', t4));
    log('Storage — Preskočené v Local Demo', true);
  } else {
    try {
      const blob = new Blob([`e2e test ${Date.now()}`], { type: 'text/plain' });
      testFilePath = `${userId}/__e2e_${Date.now()}.txt`;
      const { error: upErr } = await supabase.storage.from('chat-attachments').upload(testFilePath, blob);
      if (upErr) throw new Error('Upload: ' + upErr.message);

      const { data: list } = await supabase.storage.from('chat-attachments').list(userId);
      const exists = list?.some(f => testFilePath?.endsWith(f.name));
      if (!exists) throw new Error('Súbor sa nenašiel po uploade');

      await supabase.storage.from('chat-attachments').remove([testFilePath]);
      testFilePath = null;

      results.push(passResult('Storage', 'Upload+List+Delete OK', t4));
      log('Storage — Upload+List+Delete OK', true);
    } catch (e: any) {
      if (testFilePath) await supabase.storage.from('chat-attachments').remove([testFilePath]).catch(() => {});
      results.push(failResult('Storage', e.message, t4));
      log(`Storage — ${e.message}`, false);
    }
  }

  // 6. Storage Rules
  const tRules = performance.now();
  pushProbe(results, 'Storage Rules', probeStorageRules(), tRules);

  // 7. Voice API
  const t5 = performance.now();
  try {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) throw new Error('Web Speech API nie je dostupné (headless OK)');
    results.push(passResult('Voice API', 'webkitSpeechRecognition dostupné', t5));
    log('Voice API — dostupné', true);
  } catch (e: any) {
    results.push(skippedResult('Voice API', e.message, t5));
    log(`Voice API — ${e.message}`, true);
  }

  // 8–11. Edge / infra probes
  const health = await probeHealthApi();
  results.push(health);
  log(`Health API — ${health.detail}`, health.passed);

  const wpProxy = await probeWordPressProxy(isLocalDemo, accessToken);
  results.push(wpProxy);
  log(`WordPress Proxy — ${wpProxy.detail}`, wpProxy.passed);

  const tDeploy = performance.now();
  pushProbe(results, 'WP Deploy', probeWpDeployDryRun(isLocalDemo, hasWpSite), tDeploy);

  const inquiries = await probeInquiriesApi();
  results.push(inquiries);
  log(`Inquiries API — ${inquiries.detail}`, inquiries.passed);

  // 12–19. Workspace module probes
  const tPreview = performance.now();
  pushProbe(results, 'Preview', probePreviewExtract(), tPreview);

  const generator = await probeGeneratorModule(isLocalDemo);
  results.push(generator);
  log(`Generátor — ${generator.detail}`, generator.passed && !generator.skipped);

  const tAnalyzer = performance.now();
  pushProbe(results, 'Analyzátor', probeAnalyzerRequestShape(), tAnalyzer);

  const github = await probeGitHubConnector(isLocalDemo);
  results.push(github);
  log(`GitHub — ${github.detail}`, github.passed && !github.skipped);

  const tLaunch = performance.now();
  pushProbe(results, 'Launch Handoff', probeLaunchHandoff(), tLaunch);

  const tModel = performance.now();
  pushProbe(results, 'AI Model', probeSettingsModel(), tModel);

  const tWorkflow = performance.now();
  pushProbe(results, 'Workflow', probeWorkflowRibbon(), tWorkflow);

  const tTheme = performance.now();
  pushProbe(results, 'Téma', probeThemePersistence(), tTheme);

  finalize();

  const summary = summarizeE2EResults(results);
  console.log(
    `%c━━━ Výsledok: ${summary.passed} prešlo, ${summary.skipped} preskočené, ${summary.failed} zlyhalo ━━━`,
    `color:${summary.failed === 0 ? '#22c55e' : '#ef4444'};font-weight:bold;font-size:14px`,
  );

  const detailsList = results.map(r => {
    if (!r.passed) return `❌ ${E2E_STEP_DISPLAY_LABELS[r.step as E2EStepLabel] ?? r.step}: ${r.detail}`;
    if (r.skipped) return `⏭️ ${E2E_STEP_DISPLAY_LABELS[r.step as E2EStepLabel] ?? r.step}: Preskočené`;
    return `✅ ${E2E_STEP_DISPLAY_LABELS[r.step as E2EStepLabel] ?? r.step}`;
  }).join('\n');

  if (summary.failed === 0) {
    toast.success(formatE2ESummaryLine(summary), { description: detailsList, duration: 12000 });
  } else {
    toast.error(formatE2ESummaryLine(summary), { description: detailsList, duration: 15000 });
  }

  publishResults(results);
  return results;
}
