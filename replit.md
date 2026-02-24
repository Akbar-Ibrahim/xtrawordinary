# WordPlay - Word Games Collection

## Overview

WordPlay is a web-based platform offering seventeen interactive vocabulary games (Word Ladder replaced the original Word Guessing game), designed for educational entertainment and vocabulary improvement. It's built as a full-stack TypeScript project with a React frontend and Express backend. The platform aims to provide a diverse collection of engaging word challenges, ranging from classic guessing games to unique constraint-based puzzles. Features include personal best tracking, a statistics dashboard, daily streak system, and an achievements/badges system - all stored locally in the browser via localStorage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend utilizes React 18 with TypeScript, Wouter for routing, TanStack React Query for state management, and Tailwind CSS with CSS variables for styling. Shadcn/ui provides UI components, and Framer Motion handles animations. The build process is managed by Vite. It follows a component-based architecture, separating pages, reusable UI, game-specific components, custom hooks, and utilities. The system supports light/dark mode theming, smooth transitions, and animated score displays, streak indicators, and sound effects.

### Backend Architecture
The backend is built with Express.js and TypeScript, exposing RESTful API endpoints under `/api/`. It integrates with Vite for hot module replacement in development and serves static files in production. The server structure includes main application setup, route definitions, a data access layer (`server/storage.ts` for in-memory data, ready for database integration), Vite development server integration, and static file serving.

### Remote Server Migration (axios)
Every route in `server/routes.ts` has a commented-out axios block marked with `--- REMOTE SERVER BLOCK ---`. To switch any route to use a remote API: (1) uncomment the `import axios` and `REMOTE_BASE_URL` lines at the top, (2) replace the dummy URL with the real remote server URL, (3) uncomment the axios block inside the route and comment out the local `dataSource` block. Each axios block matches the exact request/response data structure of its route, forwards remote status codes on error, and falls back to descriptive error messages. POST routes forward the request body with defaults applied. No further code changes needed.

### Data Layer
Drizzle ORM is configured for PostgreSQL, with schema defined in `shared/schema.ts` using Zod for validation. Migrations are managed via Drizzle Kit. Game data is primarily in-memory but designed for seamless migration to a PostgreSQL database.

### Player Engagement (localStorage)
All player tracking features use localStorage, requiring no user accounts:
- **Personal Bests**: `client/src/hooks/use-game-result.ts` hook integrated into all 17 games, saves scores and shows "New Best!" toasts
- **Game Stats**: `client/src/lib/game-stats.ts` library tracks per-game data (best score, play count, win rate, words found) and global data (total games, wins)
- **Streak System**: Date-based daily streak tracking, increments on consecutive days, resets if a day is missed
- **Achievements**: 19 achievement definitions covering milestones (games played, wins, high scores, word counts, streaks, perfect clears)
- **Stats Dashboard**: `/stats` page with overview metrics and per-game breakdowns
- **Achievements Page**: `/achievements` page with badge collection, unlock tracking, and toast notifications

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
- Fetching specific word sets for various games (e.g., Word Guessing, Anagram Solver, Word Scramble, Letter Pool).
- Validating words against a secure, server-side dictionary (`POST /api/games/validate-word`).
- Game-specific configurations and interactions (e.g., Letter Balance config, Word Chain start/computer word).
- No dictionary endpoint is exposed to the frontend, ensuring security.

### Shared Code
A `shared/` directory contains TypeScript types and Zod schemas used by both frontend and backend, ensuring type consistency and validation across the full stack.

### Build System
Development uses `tsx` with Vite HMR. Production builds involve a custom script (`script/build.ts`) using esbuild for the server and Vite for the client. Type checking is performed via the TypeScript compiler, and database schema syncing is handled by Drizzle Kit.

## External Dependencies

### UI Framework
- Radix UI primitives (via Shadcn/ui)
- Lucide React for iconography
- Embla Carousel
- Framer Motion for animations

### Data & Validation
- Zod for runtime schema validation
- Drizzle ORM + Drizzle Zod for database operations
- TanStack React Query for data fetching and caching

### Database
- PostgreSQL (via `DATABASE_URL`)
- `connect-pg-simple` (for session storage, if needed)

### Development Tools
- Vite with React plugin
- esbuild for production server bundling