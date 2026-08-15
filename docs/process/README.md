# Process artifacts

This folder is the **handoff contract** between stages. Chat is for discussion; approved truth lives here (and in Cursor Plans saved to the workspace).

## Stages

1. **Requirements** → `FEATURES/<id>-requirements.md` (human agrees)
2. **Plan** → `FEATURES/<id>-plan.md` and/or Cursor Plan saved to workspace (human approves)
3. **Architecture** (only when needed) → `DECISIONS/<id>-adr.md`
4. **Implement** → branch + tests; consume **only** the approved artifact files (`@` them in a fresh chat)
5. **Review / done** → checklist + test summary (+ demo if UI); **human** accepts and commits

## Rules of handoff

- Do not pass a full debate transcript into the next stage.
- New chat / new stage = approved artifacts only.
- Standing quality and gates live in `.cursor/rules/` (always applied). This folder holds **per-feature** content.
- Templates start with `_template-*.md`. Copy and rename; never edit templates for a feature.

## Templates

| Template | Use |
| --- | --- |
| `FEATURES/_template-requirements.md` | Feature requirements + acceptance checklist |
| `FEATURES/_template-plan.md` | Implementation plan for approval |
| `DECISIONS/_template-adr.md` | Architecture / stack decision record |

## Naming

- Feature id: short kebab-case, e.g. `v0.1-buy-sell`, `harness-setup`
- Files: `<id>-requirements.md`, `<id>-plan.md`, `<id>-adr.md`
