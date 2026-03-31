import { ReactNode } from 'react';

export function formatMarkdown(text: string, onCopy?: () => void): ReactNode[] {
  if (!text) return [];
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((segment, index) => {
    if (segment.startsWith('```') && segment.endsWith('```')) {
      const lines = segment.split('\n');
      const firstLine = lines[0].replace(/```/g, '').trim();
      const language = firstLine || 'text';
      const code = lines.slice(1, -1).join('\n') || lines.join('\n').replace(/```/g, '');

      return (
        <div key={index} className="my-4 rounded-xl overflow-hidden border border-border">
          <div className="flex items-center justify-between px-4 py-2 bg-muted text-xs">
            <span className="text-muted-foreground font-mono font-medium">{language}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(code);
                onCopy?.();
              }}
              className="text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Kopírovať
            </button>
          </div>
          <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed bg-console text-console-text scrollbar-hide">
            <code>{code}</code>
          </pre>
        </div>
      );
    }

    // Inline markdown
    let formatted = segment
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-muted text-foreground rounded text-[13px] font-mono">$1</code>')
      .replace(/\n/g, '<br/>');

    return (
      <span
        key={index}
        className="leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
    );
  });
}
