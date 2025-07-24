import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import chalk from "chalk";
import UserAgent from "user-agents";
import * as readline from "readline";

/**
 * Script to handle manual login to Google NotebookLM and save the session.
 * This script opens a browser, navigates to NotebookLM, waits for the user
 * to log in, and then saves the session state to auth.json when the browser
 * is closed.
 */
async function loginAndSaveSession() {
  console.log(chalk.blue("Starting Google NotebookLM login process..."));
  console.log(chalk.yellow("Please log in with your Google account when the browser opens."));
  console.log(chalk.yellow("Once logged in, you will be prompted to save your session."));

  // Launch browser with arguments to bypass automation detection
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome", // Use installed Chrome browser
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-sandbox",
      "--start-maximized",
      "--disable-extensions",
      "--disable-popup-blocking",
      "--disable-notifications",
    ],
  });

  // Generate a realistic user agent
  const ua = new UserAgent({ deviceCategory: "desktop" }).toString();
  console.log(chalk.gray(`Using user agent: ${ua}`));

  // Create a new context with the user agent and a defined viewport
  const context = await browser.newContext({
    userAgent: ua,
    viewport: { width: 1920, height: 1080 }, // Define a specific viewport
    javaScriptEnabled: true,
    hasTouch: false,
    isMobile: false,
    locale: "en-US",
  });

  // Add script to override automation flags
  await context.addInitScript(() => {
    // Override the properties that detect automation
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });

    // Override permission requests
    const originalQuery = window.navigator.permissions.query;
    // @ts-ignore
    window.navigator.permissions.query = (parameters) => {
      if (parameters.name === "notifications") {
        return Promise.resolve({ state: "granted" });
      }
      return originalQuery(parameters);
    };

    // Empty plugins array
    // @ts-ignore
    Object.defineProperty(navigator, "plugins", { get: () => [] });
  });

  // Create a new page
  const page = await context.newPage();

  try {
    // Navigate to NotebookLM
    console.log(chalk.blue("Opening NotebookLM in browser..."));
    await page.goto("https://notebooklm.google.com");

    // Instructions for the user
    console.log(chalk.green("Browser opened. Please log in to your Google account."));
    console.log(chalk.yellow("Complete the login process in the browser window."));

    // Wait for body element to be sure page is loaded
    await page.waitForSelector("body", { timeout: 300000 }); // 5-minute timeout

    console.log(chalk.yellow("When you have successfully logged in:"));
    await waitForUserConfirmation("Press Enter in this terminal to save your session: ");

    // Save the session state to auth.json BEFORE closing the browser
    const authFilePath = path.join(__dirname, "auth.json");
    await context.storageState({ path: authFilePath });

    console.log(chalk.green("✓ Authentication completed successfully!"));
    console.log(chalk.green(`✓ Session saved to ${authFilePath}`));

    // Now it's safe to close the browser
    await browser.close();

    console.log(chalk.blue("You can now use the summarize command."));
  } catch (error) {
    console.error(chalk.red("Error during login process:"), error);
    await browser.close();
    process.exit(1);
  }
}

/**
 * Create readline interface for user interaction
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Wait for user confirmation via keyboard input
 */
function waitForUserConfirmation(prompt: string): Promise<void> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

// Run the login function
loginAndSaveSession().catch((err) => {
  console.error(chalk.red("Failed to complete login process:"), err);
  process.exit(1);
});
