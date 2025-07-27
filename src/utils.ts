import * as path from "path";
import * as fs from "fs";

/**
 * Find the project root directory by looking for package.json
 * @param startDir - Directory to start searching from, defaults to current working directory
 * @returns Path to the project root directory
 */
export function getProjectRoot(startDir: string = process.cwd()): string {
  // start from current dir, go up until finding a package.json file.
  const packageJsonPath = path.join(startDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    return startDir;
  }
  return getProjectRoot(path.resolve(startDir, ".."));
}
