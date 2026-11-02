# Checkout and updates

Read from SKILL.md when the resolver prints `missing`, or when the update check is due (§0).

## Missing checkout

The resolver printed `missing`: this skill was installed without its checkout.

- Explain that the router needs its catalog and vendor skills, and ask to fetch them into the printed `data-dir` with `git clone --recurse-submodules https://github.com/marcoax/engineering-skills-router <data-dir>`, then `<data-dir>/scripts/setup`. On yes, run both and the resolver again.
- If that `data-dir` already exists (e.g. an interrupted clone), do not clone over it: tell the user, and offer to remove it and clone again, or to point `ENGINEERING_ROUTER_HOME` at a clone.
- On no, stop: say the router cannot run without a checkout, and that `ENGINEERING_ROUTER_HOME` can point it at an existing clone.

## Vendor update check

The check is due (SKILL.md §0). Ask whether to check vendor updates now. If yes:

1. Run `scripts/update`.
2. Read every vendor `SKILL.md` it reports as added, plus those changed since the pinned commit (`git diff --submodule=diff -- vendors/`).
3. **Propose** a diff to `catalog/skills.yaml` and `catalog/rankings.yaml`. Apply it only after the user confirms, then run `scripts/validate-catalog`.

Done when the check was declined, or the catalog proposal was answered.
