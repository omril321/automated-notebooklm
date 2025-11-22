import { NotebookLMService } from "./notebookLMService";
import { captureDebugScreenshot, initializeBrowser } from "./browserService";
import { error, info, success } from "./logger";
import { GeneratedPodcast } from "./types";
import { extractMetadataFromUrl } from "./services/articleMetadataService";
import { ArticleMetadata } from "./monday/types";
import { updateItemWithNotebookLmAudioLinkAndTitle } from "./monday/service";
import { audioGenerationTracker } from "./services/audioGenerationTrackingService";
import type { Browser, BrowserContext, Page } from "playwright";

export type PodcastResult = {
  details: GeneratedPodcast;
  metadata: ArticleMetadata;
};

type GenerationSuccess = {
  success: true;
  data: PodcastResult;
};

type GenerationFailure = {
  success: false;
  reason: "invalid_resource" | "error";
  error: Error;
};

export type GenerationResult = GenerationSuccess | GenerationFailure;

const DEFAULT_HEADLESS = false;

type GeneratePodcastOptions = {
  sourceUrl: string;
  existingNotebookUrl?: string;
  mondayItemId: string;
  service: NotebookLMService;
};

/**
 * Unified generator using existing NotebookLM service
 * Assumes service is already logged in and ready
 */
export async function generatePodcast(options: GeneratePodcastOptions): Promise<GenerationResult> {
  const { sourceUrl, existingNotebookUrl, mondayItemId, service } = options;
  if (!sourceUrl?.trim()) {
    const err = new Error("generatePodcast: 'sourceUrl' must be a non-empty string");
    return { success: false, reason: "error", error: err };
  }

  try {
    if (existingNotebookUrl?.trim()) {
      await service.openExistingNotebook(existingNotebookUrl);
    } else {
      await setupNewNotebookFromSource(service, sourceUrl, mondayItemId);
    }
    const { details, metadata } = await downloadAndAssembleDetails(service, sourceUrl);
    return { success: true, data: { details, metadata } };
  } catch (err) {
    // Capture debug screenshot for troubleshooting
    const page = (service as any).page; // Access underlying page for screenshot
    if (page) {
      await captureDebugScreenshot(page, existingNotebookUrl ? "podcast-existing" : "podcast-generation");
    }

    error(
      existingNotebookUrl
        ? `Failed to resume podcast from NotebookLM ${existingNotebookUrl}: ${err}`
        : `Failed to generate podcast from URL ${sourceUrl}: ${err}`
    );

    // Check if this is an invalid resource error
    const errorInstance = err instanceof Error ? err : new Error(String(err));
    if (errorInstance.message.includes("Invalid resource detected by NotebookLM")) {
      return { success: false, reason: "invalid_resource", error: errorInstance };
    }

    return { success: false, reason: "error", error: errorInstance };
  }
}

async function setupNewNotebookFromSource(
  service: NotebookLMService,
  sourceUrl: string,
  mondayItemId: string
): Promise<void> {
  info("Starting podcast generation from NotebookLM...");
  await audioGenerationTracker.validateRateLimit();

  info("Creating notebook and adding URL resource...");
  await service.createNewNotebook();
  await service.selectUrlResource();
  await service.addUrlResource(sourceUrl);
  await service.submitUrlResources();
  await service.setLanguage();

  info("Generating studio podcast...");
  const { url: notebookUrl, title } = await service.generateStudioPodcast();
  await updateItemWithNotebookLmAudioLinkAndTitle(mondayItemId, notebookUrl, title);
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

export async function initializeNotebookLmAutomation(): Promise<{
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
