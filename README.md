# wpBOX Elite

wpBOX Elite je komplexná cloudová platforma a vývojové prostredie pre správu, analýzu a nasadzovanie WordPress projektov a repozitárov. Je postavená na modernom stacku a exkluzívne využíva **Mistral API** pre AI analýzu a generovanie kódu.

## 🚀 Kľúčové Vlastnosti

1. **WordPress Manager:**
   - Priame napojenie cez REST API na produkčné weby.
   - Správa FSE (Full Site Editing) Blueprints.
   - Správa Headless (Next.js/React) architektúr.
   - Integrovaný WP-CLI manažér s podporou SSH a PEM kľúčov.
2. **Mistral AI Integrácia:**
   - Plne integrované modely od Mistral AI (`mistral-large`, `codestral`, atď.).
   - Analýza chýb z logov, code reviews a generovanie komplexných skriptov.
3. **Deploy Pipeline:**
   - Možnosť jedným kliknutím nasadiť vygenerovaný HTML/Block kód priamo z chatu do pripojeného WordPressu (ako Draft stránku).
4. **Nezničiteľná Architektúra:**
   - Aplikácia je chránená globálnymi `Error Boundaries`.
   - Všetky požiadavky na API majú zabudovaný `Exponential Backoff` (automatické opakovanie pri zlyhaní) a prísne časové limity (`AbortController`).
   - Prísna validácia JSON dát cez Edge Funkcie.

## 🛠️ Stack

- **Frontend:** React (Vite), Tailwind CSS, Framer Motion, TypeScript
- **Backend / Databáza:** Supabase (PostgreSQL), Edge Functions (Deno)
- **AI Integrácia:** Mistral API (via Supabase Edge Functions)
- **Testovanie:** Vitest, Testing Library, vitest-axe (a11y)

## 📦 Inštalácia & Lokálny Vývoj

1. Klonovanie repozitára:
   ```bash
   git clone https://github.com/ENZO7700/googla-builder1s.git
   cd googla-builder1s
   ```
2. Inštalácia závislostí:
   ```bash
   npm install
   ```
3. Nastavenie `.env` podľa vzoru `.env.example`.
4. Spustenie vývojového servera:
   ```bash
   npm run dev
   ```

## ☁️ Deployment na Vercel (Zero-Error Guide)

1. Prepoj Vercel projekt s týmto GitHub repozitárom.
2. Nastav v záložke **Environment Variables** všetky `VITE_SUPABASE_*` premenné.
3. Skontroluj, že máš v Supabase Authentication pridanú produkčnú doménu medzi **Redirect URLs** (vrátane dvojitých hviezdičiek: `https://tvojadomena.vercel.app/**`).
4. Uisti sa, že tvoje Supabase Edge Funkcie sú nasadené a obsahujú tajný kľúč `MISTRAL_API_KEY`.
5. Klikni na **Deploy** vo Verceli.

## 🔒 Lokálne Testovanie (Dev-Free-Entry)

Ak spúšťaš aplikáciu lokálne (`import.meta.env.DEV`), na prihlasovacej obrazovke nájdeš modré tlačidlo **"Dev-Free-Entry"**. Toto tlačidlo ťa pustí priamo do aplikácie pod lokálnym demo účtom bez nutnosti reálnej registrácie. Poznámka: V demo režime sú operácie s reálnou databázou a úložiskom v E2E testoch bezpečne preskočené.
