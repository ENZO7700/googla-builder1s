import { Layout, X, Loader2, Terminal, Send } from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';

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
}

export default function PreviewView({
  latestCode, onClearCode, messages, isLoading,
  inputValue, onInputChange, onSend, onGenerateDemo
}: PreviewViewProps) {
  return (
    <div className="flex-1 flex p-4 w-full relative z-10 overflow-hidden gap-4">
      {/* Left chat panel */}
      <div className="w-[30%] flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden hidden lg:flex">
        <div className="p-4 border-b border-border flex items-center gap-2 bg-accent">
          <Terminal size={18} className="text-muted-foreground" />
          <span className="font-medium text-foreground text-sm">Interakcia</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
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
            <button onClick={() => onSend()} className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-google-blue-hover">
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Right preview */}
      <div className="flex-1 h-full flex flex-col relative bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-accent">
          <div className="flex items-center gap-2 text-foreground font-medium text-sm">
            <Layout size={16} className="text-muted-foreground" /> Live Sandbox
          </div>
          {latestCode && (
            <button
              onClick={onClearCode}
              className="text-[11px] px-3 py-1.5 bg-card border border-border text-muted-foreground rounded-md hover:bg-accent transition-colors font-medium flex items-center gap-1.5 shadow-sm"
            >
              <X size={14} /> Vyčistiť
            </button>
          )}
        </div>

        <div className="flex-1 relative bg-card">
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
    </div>
  );
}
