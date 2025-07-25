import { Browser, BrowserContext, Page } from "playwright";
import { initializeBrowser, AUTH_FILE_PATH } from "./browserService";
import { info, success, warning, error } from "./logger";
import { waitForConfirmation } from "./cliService";

/**
 * Script to handle manual login to Google NotebookLM and save the session.
 * This script opens a browser, navigates to NotebookLM, waits for the user
 * to log in, and then saves the session state to auth.json when the browser
 * is closed.
 */
async function loginAndSaveSession(): Promise<void> {
  displayStartupMessages();
  const { browser, context, page } = await initializeBrowserSession();

  try {
    await navigateToNotebookLM(page);
    await waitForUserLogin(page);
    await saveAuthenticationSession(context);
    await closeBrowser(browser);
    displayCompletionMessage();
  } catch (err) {
    handleError(err, browser);
  }
}

/**
 * Display initial startup messages to the user
 */
function displayStartupMessages(): void {
  info("Starting Google NotebookLM login process...");
  warning("Please log in with your Google account when the browser opens.");
  warning("Once logged in, you will be prompted to save your session.");
}

/**
 * Initialize browser and create a new page
 */
async function initializeBrowserSession(): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  // Initialize browser using the browser service
  const { browser, context } = await initializeBrowser();
  // Create a new page
  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * Navigate to NotebookLM and display instructions
 */
async function navigateToNotebookLM(page: Page): Promise<void> {
  info("Opening NotebookLM in browser...");
  await page.goto("https://notebooklm.google.com");

  success("Browser opened. Please log in to your Google account.");
  warning("Complete the login process in the browser window.");
}

/**
 * Wait for the user to log in
 */
async function waitForUserLogin(page: Page): Promise<void> {
  // Wait for body element to be sure page is loaded
  await page.waitForSelector("body", { timeout: 300000 }); // 5-minute timeout

  warning("When you have successfully logged in:");
  await waitForConfirmation("Press Enter in this terminal to save your session: ");
}

/**
 * Save the authentication session to a file
 */
async function saveAuthenticationSession(context: BrowserContext): Promise<void> {
  await context.storageState({ path: AUTH_FILE_PATH });
  success("Authentication completed successfully!");
  success(`Session saved to ${AUTH_FILE_PATH}`);
}

/**
 * Close the browser instance
 */
async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}

/**
 * Display completion message
 */
function displayCompletionMessage(): void {
  info("You can now use the summarize command.");
}

/**
 * Handle errors during the login process
 */
function handleError(err: unknown, browser: Browser): void {
  error(`Error during login process: ${err}`);
  browser.close().catch(console.error);
  process.exit(1);
}

// Run the login function
loginAndSaveSession().catch((err) => {
  error(`Failed to complete login process: ${err}`);
  process.exit(1);
});
