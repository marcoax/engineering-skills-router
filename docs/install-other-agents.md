# Install for other agents

Claude Code and Pi have their own routes in the [README](../README.md#install-claude-code). This page covers Codex, Cursor, OpenCode and any agent the [skills CLI](https://github.com/vercel-labs/skills) supports. The components are the same everywhere: a **checkout** of this repo (catalog, scripts, pinned vendor skills) and the two skills, `engineering-router` and the read-only `skill-selector`, which find that checkout as described in [checkout resolution](reference.md#checkout-resolution). The workflow display exists only in the Pi and Claude Code adapters; other agents run the router without it.

## From a checkout (recommended)

Clone the repo and run `"$ROUTER/scripts/setup"` (not `scripts/install-claude`, which is for Claude Code), optionally copy the preferences as in the README's [Claude Code install](../README.md#steps); none of this touches an agent folder. Then make `"$ROUTER/skills/engineering-router"`, and optionally `"$ROUTER/skills/skill-selector"`, available with whatever skill mechanism the agent offers: a symlink into its skills folder, or pointing it at the `SKILL.md`. A linked or referenced skill uses that checkout directly (`found: skill-dir`), with no environment variable. Update and the reviewed vendor synchronization are as in the README's [Update](../README.md#update).

## With `npx skills add`

Needs Node 22.18+ and git.

```sh
npx skills add marcoax/engineering-skills-router
```

This copies the two skill folders into the agent's skills folder, without the catalog, scripts or vendor skills; the vendor collections are never installed as skills. Each copy is a **bootstrap**: on each run it looks for a checkout (`ENGINEERING_ROUTER_HOME`, the Pi package checkout, then `~/.local/share/engineering-skills-router`) and, once found, follows the checkout's own `SKILL.md` instead of itself, so instructions, catalog and scripts always match. When no checkout exists, the first run asks before cloning one into `~/.local/share/engineering-skills-router` and running `scripts/setup` there; decline and it stops. To use a checkout of your own, set `ENGINEERING_ROUTER_HOME` to its absolute path where the agent starts.

`npx skills update` refreshes only the bootstrap. The checkout is updated as in the README's [Update](../README.md#update) (for the Pi checkout, with the Pi package update).

**Preferences** and personal-skill registrations are read from `~/.config/engineering-skills-router/` (`$XDG_CONFIG_HOME/...`, or the directory named by `ENGINEERING_ROUTER_CONFIG`) whichever checkout is used, so updates leave them alone ([configuration.md](configuration.md)).
