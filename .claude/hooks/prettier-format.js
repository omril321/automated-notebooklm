#!/usr/bin/env node
// PostToolUse hook: format edited TS/JS files with the project's Prettier. Never blocks.
const { execFileSync } = require("child_process");
const path = require("path");

const FORMATTABLE = /\.(ts|tsx|js|jsx)$/;

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const filePath = JSON.parse(input).tool_input?.file_path;
    if (!filePath || !FORMATTABLE.test(path.extname(filePath))) return;

    execFileSync("yarn", ["--silent", "prettier", "--write", filePath], {
      cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
      stdio: "ignore",
    });
  } catch {
    // Formatting is best-effort; never interrupt the edit flow.
  }
});
