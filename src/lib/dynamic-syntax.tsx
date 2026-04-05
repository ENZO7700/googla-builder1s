import React, { useEffect, useState } from 'react';

interface DynamicSyntaxProps {
  language?: string;
  children: React.ReactNode;
  PreTag?: string;
  customStyle?: React.CSSProperties;
}

const aliasMap: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  py: 'python',
  sh: 'bash',
  bash: 'bash',
};

export default function DynamicSyntax({ language, children, PreTag = 'div', customStyle }: DynamicSyntaxProps) {
  const [Syntax, setSyntax] = useState<any>(null);
  const [style, setStyle] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const lang = language ? (aliasMap[language] ?? language) : undefined;

    async function load() {
      try {
        const [{ Prism }, styleModule] = await Promise.all([
          import('react-syntax-highlighter/dist/esm/prism-light'),
          import('react-syntax-highlighter/dist/esm/styles/prism/one-dark'),
        ]);

        // Attempt to load the language module if available
        if (lang) {
          try {
            const langMod = await import(
              /* @vite-ignore */ `react-syntax-highlighter/dist/esm/languages/prism/${lang}`
            );
            if (langMod && langMod.default && Prism && Prism.register) {
              Prism.registerLanguage(lang, langMod.default);
            }
          } catch (e) {
            // language module not found; ignore and continue
          }
        }

        if (!mounted) return;
        setStyle(styleModule.oneDark ?? styleModule.default ?? styleModule);
        setSyntax(() => Prism);
        setLoaded(true);
      } catch (err) {
        // ignore load errors
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [language]);

  if (!loaded || !Syntax) {
    return <div className="p-4">Načítavam zvýraznenie...</div>;
  }

  return (
    // @ts-ignore - dynamic component
    <Syntax style={style} language={language} PreTag={PreTag} customStyle={customStyle}>
      {children}
    </Syntax>
  );
}
