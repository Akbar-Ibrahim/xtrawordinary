---
name: Verifying task/feature status
description: How to correctly check whether a task, refactor, or feature is actually done before suggesting it as "what's next" work.
---

Do not infer that a task is still open from:
- The presence of a plan file under `.local/tasks/*.md` (these persist as an archive after a task is merged; file existence says nothing about current state).
- A task's stored title/description text (these can go stale relative to the real codebase).
- `IDEAS.md` — this file is **frequently stale**. Items listed there as "not yet built" may already be implemented. Always verify against the actual codebase before suggesting an IDEAS.md item as future work.
- Backlog descriptions in general — they are not re-validated against the code once written.

**Why:** Repeatedly suggested already-completed work (refactors, feature additions) as "what's next" by trusting stale plan files and backlog text instead of ground truth. This wasted the user's time and eroded trust across multiple turns in the same session.

**How to apply:**
- To check a project task's real status, call `listProjectTasks()` / `getProjectTask(taskRef)` and read the `state` field (MERGED/CANCELLED = done, PROPOSED/PENDING/IN_PROGRESS = actually open).
- To check whether a code-level refactor or feature already exists, verify directly against the current codebase (`ls`, `grep`, `read`) rather than trusting any task description.
- When proposing "what's next" ideas, always cross-check both the live task state AND the actual code before presenting something as an open opportunity.
