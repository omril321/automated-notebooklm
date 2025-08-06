import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { error } from "../logger";
import { generateAndUpload, generateUsingMondayBoard } from "../generateAndUpload";

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option("url", {
    description: "URL to generate podcast from",
    type: "string",
    default: undefined,
  })

  .option("monday-mode", {
    description: "Process podcasts from Monday board candidates instead of single URL",
    type: "boolean",
    default: true,
  })
  .check((argv) => {
    if (argv["monday-mode"]) {
      // Monday mode doesn't require url or file
      return true;
    }
    if (!argv.url) {
      throw new Error("Either --url,  --monday-mode is required");
    }
    return true;
  })
  .help()
  .alias("help", "h")
  .parseSync();

async function run() {
  const isMondayMode = argv["monday-mode"];
  try {
    if (isMondayMode) {
      await generateUsingMondayBoard();
    } else {
      const url = argv.url!;
      await generateAndUpload(url);
    }
  } catch (err) {
    error(`Failed to run podcast process: ${err}`);
    throw err;
  }
}

run();
