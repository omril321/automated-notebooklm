import chalk from "chalk";

/**
 * Get the current time in HH:MM:SS format
 */
function ts(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `[${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;
}

/**
 * Display an informational message (blue color)
 * @param message The message to display
 */
export function info(message: string): void {
  console.log(chalk.blue(`${ts()} ℹ️ ${message}`));
}

/**
 * Display a success message (green color)
 * @param message The message to display
 */
export function success(message: string): void {
  console.log(chalk.green(`${ts()} ✅ ${message}`));
}

/**
 * Display a warning message (yellow color)
 * @param message The message to display
 */
export function warning(message: string): void {
  console.log(chalk.yellow(`${ts()} ⚠️ ${message}`));
}

/**
 * Display an error message (red color)
 * @param message The message to display
 */
export function error(message: string): void {
  console.error(chalk.red(`${ts()} ❌ ${message}`));
}
