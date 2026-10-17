# Adding a skill source

1. `git submodule add <repo-url> vendors/<key>`
2. Add `<key>` to `catalog/sources.yaml` with `repository`, `local_path` and the `skill_globs` that match its `SKILL.md` files.
3. `scripts/validate-catalog --verbose` lists the new uncataloged skills.
4. Catalog the ones worth routing to in `catalog/skills.yaml` as `<key>/<skill>`, then place them in `catalog/rankings.yaml` where they should be a default or fallback.
5. `scripts/validate-catalog` must pass.

The router reads only the catalog, so no router change is needed.
