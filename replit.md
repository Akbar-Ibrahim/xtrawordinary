# xtraWordinary - Word Games Collection

## Overview
xtraWordinary is a web-based platform offering 23 interactive vocabulary games for educational entertainment and vocabulary improvement. It's a full-stack TypeScript project with a React frontend and Express backend. Key features include optional user accounts (Google OAuth + email/password), a global leaderboard, and hybrid statistics that work for both guests (localStorage) and signed-in users (synced to backend). The platform aims to provide an engaging experience for vocabulary enhancement with diverse game mechanics, including unique games like Word Sweep, Shell Words, Deep Shell Words, Word Bloom, and Word Stretch. Future ambitions include integrating these games into daily challenges and group rounds.

The platform also includes a "Quiz Master" feature allowing signed-in users to create shareable quiz sessions for 9 supported games, complete with leaderboards and creator dashboards. A "Premium Custom Play" feature enables premium users to configure custom variants of 5 specific games for practice without score saving.

The real-time 1-on-1 Duel system now supports two formats: **Turn-Based** (alternate turns, 8-second timer, lives system) and **Race** (simultaneous submission, first to target word count wins within a time limit).

**Turn-Based games (6):** Word Chain, Letter Hunt, Word Length, Letter Frequency, Letter Position (Position Master), Letter Balance.

**Race-only games (8):** Word Scramble, No Repeats, Anagram Solver, Word Stack, Letter Pool, Word Maker, Word Split, Definition Match.

**Five games support both formats:** Letter Hunt, Word Length, Letter Frequency, Letter Position, Letter Balance.

Key components: WebSocket server at `/ws/duel`, typed message protocol (`shared/duel-protocol.ts`), `DuelRoomRegistry` managing room lifecycle (30-second forfeit timers, stale-room sweep every 30 min), three database tables (`duel_challenges`, `duel_sessions`, `duel_ratings`), full REST API for challenge lifecycle, and ELO ratings. The duel UI lives at `/duel/:roomCode` with a phase machine (waiting → countdown → playing → over). Turn engine enforces 8-second turns with server-authoritative timeouts and lives; race engine uses a server-side countdown timer (`armRaceTimer`). Client-side: `duel-race-engine.tsx` renders the race UI with per-player progress bars; race adapters live in `race-adapters.tsx`. The challenge creation dialog in `game-detail.tsx` shows a format toggle (Turn-Based / Race) with race target/time-limit pickers. `DUEL_TURN_SLUGS`, `DUEL_RACE_SLUGS`, and `DUEL_GAME_SLUGS` in `shared/schema.ts` are the sources of truth for which games support which formats. Reconnect snapshots (`room:state`) include race fields. `game:forfeit` WS message lets a player concede mid-game. **Known limitation:** in-progress duels are not resumable after a server process restart — only waiting-room/accepted challenge metadata is persisted.

**Spectator Mode:** Any authenticated user who knows a room code can watch a live duel. WS protocol: client sends `spectator:join` → server sends `spectator:joined` snapshot; `spectator:react` broadcasts emoji reactions to all (allowlist: 👀🔥😬❤️👏); `spectator:count` notifies players of viewer count; `spectator:game_over` closes the session. `DuelRoom` carries `spectators: Map<number, WebSocket>`. REST: `GET /api/duels/rooms/:roomCode` allows non-participants for playing rooms; `GET /api/duels/live` returns all active rooms. Lobby shows a "Live Now" section (polls every 10 s) with clickable room cards.

**Huddle Mode (Group vs Group):** Group admins can challenge another group to a Battle — two groups face off in a duel room with one designated typist per group (the accepting admin). Entry point: "Battle" button on group detail page (admin only). DB table: `huddle_challenges` (challengerGroupId, challengeeGroupId, challengerAdminId, challengeeAdminId, gameSlug, format, raceTarget, raceTimeLimit, status, roomCode, seed, startWord, createdAt, expiresAt). REST API: `POST /api/huddles`, `GET /api/groups/:id/huddles`, `PATCH /api/huddles/:id/accept` (creates duel room + redirects typist), `PATCH /api/huddles/:id/decline`, `PATCH /api/huddles/:id/cancel`. Uses the same duel WS engine unchanged; `finalizeGame` auto-marks the huddle as completed. Notifications: `huddle_challenge_received` (admins of challengee group) and `huddle_accepted` (challenger admin + all members). Pending incoming challenges visible in group Rounds tab with Accept/Decline buttons; outgoing show "Enter Room" link. Only public groups are searchable in the challenge dialog.

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

### In-App Notification System
A persistent, DB-backed notification system delivers alerts for key events to signed-in users. Notification types: `group_join` (owner notified when member joins), `comment_reply` (parent commenter notified on reply), `group_round_start` (all members notified when a round starts), `duel_accepted` (challenger notified when duel is accepted), `friend_challenge_result` (sender notified when receiver completes a challenge).
The `notifications` table stores id, userId, type, title, body, linkUrl, readAt, createdAt with indexed queries for fast per-user lookups. API: `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`. The bell icon in the navigation shows the combined unread badge (DB notifications + real-time duel notifications). Each notification row has type-specific icon/color coding and a "Mark all read" button.

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