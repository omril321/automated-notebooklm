import { Download } from "playwright";
import { NotebookLMService } from "./notebookLMService";
import { initializeBrowser } from "./browserService";
import { info, success } from "./logger";

export type PodcastResult = {
  wavPath?: string;
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

    info("Downloading generated podcast...");
    const wavPath = await service.downloadStudioPodcast();

    success("Podcast WAV file generated successfully from NotebookLM");
    return { wavPath };
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
