import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractCodeBlocks, copyToClipboard } from '@/lib/chatExport';

describe('chatExport', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('extracts a single code block', () => {
    const md = 'Hello\n```js\nconst a = 1;\n```\nDone';
    expect(extractCodeBlocks(md)).toContain('const a = 1;');
  });

  it('joins multiple code blocks with a separator', () => {
    const md = '```py\nx=1\n```\nbla\n```py\ny=2\n```';
    const out = extractCodeBlocks(md);
    expect(out).toContain('x=1');
    expect(out).toContain('y=2');
    expect(out).toContain('/* ---- */');
  });

  it('returns empty string when no code blocks', () => {
    expect(extractCodeBlocks('plain text')).toBe('');
  });

  it('handles code blocks without language', () => {
    expect(extractCodeBlocks('```\nbody\n```')).toContain('body');
  });

  it('copyToClipboard returns true on success', async () => {
    const ok = await copyToClipboard('hello');
    expect(ok).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it('copyToClipboard returns false on failure', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('nope')) },
    });
    expect(await copyToClipboard('x')).toBe(false);
  });
});
