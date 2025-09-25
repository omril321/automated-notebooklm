# Create Hook Command

Create and manage Claude Code hooks with intelligent suggestions based on the project setup.

## 📖 Official Documentation Reference
**Always consult the latest official docs for API updates:**
- **Primary Hooks Documentation**: https://docs.claude.com/en/docs/claude-code/hooks.md
- **Hooks Guide**: https://docs.claude.com/en/docs/claude-code/hooks-guide.md

⚠️ **Note**: If there are discrepancies between this command and the official docs, the official documentation takes precedence.

## Workflow

Example use cases for `/create-hooks` command:

### 1. Environment Analysis
- **Read existing hooks**: Check `~/.claude/settings.json`, `.claude/settings.json`, and `.claude/settings.local.json`
- **List current hooks**: Display all configured hooks by scope and event type
- **Detect project tooling**: Check for:
  - `package.json` (scripts, dependencies for prettier, eslint, typescript)
  - `tsconfig.json` (TypeScript configuration)
  - `.prettierrc`, `prettier.config.js` (Prettier configuration)
  - `.eslintrc.*` (ESLint configuration)
  - Other config files that indicate available tooling

### 2. Smart Suggestions
Based on detected tooling, suggest practical hooks:

**Code Quality (PreToolUse on Write/Edit)**:
- If prettier config found: "Format changed files with prettier"
- If eslint config found: "Lint changed files with eslint --fix"
- If TypeScript found: "Type-check changed files with tsc --noEmit"

**Security (PreToolUse on Bash)**:
- If git repo: "Prevent commits with secrets/credentials"
- "Block dangerous bash commands"

**Development Workflow**:
- If package.json has test script: "Run tests before commits"
- If build script exists: "Run build check before commits"

### 3. Interactive Creation
Ask user:
1. **Goal**: "What should this hook do?"
2. **Suggestion**: If applicable, offer relevant suggestions from analysis
3. **Scope**: Choose global, project, or project-local
4. **Event type**: PreToolUse, PostToolUse, Notification, UserPromptSubmit, Stop, SubagentStop, Precompact, SessionStart, SessionEnd
5. **Tool matcher**: Which tools should trigger the hook (Write, Edit, Bash, etc.)
6. **Hook response approach**: "How should this hook communicate results?"
   - **Exit codes only**: Simple (exit 0 = success, exit 2 = block in PreToolUse)
   - **JSON response**: Advanced control (blocking, context, decisions)
   - Guide based on complexity: simple pass/fail → exit codes, rich feedback → JSON
7. **Blocking behavior** (if relevant): "Should this stop operations when issues are found?"
   - PreToolUse: Can block operations (security, validation)
   - PostToolUse: Usually provide feedback only
8. **Claude integration** (CRITICAL): "Should Claude automatically see and fix issues this hook detects?"
   - If YES: Use `hookSpecificOutput.additionalContext` for error communication
   - If NO: Use `suppressOutput: true` for silent operation
9. **Context pollution**: "Should successful operations be silent to avoid noise?"
   - Recommend YES for formatting, routine checks
   - Recommend NO for security alerts, critical errors
10. **File filtering**: "What file types should this hook process?"
    - Include file extension checks in generated code
11. **Language**: JavaScript, TypeScript, or Bash (warn if other requested)

### 4. Hook Creation
- **Create hooks directory**: `~/.claude/hooks/` or `.claude/hooks/` based on scope
- **Generate script**: Create hooks script with:
  - Proper shebang and executable permissions
  - Template code for the chosen language
  - Project-specific commands (use detected config paths)
  - Comments explaining the hook's purpose
- **Update settings**: Add hooks configuration to appropriate settings.json
- **Use absolute paths**: Avoid relative paths to scripts and executables. Use `$CLAUDE_PROJECT_DIR` to reference project root.
- **Offer validation**: Ask if user wants to test the hook

### 5. Testing & Validation
**CRITICAL: Test both happy and sad paths:**

**Happy Path Testing:**
1. **Test expected success scenario** - create conditions where hook should pass
   - TypeScript: Write valid TypeScript code
   - Linting: Write properly formatted code
   - Security: Run safe commands

**Sad Path Testing:**
2. **Test expected failure scenario** - create conditions where hook should fail/warn
   - TypeScript: Introduce type errors
   - Linting: Write poorly formatted code
   - Security: Attempt dangerous operations

**Verification Steps:**
5. **Verify expected behavior**: Does it block/warn/provide context as intended?
<example>
- A hook is created to prevent deletion of a file
- Back up the original file, or create a dummy file to validate the correctness of the script
- Attempt to perform the action that the hook is designed to prevent (try to delete the protected file)
- Confirm that you are unable to perform that action.

### 6. Troubleshooting (When Things Go Wrong)
**If the hook doesn't work as expected, advise the user to perform the following checks:**

1. **Debug Mode**: Run `claude --debug hooks` to see detailed hook execution logs
2. **Check Registration**: Use `/hooks` command - is your hook listed?
3. **Start Simple**: If complex hook fails, test with basic echo command first
4. **Common Issues**:
   - Hook not registered: Check JSON syntax, restart Claude Code
   - Hook registered but not executing: Try wildcard matcher `"*"` for debugging
   - Scripts not running: Check file permissions (`chmod +x`), verify shebang line

**For detailed troubleshooting steps, see**: https://docs.claude.com/en/docs/claude-code/hooks#basic-troubleshooting

## 🚨 Critical Implementation Details (Battle-Tested)

### Hook Input Format (STDIN JSON)
❌ **Don't use**: `process.argv[2]` or command line arguments
✅ **Use**: Read JSON from stdin with this proven pattern:

```javascript
#!/usr/bin/env node
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("readable", () => {
  const chunk = process.stdin.read();
  if (chunk !== null) input += chunk;
});

process.stdin.on("end", () => {
  try {
    const hookData = JSON.parse(input);
    const filePath = hookData.tool_input?.file_path;

    if (!filePath) {
      process.exit(0); // Not a file operation
    }

    // Your hook logic here
  } catch (parseError) {
    console.error("Failed to parse hook input:", parseError.message);
    process.exit(1);
  }
});
```

### Hook Output Format (PostToolUse)
✅ **CORRECT**: Use top-level `additionalContext` and `systemMessage` for Claude communication

**For successful operations (avoid context pollution):**
```json
{
  "continue": true,
  "suppressOutput": true,
  "additionalContext": "Operation completed successfully - no issues detected."
}
```

**For error reporting (Claude should see and fix):**
```json
{
  "continue": true,
  "suppressOutput": false,
  "additionalContext": "TypeScript errors detected:\n\n[error details]\n\nPlease fix these TypeScript errors.",
  "systemMessage": "⚠️ TypeScript compilation found X error(s). Claude has been notified to address them."
}
```

<!--
    NOTE: I'm not sure if this works, unless you're talking about a secondary array than the one in settings.json
    It says clearly in the [docs](https://docs.claude.com/en/docs/claude-code/hooks#hook-execution-details) that hooks run in parallel:
    "Parallelization: All matching hooks run in parallel"
-->
### Hook Execution Order Best Practices
- **Array order = execution order** in settings.json
- **Validation BEFORE modification** (TypeScript check before Prettier)
- **Security checks BEFORE any file changes**

## ⚠️ Common Pitfalls (Based on Real Experience)

1. **Wrong input format** - Using argv instead of stdin JSON
2. **Wrong output format** - Using hookSpecificOutput instead of top-level additionalContext/systemMessage
3. **Context pollution** - Not using suppressOutput for successful operations
4. **Execution order** - Formatters running before validators
5. **Missing file filtering** - Not checking file extensions appropriately
6. **Exit codes** - Not using proper exit(0) for non-applicable operations
7. **Missing error counting** - Not providing specific error counts in systemMessage

## 📋 Proven Working Templates

### TypeScript Error Detection (PostToolUse)
```javascript
#!/usr/bin/env node
const { execSync } = require("child_process");

// [Include our proven stdin reading pattern above]

// Only check TypeScript files
if (!filePath.endsWith(".ts")) {
  process.exit(0);
}

try {
  execSync("npx tsc --noEmit --pretty", {
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
    cwd: process.cwd(),
  });

  // Success - no TypeScript errors
  console.log(JSON.stringify({
    continue: true,
    suppressOutput: true,
    additionalContext: "TypeScript compilation successful - no type errors detected."
  }));
} catch (execError) {
  const errorOutput = execError.stdout || execError.stderr || "";
  const cleanedErrors = errorOutput.replace(/\u001b\[[0-9;]*m/g, "").trim();

  if (cleanedErrors) {
    // Count actual errors
    const errorCount = (cleanedErrors.match(/: error TS/g) || []).length;

    console.log(JSON.stringify({
      continue: true,
      suppressOutput: false,
      additionalContext: `⚠️ TypeScript errors detected:\n\n${cleanedErrors}\n\nPlease fix these TypeScript errors.`,
      systemMessage: `⚠️ TypeScript compilation found ${errorCount} error(s). Claude has been notified to address them.`
    }));
  } else {
    console.log(JSON.stringify({
      continue: true,
      suppressOutput: true,
      additionalContext: "TypeScript check completed successfully."
    }));
  }
}
```

### Prettier Auto-Formatting (PostToolUse)
```javascript
#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");

// [Include our proven stdin reading pattern above]

// Only format JS/TS files
if (!filePath.endsWith(".ts") && !filePath.endsWith(".js")) {
  process.exit(0);
}

try {
  execSync(`npx prettier --write "${filePath}"`, {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  // Silent success to avoid context pollution
  console.log(JSON.stringify({
    continue: true,
    suppressOutput: true,
  }));
} catch (error) {
  console.error("❌ Prettier formatting failed:", error.message);
  // Don't block on formatting errors, just warn
  console.log(JSON.stringify({
    continue: true,
    suppressOutput: true
  }));
}
```

## Testing Methodology (Proven Approach)

<!-- Isn't this more or less a duplication of the information above? -->

### Happy Path Testing
1. **Create valid file** that should pass hook validation
2. **Edit file** to trigger hook
3. **Verify silent success** (suppressOutput: true)

### Sad Path Testing
1. **Create file with intentional errors** (TypeScript errors, formatting issues)
2. **Edit file** to trigger hook
3. **Verify Claude receives feedback** and can automatically fix issues
4. **Confirm hook provides actionable error messages**

### Verification Steps
1. **Check `/hooks` command** - Is hook registered?
2. **Run `claude --debug`** - See detailed hook execution
3. **Test both success and failure scenarios**
4. **Verify Claude can act on hook feedback automatically**

## Implementation Guidance

**📚 IMPORTANT: Always refer to the official documentation for:**
- Complete JSON input/output schemas
- Hook examples and templates
- Exit code behaviors (0, 2, etc.)
- All implementation details

**Use the official docs as the primary reference**: https://docs.claude.com/en/docs/claude-code/hooks#hook-implementation

## Notes
- Always use project's existing configuration files
- Focus on changed files rather than entire codebase
- Provide helpful error messages
- Support common development workflows
- **Follow official documentation guidelines exactly**

## 🔧 Recent Fixes Applied

**Critical Issues Resolved:**
1. **Output Format**: Fixed incorrect `hookSpecificOutput.additionalContext` recommendation → Use top-level `additionalContext` and `systemMessage`
2. **Error Counting**: Added proper error counting in TypeScript template using regex matching
3. **Success Responses**: Added `additionalContext` to successful operations for Claude awareness
4. **Common Pitfalls**: Updated to reflect correct vs incorrect output patterns
5. **Template Accuracy**: All working templates now match proven, tested implementations

**Result**: Generated hooks now properly communicate with Claude Code and provide accurate error feedback for proactive fixing.
