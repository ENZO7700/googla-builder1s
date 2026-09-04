import { describe, expect, it } from 'vitest';
import {
  E2E_STEP_DISPLAY_LABELS,
  E2E_STEP_LABELS,
  formatE2ESummaryLine,
  summarizeE2EResults,
  type E2EResult,
} from './e2eTest';
import { getSelectedAiModel, validateAiModel, ALLOWED_AI_MODELS } from './aiModels';

describe('e2eTest helpers', () => {
  it('summarizes passed, skipped, and failed steps', () => {
    const results: E2EResult[] = [
      { step: 'Auth', passed: true, detail: 'ok', durationMs: 1 },
      { step: 'DB CRUD', passed: true, skipped: true, detail: 'Preskočené v Local Demo', durationMs: 1 },
      { step: 'Storage', passed: false, detail: 'Upload failed', durationMs: 1 },
    ];

    expect(summarizeE2EResults(results)).toEqual({
      passed: 1,
      skipped: 1,
      failed: 1,
      total: 3,
    });
  });

  it('formats success and failure summary lines in Slovak', () => {
    expect(formatE2ESummaryLine({ passed: 5, skipped: 2, failed: 0, total: 7 }))
      .toBe('E2E test: 5/7 OK (2 preskočené)');

    expect(formatE2ESummaryLine({ passed: 4, skipped: 1, failed: 2, total: 7 }))
      .toBe('E2E test zlyhal: 2 chýb (1 preskočené)');
  });

  it('validates allowed AI models', () => {
    for (const model of ALLOWED_AI_MODELS) {
      expect(validateAiModel(model).ok).toBe(true);
    }
    expect(validateAiModel('gpt-4').ok).toBe(false);
  });

  it('falls back to default model when localStorage is empty', () => {
    localStorage.removeItem('ai-model');
    expect(getSelectedAiModel()).toBe('mistral-large-latest');
  });

  it('lists all Diagnostika steps with Slovak display labels', () => {
    expect(E2E_STEP_LABELS.length).toBe(19);
    for (const step of E2E_STEP_LABELS) {
      expect(E2E_STEP_DISPLAY_LABELS[step]).toBeTruthy();
    }
    expect(E2E_STEP_DISPLAY_LABELS['Generátor']).toBe('Generátor / Skills');
    expect(E2E_STEP_DISPLAY_LABELS['Launch Handoff']).toBe('Launch Audit handoff');
  });
});
