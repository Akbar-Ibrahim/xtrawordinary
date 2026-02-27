# WordPlay - Word Games Collection

## Overview

WordPlay is a web-based platform offering seventeen interactive vocabulary games (Word Ladder replaced the original Word Guessing game), designed for educational entertainment and vocabulary improvement. It's built as a full-stack TypeScript project with a React frontend and Express backend. The platform features optional user accounts (Google OAuth + email/password via Resend), a global leaderboard, and hybrid stats that work for both guests (localStorage) and signed-in users (synced to backend). Guest players can play without signing in; all engagement features work via localStorage. Signed-in users get their stats, streaks, and achievements synced to the server for cross-device persistence and leaderboard participation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend utilizes React 18 with TypeScript, Wouter for routing, TanStack React Query for state management, and Tailwind CSS with CSS variables for styling. Shadcn/ui provides UI components, and Framer Motion handles animations. The build process is managed by Vite. It follows a component-based architecture, separating pages, reusable UI, game-specific components, custom hooks, and utilities. The system supports light/dark mode theming, smooth transitions, and animated score displays, streak indicators, and sound effects.

### Backend Architecture
The backend is built with Express.js and TypeScript, exposing RESTful API endpoints under `/api/`. It integrates with Vite for hot module replacement in development and serves static files in production. The server structure includes main application setup, route definitions, a data access layer (`server/storage.ts` with conditional storage backend), Vite development server integration, and static file serving.

### Authentication System
Optional user accounts via two providers:
- **Google OAuth**: Passport.js with `passport-google-oauth20` strategy. Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars. Callback URL: `/api/auth/google/callback`.
- **Email/Password**: Passport.js local strategy with bcryptjs password hashing. Email verification via Resend (`RESEND_API_KEY` env var). Password reset flow with token-based emails.
- **Session Management**: express-session with `SESSION_SECRET` env var, 30-day cookie expiry.
- **Auth Middleware**: `requireAuth` and `requireAdmin` functions in `server/auth.ts` protect user-specific and admin routes.
- **User Flags**: `isAdmin` (boolean) and `isBanned` (boolean) on user schema. Banned users cannot log in.
- **Frontend**: `AuthProvider` context in `client/src/lib/auth-context.tsx`, `AuthModal` dialog for sign in/sign up, navbar integration with user dropdown.

### Auth API Routes
- `POST /api/auth/register` — create account, send verification email
- `POST /api/auth/login` — email/password login
- `POST /api/auth/logout` — destroy session
- `GET /api/auth/me` — current user or null
- `GET /api/auth/google` — initiate Google OAuth
- `GET /api/auth/google/callback` — OAuth callback
- `POST /api/auth/verify-email` — verify email token
- `POST /api/auth/forgot-password` — send reset email
- `POST /api/auth/reset-password` — reset with token

### Environment Variables Required for Full Functionality
- `SESSION_SECRET` — session encryption (already set)
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `RESEND_API_KEY` — Resend email service API key
- `FROM_EMAIL` — sender email address (default: `WordPlay <noreply@wordplay.app>`)
- `APP_URL` — app base URL for email links (default: `http://localhost:5000`)
- `MYSQL_DATABASE_URL` — MySQL connection string (e.g. `mysql://user:pass@localhost:3306/wordplay`). When set, app uses MySQL storage; otherwise uses in-memory storage.

### Remote Server Migration (axios)
Every route in `server/routes.ts` has a commented-out axios block marked with `--- REMOTE SERVER BLOCK ---`. To switch any route to use a remote API: (1) uncomment the `import axios` and `REMOTE_BASE_URL` lines at the top, (2) replace the dummy URL with the real remote server URL, (3) uncomment the axios block inside the route and comment out the local `dataSource` block. Each axios block matches the exact request/response data structure of its route, forwards remote status codes on error, and falls back to descriptive error messages. POST routes forward the request body with defaults applied. No further code changes needed.

### Data Layer
- **Zod Schemas**: `shared/schema.ts` defines all types (games, users, tokens, stats, leaderboard, streaks, achievements).
- **Drizzle MySQL Schema**: `server/db-schema.ts` defines MySQL table definitions using `mysqlTable` from `drizzle-orm/mysql-core`.
- **Storage Architecture**: `server/storage.ts` exports the `IStorage` interface, constraint types, and a Proxy-based `storage` singleton. Actual storage is initialized via `initStorage()` (called in `server/index.ts` before auth/routes setup). Uses `MemStorage` by default or `MySQLStorage` if `MYSQL_DATABASE_URL` is set.
- **MemStorage**: `server/mem-storage.ts` — in-memory IStorage implementation. All game content data lives in `server/game-data.ts`.
- **MySQLStorage**: `server/mysql-storage.ts` implements `IStorage` using Drizzle ORM queries for user/auth/stats/leaderboard/games data. Games are fetched from the `games` MySQL table (with safe JSON parsing for `rules` column and difficulty validation). Other game content (word lists, puzzles, dictionary) remains in-memory via delegation to MemStorage (imported from `mem-storage.ts` to avoid circular dependencies).
- **Games Seed Data**: `seed-games.sql` contains INSERT statements for all 17 games. Run after creating the table via `npx drizzle-kit push`.
- **Validation Schemas**: `server/validators.ts` contains Zod schemas for route input validation (register, login, stats, leaderboard).
- **MySQL Connection**: `server/db.ts` creates a mysql2 connection pool using `MYSQL_DATABASE_URL`.
- **Migration**: Update `drizzle.config.ts` to use `dialect: "mysql"`, `schema: "./server/db-schema.ts"`, and `MYSQL_DATABASE_URL` env var. Then run `npx drizzle-kit push` to create tables.

### Player Engagement (Hybrid: localStorage + Backend)
Guest players use localStorage only. Signed-in players get stats synced to backend automatically:
- **Personal Bests**: `client/src/hooks/use-game-result.ts` hook integrated into all 17 games, saves scores and shows "New Best!" toasts
- **Game Stats**: `client/src/lib/game-stats.ts` library tracks per-game data (best score, play count, win rate, words found) and global data (total games, wins)
- **Streak System**: Date-based daily streak tracking, increments on consecutive days, resets if a day is missed
- **Achievements**: 19 achievement definitions covering milestones (games played, wins, high scores, word counts, streaks, perfect clears)
- **Stats Dashboard**: `/stats` page with overview metrics and per-game breakdowns
- **Achievements Page**: `/achievements` page with badge collection, unlock tracking, and toast notifications
- **Backend Sync**: When signed in, `use-game-result.ts` POSTs to `/api/user/stats`, `/api/user/streak`, `/api/user/achievements`, and `/api/leaderboard` after each game

### Leaderboard
- **Page**: `/leaderboard` with game selector dropdown (all 17 games + "Overall")
- **API**: `GET /api/leaderboard` (overall), `GET /api/leaderboard/:gameSlug` (per-game), `POST /api/leaderboard` (submit score, auth required)
- **Display**: Ranked table with player name, score, date. Top 3 get crown/medal icons. Current user's entry highlighted.

### User Stats API Routes
- `GET /api/user/stats` — all game stats (auth required)
- `POST /api/user/stats` — save game stats (auth required)
- `GET /api/user/streak` — streak data (auth required)
- `POST /api/user/streak` — save streak (auth required)
- `GET /api/user/achievements` — achievements (auth required)
- `POST /api/user/achievements` — save achievement (auth required)

### Admin Dashboard
- **Page**: `/admin` with three tabs: Overview, Users, Leaderboard
- **Access**: Only visible to users with `isAdmin: true`. Admin link appears in user dropdown menu.
- **Overview tab**: Total users, total games played, active game types, games-by-popularity bar chart
- **Users tab**: Full user list with name, email, join date, status badges (Admin/Banned/User), Ban/Unban and Make Admin/Remove Admin buttons
- **Leaderboard tab**: All leaderboard entries with game filter dropdown, delete button per entry

### Admin API Routes
- `GET /api/admin/stats` — analytics overview (admin required)
- `GET /api/admin/users` — list all users (admin required)
- `PATCH /api/admin/users/:id/ban` — toggle ban status (admin required)
- `PATCH /api/admin/users/:id/admin` — toggle admin status (admin required)
- `GET /api/admin/leaderboard` — all leaderboard entries (admin required)
- `DELETE /api/admin/leaderboard/:id` — delete leaderboard entry (admin required)

### Word Ladder Game Design
Word Ladder replaced the original Word Guessing (Wordle clone) game. Players transform one word into another by changing exactly one letter at a time (rearrangement of remaining letters allowed), with each step forming a valid word. No difficulty selection — clicking Play immediately starts a random puzzle. Features:
- **Par system**: Each puzzle has an optimal step count (par). Beat par for bonus points, like golf.
- **Visual ladder**: Vertical layout with START at bottom and TARGET at top (climbing up). Progress rope fills from bottom, color gradient shifting from start to target.
- **Hint system**: Reveals next word in optimal path, costs 30 points per hint.
- **Post-game**: Shows all optimal paths, player's path, par comparison.
- **Scoring**: Base 200 + par bonus (under par = 50 per step + 100; at par = 100; over par = reduced) - hint penalty (30 per hint). Minimum 10 pts.
- **Validation flow**: Frontend checks one-letter-diff (with rearrangement allowed — remove one letter from each word, remaining letters must be anagrams), then validates word via existing `POST /api/games/validate-word`.
- **API**: `GET /api/games/word-ladder/puzzles` returns array of `{start, target, par, optimalPaths}`.
- Component accepts `initialChallenge` boolean prop for Daily Challenge integration (auto-starts game).

### Letter Pool Game Design
Letter Pool has two variation modes, selected via a menu (or auto-selected in Daily Challenge):
- **With Pool**: Scrambled letter pool visible; player can click pool letters or type. Includes decoy letters.
- **Without Pool (Blind)**: No pool shown; player types letters purely from memory.
Both modes: all letters start blank, auto-submit on keypress. Letters can be entered in any order — correct letters snap into their correct position. Bonus points for spelling in left-to-right order (perfect order = +50% base, partial = proportional up to +25%). Hint reveals category at -20% points. 3 lives system. Sound effects for correct/wrong letters. Scoring: base = word length × 20, minus wrong guess penalties (10 each), minus hint penalty (20% of base), plus streak bonus (5 per streak), plus order bonus. Component accepts `initialChallenge` prop (`"with-pool"` | `"without-pool"`) for Daily Challenge integration.

### API Endpoints
The API provides endpoints for:
- Retrieving lists and details of all 17 games.
- Fetching specific word sets for various games (e.g., Anagram Solver, Word Scramble, Letter Pool).
- Validating words against a secure, server-side dictionary (`POST /api/games/validate-word`).
- Game-specific configurations and interactions (e.g., Letter Balance config, Word Chain start/computer word).
- Authentication (register, login, logout, Google OAuth, email verification, password reset).
- User stats, streaks, and achievements (sync for signed-in users).
- Leaderboard (public read, authenticated write).
- No dictionary endpoint is exposed to the frontend, ensuring security.

### Shared Code
A `shared/` directory contains TypeScript types and Zod schemas used by both frontend and backend, ensuring type consistency and validation across the full stack. Includes user, auth token, game stats, leaderboard, streak, and achievement schemas.

### Build System
Development uses `tsx` with Vite HMR. Production builds involve a custom script (`script/build.ts`) using esbuild for the server and Vite for the client. Type checking is performed via the TypeScript compiler, and database schema syncing is handled by Drizzle Kit.

## External Dependencies

### UI Framework
- Radix UI primitives (via Shadcn/ui)
- Lucide React for iconography
- Embla Carousel
- Framer Motion for animations

### Authentication & Security
- Passport.js (Google OAuth + Local strategies)
- bcryptjs for password hashing
- express-session for session management
- Resend for transactional emails

### Data & Validation
- Zod for runtime schema validation
- Drizzle ORM + Drizzle Zod for database operations
- TanStack React Query for data fetching and caching

### Database
- In-memory storage (MemStorage) — default, no setup needed
- MySQL storage (MySQLStorage) — activated by setting `MYSQL_DATABASE_URL`
- Drizzle ORM with mysql2 driver for MySQL operations
- Drizzle MySQL table definitions in `server/db-schema.ts`

### Development Tools
- Vite with React plugin
- esbuild for production server bundling
