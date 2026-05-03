# xtraWordinary - Word Games Collection

## Overview
xtraWordinary is a web-based platform offering 23 interactive vocabulary games for educational entertainment and vocabulary improvement. It's a full-stack TypeScript project with a React frontend and Express backend. Key features include optional user accounts (Google OAuth + email/password), a global leaderboard, and hybrid statistics that work for both guests (localStorage) and signed-in users (synced to backend). The platform aims to provide an engaging experience for vocabulary enhancement with diverse game mechanics, including unique games like Word Sweep, Shell Words, Deep Shell Words, Word Bloom, and Word Stretch. Future ambitions include integrating these games into daily challenges and group rounds.

The platform also includes a "Quiz Master" feature allowing signed-in users to create shareable quiz sessions for 9 supported games, complete with leaderboards and creator dashboards. A "Premium Custom Play" feature enables premium users to configure custom variants of 5 specific games for practice without score saving.

The real-time 1-on-1 Duel system supports four games: **Word Chain**, **Letter Hunt**, **Word Length**, and **Letter Frequency**. Key components: WebSocket server at `/ws/duel`, typed message protocol (`shared/duel-protocol.ts`), `DuelRoomRegistry` managing room lifecycle (30-second forfeit timers, stale-room sweep every 30 min), three database tables (`duel_challenges`, `duel_sessions`, `duel_ratings`), full REST API for challenge lifecycle, and ELO ratings. The duel UI lives at `/duel/:roomCode` with a phase machine (waiting → countdown → playing → over). Turn engine (`DuelTurnEngine`) enforces 8-second turns with server-authoritative timeouts and lives. Each game has its own adapter (`*-duel-adapter.tsx`) for client-side validation and display. The `startWord` field stores a game-specific constraint: seed word for Word Chain, target letter for Letter Hunt/Letter Frequency, target length string for Word Length. Server `relayMove` dispatches per-slug validation. Reconnect snapshots (`room:state`) support mid-game rejoin. `DUEL_GAME_SLUGS` in `shared/schema.ts` is the source of truth for which games are duel-enabled. **Known limitation:** in-progress duels are not resumable after a server process restart — only waiting-room/accepted challenge metadata is persisted. Deployment requires a DB migration to add `seed` and `start_word` columns to the `duel_challenges` table.

## User Preferences

Preferred communication style: Simple, everyday language.
MySQL storage is the priority for all new features — always implement MySQLStorage first alongside MemStorage. This app will be published and connected to a real MySQL database.

## System Architecture

### Frontend
The frontend uses React 18, TypeScript, Wouter for routing, TanStack React Query for state management, and Tailwind CSS with CSS variables for styling. Shadcn/ui provides UI components, and Framer Motion handles animations. The build process is managed by Vite. It follows a component-based architecture supporting light/dark mode, smooth transitions, and animated score displays.

### Backend
The backend is built with Express.js and TypeScript, exposing RESTful API endpoints under `/api/`. It integrates with Vite for hot module replacement in development and serves static files in production. The server includes main application setup, route definitions, and a data access layer with conditional storage backends.

### Authentication
The platform offers optional user accounts via Google OAuth and email/password. Passport.js is used for authentication strategies. Email verification and password reset functionalities are managed via Resend. `express-session` handles session management. Authorization is enforced with `requireAuth` and `requireAdmin` middleware.

### Data Layer
Zod schemas define types and validation. The storage architecture is defined by an `IStorage` interface, with a default in-memory `MemStorage` and an optional `MySQLStorage` using Drizzle ORM. Game content data is primarily stored in `server/game-data.ts` for in-memory storage, while MySQL handles user, auth, stats, and leaderboard data. Database indexes are defined for frequently queried columns.

### Player Engagement Features
The system supports hybrid player engagement (guest localStorage, signed-in synced backend). This includes personal bests, game statistics, a daily streak system, and 19 achievement definitions.
A global leaderboard allows score comparison. User profiles display public information, stats, and achievements.
A friends system enables users to connect and send game challenges. Challenges are automated: challenger plays a seeded game, receiver plays the exact same puzzle, scores are auto-submitted, and challenger is notified of results.
A groups feature allows users to create/join groups. Group admins can start "rounds" (seeded games for all members), with scores aggregated in a per-group leaderboard.
A polymorphic likes system allows signed-in users to like games and comments.
A polymorphic comment system allows signed-in users to comment on games and group rounds, supporting replies, soft delete, and reporting.

### Admin Dashboard
An admin dashboard provides analytics, user management (ban/unban, admin status, premium status toggle), leaderboard entry management, and moderation of reported comments. Access is restricted to `isAdmin: true` users.

### Shared Code
A `shared/` directory ensures type consistency and validation across the full stack using TypeScript types and Zod schemas.

## External Dependencies

### UI/UX
- Radix UI primitives (via Shadcn/ui)
- Lucide React for iconography
- Embla Carousel
- Framer Motion

### Authentication & Security
- Passport.js (Google OAuth, Local strategy with bcryptjs)
- express-session + express-mysql-session
- Resend

### Data & Validation
- Zod
- Drizzle ORM + Drizzle Zod
- TanStack React Query
- mysql2 driver

### Development Tools
- Vite (React plugin)
- esbuild