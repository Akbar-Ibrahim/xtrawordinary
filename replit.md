# WordPlay - Word Games Collection

## Overview

WordPlay is a web-based platform offering 21 interactive vocabulary games designed for educational entertainment and vocabulary improvement. It's a full-stack TypeScript project with a React frontend and Express backend. Key features include optional user accounts (Google OAuth + email/password), a global leaderboard, and hybrid statistics that work for both guests (localStorage) and signed-in users (synced to backend). The platform aims to provide an engaging experience for vocabulary enhancement with diverse game mechanics.

**Word Sweep** has two modes: Classic (free-form 6×6 grid, gravity, shuffle) and Guided (timed 6×6 puzzle with known word list, speed scoring: `max(50, 1000 - elapsed_seconds*5 - wrong_attempts*50)`). Leaderboard tabs for each mode (Classic → `word-sweep`, Guided → `word-unpack`). Daily challenge and group rounds use `seed % 2 === 0 → classic, odd → guided`.

**Shell Words** (id: 21, slug: `shell-words`): A game where removing the first and last letter of a word reveals a hidden inner word (e.g., BRAND → RAN). Two modes: Blitz (90s free entry, slug `shell-words`, score = 10 + outerLen×2) and Wrapper (2min, given middle word find wrappers, slug `shell-words-guided`, score = found×15 + timeLeft×2). Shell word data precomputed at startup in `server/game-data.ts` using `shellWordSet` (O(1) lookup) and `shellWordPuzzles` (≥3 wrappers each). API: `GET /api/games/shell-words/validate?word=` and `GET /api/games/shell-words/puzzle?seed=`.

## User Preferences

Preferred communication style: Simple, everyday language.
MySQL storage is the priority for all new features — always implement MySQLStorage first alongside MemStorage. This app will be published and connected to a real MySQL database.

## System Architecture

### Frontend
The frontend uses React 18, TypeScript, Wouter for routing, TanStack React Query for state management, and Tailwind CSS with CSS variables for styling. Shadcn/ui provides UI components, and Framer Motion handles animations. The build process is managed by Vite. It follows a component-based architecture supporting light/dark mode, smooth transitions, and animated score displays.

### Backend
The backend is built with Express.js and TypeScript, exposing RESTful API endpoints under `/api/`. It integrates with Vite for hot module replacement in development and serves static files in production. The server includes main application setup, route definitions, and a data access layer with conditional storage backends.

### Authentication
The platform offers optional user accounts via Google OAuth and email/password. Passport.js is used for authentication strategies, including `passport-google-oauth20` and a local strategy with bcryptjs for password hashing. Email verification and password reset functionalities are managed via Resend. `express-session` handles session management. Authorization is enforced with `requireAuth` and `requireAdmin` middleware.

### Data Layer
Zod schemas define types and validation for both frontend and backend. The storage architecture is defined by an `IStorage` interface, with a default in-memory `MemStorage` and an optional `MySQLStorage` using Drizzle ORM if `MYSQL_DATABASE_URL` is configured. Game content data is primarily stored in `server/game-data.ts` for in-memory storage, while MySQL storage handles user, auth, stats, and leaderboard data.

### Player Engagement
The system supports hybrid player engagement where guest players use localStorage, and signed-in players have their stats synced to the backend. This includes personal bests, game statistics, a daily streak system, and 19 achievement definitions. Stats, streaks, and achievements are synced to the backend after each game for signed-in users.

### Leaderboard, User Profiles, Friends, and Challenges
A global leaderboard allows players to compare scores across different games. User profiles display public information, stats, and achievements. A friends system enables users to connect, send requests, and manage their friend lists. Friend challenges allow users to challenge friends in specific games, with features for creating, playing, and tracking challenge results.

### Groups & Community System
A groups feature lets signed-in users create or join groups with an invite code. Each group has owner/admin/member roles. Admins can start "rounds" — a specific game with a deterministic seed — so all group members play the same variant. Members submit scores after playing, and a per-group leaderboard aggregates all-time scores. The system uses 4 new DB tables: `groups`, `group_members`, `group_rounds`, `group_round_scores`. Frontend pages: `/groups` (list + create/join), `/groups/:id` (detail with tabs: Rounds, Leaderboard, Members), `/groups/:id/rounds/:roundId/play` (game play with auto-score submission). "Groups" link appears in the authenticated user dropdown.

### Comment System
A polymorphic comment system allows signed-in users to comment on games and group rounds. Features: one-level threading (replies), 500-char plain text, soft delete (content cleared but comment preserved for thread integrity), report system with reason text. Reads are public; create/delete/report require authentication. DB tables: `comments` (targetType + targetId polymorphic, parentId nullable), `comment_reports`. Reusable `<CommentSection targetType="game" targetId={slug} />` component used in game-detail and group-round-play pages. Admin dashboard has a "Comments" tab showing reported comments with delete action. REST routes: GET/POST `/api/comments`, DELETE `/api/comments/:id`, POST `/api/comments/:id/report`, GET `/api/admin/comment-reports`, DELETE `/api/admin/comments/:id`.

### Admin Dashboard
An admin dashboard provides analytics, user management (ban/unban, admin status toggle), leaderboard entry management, and a Comments tab for moderating reported comments. Access is restricted to users with `isAdmin: true`.

### Game Design Examples
- **Word Ladder:** A game where players transform one word into another by changing one letter at a time. It features a par system, visual ladder, hint system, and specific scoring mechanics.
- **Letter Pool:** Offers two modes ("With Pool" and "Without Pool") where players spell words from a given letter set. It includes features like automatic submission, order bonuses, hints, and a lives system.

### Shared Code
A `shared/` directory ensures type consistency and validation across the full stack using TypeScript types and Zod schemas for user, auth token, game stats, leaderboard, streak, and achievement data.

## External Dependencies

### UI Framework
- Radix UI primitives (via Shadcn/ui)
- Lucide React for iconography
- Embla Carousel
- Framer Motion

### Authentication & Security
- Passport.js (Google OAuth + Local strategies)
- bcryptjs
- express-session + express-mysql-session (persistent sessions in MySQL when `MYSQL_DATABASE_URL` is set)
- Resend

### Data & Validation
- Zod
- Drizzle ORM + Drizzle Zod
- TanStack React Query

### Database
- In-memory storage (MemStorage)
- MySQL storage (MySQLStorage) — fully implements all IStorage methods with optimized queries (batch user lookups, SQL aggregations for leaderboards/admin stats)
- Drizzle ORM with mysql2 driver
- Database indexes defined in `server/db-schema.ts` for all frequently queried columns (foreign keys, composite lookups, sort columns)

### Development Tools
- Vite (React plugin)
- esbuild