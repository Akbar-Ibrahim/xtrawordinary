# WordPlay - Word Games Collection

## Overview

WordPlay is a web-based word games platform featuring thirteen interactive vocabulary games:
- **Word Guessing** - Wordle-style 5-letter word guessing in 6 attempts
- **Anagram Solver** - Find all anagrams of a given base word
- **Word Scramble** - Unscramble words with category hints and lives system
- **Definition Match** - Guess the word from its definition
- **Word Builder** - Fill in missing middle letters with first/last revealed
- **Word Maker** - Create as many words as possible from a base word
- **Length Challenge** - 5-level progressive word length game with constraints (starts with, ends with, contains)
- **Position Master** - 2 challenge variations where words must have specific letter at specific position
- **Letter Hunt** - 6 challenge variations where words must contain specific required letters (2-6 letters, plus Advanced with random letter count per word)
- **Word Chain** - 2 variations (last letter vs last two letters) with 2 levels each; back-and-forth chaining between player and computer
- **Letter Balance** - 5 challenge variations with vowel/consonant constraints (e.g., "words with 3 consonants")
- **Letter Frequency** - 5 challenge variations where a specific letter must appear exactly N times (2, 3, 4, 5+, or Random)
- **Word Stack** - 2 challenge variations: "Build Up" (add letters from 2-letter base to target) and "Break Down" (remove letters from target to reach 2 letters)

The application is built as a full-stack TypeScript project with a React frontend and Express backend, designed for educational entertainment and vocabulary improvement.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state and data fetching
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **UI Components**: Shadcn/ui component library (Radix UI primitives)
- **Animations**: Framer Motion for smooth transitions and interactions
- **Build Tool**: Vite with HMR support

The frontend follows a component-based architecture with:
- Pages in `client/src/pages/` for route-level components
- Reusable UI components in `client/src/components/ui/`
- Game-specific components in `client/src/components/games/`
- Custom hooks in `client/src/hooks/`
- Utility functions and providers in `client/src/lib/`

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful endpoints under `/api/` prefix
- **Development Server**: Vite middleware for hot module replacement
- **Production**: Static file serving from built assets

The server structure includes:
- `server/index.ts` - Main Express application setup
- `server/routes.ts` - API route definitions
- `server/storage.ts` - Data access layer (currently in-memory, database-ready)
- `server/vite.ts` - Vite development server integration
- `server/static.ts` - Production static file serving

### Data Layer
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema Location**: `shared/schema.ts` using Zod for validation
- **Database Config**: `drizzle.config.ts` pointing to `DATABASE_URL`
- **Migrations**: Output to `./migrations` directory

Currently, game data is stored in-memory in `server/storage.ts`, but the architecture supports database migration via Drizzle ORM when `DATABASE_URL` is configured.

### API Endpoints
- `GET /api/games` - Returns list of all 13 games with metadata
- `GET /api/games/:slug` - Returns individual game details
- `GET /api/games/word-guessing/words` - Returns array of 5-letter words for Word Guessing game
- `GET /api/games/anagram-solver/words` - Returns word sets with original word and array of anagrams
- `GET /api/games/word-scramble/words` - Returns words with category for Word Scramble game
- `GET /api/games/definition-match/words` - Returns words with definition and part of speech
- `GET /api/games/word-builder/words` - Returns words with hint and category for fill-in game
- `GET /api/games/word-maker/words` - Returns base words with derivatives array and maxWords count
- `GET /api/games/word-stack/puzzles` - Returns Word Stack puzzles with targetWord, startWord, and hint
- `POST /api/games/validate-word` - Validates a word against the dictionary (body: { word: string }) - SECURE: Dictionary never exposed to frontend
- `GET /api/games/letter-balance/config` - Returns Letter Balance game configuration
- `POST /api/games/word-chain/start` - Returns starting word for Word Chain game
- `POST /api/games/word-chain/computer-word` - Returns computer's response word for Word Chain

### Shared Code
The `shared/` directory contains TypeScript types and Zod schemas used by both frontend and backend, ensuring type safety across the full stack. Path aliases (`@shared/*`) enable clean imports.

### Build System
- **Development**: `npm run dev` runs tsx for TypeScript execution with Vite HMR
- **Production Build**: Custom build script (`script/build.ts`) using esbuild for server bundling and Vite for client bundling
- **Type Checking**: `npm run check` runs TypeScript compiler
- **Database**: `npm run db:push` syncs schema with Drizzle Kit

## External Dependencies

### UI Framework
- Radix UI primitives (dialogs, menus, forms, etc.)
- Lucide React for iconography
- Embla Carousel for carousels
- Framer Motion for animations

### Data & Validation
- Zod for runtime schema validation
- Drizzle ORM + Drizzle Zod for database operations
- TanStack React Query for data fetching and caching

### Database
- PostgreSQL via `DATABASE_URL` environment variable
- `connect-pg-simple` for session storage (when sessions are needed)

### Development Tools
- Vite with React plugin
- Replit-specific plugins for development experience (error overlay, cartographer, dev banner)
- esbuild for production server bundling

## Recent Changes

### January 2026 - DEV_MODE and Game Enhancements
- **DEV_MODE Environment Variable**: Added `DEV_MODE` environment variable to toggle between LOCAL storage and external API
  - `DEV_MODE=LOCAL` uses in-memory data from `server/storage.ts`
  - Other values use external API from `server/externalApi.ts`
  - Routes in `server/routes.ts` use `dataSource` based on DEV_MODE setting
- **Anagram Solver Restructured**: Changed from single anagram per word to multiple anagrams
  - Schema updated: `AnagramWordSet` now has `anagrams: string[]` instead of single `anagram: string`
  - Players are shown a base word and must find all valid anagrams
  - Displays found count (e.g., "2 / 4 found") with found words shown as badges
- **Word Builder Visual Feedback**: Enhanced to show typed letters in blank boxes before validation
  - User input fills the displayed letter boxes on submit
  - Shows colored feedback (green for correct, red for wrong) on the filled boxes
- **Auto-Focus on Input Fields**: Added across all text-input games
  - Games auto-focus input field when game starts or moves to next word
  - Implemented using `useRef` with `setTimeout(() => inputRef.current?.focus(), 100)`
  - Applied to: Anagram Solver, Word Builder, Word Scramble, Definition Match, Word Maker

### January 2026 - Fresh Word Fetching Pattern
- **Refetch on Mount**: All games that pre-fetch words now use `refetchOnMount: "always"` to fetch fresh data when players return
- **Active Words State**: Games use `activeWords` (or `activeWordSets`) local state populated from refetch result in `initGame()`
- **Consistent Session**: All word selection within a game session uses the local `activeWords` state, ensuring players don't see stale cached words
- **Games Updated**: Word Guessing, Anagram Solver, Word Scramble, Word Builder, Word Maker, Definition Match

### January 2026 - Security: Dictionary Protection
- **Dictionary Endpoint Removed**: Removed `/api/games/word-dictionary` endpoint to prevent dictionary exposure
- **Secure Validation Pattern**: All constraint-based games now follow this pattern:
  1. Frontend generates constraints locally using simple randomization (no dictionary scan needed)
  2. Frontend checks constraint locally for immediate feedback (e.g., word length, starts with letter)
  3. Frontend calls `POST /api/games/validate-word` to verify word exists in dictionary
- **Games Updated**: Length Challenge, Position Master, Letter Hunt, Word Chain
- **Known Issue**: Word Chain timer occasionally shows "Time's Up!" immediately on certain transitions (likely HMR-related)

### January 2026 - Letter Hunt Challenge System
- **Replaced levels with challenges**: Letter Hunt now has 6 standalone challenge variations
  - Challenge 1: Find words containing 2 required letters
  - Challenge 2: Find words containing 3 required letters
  - Challenge 3: Find words containing 4 required letters
  - Challenge 4: Find words containing 5 required letters
  - Challenge 5: Find words containing 6 required letters
  - Challenge Advanced: Random letter count (2-6) changes after every valid word submission
- **Challenge Selection Menu**: Players can choose any challenge from a "Choose Your Challenge" screen
- **Completion Options**: After completing a challenge, players see "Next Challenge" and "Play Again" buttons (Advanced only shows "Play Again")

### January 2026 - Scalable Constraint Generation
- **Local Constraint Generation**: Removed backend config and constraint endpoints for scalability
  - Letter Hunt: Generates 2-6 random letters from alphabet on frontend based on challenge
  - Position Master: Generates random position (1-8) and random letter on frontend
  - Length Challenge: Generates random length (3-8) and optional constraints on frontend
  - Word Chain: Uses hardcoded config (wordsPerLevel: 100, timePerWord: 10)
- **Removed Backend Endpoints**: 
  - `/api/games/word-length/config` and `/api/games/word-length/constraint`
  - `/api/games/letter-position/config` and `/api/games/letter-position/constraint`
  - `/api/games/contains-letters/config` and `/api/games/contains-letters/constraint`
  - `/api/games/word-chain/config`
- **Retained Backend Endpoints**:
  - `POST /api/games/validate-word` - Secure word validation
  - `GET /api/games/letter-balance/config` - Letter Balance still uses backend config
  - `POST /api/games/word-chain/start` and `POST /api/games/word-chain/computer-word` - Require dictionary access