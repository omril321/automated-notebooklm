import { Page } from "playwright";
import { initializeBrowser } from "./browserService";
import { loadConfig } from "./configService";
import { info, error } from "./logger";
import * as path from "path";

export type EpisodeMetadata = {
  title: string;
  description: string;
  filePath: string;
};

/**
 * Upload episode file and metadata to RedCircle
 * @param metadata Episode metadata including title, description, and file path
 * @returns Promise<void> - throws on failure
 */
export async function uploadEpisode(metadata: EpisodeMetadata): Promise<void> {
  validateConfiguration();
  validateFile(metadata.filePath);

  info(`Starting RedCircle upload for: ${metadata.title}`);
  info(`File path: ${path.resolve(metadata.filePath)}`);

  const { browser, page } = await initialize();

  try {
    await loginToRedCircle(page);
    await selectPodcast(page);
    await createNewEpisode(page);
    await fillEpisodeDetails(page, metadata);
    await uploadAudioFile(page, metadata.filePath);
    await publishEpisode(page);

    info(`✅ Successfully uploaded episode: ${metadata.title}`);
    info("Episode is now processing on RedCircle.");
  } catch (err) {
    await handleUploadError(page, err);
    throw err;
  } finally {
    await browser.close();
  }
}

async function initialize() {
  const { browser, context } = await initializeBrowser();

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  return { browser, context, page };
}

function validateConfiguration(): void {
  const config = loadConfig();

  if (!config.redCircleUser || !config.redCirclePassword || !config.publishedPodcastName) {
    throw new Error(
      "Missing required RedCircle configuration. Please set RED_CIRCLE_USER, RED_CIRCLE_PASSWORD, and PUBLISHED_PODCAST_NAME environment variables."
    );
  }
}

function validateFile(filePath: string): void {
  if (!filePath || !require("fs").existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }
}

async function loginToRedCircle(page: Page): Promise<void> {
  const config = loadConfig();

  info("Navigating to RedCircle.com...");
  await page.goto("https://redcircle.com/");

  info("Clicking Log in...");
  await page.click('a:has-text("Log in")');

  info("Entering login credentials...");
  await page.fill('input[name="email"]', config.redCircleUser!);
  await page.fill('input[name="password"]', config.redCirclePassword!);

  info("Submitting login form...");
  await page.click('button[type="submit"]');
}

async function selectPodcast(page: Page): Promise<void> {
  const config = loadConfig();

  info(`Selecting podcast: ${config.publishedPodcastName}`);
  await page.click(`img[alt="${config.publishedPodcastName}"]`);
}

async function createNewEpisode(page: Page): Promise<void> {
  info("Navigating to Episodes section...");
  await page.click('h3:has-text("Episodes")');

  info("Creating new episode...");
  await page.click('button:has-text("New Episode")');
}

async function fillEpisodeDetails(page: Page, metadata: EpisodeMetadata): Promise<void> {
  info(`Setting episode title: ${metadata.title}`);
  await page.fill('input[placeholder="Episode Title"]', metadata.title);

  info("Setting episode description...");
  await page.fill('*[data-placeholder="Episode Description"]', metadata.description);
}

async function uploadAudioFile(page: Page, filePath: string): Promise<void> {
  const absoluteFilePath = path.resolve(filePath);

  info("Uploading audio file...");
  const fileInput = page.locator('input[type="file"][accept*=audio]');
  await fileInput.setInputFiles(absoluteFilePath);
}

async function publishEpisode(page: Page): Promise<void> {
  info("Publishing episode...");
  await page.click('button:has-text("Publish")');

  info("Waiting for confirmation...");
  await page.waitForSelector("text=Your episode is processing", { timeout: 60000 });
}

async function handleUploadError(page: Page, err: unknown): Promise<void> {
  const errorMessage = err instanceof Error ? err.message : String(err);
  error(`❌ RedCircle upload failed: ${errorMessage}`);

  // Take screenshot for debugging
  try {
    await page.screenshot({ path: `temp/redcircle-error-${Date.now()}.png` });
    info("Debug screenshot saved to temp/ directory");
  } catch (screenshotError) {
    error("Failed to capture debug screenshot");
  }
}
