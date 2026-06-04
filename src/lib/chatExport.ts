// Utilities for exporting AI chat messages to various formats

export interface ExportMessage {
  role: string;
  content: string;
}

const ts = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function extractCodeBlocks(markdown: string): string {
  if (!markdown) return '';
  const parts = markdown.split('```');
  const blocks: string[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const block = parts[i];
    const nl = block.indexOf('\n');
    blocks.push(nl >= 0 ? block.slice(nl + 1) : block);
  }
  return blocks.join('\n\n/* ---- */\n\n');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function exportAsMarkdown(content: string, name = 'ai-response') {
  downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), `${name}-${ts()}.md`);
}

export function exportAsHtml(content: string, name = 'ai-response') {
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const html = `<!doctype html>
<html lang="sk"><head><meta charset="utf-8"><title>${name}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Inter,sans-serif;max-width:820px;margin:2rem auto;padding:0 1.25rem;color:#0f172a;line-height:1.6}
  pre{background:#0f172a;color:#e2e8f0;padding:1rem;border-radius:.75rem;overflow:auto;font-size:13px}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  h1,h2,h3{margin-top:2rem}
</style></head><body><pre>${escaped}</pre></body></html>`;
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${name}-${ts()}.html`);
}

export function exportAsPdf(content: string, name = 'ai-response') {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${name}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Inter,sans-serif;max-width:780px;margin:1.5rem auto;padding:0 1rem;color:#111;line-height:1.55}
  pre{white-space:pre-wrap;word-wrap:break-word;background:#f3f4f6;padding:1rem;border-radius:.5rem;font-size:12.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  @media print { body { margin: 0.5in; } }
</style></head><body><pre>${escaped}</pre>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),200));</script>
</body></html>`);
  w.document.close();
}

export function exportAllMessagesMarkdown(messages: ExportMessage[]) {
  const md = messages
    .map(m => `## ${m.role === 'user' ? '🧑 Používateľ' : '🤖 AI'}\n\n${m.content}`)
    .join('\n\n---\n\n');
  exportAsMarkdown(md, 'chat-transcript');
}
