#!/usr/bin/env node
// PostToolUse hook: type-check after TS edits and feed compiler errors back to Claude.
const { execFileSync } = require("child_process");
const path = require("path");

const TYPESCRIPT_FILE = /\.(ts|tsx)$/;
const ANSI_CODES = /\u001b\[[0-9;]*m/g;

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let filePath;
  try {
    filePath = JSON.parse(input).tool_input?.file_path;
  } catch {
    return;
  }
  if (!filePath || !TYPESCRIPT_FILE.test(path.extname(filePath))) return;

  try {
    execFileSync("yarn", ["--silent", "tsc", "--noEmit"], {
      cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}`.replace(ANSI_CODES, "").trim();
    if (!output) return;

    console.log(
      JSON.stringify({ decision: "block", reason: `TypeScript errors after editing ${filePath}:\n\n${output}` })
    );
  }
});
