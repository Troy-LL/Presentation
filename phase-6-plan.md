# Phase 6 Implementation Plan: Open Source Release

This phase focuses on transforming the codebase from a functional prototype into a polished, shareable, and easily deployable open-source project.

## 1. Documentation Overhaul

### README.md Enhancement
- [ ] **Visuals**: Add a hero image or GIF showing the app in action.
- [ ] **Architecture Overview**: Explain the relationship between the Next.js frontend, PartyKit WebSocket server, and the audience/host roles.
- [ ] **Deployment Matrix**:
    - **Cloud (Vercel + PartyKit)**: Recommended for public events.
    - **Local (LAN)**: Recommended for classrooms/Wi-Fi restricted areas.
    - **Self-Hosted (Docker)**: Recommended for private servers.
- [ ] **Environment Reference**: A comprehensive table of all `NEXT_PUBLIC_*` and server-side variables.
- [ ] **Troubleshooting**: Common issues (e.g., firewall blocking port 3000 on LAN).

### New Documentation Files
- [ ] **CONTRIBUTING.md**: Guidelines for setting up the dev environment, branching strategy, and code style.
- [ ] **LICENSE**: Add the MIT License file.
- [ ] **SECURITY.md**: Basic instructions on how to report vulnerabilities.

## 2. Containerization (Self-Hosting)

### Docker Support
- [ ] **Dockerfile**: A multi-stage build for the Next.js application.
- [ ] **docker-compose.yml**:
    - `web`: The Next.js frontend.
    - `party`: A local PartyKit server instance.
    - `environment`: Pre-configured networking to link the two services.
- [ ] **Production Script**: Add a `start:prod` script to the root `package.json` that mimics the Docker entrypoint.

## 3. One-Click Deployment

### Vercel Integration
- [ ] **Deploy Button**: Add the "Deploy to Vercel" markdown to the README.
- [ ] **Template configuration**: Ensure `vercel.json` or project settings are documented to handle the monorepo structure.

## 4. Final Polish & QA

- [ ] **Pre-flight Check**: Run `npm run lint`, `npm run typecheck`, and `npm run build` to ensure a clean state.
- [ ] **Join Link UX**: Ensure the auto-generated QR code uses the correct `NEXT_PUBLIC_APP_URL` even when running in different environments.
- [ ] **Anonymous ID Persistence**: Verify that participant IDs persist through refresh but cleared on session end (if applicable).

## 5. Community Readiness

- [ ] **GitHub Templates**: Add `.github/ISSUE_TEMPLATE` and `PULL_REQUEST_TEMPLATE.md`.
- [ ] **Feature Roadmap**: Document the "Nice-to-Haves" from the main plan as a community roadmap.
