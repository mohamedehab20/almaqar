@AGENTS.md

# Documentation is part of every change

Every task that changes code in this repo must also update `development-almaqar/`, in the same commit as the code. Follow the checklist in `development-almaqar/README.md` (at minimum, a new entry at the top of the current phase in `04-milestones.md`). This applies to subagents too.

A hook in `.claude/settings.json` (`.claude/hooks/require-dev-docs.mjs`) enforces it: it denies `git commit` and blocks ending the turn while code changes exist without a docs change.
