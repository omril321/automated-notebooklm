import * as readline from "readline";

/**
 * Create readline interface for user interaction
 * @private Internal helper function
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Wait for user confirmation via keyboard input
 * @param prompt The message to display to the user
 * @returns Promise that resolves when the user provides input
 */
export function waitForConfirmation(prompt: string): Promise<void> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}
