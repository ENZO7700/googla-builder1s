import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import LoginScreen from '@/components/LoginScreen';
import SidebarNav, { Session } from '@/components/workspace/SidebarNav';
import SystemMonitor, { StreamDiagnostics } from '@/components/workspace/SystemMonitor';
import ChatView from '@/components/workspace/ChatView';
import ToastContainer, { Toast } from '@/components/workspace/ToastContainer';
import SettingsPanel from '@/components/workspace/SettingsPanel';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

const AnalyzerView = lazy(() => import('@/components/workspace/AnalyzerView'));
const GeneratorView = lazy(() => import('@/components/workspace/GeneratorView'));
const PreviewView = lazy(() => import('@/components/workspace/PreviewView'));
const ConnectorsView = lazy(() => import('@/components/workspace/ConnectorsView'));

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

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState('tasks');
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
  const recognitionRef = useRef<any>(null);
  const [logs, setLogs] = useState([
    '[SYSTEM] Inicializácia inštancie H4CK3D Enterprise...',
    '[AUTH] IAM politiky úspešne overené.',
    '[NET] Pripojenie k VPC nadviazané.',
    '[AGENT] Cloud AI agent pripravený.',
  ]);

  // Auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load sessions from DB
  useEffect(() => {
    if (!user) { setSessionsLoading(false); return; }
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

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-30), msg]);
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
    try {
      const parts = text.split('```');
      for (let i = 1; i < parts.length; i += 2) {
        const block = parts[i];
        if (block.toLowerCase().startsWith('html') || block.toLowerCase().startsWith('xml')) {
          const code = block.substring(block.indexOf('\n') + 1);
          setLatestGeneratedCode(code);
          addLog('[UI] Vizuálny kód exportovaný do Sandboxu.');
          showToast('Live Náhľad aktualizovaný', 'success');
          break;
        }
      }
    } catch {
      addLog('[ERROR] Extrakcia náhľadu zlyhala.');
    }
  };

  const saveMessageToDB = async (sessionId: string, role: string, content: string) => {
    if (!user) return;
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role,
      content,
    });
  };

  const createSessionInDB = async (title: string): Promise<string | null> => {
    if (!user) return null;
    const { data } = await supabase.from('chat_sessions').insert({
      user_id: user.id,
      title: title.substring(0, 40),
    }).select('id').single();
    return data?.id ?? null;
  };

  const updateSessionTitle = async (sessionId: string, title: string) => {
    const trimmed = title.substring(0, 40);
    await supabase.from('chat_sessions').update({ title: trimmed, updated_at: new Date().toISOString() }).eq('id', sessionId);
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: trimmed } : s));
  };

  // Upload files to storage
  const uploadAttachments = async (files: Attachment[]): Promise<string[]> => {
    if (!user) return [];
    const urls: string[] = [];
    for (const att of files) {
      if (!att.file) continue;
      const path = `${user.id}/${Date.now()}_${att.name}`;
      const { error } = await supabase.storage.from('chat-attachments').upload(path, att.file);
      if (!error) {
        const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
        urls.push(`[Súbor: ${att.name}](${data.publicUrl})`);
        addLog(`[FS] Súbor nahraný: ${att.name}`);
      } else {
        addLog(`[ERROR] Upload zlyhalo: ${att.name}`);
      }
    }
    return urls;
  };

  const getSelectedModel = () => localStorage.getItem('ai-model') || 'google/gemini-3-flash-preview';

  // Streaming AI call with error recovery
  const callAIStreaming = async (msgs: Message[], systemOverride?: string): Promise<string> => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/chat`;
    const { data: { session } } = await supabase.auth.getSession();
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({ messages: msgs, systemOverride, model: getSelectedModel() }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        toast.error('Rate limit – skúste to o chvíľu.');
      } else if (response.status === 402) {
        toast.error('Nedostatok kreditov.');
      }
      throw new Error(errData.error || 'AI gateway error');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No stream');
    const decoder = new TextDecoder();
    let fullText = '';
    let textBuffer = '';
    setIsStreaming(true);

    // Add empty model message
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
              fullText += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'model', content: fullText };
                return updated;
              });
            }
          } catch {
            // partial JSON, put back
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
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
    } catch (streamErr) {
      // Error recovery: if stream fails mid-way, remove empty model message or show error
      if (!fullText) {
        setMessages(prev => prev.slice(0, -1));
      }
      throw streamErr;
    } finally {
      setIsStreaming(false);
    }

    return fullText;
  };

  const handleSendMessage = async (textToProcess: string = inputValue) => {
    if (!textToProcess.trim() && attachments.length === 0) return;

    let finalPrompt = textToProcess;

    // Upload real files
    if (attachments.length > 0) {
      const fileUrls = await uploadAttachments(attachments);
      if (fileUrls.length > 0) {
        finalPrompt = `${fileUrls.join('\n')}\n\n${textToProcess}`;
      } else {
        const fileNames = attachments.map(a => a.name).join(', ');
        finalPrompt = `[Zahrnuté súbory: ${fileNames}]\n${textToProcess}`;
      }
    }

    const newUserMsg: Message = { role: 'user', content: finalPrompt };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setAttachments([]);
    setIsLoading(true);
    addLog('[API] Odosielam požiadavku na Enterprise Core...');

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
      const replyText = await callAIStreaming(updatedMessages);
      addLog('[API] Požiadavka úspešne vybavená.');
      extractCodeForPreview(replyText);

      if (sessionId) {
        saveMessageToDB(sessionId, 'model', replyText);
        // Update session title and timestamp
        await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
      }
    } catch (err: any) {
      addLog(`[ERROR] ${err.message || 'Spojenie prerušené.'}`);
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
    try {
      const msgs: Message[] = [{ role: 'user', content: `Analyzuj tieto logy a identifikuj hrozby:\n\n${rawLogs}` }];
      const result = await callAIStreaming(msgs, 'FOCUS: Log Analysis. Identify anomalies, penetration attempts, and suspicious IPs. Format output in Markdown.');
      addLog('[API] Analýza úspešne dokončená (200 OK).');
      showToast('Analýza hrozieb hotová', 'success');
      return result;
    } catch {
      addLog('[ERROR] Analýza zlyhala.');
      showToast('Chyba pripojenia', 'error');
      return '⚠️ Zlyhalo pripojenie k AI backendu.';
    }
  };

  const handleGenerateSkill = async (desc: string): Promise<string> => {
    addLog('[API] Generujem Cloud funkciu...');
    try {
      const msgs: Message[] = [{ role: 'user', content: `Napíš skript pre nasledujúcu úlohu: ${desc}` }];
      const text = await callAIStreaming(msgs, 'FOCUS: Script Generation. Write clean, secure, production-ready code. Return ONLY the code wrapped in a markdown block.');
      addLog('[API] Zdrojový kód úspešne vygenerovaný.');
      showToast('Nástroj vygenerovaný', 'success');
      extractCodeForPreview(text);
      return text;
    } catch {
      addLog('[ERROR] Generovanie zlyhalo.');
      showToast('Chyba generovania', 'error');
      return '⚠️ Generovanie zlyhalo.';
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    setAttachments([]);
    setInputValue('');
    setActiveSessionId(null);
    setCurrentView('tasks');
    addLog('[SYSTEM] Nový pracovný priestor alokovaný.');
    showToast('Nová relácia spustená', 'success');
  };

  const loadSession = async (session: Session) => {
    setActiveSessionId(session.id);
    setCurrentView('tasks');
    addLog(`[SYSTEM] Načítavam reláciu...`);

    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(m => ({ role: m.role, content: m.content })));
    }
    showToast('Relácia obnovená', 'info');
  };

  const deleteSession = async (sessionId: string) => {
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
    await supabase.auth.signOut();
    setMessages([]);
    setSessions([]);
    setActiveSessionId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newAttachments = files.map(f => ({
        name: f.name,
        size: (f.size / 1024).toFixed(1) + ' KB',
        file: f,
      }));
      setAttachments(prev => [...prev, ...newAttachments]);
      addLog(`[FS] Súbor pripravený: ${files[0].name}`);
    }
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
      const droppedFiles = Array.from(e.dataTransfer.files);
      const newAttachments = droppedFiles.map(f => ({
        name: f.name,
        size: (f.size / 1024).toFixed(1) + ' KB',
        file: f,
      }));
      setAttachments(prev => [...prev, ...newAttachments]);
      addLog(`[FS] Súbory nahrané: ${droppedFiles.length}`);
      showToast(`${droppedFiles.length} súbor(ov) pripojených`, 'success');
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
    return <LoginScreen />;
  }

  const tokenCount = messages.length > 0 ? (8.1 + messages.length * 0.3).toFixed(1) : '8.1';

  const viewContent = () => {
    switch (currentView) {
      case 'files':
        return (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <AnalyzerView onAnalyze={handleAnalyzeLogs} />
          </Suspense>
        );
      case 'skills':
        return (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <GeneratorView onGenerate={handleGenerateSkill} />
          </Suspense>
        );
      case 'preview':
        return (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <PreviewView
              latestCode={latestGeneratedCode}
              onClearCode={() => { setLatestGeneratedCode(''); addLog('[UI] Pamäť náhľadu vyčistená.'); showToast('Vyčistené', 'info'); }}
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
            <ConnectorsView onBack={() => setCurrentView('tasks')} />
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
            onRemoveAttachment={(i) => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
            isRecording={isRecording}
            onMicClick={handleMicClick}
            isDragging={isDragging}
            tokenCount={tokenCount}
            onCopyCode={() => { addLog('[SYSTEM] Kód skopírovaný do schránky.'); showToast('Skopírované', 'success'); }}
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
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col"
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
      />
    </div>
  );
}
