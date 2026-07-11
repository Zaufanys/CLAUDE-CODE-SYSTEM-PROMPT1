# Educational Resources & Open-Source Projects

This page collects educational materials, documentation, and open-source projects related to Claude Code and the system-prompt integration kit.

## Official Claude Code Documentation

- **Claude Code on the web** — https://code.claude.com/docs/en/claude-code-on-the-web
  - Covers remote execution environments, network policies, session management.
  
- **Claude API & SDK** — https://anthropic.com/docs/
  - Messages API, Tool Runner, Managed Agents, prompt caching, Anthropic SDK.

- **Claude Code in IDEs** — IDE extensions for VS Code, JetBrains, and other editors.

## About This Project

- **CLAUDE-CODE-SYSTEM-PROMPT** repository: A living archive of Claude Code's built-in system prompt plus an integration kit for making projects follow shared rulesets.
  - Archive: Dated snapshots (`CC-SYS-PROMPT-*.md`) are historical records of the prompt as it evolves.
  - Kit: `scaffold.sh`, `templates/CLAUDE.md`, `templates/settings.json` for making any project read and obey consistent rules.

## How Rules Work in Claude Code

1. **System-level** — The built-in prompt (shipped with Claude Code; cannot be overridden by users).
2. **User-global** — `~/.claude/CLAUDE.md` (applies to every project you open).
3. **Project-level** — `./CLAUDE.md` (committed to a repo; shared with your team).
4. **Enforced actions** — `.claude/settings.json` hooks (e.g., SessionStart, PreToolUse) that make things *happen*, not just advisories.

See the main `README.md` for details on the three installation options (global, per-project, template repo).

## Using the Integration Kit

The kit's three tools:

- **`scaffold.sh`** — Installs `CLAUDE.md` and `.claude/settings.json` to a project or globally.
- **`templates/CLAUDE.md`** — Reusable ruleset covering working style, safety, tool usage, and git/GitHub etiquette.
- **`.claude/commands/new-project.md`** — Slash command (`/new-project <dir>`) that scaffolds new projects with the kit.

## Recommended Patterns

### For Your Own Projects

1. Run `./scaffold.sh --global` on your machine to install the ruleset everywhere.
2. For team projects, run `./scaffold.sh <project-dir>` and commit the files.

### For Template Repositories

Make this repo a GitHub template repository so others can use **"Use this template"** to start with the kit pre-installed.

### Documenting Your Rules

Edit `templates/CLAUDE.md` to distill your team's best practices once, then reuse them across projects.
Import shared rules with `@~/.claude/your-rules.md` in a project's CLAUDE.md to layer additional guidance.

## Open-Source Ecosystems to Explore

- **Anthropic's Claude Ecosystem** — Claude API, SDKs, examples, and integrations.
- **Claude Code Community** — Projects and examples from teams using Claude Code for software development.
- **AI-Assisted Development Tools** — Complementary tools for AI-driven workflows (MCP servers, LLM prompting frameworks, agentic systems).

## Learning Resources

### Prompt Engineering & System Prompts

- Understanding how language models respond to system prompts and instructions.
- Iterative prompt refinement and testing techniques.
- Safety and alignment considerations for AI-powered code generation.

### Software Development with AI

- Using AI assistants effectively in your development workflow.
- Structuring projects so AI tools can understand and contribute to your codebase.
- Testing and validating AI-generated code.

### Git & Collaboration Best Practices

- Writing clear commit messages and pull request descriptions.
- Code review workflows with AI assistance.
- Managing branches and merges in team environments.

## Contributing

This kit evolves with Claude Code itself. To stay current:

- Watch the dated snapshots (`CC-SYS-PROMPT-*.md`) — when a new one lands, it reflects an update to Claude Code's built-in prompt.
- Use the templates as a starting point, then customize them for your team's needs.
- Share improvements or new patterns back to the repository.

---

**Last updated:** July 11, 2026  
**Latest system prompt snapshot:** `CC-SYS-PROMPT-07-10-26-*.md`
