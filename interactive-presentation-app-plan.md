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
│   └── party/                    # PartyKit server (replaces separate backend)
│       ├── session.ts            # Session state machine (room logic)
│       └── interactions/         # Server-side logic per interaction type
├── packages/
│   └── types/                    # Shared TypeScript types (Session, Interaction, etc.)
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
- [x] Attention nudge mode (host triggers a "Look at your device now" banner/sound/vibration cue)
- [x] Basic host analytics (response rates, most popular option, etc.)
- [x] Browser Fullscreen API integration for Host Dashboard

### Phase 6 — Open Source Release
- [ ] Release docs pass
  - [ ] Clean README with architecture overview and project purpose
  - [ ] Document both deployment targets: localhost mode and cloud mode
  - [ ] Add environment variable reference for `NEXT_PUBLIC_MODE`, PartyKit, and app URL settings
  - [ ] Add troubleshooting notes for common startup and connection issues
- [ ] One-click Vercel deployment
  - [ ] Add deployment instructions/button path for the frontend
  - [ ] Verify PartyKit cloud room setup is documented for Vercel users
  - [ ] Confirm the docs clearly state that no Railway or Fly.io setup is required
- [ ] Localhost quickstart
  - [ ] Document `npm run dev` as the local startup command
  - [ ] Explain how to share the host machine's LAN IP and QR code to audience phones
  - [ ] Note the expected local ports and how to handle port conflicts
- [ ] Docker Compose self-hosting
  - [ ] Add a Compose file for running the app locally on a server
  - [ ] Include service wiring, ports, and env vars in the docs
  - [ ] Verify the compose flow matches the documented startup steps
- [ ] Contributing guide
  - [ ] Add branch/PR workflow guidance
  - [ ] Add code style and testing expectations
  - [ ] Add a minimal issue/PR checklist for contributors

### Phase 6 — Release Done Criteria
- [ ] A fresh clone can be started locally using the README alone
- [ ] Cloud deployment instructions work without external platform ambiguity
- [ ] Docker Compose starts the full stack without undocumented manual steps
- [ ] Contributing guide is present and matches the repo workflow

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