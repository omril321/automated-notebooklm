import { Page } from "playwright";
import { initializeBrowser } from "./browserService";
import { loadConfig } from "./configService";
import { info, error } from "./logger";
import * as path from "path";
import { existsSync } from "fs";
import { ConvertedPodcast, UploadedPodcast, toUploadedPodcast } from "./types";

/**
 * Upload episode file and metadata to RedCircle
 * @param podcast Podcast metadata with MP3 file path
 * @returns Promise with uploaded podcast metadata
 */
export async function uploadEpisode(
  podcast: ConvertedPodcast,
  title: string,
  description: string
): Promise<UploadedPodcast> {
  validateConfiguration();

  if (!podcast.mp3Path) {
    throw new Error("MP3 path is required for upload");
  }

  validateFile(podcast.mp3Path);

  info(`Starting RedCircle upload for: ${title}`);
  info(`File path: ${path.resolve(podcast.mp3Path)}`);

  const { browser, page } = await initializeRedCircleAutomation();

  try {
    await loginToRedCircle(page);
    await selectPodcast(page);
    await createNewEpisode(page);
    await fillEpisodeDetails(page, title, description);
    await uploadAudioFile(page, podcast.mp3Path);
    await publishEpisode(page);

    info(`✅ Successfully uploaded episode: ${title}`);
    info("Episode is now processing on RedCircle.");

    // Get the current URL from the browser (podcast page)
    const podcastUrl = page.url();
    info(`📄 Podcast URL: ${podcastUrl}`);

    // Return metadata with updated upload status and URL
    return toUploadedPodcast(podcast, podcastUrl, title, description);
  } catch (err) {
    await handleUploadError(page, err);
    throw err;
  } finally {
    await browser.close();
  }
}

const DEFAULT_PAGE_TIMEOUT_MS = 30_000;
const EPISODE_PROCESSING_TIMEOUT_MS = 60_000;

async function initializeRedCircleAutomation() {
  const { browser, context } = await initializeBrowser();

  const page = await context.newPage();
  page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT_MS);

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
  if (!filePath || !existsSync(filePath)) {
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
  await page.fill('input[type="email"]', config.redCircleUser!);
  await page.fill('input[type="password"]', config.redCirclePassword!);

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

async function fillEpisodeDetails(page: Page, title: string, description: string): Promise<void> {
  info(`Setting episode title: ${title}`);
  await page.fill('input[placeholder="Episode Title"]', title);

  info("Setting episode description...");
  await page.fill('*[data-placeholder="Episode Description"]', description);
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
  await page.waitForSelector("text=Your episode is processing", { timeout: EPISODE_PROCESSING_TIMEOUT_MS });
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
