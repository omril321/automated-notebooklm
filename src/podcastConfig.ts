import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { info, warning } from "./logger";

const CONFIG_PATH = join(process.cwd(), "podcast-instructions.md");
const MAX_INSTRUCTIONS_LENGTH = 500;

let cachedInstructions: string | undefined;

export function loadPodcastInstructions(): string | undefined {
  if (cachedInstructions !== undefined) {
    return cachedInstructions || undefined;
  }

  if (!existsSync(CONFIG_PATH)) {
    info("No podcast-instructions.md found - using default NotebookLM style");
    cachedInstructions = "";
    return undefined;
  }

  try {
    let content = readFileSync(CONFIG_PATH, "utf-8").trim();

    if (content.length > MAX_INSTRUCTIONS_LENGTH) {
      warning(`Instructions exceed ${MAX_INSTRUCTIONS_LENGTH} chars, truncating`);
      content = content.slice(0, MAX_INSTRUCTIONS_LENGTH);
    }

    if (content) {
      info(`Loaded podcast instructions (${content.length} chars)`);
      cachedInstructions = content;
      return content;
    }

    cachedInstructions = "";
    return undefined;
  } catch (err) {
    warning(`Failed to read podcast-instructions.md: ${err}`);
    cachedInstructions = "";
    return undefined;
  }
}
