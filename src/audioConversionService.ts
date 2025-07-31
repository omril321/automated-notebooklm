import ffmpeg, { FfmpegCommand, Codec } from "fluent-ffmpeg";
import { Download } from "playwright";
import { promises as fs } from "fs";
import { saveToTempFile, cleanupTempFile } from "./downloadUtils";
import { info, success, error } from "./logger";

type ConversionOptions = {
  outputPath: string;
  bitrate?: string;
  quality?: number;
  sampleRate?: number;
};

type ConversionResult = {
  outputPath: string;
  originalSize: number;
  convertedSize: number;
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

/**
 * Convert a WAV file from Playwright download to high-quality MP3
 * @param wavPath Path to WAV file to convert
 * @param options Conversion options including output path and quality settings
 * @returns Promise with conversion results
 */
export async function convertFromWavFile(wavPath: string, options: ConversionOptions): Promise<ConversionResult> {
  await validateFfmpegInstallation();

  return await convertWavToMp3(wavPath, options);
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
 * @returns Promise with conversion results
 */
async function convertWavToMp3(inputPath: string, options: ConversionOptions): Promise<ConversionResult> {
  info("Starting WAV to MP3 conversion...");

  const {
    outputPath,
    bitrate = DEFAULT_BITRATE,
    quality = DEFAULT_QUALITY,
    sampleRate = DEFAULT_SAMPLE_RATE,
  } = options;

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
        try {
          const result = await createConversionResult(inputPath, outputPath);
          success(`Conversion completed: ${result.originalSize} bytes → ${result.convertedSize} bytes`);
          resolve(result);
        } catch (statError: unknown) {
          const errorMessage = statError instanceof Error ? statError.message : "Unknown error";
          reject(new Error(`Failed to get file statistics: ${errorMessage}`));
        }
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

/**
 * Create conversion result object
 */
async function createConversionResult(inputPath: string, outputPath: string): Promise<ConversionResult> {
  const originalStats = await fs.stat(inputPath);
  const convertedStats = await fs.stat(outputPath);

  return {
    outputPath,
    originalSize: originalStats.size,
    convertedSize: convertedStats.size,
  };
}
