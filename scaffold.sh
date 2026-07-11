#!/usr/bin/env bash
#
# scaffold.sh — install this kit's curated Claude Code rules either globally
# (for every project you touch) or into a specific project.
#
# Existing files are never clobbered silently: a timestamped .bak copy is made
# before anything is overwritten.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/templates"

usage() {
  cat <<'EOF'
Usage:
  ./scaffold.sh --global
      Install the ruleset to ~/.claude/CLAUDE.md so Claude Code reads it in
      ALL of your projects automatically. Run this on your own machine — a
      cloud/web session's home directory is temporary.

  ./scaffold.sh <target-dir>
      Install CLAUDE.md and .claude/settings.json into a project directory.

  ./scaffold.sh <target-dir> --rules-only
      Install only CLAUDE.md (skip .claude/settings.json).

  ./scaffold.sh --help
      Show this help.

Existing files are backed up to <file>.bak-<timestamp> before being replaced.
EOF
}

backup_if_exists() {
  local dest="$1"
  if [[ -e "$dest" ]]; then
    local bak
    bak="${dest}.bak-$(date +%Y%m%d%H%M%S)"
    cp -p "$dest" "$bak"
    echo "  backed up existing $dest -> $bak"
  fi
}

install_file() {
  local src="$1" dest="$2"
  mkdir -p "$(dirname "$dest")"
  backup_if_exists "$dest"
  cp "$src" "$dest"
  echo "  wrote $dest"
}

main() {
  if [[ $# -eq 0 ]]; then
    usage
    exit 1
  fi

  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --global)
      echo "Installing global rules:"
      install_file "$TEMPLATE_DIR/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
      echo "Done. Every Claude Code session on this machine will now read these rules."
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      local target="$1"
      local rules_only="no"
      if [[ "${2:-}" == "--rules-only" ]]; then
        rules_only="yes"
      fi
      if [[ ! -d "$target" ]]; then
        echo "Target directory does not exist: $target" >&2
        echo "Create it first (e.g. mkdir -p \"$target\"), then re-run." >&2
        exit 1
      fi
      echo "Installing project rules into $target:"
      install_file "$TEMPLATE_DIR/CLAUDE.md" "$target/CLAUDE.md"
      if [[ "$rules_only" == "no" ]]; then
        install_file "$TEMPLATE_DIR/settings.json" "$target/.claude/settings.json"
      fi
      echo "Done. Commit these files in the target repo so your team gets them too."
      ;;
  esac
}

main "$@"
