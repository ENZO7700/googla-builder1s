import { useNavigate } from 'react-router-dom';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { Sparkles, Code2, ArrowRight, Layers, Terminal } from 'lucide-react';
import { ELITE_HEADLESS_PROMPT, HEADLESS_STRUCTURE_TEMPLATE } from '@/lib/wordpress/headlessTemplate';
import { toast } from 'sonner';

export default function HeadlessThemeManager({ siteId }: { siteId: string }) {
  const navigate = useNavigate();

  const handleStartGeneration = () => {
    // We pass the prompt via sessionStorage to be picked up by Index.tsx Chat
    sessionStorage.setItem('builderPrompt', ELITE_HEADLESS_PROMPT);
    sessionStorage.setItem('builderPromptSource', 'Headless Theme Manager');
    toast.success('Prompt pripravený v AI Chate');
    navigate('/');
  };

  return (
    <DashboardCard
      title="🚀 Headless Hybrid"
      description="Generovanie Next.js (React) frontendu napojeného na WP GraphQL. Extrémna rýchlosť a SPA zážitok."
      icon={<Layers size={16} />}
    >
      <div className="px-6 py-5 space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{HEADLESS_STRUCTURE_TEMPLATE.name}</h3>
              <p className="text-sm text-muted-foreground">Vizuál "Elite Core" pre prémiový zážitok</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Technologický Stack</h4>
              <ul className="space-y-1">
                {HEADLESS_STRUCTURE_TEMPLATE.techStack.map(tech => (
                  <li key={tech} className="flex items-center gap-2 text-sm">
                    <Code2 size={14} className="text-primary" /> {tech}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kľúčové Funkcie</h4>
              <ul className="space-y-1">
                {HEADLESS_STRUCTURE_TEMPLATE.features.map(feat => (
                  <li key={feat} className="flex items-center gap-2 text-sm">
                    <Terminal size={14} className="text-primary" /> {feat}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg bg-zinc-950 text-zinc-300 font-mono text-xs overflow-auto max-h-40 border border-zinc-800">
            <div className="text-zinc-500 mb-2">// Ukážka generovacieho promptu:</div>
            {ELITE_HEADLESS_PROMPT}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleStartGeneration}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-full text-sm font-medium hover:bg-google-blue transition-colors shadow-sm hover:shadow-md"
            >
              Začať generovanie v AI chate <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
