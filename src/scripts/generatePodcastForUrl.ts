import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { error } from "../logger";
import { generateAndUpload } from "../generateAndUpload";

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option("url", {
    description: "URL to generate podcast from",
    type: "string",
    demandOption: true,
  })
  .option("no-upload", {
    description: "Skip uploading the podcast the hosting service",
    type: "boolean",
    default: false,
  })
  .help()
  .alias("help", "h")
  .parseSync();

// Run the main function
generateAndUpload(argv.url, {
  skipUpload: argv["no-upload"],
}).catch((err) => {
  error(`Failed to run podcast generation and upload: ${err}`);
  process.exit(1);
});
