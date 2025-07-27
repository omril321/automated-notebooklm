import { Download, Page } from "playwright";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initializeBrowser } from "./browserService";
import { error, info, success } from "./logger";
import { Config, loadConfig } from "./configService";

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option("url", {
    description: "URL to generate podcast from",
    type: "string",
    demandOption: true,
  })
  .help()
  .alias("help", "h")
  .parseSync();

// Constants
const NOTEBOOKLM_URL = "https://notebooklm.google.com";

/**
 * Main function to automate the summarization process
 */
async function generatePodcastFromUrl(url: string): Promise<Download[]> {
  try {
    info("Starting summarization process...");

    // Initialize browser
    const { browser, context } = await initializeBrowser({
      headless: false,
    });

    // Create a new page
    const page = await context.newPage();
    const downloads: Download[] = [];
    page.on("download", (download) => {
      download.path().then((path) => success(`Downloaded file to ${path}`));
      downloads.push(download);
    });

    try {
      await loginToGoogle(page);
      await createNewNotebook(page);
      await selectUrlResource(page);
      await addUrlResource(page, url);
      await submitUrlResources(page);
      await setLanguage(page);
      await generateStudioPodcast(page);
      await downloadStudioPodcast(page);
      return downloads;
    } finally {
      await browser.close();
    }
  } catch (err) {
    error(`Error during podcast generation process: ${err}`);
    process.exit(1);
  }
}

export async function loginToGoogle(page: Page): Promise<void> {
  try {
    info("Logging in to Google account...");

    const config = loadConfig();
    await page.goto(NOTEBOOKLM_URL);

    await page.waitForSelector('input[type="email"]', { timeout: 30000 });

    info("Entering email...");
    await page.fill('input[type="email"]', config.googleEmail);
    await page.click("#identifierNext");

    await page.waitForSelector('input[type="password"]', { timeout: 30000 });

    info("Entering password...");
    await page.fill('input[type="password"]', config.googlePassword);
    await page.click("#passwordNext");

    info("Waiting for welcome message...");
    await page.getByAltText("NotebookLM Logo", { exact: true }).waitFor({ timeout: 30000 });

    success("Successfully logged in to Google account");
  } catch (err) {
    error(`Login failed: ${err}`);
    throw new Error(`Failed to login: ${err}`);
  }
}

async function downloadStudioPodcast(page: Page): Promise<void> {
  info("Downloading Studio Podcast...");
  info("Waiting for download button to become available (may take several minutes)...");

  // Look for the more options menu button with a long timeout - it takes a while to appear
  const moreOptionsButton = page.locator("audio-player").locator("button", { hasText: "more_vert" });
  const fiveMinutesMs = 5 * 60 * 1000;
  await moreOptionsButton.waitFor({
    state: "visible",
    timeout: fiveMinutesMs,
  });

  await moreOptionsButton.click();

  // Wait for the download link to appear with a long timeout
  const downloadLink = page.locator("a[download]");
  await downloadLink.waitFor({
    state: "visible",
    timeout: 30000,
  });

  await downloadLink.click();

  // Brief wait for download to start
  await page.waitForTimeout(2000);

  success("Studio Podcast download initiated");
}

async function createNewNotebook(page: Page): Promise<void> {
  info("Clicking on create new notebook...");

  // Click on the create new notebook button
  const createButton = page.getByLabel("Create new notebook", { exact: true });
  await createButton.click();
  success("Clicked on create new notebook button");
}

async function selectUrlResource(page: Page): Promise<void> {
  info("Selecting URL resource type...");

  // Click on the Website option
  const websiteOption = page.getByText("Website", { exact: true });
  await websiteOption.click();

  success("URL resource type selected");
}

async function addUrlResource(page: Page, url: string): Promise<void> {
  info(`Adding URL resource: ${url}`);

  // Find and fill the URL input field
  const urlInput = page.locator('*[formcontrolname="newUrl"]');
  await urlInput.fill(url);

  success("URL resource added");
}

async function submitUrlResources(page: Page): Promise<void> {
  info("Submitting URL resources...");

  const submitButton = page.getByRole("button", { name: "Insert", exact: true });
  await submitButton.click();

  success("URL resources submitted successfully");
}

async function setLanguage(page: Page, language: "עברית" | "English" = "עברית"): Promise<void> {
  info(`Setting output language to ${language}...`);

  const settingsButton = page.getByText("Settings", { exact: true });
  await settingsButton.click();

  const outputLanguageOption = page.getByText("Output language", { exact: false });
  await outputLanguageOption.click();

  const languageCombobox = page.getByRole("combobox");
  await languageCombobox.click();

  const languageOption = page.getByText(language, { exact: false });
  await languageOption.click();

  const closeButton = page.getByRole("button", { name: "Close user settings" });
  await closeButton.click();

  success(`Language set to ${language}`);
}

async function generateStudioPodcast(page: Page): Promise<void> {
  info("Starting to generate Studio Podcast...");

  const generateButton = page.getByText("Generate", { exact: true });
  await generateButton.click();

  success("Clicked on generate button");
}

// Run the main function
generatePodcastFromUrl(argv.url).catch((err) => {
  error(`Failed to generate podcast from url: ${err}`);
  process.exit(1);
});
