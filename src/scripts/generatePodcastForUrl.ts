import { error } from "../logger";
import { generateAndUploadFromMondayBoardCandidates } from "../mondayBatchOrchestrator";

async function run() {
  try {
    await generateAndUploadFromMondayBoardCandidates();
  } catch (err) {
    error(`Failed to run podcast process: ${err}`);
    throw err;
  }
}

run();
