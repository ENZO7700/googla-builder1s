import { useEffect, useState } from 'react';
import { Layout, X, Loader2, Terminal, Send, ArrowLeft, Maximize2, Minimize2, FileArchive } from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';
import FileCanvas from './FileCanvas';
import { ArchiveFile } from '@/lib/archive/zipWorkspace';
import { Button } from '@/components/ui/button';

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
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 sm:px-4 lg:px-6">
      <div className="flex items-center gap-2 min-w-0">
        <Button
          onClick={onBack}
          aria-label="Späť na hlavnú stránku"
          variant="outline"
          size="sm"
          className="shrink-0"
        >
          <ArrowLeft size={14} /> Späť
        </Button>
        <div className="flex items-center gap-2 text-foreground font-medium text-sm truncate">
          <Layout size={16} className="text-muted-foreground" /> Live Sandbox
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
        <div className="flex h-9 shrink-0 items-center overflow-hidden rounded-md border border-border bg-background p-0.5">
          <Button
            onClick={() => setTab('preview')}
            variant={tab === 'preview' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2.5 text-xs"
            aria-pressed={tab === 'preview'}
          >
            <Layout size={12} /> Náhľad
          </Button>
          <Button
            onClick={() => setTab('files')}
            variant={tab === 'files' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2.5 text-xs"
            aria-pressed={tab === 'files'}
          >
            <FileArchive size={12} /> Súbory{archiveFiles.length ? ` (${archiveFiles.length})` : ''}
          </Button>
        </div>

        {tab === 'preview' && latestCode && (
          <Button
            onClick={onClearCode}
            variant="outline"
            size="sm"
            className="shrink-0 text-xs"
          >
            <X size={13} /> Vyčistiť
          </Button>
        )}

        <Button
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? 'Obnoviť veľkosť náhľadu' : 'Maximalizovať náhľad'}
          title={expanded ? 'Obnoviť (Esc)' : 'Maximalizovať'}
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
        >
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </Button>
      </div>
    </header>
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
          <Button
            onClick={onGenerateDemo}
            variant="outline"
            className="mt-6"
          >
            Generovať demo formulár
          </Button>
        </div>
      )}
    </div>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background">
        {header}
        {body}
      </div>
    );
  }

  return (
    <div className="relative z-10 flex h-full min-h-0 w-full flex-1 overflow-hidden bg-background">
      {/* Left chat panel */}
      <aside className="hidden w-[340px] shrink-0 flex-col overflow-hidden border-r border-border bg-card lg:flex min-h-0">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
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
              className="h-10 min-w-0 flex-1 rounded-md border border-border bg-accent px-3 text-[13px] text-foreground outline-none focus:border-primary"
            />
            <Button onClick={() => onSend()} aria-label="Odoslať" size="icon" className="h-10 w-10 shrink-0">
              <Send size={14} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Right preview */}
      <section className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card">
        {header}
        {body}
      </section>
    </div>
  );
}
