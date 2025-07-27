import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { error } from "../logger";
import { generatePodcastFromUrl } from "../podcastGeneration";

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option("url", {
    description: "URL to generate podcast from",
    type: "string",
    demandOption: true,
  })
  .help()
  .alias("help", "h")
  .parseSync();

// Run the main function
generatePodcastFromUrl(argv.url).catch((err) => {
  error(`Failed to generate podcast from url: ${err}`);
  process.exit(1);
});
