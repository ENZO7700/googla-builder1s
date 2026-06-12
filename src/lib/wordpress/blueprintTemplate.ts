export const ELITE_BLUEPRINT_PROMPT = `
Vytvor kompletný "Blueprint" pre modernú WordPress Block Tému (Full Site Editing) pre projekt "LarsenEvans".

Téma musí byť zameraná na extrémnu rýchlosť a natívnu podporu Gutenberg blokov bez zbytočného CSS/JS bloatu.

Požiadavky na výstup:
1. /theme.json - Definuj globálne štýly:
   - Farby: Hlboká tmavá (#121212) ako základ, Electric Blue a Gold-Copper ako akcenty.
   - Typografia: Inter (sans-serif) pre texty, Playfair Display (serif) pre nadpisy.
   - Spacing, Layout a nastavenia pre responzivitu.
2. /patterns/hero.php - Vytvor Block Pattern pre úvodnú sekciu s pútavým nadpisom, podnadpisom a CTA tlačidlami.
3. /templates/index.html - Základná FSE šablóna pre domovskú stránku (zavolanie Header partu, Hero patternu a Footer partu).

Vráť IBA kód pre tieto 3 súbory v Markdown blokoch, aby sa dali okamžite skopírovať a použiť vo WordPress.
`;

export const BLUEPRINT_STRUCTURE_TEMPLATE = {
  name: 'FSE Prompts & Blueprints',
  techStack: ['theme.json', 'Gutenberg Blocks', 'React', 'PHP Patterns'],
  features: [
    'No-Code úpravy pre klienta (FSE)',
    'Vysoký výkon (Zero bloat)',
    'Globálna správa štýlov',
    'Znovupoužiteľné bloky (Patterns)'
  ]
};
