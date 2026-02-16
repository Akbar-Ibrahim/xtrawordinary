# WordPlay - Word Games Collection

## Overview

WordPlay is a web-based platform offering seventeen interactive vocabulary games, designed for educational entertainment and vocabulary improvement. It's built as a full-stack TypeScript project with a React frontend and Express backend. The platform aims to provide a diverse collection of engaging word challenges, ranging from classic guessing games to unique constraint-based puzzles. Features include personal best tracking, a statistics dashboard, daily streak system, and an achievements/badges system - all stored locally in the browser via localStorage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend utilizes React 18 with TypeScript, Wouter for routing, TanStack React Query for state management, and Tailwind CSS with CSS variables for styling. Shadcn/ui provides UI components, and Framer Motion handles animations. The build process is managed by Vite. It follows a component-based architecture, separating pages, reusable UI, game-specific components, custom hooks, and utilities. The system supports light/dark mode theming, smooth transitions, and animated score displays, streak indicators, and sound effects.

### Backend Architecture
The backend is built with Express.js and TypeScript, exposing RESTful API endpoints under `/api/`. It integrates with Vite for hot module replacement in development and serves static files in production. The server structure includes main application setup, route definitions, a data access layer (`server/storage.ts` for in-memory data, ready for database integration), Vite development server integration, and static file serving.

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