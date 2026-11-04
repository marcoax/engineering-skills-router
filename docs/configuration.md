# User configuration

Two files are yours: `preferences.yaml` (phase preferences, exclusions, models, thresholds, `personal_path`) and `personal-skills.yaml` (the registration of your own skills). Templates: `config/preferences.example.yaml`, `config/personal-skills.example.yaml`.

## Where the router reads them

Both files come from **one directory**, the first that applies:

| Source | Directory | When |
|---|---|---|
| `explicit` | `$ENGINEERING_ROUTER_CONFIG` | the variable is set (an absolute path; a leading `~` is your home dir). An empty directory means the defaults; a missing one is an error. |
| `external` | `$XDG_CONFIG_HOME/engineering-skills-router`, else `~/.config/engineering-skills-router` | it holds either file |
| `clone-local` | `config/` in the router checkout | it holds either file |
| `defaults` | none | no file anywhere: the documented defaults apply; new configuration belongs in the external directory |

Files are never merged across directories. When the effective directory is not `config/` and `config/` still holds a file, that file is ignored: `scripts/validate-catalog` reports it as an error (a warning when `ENGINEERING_ROUTER_CONFIG` chose the location deliberately) until you migrate or remove one of them.

`scripts/config` prints the source in effect, its directory and files, and any ignored file. Every reader uses this rule: the router instructions, `scripts/list-skills`, `scripts/validate-catalog`, `scripts/state` (step models, primary), `scripts/context-threshold` and, through those scripts, the Pi and Claude Code adapters. The scripts inherit the environment of the harness that runs them, so set `ENGINEERING_ROUTER_CONFIG` where that harness starts, or use the external default, which needs no variable.

A relative `personal_path` resolves against the router checkout in a clone-local `preferences.yaml` (as before) and against the configuration directory elsewhere. Paths in `personal-skills.yaml` stay relative to `personal_path`.

A missing file means the defaults. A malformed file (invalid YAML, or no top-level `preferences:` / `skills:` mapping) is an error, never read as absent: `scripts/validate-catalog` and `scripts/config` report it, and the scripts that act on the configuration (`list-skills`, `check-selection`, `context-threshold`, and `state` when a command needs the preferences) stop with the same error instead of running on the defaults. After a completed step the adapters show it as a `config: error: …` line.

## Package updates

The external and explicit directories are outside the checkout: a Pi package update that resets, cleans (`git clean -fdx`) or replaces the checkout leaves them and their effect unchanged. `config/` inside a Pi-managed checkout is removed by such an update. The router does not rely on any hook running before an update.

## Moving clone-local configuration out

```sh
scripts/config migrate        # shows what moves where; changes nothing
scripts/config migrate --yes  # moves it
```

The destination is `$ENGINEERING_ROUTER_CONFIG` when set, else the external directory. `migrate --yes`:

1. refuses when the destination already holds either file, and changes nothing (compare the two, keep one, run it again);
2. rewrites a relative `personal_path` to the absolute path it meant (the checkout as base), so personal skills keep resolving to the same folders; `~` and absolute paths stay as written, and the skills themselves never move;
3. stages the files in a temporary directory, runs `scripts/validate-catalog` against them and compares the `list-skills` and `context-threshold` output with the current one; on any failure the destination is untouched and `config/` keeps its files;
4. copies the files without overwriting, checks the destination is now in effect with the same output, and only then removes the files from `config/`.

Without `--yes` nothing is written, which is also how to cancel.
