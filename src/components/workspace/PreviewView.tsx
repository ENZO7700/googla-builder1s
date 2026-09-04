import { useState } from 'react';
import { ArrowLeft, Layout, Menu, X, Loader2, Terminal, Send, Sparkles, Code2, AlertCircle } from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AiErrorBanner from '@/components/workspace/AiErrorBanner';
import type { AiErrorCopy } from '@/lib/aiErrorCopy';

const PREVIEW_DEMO_HTML = `<style>
  .wpbox-preview-demo{font-family:system-ui,sans-serif;padding:32px;background:linear-gradient(135deg,#f8fafc,#eef2ff);min-height:100%}
  .wpbox-preview-demo h1{font-size:1.75rem;margin:0 0 8px;color:#0f172a}
  .wpbox-preview-demo p{color:#475569;line-height:1.6;margin:0 0 20px}
  .wpbox-preview-demo .card{background:#fff;border-radius:16px;padding:20px;border:1px solid #e2e8f0;max-width:360px}
  .wpbox-preview-demo .cta{display:inline-block;margin-top:12px;padding:10px 18px;background:#0f766e;color:#fff;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px}
</style>
<div class="wpbox-preview-demo">
  <div class="card">
    <h1>Ukážkový landing blok</h1>
    <p>Toto je statická demo ukážka náhľadu. Skutočný HTML vygenerujte v Chate alebo Generátore — wpBOX ho sem automaticky zobrazí.</p>
    <a class="cta" href="#">Kontaktovať nás</a>
  </div>
</div>`;

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
  aiError?: AiErrorCopy | null;
  onOpenSettings?: () => void;
  onNavigateToChat?: () => void;
  onNavigateToGenerator?: () => void;
}

function ChatPanel({
  messages,
  isLoading,
  inputValue,
  onInputChange,
  onSend,
  aiError,
  onOpenSettings,
  className = '',
}: {
  messages: Message[];
  isLoading: boolean;
  inputValue: string;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  aiError?: AiErrorCopy | null;
  onOpenSettings?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden ${className}`}>
      <div className="p-4 border-b border-border flex items-center gap-2 bg-accent">
        <Terminal size={18} className="text-muted-foreground" />
        <span className="font-medium text-foreground text-sm">Interakcia</span>
      </div>
      {aiError && (
        <div className="p-3 border-b border-border">
          <AiErrorBanner error={aiError} onOpenSettings={onOpenSettings} className="py-3" />
        </div>
      )}
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
  aiError,
  onNavigateToChat,
  onNavigateToGenerator,
}: {
  latestCode: string;
  onClearCode: () => void;
  onBack: () => void;
  onOpenMobileMenu?: () => void;
  onGenerateDemo: () => void;
  aiError?: AiErrorCopy | null;
  onNavigateToChat?: () => void;
  onNavigateToGenerator?: () => void;
}) {
  const previewHtml = latestCode || PREVIEW_DEMO_HTML;
  const isEmpty = !latestCode;

  return (
    <div className="flex-1 h-full flex flex-col relative bg-card rounded-2xl shadow-sm border border-border overflow-hidden min-h-0">
      <div className="px-4 py-3 flex flex-col gap-3 border-b border-border bg-accent sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-foreground font-medium text-sm">
          <Layout size={16} className="text-muted-foreground" /> Live Sandbox
          {isEmpty && (
            <span className="text-[10px] font-normal text-muted-foreground rounded-full border border-border px-2 py-0.5">
              demo ukážka
            </span>
          )}
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

      {aiError && (
        <div className="px-4 py-2 border-b border-destructive/20 bg-destructive/5">
          <div className="flex items-start gap-2 text-[11px] text-destructive">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{aiError.title}</p>
              <p className="text-destructive/80">{aiError.action}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 relative bg-card min-h-0">
        <iframe
          srcDoc={previewHtml}
          className="w-full h-full border-none absolute inset-0"
          sandbox="allow-scripts allow-modals allow-forms"
          title="Live Preview"
        />
        {isEmpty && (
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-background via-background/95 to-transparent">
            <div className="mx-auto max-w-md text-center space-y-3">
              <p className="text-sm text-foreground font-medium">Vygenerujte HTML v Chate alebo Generátore</p>
              <p className="text-xs text-muted-foreground">
                wpBOX automaticky extrahuje HTML blok a zobrazí ho v tomto sandboxe.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {onNavigateToChat && (
                  <button
                    type="button"
                    onClick={onNavigateToChat}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors shadow-sm"
                  >
                    <Sparkles size={14} />
                    Otvoriť Chat
                  </button>
                )}
                {onNavigateToGenerator && (
                  <button
                    type="button"
                    onClick={onNavigateToGenerator}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors shadow-sm"
                  >
                    <Code2 size={14} />
                    Otvoriť Generátor
                  </button>
                )}
                <button
                  type="button"
                  onClick={onGenerateDemo}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-google-blue-hover transition-colors shadow-sm"
                >
                  Vygeneruj cez AI
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PreviewView({
  latestCode, onClearCode, onBack, onOpenMobileMenu, messages, isLoading,
  inputValue, onInputChange, onSend, onGenerateDemo,
  aiError, onOpenSettings, onNavigateToChat, onNavigateToGenerator,
}: PreviewViewProps) {
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('preview');

  return (
    <div className="flex-1 flex flex-col lg:flex-row p-4 w-full relative z-10 overflow-hidden gap-4 min-h-0">
      <ChatPanel
        messages={messages}
        isLoading={isLoading}
        inputValue={inputValue}
        onInputChange={onInputChange}
        onSend={onSend}
        aiError={aiError}
        onOpenSettings={onOpenSettings}
        className="hidden lg:flex w-[30%] min-h-0"
      />

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
              aiError={aiError}
              onOpenSettings={onOpenSettings}
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
              aiError={aiError}
              onNavigateToChat={onNavigateToChat}
              onNavigateToGenerator={onNavigateToGenerator}
            />
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden lg:flex flex-1 min-h-0">
        <PreviewPanel
          latestCode={latestCode}
          onClearCode={onClearCode}
          onBack={onBack}
          onOpenMobileMenu={onOpenMobileMenu}
          onGenerateDemo={onGenerateDemo}
          aiError={aiError}
          onNavigateToChat={onNavigateToChat}
          onNavigateToGenerator={onNavigateToGenerator}
        />
      </div>
    </div>
  );
}
