import { useState } from 'react';
import {
  Copy, Check, FileDown, FileText, FileCode2,
  RefreshCw, ArrowRight, Code2, Layout,
} from 'lucide-react';
import {
  copyToClipboard, exportAsMarkdown, exportAsHtml, exportAsPdf, extractCodeBlocks,
} from '@/lib/chatExport';

interface MessageActionsProps {
  content: string;
  onRegenerate?: () => void;
  onContinue?: () => void;
  onSendToPreview?: (html: string) => void;
}

export default function MessageActions({
  content, onRegenerate, onContinue, onSendToPreview,
}: MessageActionsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const flash = (key: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const hasHtml = /```(?:html|xml)/i.test(content);
  const hasCode = /```/.test(content);

  const Btn = ({
    icon, label, onClick, k, accent,
  }: { icon: React.ReactNode; label: string; onClick: () => void; k?: string; accent?: boolean }) => (
    <button
      onClick={onClick}
      className={`group/btn flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border ${
        accent
          ? 'border-primary/30 text-primary hover:bg-primary/10'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
      title={label}
    >
      {k && copiedKey === k ? <Check size={12} className="text-success" /> : icon}
      <span className="hidden sm:inline">{k && copiedKey === k ? 'Hotovo' : label}</span>
    </button>
  );

  return (
    <div className="mt-3 -mb-1 flex flex-wrap items-center gap-1 border-t border-border/60 pt-2">
      <Btn
        k="all"
        icon={<Copy size={12} />}
        label="Kopírovať"
        onClick={async () => { if (await copyToClipboard(content)) flash('all'); }}
      />
      {hasCode && (
        <Btn
          k="code"
          icon={<Code2 size={12} />}
          label="Iba kód"
          onClick={async () => { if (await copyToClipboard(extractCodeBlocks(content))) flash('code'); }}
        />
      )}
      <Btn icon={<FileDown size={12} />} label="Export .md" onClick={() => exportAsMarkdown(content)} />
      <Btn icon={<FileCode2 size={12} />} label="Export .html" onClick={() => exportAsHtml(content)} />
      <Btn icon={<FileText size={12} />} label="Export PDF" onClick={() => exportAsPdf(content)} />
      {hasHtml && onSendToPreview && (
        <Btn
          accent
          icon={<Layout size={12} />}
          label="Do Preview"
          onClick={() => {
            const parts = content.split('```');
            for (let i = 1; i < parts.length; i += 2) {
              const b = parts[i];
              if (/^(html|xml)/i.test(b)) {
                onSendToPreview(b.substring(b.indexOf('\n') + 1));
                return;
              }
            }
          }}
        />
      )}
      <div className="flex-1" />
      {onRegenerate && (
        <Btn icon={<RefreshCw size={12} />} label="Regenerovať" onClick={onRegenerate} />
      )}
      {onContinue && (
        <Btn icon={<ArrowRight size={12} />} label="Pokračovať" onClick={onContinue} />
      )}
    </div>
  );
}
