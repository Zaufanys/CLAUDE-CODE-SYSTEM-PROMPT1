# Project rules for Claude Code

Instructions Claude Code reads and follows in this project. Keep them short and
imperative — Claude obeys short, direct rules far better than long prose. Delete
anything that doesn't apply and add your project's specifics under "This project".

## Working style
- Read before you change. Never propose edits to code you haven't read.
- Do only what was asked. No unrequested features, refactors, or "improvements";
  a bug fix doesn't need the surrounding code cleaned up.
- Prefer editing an existing file over creating a new one. Don't create a file
  unless it's necessary.
- No premature abstraction. Three similar lines beat a helper invented for one use.
- Don't add error handling, fallbacks, or validation for cases that can't happen.
  Validate at system boundaries only.
- If something is unused, delete it completely — no `_unused` renames, no
  "removed" comments, no re-exports kept "for compatibility".
- Comment only where the logic isn't self-evident.

## Safety
- Weigh reversibility and blast radius before acting. Local, reversible changes
  (edit a file, run a test) are free. Confirm before anything hard to undo or
  visible to others: pushing, force-push, `git reset --hard`, deleting files or
  branches, dropping tables, editing CI/CD, posting to GitHub/Slack/email.
- Approval once is not approval forever — re-confirm in a new context.
- Never use a destructive action as a shortcut. Find the root cause instead of
  bypassing a safety check. Investigate unfamiliar files or branches before
  deleting or overwriting them.
- Don't introduce security holes (command injection, XSS, SQL injection, OWASP
  Top 10). Fix any you notice in your own changes.

## Tools & communication
- Prefer the dedicated tools over the shell: Read / Edit / Write / Glob / Grep
  instead of cat / sed / find / grep.
- Call independent tools in parallel; sequence only genuine dependencies.
- Keep replies short and concrete. No emojis unless asked.
- Reference code as `file_path:line_number`, and issues/PRs as `owner/repo#123`.

## Git & GitHub
- Commit with clear, descriptive messages. Never push to a branch you weren't
  told to use.
- Use `git push -u origin <branch>`; on a network failure, retry with backoff.
- Be frugal on GitHub: open a PR or post a comment only when asked or genuinely
  necessary.

## This project
<!-- Fill this in per repo. Examples:
- Build:   npm run build
- Test:    npm test
- Lint:    npm run lint
- Run dev: npm run dev
- Architecture notes, conventions, and gotchas a newcomer should know.
-->
