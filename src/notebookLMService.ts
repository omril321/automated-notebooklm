import { Download, Page } from "playwright";
import { error, info, success } from "./logger";
import { loadConfig } from "./configService";
import { saveToTempFile } from "./downloadUtils";

const TYPING_DELAY_EMAIL_MS = 56;
const TYPING_DELAY_PASSWORD_MS = 61;
const SELECTOR_TIMEOUT_MS = 30_000;
const POST_SUBMIT_WAIT_MS = 4_000;
const DOWNLOAD_START_WAIT_MS = 2_000;
const AFTER_LOGIN_TIMEOUT = 300_000;
const TITLE_DESC_WAIT_MS = 10_000;
const AUDIO_GENERATION_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

/**
 * Service for automating interactions with Google NotebookLM
 */
export class NotebookLMService {
  private readonly page: Page;
  private readonly baseUrl = "https://notebooklm.google.com";

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

    await this.page.waitForSelector('input[type="email"]', { timeout: SELECTOR_TIMEOUT_MS });

    info("Entering email...");
    const emailInput = this.page.locator('input[type="email"]');
    await emailInput.pressSequentially(config.googleEmail, { delay: TYPING_DELAY_EMAIL_MS });
    await this.page.click("#identifierNext");
    await this.page.waitForTimeout(POST_SUBMIT_WAIT_MS);

    info("Entering password...");
    const passwordInput = this.page.locator('input[type="password"]');
    await passwordInput.waitFor({ state: "visible" });
    await passwordInput.pressSequentially(config.googlePassword, { delay: TYPING_DELAY_PASSWORD_MS });
    await this.page.click("#passwordNext");

    info("Waiting for welcome message...");
    await this.page.getByAltText("NotebookLM Logo", { exact: true }).waitFor({ timeout: AFTER_LOGIN_TIMEOUT }); // if captcha is shown, give time to fill manually

    success("Successfully logged in to Google account");
  }

  /**
   * Download the Studio Podcast
   * @returns Promise with the path to the downloaded file
   */
  async downloadStudioPodcast(): Promise<string> {
    info("Downloading Studio Podcast...");
    info("Waiting for download button to become available (may take several minutes)...");

    // Look for the more options menu button with a long timeout - it takes a while to appear
    const moreOptionsButton = this.page.locator(".artifact-button-content").locator("button", { hasText: "more_vert" });
    await moreOptionsButton.waitFor({ state: "visible" });

    await moreOptionsButton.click({ timeout: AUDIO_GENERATION_TIMEOUT_MS });

    // Wait for the download link to appear with a long timeout
    const downloadButton = this.page.getByText("Download", { exact: true });
    await downloadButton.waitFor({ state: "visible", timeout: SELECTOR_TIMEOUT_MS });

    let download: Download | null = null;
    this.page.once("download", (_download) => {
      info(`Download event received: ${_download.url()}`);
      _download
        .path()
        .then((path) => success(`Downloaded file to ${path}`))
        .catch((err) => error(`Error getting download path: ${err}`));
      download = _download;
    });
    await downloadButton.click();

    // Brief wait for download to start
    await this.page.waitForTimeout(DOWNLOAD_START_WAIT_MS);

    success("Studio Podcast download initiated");

    if (!download) {
      throw new Error("Something unexpected happened while downloading the Studio Podcast");
    }

    return await saveToTempFile(download);
  }

  async createNewNotebook(): Promise<void> {
    info("Clicking on create new notebook...");
    const createButton = this.page.getByLabel("Create new notebook", { exact: true });
    await createButton.click();
    success("Clicked on create new notebook button");
  }

  async selectUrlResource(): Promise<void> {
    info("Selecting URL resource type...");
    const websiteOption = this.page.getByText("Website", { exact: true });
    await websiteOption.click();

    success("URL resource type selected");
  }

  async addUrlResource(url: string): Promise<void> {
    info(`Adding URL resource: ${url}`);
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

  async setLanguage(language: "עברית" | "English" = "English"): Promise<void> {
    info(`Setting output language to ${language}...`);

    const settingsButton = this.page.getByText("Settings", { exact: true });
    await settingsButton.click();

    const outputLanguageOption = this.page.getByText("Output language", { exact: false });
    await outputLanguageOption.click();

    const languageCombobox = this.page.getByRole("combobox");
    await languageCombobox.click();

    const languageOption = this.page.getByText(language, { exact: true });
    await languageOption.click();

    const closeButton = this.page.getByRole("button", { name: "Close user settings" });
    await closeButton.click();

    success(`Language set to ${language}`);
  }

  async generateStudioPodcast(): Promise<void> {
    info("Starting to generate Studio Podcast...");

    const studioPanel = this.page.locator(".studio-panel");
    const audioOverviewButton = studioPanel.getByRole("button", { name: "Audio Overview" });
    await audioOverviewButton.waitFor({ state: "visible" });

    const customizationButton = audioOverviewButton.getByLabel("Open customization options");
    await customizationButton.waitFor({ state: "visible" });

    await audioOverviewButton.click();

    success("Clicked on Audio Overview button");
  }

  /**
   * Extract podcast title from NotebookLM
   * @returns Promise with the extracted podcast title
   */
  async extractPodcastTitle(): Promise<string> {
    info("Extracting podcast title from NotebookLM...");
    const titleElement = this.page.locator(".notebook-title");
    await titleElement.waitFor({ state: "visible", timeout: TITLE_DESC_WAIT_MS });

    const title = (await titleElement.textContent()) || "Untitled Podcast";
    const cleanTitle = title.trim();

    success(`Extracted podcast title: ${cleanTitle}`);
    return cleanTitle;
  }

  /**
   * Extract podcast description from NotebookLM
   * @returns Promise with the extracted podcast description
   */
  async extractPodcastDescription(): Promise<string> {
    info("Extracting podcast description from NotebookLM...");
    const descriptionElement = this.page.locator(".summary-content");
    await descriptionElement.waitFor({ state: "visible", timeout: TITLE_DESC_WAIT_MS });

    const description = (await descriptionElement.textContent()) || "";
    const cleanDescription = description.trim();

    success("Podcast description extracted successfully");
    return cleanDescription;
  }

  /**
   * Get complete details - title and description
   * @returns Promise with podcast details
   */
  async getPodcastDetails(): Promise<{ title: string; description: string }> {
    info("Retrieving podcast details from NotebookLM...");

    const [title, description] = await Promise.all([this.extractPodcastTitle(), this.extractPodcastDescription()]);

    return { title, description };
  }
}
