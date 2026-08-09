# Plán: Blueprint Starter namiesto prázdneho stavu analyzátora

Prázdny stav „Žiadne logy na analýzu" nahradíme **Startovacím Blueprintom** — krátky formulár kritérií, ktorý z AI vygeneruje kompletný projektový blueprint plus sadu promptov od A po Z (3 / 6 / 9 / 13 promptov podľa hĺbky).

## 1. Nová obrazovka: Blueprint Starter

Nový komponent `src/components/workspace/BlueprintStarter.tsx`, zobrazený v `AnalyzerView` namiesto prázdneho stavu (analyzátor logov zostáva dostupný ako druhá karta/tab „Analýza logov").

Formulár kritérií (všetko voliteľné, s rozumnými defaultmi):

- **Názov / cieľ projektu** (text)
- **Typ**: Web app / WordPress stránka / API + backend / AI agent / Automatizácia
- **Stack**: React+Tailwind (default), WordPress, Node/Edge funkcie, iné (free text)
- **Cieľová skupina / jazyk výstupu**: SK (default) / EN
- **Priority** (multi-chip): Rýchlosť, SEO, Bezpečnosť, Škálovanie, Dizajn, Náklady
- **Hĺbka promptov**: prepínač **3 · 6 · 9 · 13**
- **Voliteľné poznámky / obmedzenia** (textarea)

Tlačidlá: „Vytvoriť blueprint", „Náhodné kritériá" (vyplní ukážkový scenár), „Vymazať".

## 2. Výstup

AI vráti štruktúrovaný markdown, ktorý sa vyrenderuje cez existujúci `MarkdownRenderer`:

```text
1. Executive summary (3 vety)
2. Rozsah: čo je in-scope / out-of-scope
3. Architektúra (bloky + dátový tok, ASCII diagram)
4. Dátový model (tabuľky + kľúčové polia)
5. Milestony M1–M4 s odhadom
6. Riziká + mitigácie
7. Definition of Done / akceptačné kritériá
8. PROMPT PACK A–Z (presne N promptov)
```

Prompt pack: každý prompt má **označenie A, B, C…**, názov kroku, jednu vetu „prečo" a samotný prompt v code bloku pripravený na copy-paste. Počet = zvolená hĺbka:

- **3** — Základ: A) Scaffold + design system, B) Hlavná funkcionalita, C) Nasadenie + QA
- **6** — pridá: dátový model & backend, auth & roly, polish/responzivita
- **9** — pridá: integrácie/API, testy (unit + e2e), SEO & výkon
- **13** — plné A–M: pridá observabilitu/logy, bezpečnostné hardening, obsah & copy, admin/dashboard, launch checklist

Každý prompt má tlačidlo **Kopírovať**, plus „Kopírovať všetky" a „Poslať do chatu" (naplní chat input a prepne na Chat view).

## 3. Zapojenie

- `src/pages/Index.tsx`: nový handler `handleGenerateBlueprint(criteria)` — postaví prompt zo kritérií a zavolá existujúce `callAIStreaming` so systémovým fokusom „Blueprint architect". Logy a toasty rovnako ako u `handleAnalyzeLogs`. Prop sa predá do `AnalyzerView`.
- `AnalyzerView` dostane nový prop `onGenerateBlueprint` a interný prepínač kariet: **Blueprint** (default) / **Logy**.
- Bez zmien v DB a edge funkciách — beží cez existujúci `chat` endpoint.

## Technické poznámky

- Šablóna promptu pre model je jeden zdroj pravdy v `src/lib/blueprintPrompts.ts`: mapovanie hĺbka → seznam krokov (A–M) a builder finálneho user promptu z kritérií.
- Počet promptov vynucujeme v texte promptu a po vygenerovaní iba renderujeme (žiadne schema bounds).
- Copy funkcia cez `navigator.clipboard` s fallbackom, toast potvrdenie.
- Štýl podľa existujúceho dizajnu (`bg-card`, `border-border`, chip tlačidlá ako v `WPCLIManager`), žiadne hardcoded farby.
