import { Download, Page, expect } from "playwright/test";
import { error, info, success } from "./logger";
import { loadConfig } from "./configService";
import { saveToTempFile } from "./downloadUtils";

const TYPING_DELAY_EMAIL_MS = 56;
const TYPING_DELAY_PASSWORD_MS = 61;
const SELECTOR_TIMEOUT_MS = 30_000;
const POST_SUBMIT_WAIT_MS = 4_000;
const DOWNLOAD_START_WAIT_MS = 10_000;
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
    await passwordInput.waitFor({ state: "visible", timeout: AFTER_LOGIN_TIMEOUT });
    await passwordInput.pressSequentially(config.googlePassword, { delay: TYPING_DELAY_PASSWORD_MS });
    await this.page.click("#passwordNext");
    await this.waitForWelcomeMessage();

    success("Successfully logged in to Google account");
  }

  /**
   * Download the Studio Podcast
   * @returns Promise with the path to the downloaded file
   */
  async downloadStudioPodcast(): Promise<string> {
    info("Downloading Studio Podcast...");
    info("Waiting for download button to become available (may take several minutes)...");

    // it's not a class, it's a tag
    const audioArtifactLine = this.page.locator("artifact-library-item").getByLabel("More");

    // wait a long timeout for the audio artifact line to appear, and within it - the "More" button
    await expect(audioArtifactLine).toBeVisible({ timeout: AUDIO_GENERATION_TIMEOUT_MS });
    await expect(audioArtifactLine).toBeEnabled({ timeout: AUDIO_GENERATION_TIMEOUT_MS });

    await audioArtifactLine.click();

    const downloadButton = this.page.getByText("Download", { exact: true });
    await expect(downloadButton).toBeVisible({ timeout: AUDIO_GENERATION_TIMEOUT_MS });

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

  /**
   * Open an existing NotebookLM page and wait until it's ready post-login.
   */
  async openExistingNotebook(url: string): Promise<void> {
    info(`Opening existing NotebookLM page: ${url}`);
    await this.page.goto(url);
    await this.waitForWelcomeMessage();
  }

  private async waitForWelcomeMessage(): Promise<void> {
    info("Waiting for welcome message...");
    await this.page.getByAltText("NotebookLM Logo", { exact: true }).waitFor({ timeout: AFTER_LOGIN_TIMEOUT });
    success("NotebookLM page is ready");
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

  /**
   * Triggers Studio Podcast generation and returns the current NotebookLM page URL
   * after generation has started. The caller is responsible for persisting this URL
   * externally (e.g., to Monday via updateItemWithNotebookLmAudioLink).
   */
  async generateStudioPodcast(): Promise<string> {
    info("Starting to generate Studio Podcast...");

    // Audio Overview can appear in two locations:
    // 1. As a styled button outside studio panel (with .audio-overview-button class)
    // 2. As a clickable element inside studio panel (role="button" with Audio Overview text)
    // Both trigger the same functionality, so we'll try either one
    const audioOverviewButtonOutside = this.page.locator(".audio-overview-button");
    const audioOverviewButtonInside = this.page
      .locator(".studio-panel")
      .getByRole("button")
      .filter({ hasText: "Audio Overview" });

    const audioOverviewButton = audioOverviewButtonOutside.or(audioOverviewButtonInside);

    // Wait for button to be both visible AND clickable (not just visible)
    // The button can appear visually but take time to become interactive
    const selectedButton = audioOverviewButton.first();

    // Use Playwright's built-in expect assertions with auto-retry and waiting
    // These replace manual waitFor calls and are more reliable
    await expect(selectedButton).toBeVisible();
    await expect(selectedButton).toBeEnabled({ timeout: SELECTOR_TIMEOUT_MS });

    await selectedButton.click();

    success("Clicked on Audio Overview button");
    await this.assertGenerationStarted();
    // Return the current NotebookLM page URL so the caller can persist it externally
    return this.page.url();
  }

  /**
   * Extract podcast title from NotebookLM
   * @returns Promise with the extracted podcast title
   */
  private async extractPodcastTitle(): Promise<string> {
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
  private async extractPodcastDescription(): Promise<string> {
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

  /**
   * Assert that Studio Podcast generation has started by locating a visible element
   * containing the text "generating audio overview..." (case-insensitive).
   */
  private async assertGenerationStarted(): Promise<void> {
    info("Asserting Studio Podcast generation has started...");
    const generatingText = this.page.getByText(/generating\s+audio\s+overview\.{3}/i);
    await expect(generatingText).toBeVisible({ timeout: SELECTOR_TIMEOUT_MS });
    success("Detected 'generating audio overview...' signal");
  }
}
