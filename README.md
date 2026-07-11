# CLAUDE-CODE-SYSTEM-PROMPT

A living archive of Claude Code's system prompt — plus a small kit for making your
own projects read and obey a consistent set of rules.

## Two parts

### 1. The archive
`CC-SYS-PROMPT-<MM-DD-YY>-*.md` are dated snapshots of Claude Code's built-in
("harness") system prompt, split into parts. Reference material only.

**Latest snapshot: `CC-SYS-PROMPT-07-10-26-*.md`** (parts 1–3), a verbatim capture.
Older dated sets (e.g. `CC-SYS-PROMPT-04-14-26-*.md`) are kept as historical
records — the prompt changes over time (model, tool set, environment), so don't
treat an older file as current. To capture a newer prompt, add another dated set;
never edit an existing one.

### 2. The project-integration kit
Files that make any project — new or existing — follow a curated ruleset:

| File | What it is |
|------|------------|
| `templates/CLAUDE.md` | The reusable ruleset Claude reads and follows |
| `templates/settings.json` | Starter `.claude/settings.json` (permissions + a SessionStart hook) |
| `scaffold.sh` | Installs the ruleset globally or into a project |
| `.claude/commands/new-project.md` | A `/new-project` command that scaffolds a project |

## First, the honest part
You **cannot replace** Claude Code's real built-in system prompt — Anthropic ships
it inside the tool and no user setting overrides it. The archive here is a *record*
of that prompt, not something you install.

What you *can* do — and what actually makes "every project obeys my rules" work — is
use Claude Code's instruction layers. That's what this kit sets up.

## How to make projects obey your rules

### Option A — every project you touch (global)
Install the ruleset as your personal memory. Claude reads it in **all** your
projects automatically:

```bash
./scaffold.sh --global        # copies templates/CLAUDE.md -> ~/.claude/CLAUDE.md
```

Run this on your own machine — a cloud/web session's home directory is temporary.

### Option B — one project, shared with your team
Put the ruleset at a repo's root so everyone who clones it gets the rules:

```bash
./scaffold.sh /path/to/your/repo          # writes CLAUDE.md + .claude/settings.json
```

### Option C — brand-new projects
Either:
- Make this repo a **template repository** (GitHub → Settings → General → "Template
  repository"), then click **"Use this template"** — new repos start with the kit in
  place; or
- Run the slash command inside Claude Code:

```
/new-project ../my-new-app
```

## Why CLAUDE.md instead of the system prompt?

| Layer | Path | Applies to |
|-------|------|------------|
| Your rules, everywhere | `~/.claude/CLAUDE.md` | Every project you open |
| Project rules, shared | `./CLAUDE.md` (committed) | That repo + your team |
| Enforced actions | `.claude/settings.json` hooks | Things that must *happen*, not just be requested |

`CLAUDE.md` can also pull in shared rules with `@~/.claude/your-rules.md` imports,
so you write them once and reuse them.

Edit the actual rules in `templates/CLAUDE.md`.
