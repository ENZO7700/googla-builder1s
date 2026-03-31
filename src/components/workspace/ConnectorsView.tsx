import { Plug } from 'lucide-react';

interface ConnectorsViewProps {
  onBack: () => void;
}

export default function ConnectorsView({ onBack }: ConnectorsViewProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-sm">
        <div className="inline-flex p-6 rounded-full bg-accent border border-border text-muted-foreground mb-2">
          <Plug size={48} />
        </div>
        <h2 className="text-2xl font-normal text-foreground">Integrácie API</h2>
        <p className="text-muted-foreground text-sm">
          Modul pre správu OAuth2 a SAML pripojení je momentálne v údržbe.
        </p>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2.5 bg-card border border-border text-foreground hover:bg-accent rounded-full font-medium text-sm transition-colors shadow-sm"
        >
          Späť na Workspace
        </button>
      </div>
    </div>
  );
}
