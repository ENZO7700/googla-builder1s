import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu, Plug, X, Zap, LayoutDashboard } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Real dashboard route — Connect navigates here instead of a dummy form. */
  dashboardPath?: string;
  /** OAuth/API not implemented yet — show „Čoskoro“, no fake connect. */
  comingSoon?: boolean;
  /** Fully unavailable — card is disabled. */
  unavailable?: boolean;
}

const integrations: Integration[] = [
  {
    id: 'wordpress',
    name: 'WordPress',
    description: 'Správa WordPress.com a self-hosted stránok cez REST API.',
    icon: '📘',
    dashboardPath: '/dashboard/wordpress',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Správa repozitárov, CI/CD pipelines a code review.',
    icon: '🐙',
    dashboardPath: '/dashboard/github',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Notifikácie, alerting a tímová komunikácia.',
    icon: '💬',
    comingSoon: true,
  },
  {
    id: 'docker',
    name: 'Docker Hub',
    description: 'Registry pre kontajnerové obrazy a automatické buildy.',
    icon: '🐳',
    comingSoon: true,
  },
  {
    id: 'aws',
    name: 'AWS',
    description: 'Cloud infraštruktúra, S3, Lambda a EC2 inštancie.',
    icon: '☁️',
    unavailable: true,
  },
  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Monitoring dashboardy a vizualizácia metrík.',
    icon: '📊',
    unavailable: true,
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Projektový manažment a sledovanie úloh.',
    icon: '📋',
    comingSoon: true,
  },
];

interface ConnectorsViewProps {
  onBack: () => void;
  onOpenMobileMenu?: () => void;
}

export default function ConnectorsView({ onBack, onOpenMobileMenu }: ConnectorsViewProps) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Integration | null>(null);

  const handleCardClick = (item: Integration) => {
    if (item.unavailable) return;
    setSelected(item);
  };

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
          {integrations.map(item => {
            const isDisabled = !!item.unavailable;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isDisabled}
                onClick={() => handleCardClick(item)}
                className={`text-left p-5 bg-card border border-border rounded-2xl transition-all group relative ${
                  isDisabled
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:border-primary/30 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{item.icon}</span>
                  <div className="flex flex-col items-end gap-1">
                    {item.dashboardPath ? (
                      <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-muted text-muted-foreground">
                        Dashboard
                      </span>
                    ) : item.comingSoon || item.unavailable ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium flex items-center gap-1">
                        <Zap size={10} /> Čoskoro
                      </span>
                    ) : null}
                  </div>
                </div>
                <h3 className="text-foreground font-medium text-sm">{item.name}</h3>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{item.description}</p>
              </button>
            );
          })}
        </div>

        <button
          onClick={onBack}
          className="mt-8 px-6 py-2.5 bg-card border border-border text-foreground hover:bg-accent rounded-full font-medium text-sm transition-colors shadow-sm"
        >
          Späť na Workspace
        </button>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{selected.icon}</span>
                <div>
                  <h3 className="text-lg font-medium text-foreground">{selected.name}</h3>
                  {selected.dashboardPath && (
                    <span className="text-xs font-medium text-muted-foreground">Správa cez dashboard</span>
                  )}
                  {(selected.comingSoon || selected.unavailable) && (
                    <span className="text-xs font-medium text-warning">Čoskoro</span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground p-1">
                <X size={18} />
              </button>
            </div>
            <p className="text-muted-foreground text-sm mb-6">{selected.description}</p>

            {selected.dashboardPath ? (
              <div className="space-y-3">
                {selected.id === 'wordpress' && (
                  <div className="rounded-xl border border-border bg-accent/60 p-4 text-xs text-muted-foreground">
                    <p>Pripojenie WordPressu prebieha cez existujúci proxy layer (<code className="font-mono">wordpress-proxy</code>) a dashboard — nie cez manuálny API kľúč v tomto formulári.</p>
                  </div>
                )}
                <button
                  onClick={() => { setSelected(null); navigate(selected.dashboardPath!); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-colors"
                >
                  <LayoutDashboard size={14} />
                  {selected.id === 'github' ? 'Otvoriť GitHub dashboard' : 'Otvoriť WordPress dashboard'}
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="w-full px-4 py-2.5 bg-card border border-border text-foreground rounded-full text-sm font-medium hover:bg-accent transition-colors"
                >
                  Zavrieť
                </button>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground mb-4">
                  OAuth integrácia zatiaľ nie je k dispozícii. Táto služba bude dostupná v ďalšej verzii wpBOX.
                </p>
                <button
                  onClick={() => setSelected(null)}
                  className="px-4 py-2.5 bg-card border border-border text-foreground rounded-full text-sm font-medium hover:bg-accent transition-colors"
                >
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
