import chalk from "chalk";

/**
 * Display an informational message (blue color)
 * @param message The message to display
 */
export function info(message: string): void {
  console.log(chalk.blue(`ℹ️ ${message}`));
}

/**
 * Display a success message (green color)
 * @param message The message to display
 */
export function success(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Display a warning message (yellow color)
 * @param message The message to display
 */
export function warning(message: string): void {
  console.log(chalk.yellow(`⚠️ ${message}`));
}

/**
 * Display an error message (red color)
 * @param message The message to display
 */
export function error(message: string): void {
  console.error(chalk.red(`❌ ${message}`));
}
