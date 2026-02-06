import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { info, error as logError, success } from "../logger";

const execFileAsync = promisify(execFile);

// Project root is 2 levels up from src/services/
const PROJECT_ROOT = join(__dirname, "..", "..");
const NLM_BIN = join(PROJECT_ROOT, ".venv", "bin", "notebooklm");

// Timeout constants
const DEFAULT_TIMEOUT_MS = 60_000; // 1 minute for most operations
const AUDIO_GENERATION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes for audio generation
const SOURCE_ADD_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes for adding sources

export type NotebookInfo = {
  id: string;
  title: string;
};

export type SourceInfo = {
  id: string;
  title: string;
  type: string;
};

export type NotebookDetails = {
  id: string;
  title: string;
  sources: SourceInfo[];
};

export type AudioGenerationResult = {
  taskId?: string;
  completed: boolean;
};

export class NotebookLMCliError extends Error {
  constructor(
    message: string,
    public readonly stderr: string,
    public readonly command: string
  ) {
    super(message);
    this.name = "NotebookLMCliError";
  }
}

async function runNlmCommand(
  args: string[],
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const { timeout = DEFAULT_TIMEOUT_MS } = options;

  try {
    const result = await execFileAsync(NLM_BIN, args, {
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
    });
    return result;
  } catch (err) {
    const execError = err as {
      message: string;
      stderr?: string;
      stdout?: string;
      code?: number;
    };
    const command = `notebooklm ${args.join(" ")}`;
    const stderr = execError.stderr || "";
    throw new NotebookLMCliError(`CLI command failed: ${execError.message}`, stderr, command);
  }
}

/**
 * Check if the notebooklm CLI is installed and accessible
 */
export async function isCliInstalled(): Promise<boolean> {
  try {
    await runNlmCommand(["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if authentication is valid
 */
export async function checkAuth(): Promise<boolean> {
  try {
    const { stdout } = await runNlmCommand(["auth", "check", "--json"]);
    const result = JSON.parse(stdout);
    // CLI returns { "status": "ok" } when authenticated
    return result.status === "ok";
  } catch {
    return false;
  }
}

/**
 * List all notebooks (read-only, safe for testing)
 */
export async function listNotebooks(): Promise<NotebookInfo[]> {
  info("Fetching notebook list from NotebookLM CLI...");
  const { stdout } = await runNlmCommand(["list"]);

  // Parse the output - notebooklm list returns formatted text
  // Format: "ID: <id> | Title: <title>" or similar
  const lines = stdout.trim().split("\n").filter(Boolean);
  const notebooks: NotebookInfo[] = [];

  for (const line of lines) {
    // Try to parse each line as notebook info
    // The exact format depends on CLI output
    const idMatch = line.match(/(?:ID:\s*)?([a-zA-Z0-9_-]+)/);
    const titleMatch = line.match(/(?:Title:\s*|:\s+)(.+)$/);

    if (idMatch && titleMatch) {
      notebooks.push({
        id: idMatch[1],
        title: titleMatch[1].trim(),
      });
    }
  }

  success(`Found ${notebooks.length} notebooks`);
  return notebooks;
}

/**
 * Get the current status/context
 */
export async function getStatus(): Promise<{
  activeNotebook?: string;
  authenticated: boolean;
}> {
  try {
    const { stdout } = await runNlmCommand(["status", "--json"]);
    const result = JSON.parse(stdout);
    return {
      activeNotebook: result.notebook?.id,
      authenticated: result.authenticated ?? false,
    };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Create a new notebook
 * @returns The notebook ID
 */
export async function createNotebook(title: string): Promise<string> {
  info(`Creating notebook: ${title}`);
  const { stdout } = await runNlmCommand(["create", title]);

  // Parse notebook ID from output
  // Expected format includes the notebook ID
  const idMatch = stdout.match(/([a-zA-Z0-9_-]{10,})/);
  if (!idMatch) {
    throw new NotebookLMCliError(
      "Could not parse notebook ID from create output",
      stdout,
      `notebooklm create "${title}"`
    );
  }

  const notebookId = idMatch[1];
  success(`Created notebook with ID: ${notebookId}`);
  return notebookId;
}

/**
 * Select/activate a notebook for subsequent operations
 */
export async function useNotebook(notebookId: string): Promise<void> {
  info(`Selecting notebook: ${notebookId}`);
  await runNlmCommand(["use", notebookId]);
  success(`Selected notebook: ${notebookId}`);
}

/**
 * Add a URL source to the currently active notebook
 */
export async function addUrlSource(url: string): Promise<string> {
  info(`Adding URL source: ${url}`);
  const { stdout } = await runNlmCommand(["source", "add", url], {
    timeout: SOURCE_ADD_TIMEOUT_MS,
  });

  // Parse source ID from output
  const idMatch = stdout.match(/([a-zA-Z0-9_-]{10,})/);
  const sourceId = idMatch ? idMatch[1] : "unknown";

  success(`Added source: ${sourceId}`);
  return sourceId;
}

/**
 * Add a URL source to a specific notebook (without needing to select it first)
 */
export async function addUrlSourceToNotebook(notebookId: string, url: string): Promise<string> {
  info(`Adding URL source to notebook ${notebookId}: ${url}`);
  const { stdout } = await runNlmCommand(["source", "add", url, "--notebook", notebookId], {
    timeout: SOURCE_ADD_TIMEOUT_MS,
  });

  const idMatch = stdout.match(/([a-zA-Z0-9_-]{10,})/);
  const sourceId = idMatch ? idMatch[1] : "unknown";

  success(`Added source: ${sourceId}`);
  return sourceId;
}

/**
 * Wait for a source to finish processing
 */
export async function waitForSource(sourceId: string, timeoutMs: number = SOURCE_ADD_TIMEOUT_MS): Promise<void> {
  info(`Waiting for source ${sourceId} to process...`);
  await runNlmCommand(
    ["source", "wait", sourceId, "--timeout", String(Math.floor(timeoutMs / 1000))],
    { timeout: timeoutMs + 10_000 } // Extra buffer for CLI timeout
  );
  success(`Source ${sourceId} ready`);
}

export type AudioArtifact = {
  id: string;
  status: string;
  title: string;
};

/**
 * Get the latest audio artifact from the current notebook
 */
export async function getLatestAudioArtifact(): Promise<AudioArtifact | null> {
  try {
    const { stdout } = await runNlmCommand(["artifact", "list", "--type", "audio", "--json"]);
    const result = JSON.parse(stdout);
    // Return the first (latest) audio artifact
    const artifact = result.artifacts?.[0];
    if (!artifact) return null;
    return {
      id: artifact.id,
      status: artifact.status,
      title: artifact.title || "Untitled Podcast",
    };
  } catch {
    return null;
  }
}

/**
 * Wait for an artifact to complete using artifact wait command
 */
async function waitForArtifact(artifactId: string, timeoutSeconds: number = 600): Promise<boolean> {
  try {
    const { stdout } = await runNlmCommand(
      ["artifact", "wait", artifactId, "--timeout", String(timeoutSeconds), "--json"],
      { timeout: (timeoutSeconds + 30) * 1000 } // Add buffer for CLI overhead
    );
    const result = JSON.parse(stdout);
    return result.status === "completed";
  } catch (err) {
    // Log the error instead of silently returning false
    logError(`Artifact wait failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Generate audio podcast from the active notebook
 * @param instructions Optional custom instructions for the podcast
 * @param wait If true, waits for generation to complete
 */
export async function generateAudio(instructions?: string, wait: boolean = true): Promise<AudioGenerationResult> {
  info("Generating audio podcast...");

  // Start generation without waiting (we'll use artifact wait for longer timeout)
  const args = ["generate", "audio", "--json"];
  if (instructions) {
    args.push(instructions);
  }

  try {
    await runNlmCommand(args, { timeout: DEFAULT_TIMEOUT_MS });
  } catch (err) {
    // Check if it's a rate limit error vs actual failure
    // Rate limit errors can appear as "RATE_LIMITED" or "CREATE_ARTIFACT failed"
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isRateLimitError = errorMessage.includes("RATE_LIMITED") || errorMessage.includes("CREATE_ARTIFACT failed");

    if (!isRateLimitError) {
      throw err;
    }
    // Rate limited means we might already have audio or can't generate
    info("Rate limited - checking for existing audio artifact...");
  }

  if (!wait) {
    return { completed: false };
  }

  // Get the audio artifact (either just created or existing)
  const artifact = await getLatestAudioArtifact();
  if (!artifact) {
    throw new NotebookLMCliError("No audio artifact found after generation", "", "generate audio");
  }

  // If already completed, we're done
  if (artifact.status === "completed") {
    success("Audio generation complete");
    return { completed: true };
  }

  // Wait for completion with 15-minute timeout
  info(`Waiting for audio artifact ${artifact.id} to complete...`);
  let completed = await waitForArtifact(artifact.id, 900);

  // If wait failed, check artifact status directly - may have completed after timeout
  if (!completed) {
    info("Wait command failed, checking artifact status directly...");
    const finalArtifact = await getLatestAudioArtifact();
    if (finalArtifact?.status === "completed") {
      completed = true;
    }
  }

  if (completed) {
    success("Audio generation complete");
    return { completed: true };
  }

  throw new NotebookLMCliError("Audio generation timed out or failed", "", "artifact wait");
}

/**
 * Generate audio for a specific notebook
 */
export async function generateAudioForNotebook(
  notebookId: string,
  instructions?: string,
  wait: boolean = true
): Promise<AudioGenerationResult> {
  info(`Generating audio for notebook ${notebookId}...`);

  // Select the notebook first
  await useNotebook(notebookId);

  // Use the standard generateAudio which handles waiting properly
  return generateAudio(instructions, wait);
}

/**
 * Download the latest audio file
 * @param outputPath Path to save the MP3 file
 * @returns The path to the downloaded file
 */
export async function downloadAudio(outputPath: string): Promise<string> {
  info(`Downloading audio to: ${outputPath}`);

  await runNlmCommand(["download", "audio", outputPath, "--latest"], {
    timeout: 5 * 60 * 1000, // 5 minutes for download
  });

  success(`Audio downloaded to: ${outputPath}`);
  return outputPath;
}

/**
 * Download audio from a specific notebook
 */
export async function downloadAudioFromNotebook(notebookId: string, outputPath: string): Promise<string> {
  info(`Downloading audio from notebook ${notebookId} to: ${outputPath}`);

  await runNlmCommand(["download", "audio", outputPath, "--latest", "--notebook", notebookId], {
    timeout: 5 * 60 * 1000,
  });

  success(`Audio downloaded to: ${outputPath}`);
  return outputPath;
}

/**
 * Get notebook summary/description
 */
export async function getNotebookSummary(notebookId?: string): Promise<string> {
  info("Getting notebook summary...");

  const args = ["summary"];
  if (notebookId) {
    args.push("--notebook", notebookId);
  }

  const { stdout } = await runNlmCommand(args);
  return stdout.trim();
}

/**
 * Set the output language for the notebook
 */
export async function setLanguage(languageCode: string): Promise<void> {
  info(`Setting language to: ${languageCode}`);
  await runNlmCommand(["language", "set", languageCode]);
  success(`Language set to: ${languageCode}`);
}

/**
 * Clear the active notebook context
 */
export async function clearContext(): Promise<void> {
  await runNlmCommand(["clear"]);
  info("Cleared active notebook context");
}

/**
 * Full workflow: Create notebook, add URL, generate audio, download
 * Returns the path to the downloaded MP3 file
 */
export async function createPodcastFromUrl(
  url: string,
  outputPath: string,
  options: {
    title?: string;
    instructions?: string;
    language?: string;
  } = {}
): Promise<{ notebookId: string; mp3Path: string; title: string }> {
  const { title = "Podcast", instructions, language = "en" } = options;

  // Create notebook
  const notebookId = await createNotebook(title);

  // Select it
  await useNotebook(notebookId);

  // Set language if specified
  if (language && language !== "en") {
    await setLanguage(language);
  }

  // Add URL source
  const sourceId = await addUrlSource(url);

  // Wait for source to be processed
  await waitForSource(sourceId);

  // Generate audio (with wait)
  await generateAudio(instructions, true);

  // Download the audio
  const mp3Path = await downloadAudio(outputPath);

  return { notebookId, mp3Path, title };
}

/**
 * Resume from existing notebook - just download audio
 */
export async function downloadAudioFromExisting(notebookId: string, outputPath: string): Promise<string> {
  await useNotebook(notebookId);
  return await downloadAudio(outputPath);
}
