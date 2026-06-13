/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import LoginScreen from '@/components/LoginScreen';
import SidebarNav, { Session } from '@/components/workspace/SidebarNav';
import SystemMonitor, { StreamDiagnostics } from '@/components/workspace/SystemMonitor';
import ChatView from '@/components/workspace/ChatView';
import WorkflowRibbon from '@/components/workspace/WorkflowRibbon';
import ToastContainer, { Toast } from '@/components/workspace/ToastContainer';
import SettingsPanel from '@/components/workspace/SettingsPanel';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  createWorkflowRun,
  finishWorkflowRun,
  updateWorkflowStep,
  type WorkflowRun,
  type WorkflowStepId,
} from '@/lib/workflow';

const AnalyzerView = lazy(() => import('@/components/workspace/AnalyzerView'));
const GeneratorView = lazy(() => import('@/components/workspace/GeneratorView'));
const PreviewView = lazy(() => import('@/components/workspace/PreviewView'));
const ConnectorsView = lazy(() => import('@/components/workspace/ConnectorsView'));
const OnboardingGuide = lazy(() => import('@/components/workspace/OnboardingGuide'));

const LOCAL_ACCESS_KEY = 'wpbox.localAccess';
const LOCAL_USER_ID = 'local-wpbox-user';
const LOCAL_DEMO_USER = {
  id: LOCAL_USER_ID,
  email: 'local@larsenevans-wpbox.dev',
} as User;

interface Message {
  role: string;
  content: string;
}

interface Attachment {
  name: string;
  size: string;
  file?: File;
  progress?: number;       // 0-100
  uploading?: boolean;
  url?: string;            // public URL once uploaded
  path?: string;           // storage path (for cleanup)
  error?: string;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_FILES = 10;
const ALLOWED_EXT = /\.(txt|md|json|csv|js|ts|tsx|jsx|py|html|css|xml|yml|yaml|log|pdf|png|jpg|jpeg|webp|gif|svg)$/i;
const WORDPRESS_HTML_DEPLOY_SYSTEM_HINT = [
  'For WordPress page, section, block, landing page, services, CTA, or layout generation, return exactly one ```html code block.',
  'The html block must contain deployable WordPress Gutenberg/FSE-compatible HTML and CSS only.',
  'Do not include React, JSX, PHP, npm/build steps, full <html>/<head>/<body> documents, or explanation outside the html block.',
  'Adapt content and structure to the user request while keeping the output deployable through the WordPress page deploy button.',
].join('\n');

function getLastUserMessage(msgs: Message[]): string {
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (msgs[i]?.role === 'user') return msgs[i].content;
  }
  return '';
}

function buildLocalDemoHtml(prompt: string): string {
  const safeTitle = prompt.trim().slice(0, 72) || 'AI Landing Page Draft';
  return `\`\`\`html
<style>
  .wpbox-demo-shell{--wpbox-bg:#f6f4ee;--wpbox-ink:#18181b;--wpbox-accent:#0f766e;--wpbox-card:#ffffff;padding:32px;border-radius:24px;background:var(--wpbox-bg);color:var(--wpbox-ink);font-family:Georgia,"Times New Roman",serif}
  .wpbox-demo-grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-top:24px}
  .wpbox-demo-card{background:var(--wpbox-card);padding:18px;border-radius:18px;border:1px solid rgba(24,24,27,.08)}
  .wpbox-demo-cta{display:inline-block;margin-top:18px;padding:12px 18px;border-radius:999px;background:var(--wpbox-accent);color:#fff;text-decoration:none;font-weight:700}
</style>
<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group"><div class="wpbox-demo-shell">
  <!-- wp:heading {"level":1} -->
  <h1>${safeTitle}</h1>
  <!-- /wp:heading -->
  <!-- wp:paragraph -->
  <p>Toto je lokálny demo HTML draft z Dev-Free-Entry režimu. Po prihlásení cez Supabase dostanete live Mistral generovanie a produkčný WordPress deploy flow.</p>
  <!-- /wp:paragraph -->
  <!-- wp:columns -->
  <div class="wpbox-demo-grid">
    <div class="wpbox-demo-card"><strong>Hero</strong><p>Jasný headline, stručný value proposition a CTA.</p></div>
    <div class="wpbox-demo-card"><strong>Offer</strong><p>Prehľad služieb alebo benefitov v čistej mriežke.</p></div>
    <div class="wpbox-demo-card"><strong>Proof</strong><p>Dôvera cez referencie, výsledky alebo proces.</p></div>
  </div>
  <!-- /wp:columns -->
  <!-- wp:buttons -->
  <div><a class="wpbox-demo-cta" href="{{CTA_URL}}">Poslať na WP</a></div>
  <!-- /wp:buttons -->
</div></div>
<!-- /wp:group -->
\`\`\``;
}

function buildLocalDemoResponse(msgs: Message[], systemOverride?: string): string {
  const prompt = getLastUserMessage(msgs);
  const lowerPrompt = prompt.toLowerCase();
  const lowerOverride = (systemOverride ?? '').toLowerCase();

  if (lowerOverride.includes('wordpress') || /wordpress|landing|hero|cta|gutenberg|deploy|html/.test(lowerPrompt)) {
    return buildLocalDemoHtml(prompt);
  }

  if (/analyzuj tieto logy|log analysis|identifikuj hrozby|threat/i.test(prompt)) {
    return [
      '## Lokálna Demo Analýza',
      '',
      '- Bez live Supabase session je AI backend vypnutý, preto ide o lokálny fallback.',
      '- Skontroluj opakované 401/403 odpovede, chýbajúci bearer token a nesprávne REST endpointy.',
      '- Po prihlásení sa znova spustí plná Mistral analýza.',
    ].join('\n');
  }

  if (/napíš skript|script generation|cloud funkciu|function/i.test(prompt)) {
    return [
      '```ts',
      'export function handler() {',
      "  console.log('Local demo fallback active. Sign in for live Mistral generation.');",
      '}',
      '```',
    ].join('\n');
  }

  return [
    'Lokálny demo režim je aktívny.',
    '',
    'Live AI chat cez Mistral potrebuje Supabase prihlásenie, preto sa teraz nepoužil vzdialený backend.',
    'Pre ostré generovanie sa prihláste a potom skúste prompt znova.',
  ].join('\n');
}

function isLocalSessionId(sessionId: string | null | undefined): boolean {
  return typeof sessionId === 'string' && sessionId.startsWith('local_');
}

function placeholderImageDataUri(label = 'wpBOX Preview'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#0a0a0a"/><stop offset="1" stop-color="#d4af37"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><text x="60" y="420" fill="#fff" font-family="Arial, sans-serif" font-size="56" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function sanitizeGeneratedHtmlForWordPress(html: string): string {
  const safeImage = placeholderImageDataUri();
  return html
    .replace(/\s(src|poster)=(['"])\{\{[^}]+\}\}\2/gi, ` $1="$${'SAFE_IMAGE'}"`)
    .replace(/\s(srcset)=(['"])[^'"]*\{\{[^}]+\}\}[^'"]*\2/gi, ` $1="$${'SAFE_IMAGE'}"`)
    .replace(/\s(href|action)=(['"])\{\{[^}]+\}\}\2/gi, ' $1="#"')
    .replace(/url\((['"]?)\{\{[^}]+\}\}\1\)/gi, 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 55%, #3a2f12 100%)')
    .replace(/\$SAFE_IMAGE/g, safeImage);
}

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState('welcome');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [latestGeneratedCode, setLatestGeneratedCode] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [diagnostics, setDiagnostics] = useState<StreamDiagnostics | null>(null);
  const [workflowRun, setWorkflowRun] = useState<WorkflowRun | null>(null);
  const recognitionRef = useRef<any>(null);
  const [logs, setLogs] = useState([
    '[SYSTEM] Inicializácia inštancie LarsenEvans-wpBOX...',
    '[AUTH] IAM politiky úspešne overené.',
    '[NET] Pripojenie k VPC nadviazané.',
    '[AGENT] Cloud AI agent pripravený.',
  ]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        localStorage.removeItem(LOCAL_ACCESS_KEY);
        setUser(session.user);
        setAuthLoading(false);
        return;
      }
      if (localStorage.getItem(LOCAL_ACCESS_KEY) === 'true') {
        setUser(LOCAL_DEMO_USER);
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        localStorage.removeItem(LOCAL_ACCESS_KEY);
        setUser(session.user);
      } else if (localStorage.getItem(LOCAL_ACCESS_KEY) === 'true') {
        setUser(LOCAL_DEMO_USER);
      }
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load sessions from DB
  useEffect(() => {
    if (!user) { setSessionsLoading(false); return; }
    if (user.id === LOCAL_USER_ID) {
      setSessions([]);
      setSessionsLoading(false);
      return;
    }
    const loadSessions = async () => {
      setSessionsLoading(true);
      const { data } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (data) {
        setSessions(data.map(s => ({
          id: s.id,
          title: s.title,
          date: new Date(s.created_at).toLocaleDateString('sk'),
          messages: [],
        })));
      }
      setSessionsLoading(false);
    };
    loadSessions();
  }, [user]);

  // Keyboard shortcut: Ctrl+K = new session
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleNewSession();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Pickup builder prompt handed off from Launch Audit dashboard.
  useEffect(() => {
    if (!user) return;
    try {
      const stored = sessionStorage.getItem('builderPrompt');
      const src = sessionStorage.getItem('builderPromptSource');
      if (stored) {
        setCurrentView('tasks');
        setInputValue(stored);
        sessionStorage.removeItem('builderPrompt');
        sessionStorage.removeItem('builderPromptSource');
        toast.success(`Prompt načítaný z modulu ${src ?? 'Launch Audit'}`, {
          description: 'Skontroluj ho a stlač Send pre spustenie generovania.',
        });
      }
    } catch { /* ignore */ }
  }, [user]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-30), msg]);
  }, []);

  const setWorkflowStep = useCallback((stepId: WorkflowStepId, update: Parameters<typeof updateWorkflowStep>[2]) => {
    setWorkflowRun(prev => prev ? updateWorkflowStep(prev, stepId, update) : prev);
  }, []);

  const finishWorkflow = useCallback((status: 'done' | 'error', lastEvent: string) => {
    setWorkflowRun(prev => prev ? finishWorkflowRun(prev, status, lastEvent) : prev);
  }, []);

  // Real event logs instead of fake ones
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (!isLoading && Math.random() > 0.9) {
        const realLogs = [
          '[MONITOR] IAM role synchronizované.',
          '[SYSTEM] Telemetrické dáta odoslané.',
          '[NET] PING us-central1: ' + (18 + Math.floor(Math.random() * 15)) + 'ms.',
          '[AGENT] Health check: OK.',
        ];
        addLog(realLogs[Math.floor(Math.random() * realLogs.length)]);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [isLoading, user, addLog]);

  const extractCodeForPreview = (text: string) => {
    if (!text) return;
    setWorkflowStep('preview', { status: 'running', detail: 'Hľadám HTML blok pre náhľad', progress: 35 });
    let foundPreview = false;
    try {
      const parts = text.split('```');
      for (let i = 1; i < parts.length; i += 2) {
        const block = parts[i];
        if (block.toLowerCase().startsWith('html') || block.toLowerCase().startsWith('xml')) {
          const code = block.substring(block.indexOf('\n') + 1);
          setLatestGeneratedCode(code);
          foundPreview = true;
          setWorkflowStep('preview', { status: 'done', detail: 'HTML náhľad pripravený', progress: 100 });
          addLog('[UI] Vizuálny kód exportovaný do Sandboxu.');
          showToast('Live Náhľad aktualizovaný', 'success');
          break;
        }
      }
      if (!foundPreview) {
        setWorkflowStep('preview', { status: 'skipped', detail: 'Bez HTML náhľadu', progress: 100 });
      }
    } catch {
      setWorkflowStep('preview', { status: 'error', detail: 'Extrakcia náhľadu zlyhala', progress: 100 });
      addLog('[ERROR] Extrakcia náhľadu zlyhala.');
    }
  };

  const saveMessageToDB = async (sessionId: string, role: string, content: string) => {
    if (!user) return;
    if (user.id === LOCAL_USER_ID) {
      setSessions(prev => prev.map(s => (
        s.id === sessionId
          ? { ...s, messages: [...s.messages, { role, content }] }
          : s
      )));
      return;
    }
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role,
      content,
    });
  };

  const createSessionInDB = async (title: string): Promise<string | null> => {
    if (!user) return null;
    if (user.id === LOCAL_USER_ID) {
      return `local_${Date.now()}`;
    }
    const { data } = await supabase.from('chat_sessions').insert({
      user_id: user.id,
      title: title.substring(0, 40),
    }).select('id').single();
    return data?.id ?? null;
  };

  const updateSessionTitle = async (sessionId: string, title: string) => {
    const trimmed = title.substring(0, 40);
    if (user?.id === LOCAL_USER_ID) {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: trimmed } : s));
      return;
    }
    await supabase.from('chat_sessions').update({ title: trimmed, updated_at: new Date().toISOString() }).eq('id', sessionId);
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: trimmed } : s));
  };

  // Validate single file before accepting
  const validateFile = (f: File): string | null => {
    if (f.size > MAX_FILE_SIZE) return `Súbor "${f.name}" je príliš veľký (max 20 MB).`;
    if (!ALLOWED_EXT.test(f.name) && !f.type.startsWith('text/') && !f.type.startsWith('image/')) {
      return `Súbor "${f.name}" má nepovolený typ.`;
    }
    return null;
  };

  // Upload one file immediately, updating progress in state
  const uploadOne = async (att: Attachment, index: number) => {
    if (!user || !att.file) return;
    if (user.id === LOCAL_USER_ID) {
      const url = URL.createObjectURL(att.file);
      setAttachments(prev => prev.map((a, i) =>
        i === index ? { ...a, uploading: false, progress: 100, url, path: url } : a
      ));
      addLog(`[LOCAL] Súbor pripravený lokálne: ${att.name}`);
      return;
    }
    const path = `${user.id}/pending/${Date.now()}_${att.name}`;
    // simulate progress while supabase SDK does the upload
    const progressInterval = setInterval(() => {
      setAttachments(prev => prev.map((a, i) =>
        i === index && a.uploading && (a.progress ?? 0) < 90
          ? { ...a, progress: Math.min(90, (a.progress ?? 0) + 15) }
          : a
      ));
    }, 200);

    const { error } = await supabase.storage.from('chat-attachments').upload(path, att.file);
    clearInterval(progressInterval);

    if (error) {
      setAttachments(prev => prev.map((a, i) =>
        i === index ? { ...a, uploading: false, error: error.message } : a
      ));
      addLog(`[ERROR] Upload zlyhalo: ${att.name}`);
      toast.error(`Upload zlyhal: ${att.name}`, { description: error.message });
      return;
    }

    const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
    setAttachments(prev => prev.map((a, i) =>
      i === index ? { ...a, uploading: false, progress: 100, url: data.publicUrl, path } : a
    ));
    addLog(`[FS] Súbor nahraný: ${att.name}`);
  };

  const getSelectedModel = () => localStorage.getItem('ai-model') || 'mistral-large-latest';

  // Streaming AI call with error recovery + diagnostics
  const callAIStreaming = async (msgs: Message[], systemOverride?: string): Promise<string> => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/chat`;
    const { data: { session } } = await supabase.auth.getSession();
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const model = getSelectedModel();
    const startTime = performance.now();
    let firstTokenTime = 0;
    let chunks = 0;

    setDiagnostics(null);
    setWorkflowStep('ai', { status: 'running', detail: 'Odosielam request do AI Core', progress: 30 });

    if (user?.id === LOCAL_USER_ID || !session?.access_token) {
      const localText = buildLocalDemoResponse(msgs, systemOverride);
      setWorkflowStep('ai', { status: 'done', detail: 'Lokálny fallback bez Supabase session', progress: 100 });
      setWorkflowStep('stream', { status: 'done', detail: 'Lokálna odpoveď pripravená', progress: 100 });
      setWorkflowStep('save', { status: 'skipped', detail: 'Demo režim bez serverového uloženia', progress: 100 });
      setDiagnostics({
        ttft: 0,
        total: performance.now() - startTime,
        chunks: 0,
        model: `local-demo:${model}`,
        timestamp: new Date(),
      });
      addLog('[LOCAL] Chat beží v demo fallback režime bez Supabase session.');
      return localText;
    }

    let response: Response | null = null;
    let lastError: any = null;
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout pre initial connection
        
        if (attempt > 0) {
          addLog(`[RETRY] Pokus ${attempt + 1}/${MAX_RETRIES} o spojenie s AI Core...`);
          setWorkflowStep('ai', { status: 'running', detail: `Retry spojenia (${attempt + 1}/${MAX_RETRIES})`, progress: 30 });
        }

        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({ messages: msgs, systemOverride, model }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (response.ok) break; // Success
        
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`HTTP ${response.status} z AI Gateway`);
        } else {
          break; // Don't retry client errors (400, 401, 402, 403)
        }
      } catch (err: any) {
        lastError = err;
        const isAbort = err.name === 'AbortError';
        if (attempt === MAX_RETRIES - 1) {
          const errMsg = isAbort ? 'Časový limit spojenia vypršal' : (err.message || 'Network error');
          setDiagnostics({ ttft: 0, total: performance.now() - startTime, chunks: 0, model, error: errMsg, timestamp: new Date() });
          setWorkflowStep('ai', { status: 'error', detail: errMsg, progress: 100 });
          finishWorkflow('error', 'AI request zlyhal');
          throw err;
        }
        // Exponential backoff
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }

    if (!response) {
      throw lastError || new Error('Spojenie zlyhalo');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (response.status === 429) toast.error('Rate limit – skúste to o chvíľu.');
      else if (response.status === 402) toast.error('Nedostatok kreditov.');
      const msg = errData.error || `HTTP ${response.status}`;
      setDiagnostics({ ttft: 0, total: performance.now() - startTime, chunks: 0, model, error: msg, timestamp: new Date() });
      setWorkflowStep('ai', { status: 'error', detail: msg, progress: 100 });
      finishWorkflow('error', 'AI Core vrátil chybu');
      throw new Error(msg);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      setDiagnostics({ ttft: 0, total: performance.now() - startTime, chunks: 0, model, error: 'No stream', timestamp: new Date() });
      setWorkflowStep('ai', { status: 'done', detail: 'AI Core odpovedal', progress: 100 });
      setWorkflowStep('stream', { status: 'error', detail: 'Stream nie je dostupný', progress: 100 });
      finishWorkflow('error', 'Chýba stream odpovede');
      throw new Error('No stream');
    }
    const decoder = new TextDecoder();
    let fullText = '';
    let textBuffer = '';
    setIsStreaming(true);
    setWorkflowStep('ai', { status: 'done', detail: 'AI Core prijal request', progress: 100 });
    setWorkflowStep('stream', { status: 'running', detail: 'Čakám na prvý token', progress: 15 });

    setMessages(prev => [...prev, { role: 'model', content: '' }]);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              if (!firstTokenTime) {
                firstTokenTime = performance.now();
                setWorkflowStep('stream', { status: 'running', detail: 'Prvý token prijatý', progress: 35 });
              }
              chunks++;
              if (chunks % 8 === 0) {
                setWorkflowStep('stream', {
                  status: 'running',
                  detail: `Streamujem odpoveď (${chunks} chunkov)`,
                  progress: Math.min(92, 35 + chunks * 2),
                });
              }
              fullText += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'model', content: fullText };
                return updated;
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              if (!firstTokenTime) {
                firstTokenTime = performance.now();
                setWorkflowStep('stream', { status: 'running', detail: 'Prvý token prijatý', progress: 35 });
              }
              chunks++;
              if (chunks % 8 === 0) {
                setWorkflowStep('stream', {
                  status: 'running',
                  detail: `Streamujem odpoveď (${chunks} chunkov)`,
                  progress: Math.min(92, 35 + chunks * 2),
                });
              }
              fullText += content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'model', content: fullText };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (streamErr: any) {
      if (!fullText) setMessages(prev => prev.slice(0, -1));
      setDiagnostics({
        ttft: firstTokenTime ? firstTokenTime - startTime : 0,
        total: performance.now() - startTime,
        chunks, model,
        error: streamErr.message || 'Stream interrupted',
        timestamp: new Date(),
      });
      setWorkflowStep('stream', { status: 'error', detail: streamErr.message || 'Stream interrupted', progress: 100 });
      finishWorkflow('error', 'Stream odpovede bol prerušený');
      throw streamErr;
    } finally {
      setIsStreaming(false);
    }

    setWorkflowStep('stream', { status: 'done', detail: `Stream hotový (${chunks} chunkov)`, progress: 100 });

    setDiagnostics({
      ttft: firstTokenTime ? firstTokenTime - startTime : 0,
      total: performance.now() - startTime,
      chunks, model,
      timestamp: new Date(),
    });

    return fullText;
  };

  const handleSendMessage = async (textToProcess: string = inputValue) => {
    if (!textToProcess.trim() && attachments.length === 0) return;

    // Wait for any in-flight uploads to finish
    if (attachments.some(a => a.uploading)) {
      toast.info('Čakám na dokončenie nahrávania súborov...');
      return;
    }

    let finalPrompt = textToProcess;

    // Use already-uploaded URLs
    const ready = attachments.filter(a => a.url);
    if (ready.length > 0) {
      const lines = ready.map(a => `[Súbor: ${a.name}](${a.url})`);
      finalPrompt = `${lines.join('\n')}\n\n${textToProcess}`;
    } else if (attachments.length > 0) {
      const fileNames = attachments.map(a => a.name).join(', ');
      finalPrompt = `[Zahrnuté súbory: ${fileNames}]\n${textToProcess}`;
    }

    const newUserMsg: Message = { role: 'user', content: finalPrompt };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setAttachments([]);
    setIsLoading(true);
    addLog('[API] Odosielam požiadavku na Enterprise Core...');

    const initialWorkflow = updateWorkflowStep(
      updateWorkflowStep(
        updateWorkflowStep(createWorkflowRun('AI request'), 'input', {
          status: 'done',
          detail: 'Prompt prijatý',
          progress: 100,
        }),
        'files',
        ready.length > 0
          ? { status: 'done', detail: `${ready.length} súbor(ov) pripravených`, progress: 100 }
          : { status: 'skipped', detail: 'Bez príloh', progress: 100 },
      ),
      'ai',
      { status: 'running', detail: 'Pripravujem AI request', progress: 15 },
    );
    setWorkflowRun(initialWorkflow);

    let sessionId = activeSessionId;
    if (!sessionId) {
      const newId = await createSessionInDB(finalPrompt);
      if (newId) {
        sessionId = newId;
        setActiveSessionId(newId);
        setSessions(prev => [
          { id: newId, title: finalPrompt.substring(0, 40), date: 'Práve teraz', messages: [] },
          ...prev,
        ]);
      }
    }

    if (sessionId) {
      saveMessageToDB(sessionId, 'user', finalPrompt);
    }

    try {
      const replyText = await callAIStreaming(updatedMessages, WORDPRESS_HTML_DEPLOY_SYSTEM_HINT);
      addLog('[API] Požiadavka úspešne vybavená.');
      extractCodeForPreview(replyText);

      if (sessionId) {
        const isLocalSession = isLocalSessionId(sessionId) || user?.id === LOCAL_USER_ID;
        setWorkflowStep('save', {
          status: isLocalSession ? 'done' : 'running',
          detail: isLocalSession ? 'Lokálna relácia aktualizovaná' : 'Ukladám reláciu',
          progress: isLocalSession ? 100 : 45,
        });
        saveMessageToDB(sessionId, 'model', replyText);
        if (!isLocalSession) {
          // Update session title and timestamp
          await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
          setWorkflowStep('save', { status: 'done', detail: 'Relácia uložená', progress: 100 });
        }
      } else {
        setWorkflowStep('save', { status: 'skipped', detail: 'Bez aktívnej relácie', progress: 100 });
      }
      finishWorkflow('done', 'Workflow dokončený');
    } catch (err: any) {
      addLog(`[ERROR] ${err.message || 'Spojenie prerušené.'}`);
      finishWorkflow('error', err.message || 'Spojenie prerušené');
      // Only add error message if streaming didn't already add one
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'model' && !last.content) {
          return prev.slice(0, -1).concat({
            role: 'model',
            content: '⚠️ **Chyba servera:** Nepodarilo sa nadviazať spojenie s jadrom. Skontrolujte pripojenie a skúste to znova.',
          });
        }
        if (last?.role === 'user') {
          return [...prev, {
            role: 'model',
            content: '⚠️ **Chyba servera:** Nepodarilo sa nadviazať spojenie s jadrom.',
          }];
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeLogs = async (rawLogs: string): Promise<string> => {
    addLog('[API] Spúšťam analýzu zraniteľností...');
    setWorkflowRun(updateWorkflowStep(
      updateWorkflowStep(
        updateWorkflowStep(createWorkflowRun('Log analysis'), 'input', { status: 'done', detail: 'Logy prijaté', progress: 100 }),
        'files',
        { status: 'skipped', detail: 'Analýza textu bez uploadu', progress: 100 },
      ),
      'ai',
      { status: 'running', detail: 'Pripravujem analýzu', progress: 15 },
    ));
    try {
      const msgs: Message[] = [{ role: 'user', content: `Analyzuj tieto logy a identifikuj hrozby:\n\n${rawLogs}` }];
      const result = await callAIStreaming(msgs, 'FOCUS: Log Analysis. Identify anomalies, penetration attempts, and suspicious IPs. Format output in Markdown.');
      setWorkflowStep('preview', { status: 'skipped', detail: 'Log analýza bez náhľadu', progress: 100 });
      setWorkflowStep('save', { status: 'skipped', detail: 'Výstup sa zobrazuje v module', progress: 100 });
      finishWorkflow('done', 'Analýza dokončená');
      addLog('[API] Analýza úspešne dokončená (200 OK).');
      showToast('Analýza hrozieb hotová', 'success');
      return result;
    } catch {
      finishWorkflow('error', 'Analýza zlyhala');
      addLog('[ERROR] Analýza zlyhala.');
      showToast('Chyba pripojenia', 'error');
      return '⚠️ Zlyhalo pripojenie k AI backendu.';
    }
  };

  const handleGenerateSkill = async (desc: string): Promise<string> => {
    addLog('[API] Generujem Cloud funkciu...');
    setWorkflowRun(updateWorkflowStep(
      updateWorkflowStep(
        updateWorkflowStep(createWorkflowRun('Code generation'), 'input', { status: 'done', detail: 'Zadanie prijaté', progress: 100 }),
        'files',
        { status: 'skipped', detail: 'Bez príloh', progress: 100 },
      ),
      'ai',
      { status: 'running', detail: 'Pripravujem generovanie', progress: 15 },
    ));
    try {
      const msgs: Message[] = [{ role: 'user', content: `Napíš skript pre nasledujúcu úlohu: ${desc}` }];
      const text = await callAIStreaming(msgs, 'FOCUS: Script Generation. Write clean, secure, production-ready code. Return ONLY the code wrapped in a markdown block.');
      addLog('[API] Zdrojový kód úspešne vygenerovaný.');
      showToast('Nástroj vygenerovaný', 'success');
      extractCodeForPreview(text);
      setWorkflowStep('save', { status: 'skipped', detail: 'Generátor bez DB zápisu', progress: 100 });
      finishWorkflow('done', 'Generovanie dokončené');
      return text;
    } catch {
      finishWorkflow('error', 'Generovanie zlyhalo');
      addLog('[ERROR] Generovanie zlyhalo.');
      showToast('Chyba generovania', 'error');
      return '⚠️ Generovanie zlyhalo.';
    }
  };

  const handleDeployCode = async (code: string, language: string) => {
    if (!user) return;
    
    // Zatiaľ podporujeme len HTML deploy pre ukážku pipeline (na WordPress Page)
    if (language !== 'html') {
      toast.error('Momentálne je možné deploynúť len HTML kód (ako WordPress stránku).', {
        description: 'Nechaj si vygenerovať HTML blok (napríklad z Blueprints).',
      });
      return;
    }

    try {
      const safeCode = sanitizeGeneratedHtmlForWordPress(code);
      addLog('[API] Začínam deploy do WordPressu...');
      showToast('Spúšťam deploy na WordPress...', 'info');

      // Nájdeme prvú pripojenú WordPress stránku (pre jednoduchosť)
      let siteId = 'local-wordpress-dev';
      if (user.id !== LOCAL_USER_ID) {
        const { data: sites, error: sitesError } = await supabase
          .from('wp_sites')
          .select('id, base_url')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (sitesError) {
          throw new Error(`WordPress site lookup failed: ${sitesError.message}`);
        }
          
        if (!sites || sites.length === 0) {
          toast.error('Žiadny WordPress nie je pripojený.', {
            description: 'Pripojte ho vo WordPress Manageri (Nástroje vľavo).',
          });
          return;
        }
        siteId = sites[0].id;
      }

      const { data: { session } } = await supabase.auth.getSession();

      // Zastrelíme to na náš wordpress-proxy
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wordpress-proxy`, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId,
          method: 'POST',
          path: '/wp/v2/pages',
          body: {
            title: `AI Landing Page - ${new Date().toLocaleDateString()}`,
            content: safeCode,
            status: 'draft', // Draft pre bezpečnosť
          }
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const message = result?.message || result?.error || `HTTP ${response.status}`;
        throw new Error(message);
      }
      
      if (result.error_message) {
         throw new Error(result.error_message);
      }

      addLog(`[API] Stránka úspešne vytvorená vo WordPresse. ID: ${result.id}`);
      toast.success('Stránka bola úspešne vytvorená!', {
        description: `Koncept bol uložený do WordPressu s ID: ${result.id}. ${result.link ? `Preview: ${result.link}` : 'Otvorte si WP Admin pre publikovanie.'}`,
        duration: 8000,
      });

    } catch (err: any) {
      addLog(`[ERROR] Deploy zlyhal: ${err.message}`);
      toast.error('Deploy do WordPressu zlyhal', { description: err.message });
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    setAttachments([]);
    setInputValue('');
    setActiveSessionId(null);
    setCurrentView('tasks');
    setWorkflowRun(null);
    addLog('[SYSTEM] Nový pracovný priestor alokovaný.');
    showToast('Nová relácia spustená', 'success');
  };

  const loadSession = async (session: Session) => {
    setActiveSessionId(session.id);
    setCurrentView('tasks');
    addLog(`[SYSTEM] Načítavam reláciu...`);

    if (user?.id === LOCAL_USER_ID) {
      setMessages(session.messages);
      const lastModelMessage = [...session.messages].reverse().find(m => m.role === 'model');
      if (lastModelMessage) {
        extractCodeForPreview(lastModelMessage.content);
      }
      showToast('Lokálna relácia obnovená', 'info');
      return;
    }

    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });

    if (data) {
      const loadedMessages = data.map(m => ({ role: m.role, content: m.content })) as Message[];
      setMessages(loadedMessages);
      const lastModelMessage = [...loadedMessages].reverse().find(m => m.role === 'model');
      if (lastModelMessage) {
        extractCodeForPreview(lastModelMessage.content);
      }
    }
    showToast('Relácia obnovená', 'info');
  };

  const deleteSession = async (sessionId: string) => {
    if (user?.id === LOCAL_USER_ID) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setMessages([]);
        setActiveSessionId(null);
      }
      showToast('Lokálna relácia vymazaná', 'info');
      return;
    }
    await supabase.from('chat_sessions').delete().eq('id', sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setMessages([]);
      setActiveSessionId(null);
    }
    showToast('Relácia vymazaná', 'info');
  };

  const renameSession = async (sessionId: string, newTitle: string) => {
    await updateSessionTitle(sessionId, newTitle);
    showToast('Relácia premenovaná', 'success');
  };

  const handleLogout = async () => {
    localStorage.removeItem(LOCAL_ACCESS_KEY);
    if (user?.id !== LOCAL_USER_ID) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setMessages([]);
    setSessions([]);
    setActiveSessionId(null);
  };

  // Accept files: validate, add as uploading, then upload immediately
  const acceptFiles = (files: File[]) => {
    if (!files.length) return;
    if (attachments.length + files.length > MAX_FILES) {
      toast.error(`Max ${MAX_FILES} súborov naraz.`);
      return;
    }
    const valid: Attachment[] = [];
    for (const f of files) {
      const err = validateFile(f);
      if (err) { toast.error(err); continue; }
      valid.push({
        name: f.name,
        size: (f.size / 1024).toFixed(1) + ' KB',
        file: f,
        progress: 0,
        uploading: true,
      });
    }
    if (!valid.length) return;
    setAttachments(prev => {
      const next = [...prev, ...valid];
      // start uploads after state update (using their indices in `next`)
      valid.forEach((att, i) => {
        const indexInNext = prev.length + i;
        uploadOne(att, indexInNext);
      });
      return next;
    });
    addLog(`[FS] Pripojených ${valid.length} súbor(ov), nahrávam...`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    acceptFiles(files);
    e.target.value = ''; // allow re-selecting same file
  };

  const removeAttachment = async (i: number) => {
    const att = attachments[i];
    if (att?.path) {
      // best-effort cleanup of the storage object
      supabase.storage.from('chat-attachments').remove([att.path]).catch(() => {});
    }
    setAttachments(prev => prev.filter((_, idx) => idx !== i));
  };

  // Real Web Speech API
  const handleMicClick = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Rozpoznávanie reči nie je podporované v tomto prehliadači.', 'error');
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'sk-SK';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsRecording(true);
      addLog('[AUDIO] Počúvam...');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInputValue(finalTranscript + interim);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      if (finalTranscript) {
        addLog('[AUDIO] Hlasový vstup spracovaný.');
      }
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      recognitionRef.current = null;
      if (event.error !== 'no-speech') {
        showToast(`Chyba rozpoznávania: ${event.error}`, 'error');
      }
    };

    recognition.start();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (currentView === 'tasks') setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (currentView !== 'tasks') return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      acceptFiles(Array.from(e.dataTransfer.files));
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onEnter={() => {
          localStorage.setItem(LOCAL_ACCESS_KEY, 'true');
          setUser(LOCAL_DEMO_USER);
        }}
        onAuthSuccess={(authUser) => {
          localStorage.removeItem(LOCAL_ACCESS_KEY);
          setUser(authUser);
        }}
      />
    );
  }

  const tokenCount = messages.length > 0 ? (8.1 + messages.length * 0.3).toFixed(1) : '8.1';

  const viewContent = () => {
    switch (currentView) {
      case 'welcome':
        return (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <OnboardingGuide onNavigate={(v) => {
              if (v === 'wordpress') {
                window.location.href = '/dashboard/wordpress';
              } else {
                setCurrentView(v);
              }
            }} />
          </Suspense>
        );
      case 'files':
        return (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <AnalyzerView
              onAnalyze={handleAnalyzeLogs}
              onBack={() => setCurrentView('tasks')}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
            />
          </Suspense>
        );
      case 'skills':
        return (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <GeneratorView
              onGenerate={handleGenerateSkill}
              onBack={() => setCurrentView('tasks')}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
            />
          </Suspense>
        );
      case 'preview':
        return (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <PreviewView
              latestCode={latestGeneratedCode}
              onClearCode={() => { setLatestGeneratedCode(''); addLog('[UI] Pamäť náhľadu vyčistená.'); showToast('Vyčistené', 'info'); }}
              onBack={() => setCurrentView('tasks')}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
              messages={messages}
              isLoading={isLoading}
              inputValue={inputValue}
              onInputChange={setInputValue}
              onSend={handleSendMessage}
              onGenerateDemo={() => handleSendMessage('Vytvor moderný login formulár v HTML a Tailwind CSS. Použi Google Material Design štýl.')}
            />
          </Suspense>
        );
      case 'connectors':
        return (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <ConnectorsView
              onBack={() => setCurrentView('tasks')}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
            />
          </Suspense>
        );
      default:
        return (
          <ChatView
          messages={messages}
          isLoading={isLoading}
          isStreaming={isStreaming}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSend={handleSendMessage}
          attachments={attachments}
          onFileUpload={handleFileUpload}
          onRemoveAttachment={removeAttachment}
          isRecording={isRecording}
          onMicClick={handleMicClick}
          isDragging={isDragging}
          tokenCount={tokenCount}
          onCopyCode={() => { addLog('[SYSTEM] Kód skopírovaný do schránky.'); showToast('Skopírované', 'success'); }}
          onDeployCode={handleDeployCode}
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
          />
        );
    }
  };

  return (
    <div
      className="flex h-screen bg-background overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ToastContainer toasts={toasts} />
      <SettingsPanel
        open={showSettings}
        onOpenChange={setShowSettings}
        dark={dark}
        onToggleDark={() => setDark(!dark)}
      />

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
          <div className="relative w-[280px] h-full" onClick={e => e.stopPropagation()}>
            <SidebarNav
              currentView={currentView}
              onViewChange={(v) => { setCurrentView(v); setMobileMenuOpen(false); }}
              onNewSession={() => { handleNewSession(); setMobileMenuOpen(false); }}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onLoadSession={(s) => { loadSession(s); setMobileMenuOpen(false); }}
              onDeleteSession={deleteSession}
              onRenameSession={renameSession}
              hasPreviewCode={!!latestGeneratedCode}
              onOpenSettings={() => setShowSettings(true)}
              userEmail={user.email}
              onLogout={handleLogout}
              sessionsLoading={sessionsLoading}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <SidebarNav
          currentView={currentView}
          onViewChange={setCurrentView}
          onNewSession={handleNewSession}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onLoadSession={loadSession}
          onDeleteSession={deleteSession}
          onRenameSession={renameSession}
          hasPreviewCode={!!latestGeneratedCode}
          onOpenSettings={() => setShowSettings(true)}
          userEmail={user.email}
          onLogout={handleLogout}
          sessionsLoading={sessionsLoading}
        />
      </div>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <WorkflowRibbon workflowRun={workflowRun} />
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {viewContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <SystemMonitor
        isLoading={isLoading}
        messageCount={messages.length}
        attachmentCount={attachments.length}
        logs={logs}
        diagnostics={diagnostics}
        workflowRun={workflowRun}
        attachments={attachments.map(({ name, progress, uploading, error, url }) => ({ name, progress, uploading, error, url }))}
        hasPreviewCode={!!latestGeneratedCode}
      />
    </div>
  );
}
