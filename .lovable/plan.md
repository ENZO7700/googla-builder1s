# Plán: Live Sandbox – tlačidlo Späť + zväčšenie náhľadu

## Čo urobím

### 1. Tlačidlo „Späť" na hlavnú stránku
- Do hlavičky Live Sandbox panelu (`src/components/workspace/PreviewView.tsx`) pridám tlačidlo **Späť** (šípka vľavo + text) vedľa nadpisu „Live Sandbox".
- Kliknutie vráti používateľa na hlavné zobrazenie (chat / workspace) — cez nový callback `onBack`, ktorý sa napojí v `Index.tsx` na zmenu aktívneho view.

### 2. Výrazné zväčšenie náhľadu
- Pridám tlačidlo **Maximalizovať / Obnoviť** (ikona expand/collapse) do hlavičky sandboxu.
- V maximalizovanom režime sa sandbox roztiahne cez celú obrazovku (fullscreen overlay, ~100 % viewportu), skryje sa ľavý chatovací panel a zbytok UI – náhľad bude výrazne väčší.
- ESC alebo opätovné kliknutie vráti normálnu veľkosť.

## Technické detaily
- `PreviewView.tsx`: nové props `onBack`, interný stav `expanded` (fullscreen overlay s `fixed inset-0 z-50`).
- `Index.tsx`: odovzdanie `onBack` handlera (prepnutie späť na chat view).
- Žiadne zmeny backendu, DB ani edge funkcií.
