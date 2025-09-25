#!/usr/bin/env node
/**
 * TypeScript Error Detection Hook
 * Checks for TypeScript compilation errors and reports them to Claude Code
 * Claude will automatically be notified to fix detected errors
 */

const { execSync } = require("child_process");
const path = require("path");

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
      // Not a file operation
      process.exit(0);
    }

    // Only check TypeScript files
    const ext = path.extname(filePath).toLowerCase();
    if (!ext.match(/\.(ts|tsx)$/)) {
      process.exit(0);
    }

    try {
      // Run TypeScript compiler with no emit to check for errors
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
      // Remove ANSI color codes for cleaner output
      const cleanedErrors = errorOutput.replace(/\u001b\[[0-9;]*m/g, "").trim();

      if (cleanedErrors) {
        // Count actual TypeScript errors
        const errorMatches = cleanedErrors.match(/: error TS\d+:/g) || [];
        const errorCount = errorMatches.length;

        console.log(JSON.stringify({
          continue: true,
          suppressOutput: false,
          additionalContext: `⚠️ TypeScript errors detected:\n\n${cleanedErrors}\n\nPlease fix these TypeScript errors.`,
          systemMessage: `⚠️ TypeScript compilation found ${errorCount} error(s). Claude has been notified to address them.`
        }));
      } else {
        // No actual errors, just compilation completed
        console.log(JSON.stringify({
          continue: true,
          suppressOutput: true,
          additionalContext: "TypeScript check completed successfully."
        }));
      }
    }

  } catch (parseError) {
    console.error("Failed to parse hook input:", parseError.message);
    process.exit(1);
  }
});