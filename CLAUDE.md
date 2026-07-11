# CLAUDE.md — CLAUDE-CODE-SYSTEM-PROMPT

Rules for working in THIS repository.

## What this repo is
Two things:
1. **An archive** of Claude Code's built-in system prompt, captured as dated
   snapshots (`CC-SYS-PROMPT-<MM-DD-YY>-*.md`). These are historical records.
2. **A project-integration kit** — `templates/`, `scaffold.sh`, and
   `.claude/commands/new-project.md` — for making other projects read and obey a
   curated ruleset. See `README.md`.

## Rules for this repo
- Treat the `CC-SYS-PROMPT-*.md` files as **verbatim snapshots**. Don't edit,
  reword, or "tidy" them. To capture a newer prompt, add a new dated set — never
  rewrite an existing one.
- The reusable ruleset lives in `templates/CLAUDE.md`. Change rules there rather
  than copying prose between files.
- Keep `README.md` in sync when you change how the kit works.
- Develop on the branch you were assigned; don't push elsewhere without being asked.

## Working style
Follow the same rules this kit ships in `templates/CLAUDE.md`: read before you
change, do only what's asked, keep replies concise, prefer editing over creating
files, and confirm before anything hard to undo or visible to others.
