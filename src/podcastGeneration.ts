import { NotebookLMService } from "./notebookLMService";
import { initializeBrowser } from "./browserService";
import { info, success } from "./logger";
import { GeneratedPodcast, toGeneratedPodcast } from "./types";

export type PodcastResult = {
  metadata: GeneratedPodcast;
};

/**
 * Generate podcast WAV file from URL using NotebookLM
 * @param url Source URL to generate podcast from
 * @returns Promise with podcast generation results
 */
export async function generatePodcastFromUrl(url: string): Promise<PodcastResult> {
  info("Starting podcast generation from NotebookLM...");

  const { browser, service } = await initialize();

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

    info("Extracting podcast metadata...");
    const intentionMetadata = await service.getPodcastMetadata(url);

    info("Downloading generated podcast...");
    const wavPath = await service.downloadStudioPodcast();

    success("Podcast WAV file generated successfully from NotebookLM");

    // Convert intention metadata to generated podcast metadata
    const generatedMetadata = toGeneratedPodcast(intentionMetadata, wavPath);

    return { metadata: generatedMetadata };
  } finally {
    await browser.close();
    info("Browser closed successfully");
  }
}

async function initialize() {
  const { browser, context } = await initializeBrowser({
    headless: false,
  });

  const page = await context.newPage();
  const service = new NotebookLMService(page);

  return { browser, context, page, service };
}
