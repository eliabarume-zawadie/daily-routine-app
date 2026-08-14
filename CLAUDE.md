# Daily Claude Routine

## Purpose

Every morning at 8:00 AM, produce a briefing covering priorities, meetings,
to-dos, and email cleanup. Delivery is a short push notification headline
plus the full briefing as the run's final response (see step 7). This runs
automatically via a scheduled routine — no manual start needed.

## Trigger

Scheduled routine "daily-briefing", cron `0 8 * * *`, local time. Set up via
the `schedule` skill.

## Execution guard — read this first

**Do NOT run the steps below unless one of these is true:**

1. You were invoked by the scheduled `daily-briefing` routine, or
2. The user has explicitly asked you to run the daily routine / daily
   briefing (or to test it end to end).

This file sits at the project root, so it is auto-loaded into the context of
**every** Claude Code session opened in this directory, including sessions
doing completely unrelated work. Its presence in your context is **not** a
request to execute it. Step 5 trashes email in the user's real mailbox — do
not run any of these steps as an incidental side effect of this file having
been loaded. If you are here for unrelated work, ignore the procedure below
entirely.

## Steps

### 1. Gather meetings

Use `mcp__claude_ai_Gmail__search_threads` with query:

```
filename:ics newer_than:30d
```

(`has:invite` is not a real Gmail operator — do not use it. The 30-day
window is about when the *email* arrived; invitations are frequently sent
days or weeks ahead of the event, so the arrival window is deliberately wide
and the actual event date is filtered below.)

The search results only give subject/sender/snippet/email-date — they do
**not** tell you the calendar event's date. So for each candidate thread,
call `mcp__claude_ai_Gmail__get_thread` with a plain-text/readable format and
read the actual event date out of the invite body/content. Do not try to
infer the event date from the snippet alone. Keep only events whose event
date is today, and sort those by start time.

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
If this search fails, note "Couldn't reach Gmail for to-dos" in the briefing
rather than omitting the contribution.

### 3. Read `tasks.md`

Read `tasks.md` from the project root.

First, decide which lines are real content. **Skip** all of the following —
they are never to-dos:
- Markdown headings (any line starting with `#`).
- Blank / whitespace-only lines.
- Anything inside an HTML comment block: everything from a line containing
  `<!--` through the line containing the matching `-->`, inclusive. The
  shipped `tasks.md` keeps its format documentation and *example* task lines
  inside such a comment; those examples look like valid task lines but must
  never be treated as real to-dos.

Then parse only the surviving real-content lines:
- Leading `[P1]`, `[P2]`, or `[P3]` — explicit priority.
- Trailing `(due YYYY-MM-DD)` — due date.
- No tag — untagged, default priority.

If every line is skipped, treat `tasks.md` as having no saved to-dos.

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
in:inbox newer_than:7d
```

The `in:inbox` scope is mandatory. Archived and sent mail are included by
default otherwise, and trashing the user's own sent mail or deliberately
archived mail would be data loss. Never consider anything outside the inbox
for trashing.

Group results by (sender, subject). Compare subjects **literally** — do not
strip leading `Re:` / `Fwd:` prefixes. A reply or a forward is a new message
in a conversation, not a duplicate, and normalizing those prefixes away
produces false positives. Trimming surrounding whitespace is fine.

For any group with more than one thread, call
`mcp__claude_ai_Gmail__get_thread` on each thread to get its messages and
their content, then apply these safety checks before trashing anything:

- **Content must match.** The message snippet/body content must be
  substantially identical across the group. Matching sender + subject alone
  is *not* sufficient authorization to trash.
- **Skip ambiguous groups.** If any thread in the group contains more than
  one message, or if the group contains a reply/forward relationship
  (subjects differing by `Re:`/`Fwd:`, in-reply-to/references linkage, or
  quoted-reply content), the group is ambiguous: skip it entirely, trash
  nothing from it, and do not report it as a duplicate.

Only for groups that survive both checks — genuine exact-content duplicates —
keep the most recent message and trash the older one(s) with
`mcp__claude_ai_Gmail__trash_message` (never a permanent delete). Record the
count of trashed messages and a short list of what was trashed (sender +
subject) for the report.

If there's any ambiguity at all, leave it and don't mention it as a duplicate.
If this search fails, note "Couldn't reach Gmail for duplicate check" in the
Email Cleanup section rather than reporting "No duplicates found."

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

Include any explicit failure notes from steps 1–5 inline in their section
rather than dropping them.

### 7. Deliver

The briefing has two parts, and they are **not** the same text.

**a) The push notification — a short headline only.** The `PushNotification`
tool requires a single-line message, no Markdown, under 200 characters;
mobile OSes silently truncate anything longer. The multi-section Markdown
briefing from step 6 will not fit and must not be sent as-is. Instead, build
a one-line headline that summarizes the counts, e.g.:

```
3 priorities, 2 meetings, 5 to-dos, 2 dupes trashed
```

Plain text only — no `#`, `*`, backticks, or newlines. Keep it under 200
characters; if any failure notes exist, compress them into the same line
(e.g. `... , Gmail unreachable for meetings`) rather than dropping them.
Send that headline via `PushNotification`.

**b) The full briefing is the run's final response.** Output the complete
composed briefing from step 6 — all four sections, in order, with any
failure notes — as your final message for the run. That is where the full
content lives; do not try to squeeze it into the notification.

If `PushNotification` reports that it did not send (for example because the
user is at a terminal rather than on mobile), say so explicitly in the final
response — do not silently assume delivery succeeded.
