# Interactive Presentation MVP

Minimal monorepo for a live presentation room:

- Host creates a session and gets a short code plus QR join link
- Audience joins from `/join` and waits on a blank lobby
- Host launches a crowd prompt and every connected screen updates live through PartyKit

## Workspace

- `apps/web`: Next.js app, API routes, PartyKit room, host and audience UI
- `packages/types`: shared session and socket types

## Local setup

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env.local`
3. Run `npm run dev`
4. Open `http://localhost:3000`

## Required environment variables

- `NEXT_PUBLIC_APP_URL`: origin used for join links and QR codes
- `NEXT_PUBLIC_PARTYKIT_HOST`: PartyKit websocket host for the browser
- `PARTYKIT_SERVER_URL`: PartyKit HTTP base URL used by Next API routes
