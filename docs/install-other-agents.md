# Install for other agents

The [README](../README.md) covers Claude Code from a clone and Pi. This page covers the other routes: `npx skills add` for any agent the skills CLI supports, and linking the skill from a clone into Codex, Cursor or OpenCode.

## With `npx skills add`

For Claude Code, Codex, Cursor, OpenCode and the other agents the [skills CLI](https://github.com/vercel-labs/skills) supports. Needs Node 22.18+ and git.

```sh
npx skills add marcoax/engineering-skills-router
```

This installs one skill, `engineering-router`, without its catalog, scripts or vendor skills. On each run the router looks for a full checkout and uses the first it finds:

1. the checkout the skill folder sits in (clone and link installs, below);
2. `$ENGINEERING_ROUTER_HOME`, for a personal clone;
3. the Pi package checkout, `~/.pi/agent/git/github.com/marcoax/engineering-skills-router` (used read-only, so one copy of the vendors serves both);
4. `~/.local/share/engineering-skills-router` (`$XDG_DATA_HOME/engineering-skills-router` when that is set).

When none exists, the first run asks before cloning the repo with its submodules into the last of these and running `scripts/setup` there; decline and it stops. Nothing is written into agent skill folders. The router always says which checkout it uses and how it found it.

**Preferences** and personal-skill registrations live outside any checkout, in `~/.config/engineering-skills-router/` (`$XDG_CONFIG_HOME/...`, or the directory named by `ENGINEERING_ROUTER_CONFIG`), so every checkout above, the Pi one included, finds the same configuration and updates leave it alone. A clone-local `config/` still works when no external file exists. `scripts/config` prints which one is in effect, and `scripts/config migrate` moves clone-local files out ([configuration.md](configuration.md)). To edit the catalog, clone and set up as in [From a clone](#from-a-clone), then `export ENGINEERING_ROUTER_HOME=/path/to/clone`.

**Updating.** The installed skill folder is only a bootstrap: once it finds a checkout that contains `skills/engineering-router/SKILL.md`, it follows that file instead of its own, so the router's instructions match the checkout's catalog and scripts. `npx skills update` refreshes only that bootstrap. The checkout is updated by the router's own vendor update check, or by `git pull && scripts/setup` in it (for the Pi checkout, use the package update command in the README's [Install (Pi)](../README.md#install-pi)).

The workflow display comes from the agent adapters only: the Pi widget and the Claude Code mod. Other agents run the router without it.

## From a clone

Instead of `npx skills add`, clone and set up once, then link the router skill into the agent's skills folder. The router then uses that clone directly.

```sh
git clone --recurse-submodules https://github.com/marcoax/engineering-skills-router && cd engineering-skills-router
scripts/setup
mkdir -p ~/.config/engineering-skills-router   # optional: your preferences, outside the clone
cp config/preferences.example.yaml ~/.config/engineering-skills-router/preferences.yaml
```

Codex, Cursor, OpenCode: link or point the agent at `skills/engineering-router/SKILL.md` with whatever skill/rule mechanism it offers. Update with `git pull && scripts/setup` in the clone.

For Claude Code, follow the README's [quick start](../README.md#install-claude-code); for one project only, link into that project's `.claude/skills/` instead of `~/.claude/skills/`.
