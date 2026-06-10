import { useState } from 'react';
import { ArrowLeft, Menu, Terminal, Code2, Loader2 } from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';

interface GeneratorViewProps {
  onGenerate: (desc: string) => Promise<string>;
  onBack: () => void;
  onOpenMobileMenu?: () => void;
}

export default function GeneratorView({ onGenerate, onBack, onOpenMobileMenu }: GeneratorViewProps) {
  const [description, setDescription] = useState('');
  const [result, setResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    setResult('');
    try {
      const r = await onGenerate(description);
      setResult(r);
    } finally {
      setIsGenerating(false);
    }
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

        {!description && !result && !isGenerating && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-accent border border-border flex items-center justify-center mb-6">
              <Terminal size={36} className="text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Pripravený na generovanie</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Popíšte požadovanú funkčnosť – napríklad Python skript, bash nástroj alebo REST API endpoint – a AI vygeneruje produkčne-pripravený kód.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted-foreground">
              <Terminal size={20} />
            </div>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="Popíšte funkčnosť (napr. Python port scanner)..."
              className="w-full bg-card border border-border rounded-xl py-3 pl-12 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!description.trim() || isGenerating}
            className="self-start px-6 py-2.5 bg-primary text-primary-foreground rounded-full hover:bg-google-blue-hover transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:bg-muted shadow-sm"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Code2 size={18} />}
            Generovať Kód
          </button>

          {result && (
            <div className="mt-8">
              <MarkdownRenderer content={result} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
