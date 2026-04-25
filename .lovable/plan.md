# Vylepšenia: E2E test, Upload UX, Streaming diagnostika

## 1. E2E testovací skript

**Súbor:** `src/lib/e2eTest.ts` (nový) + tlačidlo „Spustiť E2E test" v `SettingsPanel.tsx`

Skript v console spustí postupne:
- **Auth check** – overí `supabase.auth.getSession()` (či je user prihlásený)
- **DB write** – vytvorí testovaciu session v `chat_sessions`, vloží správu do `chat_messages`, prečíta späť, vymaže
- **Streaming chat** – zavolá edge function `chat` s krátkou správou, meria čas do prvého tokenu (TTFT) a celkový čas, počíta prijaté tokeny
- **Storage upload** – nahrá malý in-memory `Blob` do `chat-attachments`, overí že existuje, vymaže
- **Voice API check** – overí dostupnosť `webkitSpeechRecognition` (bez aktivácie)

Každý krok logne `✅ PASS` alebo `❌ FAIL: <error>` do `console.log` a tiež zobrazí súhrnný `sonner` toast (X/5 prešlo). Skript nikdy nepoškodí používateľove dáta — používa vlastnú test session a vždy upratuje.

## 2. Upload s progresom + validáciou + auto-attach

**Súbor:** `src/pages/Index.tsx` – upraviť `handleFileUpload`, `handleDrop` a `uploadAttachments`

Zmeny:
- **Validácia pred prijatím:** max 20 MB / súbor, max 10 súborov naraz, povolené typy (text/*, image/*, application/pdf, application/json, .ts, .js, .py, .md, .csv). Pri zlyhaní – `toast.error` s konkrétnym dôvodom, súbor sa neuloží.
- **Okamžitý upload pri pripojení (auto-attach):** namiesto držania `File` v stave a uploadu až pri Send, súbor sa nahrá hneď do `chat-attachments` v `${user.id}/pending/`. Attachment chip zobrazí progres (0–100%).
- **Progres state:** rozšíriť `Attachment` interface o `progress?: number`, `url?: string`, `uploading?: boolean`, `error?: string`. Použiť XHR `onprogress` (Supabase JS SDK nemá natívny progress callback, ale pre malé súbory zobrazíme indeterminate spinner; pre veľké použijeme `fetch` na signed upload URL s ReadableStream pokiaľ to bude jednoduché — inak fallback na spinner + final 100%).
- **Send používa už-nahrané URL:** `handleSendMessage` nemusí znova uploadovať, len pripojí existujúce `att.url` do promptu.
- **Chip UI v `ChatView.tsx`:** pridať `<div className="h-0.5 bg-primary" style={{width: progress+'%'}}/>` pod meno súboru počas uploadu; ikonka error pri zlyhaní.

## 3. Streaming diagnostika v SystemMonitore

**Súbory:** `src/pages/Index.tsx` + `src/components/workspace/SystemMonitor.tsx`

Zmeny:
- V `callAIStreaming` zaznamenať `startTime`, `firstTokenTime`, `endTime`, počet prijatých chunks, použitý model, error message ak nastane.
- Uložiť do nového state `streamDiagnostics: { ttft: number, total: number, chunks: number, model: string, error?: string, timestamp: Date } | null`.
- Pri každom novom volaní reset.
- `SystemMonitor` dostane novú prop `diagnostics` a pridá sekciu **„Streaming diagnostika"** nad logmi:
  ```
  Posledná požiadavka:
  • Čas do 1. tokenu: 320 ms
  • Celkový čas: 2.4 s
  • Chunkov: 47
  • Model: gemini-3-flash-preview
  • Status: ✅ OK   (alebo ❌ chybová správa)
  ```
- Ak žiadne dáta, zobraziť `Žiadne dáta — pošlite správu`.

## Technické detaily

| Súbor | Akcia |
|------|------|
| `src/lib/e2eTest.ts` | nový — exportuje `runE2ETest()` |
| `src/components/workspace/SettingsPanel.tsx` | pridať tlačidlo „Diagnostika → Spustiť E2E test" |
| `src/pages/Index.tsx` | rozšíriť `Attachment`, validácia, auto-upload, diagnostika v `callAIStreaming` |
| `src/components/workspace/ChatView.tsx` | progres bar + error stav v attachment chipe |
| `src/components/workspace/SystemMonitor.tsx` | nová sekcia „Streaming diagnostika" |

Bez nových závislostí, bez DB migrácií. Bucket `chat-attachments` už existuje s RLS.
