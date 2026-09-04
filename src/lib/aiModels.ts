export const ALLOWED_AI_MODELS = [
  'mistral-large-latest',
  'mistral-medium',
  'mistral-small',
  'mistral-tiny',
  'mixtral-8x7b-latest',
  'codestral-latest',
  'pixtral-12b-latest',
] as const;

export function getSelectedAiModel(): string {
  return localStorage.getItem('ai-model') || 'mistral-large-latest';
}

export function validateAiModel(model: string): { ok: boolean; detail: string } {
  if (ALLOWED_AI_MODELS.includes(model as (typeof ALLOWED_AI_MODELS)[number])) {
    return { ok: true, detail: model };
  }
  return { ok: false, detail: `Neplatný model: ${model}` };
}
