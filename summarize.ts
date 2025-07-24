import { chromium, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import chalk from "chalk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as readline from "readline";
import UserAgent from "user-agents";

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option("input", {
    description: "URL or text to summarize",
    type: "string",
    demandOption: true,
  })
  .help()
  .alias("help", "h")
  .parseSync();

// Constants
const AUTH_FILE_PATH = path.join(__dirname, "auth.json");
const NOTEBOOKLM_URL = "https://notebooklm.google.com";
const LOGIN_URL_PATTERN = /accounts\.google\.com/;

/**
 * Placeholder function for future audio generation capability
 */
function generateAudio(summary: string): void {
  console.log(chalk.yellow("Audio generation not yet implemented."));
  console.log(chalk.gray("Summary text that would be converted to audio:"));
  console.log(chalk.gray(summary.substring(0, 100) + "..."));
}

/**
 * Check if the authentication file exists and is valid
 */
function checkAuthFileExists(): boolean {
  try {
    if (!fs.existsSync(AUTH_FILE_PATH)) {
      console.error(chalk.red("⚠️  Authentication file not found."));
      console.error(chalk.red("Please run `yarn auth` to authenticate first."));
      return false;
    }

    // Additional validation could be added here
    const authData = fs.readFileSync(AUTH_FILE_PATH, "utf8");
    JSON.parse(authData); // Verify it's valid JSON

    return true;
  } catch (error) {
    console.error(chalk.red("⚠️  Invalid authentication file."));
    console.error(chalk.red("Please run `yarn auth` to authenticate again."));
    return false;
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

/**
 * Main function to automate the summarization process
 */
async function summarizeDocument(input: string): Promise<void> {
  // Check if auth file exists and is valid
  if (!checkAuthFileExists()) {
    process.exit(1);
  }

  console.log(chalk.blue("Starting summarization process..."));

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

  try {
    // Create a new context with the user agent and storage state
    const context = await browser.newContext({
      userAgent: ua,
      viewport: { width: 1920, height: 1080 }, // Define a specific viewport
      javaScriptEnabled: true,
      hasTouch: false,
      isMobile: false,
      locale: "en-US",
      storageState: AUTH_FILE_PATH, // Load cookies from the auth file
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

    // Navigate to NotebookLM
    console.log(chalk.blue("Navigating to NotebookLM..."));
    await page.goto(NOTEBOOKLM_URL);

    // Allow time for the page to load and handle any security checks
    console.log(chalk.yellow("Page is loading. If you see any security warnings, please handle them manually."));
    await waitForUserConfirmation(chalk.yellow("Press Enter to continue once the page is fully loaded: "));

    // Check if we're redirected to a login page, indicating invalid session
    const currentUrl = page.url();
    if (LOGIN_URL_PATTERN.test(currentUrl)) {
      console.error(chalk.red("⚠️  Login session expired or invalid."));
      console.error(chalk.red("Please run `yarn auth` to authenticate again."));
      await browser.close();
      process.exit(1);
    }

    // Create new notebook or use existing one
    await handleNotebookSelection(page);

    // Add input as a source
    await addSourceToNotebook(page, input);

    // Ask for summary
    const summary = await askQuestionAndGetResponse(page, "Summarize this document");

    // Output the summary
    console.log(chalk.green("\n=== SUMMARY ===\n"));
    console.log(summary);
    console.log(chalk.green("\n===============\n"));

    // Call the placeholder function for audio generation
    generateAudio(summary);

    // Close the browser
    await browser.close();
  } catch (error) {
    console.error(chalk.red("Error during summarization process:"), error);
    await browser.close();
    process.exit(1);
  }
}

/**
 * Handle notebook selection - create new or select existing
 */
async function handleNotebookSelection(page: Page): Promise<void> {
  try {
    console.log(chalk.blue("Setting up notebook..."));

    // Check if we're already in a notebook
    const isInNotebook = await page.evaluate(() => {
      return window.location.href.includes("/notebook/");
    });

    if (!isInNotebook) {
      // Check if there are existing notebooks to select
      const hasExistingNotebooks = await page.evaluate(() => {
        const notebookElements = document.querySelectorAll('[data-testid="notebook-card"]');
        return notebookElements.length > 0;
      });

      if (hasExistingNotebooks) {
        // Select the first notebook
        console.log(chalk.blue("Selecting existing notebook..."));
        await page.click('[data-testid="notebook-card"]');
        await page.waitForURL(/\/notebook\//, { timeout: 30000 });
      } else {
        // Create a new notebook
        console.log(chalk.blue("Creating a new notebook..."));
        await page.click('text="Create a new notebook"');
        await page.waitForURL(/\/notebook\//, { timeout: 30000 });

        // Wait for notebook setup to complete
        await page.waitForSelector('[data-testid="app-notebook"]', { timeout: 30000 });
      }
    }

    console.log(chalk.green("✓ Notebook ready"));
  } catch (error) {
    console.error(chalk.red("Error setting up notebook:"), error);
    throw error;
  }
}

/**
 * Add a source (URL or text) to the notebook
 */
async function addSourceToNotebook(page: Page, input: string): Promise<void> {
  try {
    console.log(chalk.blue("Adding source to notebook..."));

    // Check if we need to add a source
    const addSourceButton = await page.getByRole("button", { name: /add source/i });
    await addSourceButton.click();

    // Wait for the source dialog to appear
    await page.waitForSelector('[data-testid="add-source-dialog"]', { timeout: 10000 });

    // Determine if input is a URL or text
    const isUrl = input.startsWith("http://") || input.startsWith("https://");

    if (isUrl) {
      // Input is a URL
      console.log(chalk.blue("Adding URL as source..."));
      // Click the URL tab if needed
      await page.getByText("URL").click();

      // Enter the URL
      await page.getByPlaceholder("Enter a URL").fill(input);
      await page.getByText("Add").click();
    } else {
      // Input is text
      console.log(chalk.blue("Adding text as source..."));
      // Click the text tab if needed
      await page.getByText("Text").click();

      // Enter the text
      await page.getByPlaceholder("Enter or paste text").fill(input);
      await page.getByText("Add").click();
    }

    // Wait for source to be added
    await page.waitForSelector('[data-testid="source-chip"]', { timeout: 30000 });

    console.log(chalk.green("✓ Source added"));
  } catch (error) {
    console.error(chalk.red("Error adding source:"), error);
    throw error;
  }
}

/**
 * Ask a question and get the response
 */
async function askQuestionAndGetResponse(page: Page, question: string): Promise<string> {
  try {
    console.log(chalk.blue(`Asking question: "${question}"...`));

    // Find and click on the question input field
    const questionInput = page.getByPlaceholder("Ask a question about your sources");
    await questionInput.click();
    await questionInput.fill(question);

    // Press Enter to submit the question
    await questionInput.press("Enter");

    // Wait for the response to appear
    console.log(chalk.blue("Waiting for response..."));
    await page.waitForSelector('[data-testid="chat-message-content"]', { timeout: 60000 });

    // Extract the response text
    const responseText = await page.evaluate(() => {
      const responseElement = document.querySelector('[data-testid="chat-message-content"]');
      return responseElement ? responseElement.textContent || "" : "";
    });

    console.log(chalk.green("✓ Response received"));
    return responseText;
  } catch (error) {
    console.error(chalk.red("Error getting response:"), error);
    throw error;
  }
}

// Run the main function
summarizeDocument(argv.input).catch((err) => {
  console.error(chalk.red("Failed to summarize document:"), err);
  process.exit(1);
});
