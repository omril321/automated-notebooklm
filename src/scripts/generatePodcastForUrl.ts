import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { error } from "../logger";
import { generateAndUpload, uploadExistingFile } from "../generateAndUpload";

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option("url", {
    description: "URL to generate podcast from",
    type: "string",
  })
  .option("file", {
    description: "Path to existing MP3 file to upload directly",
    type: "string",
  })
  .option("title", {
    description: "Title for the episode (for direct upload)",
    type: "string",
  })
  .option("description", {
    description: "Description for the episode (for direct upload)",
    type: "string",
  })
  .option("no-upload", {
    description: "Skip uploading the podcast to the hosting service",
    type: "boolean",
    default: false,
  })
  .check((argv) => {
    if (!argv.url && !argv.file) {
      throw new Error("Either --url or --file is required");
    }
    if (argv.url && argv.file) {
      throw new Error("Cannot use both --url and --file together");
    }
    if ((argv.title || argv.description) && !argv.file) {
      throw new Error("--title and --description can only be used with --file");
    }
    return true;
  })
  .help()
  .alias("help", "h")
  .parseSync();

async function run() {
  try {
    if (argv.file) {
      // Direct upload mode
      await uploadExistingFile(argv.file, {
        title: argv.title,
        description: argv.description,
      });
    } else if (argv.url) {
      // Generate and upload mode
      await generateAndUpload(argv.url, {
        skipUpload: argv["no-upload"],
      });
    }
  } catch (err) {
    error(`Failed to run podcast process: ${err}`);
    throw err;
  }
}

// Run the script
run();
