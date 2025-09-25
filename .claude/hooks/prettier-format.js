#!/usr/bin/env node
/**
 * Prettier Auto-Formatting Hook
 * Automatically formats TypeScript/JavaScript files after Write/Edit operations
 * Runs silently to avoid context pollution
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

    // Only format TypeScript and JavaScript files
    const ext = path.extname(filePath).toLowerCase();
    if (!ext.match(/\.(ts|js|tsx|jsx)$/)) {
      process.exit(0);
    }

    try {
      // Use the project's prettier configuration
      execSync(`npx prettier --write "${filePath}"`, {
        stdio: "pipe", // Suppress output for silent operation
        cwd: process.cwd(),
        encoding: "utf8",
      });

      // Silent success to avoid context pollution
      console.log(JSON.stringify({
        continue: true,
        suppressOutput: true,
        additionalContext: "File formatted successfully with Prettier."
      }));

    } catch (formatError) {
      // Don't block on formatting errors, just log and continue
      console.error("Prettier formatting failed:", formatError.message);
      console.log(JSON.stringify({
        continue: true,
        suppressOutput: true
      }));
    }

  } catch (parseError) {
    console.error("Failed to parse hook input:", parseError.message);
    process.exit(1);
  }
});