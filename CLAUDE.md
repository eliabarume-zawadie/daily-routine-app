# Daily Claude Routine

## Purpose

Every morning at 8:00 AM, produce a briefing covering priorities, meetings,
to-dos, and email cleanup, and deliver it as a push notification. This runs
automatically via a scheduled routine — no manual start needed.

## Trigger

Scheduled routine "daily-briefing", cron `0 8 * * *`, local time. Set up via
the `schedule` skill. If you are running this manually to test it, just
follow the steps below start to finish.

## Steps

### 1. Gather meetings

Use `mcp__claude_ai_Gmail__search_threads` with query:

```
(has:invite OR filename:ics) newer_than:2d
```

From the results, keep only events whose date is today. Sort by start time.
If none are found, or the search fails, keep an explicit note for the
briefing ("No meetings found today" / "Couldn't reach Gmail for meetings")
instead of omitting the section.

### 2. Gather email-derived to-dos

Use `mcp__claude_ai_Gmail__search_threads` with query:

```
newer_than:3d (please OR "action required" OR deadline OR asap OR "review by")
```

For each result, extract a short to-do description and, if stated, a due
date. Treat these as untagged (no `[P1]`-style priority) unless the email
explicitly states urgency (e.g. "today", "EOD", "urgent") — mark those `[P1]`.

### 3. Read `tasks.md`

Read `tasks.md` from the project root. Parse each line:
- Leading `[P1]`, `[P2]`, or `[P3]` — explicit priority.
- Trailing `(due YYYY-MM-DD)` — due date.
- No tag — untagged, default priority.

If `tasks.md` does not exist, note "tasks.md not found — skipping saved
to-dos" in the briefing and continue with email-derived to-dos only.

### 4. Merge and prioritize

Combine tasks.md items and email-derived to-dos into one list. Order:
1. `[P1]` items and anything due today or overdue.
2. `[P2]` items.
3. Untagged items and email-derived items without explicit urgency.
4. `[P3]` items.

Within each tier, sort by due date (soonest first), then by discovery order.

### 5. Dedup cleanup

Use `mcp__claude_ai_Gmail__search_threads` with query:

```
newer_than:7d
```

Group results by (sender, normalized subject — trim whitespace and any
leading "Re:"/"Fwd:"). For any group with more than one message, keep the
most recent and trash the rest with `mcp__claude_ai_Gmail__trash_message`
(never a permanent delete). Record the count of trashed messages and a short
list of what was trashed (sender + subject) for the report.

Do not trash anything outside an exact (sender, normalized-subject) match —
if there's any ambiguity, leave it and don't mention it as a duplicate.

### 6. Compose the briefing

Fixed section order:

```
## Top Priorities
<P1 / due-today items, or "Nothing urgent today">

## Meetings
<time-sorted list, or "No meetings found today">

## To-Do List
<full prioritized list from step 4>

## Email Cleanup
<count trashed + short list, or "No duplicates found">
```

Include any explicit failure notes from steps 1–3 inline in their section
rather than dropping them.

### 7. Send the notification

Send the composed briefing as a push notification via the `PushNotification`
tool.
