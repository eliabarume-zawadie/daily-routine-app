# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

There is no application code here — no package manager, build, lint, or test
framework. The deliverable is **prompt-as-code**: Markdown instructions that an
unattended scheduled Claude agent executes every morning. The "runtime" is a
cloud routine named `daily-briefing` (cron `0 8 * * *`, local time) created via
the `schedule` skill; the routine's config lives in the scheduling system, not
in git.

Split of responsibilities:

| File | Role |
|---|---|
| `CLAUDE.md` (below the divider) | The routine's runtime behavior. This is the thing you edit to change what the 8 AM run does. |
| `tasks.md` | User-maintained to-do data, read by step 3 of the routine. Format doc lives in an HTML comment that the routine is explicitly told to skip. |
| `docs/superpowers/specs/` | Original design doc — intent and rationale. |
| `docs/superpowers/plans/` | The implementation plan that produced the routine. Historical; it predates several behavior fixes, so `CLAUDE.md` wins wherever they disagree. |

## Working on the routine

- **Change behavior in `CLAUDE.md`, not in the scheduler.** The scheduled
  routine's prompt is just "follow the daily routine in CLAUDE.md".
- **Write for an unattended reader.** The steps are followed verbatim by an
  agent with no human in the loop, so name the exact MCP tool id
  (`mcp__claude_ai_Gmail__search_threads`) and give the exact query string.
  Never leave a step to be inferred.
- **Every failure path needs an explicit note.** A source being unreachable
  must surface in the briefing (e.g. "Couldn't reach Gmail for to-dos"), never
  be silently dropped or reported as an empty result.
- **The safety rules in step 5 are load-bearing.** They were tightened after
  review found false-positive deletions: inbox-only scope, literal subject
  comparison (no `Re:`/`Fwd:` normalizing), content must match, ambiguous
  groups skipped entirely, trash-never-delete. Do not relax them for
  convenience.
- Step 7's three delivery channels carry different text — a single-line
  headline under 200 chars for push, the full Markdown briefing for email and
  for the final response. Keep them distinct.

## Verification

There is nothing to unit test. Verification is functional: run the routine
end-to-end (ask for it explicitly — see the execution guard), then confirm the
push notification, the email to `elia.barume@zawadie.com`, and the final
response all arrived, and spot-check Gmail Trash to confirm only genuine
duplicates were trashed. Use the `schedule` skill to list, edit, or manually
trigger the `daily-briefing` routine.

## Repository layout traps

- `daily-routine-app/` is a **second, stale clone of this same repository**
  (same GitHub remote) sitting untracked inside the working tree. Its
  `CLAUDE.md` predates the Google Calendar source, the monday.com action-item
  source, and email delivery. Edits there have no effect on the live routine —
  always work in the repository root.
- `Game app/` is an unrelated scratch project containing only an empty
  `PRD.md`. It is untracked and has nothing to do with the routine.
- Local branch is `master`; the remote default branch is `main`, so PRs target
  `main`.
- `.claude/worktrees/` is gitignored and holds superpowers worktrees.

---

Everything below is the routine itself — the product, not guidance for editing
sessions. Read its execution guard before acting on any of it: its presence in
your context is not a request to run it.

# Daily Claude Routine

## Purpose

Every morning at 8:00 AM, produce a briefing covering priorities, meetings,
to-dos, and email cleanup. Delivery is a short push notification headline,
plus the full briefing sent as an email and included as the run's final
response (see step 7). This runs automatically via a scheduled routine — no
manual start needed.

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

Two sources, merged. Google Calendar is authoritative; Gmail invite emails
only fill in anything Calendar doesn't have yet (e.g. an invite that arrived
but hasn't been added to Calendar).

**a) Google Calendar (primary).** Call `mcp__claude_ai_Google_Calendar__list_events`
with:
- `startTime`: today's date in Africa/Johannesburg time, `<YYYY-MM-DD>T00:00:00+02:00`
- `endTime`: same date, `<YYYY-MM-DD>T23:59:59+02:00`
- `orderBy`: `startTime`

(Leave `calendarId` unset — defaults to the primary calendar. Africa/Johannesburg
is UTC+2 year-round, no DST, so the `+02:00` offset is always correct.)

This returns real events with actual start/end times for today — use this
list as the base.

If this call fails, note "Couldn't reach Google Calendar for meetings" in
the briefing and fall back to using only the Gmail check below for this run,
rather than omitting the section.

**b) Gmail invite emails (supplementary).** Use `mcp__claude_ai_Gmail__search_threads`
with query:

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
date is today.

If this search fails, note "Couldn't reach Gmail for meeting invites" —
but only if the Calendar call in (a) also failed or found nothing; don't let
a Gmail failure overshadow a successful Calendar result.

**c) Merge.** Add today's-date Gmail invites to the Calendar list only if
they don't already match a Calendar event (same or near-identical title,
and either the same day or an overlapping/adjacent time) — a Calendar event
created from an invite is the same meeting, not a second one. Sort the
merged list by start time.

If both sources come back empty (or both fail), keep an explicit note for
the briefing ("No meetings found today") instead of omitting the section.

### 2. Gather to-dos from email and recent meetings

Two sources, merged.

**a) Email-derived to-dos.** Use `mcp__claude_ai_Gmail__search_threads` with query:

```
newer_than:3d (please OR "action required" OR deadline OR asap OR "review by")
```

For each result, extract a short to-do description and, if stated, a due
date. Treat these as untagged (no `[P1]`-style priority) unless the email
explicitly states urgency (e.g. "today", "EOD", "urgent") — mark those `[P1]`.
If this search fails, note "Couldn't reach Gmail for to-dos" in the briefing
rather than omitting the contribution.

**b) Meeting action items (monday.com notetaker).** Call
`mcp__claude_ai_monday_com__explore_meetings` with `access: OWN` and
`start_time_from` set to 2 days before today (UTC ISO 8601) — this catches
yesterday's and today's-so-far meetings even allowing for timezone slop.
This is a listing call only; it does not return action items itself.

For each meeting returned, call `mcp__claude_ai_monday_com__get_meetings_content`
with its id, `include_action_items: true`. For each action item returned,
add a to-do: `<action item text> (from meeting: <meeting title>, <date>)`.
Treat as untagged unless the action item text itself states explicit
urgency (e.g. "today", "ASAP", "urgent") — mark those `[P1]`.

A meeting with no completed recording, or one you don't have access to,
comes back in `missing_ids` or `content_omitted_ids` — skip it silently,
that's not a failure. Only note "Couldn't reach monday.com for meeting
action items" if the calls themselves error out.

**c) Merge.** Combine both sources into one to-do candidate pool for step 4.
If a meeting action item and an email to-do clearly describe the same task,
keep one rather than listing it twice.

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
to-dos" in the briefing and continue with the step 2 to-dos only.

### 4. Merge and prioritize

Combine tasks.md items with the step 2 to-do pool (email + meeting action
items) into one list. Order:
1. `[P1]` items and anything due today or overdue.
2. `[P2]` items.
3. Untagged items and step 2 items without explicit urgency.
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

The briefing has three parts, and they are **not** the same text.

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

**b) The full briefing by email.** Send the complete composed briefing from
step 6 — all four sections, in order, with any failure notes — as an email
via `mcp__claude_ai_Gmail__send_message`:
- To: `elia.barume@zawadie.com`
- Subject: `Daily Briefing — <today's date>`
- Body: the full step 6 briefing text, unabridged.

If sending fails, do not retry silently — note the failure explicitly in the
final response (part c) so it isn't lost.

**c) The full briefing is also the run's final response.** Output the
complete composed briefing from step 6 as your final message for the run,
regardless of whether the email in (b) succeeded — this is the fallback the
user can always read even if email delivery failed.

If `PushNotification` reports that it did not send (for example because the
user is at a terminal rather than on mobile), say so explicitly in the final
response — do not silently assume delivery succeeded. Same for the email in
(b): confirm success or failure, don't assume.
