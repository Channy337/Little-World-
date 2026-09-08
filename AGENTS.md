# Civoria working agreement

## Before every work session
1. Read [HANDOFF.md](HANDOFF.md), starting with **Current progress**.
2. Check the latest main branch, the recorded work branch, open PRs and local uncommitted changes. Do not reset or overwrite uncommitted work.
3. Follow the owner's current request. State the last checkpoint and the task you are taking over.
4. If another assistant is marked active, reconcile with the owner before overlapping writes. A status entry is coordination, not a technical lock; an old entry alone does not prove the other assistant is still running.

## Keep shared progress current
- HANDOFF.md is the single shared progress page. Do not maintain competing Claude/Codex status files.
- Update **Current progress** when starting substantive work, after meaningful milestones, and before stopping or approaching a usage limit.
- Record: assistant, UTC update time, task, status, branch, last implementation commit, PR/deployment links, completed work, checks/results, unfinished work, local-only files and exact next action.
- Append a short dated **Session history** entry at handoff; retain earlier entries.
- Save checkpoints on the active branch and make that branch discoverable in the main-branch progress page or linked PR. Clearly distinguish unmerged work from production.
- Use current file SHAs for GitHub edits; if they changed, re-read and reconcile. Never force-overwrite a teammate's checkpoint.
- If unable to publish a checkpoint, tell the owner it is only local and give its location. Do not claim GitHub is up to date.
- Unexpected shutdowns can lose unsaved context. Record progress during work rather than only at the very end.

## Project constraints
- Use preview branches for implementation and test before production changes.
- Preserve shared-world data; never reset or delete database keys to work around an error.
- Follow the owner's deployment authorization. An old release approval does not authorize unrelated future releases.
- Never place secret values in documentation, logs, commits or chat.
- Read README.md and VERIFICATION.md for architecture and test evidence; compare dated notes with current Git/deployment state.
