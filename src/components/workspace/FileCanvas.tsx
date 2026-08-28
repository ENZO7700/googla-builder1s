import { useMemo, useState } from 'react';
import {
  FileCode, Folder, Save, Download, Sparkles, Wand2, Eye, Trash2, CheckSquare, Square, FileArchive,
} from 'lucide-react';
import { ArchiveFile, formatBytes, downloadZip, isPreviewable } from '@/lib/archive/zipWorkspace';

interface FileCanvasProps {
  archiveName: string;
  files: ArchiveFile[];
  activePath: string | null;
  onSelectFile: (path: string) => void;
  onToggleSelected: (path: string) => void;
  onToggleAll: (selected: boolean) => void;
  onChangeContent: (path: string, content: string) => void;
  onAskAgent: (path: string) => void;
  onApplyAiCode: (path: string) => void;
  canApplyAiCode: boolean;
  onPreviewFile: (path: string) => void;
  onClear: () => void;
}

export default function FileCanvas({
  archiveName, files, activePath, onSelectFile, onToggleSelected, onToggleAll,
  onChangeContent, onAskAgent, onApplyAiCode, canApplyAiCode, onPreviewFile, onClear,
}: FileCanvasProps) {
  const [filter, setFilter] = useState('');
  const active = files.find(f => f.path === activePath) ?? null;

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const map = new Map<string, ArchiveFile[]>();
    for (const f of files) {
      if (q && !f.path.toLowerCase().includes(q)) continue;
      const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '.';
      if (!map.has(dir)) map.set(dir, []);
      map.get(dir)!.push(f);
    }
    return Array.from(map.entries());
  }, [files, filter]);

  const selectedCount = files.filter(f => f.selected).length;
  const allSelected = selectedCount === files.filter(f => f.isText).length && selectedCount > 0;

  if (!files.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full text-muted-foreground p-8 text-center">
        <FileArchive size={40} className="text-border mb-4" />
        <p className="text-lg text-foreground font-medium">Žiadny archív</p>
        <p className="mt-2 text-sm max-w-sm">
          Pridajte ZIP súbor ako prílohu v chate. Rozbalí sa v prehliadači a súbory sa dajú upravovať tu v canvase.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0">
      {/* Tree */}
      <div className="w-[38%] max-w-[340px] border-r border-border flex flex-col min-h-0">
        <div className="p-2 border-b border-border space-y-2">
          <div className="flex items-center gap-2 text-xs text-foreground font-medium truncate">
            <FileArchive size={14} className="text-primary shrink-0" />
            <span className="truncate">{archiveName}</span>
          </div>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filtrovať súbory..."
            aria-label="Filtrovať súbory v archíve"
            className="w-full bg-accent border border-border rounded-md px-2 py-1.5 text-[12px] outline-none focus:border-primary"
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <button
              onClick={() => onToggleAll(!allSelected)}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              {allSelected ? <CheckSquare size={12} /> : <Square size={12} />}
              {allSelected ? 'Odznačiť všetko' : 'Označiť textové'}
            </button>
            <span>{selectedCount} / {files.length}</span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
          {grouped.map(([dir, list]) => (
            <div key={dir}>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1 truncate">
                <Folder size={11} /> {dir}
              </div>
              <div className="space-y-0.5">
                {list.map(f => (
                  <div
                    key={f.path}
                    className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] ${
                      f.path === activePath ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60'
                    }`}
                  >
                    <button
                      onClick={() => onToggleSelected(f.path)}
                      disabled={!f.isText}
                      title={f.isText ? 'Poslať agentovi' : 'Binárny súbor'}
                      aria-label={`Prepnúť výber ${f.path}`}
                      className="disabled:opacity-30"
                    >
                      {f.selected ? <CheckSquare size={12} className="text-primary" /> : <Square size={12} />}
                    </button>
                    <button
                      onClick={() => f.isText && onSelectFile(f.path)}
                      className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                      disabled={!f.isText}
                    >
                      <FileCode size={12} className="shrink-0" />
                      <span className="truncate">{f.path.split('/').pop()}</span>
                      {f.dirty && <span className="text-primary text-[10px]">●</span>}
                    </button>
                    <span className="text-[10px] shrink-0">{formatBytes(f.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-2 border-t border-border flex gap-2">
          <button
            onClick={() => downloadZip(files, archiveName.replace(/\.zip$/i, '') + '-upraveny.zip')}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] px-2 py-1.5 bg-card border border-border rounded-md hover:bg-accent transition-colors"
          >
            <Download size={12} /> Stiahnuť ZIP
          </button>
          <button
            onClick={onClear}
            title="Zavrieť archív"
            aria-label="Zavrieť archív"
            className="px-2 py-1.5 border border-border rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {active ? (
          <>
            <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-mono text-foreground truncate flex-1 min-w-0">{active.path}</span>
              <button
                onClick={() => onAskAgent(active.path)}
                className="flex items-center gap-1 text-[11px] px-2 py-1 bg-primary text-primary-foreground rounded-md hover:opacity-90"
              >
                <Wand2 size={12} /> Poslať agentovi
              </button>
              <button
                onClick={() => onApplyAiCode(active.path)}
                disabled={!canApplyAiCode}
                className="flex items-center gap-1 text-[11px] px-2 py-1 bg-card border border-border rounded-md hover:bg-accent disabled:opacity-40"
              >
                <Sparkles size={12} /> Aplikovať návrh AI
              </button>
              {isPreviewable(active.path) && (
                <button
                  onClick={() => onPreviewFile(active.path)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 bg-card border border-border rounded-md hover:bg-accent"
                >
                  <Eye size={12} /> Náhľad
                </button>
              )}
              {active.dirty && (
                <span className="flex items-center gap-1 text-[11px] text-primary">
                  <Save size={12} /> uložené v pamäti
                </span>
              )}
            </div>
            <textarea
              value={active.content}
              onChange={e => onChangeContent(active.path, e.target.value)}
              spellCheck={false}
              aria-label={`Editor súboru ${active.path}`}
              className="flex-1 min-h-0 w-full resize-none bg-console text-console-text font-mono text-[12px] leading-relaxed p-3 outline-none"
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
            Vyberte súbor zo zoznamu vľavo.
          </div>
        )}
      </div>
    </div>
  );
}
