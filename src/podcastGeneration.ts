import { NotebookLMService } from "./notebookLMService";
import { captureDebugScreenshot, initializeBrowser } from "./browserService";
import { error, info, success } from "./logger";
import { GeneratedPodcast } from "./types";
import { extractMetadataFromUrl } from "./services/articleMetadataService";
import { ArticleMetadata } from "./monday/types";
import { audioGenerationTracker } from "./services/audioGenerationTrackingService";
import type { Browser, BrowserContext, Page } from "playwright";

export type PodcastResult = {
  details: GeneratedPodcast;
  metadata: ArticleMetadata;
};

const DEFAULT_HEADLESS = false;

/**
 * Generate podcast WAV file from URL using NotebookLM
 * @param url Source URL to generate podcast from
 * @returns Promise with podcast generation results
 */
export async function generatePodcastFromUrl(url: string): Promise<PodcastResult> {
  if (!url?.trim()) {
    throw new Error("generatePodcastFromUrl: 'url' must be a non-empty string");
  }

  // Validate rate limits before starting the process
  await audioGenerationTracker.validateRateLimit();

  info("Starting podcast generation from NotebookLM...");

  const { browser, page, service } = await initializeNotebookLmAutomation();

  try {
    info("Logging into Google account...");
    await service.loginToGoogle();

    info("Creating notebook and adding URL resource...");
    await service.createNewNotebook();
    await service.selectUrlResource();
    await service.addUrlResource(url);
    await service.submitUrlResources();
    await service.setLanguage();

    info("Generating studio podcast...");
    await service.generateStudioPodcast();

    await audioGenerationTracker.recordAudioGeneration(url);

    info("Downloading generated podcast...");
    const wavPath = await service.downloadStudioPodcast();

    success("Podcast WAV file generated successfully from NotebookLM");

    info("Extracting podcast details...");
    const [notebookLmDetails, metadata] = await Promise.all([service.getPodcastDetails(), extractMetadataFromUrl(url)]);

    const details: GeneratedPodcast = {
      metadata,
      notebookLmDetails,
      sourceUrls: [url],
      stage: "generated",
      wavPath,
    };

    return { details, metadata };
  } catch (err) {
    await captureDebugScreenshot(page, "podcast-generation");

    error(`Failed to generate podcast from URL ${url}: ${err}`);
    throw err;
  } finally {
    await browser.close();
    info("Browser closed successfully");
  }
}

async function initializeNotebookLmAutomation(): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
  service: NotebookLMService;
}> {
  const { browser, context } = await initializeBrowser({
    headless: DEFAULT_HEADLESS,
  });

  const page = await context.newPage();
  const service = new NotebookLMService(page);

  return { browser, context, page, service };
}
