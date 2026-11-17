---
name: northwind-pr
description: Write the pull request description for the current branch in the team's required format, using the headings from .github/pull_request_template.md. Use when the user asks to write or draft a PR description, or invokes /northwind-pr.
---

# /northwind-pr

Write the pull request description for the work on this branch, in the team's required format.

Read first, write second. Do not draft any section until you have read the branch diff, the git log, the ticket, and the repo's PR template.

## 1. Read before writing

- **The diff:** `git diff main...HEAD --stat`, then the diff itself. This is what actually changed.
- **The log:** `git log main..HEAD --oneline`. This is how the work was sequenced.
- **The ticket:** take the ticket ID from the branch name (`NWP-101-export-options` is `NWP-101`) and read `docs/tickets/<TICKET-ID>.md`. Copy its acceptance criteria verbatim.
- **The template:** read `.github/pull_request_template.md`. Its headings are the headings of the description, in the same order. If the template changes, follow the template.

If the branch name has no ticket ID, or no matching file exists in `docs/tickets/`, stop and ask which ticket this is. Do not guess one.

## 2. Build the list of what was actually verified

Before writing "How I verified it", list every verification command that really ran in this session and what it printed. Only things you can point to count: a test run, a type check, a request you sent, a page you opened.

- If a check was not run, either run it now and record the real output, or leave it out. Never fill the gap from memory or intent.
- If something was checked by hand, say what was clicked or requested and what appeared.

## 3. Write the description

Title first, then the template's sections in order.

### Title

`<TICKET-ID>: <what it does>`

One line, in plain words. For example `NWP-101: let ops choose export columns and scope`.

### Ticket

`Closes <TICKET-ID>`, so it links.

### What changed

One plain-language paragraph. Say what the app can do now that it could not do before. Not a file list: the diff already is one.

End with one line: `**Business impact:** <one sentence on who benefits and how>`. Take it from the ticket's description. If the ticket gives no reason, say that rather than inventing one.

### How I verified it

The actual commands run and what they output. Paste the real summary line, such as the test counts, rather than "tests pass". For anything checked by hand, say what was clicked or requested and what appeared. If something was not verified, say so here in one line.

Then the template's checkboxes. Tick `npm test passes`, `New behavior is covered by a test`, and `Checked it in the browser` only when the list from step 2 backs each one.

### Acceptance criteria

The ticket's checkboxes, copied verbatim, ticked honestly.

- Tick a box only when you found the code that satisfies it.
- If a criterion is partly met, leave it unticked and add a note saying which part is done and which is not.
- If nothing satisfies it, leave it unticked and say so. An unmet criterion reported plainly is better than one left out.

### Bugs fixed along the way

Anything found and fixed beyond the ticket. Name the file and the root cause, not just the symptom. If there is none, write "None."

### Notes for the reviewer

Start with a bold lead, **Deliberately not done:**, then bullets for anything out of scope, left for a follow-up, or a rough edge you chose to leave. Name the file or behavior. Include bugs you found but did not fix. If there is truly nothing, write "Nothing." Then add any trade-offs or questions you would raise out loud in a review.

## 4. Hand it over

Print the finished description. Do not push the branch or open the pull request unless the user asks you to.

## Rules

- **Never claim a verification step that was not actually run.** This is the one rule that has no exceptions. A missing check is reported as missing.
- **Plain language over ceremony.** "Ops can now pick which columns go in the export" beats "implemented column selection functionality".
- **No guessing.** Every fact in the description comes from the diff, the log, the ticket, or output you saw.
- **No placeholders left behind.** Every template section is filled in, or says "None." or "Nothing."
- **Keep it scannable.** Short paragraphs and real bullets. No emoji and no filler.
