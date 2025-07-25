import { Page } from "playwright";
import chalk from "chalk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initializeBrowser } from "./browserService";
import { error, info, success, warning } from "./logger";
import { Config, loadConfig } from "./configService";

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
const NOTEBOOKLM_URL = "https://notebooklm.google.com";

/**
 * Placeholder function for future audio generation capability
 */
function generateAudio(summary: string): void {
  warning("Audio generation not yet implemented.");
  console.log(chalk.gray("Summary text that would be converted to audio:"));
  console.log(chalk.gray(summary.substring(0, 100) + "..."));
}

/**
 * Main function to automate the summarization process
 */
async function summarizeDocument(input: string): Promise<void> {
  try {
    info("Starting summarization process...");

    // Load configuration
    const config = loadConfig();

    // Initialize browser
    const { browser, context } = await initializeBrowser({
      headless: false,
    });

    // Create a new page
    const page = await context.newPage();

    try {
      // Login to Google account
      await loginToGoogle(page, config);

      // Navigate to NotebookLM if not already there
      const currentUrl = page.url();
      if (!currentUrl.includes("notebooklm.google.com")) {
        info("Navigating to NotebookLM...");
        await page.goto(NOTEBOOKLM_URL);
      }

      // Allow time for the page to load
      await page.waitForLoadState("networkidle");

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
    } finally {
      // Close the browser
      await browser.close();
    }
  } catch (err) {
    error(`Error during summarization process: ${err}`);
    process.exit(1);
  }
}

/**
 * Handle notebook selection - create new or select existing
 */
async function handleNotebookSelection(page: Page): Promise<void> {
  try {
    info("Setting up notebook...");

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
        info("Selecting existing notebook...");
        await page.click('[data-testid="notebook-card"]');
        await page.waitForURL(/\/notebook\//, { timeout: 30000 });
      } else {
        // Create a new notebook
        info("Creating a new notebook...");
        await page.click('text="Create a new notebook"');
        await page.waitForURL(/\/notebook\//, { timeout: 30000 });

        // Wait for notebook setup to complete
        await page.waitForSelector('[data-testid="app-notebook"]', { timeout: 30000 });
      }
    }

    success("Notebook ready");
  } catch (err) {
    error(`Error setting up notebook: ${err}`);
    throw err;
  }
}

/**
 * Add a source (URL or text) to the notebook
 */
async function addSourceToNotebook(page: Page, input: string): Promise<void> {
  try {
    info("Adding source to notebook...");

    // Check if we need to add a source
    const addSourceButton = await page.getByRole("button", { name: /add source/i });
    await addSourceButton.click();

    // Wait for the source dialog to appear
    await page.waitForSelector('[data-testid="add-source-dialog"]', { timeout: 10000 });

    // Determine if input is a URL or text
    const isUrl = input.startsWith("http://") || input.startsWith("https://");

    if (isUrl) {
      // Input is a URL
      info("Adding URL as source...");
      // Click the URL tab if needed
      await page.getByText("URL").click();

      // Enter the URL
      await page.getByPlaceholder("Enter a URL").fill(input);
      await page.getByText("Add").click();
    } else {
      // Input is text
      info("Adding text as source...");
      // Click the text tab if needed
      await page.getByText("Text").click();

      // Enter the text
      await page.getByPlaceholder("Enter or paste text").fill(input);
      await page.getByText("Add").click();
    }

    // Wait for source to be added
    await page.waitForSelector('[data-testid="source-chip"]', { timeout: 30000 });

    success("Source added");
  } catch (err) {
    error(`Error adding source: ${err}`);
    throw err;
  }
}

/**
 * Ask a question and get the response
 */
async function askQuestionAndGetResponse(page: Page, question: string): Promise<string> {
  try {
    info(`Asking question: "${question}"...`);

    // Find and click on the question input field
    const questionInput = page.getByPlaceholder("Ask a question about your sources");
    await questionInput.click();
    await questionInput.fill(question);

    // Press Enter to submit the question
    await questionInput.press("Enter");

    // Wait for the response to appear
    info("Waiting for response...");
    await page.waitForSelector('[data-testid="chat-message-content"]', { timeout: 60000 });

    // Extract the response text
    const responseText = await page.evaluate(() => {
      const responseElement = document.querySelector('[data-testid="chat-message-content"]');
      return responseElement ? responseElement.textContent || "" : "";
    });

    success("Response received");
    return responseText;
  } catch (err) {
    error(`Error getting response: ${err}`);
    throw err;
  }
}

// Run the main function
summarizeDocument(argv.input).catch((err) => {
  error(`Failed to summarize document: ${err}`);
  process.exit(1);
});

/**
 * Login to Google account using provided credentials
 */
export async function loginToGoogle(page: Page, config: Config): Promise<void> {
  try {
    info("Logging in to Google account...");

    // Navigate to NotebookLM
    await page.goto("https://notebooklm.google.com");

    // Wait for Google login page to load
    await page.waitForSelector('input[type="email"]', { timeout: 30000 });

    // Enter email
    info("Entering email...");
    await page.fill('input[type="email"]', config.googleEmail);
    await page.click("#identifierNext");

    // Wait for password field to appear
    await page.waitForSelector('input[type="password"]', { timeout: 30000 });

    // Enter password
    info("Entering password...");
    await page.fill('input[type="password"]', config.googlePassword);
    await page.click("#passwordNext");

    // Wait for login to complete - check for NotebookLM UI or potential 2FA
    const has2FA = await Promise.race([
      page.waitForSelector('[data-testid="app-notebooks"]', { timeout: 30000 }).then(() => false),
      page
        .waitForSelector('input[type="tel"]', { timeout: 30000 })
        .then(() => true)
        .catch(() => false),
    ]);

    if (has2FA) {
      error("Two-factor authentication detected. This script doesn't support 2FA.");
      error("Please try using an account without 2FA.");
      throw new Error("Two-factor authentication required");
    }

    success("Successfully logged in to Google account");
  } catch (err) {
    error(`Login failed: ${err}`);
    throw new Error(`Failed to login: ${err}`);
  }
}
