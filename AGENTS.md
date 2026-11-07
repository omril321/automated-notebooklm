# Automated NotebookLM

TypeScript pipeline that turns articles curated on a Monday.com board into podcast episodes: it generates audio with Google NotebookLM (via the `notebooklm-py` CLI), uploads the MP3 to RedCircle (Playwright), and writes the result back to the board.

## ⚠️ `yarn generate-podcasts` is live

It spends NotebookLM's daily quota, publishes real RedCircle episodes, and edits Monday items. Never run it unless the user asks. Use `yarn test:run`, `yarn typecheck` and `yarn build` to verify changes.

## Commands

```bash
yarn install
yarn test:run          # vitest, single run (yarn test = watch)
yarn typecheck         # tsc --noEmit
yarn build             # tsc -> dist/
yarn format            # prettier --write . (format:check to verify)
yarn generate-podcasts # the only entry point; see warning above

./scripts/setup-nlm.sh # one-time: .venv + notebooklm-py via uv (Python 3.10+)
./scripts/nlm login    # Google OAuth in a browser
./scripts/nlm list     # verify auth
```

Requires Node >= 24.4 (`.nvmrc`), yarn, `uv`, Chrome (RedCircle upload uses Playwright's `chrome` channel).

## How a run works

Entry: `src/scripts/generatePodcastForUrl.ts` -> `generateAndUploadFromMondayBoardCandidates()` in `src/mondayBatchOrchestrator.ts`. No flags, no single-URL mode.

1. **Board prep** (`src/monday/service.ts`): items whose name is a bare URL get title + link filled in; article items missing metadata get Type / Metadata / Non-podcastable set. URLs are processed 10 at a time with 15s pauses.
2. **Candidates**: `getPodcastCandidates(3)` keeps items with `podcastFitness > 0` and an `http` URL, sorts audio-ready items (see below) first, then by fitness desc, and takes the top 3.
3. **Generate**: items with an existing NotebookLM link ("audio-ready") reuse that notebook and skip the rate limit; the rest are capped by remaining quota (`audioGenerationTrackingService`). Done through `services/notebookLMAdapter.ts` -> `services/notebookLMCliService.ts`.
4. **Upload**: all MP3s go to RedCircle in one browser session (`redCircleService.ts`, `browserService.ts`).
5. **Write back**: podcast link, NotebookLM link and item name are updated on Monday.

Per-item errors are collected and reported at the end; the run does not stop at the first failure.

## Layout

- `src/monday/` - GraphQL client (`api-client.ts`, `api.ts`), board config and column IDs (`config.ts`), candidate selection and updates (`service.ts`)
- `src/services/` - article metadata and content analysis (`articleMetadataService`, `contentAnalysisService`, `htmlContentParser`, `pdfContentParser`), NotebookLM CLI wrapper/adapter, rate-limit and failure tracking
- `src/podcastConfig.ts` - loads `podcast-instructions.md`
- `src/audioConversionService.ts` - MP3 passthrough into `downloads/`
- `src/scripts/notebookLMCleanup.js` - a snippet to paste into the DevTools console on notebooklm.google.com (not Node code)
- `scripts/` - shell helpers for the Python CLI environment

## Environment (`.env`, see `.env.example`)

| Variable                                 | Needed for                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `MONDAY_API_TOKEN`, `MONDAY_BOARD_URL`   | Always (throws on startup if missing). URL format `https://<x>.monday.com/boards/<id>` |
| `MONDAY_EXCLUDED_GROUP_IDS`              | Always. Comma-separated group **IDs**, not titles                                      |
| `RED_CIRCLE_USER`, `RED_CIRCLE_PASSWORD` | Upload (always runs after generation)                                                  |
| `PUBLISHED_PODCAST_NAME`                 | Upload. Must match the podcast image `alt` text on RedCircle                           |

Google credentials are not in `.env`; auth lives in the `notebooklm-py` session from `./scripts/nlm login`.

## Runtime state (all gitignored)

- `logs/audio-generation.json` - generation timestamps; limit is 3 per rolling 24h (not per calendar day)
- `logs/generation-failures.json` - 3 failures for a URL within 30 days marks the item Non-podcastable
- `temp/*.mp3` (CLI download), `downloads/*.mp3` (uploaded copy), `temp/redcircle-error-*.png` - never cleaned up automatically

## Conventions

- Strict TypeScript, no `any`. Small, pure, single-purpose functions; fail fast on invalid input with context-rich errors.
- Tests are Vitest, colocated as `*.test.ts` next to the code. Test behavior, mock external services (Monday, NotebookLM CLI, network).
- Prettier: 120 columns, double quotes, semicolons, `es5` trailing commas.
- Yarn only (not npm).
- Comments only for non-obvious "why".

## Gotchas

- The board's **Podcast fitness formula** is what excludes already-published and non-podcastable items. The code does not check the Podcast link or Non-podcastable columns itself.
- Monday column IDs are hard-coded in `src/monday/config.ts`; a different board needs those changed.
- `items_page` fetches 500 items and throws if exactly 500 come back (no pagination).
- `podcast-instructions.md` is read from `process.cwd()`, trimmed to 500 chars, applies to new generations only, and is appended to the episode description. Guide: `prompts/podcast-instructions-guide.md`.
- `generate-podcasts` sets `NODE_TLS_REJECT_UNAUTHORIZED=0` and the CLI wrapper sets `NLM_DISABLE_SSL_VERIFY=1`: a corporate-proxy workaround that disables TLS verification for Node's own requests.
- `notebooklm-py` uses undocumented Google APIs and can break without notice; RedCircle selectors can break when the site changes.
