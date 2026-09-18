import { useState } from 'react';
import { Terminal, Code2, Loader2 } from 'lucide-react';
import { MarkdownRenderer } from '@/lib/formatMarkdown';
import WorkspaceLayout from './WorkspaceLayout';

interface GeneratorViewProps {
  onGenerate: (desc: string) => Promise<string>;
}

export default function GeneratorView({ onGenerate }: GeneratorViewProps) {
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
    <WorkspaceLayout
      title="Generátor Kódu"
      description="Rýchla syntéza skriptov a nástrojov cez Cloud AI."
    >
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto w-full">

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
            className="self-start h-11 px-6 bg-primary text-primary-foreground rounded-lg hover:bg-google-blue-hover transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:bg-muted shadow-sm"
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
    </WorkspaceLayout>
  );
}
