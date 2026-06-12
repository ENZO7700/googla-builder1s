export const ELITE_BLUEPRINT_PROMPT = `
Vygeneruj deployovateľný WordPress HTML/CSS blok pre projekt "LarsenEvans".

Tento výstup pôjde priamo do funkcie "Poslať na WP", ktorá podporuje iba HTML kód ako obsah WordPress stránky.

Tvrdé pravidlá:
1. Vráť IBA jeden Markdown code block s jazykom html.
2. Nepíš žiadne vysvetlenie pred ani po kóde.
3. Nepoužívaj React, JSX, TypeScript, PHP, shortcodes, npm, build kroky ani externé súbory.
4. Nepoužívaj celý dokument s <html>, <head> ani <body>.
5. Použi validný HTML5 + WordPress Gutenberg/FSE block markup, napríklad <!-- wp:group -->, <!-- wp:heading -->, <!-- wp:paragraph -->, <!-- wp:columns -->, <!-- wp:buttons -->.
6. CSS drž priamo v HTML: inline style atribúty alebo jeden <style> tag na začiatku HTML bloku.
7. Nepoužívaj externé script tagy, event handlery typu onclick, iframy, tracking kód, tajné údaje ani credential placeholders.
8. Ak treba dynamické dáta, použi placeholdery v tvare {{TITLE}}, {{SUBTITLE}}, {{IMAGE_URL}}, {{SERVICE_TITLE}}, {{CTA_URL}}.
9. Obsah má byť responzívny, pripravený na produkciu a vhodný pre WordPress Block Editor.
10. Prispôsob sekcie, texty a štýl podľa zadania používateľa, ale nikdy neporuš formát výstupu.

Vytvor stránku so sekciami:
- Hero s jasným headline, krátkym popisom a CTA
- Services grid
- O nás / dôveryhodnosť
- Referencie alebo výsledky
- Záverečné CTA

Dizajn:
- enterprise, moderný, čistý, prémiový
- farby cez CSS premenné a WordPress preset premenné kde dávajú zmysel
- responzívne rozloženie bez potreby ďalších súborov
`;

export const BLUEPRINT_STRUCTURE_TEMPLATE = {
  name: 'Deploy HTML/CSS Blueprint',
  techStack: ['Gutenberg HTML', 'Inline CSS', 'WordPress Blocks', 'No build step'],
  features: [
    'Priamo použiteľné cez Poslať na WP',
    'Bez React/PHP výstupu',
    'Responzívne sekcie stránky',
    'Placeholdery pre dynamické dáta',
  ],
};
