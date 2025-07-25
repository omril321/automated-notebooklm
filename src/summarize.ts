import { Page } from "playwright";
import * as fs from "fs";
import chalk from "chalk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initializeBrowser, AUTH_FILE_PATH } from "./browserService";
import { error, info, success, warning } from "./logger";

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
const LOGIN_URL_PATTERN = /accounts\.google\.com/;

/**
 * Placeholder function for future audio generation capability
 */
function generateAudio(summary: string): void {
  warning("Audio generation not yet implemented.");
  console.log(chalk.gray("Summary text that would be converted to audio:"));
  console.log(chalk.gray(summary.substring(0, 100) + "..."));
}

/**
 * Check if the authentication file exists and is valid
 */
function checkAuthFileExists(): boolean {
  try {
    if (!fs.existsSync(AUTH_FILE_PATH)) {
      error("Authentication file not found.");
      error("Please run `yarn auth` to authenticate first.");
      return false;
    }

    // Additional validation could be added here
    const authData = fs.readFileSync(AUTH_FILE_PATH, "utf8");
    JSON.parse(authData); // Verify it's valid JSON

    return true;
  } catch (err) {
    error("Invalid authentication file.");
    error("Please run `yarn auth` to authenticate again.");
    return false;
  }
}

/**
 * Main function to automate the summarization process
 */
async function summarizeDocument(input: string): Promise<void> {
  // Check if auth file exists and is valid
  if (!checkAuthFileExists()) {
    process.exit(1);
  }

  info("Starting summarization process...");

  // Initialize browser using the browser service with auth
  const { browser, context } = await initializeBrowser({
    useAuth: true,
  });

  try {
    // Create a new page
    const page = await context.newPage();

    // Navigate to NotebookLM
    info("Navigating to NotebookLM...");
    await page.goto(NOTEBOOKLM_URL);

    // Allow time for the page to load
    await page.waitForLoadState("networkidle");

    // Check if we're redirected to a login page, indicating invalid session
    const currentUrl = page.url();
    if (LOGIN_URL_PATTERN.test(currentUrl)) {
      error("Login session expired or invalid.");
      error("Please run `yarn auth` to authenticate again.");
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
  } catch (err) {
    error(`Error during summarization process: ${err}`);
    await browser.close();
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
