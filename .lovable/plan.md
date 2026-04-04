

# H4CK3D Enterprise — Ultimate 450% Upgrade Plan

## Current State Analysis

The app has a solid foundation: real auth (email + Google OAuth), persistent chat sessions, dark mode, streaming AI, mobile menu, integrations page, and markdown rendering. However, several features are incomplete or have bugs that prevent them from working at 100%.

## Issues Found

1. **Analyzer & Generator use old `formatMarkdown`** — returns JSX array, not proper React component rendering. Streaming doesn't work in these views.
2. **No error recovery on streaming** — if stream fails mid-way, the empty model message stays.
3. **Session title never updates** after first message (stays as first 30 chars forever).
4. **Mobile sidebar overlay** has z-index/layout issues — the inner `hidden lg:flex` on the aside conflicts with mobile display.
5. **No loading state for session list** — sessions flash in after auth.
6. **Mic recording is fake** — just simulates with setTimeout.
7. **File attachments are cosmetic** — files are never actually sent to AI.
8. **PreviewView chat panel** shows truncated "Zmeny aplikované v náhľade" for every AI response instead of actual content.
9. **No "empty state" improvements** in Analyzer/Generator (mentioned in megaprompt but not done).
10. **onAuthStateChange cleanup** is missing for ResetPassword page.
11. **Console/SystemMonitor** shows fake simulated logs — not connected to real events.
12. **Search bar in header** is non-functional (just visual).
13. **Settings button** toggles a state but shows nothing.
14. **No profile table** — user data is limited to auth.users email only.
15. **Dark mode init** — no flash prevention (page loads light then switches to dark).

---

## Implementation Plan (8 Phases)

### Phase 1: Fix Critical Bugs

**SidebarNav.tsx** — Remove `hidden lg:flex` from the aside element and control visibility via props/parent instead. The mobile overlay wraps this component but `hidden lg:flex` prevents it from showing on mobile.

**Index.tsx streaming error recovery** — If `callAIStreaming` throws after the empty model message was added, remove it or replace with error message.

**AnalyzerView.tsx & GeneratorView.tsx** — Replace `formatMarkdown()` function call with `<MarkdownRenderer>` component for proper rendering.

**ResetPassword.tsx** — Clean up `onAuthStateChange` subscription in useEffect return.

### Phase 2: Real File Upload Support

- Create a `chat-attachments` storage bucket in Lovable Cloud
- Upload files to storage when attached, get public URLs
- Include file URLs in the AI message context so the AI can reference them
- Show upload progress indicator on attachment chips

### Phase 3: Enhanced Session Management

- Update session title after AI responds (use AI's first line or first 40 chars of user prompt)
- Add `updated_at` column update when new messages arrive (already exists in schema)
- Add session search/filter in sidebar
- Group sessions by date (Today, Yesterday, This Week, Older)
- Add "Rename session" on double-click of session title

### Phase 4: Real Web Speech API for Voice Input

- Replace fake `simulateMicRecording` with browser's `SpeechRecognition` API
- Show real-time transcription as user speaks
- Auto-send after speech ends (configurable)
- Show unsupported browser message if API not available

### Phase 5: Settings Panel

- Build a slide-out settings panel (Sheet component) triggered by Settings button
- Settings: Language preference, AI model selector, theme, notification preferences
- Store settings in `localStorage` (or DB user_settings table)
- AI model selection passes to edge function

### Phase 6: Enhanced UI/UX Polish

- **Dark mode flash prevention**: Add inline script in `index.html` to set `.dark` class before React loads
- **Search functionality**: Add real Ctrl+F search across chat messages
- **Animated transitions**: Add Framer Motion for view switches (fade + slide)
- **Better empty states**: Add illustrated SVG icons for Analyzer (shield scanning animation) and Generator (code terminal animation)
- **Skeleton loading**: Add skeleton loaders while sessions load from DB
- **Toast improvements**: Use Sonner instead of custom ToastContainer for consistency
- **Keyboard shortcuts tooltip**: Show available shortcuts on Ctrl+? or in settings

### Phase 7: Connectors Page Enhancement

- Add animated connection status indicators
- Add "Coming soon" vs "Available" distinction
- Add configuration modal with API key input fields (stored as user preferences)
- Add webhook URL display for each connected service

### Phase 8: Performance & Security Hardening

- Add React.memo to message list items to prevent re-renders during streaming
- Debounce the textarea input during streaming
- Add rate limiting indicator in UI (show when 429 received)
- Add CSP headers consideration
- Lazy load Analyzer, Generator, Preview, Connectors views with React.lazy + Suspense

---

## Technical Details

### Files to modify
| File | Changes |
|------|---------|
| `src/components/workspace/SidebarNav.tsx` | Fix `hidden` class, add session grouping, search, rename |
| `src/pages/Index.tsx` | Fix streaming error recovery, real file upload, settings state, voice API, lazy loading |
| `src/components/workspace/AnalyzerView.tsx` | Use `<MarkdownRenderer>`, better empty state |
| `src/components/workspace/GeneratorView.tsx` | Use `<MarkdownRenderer>`, better empty state |
| `src/components/workspace/ChatView.tsx` | Real voice input, search in messages |
| `src/components/workspace/PreviewView.tsx` | Show actual AI response snippets |
| `src/components/workspace/ConnectorsView.tsx` | Enhanced cards with config modals |
| `src/components/workspace/SystemMonitor.tsx` | No changes (already well-built) |
| `src/pages/ResetPassword.tsx` | Fix auth listener cleanup |
| `src/index.css` | Minor polish tweaks |
| `index.html` | Dark mode flash prevention script |
| `supabase/functions/chat/index.ts` | Accept model parameter |

### New files
| File | Purpose |
|------|---------|
| `src/components/workspace/SettingsPanel.tsx` | Settings slide-out panel |

### New dependencies
- `framer-motion` — view transition animations

### Database changes
- Create `chat-attachments` storage bucket with RLS (user can only access own files)
- No new tables needed

### Edge function changes
- Accept optional `model` parameter to allow AI model switching
- Default remains `google/gemini-3-flash-preview`

