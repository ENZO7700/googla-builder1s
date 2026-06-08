import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Sparkles, Loader2, Send, Paperclip, Mic,
  FileText, X, Search, Menu, AlertCircle, CheckCircle2,
  ArrowDown, Square,
} from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';
import MessageActions from './MessageActions';

interface Message {
  role: string;
  content: string;
}

interface Attachment {
  name: string;
  size: string;
  progress?: number;
  uploading?: boolean;
  url?: string;
  error?: string;
}

interface PromptCategoryProps {
  text: string;
  active: boolean;
  onClick: () => void;
}

function PromptCategory({ text, active, onClick }: PromptCategoryProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-card text-muted-foreground border border-border hover:bg-accent'
      }`}
    >
      {text}
    </button>
  );
}

function PromptCard({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 bg-card border border-border rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all text-sm text-foreground leading-relaxed"
    >
      {text}
    </button>
  );
}

const promptData: Record<string, string[]> = {
  'WordPress FSE': [
    'Vygeneruj komplexný theme.json s definíciou rozmerov (layout, spacing) a vlastných farebných formátov.',
    'Navrhni block.json pre custom Gutenberg blok vrátane atribútov pre rozmery a štýly.',
    'Zaregistruj custom image sizes (formáty) vo functions.php a pridaj ich do REST API JSON odpovede.',
    'Vytvor WP REST API endpoint, ktorý vracia custom post types v optimalizovanom JSON formáte.',
  ],
  'Architektúra': [
    'Vygeneruj moderný HTML login pomocou Material Design a Tailwind CSS.',
    'Analyzuj Python skript na SQL injection zraniteľnosti.',
    'Navrhni dátový model v PostgreSQL pre SaaS aplikáciu.',
    'Vytvor Docker Compose pre Redis, Postgres a Node worker.',
  ],
  'Bezpečnosť': [
    'Vykonaj statickú analýzu (SAST) priloženého kódu.',
    'Navrhni pravidlá pre Web Application Firewall (WAF).',
    'Vytvor penetračný testovací plán pre nový e-shop.',
    'Vysvetli a ukáž exploitáciu CVE-2021-44228 (Log4Shell).',
  ],
};

interface ChatViewProps {
  messages: Message[];
  isLoading: boolean;
  isStreaming?: boolean;
  inputValue: string;
  onInputChange: (val: string) => void;
  onSend: (text?: string) => void;
  attachments: Attachment[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (i: number) => void;
  isRecording: boolean;
  onMicClick: () => void;
  isDragging: boolean;
  tokenCount: string;
  onCopyCode: () => void;
  onToggleMobileMenu?: () => void;
  onStopGeneration?: () => void;
  onRegenerate?: () => void;
  onContinue?: () => void;
  onSendToPreview?: (html: string) => void;
}

export default function ChatView({
  messages, isLoading, isStreaming, inputValue, onInputChange, onSend,
  attachments, onFileUpload, onRemoveAttachment,
  isRecording, onMicClick, isDragging, tokenCount, onCopyCode, onToggleMobileMenu,
  onStopGeneration, onRegenerate, onContinue, onSendToPreview,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputAreaRef = useRef<HTMLTextAreaElement>(null);
  const [activeCategory, setActiveCategory] = useState('WordPress FSE');
  const [autoScroll, setAutoScroll] = useState(true);
  const [newSinceScroll, setNewSinceScroll] = useState(0);
  const [streamStart, setStreamStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const rafRef = useRef<number | null>(null);
  const lastLenRef = useRef(0);

  // Smooth scroll using rAF (no jank during streaming)
  const scrollToBottom = useCallback((smooth = false) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }, []);

  // Detect user scroll
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distance < 120;
      setAutoScroll(atBottom);
      if (atBottom) setNewSinceScroll(0);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Track streaming content updates
  useEffect(() => {
    const last = messages[messages.length - 1];
    const lastLen = last?.content?.length ?? 0;

    if (autoScroll) {
      scrollToBottom(!isStreaming);
    } else if (isStreaming && lastLen > lastLenRef.current) {
      // count NEW lines added since user scrolled up
      const delta = (last?.content ?? '').slice(lastLenRef.current).split('\n').length - 1;
      if (delta > 0) setNewSinceScroll(n => n + delta);
    }
    lastLenRef.current = lastLen;
  }, [messages, isLoading, isStreaming, autoScroll, scrollToBottom]);

  // Streaming timer
  useEffect(() => {
    if (isStreaming) {
      const start = performance.now();
      setStreamStart(start);
      setElapsed(0);
      const id = setInterval(() => setElapsed((performance.now() - start) / 1000), 100);
      return () => clearInterval(id);
    } else {
      setStreamStart(null);
    }
  }, [isStreaming]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        inputAreaRef.current?.focus();
      }
      if (e.key === 'End' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setAutoScroll(true);
        scrollToBottom(true);
      }
      if (e.key === 'Escape' && isStreaming && onStopGeneration) {
        onStopGeneration();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [scrollToBottom, isStreaming, onStopGeneration]);

  const lastMsgIdx = messages.length - 1;

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 shrink-0 z-30">
        <div className="flex items-center gap-3">
          {onToggleMobileMenu && (
            <button onClick={onToggleMobileMenu} className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground">
              <Menu size={20} />
            </button>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Search size={16} />
            <span className="text-sm hidden sm:inline">Vyhľadať v projekte</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            API Tokeny: {tokenCount}k
          </span>
        </div>
      </header>

      {/* Scroll + input wrapper */}
      <div className="flex-1 flex flex-col min-h-0 relative">

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/5 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-primary/40 rounded-2xl m-4">
          <div className="text-center">
            <Paperclip size={40} className="text-primary mx-auto mb-3" />
            <p className="text-lg font-medium text-foreground">Uvoľnite súbory pre nahratie</p>
            <p className="text-sm text-muted-foreground mt-1">Súbory budú bezpečne pridané do kontextu AI</p>
          </div>
        </div>
      )}



      {/* Messages */}
      <div
        ref={scrollContainerRef}
        data-testid="chat-scroll"
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 lg:px-24 pt-8 pb-6 scrollbar-hide flex flex-col scroll-smooth"
      >
        {/* Floating jump-to-bottom */}
        {!autoScroll && messages.length > 0 && (
          <button
            data-testid="jump-to-bottom"
            onClick={() => { setAutoScroll(true); setNewSinceScroll(0); scrollToBottom(true); }}
            className="sticky bottom-3 self-center z-40 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs shadow-lg hover:opacity-90 flex items-center gap-1.5 animate-fade-in"
          >
            <ArrowDown size={12} />
            {newSinceScroll > 0 ? `${newSinceScroll} nových riadkov` : 'Skočiť na koniec'}
          </button>
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <div
            data-testid="stream-indicator"
            className="sticky bottom-3 ml-auto z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border shadow-lg text-xs animate-fade-in"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-muted-foreground">
              Generujem · {elapsed.toFixed(1)}s

            </span>
            {onStopGeneration && (
              <button
                onClick={onStopGeneration}
                className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                title="Zastaviť (Esc)"
              >
                <Square size={10} className="fill-current" />
                Stop
              </button>
            )}
          </div>
        )}

        <div className="max-w-3xl mx-auto w-full flex-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] animate-fade-in">
              <div className="text-center mb-10 space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-card border border-border shadow-sm mb-2">
                  <Sparkles size={28} className="text-primary" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-normal text-foreground tracking-tight">
                  Ako vám môžem pomôcť?
                </h1>
              </div>

              <div className="w-full">
                <div className="flex gap-2 pb-4 justify-center flex-wrap mb-4">
                  {Object.keys(promptData).map(cat => (
                    <PromptCategory key={cat} text={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {promptData[activeCategory]?.map((text, idx) => (
                    <PromptCard key={idx} text={text} onClick={() => onSend(text)} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 pb-10 pt-4">
              {messages.map((msg, idx) => {
                const isLast = idx === lastMsgIdx;
                const isCompletedModel = msg.role === 'model' && msg.content && !(isLast && isStreaming);
                return (
                  <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    {msg.role === 'model' && (
                      <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0 mt-1">
                        <Sparkles size={16} className="text-primary" />
                      </div>
                    )}
                    <div
                      data-testid={msg.role === 'model' ? 'model-message' : 'user-message'}
                      className={`max-w-[85%] rounded-2xl p-5 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-sm'
                          : 'bg-card border border-border text-foreground shadow-sm'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <div className="text-[15px]">
                          <MarkdownRenderer content={msg.content} onCopy={onCopyCode} />
                          {isStreaming && isLast && (
                            <span className="inline-block w-2 h-4 bg-primary ml-1 animate-blink align-middle" />
                          )}
                          {isCompletedModel && (
                            <MessageActions
                              content={msg.content}
                              onRegenerate={isLast ? onRegenerate : undefined}
                              onContinue={isLast ? onContinue : undefined}
                              onSendToPreview={onSendToPreview}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && !isStreaming && (
                <div className="flex gap-4 justify-start pt-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Loader2 size={16} className="text-primary animate-spin" />
                  </div>
                  <div className="flex items-center text-muted-foreground text-sm font-medium">
                    Generujem odpoveď...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="absolute bottom-0 left-0 right-0 p-3 lg:px-24 lg:pb-8 bg-gradient-to-t from-background via-background to-transparent z-40">
        <div className="max-w-3xl mx-auto w-full relative">
          {attachments.length > 0 && (
            <div className="absolute -top-16 left-0 flex gap-2 w-full overflow-x-auto pb-2 scrollbar-hide z-30">
              {attachments.map((file, i) => {
                const isErr = !!file.error;
                const isUp = !!file.uploading;
                const isDone = !!file.url && !isUp;
                return (
                  <div
                    key={i}
                    className={`relative flex flex-col gap-1 bg-card border px-3 py-1.5 rounded-2xl text-xs font-medium shadow-sm min-w-[160px] ${
                      isErr ? 'border-destructive/50' : isDone ? 'border-success/40' : 'border-border'
                    }`}
                    title={file.error || (isUp ? 'Nahrávam...' : isDone ? 'Nahrané' : '')}
                  >
                    <div className="flex items-center gap-2 text-foreground">
                      {isErr ? <AlertCircle size={14} className="text-destructive shrink-0" /> :
                       isDone ? <CheckCircle2 size={14} className="text-success shrink-0" /> :
                       isUp ? <Loader2 size={14} className="text-primary shrink-0 animate-spin" /> :
                       <FileText size={14} className="text-primary shrink-0" />}
                      <span className="truncate max-w-[120px]">{file.name}</span>
                      <span className="text-muted-foreground text-[10px]">{file.size}</span>
                      <button onClick={() => onRemoveAttachment(i)} className="ml-1 text-muted-foreground hover:text-foreground">
                        <X size={14} />
                      </button>
                    </div>
                    {isUp && (
                      <div className="h-0.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-200"
                          style={{ width: `${file.progress ?? 0}%` }}
                        />
                      </div>
                    )}
                    {isErr && (
                      <div className="text-[10px] text-destructive truncate max-w-[180px]">{file.error}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className={`relative flex flex-col w-full bg-card border ${isRecording ? 'border-primary ring-2 ring-primary/20' : 'border-border'} transition-all rounded-3xl shadow-lg p-2`}>
            <textarea
              ref={inputAreaRef}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder={isRecording ? 'Hovorte...' : 'Opýtajte sa na kód, architektúru alebo WordPress FSE...'}
              className="w-full bg-transparent placeholder:text-muted-foreground resize-none outline-none px-4 pt-3 pb-2 max-h-[200px] min-h-[52px] text-[15px] scrollbar-hide text-foreground leading-relaxed"
              rows={inputValue.split('\n').length > 1 ? Math.min(inputValue.split('\n').length, 6) : 1}
              disabled={isRecording}
            />

            <div className="flex items-center justify-between px-2 pb-1">
              <div className="flex items-center gap-1">
                <input type="file" ref={fileInputRef} onChange={onFileUpload} className="hidden" multiple />
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors" title="Pridať súbor">
                  <Paperclip size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={onMicClick} className={`p-2 rounded-full transition-colors ${isRecording ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                  <Mic size={18} />
                </button>
                {isStreaming && onStopGeneration ? (
                  <button
                    onClick={onStopGeneration}
                    data-testid="stop-button"
                    className="p-2 bg-destructive text-destructive-foreground rounded-full hover:opacity-90 transition-colors shadow-sm"
                    title="Zastaviť generovanie (Esc)"
                  >
                    <Square size={16} className="fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={() => onSend()}
                    disabled={(!inputValue.trim() && attachments.length === 0) || isLoading || isRecording}
                    className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-google-blue-hover transition-colors disabled:opacity-50 disabled:bg-muted shadow-sm"
                  >
                    <Send size={18} className="ml-0.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="text-center mt-3">
            <p className="text-[11px] text-muted-foreground">AI môže zobraziť nepresné informácie. Vždy si overte dôležité fakty. Stlačte <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> pre zastavenie generovania alebo <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+End</kbd> pre skok na koniec.</p>
          </div>
        </div>
      </div>
    </>
  );
}
