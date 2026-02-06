# Podcast Instructions Guide

This guide helps you craft effective instructions for NotebookLM podcast generation.

## Overview

NotebookLM generates AI-hosted podcast conversations from source content. You can customize how the hosts discuss your material by providing instructions in `podcast-instructions.md` at the project root.

## Constraints

- **Character limit:** 500 characters maximum
- **Speakers:** Always 2 AI hosts (cannot be changed)
- **Applies to:** New podcast generations only (not resumes from existing notebooks)

## Effective Instruction Patterns

### Focus Pattern - Direct emphasis

- "Focus on practical implementation details"
- "Focus on key insights rather than background"

### Tone Pattern - Set conversation style

- "Keep it casual, like colleagues chatting"
- "Keep it professional but accessible"

### Audience Pattern - Specify who it's for

- "Target experienced developers"
- "Assume familiarity with the fundamentals"

### Expertise Pattern - Control depth

- "Skip basic explanations"
- "Define technical terms when introduced"

### Structure Pattern - Guide flow

- "Start with the main takeaway"
- "End with actionable next steps"

## Example Instructions

**For technical self-learning (221 chars):**

```
Keep it conversational but technical. Focus on practical applications and key insights I can apply immediately. Assume I'm a senior developer - skip basics but explain domain-specific concepts. Discuss trade-offs.
```

**For accessible overview (140 chars):**

```
Keep the tone casual and engaging. Focus on main ideas and why they matter. Explain technical concepts accessibly. End with key takeaways.
```

## Iteration Tips

1. Start simple with 1-2 patterns
2. Listen to results, adjust based on what's missing
3. Avoid over-specification - hosts need room for natural conversation
4. Keep notes on what works for different content types

## Verifying Instructions Were Applied

After generating, in NotebookLM web UI:

1. Open the notebook
2. Find Audio Overview artifact
3. Click three-dot menu → "View custom prompt"
