@AGENTS.md

## Claude Code

- `.claude/settings.json` runs two PostToolUse hooks after every Write/Edit: Prettier formats the file, and `tsc --noEmit` reports type errors. Fix any reported type errors before moving on.
- Podcast style lives in `podcast-instructions.md` (max 500 chars). Read `prompts/podcast-instructions-guide.md` before changing it.
