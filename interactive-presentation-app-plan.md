# Interactive Presentation App — Implementation Plan

> A lightweight, open-source web app that makes presentations and study sessions genuinely interactive for crowds of 10–100+ people.

---

## 1. What We're Building

A real-time audience interaction tool where:

- **Hosts** control what the audience sees — polls, crowd prompts, quizzes, reactions — from a simple dashboard
- **Audience members** join instantly via QR code or invite code, no account needed, and interact through their phones
- Everything syncs live across all devices simultaneously

---

## 2. Core User Flows

### Audience Flow
1. Scan QR code or type invite code at a URL (e.g. `app.com/join`)
2. Enter session → land on a **blank white lobby screen**
3. Host activates an interaction → screen updates in real time
4. Audience taps a button, votes, reacts, or reads a prompt
5. Results appear live on both the host dashboard and every audience screen

### Host Flow
1. Create a session → get a shareable QR code + invite code
2. Open the host dashboard
3. Choose an interaction mode and launch it
4. Watch live results stream in
5. Close the interaction → audience returns to blank lobby

---

## 3. Interaction Modes

| Mode | What the Host Does | What the Audience Sees |
|---|---|---|
| **Crowd prompt** | Types a cue ("Say hooray!") | Full-screen bold text — e.g. "HOORAY!" |
| **Live poll** | Sets 2–10 options | Tap-to-vote buttons + live updating bar chart |
| **Quiz** | Sets question + correct answer | Vote buttons → reveal correct answer after |
| **Open text** | Opens a text prompt | Text input field → responses appear on host screen |
| **Emoji reactions** | Enables reaction mode | Emoji buttons → shower of reactions on host screen |
| **Countdown** | Sets a timer | Big countdown clock fills the screen |
| **Slide display** | Uploads a PDF presentation and clicks through slides | Native view of the current slide (16:9) + Synced transitions |

This list is intentionally extensible — new modes are just new "interaction types" in the data model.

---

## 4. Deployment Targets

There are two supported ways to run this app. Both are zero-ops and require no paid hosting beyond an optional Vercel hobby account.

### Option A — Localhost (Fully Local, No Internet Required)

Best for: classrooms, study groups, events on a local network where everyone is on the same Wi-Fi.

```
                    ┌──────────────────────────────┐
                    │      Host's laptop/machine    │
                    │                               │
                    │  Next.js dev server (:3000)   │
                    │  + WebSocket server (:3001)   │
                    │                               │
                    └──────────────┬───────────────┘
                                   │ Local Wi-Fi network
                    ┌──────────────┴───────────────┐
                    │  Audience phones              │
                    │  → open 192.168.x.x:3000/join │
                    └──────────────────────────────┘
```

**How it works:**
- Host runs `npm run dev` on their machine
- Host shares their local IP address as a QR code (the app auto-generates this on startup)
- Everyone on the same Wi-Fi network opens that address on their phone — no internet needed
- Session data lives entirely in memory on the host machine; nothing is persisted anywhere

**Setup:**
```bash
git clone https://github.com/yourname/interactive-app
cd interactive-app
npm install
npm run dev
# → App running at http://localhost:3000
# → QR code for local network printed in terminal
```

---

### Option B — Vercel Only (Single Platform Deployment)

Best for: recurring use, public events, sharing with people not on the same Wi-Fi.

The key challenge is that **Vercel does not support long-lived WebSocket servers** natively — but we solve this cleanly using **[PartyKit](https://partykit.io)**, which deploys as a Vercel integration and handles the WebSocket layer without any separate hosting platform.

```
                    ┌──────────────────────────────┐
                    │         Vercel                │
                    │                               │
                    │  Next.js app (Edge/Serverless)│
                    │  + PartyKit rooms (WebSocket) │
                    │                               │
                    └──────────────────────────────┘
```

**Why PartyKit:**
- Deploys as a Vercel integration — one `vercel deploy` command, no separate service, no Railway, no Fly.io
- Each session becomes a "room" (a tiny edge worker) that holds state and handles WebSocket connections
- Rooms spin up on demand and spin down when the session ends — zero idle cost
- Free tier: unlimited rooms, up to 1,000 concurrent connections — more than enough for 10–100 users

**Setup:**
```bash
npm install partykit partysocket

# Deploy everything to Vercel
vercel deploy
# → Next.js frontend on Vercel Edge
# → PartyKit rooms on Vercel's edge network automatically
```

**Cost at 40 concurrent users:** $0/month.

---

### Choosing Between A and B

| | Localhost | Vercel + PartyKit |
|---|---|---|
| Internet required | No | Yes |
| Setup time | ~2 minutes | ~10 minutes (first time) |
| Works across networks | No (same Wi-Fi only) | Yes |
| Cost | $0 | $0 |
| Data leaves your machine | No | Yes (PartyKit edge servers) |
| Persistent sessions | No | Optional |
| Recommended for | Classrooms, one-off events | Recurring use, remote audiences |

The codebase is **identical for both targets**. A single environment variable switches the WebSocket connection:

```bash
# .env.local
NEXT_PUBLIC_MODE=local   # uses local ws server on :3001
NEXT_PUBLIC_MODE=cloud   # uses PartyKit rooms
```

---

## 5. Tech Stack

Chosen for simplicity, low cost, and open-source friendliness.

### Frontend
- **Framework**: Next.js (React) — handles both the audience app and host dashboard in one repo
- **Styling**: Tailwind CSS — fast, readable, no CSS files to maintain
- **Real-time client**: `partysocket` (cloud) or native WebSocket (local) — same API surface
- **PDF Engine**: `pdfjs-dist` (Mozilla) — for client-side PDF-to-Canvas rendering
- **Animations**: `framer-motion` — for smooth slide transitions
- **Voice**: Web Speech API (built into Chrome/Edge) — no API key, no cost, no external dependency
- **Report export**: `jsPDF` — client-side PDF generation, no server round-trip, no third-party export service

### Backend
- **HTTP/API**: Next.js API routes (serverless) for session creation
- **Real-time layer**: PartyKit rooms (cloud) or a local `ws` WebSocket server (localhost mode)
- **State**: In-memory within each PartyKit room or in-process for localhost — no database needed
- **Session codes**: Short alphanumeric codes (e.g. `XK29A`) generated at session creation

### Infrastructure
- **Cloud**: Vercel (one platform, one `vercel deploy` — no Railway, no Fly.io)
- **Local**: `npm run dev` — runs everything on the host's machine, no cloud required

### Why Not Firebase / Supabase?
Those work too, but add vendor lock-in. The stack above is fully self-hostable and open-source with zero proprietary dependencies.

---

## 6. Data Model

```ts
Session {
  id: string           // e.g. "XK29A" — shared with audience
  hostId: string
  hostToken: string    // separate secret code for host device auth
  activeHosts: string[] // connected host device IDs (max 3)
  status: "lobby" | "active" | "closed"
  currentInteraction: Interaction | null
  createdAt: timestamp
}

Interaction {
  id: string
  type: "poll" | "prompt" | "quiz" | "text" | "reactions" | "countdown"
  payload: object      // type-specific data (options, prompt text, timer, etc.)
  responses: Response[]
  startedAt: timestamp
  closedAt: timestamp | null
}

Response {
  participantId: string  // anonymous, generated on join
  value: string          // selected option, typed text, emoji, etc.
  timestamp: timestamp
}

SessionMetrics {
  sessionId: string
  totalParticipants: number
  peakConcurrent: number
  interactions: InteractionMetric[]
  exportedAt: timestamp | null
}

InteractionMetric {
  interactionId: string
  type: InteractionType
  question: string | null          // prompt text or poll question
  slideIndexAtLaunch: number | null // which slide was active when triggered
  totalResponses: number
  responseRate: number             // responses / participants at time of launch
  results: Record<string, number>  // option → count, or value → count for text
  durationSeconds: number          // time from start to close
  startedAt: timestamp
  closedAt: timestamp
}

SlideState {
  currentIndex: number             // persisted in room state, survives interaction changes
  totalSlides: number
  pdfLoaded: boolean
}
```

---

## 7. Real-Time Architecture

```
Audience device  ──WebSocket──┐
Audience device  ──WebSocket──┤
Audience device  ──WebSocket──┼──► PartyKit room / local ws server ──► Host dashboard
         ...                  │        │
                               └────────┘
                               (broadcast to all)
```

- All clients (host + audience) connect to the same session room via WebSocket
- Host sends an **action** (e.g. `{ type: "start_poll", options: [...] }`)
- Server broadcasts the action to every connected client
- Clients render based on their role (host sees dashboard, audience sees interaction UI)
- Audience responses are sent back to the server and rebroadcast as aggregate updates (not individual votes — privacy-friendly)

---

## 8. Project Structure

```
/
├── apps/
│   ├── web/                      # Next.js frontend
│   │   ├── app/
│   │   │   ├── join/             # Audience join page
│   │   │   ├── lobby/            # Audience lobby + interaction view
│   │   │   ├── host/             # Host dashboard
│   │   │   └── api/              # API routes (session creation, etc.)
│   │   └── components/
│   │       ├── interactions/     # One component per interaction type
│   │       ├── presentation/     # SlideStage, PdfRenderer, SlideControls
│   │       └── host/             # Host control panel components
│   │           ├── HostToolbar.tsx          # adaptive side/bottom toolbar
│   │           ├── HostLayoutShell.tsx      # outer layout shell, aspect-ratio aware
│   │           ├── MultiDeviceBadge.tsx     # connected host count + host token QR
│   │           ├── AttentionNudgeButton.tsx # always-present nudge trigger
│   │           ├── VoiceCommandToggle.tsx   # mic on/off + status indicator
│   │           ├── VoiceCommandEditor.tsx   # phrase assignment within preset editor
│   │           ├── SessionEndModal.tsx      # end session confirm + download prompt
│   │           └── MetricsReportPreview.tsx # summary before download
│   └── party/                    # PartyKit server (replaces separate backend)
│       ├── session.ts            # Session state machine (room logic)
│       └── interactions/         # Server-side logic per interaction type
├── packages/
│   └── types/                    # Shared TypeScript types (Session, Interaction, etc.)
├── hooks/
│   ├── useHostLayout.ts          # aspect ratio + orientation detection
│   └── useVoiceCommands.ts       # SpeechRecognition wrapper + fuzzy phrase matching
├── lib/
│   └── exportReport.ts           # jsPDF / CSV generation from SessionMetrics
├── .env.example                  # NEXT_PUBLIC_MODE=local | cloud
└── README.md
```

---

## 9. Build Phases

### Phase 1 — Core Loop (Week 1–2)
- [x] Session creation with invite code + QR code generation
- [x] Audience join flow (no auth required)
- [x] Blank lobby screen
- [x] WebSocket connection (host ↔ audience)
- [x] First working mode: **Crowd Prompt** (host types text → audience sees it full screen)
- [x] Localhost mode working end-to-end (LAN QR code printed in terminal on `npm run dev`)

### Phase 2 — Polling (Week 3)
- [x] Host can create a poll with 2–10 options
- [x] Audience sees tap-to-vote buttons
- [x] Live vote counts update on all screens simultaneously
- [x] Host can close the poll and reveal final results

### Phase 3 — More Modes (Week 4–5)
- [x] Quiz mode (poll + reveal correct answer)
- [x] Emoji reaction mode
- [x] Open text submission (host sees responses stream in)
- [x] Countdown timer

### Phase 4 — Slide Deck Engine (PDF-to-Canvas)
- [x] **Technical Foundation**: Integrate `pdfjs-dist` and build the 16:9 **Presentation Stage**
- [x] **Layered Rendering**: Setup the three-layer stack (Slide Image → Interaction Overlay → Controls)
- [x] **Slide Sync**: Implement `{ type: "SET_SLIDE", index: X }` WebSocket event to sync whole room
- [x] **Interactivity**:
  - [x] Keyboard listeners (Arrow keys/Clicker support for Host)
  - [x] Slide Navigator (Filmstrip of thumbnails for quick jumping)
  - [x] Contextual Interaction (Auto-launch specific polls when hitting certain slides)
- [x] **Automatic Clean-up**: Ensure all binary slide assets and metadata are wiped when host ends session

### Phase 5 — Polish (Week 6)
- [x] Mobile-first responsive design (audience screens are phones)
- [x] Reconnection handling (participant drops Wi-Fi → reconnects seamlessly)
- [x] Session history (host can review past interactions)
- [x] Premade Presets (host can save commonly used prompts for one-tap launch)
- [x] Basic host analytics (response rates, most popular option, etc.)
- [x] Browser Fullscreen API integration for Host Dashboard

#### Persistent Interaction Toolbar (Host)

The tool selector — where the host picks which interaction to launch — must always be reachable in one tap, no matter where the host is on the dashboard. It is never hidden behind a menu or requires scrolling to find.

- [x] **Adaptive toolbar position by device:**
  - Desktop (landscape, wide viewport): toolbar sits on the **left side**, fixed, full height — icons + labels stacked vertically
  - Phone (portrait, narrow viewport): toolbar sits on the **bottom**, fixed, full width — icons in a horizontal row
  - Detection uses CSS container queries + a `useHostLayout` hook that watches `window.innerWidth` and `screen.orientation`
- [x] **Toolbar contents** (always visible, one tap to launch):
  - Crowd Prompt
  - Live Poll
  - Quiz
  - Open Text
  - Emoji Reactions
  - Countdown
  - Slide Navigator (if a PDF is loaded)
  - **Attention Nudge** — included directly in the toolbar as a persistent, always-reachable button; tapping it fires the nudge immediately without entering any other menu
- [x] Active interaction is highlighted in the toolbar so the host always knows what's live at a glance
- [x] Toolbar icons use large tap targets (minimum 48×48px) — usable under pressure mid-presentation
- [x] Toolbar can be collapsed to icon-only mode (no labels) to reclaim screen space, with a toggle at the edge

#### No-Scroll Desktop Dashboard

The host desktop view must fit entirely within one viewport — **no vertical scrolling under any circumstances**. Everything the host needs during a live session is visible at once.

- [x] **Layout zones** (all within 100vh, no overflow):
  - Left: persistent interaction toolbar (fixed width, ~64–80px collapsed / ~180px expanded)
  - Center: active interaction panel — poll results, prompt preview, slide stage, etc.
  - Right: live stats sidebar — participant count, response rate, last action
  - Top bar: session code + QR code (compact), voice status indicator, fullscreen toggle
  - No element outside these zones; settings and history accessible via modal/drawer, not inline scroll
- [x] All panels use `overflow: hidden` or internal scroll (only the results list inside the center panel may scroll independently, not the page itself)
- [x] Minimum supported desktop resolution: **1280×720** — layout verified at this size with no clipping
- [x] Dashboard tested at 1280×720, 1440×900, 1920×1080 — no scroll at any breakpoint

### Phase 6 — Host UX & Multi-Device Support

The host experience needs to work just as well on a phone as on a laptop, and should support running the dashboard across multiple devices simultaneously — so a co-host, a second screen, or a backup device can all control the session without conflicts.

#### Host Layout — Aspect Ratio Adaptation

The dashboard detects the host's device orientation and screen shape and switches layout automatically. No separate "mobile site" — same codebase, same components, different arrangement.

- [x] **Aspect ratio detection** via `useHostLayout` hook:
  - [x] Landscape / wide (≥1024px wide): full desktop layout — side toolbar + center panel + right stats
  - [x] Portrait / narrow (<768px wide): phone layout — bottom toolbar + stacked panels + top session bar
  - [x] In-between (768–1023px, tablet landscape): condensed desktop — side toolbar icon-only, no right stats sidebar
- [x] Orientation change is handled gracefully — layout reflows without losing active interaction state
- [x] Host can manually lock the layout to a preferred mode via a toggle in settings (overrides auto-detect)
- [x] All touch targets meet minimum 48×48px on phone layout — tested with one-thumb use in mind
- [x] Phone layout tested on 390px wide (iPhone SE) as the minimum supported width — no horizontal scroll

#### Phone-Optimized Host Controls

When on a phone, the host dashboard is stripped down to only what's needed mid-session — nothing that requires reading small text or precise tapping.

- [x] **Bottom toolbar** (phone): 6–8 large icon buttons in a scrollable row, Attention Nudge always visible at the far right as a distinct color
- [x] **Active interaction panel** takes up most of the screen — results bars or prompt text are large and readable at arm's length
- [x] Swipe up from bottom toolbar to expand a "quick settings" tray (end session, toggle fullscreen, voice on/off) — does not navigate away
- [x] Session code shown as a small persistent chip at the top — tap to show full QR code as a modal overlay
- [x] All destructive actions (end session, close interaction) require a 2-tap confirm — accidental taps are easy on phones

#### Multi-Device Host Mode

The host can open the dashboard on 2–3 devices at the same time. All devices see the same state and any one of them can fire an interaction — there is no "primary" device.

- [x] **How it works:**
  - [x] When a session is created, the host receives a **Host Token** (a separate secret code from the audience invite code)
  - [x] Any device that joins with the Host Token gets full host privileges — dashboard view, ability to launch interactions, close polls, etc.
  - [x] All host devices are synced via the same WebSocket room — if one fires a poll, all other host dashboards update to show it as active immediately
- [x] **Data model additions:**
  ```ts
  Session {
    ...existing fields...
    hostToken: string        // ← secret, separate from audience invite code
    activeHosts: string[]    // ← list of connected host device IDs
  }
  ```
- [x] Host Token is shown on the dashboard as a QR code (tap to reveal) — the host can scan it with a second phone to instantly open a second dashboard
- [x] Maximum 3 simultaneous host devices — enforced server-side to prevent token leaks from becoming a problem
- [x] If a host device disconnects, others continue unaffected — no single point of failure
- [x] The audience invite code and host token are visually distinct (different label, different color) so the host never accidentally shares the wrong one

#### Attention Nudge — Full Spec

The Attention Nudge is always one tap away in the toolbar on both desktop and phone. It does not require opening a menu.

- [x] Tapping the nudge button immediately broadcasts to all audience devices:
  - [x] A full-screen banner overlay: **"👀 Look up!"** (or custom message set by host)
  - [x] A short vibration pulse on mobile devices that support it (`navigator.vibrate`)
  - [x] An optional sound chime (host can enable/disable in settings — off by default)
- [x] Nudge auto-dismisses after 4 seconds, or audience members can tap to dismiss early
- [x] Host can customize the nudge message per session in settings
- [x] Nudge cannot be spammed — 8-second cooldown enforced server-side between nudges

#### Project Structure Additions

```
apps/web/
└── components/
    └── host/
        ├── HostToolbar.tsx          # adaptive side/bottom toolbar, all modes
        ├── HostLayoutShell.tsx      # outer layout shell, switches on aspect ratio
        ├── MultiDeviceBadge.tsx     # shows connected host count + host token QR
        └── AttentionNudgeButton.tsx # always-present nudge trigger with cooldown UI
hooks/
└── useHostLayout.ts                 # aspect ratio + orientation detection hook
```

---

### Phase 7 — Voice Activation

The host can speak a pre-configured trigger phrase and the app will automatically launch the mapped interaction — no tapping required. Voice is always a *shortcut*, never a replacement; every voice command has a tap equivalent on the dashboard.

**How it works:**

The browser's built-in **Web Speech API** (`SpeechRecognition`) runs continuously in the background while the host dashboard is open. It listens for phrases the host has mapped to specific presets or actions. When a match is detected above a confidence threshold, the interaction fires exactly as if the host had tapped the button.

```
Microphone → SpeechRecognition (browser) → phrase match → dispatch action → WebSocket broadcast → all devices update
```

- [x] **Voice Engine setup**
  - [x] Add a "Enable Voice Control" master toggle in the host dashboard settings
  - [x] Wrap `SpeechRecognition` in a `useVoiceCommands` hook (continuous listening, auto-restart on silence)
  - [x] Show a live mic indicator on the host dashboard (green dot = listening, red = paused/error)
  - [x] Graceful fallback UI for Firefox/Safari with a clear "Voice commands require Chrome or Edge" notice
  - [x] Request mic permission on first enable; remember preference in `localStorage`

- [x] **Phrase-to-action mapping**
  - [x] Host can assign a trigger phrase to any saved Preset (e.g. "let's vote" → launch Poll A)
  - [x] Built-in global commands — implemented as internal system presets, not a separate lookup table. Each command is a named action registered in the voice engine at startup:
    - `"next slide"` → `SLIDE_NEXT`
    - `"go back"` / `"previous slide"` → `SLIDE_PREV`
    - `"end poll"` / `"close it"` → `CLOSE_INTERACTION`
    - `"start timer"` → `LAUNCH_COUNTDOWN` (uses last-set duration)
    - `"back to lobby"` → `RETURN_TO_LOBBY`
  - [x] All global commands are registered via the same fuzzy-match pipeline as user presets — no separate code path, no separate table to break
  - [x] Phrases are fuzzy-matched (not exact string) — "let's do a vote" still triggers "let's vote"
  - [x] Minimum confidence threshold (default 0.80) — configurable per host session

- [x] **Preset integration**
  - [x] Voice trigger field added to the Preset editor UI ("When I say...")
  - [x] Phrase map stored alongside presets in `localStorage` (localhost) or PartyKit room storage (cloud)
  - [x] Visual confirmation on match: the triggered preset card briefly highlights on the host dashboard

- [x] **Noise & false positive handling**
  - [x] Debounce: same command cannot re-fire within 3 seconds of last trigger
  - [x] Push-to-listen mode (optional): host holds Spacebar to activate listening instead of continuous mic — useful in loud rooms
  - [x] Host can mute/unmute voice listening with a single toggle without leaving the dashboard

- [x] **Data model additions**

  ```ts
  Preset {
    id: string
    label: string
    interactionType: InteractionType
    payload: object
    voiceTrigger?: string      // ← new: phrase that launches this preset
    triggerConfidence?: number // ← new: match threshold (0.0–1.0, default 0.80)
  }

  VoiceSession {
    enabled: boolean
    mode: "continuous" | "push-to-listen"
    globalCommands: boolean    // toggle built-in slide/lobby commands
    lastTriggeredAt: timestamp | null
  }
  ```

- [x] **Project structure additions**

  ```
  apps/web/
  └── components/
      └── host/
          ├── VoiceCommandToggle.tsx   # mic on/off button + status indicator
          └── VoiceCommandEditor.tsx   # phrase assignment UI within preset editor
  hooks/
  └── useVoiceCommands.ts             # core SpeechRecognition wrapper + fuzzy match logic
  ```

- [x] **Touch-ups & UX Polishing**
  - [x] Add active/pressed states to all dashboard and audience buttons for tactile feedback
  - [x] Redesign landing page (`/`) to clearly offer two paths: "Host a Session" and "Join a Session"
  - [x] Make the "Host shortcut" on the join page more subtle to keep focus on joining
  - [x] Add subtle hover transitions to all interactive cards and panels
  - [x] **Host Layout Switching:** Add a simple layout toggle button in the host sidebar (desktop) or toolbar (mobile).
    - [x] **Desktop:** Switch between **Standard** (side toolbar + full right panel) and **Compact** (icon-only side toolbar, right panel hidden).
    - [x] **Mobile:** Switch between **Standard** (bottom toolbar + full content) and **Heads-Up** (bottom toolbar only, interaction title large, no clutter).
    - [x] Layout choice is saved in `localStorage` per session.
  - [x] **Phone Quick Settings:** In mobile view, swipe up on the bottom toolbar to expand a compact tray showing:
    - [x] End Session (2-tap confirm)
    - [x] Toggle Fullscreen 
    - [x] Toggle Voice Control
    - [x] Slide Settings (current slide + navigator)
    - [x] This tray slides up over the bottom ~30% of the screen and can be swiped back down.
  - [x] **Icon SVGs:** All icons must be SVGs.
  

**Browser support reality check:**

| Browser | Support |
|---|---|
| Chrome / Edge | ✅ Full support |
| Safari (macOS 14+) | ⚠️ Partial — works but less reliable |
| Firefox | ❌ Not supported — show fallback notice |
| Mobile Chrome (Android) | ✅ Works |
| Mobile Safari (iOS) | ⚠️ Works only when page is in foreground |

Voice activation is opt-in and off by default. The host dashboard works identically without it.

---

---

### Phase 8 — Bug Fixes, Slide UX & Session Metrics

This phase addresses confirmed bugs, UX inconsistencies found during real use, and adds the metrics reporting system. Nothing here is new feature work — it's making what already exists actually correct and trustworthy.

#### Bug: Session Status Not Clearing on End

When the host ends a session, the host dashboard still shows a "Live" indicator. The session status is not being broadcast correctly on close.

- [x] `{ type: "SESSION_CLOSED" }` WebSocket event must be emitted server-side the moment the host ends the session
- [x] Host dashboard listens for this event and transitions status indicator from `"Live"` → `"Ended"` immediately
- [x] Audience devices receive the same event and are shown a "Session has ended" screen — they are not left on a blank or stale screen
- [x] Status indicator component reads exclusively from server-pushed state, not from local state or a stale join-time snapshot
- [x] Verified: ending a session from any host device (including secondary host devices) triggers the correct status update on all other host dashboards

#### Bug: Audience Slide View — Overlapping UI

As seen in the screenshot, metadata text (slide number, "Synced live with host" label, filename) is rendering on top of the slide canvas itself, obscuring content.

- [x] All slide metadata — filename, slide counter (e.g. `1/15`), sync status badge — renders **outside** the slide canvas boundary, not overlaid on top of it
- [x] **Desktop audience view layout:**
  - Slide canvas (16:9, fills available width)
  - Below the canvas: filename left-aligned, slide counter right-aligned, sync badge centered — all in a single metadata bar below the slide
- [x] **Phone audience view layout:**
  - Slide canvas expands to fill as much vertical space as possible
  - Metadata bar is a slim strip below the canvas (not floating over it)
  - The "Synced live with host" badge moves to the metadata bar — not a corner overlay
  - Slide canvas must not be cropped or scaled down to accommodate UI chrome; chrome goes below
- [x] No text, badge, or UI element uses `position: absolute` inside the canvas wrapper unless it is explicitly a non-blocking overlay (e.g. a loading spinner that disappears)

#### Bug: Slide Position Resets to Slide 1 When Interaction is Triggered

When the host launches a poll, prompt, or any interaction while slides are active, the slide position resets to slide 1 after the interaction closes.

- [x] **Root cause fixed:** slide index is stored independently of `currentInteraction` and is not cleared when interactions start or stop.
- [x] `SlideState.currentIndex` lives at the top level of the PartyKit room state — peer to `currentInteraction`, not a child of it
- [x] Closing an interaction emits `{ type: "CLOSE_INTERACTION" }` — this event never touches `SlideState`
- [x] Launching a new interaction emits `{ type: "START_INTERACTION", ... }` — this event never touches `SlideState`
- [x] After an interaction closes, the audience slide view resumes showing the slide that was active before the interaction started — no reset, no flicker
- [ ] Verified with test case: start on slide 8 → launch poll → close poll → audience is still on slide 8

#### Slide + Interaction Coexistence (Removed: Contextual Triggers)

The previous plan included "Contextual Interaction" (auto-launch polls on specific slides). This is removed. The correct model is simpler:

- [x] **Slides and interactions are independent.** The slide engine and the interaction engine run in parallel — launching a poll does not replace the slide, and the slide does not block launching a poll.
- [x] **Audience view during an active interaction while slides are loaded:**
  - The slide canvas remains visible in the upper portion of the screen
  - The interaction UI (poll buttons, prompt text, etc.) appears **below the slide**, not replacing it
  - On phone: slide takes ~55% of screen height, interaction takes ~40%, thin divider between
  - On desktop: slide is in the center panel, interaction panel is on the right — same layout as always
- [x] The host toolbar interaction buttons work at all times regardless of slide state — no disabled states, no "you must close slides first" gates
- [x] Removed from Phase 4: `Contextual Interaction (Auto-launch specific polls when hitting certain slides)` — this checkbox is deprecated and will not be built

#### Session Metrics System

Every interaction's data is tracked passively throughout the session. The host is never asked to opt in — metrics are always collected. At session end, the host is prompted to download a report.

- [x] **End Session button should be on the panel header** - this makes it easier to close the session when you are done.
- [x] **What is tracked per interaction:**
  - Interaction type and question/prompt text
  - Which slide was active when it was launched (`slideIndexAtLaunch`)
  - Total number of responses received
  - Response rate (responses ÷ participants connected at launch time)
  - Per-option vote counts (polls, quiz)
  - All open text responses (anonymized, no participant ID attached)
  - Duration from launch to close (seconds)
  - Timestamp of start and end
- [x] **What is tracked per session:**
  - Total unique participants (by anonymous UUID)
  - Peak concurrent participants (highest simultaneous connection count)
  - List of all interaction metrics in chronological order
- [x] **Data model** (already added to Section 6 above): `SessionMetrics` and `InteractionMetric`
- [x] Metrics are accumulated server-side in PartyKit room state throughout the session — no client-side aggregation
- [x] **Session End Flow — Download Prompt:**
  - When the host taps "End Session" and confirms, before the session is torn down, a modal appears:
    > **"Session complete! Download your metrics report?"**
    > [Download Report] [Skip]
  - "Download Report" triggers a JSON → PDF or JSON → CSV export (host can choose format) and downloads it to the host device
  - "Skip" ends the session immediately with no export
  - The modal has a 30-second auto-dismiss that skips the download — the session cannot be held open indefinitely
  - If multiple host devices are connected, only the device that clicked "End Session" sees the download prompt
- [x] **Report contents (PDF or CSV):**
  - [x] Session summary: date, duration, session code, total participants, peak concurrent
  - [x] Per-interaction table: type, question, slide number at launch, responses, response rate, duration
  - [x] Poll/quiz breakdowns: each option with vote count and percentage
  - [x] Open text responses: listed verbatim, one per row
- [x] Report is generated entirely client-side (no server round-trip) using `jsPDF` (PDF) or plain CSV string construction — no data ever sent to a third-party export service
- [x] **Project structure additions:**
  ```
  apps/web/
  ├── components/host/
  │   ├── SessionEndModal.tsx       # end session confirm + download prompt
  │   └── MetricsReportPreview.tsx  # optional: shows a summary before download
  └── lib/
      └── exportReport.ts           # jsPDF / CSV generation from SessionMetrics
  ```

#### Remaining test coverage

- [x] Automated regression test added for the slide reset bug: start on slide 8 → launch poll → close poll → audience remains on slide 8.
- [x] Automated regression test added for session closure broadcast from a secondary host device so the other host dashboards immediately switch from "Live" to "Ended".
- [x] Visual or component-level regression test added for the audience slide metadata layout so the filename, counter, and sync badge stay below the canvas on desktop and phone.

---

### Phase 9 — Open Source Release
- [x] Release docs pass
  - [x] Clean README with architecture overview and project purpose
  - [x] Document both deployment targets: localhost mode and cloud mode
  - [x] Add environment variable reference for `NEXT_PUBLIC_MODE`, PartyKit, and app URL settings
  - [x] Add troubleshooting notes for common startup and connection issues
- [x] One-click Vercel deployment
  - [x] Add deployment instructions/button path for the frontend
  - [x] Verify PartyKit cloud room setup is documented for Vercel users
  - [x] Confirm the docs clearly state that no Railway or Fly.io setup is required
- [x] Localhost quickstart
  - [x] Document `npm run dev` as the local startup command
  - [x] Explain how to share the host machine's LAN IP and QR code to audience phones
  - [x] Note the expected local ports and how to handle port conflicts
- [x] Docker Compose self-hosting
  - [x] Add a Compose file for running the app locally on a server
  - [x] Include service wiring, ports, and env vars in the docs
  - [x] Verify the compose flow matches the documented startup steps
- [x] Contributing guide
  - [x] Add branch/PR workflow guidance
  - [x] Add code style and testing expectations
  - [x] Add a minimal issue/PR checklist for contributors

### Phase 9 — Release Done Criteria
- [x] A fresh clone can be started locally using the README alone
- [x] Cloud deployment instructions work without external platform ambiguity
- [x] Docker Compose starts the full stack without undocumented manual steps
- [x] Contributing guide is present and matches the repo workflow

---

## 10. Scalability Notes

At 10–40 concurrent users per session, this stack is massively over-provisioned. Things to keep in mind as you grow:

- **Send aggregates, not raw votes.** When 30 people vote simultaneously, don't broadcast 30 individual events. Debounce on the server and send `{ optionA: 12, optionB: 18 }` once per 200ms.
- **Participant IDs are anonymous.** Generate a UUID on join and store it in `sessionStorage` — no login, no tracking, no GDPR headache.
- **Sessions are ephemeral.** Don't persist session data longer than needed. PartyKit room state gets garbage collected when the session closes.
- **PartyKit scales automatically.** Up to ~1,000 concurrent connections on the free tier — still a single platform, no extra infra. Beyond that, PartyKit Pro handles it.

---

## 11. Open Source Principles

- **MIT License** — anyone can fork, self-host, or build on top
- **Zero vendor lock-in** — every dependency has a self-hosted alternative
- **No tracking, no analytics by default** — opt-in only
- **Environment variables only** — no secrets in code
- **Keep it boring** — Node.js, TypeScript, no database. No exotic tech that future contributors have to learn

---

## 12. Nice-to-Haves (Post-MVP)

- Prompt transition alert (automatically notify audience when host switches to a new prompt/interaction)
- Word cloud from open text responses
- Image/GIF display mode (host shows a meme, audience reacts)
- "Rate this on a scale of 1–5" slider interaction
- Branded sessions (custom colors/logo for the lobby screen)
- Export results to CSV
- Presentation mode that integrates as a browser extension alongside slideshow tools
- Progressive Web App (PWA) so audience can "install" it like a native app

---

*This plan is designed to be built incrementally — each phase ships a working, usable product. Start with Phase 1 and get it in front of real users before building Phase 3.*