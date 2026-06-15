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
- **Untimed Mode (Premium)** — a third play mode alongside Classic and Survival. No timer at all; the player plays at their own pace. Scores from untimed sessions are not submitted to the global leaderboard (to keep competition fair), but stats and personal bests are still tracked. Available to premium members only.

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
- Heatmap calendar (like GitHub contributions) showing play frequency
- Improvement tracking: "Your Word Ladder average improved 15% this month"

### Streak System
- Streak shield (paid feature): protect against one missed day per month
- Streak recovery: grace period after midnight before streak resets
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

### Daily Challenge
- Daily challenge streak separate from the general play streak
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
- More notification types wired up: friend request received, achievement unlocked, someone liked your comment
- Mobile bottom navigation bar (tab bar) for an app-like feel
- Keyboard shortcuts: press D for Daily, L for Leaderboard, etc.
- Breadcrumb trail on game and group detail pages
- Extract the SSE notification stream into a dedicated `useNotificationStream` hook for cleaner reuse and easier testing (currently the EventSource logic is inline in the navigation component)

### UI / UX & Platform
- PWA service worker: offline caching so the daily challenge works without internet (manifest.json already exists)
- Keyboard accessibility audit
- Screen reader / ARIA audit (especially game grids and timers)
- Respect prefers-reduced-motion for animation-sensitive users
- Font size / zoom preference in user profile
- Lazy-load game components (code splitting) for faster initial load
- Error boundary components to prevent a single game crash taking down the whole page
- Comprehensive end-to-end test coverage (Playwright)
- Onboarding flow for new users: guided tour of homepage, daily challenge, and first game
- Cookie consent banner (required for GDPR if analytics/ads are added)

---

## 3. Deferred Tasks

These were proposed as follow-up tasks but not yet started. Reference numbers are from the original task system.

### Word Wars — Bracket & Match UX
- **#251** Highlight the next game to play so it's immediately obvious where to start (visual cue on My Matches section for the next unplayed game in an active series)
- **#252** Show game results and scores inside each completed game row (per-game W/L score breakdown inside collapsible match rows)

### Word Wars — Notifications & Alerts
- **#270** Send an email nudge to registered players when a tournament is at risk of not starting (email reminder when <24h to deadline and sign-up count is still below minPlayers)
- **#281** Let players opt out of "room is live" alerts separately from match-start alerts (separate notification preference for word_war_round_start)

### Word Wars — Spectators & Public Access
- **#282** Let anyone with a link watch a tournament bracket without signing in (currently SSE + bracket data requires auth; unauthenticated viewers get 15s poll only)
- **#283** Let spectators see live match results update without refreshing (spectators not connected via SSE miss real-time match_completed events)

### Duel Room — Audio
- Fully decouple duel audio from the global game mute: currently `duelMuted` is stored separately but duel sounds still route through `SoundProvider.playSound`, so turning off global game sound also silences duels. The fix is a duel-specific `soundEnabled` flag in the provider (or a bypass param) so the two contexts are truly independent.

### Friend Challenges
- **#310** Let players challenge anyone, not just existing friends (currently the challenge button is hidden with zero friends; should allow searching any registered user by username)

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

### Team Race Mode (Group vs. Group — Phase 2)
**Status:** Planned but not built (Phase 1 = Huddle, which is complete)

Every group member joins on their own device. Members play simultaneously; answers are pooled and de-duplicated for the team. Real-time team score feed shows both groups' aggregate tallies live. Works for simultaneous race games: Anagram Solver, No Repeats, Word Stack, Letter Pool, Word Maker, Word Split, Word Scramble.

**Design questions to resolve:** player cap, score normalisation for unequal group sizes, quorum (minimum members needed to start).

---

### Dramatic Challenge Notifications
**Status:** Optional — to decide at build time

When a Word Wars bracket is drawn and opponents are matched, each player receives a flavourful, war-themed notification (e.g. "Your opponent has been chosen. The war begins. Prepare yourself."). Similarly for Guild Wars: all members of the challenged group get a dramatic call-to-arms notification.

Could also apply to standard Duels — replacing the plain "X challenged you" with something like "X has drawn their sword. Will you accept the challenge?" at no extra engineering cost.

---

### Word Wars — Post-Launch Improvements
- Show a Word Wars promo card on the home page. If a tournament is in registration, show sign-up count and deadline.

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
