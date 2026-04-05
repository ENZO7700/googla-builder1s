import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
  onCopy?: () => void;
}

export function MarkdownRenderer({ content, onCopy }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeStr = String(children).replace(/\n$/, '');

          if (match) {
            return (
              <div className="my-4 rounded-xl overflow-hidden border border-border">
                <div className="flex items-center justify-between px-4 py-2 bg-muted text-xs">
                  <span className="text-muted-foreground font-mono font-medium">{match[1]}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(codeStr);
                      onCopy?.();
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                  >
                    Kopírovať
                  </button>
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0, borderRadius: 0, fontSize: '13px' }}
                >
                  {codeStr}
                </SyntaxHighlighter>
              </div>
            );
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
// Legacy helper removed from this module to keep the file exporting only React components.
// If needed elsewhere, import `MarkdownRenderer` and wrap it accordingly.
