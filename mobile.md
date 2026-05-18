# Mobile App — Decision Log

## Status: On hold until the web app is stable

## Decision
Build the mobile app **after** the web app is complete and stable. Working on both in parallel would mean updating game logic, types, and design in two codebases at the same time, which doubles maintenance cost and increases the chance of divergence.

## What carries over when the time comes
- All TypeScript types and Zod schemas in `shared/` — reusable as-is
- API fetch hooks (TanStack Query logic) — reusable with minimal changes
- Game logic and validation — reusable as-is
- Backend (Express + MySQL) — no changes needed; the mobile app consumes the same API

## What needs to be rebuilt
- All UI components — React Native uses different primitives (`View`, `Text`, `Pressable`, etc.); Tailwind CSS and Shadcn/ui do not carry over
- Routing — replace Wouter with Expo Router (file-based)
- Animations — replace Framer Motion with React Native Reanimated
- Auth UI — rebuild login/OAuth screens using Expo Auth Session

## Technical migration path
1. Convert the project to a **pnpm workspace** (monorepo)
2. Add the Expo app as a new artifact under `apps/mobile/` alongside `apps/web/`
3. Move shared code into `packages/shared/`
4. The web app continues to run unchanged; the mobile app is added on top

## Development tooling change
| Concern | Web | Mobile |
|---------|-----|--------|
| Live preview | Vite dev server | Expo Go on device/simulator |
| E2E testing | Playwright | Jest + React Native Testing Library |
| Build | Vite | Expo EAS Build |
| Deploy | Replit / custom domain | Apple App Store + Google Play |

## Games that need special attention on mobile
- Any game with a long free-text input area (touch keyboard takes up ~40% of screen)
- Timed games — need to account for background/foreground app lifecycle
- Duel/WebSocket features — need reconnection handling for mobile network switches
