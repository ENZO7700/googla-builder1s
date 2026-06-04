# Plán: Prehľadné AI generovanie kódu + akcie + E2E testy

## 1. Plynulé scrollovanie počas streamovania (ChatView)

Aktuálny `scrollIntoView({ behavior: 'smooth' })` na každom tokene spôsobuje trhanie a "skackanie". Upravím:

- Pri streamovaní použijem `requestAnimationFrame` throttling — scroll najviac raz za frame, `behavior: 'auto'` počas streamu, `smooth` len keď generovanie skončí.
- Zlepším detekciu user-scroll (rozšírim prah na 120 px, pridám `isStreaming` do dependency).
- Floating "Skočiť na koniec" tlačidlo zlepším: zobrazí aj počet nových riadkov pridaných odkedy user scrolloval hore (`+N nových riadkov`), s animáciou pulse.
- Pridám klávesovú skratku `End` = jump to bottom, `Home` = jump na začiatok aktuálnej AI odpovede.

## 2. Prehľadnejšie zobrazenie kódu počas generovania (formatMarkdown.tsx)

- Pridám sticky hlavičku code blocku (`sticky top-0`) tak, aby pri scrollovaní cez dlhý kód bol jazyk + akcie stále viditeľné.
- Pri streamovaní (nedokončený code block) zobrazím skeleton "Generujem kód..." badge + animovaný caret.
- Pridám `max-height` s collapse/expand pre code bloky > 400 riadkov ("Zobraziť celý kód").
- Čísla riadkov (line numbers) cez `showLineNumbers` v SyntaxHighlighter.
- Word-wrap toggle.

## 3. Akcie po dokončení AI odpovede

Pod každou dokončenou `model` správou pridám action bar:

- **Kopírovať celú odpoveď** (markdown)
- **Export ako .md** — stiahnuť `response-{timestamp}.md`
- **Export ako .html** — vyrendrovaný HTML
- **Export ako .pdf** — cez `window.print()` so štýlovaním
- **Kopírovať iba kód** — extrahuje všetky ```code bloky a spojí
- **Regenerovať** — znovu zavolá AI s tým istým promptom
- **Pokračovať** — pošle "Pokračuj" ako follow-up
- **Vložiť do Preview** — ak je vo výstupe HTML blok, otvorí ho v `PreviewView`

Action bar bude jemný (icon buttons s tooltipom), zobrazí sa iba pri hovere nad správou alebo permanentne pod poslednou.

## 4. Indikátor streamingu

- Hore nad input boxom (počas `isStreaming`): tenký progress bar + "Generujem... {N tokenov · {s}s" + tlačidlo **Stop generovania**.
- Stop generovania prepojím cez `AbortController` v `Index.tsx` (skontrolujem zdroj `sendMessage`).

## 5. E2E testy (Playwright)

Vytvorím `tests/chat-streaming.spec.ts`:

- Test 1: Po odoslaní promptu sa zobrazí loader → potom prvá `model` správa.
- Test 2: Počas streamingu sa autoscroll drží na konci.
- Test 3: Po user-scroll hore sa autoscroll vypne a zobrazí sa "Skočiť na koniec".
- Test 4: Po dokončení sa zobrazí action bar s tlačidlami (Copy, Export MD, Regenerate).
- Test 5: Kliknutie na "Kopírovať" zapíše do clipboard (mock cez `page.evaluate`).
- Test 6: Code block má sticky hlavičku a "Kopírovať" funguje.
- Test 7: Stop generovania prerušuje stream.

Pred E2E: skontrolovať, či má projekt nastavený Playwright runner (`playwright-fixture.ts` existuje) — áno, doplním iba spec.

## Technické detaily

**Dotknuté súbory:**
- `src/components/workspace/ChatView.tsx` — RAF scroll, indikátor, stop button, action bar pod správami
- `src/lib/formatMarkdown.tsx` — sticky header, line numbers, collapse, streaming caret v code blocku
- `src/pages/Index.tsx` (alebo zdroj `onSend`) — `AbortController`, `onRegenerate`, `onContinue`, `onExport*` callbacky
- `src/lib/chatExport.ts` (nový) — utility `exportAsMarkdown`, `exportAsHtml`, `exportAsPdf`, `extractCodeBlocks`
- `tests/chat-streaming.spec.ts` (nový) — E2E

**Bez zmien:** business logika (Supabase chat edge function, DB schéma), len UI + presentation + export utility.

## Otvorené otázky

Implementujem všetko vyššie ako default. Ak chceš niečo vynechať (napr. PDF export, line numbers), povedz pred implementáciou — inak pokračujem so všetkým.
