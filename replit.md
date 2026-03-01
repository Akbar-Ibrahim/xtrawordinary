# WordPlay - Word Games Collection

## Overview

WordPlay is a web-based platform offering seventeen interactive vocabulary games designed for educational entertainment and vocabulary improvement. It's a full-stack TypeScript project with a React frontend and Express backend. Key features include optional user accounts (Google OAuth + email/password), a global leaderboard, and hybrid statistics that work for both guests (localStorage) and signed-in users (synced to backend). The platform aims to provide an engaging experience for vocabulary enhancement with diverse game mechanics.

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

### Admin Dashboard
An admin dashboard provides analytics, user management (ban/unban, admin status toggle), and leaderboard entry management. Access is restricted to users with `isAdmin: true`.

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