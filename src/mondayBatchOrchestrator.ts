import { generatePodcast, initializeNotebookLmAutomation, GenerationResult } from "./singleRunGeneration";
import { NotebookLMService } from "./notebookLMService";
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

/**
 * Sleep for specified milliseconds
 */
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

/**
 * Handle generation failure for a candidate
 * Marks invalid resources as non-podcastable and returns ProcessingError
 */
async function handleGenerationFailure(
  result: GenerationResult,
  candidate: ArticleCandidate,
  index: number,
  total: number
): Promise<ProcessingError> {
  if (result.success) {
    // This should never happen as we only call this function when result.success is false
    throw new Error("handleGenerationFailure called with successful result");
  }
  if (result.reason === "invalid_resource") {
    // Handle invalid resource: mark as non-podcastable and track separately
    warning(`⚠️  Invalid resource detected ${index + 1}/${total}: ${result.error.message}`);

    // Mark item as non-podcastable in Monday.com
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

/**
 * Process a single candidate and return generation result
 */
async function processSingleCandidate(
  candidate: ArticleCandidate,
  service: NotebookLMService
): Promise<GenerationResult> {
  // Always navigate to main page before each item to ensure correct state
  await service.navigateToMainPage();

  return await generatePodcast({
    sourceUrl: candidate.sourceUrl,
    existingNotebookUrl: candidate.generatedAudioLink,
    mondayItemId: candidate.id,
    service,
  });
}

/**
 * Process audio-ready candidates (no delays)
 */
async function processAudioReadyCandidates(
  candidates: ArticleCandidate[],
  service: NotebookLMService
): Promise<GenerationResults> {
  const results: Array<{ details: GeneratedPodcast; candidate: ArticleCandidate }> = [];
  const errors: ProcessingError[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    info(`Processing audio-ready ${i + 1}/${candidates.length}: ${candidate.sourceUrl}`);

    const result = await processSingleCandidate(candidate, service);
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

/**
 * Process new generation candidates (with delays)
 */
async function processNewGenerationCandidates(
  candidates: ArticleCandidate[],
  service: NotebookLMService
): Promise<GenerationResults> {
  const results: Array<{ details: GeneratedPodcast; candidate: ArticleCandidate }> = [];
  const errors: ProcessingError[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    info(`Processing new generation ${i + 1}/${candidates.length}: ${candidate.sourceUrl}`);

    const result = await processSingleCandidate(candidate, service);
    if (result.success) {
      results.push({ details: result.data.details, candidate });
      success(`✅ Generated new ${i + 1}/${candidates.length}`);
    } else {
      const processingError = await handleGenerationFailure(result, candidate, i, candidates.length);
      errors.push(processingError);
    }

    // Add delay before next generation (but not after the last one)
    if (i < candidates.length - 1) {
      info(`⏱️  Waiting ${NEW_GENERATION_DELAY_MS / 1000} seconds before next generation...`);
      await sleep(NEW_GENERATION_DELAY_MS);
    }
  }

  return { results, errors };
}

/**
 * Execute NotebookLM processing with logged-in service
 */
async function executeNotebookLMProcessing(
  audioReady: ArticleCandidate[],
  regular: ArticleCandidate[],
  service: NotebookLMService
): Promise<GenerationResults> {
  await service.loginToGoogle();
  info("✅ NotebookLM session initialized");

  // Process audio-ready candidates (no delays)
  const audioResults = await processAudioReadyCandidates(audioReady, service);

  // Process new generation candidates (with delays)
  const regularResults = await processNewGenerationCandidates(regular, service);

  return {
    results: [...audioResults.results, ...regularResults.results],
    errors: [...audioResults.errors, ...regularResults.errors],
  };
}

/**
 * Process NotebookLM generations using persistent browser session with smart delays
 */
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

  const { browser: notebookBrowser, service } = await initializeNotebookLmAutomation();

  try {
    return await executeNotebookLMProcessing(audioReady, regular, service);
  } finally {
    await notebookBrowser.close();
    info("🚪 NotebookLM browser session closed");
  }
}

/**
 * Process a single upload (throws on error)
 */
async function processSingleUpload(
  details: GeneratedPodcast,
  candidate: ArticleCandidate,
  page: Page
): Promise<string> {
  // Convert to MP3
  const { title, description } = finalizePodcastDetails(
    details.metadata,
    details.notebookLmDetails,
    candidate.sourceUrl,
    candidate.id
  );

  const converted = await convertToMp3(details, { outputDir: DEFAULT_DOWNLOADS_DIR });

  // Upload using persistent session
  const uploaded = await uploadEpisode(converted, title, description, page);

  // Update Monday.com
  await updateItemWithGeneratedPodcastUrl(candidate.id, uploaded.podcastUrl);

  return title;
}

/**
 * Process uploads batch with proper resource cleanup
 */
async function processUploadsBatch(
  generationResults: Array<{ details: GeneratedPodcast; candidate: ArticleCandidate }>,
  page: Page
): Promise<ProcessingError[]> {
  const errors: ProcessingError[] = [];

  for (let i = 0; i < generationResults.length; i++) {
    const { details, candidate } = generationResults[i];
    info(`Uploading ${i + 1}/${generationResults.length}: ${candidate.sourceUrl}`);

    try {
      // Always navigate to main podcast page before each upload to ensure correct state
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

/**
 * Process RedCircle uploads using persistent browser session
 */
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

/**
 * Report comprehensive processing results with detailed error information
 */
function reportProcessingResults(results: BatchResult): void {
  const { totalCandidates, successfulGenerations, successfulUploads, errors } = results;

  success(`\n📊 Batch Processing Complete:`);
  success(`  📋 Total candidates: ${totalCandidates}`);
  success(`  🎵 Successful generations: ${successfulGenerations}/${totalCandidates}`);
  success(`  ⬆️  Successful uploads: ${successfulUploads}/${successfulGenerations}`);

  // Filter errors by phase
  const invalidResources = errors.filter((e) => e.phase === "invalid_resource");
  const generationErrors = errors.filter((e) => e.phase === "generation");
  const uploadErrors = errors.filter((e) => e.phase === "upload");

  // Report invalid resources separately
  if (invalidResources.length > 0) {
    warning(`\n⚠️  Invalid Resources (${invalidResources.length} total - marked as non-podcastable):`);
    invalidResources.forEach((err) => {
      warning(`    • ${err.url}`);
    });
  }

  // Report other errors
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

/**
 * Get candidates ready for processing after applying rate limits
 */
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

/**
 * Log batch processing start information
 */
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
}

/**
 * Process all candidates in two phases: generation then upload
 */
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

  const candidates = await getPodcastCandidates();
  success(`📋 Found ${candidates.length} podcast candidates`);

  // Early return: no candidates
  if (candidates.length === 0) {
    info(
      "🎯 No valid podcast candidates found. Make sure your Monday board view contains articles with valid URLs and empty podcast link fields."
    );
    return;
  }

  const remainingSlots = await audioGenerationTracker.validateRateLimit();
  const { audioReady, regularToProcess } = partitionCandidates(candidates, remainingSlots);

  // Early return: nothing to process after rate limiting
  if ([...audioReady, ...regularToProcess].length === 0) {
    info("🎯 No candidates to process after rate limiting");
    return;
  }

  logBatchStart(audioReady, regularToProcess);

  const results = await processCandidatesPipeline(audioReady, regularToProcess);
  reportProcessingResults(results);
}
