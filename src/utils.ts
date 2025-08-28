import * as path from "path";
import * as fs from "fs";

/**
 * Find the project root directory by looking for package.json
 * @param startDir - Directory to start searching from, defaults to current working directory
 * @returns Path to the project root directory
 */
export function getProjectRoot(startDir: string = process.cwd()): string {
  if (startDir === path.dirname(startDir)) {
    throw new Error("package.json not found - reached filesystem root");
  }

  const packageJsonPath = path.join(startDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    return startDir;
  }
  return getProjectRoot(path.resolve(startDir, ".."));
}

export const safeJsonParse = <T>(value: string | null | undefined): T | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};
