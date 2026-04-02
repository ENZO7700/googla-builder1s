import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import LoginScreen from '@/components/LoginScreen';
import SidebarNav, { Session } from '@/components/workspace/SidebarNav';
import SystemMonitor from '@/components/workspace/SystemMonitor';
import ChatView from '@/components/workspace/ChatView';
import AnalyzerView from '@/components/workspace/AnalyzerView';
import GeneratorView from '@/components/workspace/GeneratorView';
import PreviewView from '@/components/workspace/PreviewView';
import ConnectorsView from '@/components/workspace/ConnectorsView';
import ToastContainer, { Toast } from '@/components/workspace/ToastContainer';

interface Message {
  role: string;
  content: string;
}

interface Attachment {
  name: string;
  size: string;
}

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    if (!user) return;
    const loadSessions = async () => {
      const { data } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(20);
      if (data) {
        setSessions(data.map(s => ({
          id: s.id,
          title: s.title,
          date: new Date(s.created_at).toLocaleDateString('sk'),
          messages: [],
        })));
      }
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
    setLogs(prev => [...prev.slice(-20), msg]);
  }, []);

  // Background log simulation
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (!isLoading && Math.random() > 0.85) {
        const fakeLogs = [
          '[MONITOR] IAM role synchronizované.',
          '[SYSTEM] Telemetrické dáta odoslané do Cloud Logging.',
          '[NET] PING us-central1: 22ms.',
          '[AGENT] Health check: Všetky služby funkčné.',
        ];
        addLog(fakeLogs[Math.floor(Math.random() * fakeLogs.length)]);
      }
    }, 4000);
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

  // Save message to DB
  const saveMessageToDB = async (sessionId: string, role: string, content: string) => {
    if (!user) return;
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role,
      content,
    });
  };

  // Create session in DB
  const createSessionInDB = async (title: string): Promise<string | null> => {
    if (!user) return null;
    const { data } = await supabase.from('chat_sessions').insert({
      user_id: user.id,
      title: title.substring(0, 30),
    }).select('id').single();
    return data?.id ?? null;
  };

  // Streaming AI call
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
      body: JSON.stringify({ messages: msgs, systemOverride }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'AI gateway error');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No stream');
    const decoder = new TextDecoder();
    let fullText = '';
    setIsStreaming(true);

    // Add empty model message
    setMessages(prev => [...prev, { role: 'model', content: '' }]);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'model', content: fullText };
                return updated;
              });
            }
          } catch {}
        }
      }
    } finally {
      setIsStreaming(false);
    }

    return fullText;
  };

  const handleSendMessage = async (textToProcess: string = inputValue) => {
    if (!textToProcess.trim() && attachments.length === 0) return;

    let finalPrompt = textToProcess;
    if (attachments.length > 0) {
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

    // Create session if needed
    let sessionId = activeSessionId;
    if (!sessionId) {
      const newId = await createSessionInDB(finalPrompt);
      if (newId) {
        sessionId = newId;
        setActiveSessionId(newId);
        setSessions(prev => [
          { id: newId, title: finalPrompt.substring(0, 30), date: 'Práve teraz', messages: [] },
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
      }
    } catch (err: any) {
      addLog(`[ERROR] ${err.message || 'Spojenie prerušené.'}`);
      setMessages(prev => [
        ...prev,
        { role: 'model', content: '⚠️ **Chyba servera:** Nepodarilo sa nadviazať spojenie s jadrom. Skontrolujte pripojenie a skúste to znova.' },
      ]);
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
      addLog('[ERROR] Analýza zlyhala: Cloud API nedostupné.');
      showToast('Chyba pripojenia', 'error');
      return '⚠️ Zlyhalo pripojenie k AI backendu. Skúste to prosím neskôr.';
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMessages([]);
    setSessions([]);
    setActiveSessionId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newAttachments = files.map(f => ({ name: f.name, size: (f.size / 1024).toFixed(1) + ' KB' }));
      setAttachments(prev => [...prev, ...newAttachments]);
      addLog(`[FS] Súbor nahraný: ${files[0].name}`);
    }
  };

  const simulateMicRecording = () => {
    if (isRecording) return;
    setIsRecording(true);
    addLog('[AUDIO] Počúvam...');
    setInputValue('Prebieha rozpoznávanie reči...');
    setTimeout(() => {
      setIsRecording(false);
      setInputValue('Vygeneruj komplexný theme.json s definíciou rozmerov (layout, spacing) a vlastných farebných formátov pre WordPress.');
      addLog('[AUDIO] Hlasový vstup úspešne spracovaný.');
    }, 2500);
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
      const newAttachments = droppedFiles.map(f => ({ name: f.name, size: (f.size / 1024).toFixed(1) + ' KB' }));
      setAttachments(prev => [...prev, ...newAttachments]);
      addLog(`[FS] Súbory nahrané do Cloud Storage: ${droppedFiles.length}`);
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

  return (
    <div
      className="flex h-screen bg-background overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ToastContainer toasts={toasts} />

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
              hasPreviewCode={!!latestGeneratedCode}
              onOpenSettings={() => setShowSettings(!showSettings)}
              userEmail={user.email}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <SidebarNav
        currentView={currentView}
        onViewChange={setCurrentView}
        onNewSession={handleNewSession}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onLoadSession={loadSession}
        onDeleteSession={deleteSession}
        hasPreviewCode={!!latestGeneratedCode}
        onOpenSettings={() => setShowSettings(!showSettings)}
        userEmail={user.email}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {currentView === 'files' ? (
          <div className="animate-fade-in flex-1 flex flex-col">
            <AnalyzerView onAnalyze={handleAnalyzeLogs} />
          </div>
        ) : currentView === 'skills' ? (
          <div className="animate-fade-in flex-1 flex flex-col">
            <GeneratorView onGenerate={handleGenerateSkill} />
          </div>
        ) : currentView === 'preview' ? (
          <PreviewView
            latestCode={latestGeneratedCode}
            onClearCode={() => { setLatestGeneratedCode(''); addLog('[UI] Pamäť náhľadu vyčistená.'); showToast('Vyčistené', 'info'); }}
            messages={messages}
            isLoading={isLoading}
            inputValue={inputValue}
            onInputChange={setInputValue}
            onSend={handleSendMessage}
            onGenerateDemo={() => handleSendMessage('Vytvor moderný login formulár v HTML a Tailwind CSS. Použi Google Material Design štýl (biela, modrá, zaoblené rohy).')}
          />
        ) : currentView === 'connectors' ? (
          <div className="animate-fade-in flex-1 flex flex-col">
            <ConnectorsView onBack={() => setCurrentView('tasks')} />
          </div>
        ) : (
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
            onMicClick={simulateMicRecording}
            isDragging={isDragging}
            tokenCount={tokenCount}
            onCopyCode={() => { addLog('[SYSTEM] Kód skopírovaný do schránky.'); showToast('Skopírované', 'success'); }}
            onToggleMobileMenu={() => setMobileMenuOpen(true)}
          />
        )}
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
