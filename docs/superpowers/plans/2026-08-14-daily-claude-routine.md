# Daily Claude Routine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a fully automated 8:00 AM daily briefing (priorities, meetings, to-dos, email dedup) delivered via push notification, with no manual start required.

**Architecture:** `CLAUDE.md` holds the routine's runtime instructions; `tasks.md` holds the user's maintained to-do list; a cron-scheduled cloud routine (created via the `schedule` skill) triggers a Claude run daily at 8:00 AM that follows `CLAUDE.md`, uses Gmail MCP tools, and ends with a push notification.

**Tech Stack:** Gmail MCP tools (`mcp__claude_ai_Gmail__*`), `schedule` skill (cron routine), `PushNotification` tool. No traditional test framework — this project has no application code, so verification is functional (run the routine, inspect real output) rather than unit tests.

## Global Constraints

- Notification channel is push notification only (per spec).
- Email cleanup only ever trashes messages (Gmail Trash, recoverable ~30 days) — never a permanent delete.
- Duplicate detection only fires on same sender AND same/near-identical subject, seen more than once — never on ambiguous or single emails.
- Briefing section order is fixed: Top priorities → Meetings → Full to-do list → Email cleanup report.
- Any data-source failure (Gmail unreachable, no meetings found, `tasks.md` missing) must be stated explicitly in the briefing, never silently omitted.
- Schedule trigger: daily, 8:00 AM local time.

---

### Task 1: Create `tasks.md` template

**Files:**
- Create: `tasks.md` (project root)

**Interfaces:**
- Produces: the file `tasks.md`, read by the routine defined in Task 2. Format: one to-do per line, optional leading `[P1]`/`[P2]`/`[P3]` tag, optional trailing `(due YYYY-MM-DD)`.

- [ ] **Step 1: Write the file**

```markdown
# Tasks

<!--
Format: one to-do per line.
Optional priority tag at the start: [P1] [P2] [P3]  (P1 = highest)
Optional due date at the end: (due YYYY-MM-DD)

Examples:
[P1] Finish Q3 budget review (due 2026-08-15)
[P2] Reply to vendor contract email
Read up on new onboarding docs
-->
```

- [ ] **Step 2: Verify**

Open the file and confirm it parses as valid Markdown with the format comment intact — this is the reference the routine's prioritization logic points to, so the tag/due-date syntax must match Task 2's instructions exactly.

- [ ] **Step 3: Commit**

```bash
git add tasks.md
git commit -m "Add tasks.md template for daily routine to-dos"
```

---

### Task 2: Write `CLAUDE.md` daily routine instructions

**Files:**
- Modify: `CLAUDE.md` (currently just a `# Daily Email` placeholder header)

**Interfaces:**
- Consumes: `tasks.md` format from Task 1 (`[P1]`/`[P2]`/`[P3]` tags, `(due YYYY-MM-DD)` dates).
- Produces: the full routine specification that Task 3's scheduled routine invokes by reference, and that Task 4 executes manually to verify.

- [ ] **Step 1: Write the file**

```markdown
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
```

- [ ] **Step 2: Verify**

Read the file back and confirm each of the 7 steps names the exact Gmail MCP
tool and query it uses, and that the tasks.md tag format matches Task 1
exactly (`[P1]`/`[P2]`/`[P3]`, `(due YYYY-MM-DD)`).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Write daily routine instructions in CLAUDE.md"
```

---

### Task 3: Set up the 8 AM scheduled routine

**Files:** None (routine config lives in the scheduling system, not the repo).

**Interfaces:**
- Consumes: the routine defined in `CLAUDE.md` (Task 2), by reference to this project directory.
- Produces: a running scheduled routine named `daily-briefing` that fires at 8:00 AM local time daily.

- [ ] **Step 1: Invoke the `schedule` skill**

Create a new scheduled routine with:
- Name: `daily-briefing`
- Cron: `0 8 * * *` (local time)
- Working context: this project directory (`Ai Training`)
- Prompt: "Follow the daily routine in CLAUDE.md and send the briefing as a push notification."

- [ ] **Step 2: Verify the routine was created**

List scheduled routines and confirm `daily-briefing` appears with the
correct cron expression and next-run time.

- [ ] **Step 3: Commit**

No repo files changed in this task — nothing to commit. If the `schedule`
skill writes any local config file as a side effect, stage and commit that
file specifically (not a blanket `git add -A`).

---

### Task 4: Manual end-to-end verification run

**Files:** None (functional verification only).

**Interfaces:**
- Consumes: everything from Tasks 1–3.

- [ ] **Step 1: Trigger the routine manually**

Run the `daily-briefing` routine once immediately (don't wait for 8:00 AM) —
either via the schedule skill's manual-run option, or by directly following
the 7 steps in `CLAUDE.md` in this session.

- [ ] **Step 2: Confirm the push notification arrives**

Check that a push notification was received and that it contains all four
sections in the fixed order (Top Priorities, Meetings, To-Do List, Email
Cleanup).

- [ ] **Step 3: Spot-check the email cleanup**

Open Gmail Trash and confirm every message moved there was a genuine
same-sender/same-subject duplicate, and that nothing ambiguous was trashed.

- [ ] **Step 4: Fix and re-run if anything looks wrong**

If prioritization, meeting detection, or dedup produced a wrong result,
adjust the relevant step in `CLAUDE.md` (Task 2) and re-run this task until
the output is correct.

- [ ] **Step 5: Commit any fixes**

```bash
git add CLAUDE.md
git commit -m "Fix daily routine behavior found during verification run"
```

(Skip if no fixes were needed.)
