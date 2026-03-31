import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

const callAI = async (prompt: string, systemOverride?: string): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('chat', {
    body: { prompt, systemOverride },
  });

  if (error) throw error;

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.text || 'Žiadna odpoveď zo servera.';
};

export default function Index() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState('tasks');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [latestGeneratedCode, setLatestGeneratedCode] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([
    { id: 1, title: 'Analýza Nginx Logov', date: 'Dnes, 10:42', messages: [] },
    { id: 2, title: 'Docker Compose Setup', date: 'Včera, 15:20', messages: [] },
  ]);
  const [logs, setLogs] = useState([
    '[SYSTEM] Inicializácia inštancie H4CK3D Enterprise...',
    '[AUTH] IAM politiky úspešne overené.',
    '[NET] Pripojenie k VPC nadviazané.',
    '[AGENT] Cloud AI agent pripravený.',
  ]);

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
    if (!isLoggedIn) return;
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
  }, [isLoading, isLoggedIn, addLog]);

  const callAILocal = async (prompt: string, systemOverride?: string): Promise<string> => {
    return await callAI(prompt, systemOverride);
  };

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

  const handleSendMessage = async (textToProcess: string = inputValue) => {
    if (!textToProcess.trim() && attachments.length === 0) return;

    let finalPrompt = textToProcess;
    if (attachments.length > 0) {
      const fileNames = attachments.map(a => a.name).join(', ');
      finalPrompt = `[Zahrnuté súbory: ${fileNames}]\n${textToProcess}`;
    }

    setMessages(prev => [...prev, { role: 'user', content: finalPrompt }]);
    setInputValue('');
    setAttachments([]);
    setIsLoading(true);
    addLog('[API] Odosielam požiadavku na Enterprise Core...');

    try {
      const replyText = await callAI(finalPrompt);
      setMessages(prev => [...prev, { role: 'model', content: replyText }]);
      addLog('[API] Požiadavka úspešne vybavená.');
      extractCodeForPreview(replyText);
    } catch {
      addLog('[ERROR] Spojenie prerušené (504 Gateway Timeout).');
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
      const result = await callAI(
        `Analyzuj tieto logy a identifikuj hrozby:\n\n${rawLogs}`,
        'FOCUS: Log Analysis. Identify anomalies, penetration attempts, and suspicious IPs. Format output in Markdown.'
      );
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
      const text = await callAI(
        `Napíš skript pre nasledujúcu úlohu: ${desc}`,
        'FOCUS: Script Generation. Write clean, secure, production-ready code. Return ONLY the code wrapped in a markdown block.'
      );
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
    if (messages.length > 0 && activeSessionId) {
      setSessions(prev => prev.map(s => (s.id === activeSessionId ? { ...s, messages: [...messages] } : s)));
    } else if (messages.length > 0) {
      const newId = Date.now();
      setSessions(prev => [
        { id: newId, title: messages[0].content.substring(0, 20) + '...', date: 'Práve teraz', messages: [...messages] },
        ...prev,
      ]);
    }
    setMessages([]);
    setAttachments([]);
    setInputValue('');
    setActiveSessionId(null);
    setCurrentView('tasks');
    addLog('[SYSTEM] Nový pracovný priestor alokovaný.');
    showToast('Nová relácia spustená', 'success');
  };

  const loadSession = (session: Session) => {
    setMessages(session.messages || []);
    setActiveSessionId(session.id);
    setCurrentView('tasks');
    addLog(`[SYSTEM] Relácia ${session.id} načítaná.`);
    showToast('Relácia obnovená', 'info');
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

  if (!isLoggedIn) {
    return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;
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

      <SidebarNav
        currentView={currentView}
        onViewChange={setCurrentView}
        onNewSession={handleNewSession}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onLoadSession={loadSession}
        hasPreviewCode={!!latestGeneratedCode}
        onOpenSettings={() => setShowSettings(!showSettings)}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {currentView === 'files' ? (
          <AnalyzerView onAnalyze={handleAnalyzeLogs} />
        ) : currentView === 'skills' ? (
          <GeneratorView onGenerate={handleGenerateSkill} />
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
          <ConnectorsView onBack={() => setCurrentView('tasks')} />
        ) : (
          <ChatView
            messages={messages}
            isLoading={isLoading}
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
