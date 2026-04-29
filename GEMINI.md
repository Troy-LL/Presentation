# Project Overview: Interactive Presentation App

A real-time, interactive presentation platform designed for zero-friction audience participation. It allows hosts to upload PDF slides and overlay live interactions like polls, quizzes, emoji reactions, and countdowns.

## Core Technologies
- **Frontend**: Next.js 15 (App Router, TypeScript)
- **Real-time Backend**: PartyKit (Cloudflare Workers / WebSockets)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **PDF Handling**: PDF.js
- **State Management**: Distributed state via PartyKit with room-based persistence.

## Architecture
This is a monorepo managed by `npm` workspaces:
- `apps/web`: The main Next.js application and PartyKit server logic (`partykit/session.ts`).
- `packages/types`: Shared TypeScript definitions for client-server communication.

## Key Workflows & Logic
- **Real-time Sync**: `apps/web/partykit/session.ts` manages the source of truth for each session, including participant counts, active interactions, and history.
- **Connection Hook**: `apps/web/lib/use-session-connection.ts` is the primary interface for both hosts and audience to interact with the real-time server.
- **Local Network Mode**: `scripts/start-local.mjs` enables easy local hosting by detecting the LAN IP and configuring environment variables automatically.

## Building and Running

### Development
- **Local Network Launch (Recommended)**: `npm run local`
  Starts the app and prints a QR-code-friendly LAN URL for mobile devices on the same Wi-Fi.
- **Standard Dev**: `npm run dev`
  Starts Next.js (port 3000) and PartyKit (port 1999) concurrently.

### Production
- **Build**: `npm run build`
- **Start**: `npm run start`

### Quality Control
- **Linting**: `npm run lint`
- **Type Checking**: `npm run typecheck`
- **Testing**: `npm run test` (Vitest)

## Development Conventions
- **Strict Typing**: All messages and state objects must be defined in `packages/types/src/index.ts`.
- **Component Structure**:
  - `apps/web/components/audience-*`: Audience-facing interactive components.
  - `apps/web/components/host-*`: Host-facing control and result components.
- **Stateless Identity**: Uses `lib/identity.ts` for anonymous participant tracking without accounts.
- **Surgical Edits**: When modifying real-time logic, ensure `ClientMessage` and `ServerMessage` types are updated in sync with `session.ts` and `use-session-connection.ts`.
