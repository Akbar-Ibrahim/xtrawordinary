# xtraWordinary — Ideas & Notes

Single reference for all ideas, suggestions, deferred tasks, and future plans.
Last consolidated: June 2026

---

## Table of Contents
1. [Brand & Identity](#1-brand--identity)
2. [Feature Suggestions by Area](#2-feature-suggestions-by-area)
3. [Deferred Tasks](#3-deferred-tasks)
4. [Bigger Concepts Not Yet Built](#4-bigger-concepts-not-yet-built)
5. [Future Platforms](#5-future-platforms)

---

## 1. Brand & Identity

### xtraWordinaire — Prestige Status
"xtraWordinaire" (a play on "extraordinaire") could serve as the platform's top prestige status. Two directions:

1. **Top tier in a progression system** — e.g. Bronze > Silver > Gold > xtraWordinaire. Gives all users a long-term goal and keeps them engaged.
2. **Standalone prestige badge** — awarded when a user hits an exceptional combination of milestones (games mastered, streak length, leaderboard placements, etc.). Rarer and more prestigious.

Either way, the status makes for a natural CTA: instead of a generic "sign up / go premium" nudge, the platform invites users to "Work your way to becoming an xtraWordinaire" — aspirational rather than transactional.

**Decision pending:** progression tier vs. standalone badge.

---

## 2. Feature Suggestions by Area

### Games (General)
- In-game tutorial / walkthrough for first play (especially Shell Words, Word Bloom, Word Stretch — complex mechanics)
- Replay mode: after finishing, show all valid answers the player missed
- Word Sweep: heat map of found vs. missed words on the grid
- Ladder Rush: ghost timer showing the player's previous best pace
- Shell Words / Deep Shell Words: hint that reveals the boundary letters
- Word Bloom: show the full possible chain tree after the round ends
- Cross-game combo bonuses (e.g. play 5 different games in one day)

### Authentication
- Apple Sign-In (important for iOS if a mobile app is added)
- Magic link / passwordless login option
- Two-factor authentication
- Account deletion with full data wipe (GDPR)
- Username / display name separate from email (currently uses full name)
- Avatar upload (currently only Google OAuth photo is used)

### User Profiles
- Privacy settings: make profile private or hide specific stats
- Activity feed: "played Word Ladder, earned X achievement" timeline
- Follow system (lighter than friends — no mutual requirement)
- Profile themes / frames for paid users (Pro badge, custom colours)
- Share profile card as an image (for social media)

### Stats System
- Score trend chart over time (line graph per game)
- "Your best day" highlight (highest total score in a single day)
- Percentile ranking: "You scored better than 78% of players today"
- Stats comparison: compare your stats with a friend side-by-side
- Export stats as CSV or PDF
- Weekly / monthly recap email
- Improvement tracking: "Your Word Ladder average improved 15% this month"

### Streak System
- Streak shield (paid feature): protect against one missed day per month
- "Streak at risk" push notification

### Achievements
- Tiered achievements: Bronze / Silver / Gold versions of the same goal
- Secret achievements: hidden until unlocked
- Achievement points total: a score representing overall platform mastery
- Shareable achievement cards
- Game-specific achievement sets (e.g. Shell Words-specific badges)
- Seasonal achievements (e.g. "Played on New Year's Day 2026")
- More achievement definitions (currently 19 — could grow to 50+)

### Global Leaderboard
- Leaderboard notifications: "You've been overtaken by Alice in Word Ladder"
- Score verification: flag suspicious outlier scores for admin review
- Regional leaderboards (by country)
- Per-difficulty leaderboard where games have difficulty variants
- Pro badge next to paid subscribers' names
- Animated entry when a new personal best bumps the player up the board

### Friends System
- Mutual friends display: "3 mutual friends" on search results
- Friend suggestions: recommend users with similar game tastes
- Online indicator (last active within X minutes — privacy-toggle)
- Block / report user (separate from unfriend)
- Friend request message: optional note when sending a request
- "Friends who play this game" shown on game detail pages
- Notification when a friend earns a new achievement

### Friend Challenges
- Challenge expiry: auto-cancel pending challenges after N days (e.g. 7)
- Challenge history page (beyond the current flat list on Friends tab)
- "Best of 3" or multi-round challenge mode
- Challenge leaderboard: who has the best win record against whom
- Challenge comment: allow a reply message when accepting / completing
- Push notification when a friend completes your challenge
- Challenge streak: consecutive wins vs the same opponent

### Groups & Community
- Round announcement: admin posts a message when starting a round
- Pinned announcement on group page for important news
- Group tags: categorise groups (school, family, competitive, casual)
- Per-member stats within a group: rounds played, average score, rank
- Group rounds history: archive of past rounds with full results
- Maximum member limit per group (free vs. paid tier gating)
- Group profile picture / avatar
- Weekly group digest email: recap of the week's rounds and top scores

### Post-Game Vocabulary Spotlight
After a game ends, show a small "word spotlight" card with definitions (and optionally etymology or fun facts) for 2–3 interesting words the player encountered during that game. The goal is a moment of delight — "I didn't know QUAFF was a real word." Dictionary data could come from a free public API (e.g. Free Dictionary API) or a small curated dataset stored on the server.

**Scope:** Small. Mostly frontend — a new game-over card component, a server utility to pull definitions, and wiring it into whichever game-end events fire. Low risk, high delight.

---

### Daily Challenge
- Daily challenge streak separate from the general play streak *(implemented June 2026)*
- Optional difficulty toggle for the daily (same game, different seed tier)
- Historical archive: play any previous day's challenge
- Teacher-assigned daily: override the daily game for a classroom group

### Comment System
- Rich text: basic markdown or emoji picker
- Comment search within a game's discussion
- Pinned comment by game creator or admin
- Mention (@username) with notification to the mentioned user
- Pagination or infinite scroll for games with many comments
- Spam filtering: rate-limit comments per user per hour

### Likes System
- Notification when your comment gets a like
- Reaction variety: expand beyond ❤️ to 👍 🔥 😂 😮
- Like history page
- Like milestones: "Your comment reached 10 likes!" achievement

### Admin Dashboard
- Announcement system: sitewide banner (maintenance, new game launch)
- Revenue dashboard tab (once payments are integrated)
- User detail view: click a user to see full stats, achievements, history
- Bulk actions: ban multiple users, bulk-delete leaderboard spam
- Audit log: record admin actions
- Unified moderation queue: reported comments, flagged scores, user reports
- Email tool: send a one-off email to a specific user or all users
- Export: download user list or leaderboard as CSV

### Navigation & Notifications
- Mobile bottom navigation bar (tab bar) for an app-like feel
- Keyboard shortcuts: press D for Daily, L for Leaderboard, etc.

### UI / UX & Platform
- PWA service worker: offline caching so the daily challenge works without internet (manifest.json already exists)
- Keyboard accessibility audit
- Screen reader / ARIA audit (especially game grids and timers)
- Font size / zoom preference in user profile
- Lazy-load game components (code splitting) for faster initial load
- Comprehensive end-to-end test coverage (Playwright)
- Onboarding flow for new users: guided tour of homepage, daily challenge, and first game
- Cookie consent banner (required for GDPR if analytics/ads are added)

---

## 3. Deferred Tasks

These were proposed as follow-up tasks but not yet started. Reference numbers are from the original task system.

### Word Wars — Notifications & Alerts
- **#270** Send an email nudge to registered players when a tournament is at risk of not starting (email reminder when <24h to deadline and sign-up count is still below minPlayers)
- **#281** Let players opt out of "room is live" alerts separately from match-start alerts (separate notification preference for word_war_round_start)

### Word Wars — Spectators & Public Access
- **#282** Let anyone with a link watch a tournament bracket without signing in (currently SSE + bracket data requires auth; unauthenticated viewers get 15s poll only)
- **#283** Let spectators see live match results update without refreshing (spectators not connected via SSE miss real-time match_completed events)

### Guild Wars — Group Stats (polish)
- Extend the Guild Wars stats card on the group leaderboard tab to show the last 3 **completed** tournament outcomes (win or loss), not just championship titles. Currently only championship wins appear under "Recent titles"; a group that entered 3 tournaments and lost them all shows nothing there.

### Duel Milestones — War/Medieval Achievement Titles
A set of escalating war/medieval-themed achievement titles earned through duel performance. Each title would display on the player's profile and optionally beside their name in the duel lobby.

| Title | Trigger idea |
|---|---|
| **First Blood** | Win your very first duel |
| **Skirmisher** | Win 10 duels total |
| **Man-at-Arms** | Reach a mid-tier ELO / 50 wins |
| **Knight** | Sustain a win streak or hit a higher ELO bracket |
| **Siege Master** | Win a duel without losing a single life (perfect round) |
| **Last Stand** | Win a duel from 1 life remaining |
| **Warlord** | Reach the elite ELO tier / 200+ wins |
| **Conqueror** | Win 5 duels in a row |
| **Iron Guard** | Go undefeated across a full week of duels |
| **Champion of the Realm** | Finish top of the duel leaderboard for a season |

---

## 4. Bigger Concepts Not Yet Built

### Word Explorer (Pressure-Free Discovery Mode)
**Status:** Thinking stage — shelved for now, needs dedicated build effort

**Core idea:** A pressure-free mode where players explore the dictionary through the lens of each game's mechanic — no timer, no score, just curiosity. Players query words by constraint and browse the results. This is distinct from playing a game; it's more like using a smart dictionary filtered by game logic.

**Name options under consideration:**
- **Explore** — adventurous, open-ended; works as both a nav label and a tab ("Explore Words")
- **WordLab** — tinkering/experimental feel; implies "try something and see"
- **Discover** — curious and light; pairs well with the xtraWordinary brand voice
- **Lexicon** — vocabulary-forward, slightly prestigious
- **Deep Dive** — action-oriented; implies going beyond the game surface
- **Sandbox** — no-pressure feel, but risks confusion with the existing "Custom Play" feature
- **Browse** — dead simple, zero ambiguity
- **WordScope** — searching/scoping through the dictionary
- **Vocab Vault** — browsing the vocabulary collection
- **WordMine** — mining for words

**Applicable games and their explorer mechanics:**

| Game | What "Explore" means |
|---|---|
| **Letter Hunt** | Show all words containing specific letters — ordered (E then B then R) or unordered (any arrangement) |
| **Letter Dodge** | Show all words that avoid a chosen set of letters |
| **Position Master** | Show all words where a specific letter appears at a specific position (e.g. R in position 3 of a 6-letter word) |
| **Length Challenge** | Browse all valid words of a chosen length (e.g. all 9-letter words) |
| **Letter Frequency** | Show words where a letter appears N or more times (e.g. E appears 3+ times) |
| **Word Maker** | Show all words buildable from a custom set of tiles — reuses existing endpoint |
| **Shell Words** | Browse all shell words, or find every shell that wraps a given inner word (e.g. what shells ORAL?) |
| **Deep Shell Words** | Same as above but for deeper nesting levels |
| **Word Roots** | Browse all words derived from a chosen root (e.g. all words from -RUPT-) |
| **Word Split** | Show valid compound splits for words matching a prefix or suffix pattern |
| **Ladder Rush / Double Swap** | Show all valid one-letter-change (or two-letter-swap) neighbors of a given word |

**Entry points:**
- A dedicated `/explore` hub page in the nav listing all supported games
- A "Explore" tab on each eligible game's detail page (alongside Play, Stats, Comments)

**Technical notes:**
- Most game engines already have server-side word validation — the explorer reuses that logic in query/browse mode rather than timed-play mode
- Word Maker already has a working endpoint (`/api/games/word-maker/words`) that can be adapted
- Shell Words and Deep Shell Words have validate endpoints that can be reversed into browse endpoints
- New filter endpoints needed for: Letter Hunt, Letter Dodge, Position Master, Length Challenge, Letter Frequency, Word Split, Ladder Rush neighbors
- Pagination is important — results can easily be hundreds of words
- Results should be capped (e.g. show first 50 with a "load more") to keep performance acceptable

**Recommended build order (when ready):**
1. Word Maker (easiest — server logic already exists)
2. Shell Words / Deep Shell Words (validation logic exists, needs browse direction)
3. Word Roots (puzzle data exists, needs search/browse endpoint)
4. Letter Hunt / Letter Dodge / Position Master / Letter Frequency (new filter endpoints)
5. Length Challenge, Word Split, Ladder Rush (additive once the pattern is established)

---

### League Seasons (within Groups)
**Status:** Thinking stage, not yet planned or built

**Core idea:** A time-boxed competitive season — a defined window where points accumulate, then a champion is crowned. Meaningfully different from Groups (which are permanent social clubs). A league feels like something you *compete in and win*; a group feels like somewhere you *belong*.

**Recommended path:** Add a "League Season" mode within Groups rather than a separate feature:
- Group admin sets a timeframe (start + end date)
- Admin picks 2–5 eligible games
- Any round played in those games during the period feeds the season leaderboard
- When time's up, the season closes, winner is celebrated, a new season can start
- Reuses all existing round/leaderboard infrastructure — just adds a season container

**Other angles:**
- Cross-group leagues — open entry (public ladder), any group can join
- Point system options: raw score sum, bonus for consistency, bonus for top-3 finishes, bonus for improvement
- Relegation / promotion tiers after a season (keeps experienced players from crushing newcomers)
- Complement to Guild Wars: a group league could be the regular season that precedes the Guild Wars playoff

**Open questions before building:**
- Solo league, group league, or both?
- Is a league within a group, or a standalone public competition?
- What is the point system — raw scores, win/loss, or something else?
- Does participating require playing every round, or is it cumulative opt-in?
- How is a season winner celebrated? (badge, notification, hall of fame?)
- Does this overlap too much with Guild Wars, or are they clearly complementary?

---

## 5. Future Platforms

### Mobile App
**Status:** On hold until the web app is stable

**Decision:** Build mobile *after* the web app is complete. Parallel development means updating game logic, types, and design in two codebases simultaneously — doubles maintenance and risks divergence.

**What carries over:**
- All TypeScript types and Zod schemas in `shared/` — reusable as-is
- API fetch hooks (TanStack Query logic) — reusable with minimal changes
- Game logic and validation — reusable as-is
- Backend (Express + MySQL) — no changes needed; mobile consumes the same API

**What needs to be rebuilt:**
- All UI components (React Native uses different primitives; Tailwind and Shadcn don't carry over)
- Routing — replace Wouter with Expo Router (file-based)
- Animations — replace Framer Motion with React Native Reanimated
- Auth UI — rebuild login/OAuth screens using Expo Auth Session

**Technical migration path:**
1. Convert to a pnpm workspace (monorepo)
2. Add the Expo app as a new artifact under `apps/mobile/` alongside `apps/web/`
3. Move shared code into `packages/shared/`

**Games needing special attention on mobile:**
- Games with long free-text input (touch keyboard takes up ~40% of screen)
- Timed games (need to account for background/foreground app lifecycle)
- Duel / WebSocket features (need reconnection handling for mobile network switches)
