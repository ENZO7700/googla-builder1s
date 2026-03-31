import { useState } from 'react';
import { Terminal, Code2, Loader2 } from 'lucide-react';
import { formatMarkdown } from '@/lib/formatMarkdown';

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
    <div className="flex-1 flex flex-col p-6 lg:p-12 overflow-y-auto w-full relative z-10 scrollbar-hide bg-card m-4 rounded-2xl shadow-sm border border-border">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-2xl font-normal text-foreground">Generátor Kódu</h2>
          <p className="text-muted-foreground text-sm mt-1">Rýchla syntéza skriptov a nástrojov cez Cloud AI.</p>
        </div>

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
            <div className="mt-8">{formatMarkdown(result)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
