export type BlueprintDepth = 3 | 6 | 9 | 13;

export interface BlueprintCriteria {
  goal: string;
  type: string;
  stack: string;
  language: 'SK' | 'EN';
  priorities: string[];
  depth: BlueprintDepth;
  notes: string;
}

export const PROJECT_TYPES = [
  'Web app',
  'WordPress stránka',
  'API + backend',
  'AI agent',
  'Automatizácia',
];

export const STACKS = [
  'React + Tailwind',
  'WordPress',
  'Node / Edge funkcie',
  'Iné',
];

export const PRIORITIES = [
  'Rýchlosť',
  'SEO',
  'Bezpečnosť',
  'Škálovanie',
  'Dizajn',
  'Náklady',
];

export const DEPTHS: BlueprintDepth[] = [3, 6, 9, 13];

/** Kroky A–M. Hĺbka určuje, koľko prvých krokov sa použije (poradie je zámerné). */
const STEPS: string[] = [
  'Scaffold projektu + design system (tokeny, typografia, layout shell)',
  'Hlavná funkcionalita / core user flow',
  'Nasadenie + QA smoke test',
  'Dátový model + backend (tabuľky, RLS, API vrstva)',
  'Auth a roly (prihlásenie, oprávnenia, chránené routy)',
  'Polish + responzivita (mobil, prázdne stavy, loading)',
  'Integrácie a externé API',
  'Testy — unit + e2e',
  'SEO a výkon (meta, sitemap, lazy loading, Core Web Vitals)',
  'Observabilita — logy, chybové stavy, monitoring',
  'Bezpečnostné hardening (validácia vstupov, rate limit, secrets)',
  'Obsah a copy (texty, obrázky, onboarding)',
  'Admin / dashboard + launch checklist',
];

export const stepsForDepth = (depth: BlueprintDepth): string[] => STEPS.slice(0, depth);

export const letterFor = (i: number): string => String.fromCharCode(65 + i);

export const RANDOM_PRESETS: BlueprintCriteria[] = [
  {
    goal: 'Rezervačný systém pre malé fitness štúdio',
    type: 'Web app',
    stack: 'React + Tailwind',
    language: 'SK',
    priorities: ['Rýchlosť', 'Dizajn'],
    depth: 6,
    notes: 'Platby neriešiť v prvej verzii, len rezervácie a kapacita lekcií.',
  },
  {
    goal: 'Firemná WordPress stránka so službami a referenciami',
    type: 'WordPress stránka',
    stack: 'WordPress',
    language: 'SK',
    priorities: ['SEO', 'Náklady'],
    depth: 9,
    notes: 'Dôraz na lokálne SEO a dopytový formulár.',
  },
  {
    goal: 'AI agent na triedenie zákazníckych emailov',
    type: 'AI agent',
    stack: 'Node / Edge funkcie',
    language: 'SK',
    priorities: ['Bezpečnosť', 'Škálovanie'],
    depth: 13,
    notes: 'Human-in-the-loop potvrdenie pred odoslaním odpovede.',
  },
];

export const DEFAULT_CRITERIA: BlueprintCriteria = {
  goal: '',
  type: PROJECT_TYPES[0],
  stack: STACKS[0],
  language: 'SK',
  priorities: [],
  depth: 6,
  notes: '',
};

export const BLUEPRINT_SYSTEM_PROMPT =
  'FOCUS: Blueprint architect. You design pragmatic, shippable project blueprints and copy-paste ready build prompts. ' +
  'Output strictly in Markdown with the exact section numbering requested. Be concrete, avoid filler. ' +
  'Never wrap the whole answer in a single code block.';

export function buildBlueprintPrompt(c: BlueprintCriteria): string {
  const steps = stepsForDepth(c.depth)
    .map((s, i) => `${letterFor(i)}) ${s}`)
    .join('\n');

  const lang = c.language === 'SK' ? 'slovenčine' : 'angličtine';

  return `Vytvor kompletný startovací blueprint projektu podľa kritérií. Píš v ${lang}, kód/cesty/príkazy v angličtine.

KRITÉRIÁ
- Cieľ projektu: ${c.goal || '(nezadané — navrhni rozumný predpoklad a uveď ho)'}
- Typ: ${c.type}
- Stack: ${c.stack}
- Jazyk výstupu: ${c.language}
- Priority: ${c.priorities.length ? c.priorities.join(', ') : 'bez špecifických priorít'}
- Poznámky / obmedzenia: ${c.notes || 'žiadne'}

VÝSTUP — presne táto štruktúra:
1. Executive summary (3 vety)
2. Rozsah: in-scope / out-of-scope
3. Architektúra (bloky + dátový tok, ASCII diagram v \`\`\`text bloku)
4. Dátový model (tabuľky + kľúčové polia)
5. Milestony M1–M4 s odhadom
6. Riziká + mitigácie
7. Definition of Done / akceptačné kritériá
8. PROMPT PACK A–${letterFor(c.depth - 1)} — presne ${c.depth} promptov

PROMPT PACK pravidlá:
- Použi presne tieto kroky v tomto poradí:
${steps}
- Každý prompt formátuj takto:
### A) Názov kroku
_Prečo:_ jedna veta.
\`\`\`text
<samotný prompt pripravený na copy-paste do AI builder-a, 3–8 viet, konkrétny k tomuto projektu>
\`\`\`
- Presne ${c.depth} promptov, ani jeden viac ani menej.`;
}

/** Vytiahne prompt pack bloky (### X) Názov + ```text ... ```) z markdown výstupu. */
export function extractPromptPack(md: string): { label: string; title: string; prompt: string }[] {
  const out: { label: string; title: string; prompt: string }[] = [];
  const re = /###\s*([A-Z])\)\s*(.+?)\n([\s\S]*?)(?=\n###\s*[A-Z]\)|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    const body = m[3];
    const code = /```(?:text|markdown)?\n([\s\S]*?)```/.exec(body);
    if (code) {
      out.push({ label: m[1], title: m[2].trim(), prompt: code[1].trim() });
    }
  }
  return out;
}
