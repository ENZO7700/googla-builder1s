/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface E2EResult {
  step: string;
  passed: boolean;
  detail: string;
  durationMs: number;
  skipped?: boolean;
}

export const E2E_STEP_LABELS = [
  'Auth',
  'DB CRUD',
  'Streaming AI',
  'Storage',
  'Voice API',
  'Health API',
  'WordPress Proxy',
  'Inquiries API',
] as const;

export type E2EStepLabel = (typeof E2E_STEP_LABELS)[number];

export const ALLOWED_AI_MODELS = [
  'mistral-large-latest',
  'mistral-medium',
  'mistral-small',
  'mistral-tiny',
  'mixtral-8x7b-latest',
  'codestral-latest',
  'pixtral-12b-latest',
] as const;

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

export function getSelectedAiModel(): string {
  return localStorage.getItem('ai-model') || 'mistral-large-latest';
}

export function validateAiModel(model: string): { ok: boolean; detail: string } {
  if (ALLOWED_AI_MODELS.includes(model as (typeof ALLOWED_AI_MODELS)[number])) {
    return { ok: true, detail: model };
  }
  return { ok: false, detail: `Neplatný model: ${model}` };
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

const log = (msg: string, ok: boolean) => {
  const icon = ok ? '✅' : '❌';
  console.log(`%c[E2E] ${icon} ${msg}`, `color:${ok ? '#22c55e' : '#ef4444'};font-weight:bold`);
};

function publishResults(results: E2EResult[]) {
  window.dispatchEvent(new CustomEvent(E2E_RESULTS_EVENT, { detail: results }));
  sessionStorage.setItem('wpbox.e2eResults', JSON.stringify({ at: Date.now(), results }));
}

function supabaseFunctionUrl(name: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return `${base}/functions/v1/${name}`;
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

export async function runE2ETest(): Promise<E2EResult[]> {
  console.log('%c━━━ LarsenEvans-wpBOX E2E Test ━━━', 'color:#3b82f6;font-weight:bold;font-size:14px');
  const results: E2EResult[] = [];
  let testSessionId: string | null = null;
  let testFilePath: string | null = null;

  // 1. AUTH
  const t1 = performance.now();
  let isLocalDemo = false;
  let accessToken: string | null = null;
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
    }
  } catch (e: any) {
    const r = failResult('Auth', e.message, t1);
    results.push(r);
    log(`Auth — ${e.message}`, false);
    publishResults(results);
    return results;
  }

  const userId = isLocalDemo ? 'local-wpbox-user' : (await supabase.auth.getSession()).data.session!.user.id;

  // 2. DB write/read/delete
  const t2 = performance.now();
  if (isLocalDemo) {
    const r = skippedResult('DB CRUD', 'Preskočené v Local Demo', t2);
    results.push(r);
    log(`DB CRUD — ${r.detail}`, true);
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

      const r = passResult('DB CRUD', `Insert+Read+Delete OK (${msgs.length} msg)`, t2);
      results.push(r);
      log(`DB CRUD — ${r.detail} (${r.durationMs.toFixed(0)}ms)`, true);
    } catch (e: any) {
      if (testSessionId) {
        await supabase.from('chat_messages').delete().eq('session_id', testSessionId);
        await supabase.from('chat_sessions').delete().eq('id', testSessionId);
      }
      const r = failResult('DB CRUD', e.message, t2);
      results.push(r);
      log(`DB CRUD — ${e.message}`, false);
    }
  }

  // 3. Streaming chat (uses selected AI model from Nastavenia)
  const t3 = performance.now();
  const selectedModel = getSelectedAiModel();
  const modelCheck = validateAiModel(selectedModel);
  if (!modelCheck.ok) {
    const r = failResult('Streaming AI', modelCheck.detail, t3);
    results.push(r);
    log(`Streaming — ${modelCheck.detail}`, false);
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
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

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
          } catch { /* ignore partial SSE frames */ }
        }
      }

      const ttft = firstTokenAt - t3;
      const total = performance.now() - t3;
      if (!totalText) throw new Error('Žiadne tokeny prijaté');
      const r = passResult(
        'Streaming AI',
        `${selectedModel} · TTFT ${ttft.toFixed(0)}ms · ${chunks} chunks · ${totalText.length} znakov`,
        t3,
      );
      r.durationMs = total;
      results.push(r);
      log(`Streaming — ${r.detail} (total ${total.toFixed(0)}ms)`, true);
    } catch (e: any) {
      const r = failResult('Streaming AI', e.message, t3);
      results.push(r);
      log(`Streaming — ${e.message}`, false);
    }
  }

  // 4. Storage upload
  const t4 = performance.now();
  if (isLocalDemo) {
    const r = skippedResult('Storage', 'Preskočené v Local Demo', t4);
    results.push(r);
    log(`Storage — ${r.detail}`, true);
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

      const r = passResult('Storage', 'Upload+List+Delete OK', t4);
      results.push(r);
      log(`Storage — ${r.detail} (${r.durationMs.toFixed(0)}ms)`, true);
    } catch (e: any) {
      if (testFilePath) await supabase.storage.from('chat-attachments').remove([testFilePath]).catch(() => {});
      const r = failResult('Storage', e.message, t4);
      results.push(r);
      log(`Storage — ${e.message}`, false);
    }
  }

  // 5. Voice API
  const t5 = performance.now();
  try {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) throw new Error('Web Speech API nie je dostupné');
    const r = passResult('Voice API', 'webkitSpeechRecognition dostupné', t5);
    results.push(r);
    log(`Voice API — ${r.detail}`, true);
  } catch (e: any) {
    const r = failResult('Voice API', e.message, t5);
    results.push(r);
    log(`Voice API — ${e.message}`, false);
  }

  // 6. Health API
  const health = await probeHealthApi();
  results.push(health);
  log(`Health API — ${health.detail}`, health.passed);

  // 7. WordPress Proxy
  const wpProxy = await probeWordPressProxy(isLocalDemo, accessToken);
  results.push(wpProxy);
  log(`WordPress Proxy — ${wpProxy.detail}`, wpProxy.passed);

  // 8. Inquiries API
  const inquiries = await probeInquiriesApi();
  results.push(inquiries);
  log(`Inquiries API — ${inquiries.detail}`, inquiries.passed);

  const summary = summarizeE2EResults(results);
  console.log(
    `%c━━━ Výsledok: ${summary.passed} prešlo, ${summary.skipped} preskočené, ${summary.failed} zlyhalo ━━━`,
    `color:${summary.failed === 0 ? '#22c55e' : '#ef4444'};font-weight:bold;font-size:14px`,
  );

  const detailsList = results.map(r => {
    if (!r.passed) return `❌ ${r.step}: ${r.detail}`;
    if (r.skipped) return `⏭️ ${r.step}: Preskočené`;
    return `✅ ${r.step}`;
  }).join('\n');

  if (summary.failed === 0) {
    toast.success(formatE2ESummaryLine(summary), {
      description: detailsList,
      duration: 10000,
    });
  } else {
    toast.error(formatE2ESummaryLine(summary), {
      description: detailsList,
      duration: 15000,
    });
  }

  publishResults(results);
  return results;
}
