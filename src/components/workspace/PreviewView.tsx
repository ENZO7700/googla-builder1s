import { useState } from 'react';
import { ArrowLeft, Layout, Menu, X, Loader2, Terminal, Send } from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Message {
  role: string;
  content: string;
}

interface PreviewViewProps {
  latestCode: string;
  onClearCode: () => void;
  onBack: () => void;
  onOpenMobileMenu?: () => void;
  messages: Message[];
  isLoading: boolean;
  inputValue: string;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  onGenerateDemo: () => void;
}

function ChatPanel({
  messages,
  isLoading,
  inputValue,
  onInputChange,
  onSend,
  className = '',
}: {
  messages: Message[];
  isLoading: boolean;
  inputValue: string;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden ${className}`}>
      <div className="p-4 border-b border-border flex items-center gap-2 bg-accent">
        <Terminal size={18} className="text-muted-foreground" />
        <span className="font-medium text-foreground text-sm">Interakcia</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide min-h-0">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-[13px] shadow-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-accent text-foreground border border-border rounded-tl-sm'
            }`}>
              {msg.role === 'user' ? (
                <span className="whitespace-pre-wrap break-words">{msg.content}</span>
              ) : (
                <div className="text-xs max-h-48 overflow-y-auto scrollbar-hide">
                  <MarkdownRenderer content={msg.content} />
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
          <button onClick={() => onSend()} className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-google-blue-hover">
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({
  latestCode,
  onClearCode,
  onBack,
  onOpenMobileMenu,
  onGenerateDemo,
}: {
  latestCode: string;
  onClearCode: () => void;
  onBack: () => void;
  onOpenMobileMenu?: () => void;
  onGenerateDemo: () => void;
}) {
  return (
    <div className="flex-1 h-full flex flex-col relative bg-card rounded-2xl shadow-sm border border-border overflow-hidden min-h-0">
      <div className="px-4 py-3 flex flex-col gap-3 border-b border-border bg-accent sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-foreground font-medium text-sm">
          <Layout size={16} className="text-muted-foreground" /> Live Sandbox
        </div>
        <div className="flex flex-wrap gap-2">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground lg:hidden"
            >
              <Menu size={14} />
              Nástroje
            </button>
          )}
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Späť
          </button>
          {latestCode && (
            <button
              onClick={onClearCode}
              className="text-[11px] px-3 py-1.5 bg-card border border-border text-muted-foreground rounded-md hover:bg-accent transition-colors font-medium flex items-center gap-1.5 shadow-sm"
            >
              <X size={14} /> Vyčistiť
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 relative bg-card min-h-0">
        {latestCode ? (
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
    </div>
  );
}

export default function PreviewView({
  latestCode, onClearCode, onBack, onOpenMobileMenu, messages, isLoading,
  inputValue, onInputChange, onSend, onGenerateDemo
}: PreviewViewProps) {
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('preview');

  return (
    <div className="flex-1 flex flex-col lg:flex-row p-4 w-full relative z-10 overflow-hidden gap-4 min-h-0">
      {/* Desktop: side-by-side chat */}
      <ChatPanel
        messages={messages}
        isLoading={isLoading}
        inputValue={inputValue}
        onInputChange={onInputChange}
        onSend={onSend}
        className="hidden lg:flex w-[30%] min-h-0"
      />

      {/* Mobile: tabs for chat + preview */}
      <div className="flex flex-col flex-1 min-h-0 lg:hidden">
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as 'chat' | 'preview')} className="flex flex-col flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-2 mb-3 shrink-0">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="preview">Náhľad</TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
            <ChatPanel
              messages={messages}
              isLoading={isLoading}
              inputValue={inputValue}
              onInputChange={onInputChange}
              onSend={onSend}
              className="h-full min-h-[280px]"
            />
          </TabsContent>
          <TabsContent value="preview" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden flex flex-col">
            <PreviewPanel
              latestCode={latestCode}
              onClearCode={onClearCode}
              onBack={onBack}
              onOpenMobileMenu={onOpenMobileMenu}
              onGenerateDemo={onGenerateDemo}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: preview panel */}
      <div className="hidden lg:flex flex-1 min-h-0">
        <PreviewPanel
          latestCode={latestCode}
          onClearCode={onClearCode}
          onBack={onBack}
          onOpenMobileMenu={onOpenMobileMenu}
          onGenerateDemo={onGenerateDemo}
        />
      </div>
    </div>
  );
}
