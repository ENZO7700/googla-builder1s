export const ELITE_HEADLESS_PROMPT = `
Vytvor architektúru a základný kód pre Headless Frontend postavený na Next.js (React) a WP GraphQL pre projekt LarsenEvans.

Cieľom je "Elite Core" vizuál: hlboká tmavá téma (#121212), precízna typografia (Inter & Playfair Display), magnetic interakcie a okamžité prechody stránok.

Štruktúra projektu:
1. /lib/apollo-client.ts - Konfigurácia pre WP GraphQL.
2. /components/layout/Header.tsx - Kompaktná pill-shape navigácia.
3. /components/home/Hero.tsx - High-impact hero sekcia s Aurora efektom (CSS blur gradienty).
4. /components/services/ServiceMatrix.tsx - Interaktívny grid služieb.
5. /pages/index.tsx - Hlavná stránka spájajúca tieto komponenty.

Požiadavky na kód:
- Použi Tailwind CSS pre styling.
- Implementuj framer-motion pre plynulé animácie.
- Return ONLY kód pre tieto súbory v Markdown blokoch, začni s lib/apollo-client.ts.
- Dizajn musí pôsobiť technologicky vyspelo a prémiovo.
`;

export const HEADLESS_STRUCTURE_TEMPLATE = {
  name: 'LarsenEvans Elite Headless',
  version: '1.0.0',
  techStack: ['Next.js', 'WPGraphQL', 'Tailwind CSS', 'Framer Motion'],
  features: [
    'Command Palette (Cmd+K)',
    'Aurora Background Effects',
    'Magnetic Buttons',
    'Pill-shaped Navigation',
    'Service Matrix Grid',
  ]
};
