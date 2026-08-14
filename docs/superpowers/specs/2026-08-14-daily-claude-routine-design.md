# Daily Claude Routine — Design

Date: 2026-08-14

## Purpose

An automated morning briefing that runs on its own every day at 8:00 AM, without
the user opening Claude Code. It summarizes the day's priorities, lists meetings,
surfaces to-dos, cleans up duplicate email, and delivers the result as a push
notification.

## Architecture

A scheduled cloud routine (created with the `schedule` skill, backed by a cron
trigger) fires daily at 8:00 AM local time. It runs a Claude agent that:

1. Loads instructions from `CLAUDE.md` in this project.
2. Uses the Gmail MCP tools to read meetings and email-derived to-dos, and to
   trash duplicate emails.
3. Reads `tasks.md` for user-maintained to-dos.
4. Composes a briefing and sends it via a push notification.

The routine's *behavior* lives in `CLAUDE.md` (editable without touching the
scheduler); the *trigger* lives in the scheduled routine config (created once).

## Components

### `CLAUDE.md`
Instructions the scheduled agent follows each run: what to check, how to
prioritize, dedup rules, and the output format. This is the primary thing the
user edits going forward to change routine behavior.

### `tasks.md`
A user-maintained file of to-dos, one per line, optionally tagged:
- `[P1]`, `[P2]`, `[P3]` for explicit priority
- A due date in parentheses, e.g. `(due 2026-08-15)`

Example:
```
[P1] Finish Q3 budget review (due 2026-08-15)
[P2] Reply to vendor contract email
Read up on new onboarding docs
```

If the file doesn't exist on a given run, the briefing notes it and skips that
source rather than failing.

### Scheduled routine
Created once via the `schedule` skill: cron trigger at 8:00 AM local time,
running the routine described in `CLAUDE.md`.

## Data Flow (per run)

1. **Meetings**: Search Gmail for calendar-invite/event emails relevant to
   today; build a time-sorted meeting list.
2. **Email-derived to-dos**: Search Gmail for action-item-shaped emails
   (explicit requests, deadlines mentioned in the body/subject).
3. **Merge to-dos**: Combine `tasks.md` entries with email-derived candidates
   into one list.
4. **Prioritize**: `[P1]` tags first, then due-today/overdue items, then
   everything else; email-derived items are ranked by inferred urgency and
   placed among the untagged items.
5. **Dedup cleanup**: Find emails that are near-exact repeats — same sender
   AND same or near-identical subject, received more than once. Move each
   duplicate (keeping the most recent) to Gmail Trash — never a permanent
   delete, since Trash is recoverable for 30 days. Record what was trashed
   and the count.
6. **Compose briefing**, in this order:
   - Top priorities (P1s / due-today items)
   - Meetings (time-sorted)
   - Full to-do list (prioritized)
   - Email cleanup report (count + list of trashed items)
7. **Deliver** the briefing as a push notification.

## Error Handling

- Gmail search failures or empty results are stated explicitly in the
  briefing ("couldn't reach Gmail" / "no meetings found today"), never
  silently omitted.
- Dedup is conservative: only trashes when sender AND subject match
  (near-identical), never single or ambiguous emails. Always trash, never
  permanent delete, so mistakes are recoverable.
- Missing `tasks.md` is reported, not treated as an error that stops the run.

## Out of Scope (for this iteration)

- Calendar integration beyond Gmail invite emails.
- Broader inbox cleanup (promotions, digests) — only exact/near-duplicate
  detection for now.
- Any UI beyond the push notification.

## Verification

Not unit-testable in the traditional sense. Verify by:
1. Running the routine once manually right after setup (not waiting for
   8 AM).
2. Confirming the notification arrives with sensible, correctly prioritized
   content.
3. Confirming only genuine duplicates were trashed (spot-check Gmail Trash).
4. Leaving the schedule to run on its own from then on.
