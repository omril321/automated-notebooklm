import ffmpeg, { FfmpegCommand, Codec } from "fluent-ffmpeg";
import { promises as fs } from "fs";
import { info, success, error } from "./logger";
import { GeneratedPodcast, ConvertedPodcast, toConvertedPodcast } from "./types";
import { generateOutputPath } from "./downloadUtils";

type ConversionOptions = {
  outputPath?: string;
  bitrate?: string;
  quality?: number;
  sampleRate?: number;
  outputDir?: string;
};

type FfmpegCodecData = {
  audio: string;
  duration: string;
};

type FfmpegProgress = {
  percent?: number;
};

// Configuration constants
const DEFAULT_BITRATE = "320k"; // Highest standard quality
const DEFAULT_QUALITY = 0; // Highest quality (0-9, lower is better)
const DEFAULT_SAMPLE_RATE = 44100; // CD quality
const DEFAULT_OUTPUT_DIR = "./downloads";

/**
 * Check if the audio file is already in MP3 format
 */
function isAlreadyMp3(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".mp3");
}

/**
 * Convert audio to high-quality MP3 (or pass through if already MP3)
 * @param podcast Generated podcast metadata containing audio file path
 * @param options Conversion options including output path and quality settings
 * @returns Promise with converted podcast metadata
 */
export async function convertToMp3(
  podcast: GeneratedPodcast,
  options: ConversionOptions = {}
): Promise<ConvertedPodcast> {
  const inputPath = podcast.wavPath; // May be WAV or MP3 depending on source

  // If already MP3 (CLI path), skip conversion
  if (isAlreadyMp3(inputPath)) {
    info("Audio is already in MP3 format, skipping conversion");

    // If a specific output path was requested, copy to that location
    if (options.outputPath && options.outputPath !== inputPath) {
      await fs.copyFile(inputPath, options.outputPath);
      success(`Copied MP3 to: ${options.outputPath}`);
      return toConvertedPodcast(podcast, options.outputPath);
    }

    // If outputDir specified, generate path there
    if (options.outputDir) {
      const outputPath = generateOutputPath(podcast.metadata.title, options.outputDir);
      await fs.copyFile(inputPath, outputPath);
      success(`Copied MP3 to: ${outputPath}`);
      return toConvertedPodcast(podcast, outputPath);
    }

    // Otherwise use the input path as-is
    return toConvertedPodcast(podcast, inputPath);
  }

  // WAV file (Playwright path) - need to convert
  await validateFfmpegInstallation();

  // Determine output path - either from options or generate from title
  const outputPath =
    options.outputPath || generateOutputPath(podcast.metadata.title, options.outputDir || DEFAULT_OUTPUT_DIR);

  // Convert the file
  await convertWavToMp3(inputPath, { ...options, outputPath });

  // Return metadata in converted stage
  return toConvertedPodcast(podcast, outputPath);
}

/**
 * Validate that system has required ffmpeg installation
 * @returns Promise<boolean> True if ffmpeg is available
 */
async function validateFfmpegInstallation(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableCodecs((err: Error | null, codecs: Record<string, Codec>) => {
      if (err) {
        error("FFmpeg not found. Please install FFmpeg on your system.");
        resolve(false);
        return;
      }

      if (!codecs.libmp3lame) {
        error("libmp3lame codec not found. Please install FFmpeg with libmp3lame support.");
        resolve(false);
        return;
      }

      success("FFmpeg with libmp3lame codec is available");
      resolve(true);
    });
  });
}

/**
 * Convert WAV file to high-quality MP3
 * @param inputPath Path to input WAV file
 * @param options Conversion options
 * @returns Promise resolved when conversion is complete
 */
async function convertWavToMp3(inputPath: string, options: ConversionOptions): Promise<void> {
  info("Starting WAV to MP3 conversion...");

  const {
    outputPath,
    bitrate = DEFAULT_BITRATE,
    quality = DEFAULT_QUALITY,
    sampleRate = DEFAULT_SAMPLE_RATE,
  } = options;

  if (!outputPath) {
    throw new Error("Output path is required for conversion");
  }

  return new Promise((resolve, reject) => {
    const command = createFfmpegCommand(inputPath, { bitrate, quality, sampleRate });

    command
      .on("start", (commandLine: string) => {
        info(`FFmpeg command: ${commandLine}`);
      })
      .on("codecData", (data: FfmpegCodecData) => {
        info(`Input audio: ${data.audio}`);
      })
      .on("progress", (progress: FfmpegProgress) => {
        if (progress.percent) {
          info(`Conversion progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on("end", async () => {
        success(`Conversion completed to: ${outputPath}`);
        resolve();
      })
      .on("error", (err: Error) => {
        error(`Conversion failed: ${err.message}`);
        reject(new Error(`Audio conversion failed: ${err.message}`));
      });

    command.save(outputPath);
  });
}

/**
 * Create and configure FFmpeg command
 */
function createFfmpegCommand(
  inputPath: string,
  options: { bitrate: string; quality: number; sampleRate: number }
): FfmpegCommand {
  const command = ffmpeg(inputPath)
    .audioCodec("libmp3lame") // Use LAME encoder for best quality
    .audioBitrate(options.bitrate)
    .audioQuality(options.quality)
    .audioFrequency(options.sampleRate)
    .audioChannels(2) // Preserve stereo
    .format("mp3");

  return command;
}
