import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface E2EResult {
  step: string;
  passed: boolean;
  detail: string;
  durationMs: number;
}

const log = (msg: string, ok: boolean) => {
  const icon = ok ? '✅' : '❌';
  // eslint-disable-next-line no-console
  console.log(`%c[E2E] ${icon} ${msg}`, `color:${ok ? '#22c55e' : '#ef4444'};font-weight:bold`);
};

export async function runE2ETest(): Promise<E2EResult[]> {
  // eslint-disable-next-line no-console
  console.log('%c━━━ H4CK3D Enterprise E2E Test ━━━', 'color:#3b82f6;font-weight:bold;font-size:14px');
  const results: E2EResult[] = [];
  let testSessionId: string | null = null;
  let testFilePath: string | null = null;

  // 1. AUTH
  const t1 = performance.now();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Žiadna aktívna session');
    const r = { step: 'Auth', passed: true, detail: `User ${session.user.email}`, durationMs: performance.now() - t1 };
    results.push(r); log(`Auth — ${r.detail} (${r.durationMs.toFixed(0)}ms)`, true);
  } catch (e: any) {
    const r = { step: 'Auth', passed: false, detail: e.message, durationMs: performance.now() - t1 };
    results.push(r); log(`Auth — ${e.message}`, false);
    return results; // can't continue
  }

  const userId = (await supabase.auth.getSession()).data.session!.user.id;

  // 2. DB write/read/delete
  const t2 = performance.now();
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

    const r = { step: 'DB CRUD', passed: true, detail: `Insert+Read+Delete OK (${msgs.length} msg)`, durationMs: performance.now() - t2 };
    results.push(r); log(`DB CRUD — ${r.detail} (${r.durationMs.toFixed(0)}ms)`, true);
  } catch (e: any) {
    if (testSessionId) {
      await supabase.from('chat_messages').delete().eq('session_id', testSessionId);
      await supabase.from('chat_sessions').delete().eq('id', testSessionId);
    }
    const r = { step: 'DB CRUD', passed: false, detail: e.message, durationMs: performance.now() - t2 };
    results.push(r); log(`DB CRUD — ${e.message}`, false);
  }

  // 3. Streaming chat
  const t3 = performance.now();
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/chat`;
    const { data: { session } } = await supabase.auth.getSession();
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Povedz iba jedno slovo: PONG' }] }),
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
        } catch {}
      }
    }

    const ttft = firstTokenAt - t3;
    const total = performance.now() - t3;
    if (!totalText) throw new Error('Žiadne tokeny prijaté');
    const r = {
      step: 'Streaming AI', passed: true,
      detail: `TTFT ${ttft.toFixed(0)}ms · ${chunks} chunks · ${totalText.length} znakov`,
      durationMs: total,
    };
    results.push(r); log(`Streaming — ${r.detail} (total ${total.toFixed(0)}ms)`, true);
  } catch (e: any) {
    const r = { step: 'Streaming AI', passed: false, detail: e.message, durationMs: performance.now() - t3 };
    results.push(r); log(`Streaming — ${e.message}`, false);
  }

  // 4. Storage upload
  const t4 = performance.now();
  try {
    const blob = new Blob([`e2e test ${Date.now()}`], { type: 'text/plain' });
    testFilePath = `${userId}/__e2e_${Date.now()}.txt`;
    const { error: upErr } = await supabase.storage.from('chat-attachments').upload(testFilePath, blob);
    if (upErr) throw new Error('Upload: ' + upErr.message);

    const { data: list } = await supabase.storage.from('chat-attachments').list(userId);
    const exists = list?.some(f => testFilePath?.endsWith(f.name));
    if (!exists) throw new Error('Súbor sa nenašiel po uploade');

    await supabase.storage.from('chat-attachments').remove([testFilePath]);

    const r = { step: 'Storage', passed: true, detail: `Upload+List+Delete OK`, durationMs: performance.now() - t4 };
    results.push(r); log(`Storage — ${r.detail} (${r.durationMs.toFixed(0)}ms)`, true);
  } catch (e: any) {
    if (testFilePath) await supabase.storage.from('chat-attachments').remove([testFilePath]).catch(() => {});
    const r = { step: 'Storage', passed: false, detail: e.message, durationMs: performance.now() - t4 };
    results.push(r); log(`Storage — ${e.message}`, false);
  }

  // 5. Voice API
  const t5 = performance.now();
  try {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) throw new Error('Web Speech API nie je dostupné');
    const r = { step: 'Voice API', passed: true, detail: 'webkitSpeechRecognition dostupné', durationMs: performance.now() - t5 };
    results.push(r); log(`Voice API — ${r.detail}`, true);
  } catch (e: any) {
    const r = { step: 'Voice API', passed: false, detail: e.message, durationMs: performance.now() - t5 };
    results.push(r); log(`Voice API — ${e.message}`, false);
  }

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  // eslint-disable-next-line no-console
  console.log(`%c━━━ Výsledok: ${passed}/${total} prešlo ━━━`, `color:${passed === total ? '#22c55e' : '#ef4444'};font-weight:bold;font-size:14px`);

  if (passed === total) {
    toast.success(`E2E test: ${passed}/${total} prešlo ✅`, { description: 'Všetky systémy fungujú. Detaily v konzole.' });
  } else {
    toast.error(`E2E test: ${passed}/${total} prešlo`, { description: 'Pozrite konzolu pre detaily zlyhaní.' });
  }

  return results;
}
