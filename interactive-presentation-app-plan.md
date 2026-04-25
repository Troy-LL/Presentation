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

## 4. Tech Stack

Chosen for simplicity, low cost, and open-source friendliness.

### Frontend
- **Framework**: Next.js (React) — handles both the audience app and host dashboard in one repo
- **Styling**: Tailwind CSS — fast, readable, no CSS files to maintain
- **Real-time**: Native browser WebSocket or [PartyKit](https://partykit.io) (free tier, purpose-built for this)
- **PDF Engine**: `pdfjs-dist` (Mozilla) — for client-side PDF-to-Canvas rendering
- **Animations**: `framer-motion` — for smooth slide transitions

### Backend
- **Runtime**: Node.js with [Hono](https://hono.dev) or plain Express
- **Real-time layer**: WebSockets via PartyKit, or self-hosted with `ws` library
- **Database**: SQLite (via PartyKit storage) for session state — lightweight, serverless-friendly
- **Asset Storage**: Ephemeral room storage for generated slide metadata/images
- **Session codes**: Short alphanumeric codes (e.g. `XK29A`) generated server-side

### Infrastructure
- **Hosting**: Vercel (frontend) + Railway or Fly.io (backend WebSocket server) — both have generous free tiers
- **Total cost at 40 concurrent users**: effectively $0/month on free tiers

### Why Not Firebase / Supabase?
Those work too, but add vendor lock-in. The stack above is fully self-hostable and open-source with zero proprietary dependencies.

---

## 5. Data Model

```ts
Session {
  id: string           // e.g. "XK29A"
  hostId: string
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
```

---

## 6. Real-Time Architecture

```
Audience device  ──WebSocket──┐
Audience device  ──WebSocket──┤
Audience device  ──WebSocket──┼──► Session server ──► Host dashboard
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

## 7. Project Structure

```
/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── app/
│   │   │   ├── join/         # Audience join page
│   │   │   ├── lobby/        # Audience lobby + interaction view
│   │   │   ├── host/         # Host dashboard
│   │   │   └── api/          # API routes (session creation, etc.)
│   │   └── components/
│   │       ├── interactions/ # One component per interaction type
│   │       ├── presentation/ # SlideStage, PdfRenderer, SlideControls
│   │       └── host/         # Host control panel components
│   └── server/               # WebSocket server (PartyKit or plain ws)
│       ├── session.ts        # Session state machine
│       └── interactions/     # Server-side logic per interaction type
├── packages/
│   └── types/                # Shared TypeScript types (Session, Interaction, etc.)
└── README.md
```

---

## 8. Build Phases

### Phase 1 — Core Loop (Week 1–2)
- [x] Session creation with invite code + QR code generation
- [x] Audience join flow (no auth required)
- [x] Blank lobby screen
- [x] WebSocket connection (host ↔ audience)
- [x] First working mode: **Crowd Prompt** (host types text → audience sees it full screen)

### Phase 2 — Polling (Week 3)
- [x] Host can create a poll with 2–10 options
- [x] Audience sees tap-to-vote buttons
- [x] Live vote counts update on all screens simultaneously
- [x] Host can close the poll and reveal final results

### Phase 3 — More Modes (Week 4–5)
- [ ] Quiz mode (poll + reveal correct answer)
- [ ] Emoji reaction mode
- [ ] Open text submission (host sees responses stream in)
- [ ] Countdown timer

### Phase 4 — Slide Deck Engine (PDF-to-Canvas)
- [ ] **Technical Foundation**: Integrate `pdfjs-dist` and build the 16:9 **Presentation Stage**
- [ ] **Layered Rendering**: Setup the three-layer stack (Slide Image -> Interaction Overlay -> Controls)
- [ ] **Slide Sync**: Implement `{ type: "SET_SLIDE", index: X }` WebSocket event to sync whole room
- [ ] **Interactivity**: 
    - [ ] Keyboard listeners (Arrow keys/Clicker support for Host)
    - [ ] Slide Navigator (Filmstrip of thumbnails for quick jumping)
    - [ ] Contextual Interaction (Auto-launch specific polls when hitting certain slides)
- [ ] **Automatic Clean-up**: Ensure all binary slide assets and metadata are wiped when host ends session

### Phase 5 — Polish (Week 6)
- [ ] Mobile-first responsive design (audience screens are phones)
- [ ] Reconnection handling (participant drops WiFi → reconnects seamlessly)
- [ ] Session history (host can review past interactions)
- [x] Premade Presets (host can save commonly used prompts for one-tap launch)
- [ ] Basic host analytics (response rates, most popular option, etc.)
- [ ] Browser Fullscreen API integration for Host Dashboard

### Phase 6 — Open Source Release
- [ ] Clean README with self-hosting instructions
- [ ] One-click deploy buttons (Vercel + Railway)
- [ ] Docker Compose file for fully local hosting
- [ ] Contributing guide

---

## 9. Scalability Notes

At 10–40 concurrent users per session, this stack is massively over-provisioned — WebSockets handle thousands of concurrent connections on a single $5/month server. Things to keep in mind as you grow:

- **Send aggregates, not raw votes.** When 30 people vote simultaneously, don't broadcast 30 individual events. Debounce on the server and send `{ optionA: 12, optionB: 18 }` once per 200ms.
- **Participant IDs are anonymous.** Generate a UUID on join and store it in `sessionStorage` — no login, no tracking, no GDPR headache.
- **Sessions are ephemeral.** Don't persist session data longer than needed. SQLite row + WebSocket room gets garbage collected when the session closes.
- **One server per session room** is fine until ~500 concurrent users. Beyond that, look at PartyKit's edge deployment or a Redis pub/sub layer — but you won't need this for a while.

---

## 10. Open Source Principles

- **MIT License** — anyone can fork, self-host, or build on top
- **Zero vendor lock-in** — every dependency has a self-hosted alternative
- **No tracking, no analytics by default** — opt-in only
- **Environment variables only** — no secrets in code
- **Keep it boring** — Node.js, TypeScript, SQLite. No exotic tech that future contributors have to learn

---

## 11. Nice-to-Haves (Post-MVP)

- Word cloud from open text responses
- Image/GIF display mode (host shows a meme, audience reacts)
- "Rate this on a scale of 1–5" slider interaction
- Branded sessions (custom colors/logo for the lobby screen)
- Export results to CSV
- Presentation mode that integrates as a browser extension alongside slideshow tools
- Progressive Web App (PWA) so audience can "install" it like a native app

---

*This plan is designed to be built incrementally — each phase ships a working, usable product. Start with Phase 1 and get it in front of real users before building Phase 3.*
