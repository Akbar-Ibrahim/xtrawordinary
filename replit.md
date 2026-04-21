# xtraWordinary - Word Games Collection

## Overview

xtraWordinary is a web-based platform offering 23 interactive vocabulary games designed for educational entertainment and vocabulary improvement. It's a full-stack TypeScript project with a React frontend and Express backend. Key features include optional user accounts (Google OAuth + email/password), a global leaderboard, and hybrid statistics that work for both guests (localStorage) and signed-in users (synced to backend). The platform aims to provide an engaging experience for vocabulary enhancement with diverse game mechanics.

**Word Sweep** has two modes: Classic (free-form 6×6 grid, gravity, shuffle) and Guided (timed 6×6 puzzle with known word list, speed scoring: `max(50, 1000 - elapsed_seconds*5 - wrong_attempts*50)`). Leaderboard tabs for each mode (Classic → `word-sweep`, Guided → `word-unpack`). Daily challenge and group rounds use `seed % 2 === 0 → classic, odd → guided`.

**Shell Words** (id: 21, slug: `shell-words`): A game where removing the first and last letter of a word reveals a hidden inner word (e.g., BRAND → RAN). Three variations × two sub-modes = 6 slugs total:
- Blitz Classic (`shell-words`, 90s): find any shell words; score = 10 + outerLen×2
- Blitz Survival (`shell-words-blitz-survival`): 8s per word, correct → reset clock
- Wrapper Classic (`shell-words-guided`, 2min): given inner word, find all wrappers; score = found×15 + timeLeft×2
- Wrapper Survival (`shell-words-wrapper-survival`): 8s per wrapper, correct → new inner word
- Crack Classic (`shell-words-crack`, 10 rounds): given boundary letters, type the middle; score = 20 + innerLen×8
- Crack Survival (`shell-words-crack-survival`): 8s per boundary pair, correct → new pair
Shell word data: `shellWordSet` (O(1) lookup), `shellWordPuzzles` (≥3 wrappers), `crackPuzzles` (boundary letter pairs with ≥2 valid shells). APIs: `GET /api/games/shell-words/validate?word=`, `GET /api/games/shell-words/puzzle?seed=`, `GET /api/games/shell-words/crack?seed=`. Mode selector hidden when `initialMode` prop set (daily/group context).

**Deep Shell Words** (id: 22, slug: `deep-shell-words`): Same structure as Shell Words but removes the first TWO and last TWO letters (e.g., STRANGER → RANG, SPLINTER → LINT). Minimum outer word length 7 letters. Three variations × two sub-modes = 6 slugs total:
- Blitz Classic (`deep-shell-words`, 90s): find any deep shell words; score = 10 + outerLen×2
- Blitz Survival (`deep-shell-words-blitz-survival`): 8s per word, correct → reset clock
- Wrapper Classic (`deep-shell-words-guided`, 2min): given inner word, find all wrappers; score = found×15 + timeLeft×2
- Wrapper Survival (`deep-shell-words-wrapper-survival`): 8s per wrapper, correct → new inner word
- Crack Classic (`deep-shell-words-crack`, 10 rounds): given 2-letter boundary pairs, type the middle; score = 20 + innerLen×8
- Crack Survival (`deep-shell-words-crack-survival`): 8s per boundary pair, correct → new pair
Deep shell data: `deepShellWordSet`, `deepShellWordPuzzles` (≥3 wrappers), `deepCrackPuzzles` (2-char boundary pairs with ≥2 valid shells). APIs: `GET /api/games/deep-shell-words/validate?word=`, `GET /api/games/deep-shell-words/puzzle?seed=`, `GET /api/games/deep-shell-words/crack?seed=`. Daily challenge and group round integration deferred (out of scope).

**Word Bloom** (id: 24, slug: `word-bloom`): Given a seed word (2–4 letters), insert exactly one letter anywhere (without rearranging) to grow it step by step into the longest chain possible. Example: AM → AIM → AIMS → MAIMS. Two modes:
- Classic (`word-bloom`, 2min): grow the chain as deep as possible; scoring: 10 pts base + 5 pts × (current word length − seed length)
- Survival (`word-bloom-survival`): 8s per step, any correct insertion resets clock, chain keeps growing
Precomputed data: `wordBloomPuzzles` (IIFE builds insertion adjacency graph, memoized DFS, seeds with maxDepth ≥ 3). APIs: `GET /api/games/word-bloom/puzzle?seed=N` → { seed, maxDepth }, `GET /api/games/word-bloom/validate?current=X&next=Y` → { valid, isMiddle }. Daily challenge and group round integration deferred (pending task #75).

**Word Stretch** (id: 23, slug: `word-stretch`): Given a seed word (3–6 letters), insert exactly one letter anywhere (without rearranging) to form a valid longer word. Example: SIDE → ASIDE, SNIDE, SLIDE, SIDED, SIDES. Two modes:
- Classic (`word-stretch`, 2min): find all valid insertions; each = 10 pts, middle insertion (not at pos 0 or last) = 15 pts, complete all = +25 bonus
- Survival (`word-stretch-survival`): 8s per seed word, any correct insertion resets clock, score keeps accumulating
Precomputed data: `wordStretchPuzzles` (seed words with ≥4 solutions including ≥1 middle insertion); `wordDictSet` exported from game-data.ts for O(1) dict lookups. APIs: `GET /api/games/word-stretch/puzzle?seed=N` → { word, totalSolutions }, `GET /api/games/word-stretch/validate?stretched=ASIDE&seedWord=SIDE` → { valid, isMiddle }. Dictionary never exposed to frontend.

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

### Likes System
A polymorphic likes system lets signed-in users like games and individual comments. Guests are prompted to sign in. Like counts are stored in the `likes` table (userId, targetType, targetId, unique index). The `LikeButton` component handles optimistic updates and renders in two sizes: default (outlined button on game detail page) and small (inline heart on comments). API: `POST /api/likes` (toggle, returns `{liked, count}`), `GET /api/likes?targetType=&targetIds=` (returns `{counts, likedByMe}` maps). Comments returned by `getComments` include `likeCount` and `likedByMe` fields for the requesting user.

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