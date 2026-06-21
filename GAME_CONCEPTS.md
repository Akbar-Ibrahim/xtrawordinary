# Game Concepts & Design Documents

This file captures new game ideas and feature enhancements discussed in design sessions.
It is separate from IDEAS.md (which tracks feature requests and platform improvements).

---

## 1. Grid Letter Swap (Working Title)

### Concept Summary

A 5×5 grid puzzle where all 25 letters from five target words are pooled and shuffled
across the grid. The player swaps letters to arrange each row so it spells its
corresponding target word, completing rows from top to bottom.

---

### Origin of the Idea

The game was designed through discussion with the following goals:
- Add a 2D spatial reasoning puzzle to the platform (no current game uses a grid-swap mechanic)
- Create something genuinely replayable with a content-light backend
- Deliver a "one sentence explainable" mechanic: swap letters until each row spells the word shown

---

### Core Mechanic

1. Five 5-letter target words are selected (e.g., CRANE, BLOOM, SWIFT, GRAIN, PLUCK).
2. All 25 letters are pooled and shuffled randomly across a 5×5 grid.
   - If two words share a letter (e.g., CRANE and GRAIN both need R, A, N), the pool
     naturally contains the right total count of each letter. No letter is pre-tagged
     to any word — from the player's perspective these are just 25 random letters.
3. The five target words are displayed on screen, one label per row (Row 1 → Word 1,
   Row 2 → Word 2, etc.).
4. The player taps/clicks any two cells in the grid to swap their letters (free swap —
   not adjacent-only).
5. Rows must be completed top to bottom:
   - Row 1 must be solved before Row 2 becomes active.
   - Once a row is locked (solved), its letters cannot be swapped with any other row.
6. Row completion is auto-detected — as soon as the letters in the active row spell the
   target word exactly, the row locks, highlights green, and the next row activates.
   There is no manual "Done" button.
7. The puzzle is complete when all five rows are locked.

---

### Why These Design Decisions Were Made

**Cross-row shuffle (not in-row only)**
An in-row-only mechanic reduces to five simultaneous anagrams — essentially the same
as the existing Anagram Solver game played five times in parallel. The cross-row shuffle
is what makes this distinct: getting the right letters into one row may require pulling
a letter out of a position that was convenient for another row, creating genuine
interdependency and strategic planning.

**Free swap (not adjacent-only)**
With 25 cells, adjacent-only swapping would make the puzzle about navigating a maze
rather than solving a word puzzle. Free swap keeps the cognitive focus on letter
placement logic.

**Auto-detect row completion (not a "Done" button)**
A manual confirmation button adds friction and asks the player to confirm something
both they and the game already know. The snap of auto-lock provides a satisfying
moment of reward.

**Top-to-bottom row order enforcement**
- Reduces cognitive load: the player focuses on one active row at a time rather than
  juggling all five simultaneously.
- Creates strategic tension: placing letters for Row 1 may not be ideal for Row 2,
  so the player must think ahead.
- Locked rows are fully frozen — letters cannot be taken from a completed row to help
  a later row. This makes the constraint meaningful, not cosmetic.

**Why letters are not labeled by origin word**
The player never needs to know which letter "came from" which word. They only need to
know whether the current row spells the target. The pool inherently contains exactly
the right letters; the puzzle is always solvable.

---

### Open Design Questions (to be decided before building)

1. **Word length**: All 5-letter words (clean 5×5) is the simplest and most
   visually balanced approach. Mixed lengths (e.g., 4+6) create unequal row widths
   and complicate the grid layout. **Recommendation: start with all 5-letter words.**

2. **Time pressure or move counter?**
   - Pure puzzle (no timer, no move counter): accessible, low-stress, good for a
     first version.
   - Timer mode: adds urgency and replayability for leaderboard competition.
   - Move counter: rewards efficiency, penalises trial-and-error.
   - Could offer both as modes (Classic = timer, Zen = no timer).

3. **Word selection**: Curated word sets vs. random valid 5-letter words from the
   dictionary. Curated sets allow theme puzzles (e.g., animals, foods) which could
   make the experience feel more intentional.

4. **Replacing vs. adding**: The idea of replacing Word Sweep's guided variant was
   considered but rejected — they share no mechanical DNA and removing a game variant
   harms its existing players. This should be a new game.

5. **Hint system**: Optional. Could reveal one correct letter position per hint, at
   a score penalty.

---

### Suggested Game Name Candidates

- **Word Grid**
- **Letter Swap**
- **Grid Lock** (plays on the locking mechanic)
- **Tile Sort**

---

### Implementation Notes (for when this is built)

- Backend: generate a puzzle by picking five 5-letter words, pooling all 25 letters,
  and shuffling. Store the solution (which word → which row) and the shuffled grid.
  Seeding the shuffle allows daily puzzles and group rounds.
- Frontend: 5×5 grid of letter tiles, click-to-select-first / click-to-select-second
  swap interaction (highlight selected cell, swap on second tap).
- Row lock animation: flash green, disable cells, reveal completion tick.
- Consider showing a subtle "progress" indicator (e.g., how many letters in the current
  row are in the correct column) to help players who are stuck — but this risks making
  it too easy. Keep it optional or behind a hint.

---

## 2. Anagram Solver — Tile Swap Enhancement

### Concept Summary

Modify the existing Anagram Solver game so players physically swap letter tiles into
position rather than typing the answer, creating a more tactile and engaging experience.

### Current Mechanic

The player is shown a scrambled word and types the correct unscrambled word into an
input field.

### Proposed Enhancement

- Display the scrambled letters as interactive tiles in a row.
- The player taps two tiles to swap them.
- When the tiles are in the correct order (spelling the target word), the puzzle
  auto-completes (same auto-detect pattern as the Grid Letter Swap game above).
- Typing input is removed entirely, or kept as an alternative input method for
  accessibility.

### Why This Is Worth Doing

- Increases engagement: physical rearrangement is more satisfying than typing, and
  gives players who know the answer a more interesting way to express it.
- Differentiates the game from the other word-input games on the platform.
- The tile interaction pattern, once built for Anagram Solver, can be reused for
  the Grid Letter Swap game above (shared component).

### Considerations

- Must preserve keyboard accessibility (typing answer still accepted, or at minimum
  a screen-reader-friendly alternative).
- On mobile, drag-to-swap is more natural than tap-tap-swap; consider supporting both.
- Scoring may need adjustment if swap count becomes a meaningful metric.
