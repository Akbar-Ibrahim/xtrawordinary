# WordPlay - Word Games Collection

## Overview

WordPlay is a web-based word games platform featuring multiple interactive vocabulary games including Word Guessing (Wordle-style), Anagram Solver, and Word Scramble. The application is built as a full-stack TypeScript project with a React frontend and Express backend, designed for educational entertainment and vocabulary improvement.

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
- `GET /api/games` - Returns list of all games with metadata
- `GET /api/games/:slug` - Returns individual game details
- `GET /api/games/word-guessing/words` - Returns array of 5-letter words for Word Guessing game
- `GET /api/games/anagram-solver/words` - Returns word sets with original, anagram, and hint
- `GET /api/games/word-scramble/words` - Returns words with category for Word Scramble game

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