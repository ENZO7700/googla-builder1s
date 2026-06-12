import { useNavigate } from 'react-router-dom';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { PenTool, Code2, ArrowRight, LayoutTemplate, Terminal } from 'lucide-react';
import { ELITE_BLUEPRINT_PROMPT, BLUEPRINT_STRUCTURE_TEMPLATE } from '@/lib/wordpress/blueprintTemplate';
import { toast } from 'sonner';

export default function PromptsBlueprintsManager({ siteId }: { siteId: string }) {
  const navigate = useNavigate();

  const handleStartGeneration = () => {
    sessionStorage.setItem('builderPrompt', ELITE_BLUEPRINT_PROMPT);
    sessionStorage.setItem('builderPromptSource', 'Prompts & Blueprints');
    toast.success('Prompt pripravený v AI Chate');
    navigate('/');
  };

  return (
    <DashboardCard
      title="📐 Prompts & Blueprints"
      description="Generovanie FSE (Full Site Editing) tém, theme.json a Gutenberg patternov."
      icon={<LayoutTemplate size={16} />}
    >
      <div className="px-6 py-5 space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <PenTool size={18} className="text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{BLUEPRINT_STRUCTURE_TEMPLATE.name}</h3>
              <p className="text-sm text-muted-foreground">Najčistejší prístup k WordPress šablónam</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Technologický Stack</h4>
              <ul className="space-y-1">
                {BLUEPRINT_STRUCTURE_TEMPLATE.techStack.map(tech => (
                  <li key={tech} className="flex items-center gap-2 text-sm">
                    <Code2 size={14} className="text-purple-500" /> {tech}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kľúčové Funkcie</h4>
              <ul className="space-y-1">
                {BLUEPRINT_STRUCTURE_TEMPLATE.features.map(feat => (
                  <li key={feat} className="flex items-center gap-2 text-sm">
                    <Terminal size={14} className="text-purple-500" /> {feat}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg bg-zinc-950 text-zinc-300 font-mono text-xs overflow-auto max-h-40 border border-zinc-800">
            <div className="text-zinc-500 mb-2">// Ukážka generovacieho promptu:</div>
            {ELITE_BLUEPRINT_PROMPT}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleStartGeneration}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-full text-sm font-medium hover:bg-purple-600 transition-colors shadow-sm hover:shadow-md"
            >
              Začať generovanie v AI chate <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
