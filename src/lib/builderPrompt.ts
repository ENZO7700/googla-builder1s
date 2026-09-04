const PROMPT_KEY = 'builderPrompt';
const SOURCE_KEY = 'builderPromptSource';

export interface BuilderPromptHandoff {
  prompt: string;
  source: string | null;
}

/** Read and clear Launch Audit / Blueprint handoff keys (same as workspace Index pickup). */
export function consumeBuilderPrompt(): BuilderPromptHandoff | null {
  try {
    const prompt = sessionStorage.getItem(PROMPT_KEY);
    if (!prompt) return null;
    const source = sessionStorage.getItem(SOURCE_KEY);
    sessionStorage.removeItem(PROMPT_KEY);
    sessionStorage.removeItem(SOURCE_KEY);
    return { prompt, source };
  } catch {
    return null;
  }
}

export function setBuilderPromptHandoff(prompt: string, source: string): void {
  sessionStorage.setItem(PROMPT_KEY, prompt);
  sessionStorage.setItem(SOURCE_KEY, source);
}
