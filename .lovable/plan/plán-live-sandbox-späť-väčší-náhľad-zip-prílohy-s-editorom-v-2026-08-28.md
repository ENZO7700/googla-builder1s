# Plán: Live Sandbox (Späť + väčší náhľad) + ZIP prílohy s editorom v canvase

## 1. Live Sandbox – tlačidlo Späť a väčší náhľad
- Do hlavičky Live Sandbox panelu (`PreviewView.tsx`) pridám tlačidlo **Späť** (šípka + text), ktoré vráti používateľa na hlavné zobrazenie (chat) cez nový callback `onBack` napojený v `Index.tsx`.
- Pridám tlačidlo **Maximalizovať / Obnoviť**: v maximalizovanom režime sa sandbox roztiahne na celú obrazovku (overlay `fixed inset-0`), skryje sa ľavý chat panel; ESC vráti normálny režim.

## 2. ZIP prílohy v chate
- V prílohovom vstupe povolím `.zip` (a rozpoznanie podľa MIME/prípony).
- Po pridaní ZIP-u sa **rozbalí priamo v prehliadači** (knižnica `fflate`) — nič sa neposiela nikam navyše.
- Zobrazí sa panel **„Obsah archívu"** so zoznamom súborov (strom, veľkosti, počet). Používateľ môže:
  - vybrať, ktoré súbory poslať agentovi (predvolene textové/kódové súbory),
  - preskočiť binárne súbory a `node_modules`, `.git`, buildy (automaticky filtrované),
  - kliknutím otvoriť súbor v canvase.
- Do správy pre AI sa vloží prehľad štruktúry archívu + obsah vybraných textových súborov (s limitom veľkosti a skrátením veľkých súborov), takže agent vie so súbormi pracovať a navrhovať úpravy.

## 3. Canvas – úprava súborov
- Rozšírim Live Sandbox / canvas o **režim súborov**: vľavo strom súborov z archívu, vpravo editor s obsahom vybraného súboru (editovateľný, s možnosťou uloženia zmeny do pamäte projektu).
- Akcie v canvase: **Uložiť**, **Poslať súbor agentovi na úpravu** (pošle obsah + inštrukciu), **Aplikovať návrh AI** (nahradí obsah kódom z odpovede), **Stiahnuť ZIP** (znovu zabalí upravené súbory).
- HTML/JS súbor sa dá jedným klikom zobraziť v Live náhľade.

## Technické detaily
- Nová knižnica: `fflate` (unzip + zip v prehliadači).
- Nový modul `src/lib/archive/zipWorkspace.ts`: rozbalenie, filtrovanie, detekcia textu/binárky, limity (max ~2 MB na súbor, max ~200 súborov), rebalenie na download.
- Nový komponent `src/components/workspace/FileCanvas.tsx` (strom + editor) a rozšírenie `PreviewView.tsx` o taby „Náhľad | Súbory".
- Stav archívu drží `Index.tsx` (`archiveFiles`, `activeFilePath`) a odovzdáva ho do canvasu aj do zostavenia promptu.
- Backend, DB ani edge funkcie sa nemenia; ZIP sa nespracúva na serveri.
