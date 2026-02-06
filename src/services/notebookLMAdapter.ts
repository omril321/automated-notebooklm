import { info, success } from "../logger";
import { generateOutputPath } from "../downloadUtils";
import * as cliService from "./notebookLMCliService";

/**
 * Common interface for NotebookLM operations
 */
export interface INotebookLMAdapter {
  /**
   * Initialize the adapter (auth check for CLI)
   */
  initialize(): Promise<void>;

  /**
   * Clear context for next operation
   */
  navigateToMainPage(): Promise<void>;

  /**
   * Create a new notebook from a source URL and generate audio
   * @returns The NotebookLM URL and generated title
   */
  createNotebookAndGenerateAudio(sourceUrl: string): Promise<{ notebookUrl: string; title: string }>;

  /**
   * Open existing notebook and prepare for download
   * @param notebookUrl The existing NotebookLM notebook URL
   */
  openExistingNotebook(notebookUrl: string): Promise<void>;

  /**
   * Download the generated podcast audio
   * @returns Path to downloaded audio file (MP3)
   */
  downloadAudio(): Promise<string>;

  /**
   * Get podcast details (title and description)
   */
  getPodcastDetails(): Promise<{ title: string; description: string }>;

  /**
   * Check if this adapter outputs MP3 directly
   */
  outputsDirectMp3(): boolean;
}

/**
 * CLI-based implementation using notebooklm-py
 */
export class CliNotebookLMAdapter implements INotebookLMAdapter {
  private currentNotebookId: string | null = null;
  private lastGeneratedTitle: string = "Untitled Podcast";
  private tempDir: string;

  constructor(tempDir: string = "./temp") {
    this.tempDir = tempDir;
  }

  async initialize(): Promise<void> {
    // Check if CLI is installed
    const isInstalled = await cliService.isCliInstalled();
    if (!isInstalled) {
      throw new Error("notebooklm-py CLI is not installed. Run ./scripts/setup-nlm.sh first.");
    }

    // Check authentication
    const isAuthenticated = await cliService.checkAuth();
    if (!isAuthenticated) {
      throw new Error("Not authenticated with NotebookLM. Run ./scripts/nlm login first.");
    }

    info("CLI NotebookLM adapter initialized");
  }

  async navigateToMainPage(): Promise<void> {
    // Clear any active notebook context
    await cliService.clearContext();
    this.currentNotebookId = null;
  }

  async createNotebookAndGenerateAudio(sourceUrl: string): Promise<{ notebookUrl: string; title: string }> {
    // Generate a title based on timestamp (will be replaced by audio artifact's generated title)
    const tempTitle = `Podcast ${Date.now()}`;

    // Create notebook
    const notebookId = await cliService.createNotebook(tempTitle);
    this.currentNotebookId = notebookId;

    // Select the notebook
    await cliService.useNotebook(notebookId);

    // Set language to English
    await cliService.setLanguage("en");

    // Add URL source
    const sourceId = await cliService.addUrlSource(sourceUrl);

    // Wait for source to process
    await cliService.waitForSource(sourceId);

    // Generate audio (with wait)
    await cliService.generateAudio(undefined, true);

    // Get the title from the audio artifact (not the notebook summary)
    const artifact = await cliService.getLatestAudioArtifact();
    if (artifact?.title) {
      this.lastGeneratedTitle = artifact.title;
    } else {
      this.lastGeneratedTitle = tempTitle;
    }

    // Construct the NotebookLM URL
    const notebookUrl = `https://notebooklm.google.com/notebook/${notebookId}`;

    success(`Created notebook and generated audio: ${notebookUrl}`);
    return { notebookUrl, title: this.lastGeneratedTitle };
  }

  async openExistingNotebook(notebookUrl: string): Promise<void> {
    // Extract notebook ID from URL
    const match = notebookUrl.match(/notebook\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      throw new Error(`Invalid NotebookLM URL: ${notebookUrl}`);
    }

    const notebookId = match[1];
    this.currentNotebookId = notebookId;

    await cliService.useNotebook(notebookId);

    // Get the title from the audio artifact for existing notebooks too
    const artifact = await cliService.getLatestAudioArtifact();
    if (artifact?.title) {
      this.lastGeneratedTitle = artifact.title;
    }

    info(`Opened existing notebook: ${notebookId}`);
  }

  async downloadAudio(): Promise<string> {
    if (!this.currentNotebookId) {
      throw new Error("No active notebook. Create or open a notebook first.");
    }

    // Generate output path
    const outputPath = generateOutputPath(this.lastGeneratedTitle, this.tempDir);

    // Download audio (CLI outputs MP3 directly)
    await cliService.downloadAudio(outputPath);

    return outputPath;
  }

  async getPodcastDetails(): Promise<{ title: string; description: string }> {
    // Get summary from notebook for description
    let description = "";
    try {
      description = await cliService.getNotebookSummary();
    } catch {
      description = "Generated podcast";
    }

    return {
      title: this.lastGeneratedTitle,
      description,
    };
  }

  outputsDirectMp3(): boolean {
    return true; // CLI downloads MP3 directly
  }
}

/**
 * Create the NotebookLM adapter (CLI-based)
 * @param tempDir Temp directory for audio downloads
 */
export function createNotebookLMAdapter(tempDir: string = "./temp"): INotebookLMAdapter {
  info("Using CLI-based NotebookLM adapter");
  return new CliNotebookLMAdapter(tempDir);
}

/**
 * Type guard to check if using CLI adapter
 */
export function isCliAdapter(adapter: INotebookLMAdapter): adapter is CliNotebookLMAdapter {
  return adapter instanceof CliNotebookLMAdapter;
}
