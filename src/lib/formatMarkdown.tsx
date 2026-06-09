import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy, ChevronDown, ChevronUp, WrapText } from 'lucide-react';
import { copyToClipboard } from '@/lib/chatExport';

interface MarkdownRendererProps {
  content: string;
  onCopy?: () => void;
}

const COLLAPSE_LINE_THRESHOLD = 40;

function CodeBlock({ language, code, onCopy }: { language: string; code: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);
  const lineCount = code.split('\n').length;
  const longBlock = lineCount > COLLAPSE_LINE_THRESHOLD;
  const [collapsed, setCollapsed] = useState(longBlock);

  const handleCopy = async () => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-border bg-card">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-muted/95 backdrop-blur-sm text-xs border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground font-mono font-medium">{language}</span>
          <span className="text-muted-foreground/70 text-[11px]">{lineCount} riadkov</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWrap(w => !w)}
            className={`p-1.5 rounded transition-colors ${wrap ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            title="Zalomenie riadkov"
            aria-label="Toggle word wrap"
          >
            <WrapText size={13} />
          </button>
          {longBlock && (
            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1"
              title={collapsed ? 'Rozbaliť' : 'Zbaliť'}
            >
              {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
              <span className="text-[11px]">{collapsed ? 'Rozbaliť' : 'Zbaliť'}</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1"
            title="Kopírovať kód"
            aria-label="Copy code"
          >
            {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
            <span className="text-[11px]">{copied ? 'Skopírované' : 'Kopírovať'}</span>
          </button>
        </div>
      </div>
      <div
        className="relative overflow-x-auto overflow-y-hidden [scrollbar-width:thin] [scrollbar-color:hsl(var(--border))_transparent] [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar-track]:bg-background/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/60"
        style={{ maxHeight: collapsed ? '280px' : 'none' }}
      >
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          showLineNumbers
          wrapLongLines={wrap}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '13px',
            background: 'hsl(var(--card))',
          }}
          lineNumberStyle={{ minWidth: '2.5em', paddingRight: '1em', opacity: 0.4, userSelect: 'none' }}
        >
          {code}
        </SyntaxHighlighter>
        {collapsed && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent flex items-end justify-center pb-2"
          >
            <button
              onClick={() => setCollapsed(false)}
              className="pointer-events-auto text-[11px] px-3 py-1 rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90"
            >
              Zobraziť celý kód ({lineCount - 15}+ riadkov)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MarkdownRenderer({ content, onCopy }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeStr = String(children).replace(/\n$/, '');

          if (match) {
            return <CodeBlock language={match[1]} code={codeStr} onCopy={onCopy} />;
          }

          return (
            <code className="px-1.5 py-0.5 bg-muted text-foreground rounded text-[13px] font-mono" {...props}>
              {children}
            </code>
          );
        },
        p({ children }) {
          return <p className="mb-3 leading-relaxed">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>;
        },
        h1({ children }) {
          return <h1 className="text-xl font-semibold mb-3 mt-4">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-lg font-semibold mb-2 mt-4">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-base font-semibold mb-2 mt-3">{children}</h3>;
        },
        blockquote({ children }) {
          return <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground mb-3">{children}</blockquote>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// Keep backward compat
export function formatMarkdown(text: string, onCopy?: () => void) {
  if (!text) return [];
  return [<MarkdownRenderer key="md" content={text} onCopy={onCopy} />];
}
