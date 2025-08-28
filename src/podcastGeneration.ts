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

type GeneratePodcastOptions = {
  sourceUrl: string;
  existingNotebookUrl?: string;
};

/**
 * Unified generator used for both new and existing NotebookLM flows
 */
export async function generatePodcast(options: GeneratePodcastOptions): Promise<PodcastResult> {
  const { sourceUrl, existingNotebookUrl } = options;
  if (!sourceUrl?.trim()) throw new Error("generatePodcast: 'sourceUrl' must be a non-empty string");

  const { browser, page, service } = await initializeNotebookLmAutomation();

  try {
    await service.loginToGoogle();
    if (existingNotebookUrl?.trim()) {
      await service.openExistingNotebook(existingNotebookUrl);
    } else {
      await setupNewNotebookFromSource(service, sourceUrl);
    }
    const { details, metadata } = await downloadAndAssembleDetails(service, sourceUrl);
    return { details, metadata };
  } catch (err) {
    await captureDebugScreenshot(page, existingNotebookUrl ? "podcast-existing" : "podcast-generation");
    error(
      existingNotebookUrl
        ? `Failed to resume podcast from NotebookLM ${existingNotebookUrl}: ${err}`
        : `Failed to generate podcast from URL ${sourceUrl}: ${err}`
    );
    throw err;
  } finally {
    await browser.close();
    info("Browser closed successfully");
  }
}

async function setupNewNotebookFromSource(service: NotebookLMService, sourceUrl: string): Promise<void> {
  info("Starting podcast generation from NotebookLM...");
  await audioGenerationTracker.validateRateLimit();

  info("Creating notebook and adding URL resource...");
  await service.createNewNotebook();
  await service.selectUrlResource();
  await service.addUrlResource(sourceUrl);
  await service.submitUrlResources();
  await service.setLanguage();

  info("Generating studio podcast...");
  await service.generateStudioPodcast();
  await audioGenerationTracker.recordAudioGeneration(sourceUrl);
}

async function downloadAndAssembleDetails(
  service: NotebookLMService,
  sourceUrl: string
): Promise<{ details: GeneratedPodcast; metadata: ArticleMetadata }> {
  info("Downloading generated podcast...");
  const wavPath = await service.downloadStudioPodcast();
  success("Podcast WAV file downloaded successfully from NotebookLM");
  info("Extracting podcast details...");
  const [notebookLmDetails, metadata] = await Promise.all([
    service.getPodcastDetails(),
    extractMetadataFromUrl(sourceUrl),
  ]);
  const details: GeneratedPodcast = {
    metadata,
    notebookLmDetails,
    sourceUrls: [sourceUrl],
    stage: "generated",
    wavPath,
  };
  return { details, metadata };
}

/**
 * Generate podcast WAV file from URL using NotebookLM
 * @param url Source URL to generate podcast from
 * @returns Promise with podcast generation results
 */
export async function generatePodcastFromUrl(url: string): Promise<PodcastResult> {
  return generatePodcast({ sourceUrl: url });
}

/**
 * Resume from an existing NotebookLM page that already generated audio.
 * Navigates to the provided NotebookLM URL, downloads the WAV, and extracts details.
 */
export async function generatePodcastFromExistingNotebook(
  notebookUrl: string,
  sourceUrl: string
): Promise<PodcastResult> {
  return generatePodcast({ sourceUrl, existingNotebookUrl: notebookUrl });
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
