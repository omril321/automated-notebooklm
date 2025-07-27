import { Download, Page } from "playwright";
import { info, success } from "./logger";
import { loadConfig } from "./configService";

/**
 * Service for automating interactions with Google NotebookLM
 */
export class NotebookLMService {
  private page: Page;
  private readonly baseUrl = "https://notebooklm.google";

  /**
   * Creates a new NotebookLMService instance
   * @param page - The Playwright Page instance to use for interactions
   */
  constructor(page: Page) {
    this.page = page;
  }

  async loginToGoogle(): Promise<void> {
    info("Logging in to Google account...");

    const config = loadConfig();
    await this.page.goto(this.baseUrl);

    await this.page.waitForSelector('input[type="email"]', { timeout: 30000 });

    info("Entering email...");
    await this.page.fill('input[type="email"]', config.googleEmail);
    await this.page.click("#identifierNext");

    await this.page.waitForSelector('input[type="password"]', { timeout: 30000 });

    info("Entering password...");
    await this.page.fill('input[type="password"]', config.googlePassword);
    await this.page.click("#passwordNext");

    info("Waiting for welcome message...");
    await this.page.getByAltText("NotebookLM Logo", { exact: true }).waitFor({ timeout: 30000 });

    success("Successfully logged in to Google account");
  }

  async downloadStudioPodcast(): Promise<Download> {
    info("Downloading Studio Podcast...");
    info("Waiting for download button to become available (may take several minutes)...");

    // Look for the more options menu button with a long timeout - it takes a while to appear
    const moreOptionsButton = this.page.locator("audio-player").locator("button", { hasText: "more_vert" });
    const fiveMinutesMs = 5 * 60 * 1000;
    await moreOptionsButton.waitFor({
      state: "visible",
      timeout: fiveMinutesMs,
    });

    await moreOptionsButton.click();

    // Wait for the download link to appear with a long timeout
    const downloadLink = this.page.locator("a[download]");
    await downloadLink.waitFor({
      state: "visible",
      timeout: 30000,
    });

    let download: Download | null = null;
    this.page.once("download", (_download) => {
      _download.path().then((path) => success(`Downloaded file to ${path}`));
      download = _download;
    });
    await downloadLink.click();

    // Brief wait for download to start
    await this.page.waitForTimeout(2000);

    success("Studio Podcast download initiated");

    if (!download) {
      throw new Error("Something unexpected happened while downloading the Studio Podcast");
    }

    return download;
  }

  async createNewNotebook(): Promise<void> {
    info("Clicking on create new notebook...");

    // Click on the create new notebook button
    const createButton = this.page.getByLabel("Create new notebook", { exact: true });
    await createButton.click();
    success("Clicked on create new notebook button");
  }

  async selectUrlResource(): Promise<void> {
    info("Selecting URL resource type...");

    // Click on the Website option
    const websiteOption = this.page.getByText("Website", { exact: true });
    await websiteOption.click();

    success("URL resource type selected");
  }

  async addUrlResource(url: string): Promise<void> {
    info(`Adding URL resource: ${url}`);

    // Find and fill the URL input field
    const urlInput = this.page.locator('*[formcontrolname="newUrl"]');
    await urlInput.fill(url);

    success("URL resource added");
  }

  async submitUrlResources(): Promise<void> {
    info("Submitting URL resources...");

    const submitButton = this.page.getByRole("button", { name: "Insert", exact: true });
    await submitButton.click();

    success("URL resources submitted successfully");
  }

  async setLanguage(language: "עברית" | "English" = "עברית"): Promise<void> {
    info(`Setting output language to ${language}...`);

    const settingsButton = this.page.getByText("Settings", { exact: true });
    await settingsButton.click();

    const outputLanguageOption = this.page.getByText("Output language", { exact: false });
    await outputLanguageOption.click();

    const languageCombobox = this.page.getByRole("combobox");
    await languageCombobox.click();

    const languageOption = this.page.getByText(language, { exact: false });
    await languageOption.click();

    const closeButton = this.page.getByRole("button", { name: "Close user settings" });
    await closeButton.click();

    success(`Language set to ${language}`);
  }

  async generateStudioPodcast(): Promise<void> {
    info("Starting to generate Studio Podcast...");

    const generateButton = this.page.getByText("Generate", { exact: true });
    await generateButton.click();

    success("Clicked on generate button");
  }
}
