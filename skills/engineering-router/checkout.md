# Checkout and updates

Read from SKILL.md when the resolver prints `missing`, or when the update check is due (§0).

## Missing checkout

The resolver printed `missing`: this skill was installed without its checkout.

- Explain that the router needs its catalog and vendor skills, and ask to fetch them into the printed `data-dir` with `git clone --recurse-submodules https://github.com/marcoax/engineering-skills-router <data-dir>`, then `<data-dir>/scripts/setup`. On yes, run both and the resolver again.
- If that `data-dir` already exists (e.g. an interrupted clone), do not clone over it: tell the user, and offer to remove it and clone again, or to point `ENGINEERING_ROUTER_HOME` at a clone.
- On no, stop: say the router cannot run without a checkout, and that `ENGINEERING_ROUTER_HOME` can point it at an existing clone.

## Vendor update check

The check is due (SKILL.md §0). Ask whether to check vendor updates now. If yes:

1. Run `scripts/update`. It pulls the vendor submodules and reports, per source, every `SKILL.md` added (`+`), modified at the same path (`~`), removed (`-`) or moved (`>`) since the revision the catalog was last reviewed against (`catalog/reviewed.yaml`), plus upstream skills not cataloged yet (`?`) and cataloged paths gone missing (`!`). Unapproved changes stay listed across repeated updates. A source with no reviewed revision gets an initialization report listing all its skills: review them as for an update. If the update fails, tell the user and stop.
2. Read every reported `SKILL.md` in full; the `diff:` line shows what changed. Classify from what the skill says it does, never from its name alone.
3. **Propose** a concrete diff to `catalog/skills.yaml` (and `catalog/guides.yaml` for a vendor's guide): register every new skill with categories, `use_when`/`avoid_when`, `requires` and `invokes`; update entries whose skill changed; move or remove entries for moved or removed skills and fix every `invokes` naming a removed one. Leave untouched entries, preferences and personal skills alone. Never add a vendor ranking or a preferred/fallback order: candidates stand on equal terms. When the catalog needs no change, say so.
4. Show the diff and wait for the user's confirmation. Change nothing before it; on refusal, stop with nothing changed.
5. On confirmation, save the diff as a patch and run `scripts/update --approve <patch>` (no patch when the catalog needs no change). It applies the patch, runs `scripts/validate-catalog`, requires every upstream skill cataloged, regenerates `docs/skill-index.md`, and only then records the checked-out revisions as reviewed; any failure restores the catalog and records nothing. Report its output, and on failure the reason. Committing the catalog, `catalog/reviewed.yaml`, the index and the vendor pins is the user's call.

Done when the check was declined, the update failed, or the proposal was refused or approved.
