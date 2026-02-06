import { error, info, success } from "./logger";
import { GeneratedPodcast } from "./types";
import { extractMetadataFromUrl } from "./services/articleMetadataService";
import { ArticleMetadata } from "./monday/types";
import { updateItemWithNotebookLmAudioLinkAndTitle } from "./monday/service";
import { audioGenerationTracker } from "./services/audioGenerationTrackingService";
import { INotebookLMAdapter, createNotebookLMAdapter } from "./services/notebookLMAdapter";
import { loadPodcastInstructions } from "./podcastConfig";

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

// ============================================================================
// Adapter-based implementation (CLI-based NotebookLM)
// ============================================================================

type GeneratePodcastOptions = {
  sourceUrl: string;
  existingNotebookUrl?: string;
  mondayItemId: string;
  adapter: INotebookLMAdapter;
};

/**
 * Generate podcast using the CLI adapter
 */
export async function generatePodcastWithAdapter(options: GeneratePodcastOptions): Promise<GenerationResult> {
  const { sourceUrl, existingNotebookUrl, mondayItemId, adapter } = options;

  if (!sourceUrl?.trim()) {
    const err = new Error("generatePodcast: 'sourceUrl' must be a non-empty string");
    return { success: false, reason: "error", error: err };
  }

  try {
    if (existingNotebookUrl?.trim()) {
      await adapter.openExistingNotebook(existingNotebookUrl);
    } else {
      await setupNewNotebookWithAdapter(adapter, sourceUrl, mondayItemId);
    }

    const { details, metadata } = await downloadAndAssembleDetailsWithAdapter(adapter, sourceUrl);
    return { success: true, data: { details, metadata } };
  } catch (err) {
    error(
      existingNotebookUrl
        ? `Failed to resume podcast from NotebookLM ${existingNotebookUrl}: ${err}`
        : `Failed to generate podcast from URL ${sourceUrl}: ${err}`
    );

    const errorInstance = err instanceof Error ? err : new Error(String(err));
    if (errorInstance.message.includes("Invalid resource detected by NotebookLM")) {
      return { success: false, reason: "invalid_resource", error: errorInstance };
    }

    return { success: false, reason: "error", error: errorInstance };
  }
}

async function setupNewNotebookWithAdapter(
  adapter: INotebookLMAdapter,
  sourceUrl: string,
  mondayItemId: string
): Promise<void> {
  info("Starting podcast generation from NotebookLM...");
  await audioGenerationTracker.validateRateLimit();

  info("Creating notebook and generating audio...");
  const { notebookUrl, title } = await adapter.createNotebookAndGenerateAudio(sourceUrl);

  await updateItemWithNotebookLmAudioLinkAndTitle(mondayItemId, notebookUrl, title);
  await audioGenerationTracker.recordAudioGeneration(sourceUrl);
}

async function downloadAndAssembleDetailsWithAdapter(
  adapter: INotebookLMAdapter,
  sourceUrl: string
): Promise<{ details: GeneratedPodcast; metadata: ArticleMetadata }> {
  info("Downloading generated podcast...");
  const audioPath = await adapter.downloadAudio();

  const fileType = adapter.outputsDirectMp3() ? "MP3" : "WAV";
  success(`Podcast ${fileType} file downloaded successfully from NotebookLM`);

  info("Extracting podcast details...");
  const [notebookLmDetails, metadata] = await Promise.all([
    adapter.getPodcastDetails(),
    extractMetadataFromUrl(sourceUrl),
  ]);

  const details: GeneratedPodcast = {
    metadata,
    notebookLmDetails,
    sourceUrls: [sourceUrl],
    stage: "generated",
    wavPath: audioPath, // May be MP3 for CLI, but field name kept for compatibility
  };

  return { details, metadata };
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize NotebookLM automation with CLI adapter
 */
export async function initializeNotebookLmWithAdapter(): Promise<{
  adapter: INotebookLMAdapter;
  cleanup: () => Promise<void>;
}> {
  const instructions = loadPodcastInstructions();
  const adapter = createNotebookLMAdapter("./temp", instructions);
  await adapter.initialize();

  return {
    adapter,
    cleanup: async () => {
      info("CLI adapter cleanup complete");
    },
  };
}
