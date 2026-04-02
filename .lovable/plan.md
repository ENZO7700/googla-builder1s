

# Megaprompt: H4CK3D Enterprise – Maximum Upgrade

## Overview
One comprehensive prompt that upgrades the entire application across 8 dimensions: real authentication, persistent chat sessions, dark mode, mobile responsiveness, streaming AI, conversation context, polished UI, and functional integrations page.

---

## The Megaprompt (copy-paste this as your next message)

```text
Vykonaj nasledujúce vylepšenia aplikácie H4CK3D Enterprise v jednom kroku. Implementuj všetko naraz:

## 1. REÁLNA AUTENTIFIKÁCIA (Lovable Cloud)
- Nahraď hardcoded login (root_admin/88888888) reálnou autentifikáciou cez Lovable Cloud
- Vytvor registračný formulár (email + heslo) a prihlasovací formulár
- Použi supabase.auth.signUp / signInWithPassword / signOut
- Po prihlásení zobraz email používateľa v sidebar namiesto "root_admin"
- Pridaj tlačidlo "Odhlásiť sa" do sidebar profilu
- Zachovaj vizuálny štýl Google Material (zaoblené rohy, 4-farebné bodky logo)
- NEPOVOĽ auto-confirm emailov – používatelia musia overiť email

## 2. PERZISTENTNÉ CHAT SESSIONS (Databáza)
- Prepoj existujúce tabuľky chat_sessions a chat_messages s frontendom
- Pri prvej správe automaticky vytvor novú session v databáze
- Ukladaj každú správu (user aj model) do chat_messages
- Načítaj históriu sessions v sidebar z databázy namiesto hardcoded dát
- Pri kliknutí na session v sidebar načítaj jej správy z databázy
- Pridaj tlačidlo na mazanie sessions (swipe alebo ikona X)
- Title session = prvých 30 znakov prvej správy

## 3. TMAVÝ REŽIM
- Pridaj dark mode CSS premenné do index.css v .dark selektore
- Tmavé pozadie: #0F172A, karty: #1E293B, border: #334155
- Pridaj toggle prepínač (Sun/Moon ikona) do sidebar vedľa profilu
- Ukladaj preferenciu do localStorage
- Všetky komponenty musia správne fungovať v oboch režimoch

## 4. MOBILNÁ RESPONZIVITA
- Sidebar: na mobile skrytý, otvára sa cez hamburger menu (Sheet/Drawer)
- SystemMonitor: na mobile skrytý úplne
- ChatView input: na mobile full-width, menší padding
- PreviewView: na mobile zobraz len preview (bez split chat panelu) – to už je
- Pridaj hamburger ikonu (Menu) do headeru na mobile

## 5. KONVERZAČNÝ KONTEXT (MULTI-TURN)
- Posielajaj CELÚ históriu správ do edge funkcie, nie len poslednú správu
- Uprav edge funkciu chat/index.ts aby prijímala pole messages namiesto jedného promptu
- Edge funkcia pošle všetky messages do AI Gateway ako conversation history
- Toto umožní AI pamätať si kontext konverzácie

## 6. STREAMING AI ODPOVEDE
- Uprav edge funkciu na streaming (stream: true v AI Gateway requeste)
- Na frontende použi ReadableStream na postupné zobrazovanie odpovede
- Zobrazuj text postupne ako prichádza (typewriter efekt)
- Počas streamingu zobraz blikajúci kurzor na konci textu

## 7. FUNKČNÁ STRÁNKA INTEGRÁCIE
- Nahraď placeholder "v údržbe" reálnym obsahom
- Zobraz karty s dostupnými integráciami: GitHub, Slack, Docker Hub, AWS
- Každá karta má: ikonu, názov, popis, status badge (Pripojené/Nepripojené)
- Kliknutie na kartu zobrazí dialog s informáciami (zatiaľ bez reálneho pripojenia)
- Vizuálne profesionálny grid layout

## 8. UI POLISH
- Pridaj react-markdown knižnicu a použi ju namiesto vlastného formatMarkdown (dangerouslySetInnerHTML)
- Syntax highlighting v code blockoch cez react-syntax-highlighter
- Animácie pri prepínaní views (fade-in transition)
- Pridaj klávesové skratky: Ctrl+K = nová relácia, Ctrl+/ = focus na input
- Empty state v Analyzátore a Generátore: pridaj ilustračné ikony a lepší text
```

---

## Technical Details (for implementation)

### Files to modify
- `src/components/LoginScreen.tsx` — full rewrite for real auth (signup + login tabs)
- `src/pages/Index.tsx` — auth state from supabase, DB session CRUD, dark mode state, mobile menu state, streaming handler
- `src/components/workspace/SidebarNav.tsx` — user email, logout, dark toggle, mobile drawer
- `src/components/workspace/ChatView.tsx` — streaming cursor, keyboard shortcuts
- `src/components/workspace/ConnectorsView.tsx` — full rewrite with integration cards
- `src/components/workspace/SystemMonitor.tsx` — responsive hiding (already hidden on xl:)
- `src/lib/formatMarkdown.tsx` — replace with react-markdown + react-syntax-highlighter
- `src/index.css` — add `.dark` theme variables
- `supabase/functions/chat/index.ts` — accept messages array, enable streaming

### New dependencies needed
- `react-markdown`, `react-syntax-highlighter`, `@types/react-syntax-highlighter`

### Database
- Uses existing `chat_sessions` and `chat_messages` tables (already created)
- No new migrations needed

### Edge function changes
- Accept `{ messages: [{role, content}], systemOverride? }` instead of `{ prompt }`
- Pass full conversation to AI Gateway
- Return streaming response with `stream: true`

