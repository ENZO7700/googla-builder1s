import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

export interface ArchiveFile {
  path: string;
  size: number;
  isText: boolean;
  content: string;      // text content ('' for binary)
  selected: boolean;    // include in AI prompt
  dirty?: boolean;      // edited in canvas
}

export const MAX_FILES_IN_ARCHIVE = 200;
export const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_PROMPT_BYTES = 120 * 1024;        // total content sent to AI
export const MAX_PROMPT_FILE_BYTES = 24 * 1024;    // per-file cap in prompt

const IGNORED = [
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.next\//,
  /(^|\/)coverage\//,
  /(^|\/)__MACOSX\//i,
  /(^|\/)\.DS_Store$/,
  /(^|\/)bun\.lockb$/,
  /(^|\/)package-lock\.json$/,
];

const TEXT_EXT =
  /\.(txt|md|mdx|json|jsonc|csv|tsv|js|mjs|cjs|ts|tsx|jsx|vue|svelte|py|rb|go|rs|java|kt|php|c|h|cpp|cs|sh|bash|zsh|sql|html|htm|css|scss|sass|less|xml|yml|yaml|toml|ini|env|conf|log|gitignore|editorconfig|prettierrc|eslintrc|lock)$/i;

export function isZipFile(file: File) {
  return /\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
}

function looksBinary(bytes: Uint8Array) {
  const limit = Math.min(bytes.length, 4096);
  let suspicious = 0;
  for (let i = 0; i < limit; i++) {
    const b = bytes[i];
    if (b === 0) return true;
    if (b < 7 || (b > 13 && b < 32)) suspicious++;
  }
  return limit > 0 && suspicious / limit > 0.1;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export interface UnzipResult {
  files: ArchiveFile[];
  skipped: string[];
  truncated: boolean;
}

/** Unzip a File in the browser and return a filtered, text-aware file list. */
export async function readZipFile(file: File): Promise<UnzipResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(buf);
  const files: ArchiveFile[] = [];
  const skipped: string[] = [];
  let truncated = false;

  for (const [path, bytes] of Object.entries(entries)) {
    if (path.endsWith('/')) continue;
    if (IGNORED.some(rx => rx.test(path))) { skipped.push(path); continue; }
    if (files.length >= MAX_FILES_IN_ARCHIVE) { truncated = true; break; }

    const textByExt = TEXT_EXT.test(path) || !/\.[a-z0-9]+$/i.test(path);
    const isText = textByExt && bytes.length <= MAX_TEXT_FILE_BYTES && !looksBinary(bytes);
    files.push({
      path,
      size: bytes.length,
      isText,
      content: isText ? strFromU8(bytes) : '',
      selected: isText,
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, skipped, truncated };
}

/** Build the archive context block that is prepended to the AI prompt. */
export function buildArchiveContext(archiveName: string, files: ArchiveFile[]): string {
  const tree = files.map(f => `- ${f.path} (${formatBytes(f.size)}${f.isText ? '' : ', binárny'})`).join('\n');
  const chosen = files.filter(f => f.selected && f.isText);

  let used = 0;
  const blocks: string[] = [];
  const omitted: string[] = [];

  for (const f of chosen) {
    if (used >= MAX_PROMPT_BYTES) { omitted.push(f.path); continue; }
    let body = f.content;
    let note = '';
    if (body.length > MAX_PROMPT_FILE_BYTES) {
      body = body.slice(0, MAX_PROMPT_FILE_BYTES);
      note = '\n... (skrátené)';
    }
    used += body.length;
    blocks.push(`--- FILE: ${f.path} ---\n\`\`\`\n${body}${note}\n\`\`\``);
  }

  return [
    `[ZIP archív: ${archiveName}] — ${files.length} súborov`,
    '',
    'Štruktúra:',
    tree,
    '',
    blocks.length ? `Obsah vybraných súborov:\n\n${blocks.join('\n\n')}` : 'Žiadne textové súbory neboli vybrané.',
    omitted.length ? `\n(Neposlané pre limit veľkosti: ${omitted.join(', ')})` : '',
  ].join('\n');
}

/** Repack the (possibly edited) files back into a downloadable zip. */
export function packZip(files: ArchiveFile[]): Blob {
  const data: Record<string, Uint8Array> = {};
  for (const f of files) {
    if (!f.isText) continue; // binary content is not retained in memory
    data[f.path] = strToU8(f.content);
  }
  return new Blob([zipSync(data) as unknown as BlobPart], { type: 'application/zip' });
}

export function downloadZip(files: ArchiveFile[], name = 'upraveny-archiv.zip') {
  const url = URL.createObjectURL(packZip(files));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function isPreviewable(path: string) {
  return /\.(html?|svg)$/i.test(path);
}
