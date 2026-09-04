import { useCallback, useRef, useState } from 'react';
import {
  ArrowLeft,
  Menu,
  Terminal,
  Code2,
  Loader2,
  Copy,
  Download,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';
import AiErrorBanner from '@/components/workspace/AiErrorBanner';
import type { AiErrorCopy } from '@/lib/aiErrorCopy';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GeneratorViewProps {
  onGenerate: (desc: string) => Promise<string>;
  onBack: () => void;
  onOpenMobileMenu?: () => void;
  aiError?: AiErrorCopy | null;
  onOpenSettings?: () => void;
}

type StackId = 'python' | 'bash' | 'wp-plugin' | 'rest' | 'node';

interface StackConfig {
  label: string;
  prefix: string;
  extension: string;
}

interface StarterTemplate {
  title: string;
  description: string;
  stack: StackId;
  prompt: string;
}

interface SessionEntry {
  id: string;
  prompt: string;
  stack: StackId | null;
  result: string;
  createdAt: number;
}

const STACKS: Record<StackId, StackConfig> = {
  python: {
    label: 'Python',
    prefix: '[Python 3] Napíš produkčne pripravený skript. Použi type hints kde dáva zmysel.',
    extension: '.py',
  },
  bash: {
    label: 'Bash',
    prefix: '[Bash] Napíš shell skript pre Linux s bezpečným error handlingom (set -euo pipefail).',
    extension: '.sh',
  },
  'wp-plugin': {
    label: 'WP plugin',
    prefix: '[WordPress Plugin / PHP] Dodrž WP coding standards, escapuj výstupy, použij hooks.',
    extension: '.php',
  },
  rest: {
    label: 'REST',
    prefix: '[WordPress REST API / PHP] Registruj custom route, validuj vstupy, vracaj WP_REST_Response.',
    extension: '.php',
  },
  node: {
    label: 'Node',
    prefix: '[Node.js] Napíš modulárny kód s async/await, error handlingom a JSDoc komentármi.',
    extension: '.js',
  },
};

const STARTERS: StarterTemplate[] = [
  {
    title: 'WP REST endpoint',
    description: 'Custom route s pagináciou príspevkov',
    stack: 'rest',
    prompt:
      'Vytvor WordPress REST API endpoint GET /myapp/v1/posts, ktorý vracia posledné príspevky s pagináciou (page, per_page) a poliami id, title, excerpt, link.',
  },
  {
    title: 'Python port scan',
    description: 'Sken otvorených portov s timeoutom',
    stack: 'python',
    prompt:
      'Python skript, ktorý skenuje zadaný hostiteľ a rozsah portov (napr. 1-1024), s timeoutom 1s na port a výpisom otvorených portov.',
  },
  {
    title: 'Bash deploy helper',
    description: 'Git pull, build, restart služby',
    stack: 'bash',
    prompt:
      'Bash deploy skript: git pull origin main, npm ci, npm run build, restart pm2 procesu "app", s logovaním a rollback hintom pri chybe.',
  },
  {
    title: 'Node webhook',
    description: 'Express listener s HMAC overením',
    stack: 'node',
    prompt:
      'Express webhook endpoint POST /webhook, overí HMAC-SHA256 podpis z hlavičky X-Signature, loguje JSON payload a vráti 200/401.',
  },
];

const STACK_ORDER: StackId[] = ['python', 'bash', 'wp-plugin', 'rest', 'node'];

function buildPrompt(description: string, stack: StackId | null): string {
  const trimmed = description.trim();
  if (!stack) return trimmed;
  return `${STACKS[stack].prefix}\n\n${trimmed}`;
}

function extractPrimaryCodeBlock(markdown: string): { code: string; language: string } | null {
  const match = /```(\w+)?\n([\s\S]*?)```/.exec(markdown);
  if (!match) return null;
  return { language: match[1] ?? 'text', code: match[2].trimEnd() };
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatSessionTime(ts: number): string {
  return new Intl.DateTimeFormat('sk-SK', { hour: '2-digit', minute: '2-digit' }).format(ts);
}

export default function GeneratorView({ onGenerate, onBack, onOpenMobileMenu, aiError, onOpenSettings }: GeneratorViewProps) {
  const [description, setDescription] = useState('');
  const [selectedStack, setSelectedStack] = useState<StackId | null>(null);
  const [result, setResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionEntry[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showIterate, setShowIterate] = useState(false);
  const [iterateNote, setIterateNote] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showEmptyStarters = !result && !isGenerating && !description.trim();

  const runGenerate = useCallback(
    async (promptText: string, stack: StackId | null, options?: { iterateFrom?: SessionEntry; followUp?: string }) => {
      const trimmed = promptText.trim();
      if (!trimmed && !options?.followUp?.trim()) return;

      let finalPrompt: string;
      if (options?.iterateFrom && options.followUp?.trim()) {
        finalPrompt = buildPrompt(
          `Pôvodná požiadavka: ${options.iterateFrom.prompt}\n\nPredchádzajúci výsledok:\n${options.iterateFrom.result}\n\nÚprava: ${options.followUp.trim()}`,
          stack ?? options.iterateFrom.stack,
        );
      } else {
        finalPrompt = buildPrompt(trimmed, stack);
      }

      setIsGenerating(true);
      setResult('');
      setShowIterate(false);
      setIterateNote('');

      try {
        const generated = await onGenerate(finalPrompt);
        setResult(generated);

        const entry: SessionEntry = {
          id: crypto.randomUUID(),
          prompt: options?.followUp?.trim()
            ? `${options.iterateFrom?.prompt ?? trimmed} → ${options.followUp.trim()}`
            : trimmed,
          stack,
          result: generated,
          createdAt: Date.now(),
        };
        setSessionHistory((prev) => [entry, ...prev].slice(0, 12));
        setActiveSessionId(entry.id);
      } catch {
        setResult('');
      } finally {
        setIsGenerating(false);
      }
    },
    [onGenerate],
  );

  const handleGenerate = () => {
    void runGenerate(description, selectedStack);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const applyStarter = (starter: StarterTemplate) => {
    setDescription(starter.prompt);
    setSelectedStack(starter.stack);
    setResult('');
    setShowIterate(false);
    setIterateNote('');
    textareaRef.current?.focus();
  };

  const restoreSession = (entry: SessionEntry) => {
    setDescription(entry.prompt);
    setSelectedStack(entry.stack);
    setResult(entry.result);
    setActiveSessionId(entry.id);
    setShowIterate(false);
    setIterateNote('');
  };

  const handleCopyResult = async () => {
    const block = extractPrimaryCodeBlock(result);
    const text = block?.code ?? result;
    await navigator.clipboard.writeText(text);
    toast.success('Skopírované do schránky');
  };

  const handleDownload = () => {
    const block = extractPrimaryCodeBlock(result);
    const stackExt = selectedStack ? STACKS[selectedStack].extension : '.txt';
    const ext = block?.language === 'python' ? '.py' : block?.language === 'bash' ? '.sh' : block?.language === 'php' ? '.php' : block?.language === 'javascript' || block?.language === 'js' ? '.js' : stackExt;
    const content = block?.code ?? result;
    const baseName = selectedStack ? STACKS[selectedStack].label.toLowerCase().replace(/\s+/g, '-') : 'generated';
    downloadText(content, `${baseName}${ext}`);
    toast.success('Súbor stiahnutý');
  };

  const handleIterateSubmit = () => {
    const current = sessionHistory.find((s) => s.id === activeSessionId);
    if (!current || !iterateNote.trim()) return;
    void runGenerate(description, selectedStack, { iterateFrom: current, followUp: iterateNote });
  };

  const toggleStack = (stackId: StackId) => {
    setSelectedStack((prev) => (prev === stackId ? null : stackId));
  };

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-12 overflow-y-auto w-full relative z-10 scrollbar-hide bg-card m-4 rounded-2xl shadow-sm border border-border">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-normal text-foreground">Generátor Kódu</h2>
            <p className="text-muted-foreground text-sm mt-1">Rýchla syntéza skriptov a nástrojov cez Cloud AI.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            {onOpenMobileMenu && (
              <button
                type="button"
                onClick={onOpenMobileMenu}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent lg:hidden"
              >
                <Menu size={16} />
                Nástroje
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              <ArrowLeft size={16} />
              Späť
            </button>
          </div>
        </div>

        {sessionHistory.length > 0 && (
          <div className="mb-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Clock size={12} />
              História relácie
            </div>
            <div className="flex flex-wrap gap-2">
              {sessionHistory.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => restoreSession(entry)}
                  className={cn(
                    'max-w-[220px] truncate rounded-full border px-3 py-1.5 text-xs transition-colors text-left',
                    activeSessionId === entry.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                  title={entry.prompt}
                >
                  <span className="font-mono text-[10px] opacity-70 mr-1.5">{formatSessionTime(entry.createdAt)}</span>
                  {entry.prompt.slice(0, 48)}
                  {entry.prompt.length > 48 ? '…' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {showEmptyStarters && (
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-foreground">
              <Sparkles size={16} className="text-primary" />
              Rýchle šablóny
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STARTERS.map((starter) => (
                <button
                  key={starter.title}
                  type="button"
                  onClick={() => applyStarter(starter)}
                  className="group text-left rounded-xl border border-border bg-accent/30 p-4 transition-all hover:border-primary/40 hover:bg-accent/60 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {starter.title}
                    </span>
                    <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {STACKS[starter.stack].label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{starter.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-5">
          {aiError && !isGenerating && (
            <AiErrorBanner error={aiError} onOpenSettings={onOpenSettings} />
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Stack / jazyk
            </label>
            <div className="flex flex-wrap gap-2">
              {STACK_ORDER.map((stackId) => (
                <button
                  key={stackId}
                  type="button"
                  onClick={() => toggleStack(stackId)}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                    selectedStack === stackId
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {STACKS[stackId].label}
                </button>
              ))}
            </div>
            {selectedStack && (
              <p className="mt-2 text-xs text-muted-foreground">{STACKS[selectedStack].prefix}</p>
            )}
          </div>

          <div className="relative">
            <div className="absolute top-3.5 left-4 pointer-events-none text-muted-foreground">
              <Terminal size={18} />
            </div>
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Popíšte funkčnosť podrobne — Enter generuje, Shift+Enter nový riadok..."
              rows={5}
              className="w-full bg-card border border-border rounded-xl py-3 pl-11 pr-4 text-foreground text-sm leading-relaxed focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-y min-h-[120px]"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Enter — generovať · Shift+Enter — nový riadok
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!description.trim() || isGenerating}
            className="self-start px-6 py-2.5 bg-primary text-primary-foreground rounded-full hover:bg-google-blue-hover transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:bg-muted shadow-sm"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Code2 size={18} />}
            {isGenerating ? 'Generujem…' : 'Generovať kód'}
          </button>

          {isGenerating && (
            <div className="rounded-xl border border-border bg-accent/40 p-8 flex flex-col items-center justify-center gap-3 animate-fade-in">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cloud AI pripravuje kód…</p>
            </div>
          )}

          {result && !isGenerating && (
            <div className="mt-2 animate-fade-in">
              <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-border">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mr-1">Výsledok</span>
                <button
                  type="button"
                  onClick={() => void handleCopyResult()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <Copy size={13} />
                  Kopírovať
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <Download size={13} />
                  Stiahnuť súbor
                </button>
                <button
                  type="button"
                  onClick={() => setShowIterate((v) => !v)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    showIterate
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:bg-accent',
                  )}
                >
                  <RefreshCw size={13} />
                  Uprav ešte
                </button>
              </div>

              {showIterate && (
                <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <label className="block text-xs font-medium text-foreground mb-2">
                    Čo upraviť alebo doplniť?
                  </label>
                  <textarea
                    value={iterateNote}
                    onChange={(e) => setIterateNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleIterateSubmit();
                      }
                    }}
                    placeholder="napr. Pridaj error handling a logovanie do súboru..."
                    rows={2}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleIterateSubmit}
                    disabled={!iterateNote.trim() || isGenerating}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-google-blue-hover transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} />
                    Aplikovať úpravu
                  </button>
                </div>
              )}

              <MarkdownRenderer content={result} onCopy={() => toast.success('Skopírované')} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
