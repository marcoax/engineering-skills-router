# Adding a skill source

1. `git submodule add <repo-url> vendors/<key>`
2. Add `<key>` to `catalog/sources.yaml` with `repository`, `local_path` and the `skill_globs` that match its `SKILL.md` files.
3. `scripts/validate-catalog --verbose` lists the new uncataloged skills.
4. Read each discovered `SKILL.md` and register it in `catalog/skills.yaml` as `<key>/<skill>`, with categories, specific usage signals and any prerequisites or exclusions; its description is read from the `SKILL.md`, never copied. A collection's own skill-choosing guide goes in `catalog/guides.yaml` instead. Every tagged skill is a candidate on equal terms: there is no default or fallback list to edit.
5. `scripts/validate-catalog` must pass.
6. `scripts/skill-index` regenerates `docs/skill-index.md`; review its diff with the catalog change.

The router reads only the catalog, so no router change is needed.

Cataloging a skill makes it available for selection; it does not add it to every workflow. Communication, learning, retrospectives, context management, workflow selection and skill authoring have supporting categories. They are selected when the task needs them. Vendor orchestrators are for explicit requests for that vendor's workflow, rather than nested replacements for the router's own selection. Principles have narrow usage signals for the decisions they address.
