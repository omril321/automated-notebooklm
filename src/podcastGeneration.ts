import { Download } from "playwright";
import { NotebookLMService } from "./notebookLMService";
import { initializeBrowser } from "./browserService";
import { error, info } from "./logger";

export async function generatePodcastFromUrl(url: string): Promise<Download[]> {
  try {
    info("Starting podcast generation process...");

    // Initialize browser
    const { browser, service } = await initialize();

    try {
      await service.loginToGoogle();
      await service.createNewNotebook();
      await service.selectUrlResource();
      await service.addUrlResource(url);
      await service.submitUrlResources();
      await service.setLanguage();
      await service.generateStudioPodcast();
      const download = await service.downloadStudioPodcast();

      return [download];
    } finally {
      await browser.close();
    }
  } catch (err) {
    error(`Error during podcast generation process: ${err}`);
    process.exit(1);
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
