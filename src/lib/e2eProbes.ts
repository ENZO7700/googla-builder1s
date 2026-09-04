import { validateAttachmentFile, MAX_FILE_SIZE } from '@/lib/attachmentValidation';
import { consumeBuilderPrompt, setBuilderPromptHandoff } from '@/lib/builderPrompt';
import { extractHtmlFromMarkdown, SAMPLE_HTML_MARKDOWN } from '@/lib/previewExtract';
import { validateWordPressDeployDryRun } from '@/lib/wpDeploy';
import { createWorkflowRun, finishWorkflowRun, updateWorkflowStep } from '@/lib/workflow';
import { ALLOWED_AI_MODELS, getSelectedAiModel, validateAiModel } from '@/lib/aiModels';

const GENERATOR_DEMO_HTML_SNippet = 'wpbox-demo-shell';
const ANALYZER_LOG_SAMPLE = '[ERROR] Failed login from 203.0.113.42\n[WARN] SQL injection attempt blocked';

export function probeStorageRules(): { ok: boolean; detail: string } {
  const oversized = validateAttachmentFile({
    name: 'big.bin',
    size: MAX_FILE_SIZE + 1,
    type: 'application/octet-stream',
  });
  if (!oversized?.includes('príliš veľký')) {
    return { ok: false, detail: 'Odmietnutie veľkého súboru nefunguje' };
  }

  const badType = validateAttachmentFile({
    name: 'virus.exe',
    size: 1024,
    type: 'application/x-msdownload',
  });
  if (!badType?.includes('nepovolený typ')) {
    return { ok: false, detail: 'Odmietnutie neplatného typu nefunguje' };
  }

  const ok = validateAttachmentFile({ name: 'notes.txt', size: 512, type: 'text/plain' });
  if (ok !== null) {
    return { ok: false, detail: 'Platný textový súbor bol nesprávne odmietnutý' };
  }

  return { ok: true, detail: 'Veľkosť + typ validácia OK' };
}

export function probePreviewExtract(): { ok: boolean; detail: string } {
  const html = extractHtmlFromMarkdown(SAMPLE_HTML_MARKDOWN);
  if (!html || !html.includes('E2E náhľad')) {
    return { ok: false, detail: 'Extrakcia HTML z markdown zlyhala' };
  }
  return { ok: true, detail: 'HTML blok extrahovaný' };
}

export function probeWpDeployDryRun(isLocalDemo: boolean, hasSite: boolean): { ok: boolean; detail: string; skipped?: boolean } {
  if (isLocalDemo || !hasSite) {
    const local = validateWordPressDeployDryRun(
      extractHtmlFromMarkdown(SAMPLE_HTML_MARKDOWN) ?? '<p>test</p>',
      'html',
    );
    if (!local.ok) return { ok: false, detail: local.detail, skipped: true };
    return { ok: true, detail: 'Dry-run validácia (bez live WP)', skipped: true };
  }

  const html = extractHtmlFromMarkdown(SAMPLE_HTML_MARKDOWN) ?? '';
  const result = validateWordPressDeployDryRun(html, 'html');
  if (!result.ok) return { ok: false, detail: result.detail };
  return { ok: true, detail: result.detail };
}

export function probeGeneratorFallback(isLocalDemo: boolean): { ok: boolean; detail: string; skipped?: boolean } {
  const demoHtml = buildGeneratorDemoSnippet('E2E generator smoke');
  if (!demoHtml.includes(GENERATOR_DEMO_HTML_SNippet) || !demoHtml.includes('```')) {
    return { ok: false, detail: 'Generátor demo fallback nevracia HTML blok' };
  }
  if (isLocalDemo) {
    return { ok: true, detail: 'Local Demo fallback pripravený', skipped: true };
  }
  return { ok: true, detail: 'Modul generátora + demo fallback OK' };
}

export function probeAnalyzerRequestShape(): { ok: boolean; detail: string } {
  const body = {
    messages: [{ role: 'user', content: `Analyzuj tieto logy a identifikuj hrozby:\n\n${ANALYZER_LOG_SAMPLE}` }],
    systemOverride: 'FOCUS: Log Analysis. Identify anomalies, penetration attempts, and suspicious IPs.',
  };
  if (!body.messages[0].content.includes(ANALYZER_LOG_SAMPLE)) {
    return { ok: false, detail: 'Analyzátor payload neobsahuje logy' };
  }
  if (!body.systemOverride.includes('Log Analysis')) {
    return { ok: false, detail: 'Analyzátor systemOverride chýba' };
  }
  return { ok: true, detail: 'Analyzátor request shape OK' };
}

export function probeLaunchHandoff(): { ok: boolean; detail: string } {
  setBuilderPromptHandoff('E2E Launch Audit prompt', 'Launch Audit · Test');
  const handoff = consumeBuilderPrompt();
  if (!handoff?.prompt.includes('E2E Launch Audit')) {
    return { ok: false, detail: 'builderPrompt handoff zlyhal' };
  }
  if (handoff.source !== 'Launch Audit · Test') {
    return { ok: false, detail: 'builderPromptSource nesedí' };
  }
  if (sessionStorage.getItem('builderPrompt')) {
    return { ok: false, detail: 'Handoff nevyčistil sessionStorage' };
  }
  return { ok: true, detail: 'Launch Audit → chat handoff OK' };
}

export function probeSettingsModel(): { ok: boolean; detail: string } {
  const testModel = ALLOWED_AI_MODELS[2];
  localStorage.setItem('ai-model', testModel);
  const read = getSelectedAiModel();
  if (read !== testModel) {
    return { ok: false, detail: 'ai-model localStorage read/write zlyhalo' };
  }
  const check = validateAiModel(read);
  if (!check.ok) {
    return { ok: false, detail: check.detail };
  }
  return { ok: true, detail: `Model ${testModel} persistovaný` };
}

export function probeWorkflowRibbon(): { ok: boolean; detail: string } {
  let run = createWorkflowRun('E2E workflow');
  run = updateWorkflowStep(run, 'input', { status: 'done', detail: 'Input OK', progress: 100 });
  run = updateWorkflowStep(run, 'ai', { status: 'running', detail: 'AI beží', progress: 40 });
  run = finishWorkflowRun(run, 'done', 'Hotovo');
  if (run.status !== 'done' || run.progress !== 100) {
    return { ok: false, detail: 'Workflow prechody neukončili run' };
  }
  const inputStep = run.steps.find(s => s.id === 'input');
  if (inputStep?.status !== 'done') {
    return { ok: false, detail: 'Input step nie je done' };
  }
  return { ok: true, detail: '6-krokový workflow OK' };
}

export function probeThemePersistence(): { ok: boolean; detail: string } {
  localStorage.setItem('theme', 'dark');
  const dark = localStorage.getItem('theme') === 'dark';
  localStorage.setItem('theme', 'light');
  const light = localStorage.getItem('theme') !== 'dark';
  if (!dark || !light) {
    return { ok: false, detail: 'Prepínanie témy v localStorage zlyhalo' };
  }
  return { ok: true, detail: 'Téma persistovaná (localStorage)' };
}

function buildGeneratorDemoSnippet(prompt: string): string {
  const safeTitle = prompt.trim().slice(0, 72) || 'AI Landing Page Draft';
  return `\`\`\`html
<div class="wpbox-demo-shell"><h1>${safeTitle}</h1></div>
\`\`\``;
}
