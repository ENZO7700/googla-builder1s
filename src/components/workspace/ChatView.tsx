import { useRef, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Sparkles, Loader2, Send, Paperclip, Mic,
  FileText, X, Search, Menu, AlertCircle, CheckCircle2
} from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';

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

const ambientParticles = [
  { left: '9%', top: '22%', color: 'text-google-blue', width: 3, delay: '-1s', duration: '13s', rotate: '-22deg' },
  { left: '16%', top: '66%', color: 'text-google-blue', width: 4, delay: '-7s', duration: '15s', rotate: '16deg' },
  { left: '23%', top: '12%', color: 'text-google-yellow', width: 2, delay: '-3s', duration: '12s', rotate: '42deg' },
  { left: '31%', top: '78%', color: 'text-google-green', width: 3, delay: '-10s', duration: '16s', rotate: '-38deg' },
  { left: '38%', top: '28%', color: 'text-google-red', width: 2, delay: '-5s', duration: '14s', rotate: '18deg' },
  { left: '44%', top: '60%', color: 'text-google-blue', width: 4, delay: '-12s', duration: '17s', rotate: '68deg' },
  { left: '53%', top: '18%', color: 'text-google-green', width: 3, delay: '-8s', duration: '13s', rotate: '-12deg' },
  { left: '59%', top: '72%', color: 'text-google-red', width: 2, delay: '-2s', duration: '15s', rotate: '31deg' },
  { left: '67%', top: '34%', color: 'text-google-yellow', width: 4, delay: '-9s', duration: '18s', rotate: '-54deg' },
  { left: '73%', top: '55%', color: 'text-google-blue', width: 3, delay: '-4s', duration: '14s', rotate: '10deg' },
  { left: '81%', top: '16%', color: 'text-google-red', width: 2, delay: '-11s', duration: '16s', rotate: '44deg' },
  { left: '88%', top: '70%', color: 'text-google-yellow', width: 3, delay: '-6s', duration: '12s', rotate: '-20deg' },
] as const;

function WorkspaceMark() {
  return (
    <span className="wpbox-google-mark" aria-hidden="true">
      <span className="bg-google-blue" />
      <span className="bg-google-red" />
      <span className="bg-google-yellow" />
      <span className="bg-google-green" />
    </span>
  );
}

function AmbientIntro() {
  return (
    <section className="wpbox-ambient-hero" aria-label="LarsenEvans-wpBOX workspace">
      <div className="wpbox-ambient-field" aria-hidden="true">
        {ambientParticles.map((particle, index) => (
          <span
            key={`${particle.left}-${particle.top}-${index}`}
            className={`wpbox-ambient-particle ${particle.color}`}
            style={{
              left: particle.left,
              top: particle.top,
              width: `${particle.width}px`,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              transform: `rotate(${particle.rotate})`,
            } as CSSProperties}
          />
        ))}
      </div>
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="mb-5 flex items-center gap-3 text-[15px] font-medium text-foreground">
          <WorkspaceMark />
          <span>LarsenEvans-wpBOX</span>
        </div>
        <p className="max-w-2xl text-balance text-4xl font-normal leading-[1.05] tracking-normal text-foreground sm:text-5xl lg:text-6xl">
          Postavte web rýchlejšie. Od nápadu po spustenie.
        </p>
        <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
          Popíšte čo potrebujete a wpBOX vám pomôže s návrhom, obsahom, kódom aj WordPress napojením.
        </p>
      </div>
    </section>
  );
}

function PromptCategory({ text, active, onClick }: PromptCategoryProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-foreground text-background shadow-sm'
          : 'bg-background text-muted-foreground border border-border hover:bg-accent hover:text-foreground'
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
      className="group min-h-[112px] rounded-[1.35rem] border border-border bg-card p-5 text-left text-sm leading-relaxed text-foreground shadow-[0_1px_2px_rgba(60,64,67,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-input hover:shadow-[0_8px_24px_rgba(60,64,67,0.12)]"
    >
      <span className="block max-w-[32rem]">{text}</span>
      <span className="mt-4 block h-1 w-8 rounded-full bg-google-blue opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

const promptData: Record<string, string[]> = {
  'Nový web': [
    'Chcem moderný web pre službu alebo firmu. Navrhni štruktúru, sekcie, texty a prvú verziu úvodnej stránky.',
    'Priprav landing page, ktorá predáva jasnú ponuku, má silný headline, dôveryhodné benefity a výzvu na kontakt.',
    'Vymysli kompletný obsah webu pre lokálnu firmu: hero, služby, referencie, FAQ a kontaktnú sekciu.',
    'Navrhni web do 24 hodín: čo musí byť hotové ako prvé, čo môže počkať a aký má byť launch checklist.',
  ],
  'WordPress': [
    'Komponent 1/4 - Hero Engine: vygeneruj WordPress Gutenberg HTML/CSS úvodnú sekciu s ostrým headline, subheadline, CTA, trust metrikami a prémiovým vizuálnym rytmom. Použi jednotný prefix tried wpbox-lp.',
    'Komponent 2/4 - Offer Grid: vygeneruj responzívnu sekciu služieb/benefitov pre landing page: 6 kariet, krátke predajné texty, jasné výsledky a CTA smerujúce na konzultáciu. Výstup nech sedí k wpbox-lp hero sekcii.',
    'Komponent 3/4 - Proof Stack: vygeneruj dôveryhodnostnú sekciu s procesom, výsledkami, referenciami a garanciami tak, aby návštevník pochopil prečo veriť ponuke. Drž rovnaký WordPress HTML/CSS štýl.',
    'Komponent 4/4 - Conversion Close: vygeneruj záverečnú CTA sekciu s FAQ, kontaktným blokom, rezerváciou konzultácie a jednoduchým footerom. Musí uzatvárať celú landing page a byť pripravená na Poslať na WP.',
  ],
  'Zlepšenie': [
    'Pozri sa na tento web ako konzultant a navrhni, čo zmeniť, aby lepšie predával a pôsobil dôveryhodne.',
    'Prepíš slabý text na webe tak, aby bol jednoduchší, ľudskejší a viac orientovaný na zákazníka.',
    'Navrhni rýchly audit webu: výkon, SEO, bezpečnosť, konverzie a najdôležitejšie opravy pred spustením.',
    'Vytvor plán, ako z existujúceho webu spraviť profesionálnu prezentáciu pripravenú na reklamu a predaj.',
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
  onDeployCode?: (code: string, language: string) => void;
  onToggleMobileMenu?: () => void;
}

export default function ChatView({
  messages, isLoading, isStreaming, inputValue, onInputChange, onSend,
  attachments, onFileUpload, onRemoveAttachment,
  isRecording, onMicClick, isDragging, tokenCount, onCopyCode, onDeployCode, onToggleMobileMenu
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputAreaRef = useRef<HTMLTextAreaElement>(null);
  const [activeCategory, setActiveCategory] = useState('Nový web');
  const [autoScroll, setAutoScroll] = useState(true);

  // Disable auto-scroll the moment user scrolls up; re-enable when they reach bottom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAutoScroll(distanceFromBottom < 80);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!autoScroll) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, autoScroll]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        inputAreaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {/* Header */}
      <header className="h-16 border-b border-border bg-background flex items-center justify-between px-4 lg:px-6 shrink-0 z-30">
        <div className="flex items-center gap-3">
          {onToggleMobileMenu && (
            <button onClick={onToggleMobileMenu} className="lg:hidden rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Menu size={20} />
            </button>
          )}
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-muted-foreground shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
            <Search size={15} />
            <span className="text-sm hidden sm:inline">Vyhľadať v projekte</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
            <span className="w-2 h-2 rounded-full bg-success" />
            API Tokeny: {tokenCount}k
          </span>
        </div>
      </header>

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
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pt-8 pb-48 scrollbar-hide relative flex flex-col lg:px-20">
        {!autoScroll && isLoading && (
          <button
            onClick={() => { setAutoScroll(true); messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
            className="fixed bottom-40 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs shadow-lg hover:opacity-90"
          >
            ↓ Skočiť na koniec
          </button>
        )}
        <div className="mx-auto w-full max-w-4xl flex-1">
          {messages.length === 0 ? (
            <div className="flex min-h-[58vh] flex-col items-center justify-center animate-fade-in">
              <AmbientIntro />

              <div className="mt-4 w-full">
                <div className="mb-5 flex flex-wrap justify-center gap-2 rounded-full">
                  {Object.keys(promptData).map(cat => (
                    <PromptCategory key={cat} text={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {promptData[activeCategory]?.map((text, idx) => (
                    <PromptCard key={idx} text={text} onClick={() => onSend(text)} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 pb-10 pt-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0 mt-1 shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
                      <Sparkles size={16} className="text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl p-5 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-sm'
                      : 'bg-card border border-border text-foreground shadow-sm'
                  }`}>
                    {msg.role === 'user' ? (
                      <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div className="text-[15px]">
                        <MarkdownRenderer content={msg.content} onCopy={onCopyCode} onDeploy={onDeployCode} />
                        {isStreaming && idx === messages.length - 1 && (
                          <span className="inline-block w-2 h-4 bg-primary ml-1 animate-blink" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

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
      <div className="absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-background via-background to-transparent p-3 lg:px-20 lg:pb-8">
        <div className="mx-auto w-full max-w-3xl relative">
          {attachments.length > 0 && (
            <div className="absolute -top-16 left-0 flex gap-2 w-full overflow-x-auto pb-2 scrollbar-hide z-30">
              {attachments.map((file, i) => {
                const isErr = !!file.error;
                const isUp = !!file.uploading;
                const isDone = !!file.url && !isUp;
                return (
                  <div
                    key={i}
                    className={`relative flex min-w-[160px] flex-col gap-1 rounded-2xl border bg-card px-3 py-1.5 text-xs font-medium shadow-[0_2px_8px_rgba(60,64,67,0.10)] ${
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

          <div className={`relative flex w-full flex-col rounded-[2rem] border bg-card p-2 shadow-[0_12px_34px_rgba(60,64,67,0.16)] transition-all ${isRecording ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
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
              placeholder={isRecording ? 'Hovorte...' : 'Popíšte web, službu alebo WordPress úlohu...'}
              className="max-h-[200px] min-h-[52px] w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[15px] leading-relaxed text-foreground outline-none scrollbar-hide placeholder:text-muted-foreground"
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
                <button
                  onClick={() => onSend()}
                  disabled={(!inputValue.trim() && attachments.length === 0) || isLoading || isRecording}
                  className="rounded-full bg-foreground p-2 text-background shadow-sm transition-colors hover:bg-google-blue disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60"
                >
                  <Send size={18} className="ml-0.5" />
                </button>
              </div>
            </div>
          </div>
          <div className="text-center mt-3">
            <p className="text-[11px] text-muted-foreground">AI môže zobraziť nepresné informácie. Vždy si overte dôležité fakty.</p>
          </div>
        </div>
      </div>
    </>
  );
}
