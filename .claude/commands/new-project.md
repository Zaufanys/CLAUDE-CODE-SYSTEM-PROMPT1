---
description: Scaffold a new or existing project so it carries this kit's Claude Code rules
---

Set up a project so Claude Code reads and obeys the shared ruleset from this kit.

Target (a directory path or a new folder name): $ARGUMENTS

Steps:
1. If no target was given, ask for one. If the target directory doesn't exist,
   create it and run `git init`.
2. Copy `templates/CLAUDE.md` from this kit to the target as `CLAUDE.md`. If the
   target already has a `CLAUDE.md`, show the difference and ask before replacing it.
3. Copy `templates/settings.json` to the target's `.claude/settings.json` (create
   the `.claude/` directory if needed). Don't overwrite an existing settings file
   without asking.
4. Fill in the "This project" section of the new `CLAUDE.md` with the target's real
   build / test / lint / run commands if you can detect them; otherwise leave the
   placeholders in place.
5. Summarize what you created and remind me to commit it in the new repo.

Never touch this kit's own files, and never overwrite an existing file without
asking first.
