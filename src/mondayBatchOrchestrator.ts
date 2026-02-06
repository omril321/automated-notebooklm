import { generatePodcastWithAdapter, initializeNotebookLmWithAdapter, GenerationResult } from "./singleRunGeneration";
import { INotebookLMAdapter } from "./services/notebookLMAdapter";
import { convertToMp3 } from "./audioConversionService";
import { uploadEpisode, initializePersistentRedCircleSession, navigateToMainPodcastPage } from "./redCircleService";
import { error, info, success, warning } from "./logger";
import { GeneratedPodcast } from "./types";
import { getPodcastCandidates, updateItemWithGeneratedPodcastUrl, markItemAsNonPodcastable } from "./monday/service";
import { audioGenerationTracker } from "./services/audioGenerationTrackingService";
import { finalizePodcastDetails } from "./services/articleMetadataService";
import { ArticleCandidate } from "./monday/types";
import { Page } from "playwright";

const DEFAULT_DOWNLOADS_DIR = "./downloads";
const NEW_GENERATION_DELAY_MS = 10_000; // 10 seconds between new generations

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ProcessingError = {
  url: string;
  phase: "generation" | "upload" | "invalid_resource";
  message: string;
};

type GenerationResults = {
  results: Array<{ details: GeneratedPodcast; candidate: ArticleCandidate }>;
  errors: ProcessingError[];
};

type BatchResult = {
  totalCandidates: number;
  successfulGenerations: number;
  successfulUploads: number;
  errors: ProcessingError[];
};

async function handleGenerationFailure(
  result: GenerationResult,
  candidate: ArticleCandidate,
  index: number,
  total: number
): Promise<ProcessingError> {
  if (result.success) {
    throw new Error("handleGenerationFailure called with successful result");
  }
  if (result.reason === "invalid_resource") {
    warning(`⚠️  Invalid resource detected ${index + 1}/${total}: ${result.error.message}`);

    try {
      await markItemAsNonPodcastable(candidate.id);
    } catch (mondayErr) {
      error(`Failed to mark item ${candidate.id} as non-podcastable: ${mondayErr}`);
    }

    return { url: candidate.sourceUrl, phase: "invalid_resource", message: result.error.message };
  } else {
    error(`❌ Failed ${index + 1}/${total}: ${result.error.message}`);
    return { url: candidate.sourceUrl, phase: "generation", message: result.error.message };
  }
}

// ============================================================================
// CLI-based processing
// ============================================================================

async function processSingleCandidate(
  candidate: ArticleCandidate,
  adapter: INotebookLMAdapter
): Promise<GenerationResult> {
  await adapter.navigateToMainPage();

  return await generatePodcastWithAdapter({
    sourceUrl: candidate.sourceUrl,
    existingNotebookUrl: candidate.generatedAudioLink,
    mondayItemId: candidate.id,
    adapter,
  });
}

async function processAudioReadyCandidates(
  candidates: ArticleCandidate[],
  adapter: INotebookLMAdapter
): Promise<GenerationResults> {
  const results: Array<{ details: GeneratedPodcast; candidate: ArticleCandidate }> = [];
  const errors: ProcessingError[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    info(`Processing audio-ready ${i + 1}/${candidates.length}: ${candidate.sourceUrl}`);

    const result = await processSingleCandidate(candidate, adapter);
    if (result.success) {
      results.push({ details: result.data.details, candidate });
      success(`✅ Generated audio-ready ${i + 1}/${candidates.length}`);
    } else {
      const processingError = await handleGenerationFailure(result, candidate, i, candidates.length);
      errors.push(processingError);
    }
  }

  return { results, errors };
}

async function processNewGenerationCandidates(
  candidates: ArticleCandidate[],
  adapter: INotebookLMAdapter
): Promise<GenerationResults> {
  const results: Array<{ details: GeneratedPodcast; candidate: ArticleCandidate }> = [];
  const errors: ProcessingError[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    info(`Processing new generation ${i + 1}/${candidates.length}: ${candidate.sourceUrl}`);

    const result = await processSingleCandidate(candidate, adapter);
    if (result.success) {
      results.push({ details: result.data.details, candidate });
      success(`✅ Generated new ${i + 1}/${candidates.length}`);
    } else {
      const processingError = await handleGenerationFailure(result, candidate, i, candidates.length);
      errors.push(processingError);
    }

    if (i < candidates.length - 1) {
      info(`⏱️  Waiting ${NEW_GENERATION_DELAY_MS / 1000} seconds before next generation...`);
      await sleep(NEW_GENERATION_DELAY_MS);
    }
  }

  return { results, errors };
}

async function executeNotebookLMProcessing(
  audioReady: ArticleCandidate[],
  regular: ArticleCandidate[],
  adapter: INotebookLMAdapter
): Promise<GenerationResults> {
  info("✅ NotebookLM session initialized");

  const audioResults = await processAudioReadyCandidates(audioReady, adapter);
  const regularResults = await processNewGenerationCandidates(regular, adapter);

  return {
    results: [...audioResults.results, ...regularResults.results],
    errors: [...audioResults.errors, ...regularResults.errors],
  };
}

async function processNotebookLMGenerations(
  audioReady: ArticleCandidate[],
  regular: ArticleCandidate[]
): Promise<GenerationResults> {
  if (audioReady.length === 0 && regular.length === 0) {
    return { results: [], errors: [] };
  }

  info(`🎵 Starting NotebookLM generation phase:`);
  info(`  🔊 ${audioReady.length} audio-ready candidates (no delays)`);
  info(`  🆕 ${regular.length} new generation candidates (with delays)`);

  const { adapter, cleanup } = await initializeNotebookLmWithAdapter();

  try {
    return await executeNotebookLMProcessing(audioReady, regular, adapter);
  } finally {
    await cleanup();
    info("🚪 NotebookLM session closed");
  }
}

// ============================================================================
// Upload processing (uses Playwright for RedCircle)
// ============================================================================

async function processSingleUpload(
  details: GeneratedPodcast,
  candidate: ArticleCandidate,
  page: Page
): Promise<string> {
  const { title, description } = finalizePodcastDetails(
    details.metadata,
    details.notebookLmDetails,
    candidate.sourceUrl,
    candidate.id,
    candidate.name
  );

  const converted = await convertToMp3(details, { outputDir: DEFAULT_DOWNLOADS_DIR });

  const uploaded = await uploadEpisode(converted, title, description, page);

  await updateItemWithGeneratedPodcastUrl(candidate.id, uploaded.podcastUrl);

  return title;
}

async function processUploadsBatch(
  generationResults: Array<{ details: GeneratedPodcast; candidate: ArticleCandidate }>,
  page: Page
): Promise<ProcessingError[]> {
  const errors: ProcessingError[] = [];

  for (let i = 0; i < generationResults.length; i++) {
    const { details, candidate } = generationResults[i];
    info(`Uploading ${i + 1}/${generationResults.length}: ${candidate.sourceUrl}`);

    try {
      await navigateToMainPodcastPage(page);

      const title = await processSingleUpload(details, candidate, page);
      success(`✅ Uploaded ${i + 1}/${generationResults.length}: ${title}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ url: candidate.sourceUrl, phase: "upload", message });
      error(`❌ Failed upload ${i + 1}/${generationResults.length}: ${message}`);
    }
  }

  return errors;
}

async function processRedCircleUploads(
  generationResults: Array<{ details: GeneratedPodcast; candidate: ArticleCandidate }>
): Promise<ProcessingError[]> {
  if (generationResults.length === 0) {
    info("No successful generations to upload");
    return [];
  }

  info(`⬆️  Starting RedCircle upload phase (${generationResults.length} episodes)`);

  const { browser: redCircleBrowser, page: redCirclePage } = await initializePersistentRedCircleSession();

  try {
    return await processUploadsBatch(generationResults, redCirclePage);
  } finally {
    await redCircleBrowser.close();
    info("🚪 RedCircle browser session closed");
  }
}

// ============================================================================
// Reporting and utilities
// ============================================================================

function reportProcessingResults(results: BatchResult): void {
  const { totalCandidates, successfulGenerations, successfulUploads, errors } = results;

  success(`\n📊 Batch Processing Complete:`);
  success(`  📋 Total candidates: ${totalCandidates}`);
  success(`  🎵 Successful generations: ${successfulGenerations}/${totalCandidates}`);
  success(`  ⬆️  Successful uploads: ${successfulUploads}/${successfulGenerations}`);

  const invalidResources = errors.filter((e) => e.phase === "invalid_resource");
  const generationErrors = errors.filter((e) => e.phase === "generation");
  const uploadErrors = errors.filter((e) => e.phase === "upload");

  if (invalidResources.length > 0) {
    warning(`\n⚠️  Invalid Resources (${invalidResources.length} total - marked as non-podcastable):`);
    invalidResources.forEach((err) => {
      warning(`    • ${err.url}`);
    });
  }

  const otherErrors = [...generationErrors, ...uploadErrors];
  if (otherErrors.length > 0) {
    error(`\n❌ Processing Errors (${otherErrors.length} total):`);

    if (generationErrors.length > 0) {
      error(`\n  🎵 Generation Failures (${generationErrors.length}):`);
      generationErrors.forEach((err) => {
        error(`    • ${err.url}: ${err.message}`);
      });
    }

    if (uploadErrors.length > 0) {
      error(`\n  ⬆️  Upload Failures (${uploadErrors.length}):`);
      uploadErrors.forEach((err) => {
        error(`    • ${err.url}: ${err.message}`);
      });
    }
  } else if (invalidResources.length === 0) {
    success(`\n🎉 All candidates processed successfully!`);
  }
}

function partitionCandidates(
  candidates: ArticleCandidate[],
  remainingSlots: number
): {
  audioReady: ArticleCandidate[];
  regularToProcess: ArticleCandidate[];
} {
  const audioReady = candidates.filter((c) => Boolean(c.generatedAudioLink));
  const regular = candidates.filter((c) => !c.generatedAudioLink);
  const regularToProcess = remainingSlots > 0 ? regular.slice(0, remainingSlots) : [];

  if (regular.length > regularToProcess.length) {
    info(`⚠️  Rate limit: Processing ${regularToProcess.length}/${regular.length} new generation candidates`);
  }

  return { audioReady, regularToProcess };
}

function logBatchStart(audioReady: ArticleCandidate[], regularToProcess: ArticleCandidate[]): void {
  const totalCandidates = audioReady.length + regularToProcess.length;
  info(`\n🚀 Starting optimized batch processing:`);
  info(`  📋 Total candidates: ${totalCandidates}`);
  info(`  🔊 ${audioReady.length} Audio-ready: ${audioReady.map((c) => c.metadata?.title || c.name).join(", ")}`);
  info(
    `  🆕 ${regularToProcess.length} New generations: ${regularToProcess
      .map((c) => c.metadata?.title || c.name)
      .join(", ")}`
  );
  info(`  🔧 Using CLI-based NotebookLM (notebooklm-py)`);
}

async function processCandidatesPipeline(
  audioReady: ArticleCandidate[],
  regular: ArticleCandidate[]
): Promise<BatchResult> {
  const totalCandidates = audioReady.length + regular.length;

  // Phase 1: NotebookLM generation
  const { results: generationResults, errors: generationErrors } = await processNotebookLMGenerations(
    audioReady,
    regular
  );

  // Phase 2: RedCircle upload
  const uploadErrors = await processRedCircleUploads(generationResults);

  return {
    totalCandidates,
    successfulGenerations: generationResults.length,
    successfulUploads: generationResults.length - uploadErrors.length,
    errors: [...generationErrors, ...uploadErrors],
  };
}

export async function generateAndUploadFromMondayBoardCandidates(): Promise<void> {
  info("🔍 Fetching podcast candidates from Monday board...");

  const candidates = await getPodcastCandidates(3);
  success(`📋 Found ${candidates.length} podcast candidates`);

  if (candidates.length === 0) {
    info(
      "🎯 No valid podcast candidates found. Make sure your Monday board view contains articles with valid URLs and empty podcast link fields."
    );
    return;
  }

  const remainingSlots = await audioGenerationTracker.validateRateLimit();
  const { audioReady, regularToProcess } = partitionCandidates(candidates, remainingSlots);

  if ([...audioReady, ...regularToProcess].length === 0) {
    info("🎯 No candidates to process after rate limiting");
    return;
  }

  logBatchStart(audioReady, regularToProcess);

  const results = await processCandidatesPipeline(audioReady, regularToProcess);
  reportProcessingResults(results);
}
