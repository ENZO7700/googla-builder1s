import { useEffect, useState } from 'react';
import { Layout, X, Loader2, Terminal, Send, ArrowLeft, Maximize2, Minimize2, FileArchive } from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';
import FileCanvas from './FileCanvas';
import { ArchiveFile } from '@/lib/archive/zipWorkspace';

interface Message {
  role: string;
  content: string;
}

interface PreviewViewProps {
  latestCode: string;
  onClearCode: () => void;
  messages: Message[];
  isLoading: boolean;
  inputValue: string;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  onGenerateDemo: () => void;
  onBack: () => void;
  /* archive / canvas */
  archiveName: string;
  archiveFiles: ArchiveFile[];
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
  onToggleFileSelected: (path: string) => void;
  onToggleAllFiles: (selected: boolean) => void;
  onChangeFileContent: (path: string, content: string) => void;
  onAskAgentAboutFile: (path: string) => void;
  onApplyAiCodeToFile: (path: string) => void;
  canApplyAiCode: boolean;
  onPreviewFile: (path: string) => void;
  onClearArchive: () => void;
}

export default function PreviewView(props: PreviewViewProps) {
  const {
    latestCode, onClearCode, messages, isLoading,
    inputValue, onInputChange, onSend, onGenerateDemo, onBack,
    archiveName, archiveFiles, activeFilePath,
  } = props;

  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'preview' | 'files'>('preview');

  // A freshly attached archive should surface itself.
  useEffect(() => {
    if (archiveFiles.length) setTab('files');
  }, [archiveFiles.length]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const header = (
    <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-border bg-accent flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onBack}
          aria-label="Späť na hlavnú stránku"
          className="flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 bg-card border border-border rounded-md text-foreground hover:bg-accent transition-colors font-medium shadow-sm"
        >
          <ArrowLeft size={14} /> Späť
        </button>
        <div className="flex items-center gap-2 text-foreground font-medium text-sm truncate">
          <Layout size={16} className="text-muted-foreground" /> Live Sandbox
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex items-center rounded-md border border-border overflow-hidden bg-card">
          <button
            onClick={() => setTab('preview')}
            className={`px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1 ${tab === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            <Layout size={12} /> Náhľad
          </button>
          <button
            onClick={() => setTab('files')}
            className={`px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1 ${tab === 'files' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            <FileArchive size={12} /> Súbory{archiveFiles.length ? ` (${archiveFiles.length})` : ''}
          </button>
        </div>

        {tab === 'preview' && latestCode && (
          <button
            onClick={onClearCode}
            className="text-[11px] px-2.5 py-1.5 bg-card border border-border text-muted-foreground rounded-md hover:bg-accent transition-colors font-medium flex items-center gap-1.5 shadow-sm"
          >
            <X size={13} /> Vyčistiť
          </button>
        )}

        <button
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? 'Obnoviť veľkosť náhľadu' : 'Maximalizovať náhľad'}
          title={expanded ? 'Obnoviť (Esc)' : 'Maximalizovať'}
          className="p-1.5 bg-card border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-sm"
        >
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );

  const body = (
    <div className="flex-1 relative bg-card min-h-0">
      {tab === 'files' ? (
        <div className="absolute inset-0">
          <FileCanvas
            archiveName={archiveName || 'archív'}
            files={archiveFiles}
            activePath={activeFilePath}
            onSelectFile={props.onSelectFile}
            onToggleSelected={props.onToggleFileSelected}
            onToggleAll={props.onToggleAllFiles}
            onChangeContent={props.onChangeFileContent}
            onAskAgent={props.onAskAgentAboutFile}
            onApplyAiCode={props.onApplyAiCodeToFile}
            canApplyAiCode={props.canApplyAiCode}
            onPreviewFile={(p) => { props.onPreviewFile(p); setTab('preview'); }}
            onClear={props.onClearArchive}
          />
        </div>
      ) : latestCode ? (
        <iframe
          srcDoc={latestCode}
          className="w-full h-full border-none absolute inset-0"
          sandbox="allow-scripts allow-modals allow-forms"
          title="Live Preview"
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full w-full text-muted-foreground p-8 text-center absolute inset-0">
          <Layout size={40} className="text-border mb-4" />
          <p className="text-lg text-foreground font-medium">Náhľad je prázdny</p>
          <p className="mt-2 text-sm max-w-sm mx-auto">
            Vygenerujte komponenty cez AI a systém ich tu automaticky vizualizuje.
          </p>
          <button
            onClick={onGenerateDemo}
            className="mt-6 px-6 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-full text-[13px] font-medium shadow-sm transition-colors"
          >
            Generovať demo formulár
          </button>
        </div>
      )}
    </div>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {header}
        {body}
      </div>
    );
  }

  return (
    <div className="flex-1 flex p-4 w-full relative z-10 overflow-hidden gap-4 min-h-0">
      {/* Left chat panel */}
      <div className="w-[30%] flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden hidden lg:flex min-h-0">
        <div className="p-4 border-b border-border flex items-center gap-2 bg-accent">
          <Terminal size={18} className="text-muted-foreground" />
          <span className="font-medium text-foreground text-sm">Interakcia</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-[13px] shadow-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-accent text-foreground border border-border rounded-tl-sm'
              }`}>
                {msg.role === 'user' ? (
                  <span className="line-clamp-3">{msg.content}</span>
                ) : (
                  <div className="text-xs max-h-24 overflow-hidden">
                    <MarkdownRenderer content={msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : '')} />
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="text-muted-foreground text-xs flex items-center gap-2 px-2">
              <Loader2 size={14} className="animate-spin text-primary" /> Spracovávam...
            </div>
          )}
        </div>
        <div className="p-3 border-t border-border bg-card">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSend()}
              placeholder="Upravte dizajn..."
              className="flex-1 bg-accent border border-border rounded-full px-4 py-2 text-[13px] text-foreground outline-none focus:border-primary"
            />
            <button onClick={() => onSend()} aria-label="Odoslať" className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-google-blue-hover">
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Right preview */}
      <div className="flex-1 h-full flex flex-col relative bg-card rounded-2xl shadow-sm border border-border overflow-hidden min-h-0">
        {header}
        {body}
      </div>
    </div>
  );
}
