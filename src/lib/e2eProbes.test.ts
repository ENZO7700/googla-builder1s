import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { validateAttachmentFile, MAX_FILE_SIZE } from '@/lib/attachmentValidation';
import { extractHtmlFromMarkdown, SAMPLE_HTML_MARKDOWN } from '@/lib/previewExtract';
import { validateWordPressDeployDryRun, sanitizeGeneratedHtmlForWordPress } from '@/lib/wpDeploy';
import {
  probeAnalyzerRequestShape,
  probeGeneratorFallback,
  probeLaunchHandoff,
  probePreviewExtract,
  probeSettingsModel,
  probeStorageRules,
  probeThemePersistence,
  probeWorkflowRibbon,
  probeWpDeployDryRun,
} from '@/lib/e2eProbes';

describe('e2eProbes', () => {
  it('rejects oversized and invalid attachment types', () => {
    expect(probeStorageRules().ok).toBe(true);
    expect(validateAttachmentFile({ name: 'x.exe', size: 100, type: 'application/octet-stream' })).toBeTruthy();
    expect(validateAttachmentFile({ name: 'ok.txt', size: 100, type: 'text/plain' })).toBeNull();
    expect(validateAttachmentFile({ name: 'big.txt', size: MAX_FILE_SIZE + 1, type: 'text/plain' })).toBeTruthy();
  });

  it('extracts HTML preview blocks from markdown', () => {
    expect(probePreviewExtract().ok).toBe(true);
    expect(extractHtmlFromMarkdown(SAMPLE_HTML_MARKDOWN)).toContain('E2E náhľad');
  });

  it('validates WP deploy dry-run without live writes', () => {
    const html = extractHtmlFromMarkdown(SAMPLE_HTML_MARKDOWN)!;
    const dry = validateWordPressDeployDryRun(html, 'html');
    expect(dry.ok).toBe(true);
    expect(dry.payload?.body.status).toBe('draft');
    expect(probeWpDeployDryRun(true, false).skipped).toBe(true);
  });

  it('sanitizes dangerous URL placeholders in HTML', () => {
    const safe = sanitizeGeneratedHtmlForWordPress('<a href="{{EVIL}}">x</a>');
    expect(safe).not.toContain('{{EVIL}}');
  });

  it('validates analyzer request shape', () => {
    expect(probeAnalyzerRequestShape().ok).toBe(true);
  });

  it('consumes Launch Audit builderPrompt handoff', () => {
    expect(probeLaunchHandoff().ok).toBe(true);
  });

  it('runs workflow ribbon step transitions', () => {
    expect(probeWorkflowRibbon().ok).toBe(true);
  });

  describe('settings and theme', () => {
    let savedModel: string | null;
    let savedTheme: string | null;

    beforeEach(() => {
      savedModel = localStorage.getItem('ai-model');
      savedTheme = localStorage.getItem('theme');
    });

    afterEach(() => {
      if (savedModel) localStorage.setItem('ai-model', savedModel);
      else localStorage.removeItem('ai-model');
      if (savedTheme) localStorage.setItem('theme', savedTheme);
      else localStorage.removeItem('theme');
    });

    it('persists ai-model selection', () => {
      expect(probeSettingsModel().ok).toBe(true);
    });

    it('persists theme toggle', () => {
      expect(probeThemePersistence().ok).toBe(true);
    });
  });

  it('provides generator demo fallback', () => {
    expect(probeGeneratorFallback(true).ok).toBe(true);
  });
});
