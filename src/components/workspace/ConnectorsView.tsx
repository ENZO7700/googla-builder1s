import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu, Plug, ExternalLink, X, Zap, LayoutDashboard } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  available: boolean;
}

const integrations: Integration[] = [
  { id: 'wordpress', name: 'WordPress', description: 'Správa WordPress.com a self-hosted stránok cez REST API.', icon: '📘', connected: false, available: true },
  { id: 'github', name: 'GitHub', description: 'Správa repozitárov, CI/CD pipelines a code review.', icon: '🐙', connected: false, available: true },
  { id: 'slack', name: 'Slack', description: 'Notifikácie, alerting a tímová komunikácia.', icon: '💬', connected: false, available: true },
  { id: 'docker', name: 'Docker Hub', description: 'Registry pre kontajnerové obrazy a automatické buildy.', icon: '🐳', connected: false, available: true },
  { id: 'aws', name: 'AWS', description: 'Cloud infraštruktúra, S3, Lambda a EC2 inštancie.', icon: '☁️', connected: false, available: false },
  { id: 'grafana', name: 'Grafana', description: 'Monitoring dashboardy a vizualizácia metrík.', icon: '📊', connected: false, available: false },
  { id: 'jira', name: 'Jira', description: 'Projektový manažment a sledovanie úloh.', icon: '📋', connected: false, available: true },
];

interface ConnectorsViewProps {
  onBack: () => void;
  onOpenMobileMenu?: () => void;
}

export default function ConnectorsView({ onBack, onOpenMobileMenu }: ConnectorsViewProps) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Integration | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  return (
    <div className="flex-1 flex flex-col p-6 pb-20 lg:p-12 overflow-y-auto scrollbar-hide animate-fade-in min-h-0">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-normal text-foreground flex items-center gap-3">
              <Plug size={24} className="text-primary" /> Integrácie API
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Prepojte workspace s externými službami.</p>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map(item => (
            <button
              key={item.id}
              onClick={() => { setSelected(item); setApiKeyInput(''); }}
              className="text-left p-5 bg-card border border-border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all group relative"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{item.icon}</span>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                    item.connected ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    {item.connected ? 'Pripojené' : 'Nepripojené'}
                  </span>
                  {!item.available && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium flex items-center gap-1">
                      <Zap size={10} /> Čoskoro
                    </span>
                  )}
                </div>
              </div>
              <h3 className="text-foreground font-medium text-sm">{item.name}</h3>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{item.description}</p>
              {item.available && (
                <div className="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-success/50 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={onBack}
          className="mt-8 px-6 py-2.5 bg-card border border-border text-foreground hover:bg-accent rounded-full font-medium text-sm transition-colors shadow-sm"
        >
          Späť na Workspace
        </button>
      </div>

      {/* Detail dialog */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{selected.icon}</span>
                <div>
                  <h3 className="text-lg font-medium text-foreground">{selected.name}</h3>
                  <span className={`text-xs font-medium ${selected.connected ? 'text-success' : 'text-muted-foreground'}`}>
                    {selected.connected ? 'Pripojené' : 'Nepripojené'}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground p-1">
                <X size={18} />
              </button>
            </div>
            <p className="text-muted-foreground text-sm mb-4">{selected.description}</p>

            {selected.id === 'github' && (
              <button
                onClick={() => { setSelected(null); navigate('/dashboard/github'); }}
                className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-colors"
              >
                <LayoutDashboard size={14} /> Otvoriť GitHub dashboard
              </button>
            )}

            {selected.id === 'wordpress' && (
              <div className="mb-4 space-y-3">
                <div className="rounded-xl border border-border bg-accent/60 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      API nájdené v projekte
                    </span>
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                      Ready
                    </span>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-card px-2 py-1 font-mono text-[11px] text-foreground">POST</span>
                      <span className="font-mono">/functions/v1/wordpress-proxy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-card px-2 py-1 font-mono text-[11px] text-foreground">GET</span>
                      <span className="font-mono">wp-json/wp/v2/posts</span>
                    </div>
                    <p>
                      Používa `wordpressService.getPostsPreview()` a podporuje self-hosted WordPress aj WordPress.com cez existujúci proxy layer.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelected(null); navigate('/dashboard/wordpress'); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-colors"
                >
                  <LayoutDashboard size={14} /> Otvoriť WordPress dashboard
                </button>
              </div>
            )}

            {selected.available ? (
              <>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">API Kľúč</label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Vložte API kľúč..."
                    className="w-full bg-accent border border-border rounded-lg px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="flex gap-3">
                  <button className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-google-blue-hover transition-colors flex items-center justify-center gap-2">
                    <ExternalLink size={14} /> Pripojiť
                  </button>
                  <button onClick={() => setSelected(null)} className="px-4 py-2.5 bg-card border border-border text-foreground rounded-full text-sm font-medium hover:bg-accent transition-colors">
                    Zavrieť
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-warning font-medium mb-2">Táto integrácia bude dostupná čoskoro</p>
                <button onClick={() => setSelected(null)} className="px-4 py-2.5 bg-card border border-border text-foreground rounded-full text-sm font-medium hover:bg-accent transition-colors">
                  Zavrieť
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
