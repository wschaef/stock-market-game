# Agent notes

Standing instructions for Cursor agents on this repository.

## Source of truth

- **Workflow gates & artifact handoffs:** `.cursor/rules/workflow-gates.mdc`
- **Quality bar (TDD, YAGNI/KISS, everything as code):** `.cursor/rules/quality-bar.mdc`
- **Process overview & templates:** `docs/process/README.md`

Do not duplicate those rules here. Read them; follow them.

## Shipping

1. Approved requirements + plan artifacts before code.
2. Implement against the plan only.
3. Human reviews outcomes (checklist / tests / demo) and decides done & commit.
