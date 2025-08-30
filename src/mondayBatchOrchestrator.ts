import { generatePodcastFromExistingNotebook, generatePodcastFromUrl } from "./singleRunGeneration";
import { convertToMp3 } from "./audioConversionService";
import { uploadEpisode } from "./redCircleService";
import { error, info, success } from "./logger";
import { GeneratedPodcast } from "./types";
import { getPodcastCandidates, updateItemWithGeneratedPodcastUrl } from "./monday/service";
import { audioGenerationTracker } from "./services/audioGenerationTrackingService";
import { finalizePodcastDetails } from "./services/articleMetadataService";
import { ArticleCandidate } from "./monday/types";

const DEFAULT_DOWNLOADS_DIR = "./downloads";

type CandidateProcessingError = { id: string; name: string; reason: unknown };

function partitionCandidates(candidates: ArticleCandidate[]): {
  audioReady: ArticleCandidate[];
  regular: ArticleCandidate[];
} {
  const audioReady = candidates.filter((c) => Boolean(c.generatedAudioLink));
  const regular = candidates.filter((c) => !c.generatedAudioLink);
  return { audioReady, regular };
}

async function runForCandidates(
  candidates: ArticleCandidate[],
  generateForCandidate: (candidate: ArticleCandidate) => Promise<GeneratedPodcast>
): Promise<{ processedCount: number; errors: CandidateProcessingError[] }> {
  const errors: CandidateProcessingError[] = [];
  let processedCount = 0;

  for (const candidate of candidates) {
    try {
      const details = await generateForCandidate(candidate);
      const podcastUrl = await uploadAndUpdateMondayItem(details, candidate);
      info(`🎯 Processed podcast URL: ${podcastUrl} for item ${candidate.id}`);
      processedCount += 1;
    } catch (candidateError) {
      error(`❌ Failed to process candidate ${candidate.id}: ${candidateError}`);
      errors.push({ id: candidate.id, name: candidate.name, reason: candidateError });
      continue;
    }
  }

  return { processedCount, errors };
}

function summarizeAndMaybeThrow(errors: CandidateProcessingError[]): void {
  if (errors.length === 0) return;
  const summary = errors.map((e) => `${e.id} (${e.name}): ${String(e.reason)}`).join("; ");
  throw new Error(`One or more candidates failed to process: ${summary}`);
}

async function processAudioReady(
  audioReadyCandidates: ArticleCandidate[]
): Promise<{ processedCount: number; errors: CandidateProcessingError[] }> {
  return runForCandidates(audioReadyCandidates, async (candidate) => {
    const notebookUrl = candidate.generatedAudioLink!;
    const { details } = await generatePodcastFromExistingNotebook(notebookUrl, candidate.sourceUrl, candidate.id);
    return details;
  });
}

async function processRegular(
  regularCandidates: ArticleCandidate[],
  remainingSlots: number
): Promise<{ processedCount: number; errors: CandidateProcessingError[] }> {
  const regularToProcess = remainingSlots > 0 ? regularCandidates.slice(0, remainingSlots) : [];
  return runForCandidates(regularToProcess, async (candidate) => {
    const { details } = await generatePodcastFromUrl(candidate.sourceUrl, candidate.id);
    return details;
  });
}

async function uploadAndUpdateMondayItem(details: GeneratedPodcast, candidate: ArticleCandidate): Promise<string> {
  const { title, description } = finalizePodcastDetails(
    details.metadata,
    details.notebookLmDetails,
    candidate.sourceUrl,
    candidate.id
  );
  const converted = await convertToMp3(details, { outputDir: DEFAULT_DOWNLOADS_DIR });
  const uploaded = await uploadEpisode(converted, title, description);
  await updateItemWithGeneratedPodcastUrl(candidate.id, uploaded.podcastUrl);
  return uploaded.podcastUrl;
}

export async function generateAndUploadFromMondayBoardCandidates(): Promise<void> {
  info("🔍 Fetching podcast candidates from Monday board...");

  const candidates = await getPodcastCandidates();
  success(`📋 Found ${candidates.length} podcast candidates`);

  if (candidates.length === 0) {
    info(
      "🎯 No valid podcast candidates found. Make sure your Monday board view contains articles with valid URLs and empty podcast link fields."
    );
    return;
  }

  const { audioReady, regular } = partitionCandidates(candidates);

  info(`🔊 Found ${audioReady.length} audio-ready items. Processing first...`);
  const { processedCount: audioReadyProcessed, errors: audioReadyErrors } = await processAudioReady(audioReady);

  const remainingSlots = await audioGenerationTracker.validateRateLimit();
  const { processedCount, errors } = await processRegular(regular, remainingSlots);
  summarizeAndMaybeThrow([...audioReadyErrors, ...errors]);

  success(`🎉 Completed processing ${audioReadyProcessed} audio-ready and ${processedCount} regular candidates.`);
}
