# Automated NotebookLM - Claude Code Context

This project automates Google NotebookLM to generate podcast audio from URLs, converts audio to MP3, and optionally uploads episodes to RedCircle. It includes Monday.com integration for candidate selection and metadata processing.

## Project Overview

**Automated NotebookLM** is a TypeScript automation pipeline that:

- Generates NotebookLM studio podcasts from URLs using `notebooklm-py` CLI
- Downloads MP3 audio directly from NotebookLM
- Uploads MP3 episodes to RedCircle (optional)
- Integrates with Monday.com boards for candidate management with intelligent scoring
- Supports both new podcast generation and resuming from existing NotebookLM URLs

## Architecture

```
Monday.com Board → Candidate Selection → NotebookLM Generation → Audio Download → RedCircle Upload
       ↓                    ↓                     ↓                    ↓                ↓
  Metadata Extraction → Fitness Scoring → CLI (notebooklm-py)  →   MP3 Direct → Browser Upload
```

## Key Directories

- `src/` - TypeScript source code
- `src/services/` - Content analysis and metadata extraction services
- `src/monday/` - Monday.com API integration layer
- `src/scripts/` - CLI entry points
- `dist/` - Compiled JavaScript output
- `downloads/` - Generated MP3 audio files
- `temp/` - Temporary processing files
- `logs/` - Application logs

## Core Services

### Audio Pipeline

- `singleRunGeneration.ts` - Main podcast generation orchestration
- `services/notebookLMCliService.ts` - CLI wrapper for notebooklm-py
- `services/notebookLMAdapter.ts` - Adapter interface for NotebookLM operations
- `audioConversionService.ts` - MP3 passthrough (CLI provides MP3 directly)
- `redCircleService.ts` - Automated podcast upload to RedCircle platform

### Monday.com Integration

- `monday/config.ts` - Board configuration and column definitions
- `monday/service.ts` - Board operations, candidate selection, and updates
- `monday/api-client.ts` - Monday.com GraphQL API client
- `monday/api.ts` - Board item fetching and filtering logic

### Content Analysis & Metadata

- `services/articleMetadataService.ts` - URL metadata extraction and analysis
- `services/contentAnalysisService.ts` - Content scoring and classification
- `services/htmlContentParser.ts` - HTML content parsing and analysis
- `services/pdfContentParser.ts` - PDF content extraction support
- `services/audioGenerationTrackingService.ts` - Rate limiting for NotebookLM

### Orchestration

- `mondayBatchOrchestrator.ts` - Batch processing for Monday.com candidates
- `scripts/generatePodcastForUrl.ts` - Main CLI entry point

## Development Commands

```bash
# Main generation command (Monday.com mode - processes board candidates)
yarn generate-podcasts

# Build TypeScript to JavaScript
yarn build

# Run tests
yarn test           # Watch mode
yarn test:run       # Single run
yarn test:watch     # Explicit watch mode
yarn test:ui        # Interactive UI dashboard
yarn test:coverage  # Coverage report
```

## Environment Configuration

Required `.env` variables:

```bash
# Monday.com integration (optional - enables board processing)
MONDAY_API_TOKEN=your_personal_api_token
MONDAY_BOARD_URL=https://yourcompany.monday.com/boards/123456789
MONDAY_EXCLUDED_GROUP_IDS="Done,Archived"  # Optional: exclude specific groups

# RedCircle upload (optional - enables podcast publishing)
RED_CIRCLE_USER=your_username
RED_CIRCLE_PASSWORD=your_password
PUBLISHED_PODCAST_NAME="Your Podcast Name"
```

## System Dependencies

- **Node.js >= 24.4** with Yarn package manager
- **Python 3.10+** with `uv` package manager for notebooklm-py CLI
- **Chrome browser** for RedCircle upload
- **Google account** for NotebookLM access
- **RedCircle account** with existing podcast (required only for upload feature)

### CLI Setup

```bash
# One-time setup
./scripts/setup-nlm.sh

# Authenticate with Google
./scripts/nlm login

# Verify setup
./scripts/nlm list
```

## Technology Stack

- **Language**: TypeScript with functional programming patterns
- **Package Manager**: Yarn
- **Browser Automation**: Playwright (Chrome channel) for RedCircle upload
- **NotebookLM**: notebooklm-py CLI for podcast generation
- **Testing**: Vitest 3.2.4 with UI dashboard and coverage
- **Web Scraping**: Cheerio for metadata extraction
- **Configuration**: dotenv for environment management
- **Monday.com Integration**: Official @mondaydotcomorg/api SDK

## Monday.com Integration Details

### Board Structure

The system expects these Monday.com board columns:

- `Podcast link` (Text) - Generated podcast URLs
- `Type` (Status) - Content type classification
- `🔗` (Link) - Source URLs for processing
- `Podcast fitness` (Formula) - Numerical fitness score for ranking
- `Metadata` (LongText) - Extracted article metadata JSON
- `Non-podcastable` (Checkbox) - Manual exclusion flag
- `NotebookLM with generated audio` (Link) - Existing NotebookLM URLs for reuse

### Candidate Selection Process

1. **Filtering**: Items with `podcastFitness > 0` and no existing podcast link
2. **Prioritization**: Sorts by fitness score (descending) for optimal candidates
3. **Audio-Ready Processing**: Prioritizes items with existing NotebookLM audio links
4. **Rate Limiting**: Respects NotebookLM daily limits (typically 3 new generations)
5. **Batch Updates**: Updates board with generated podcast URLs

### Metadata Extraction

- **2-Phase Processing**: First extracts metadata, then processes for podcasting
- **Content Analysis**: Calculates code percentage, text length, video detection
- **Batch Processing**: Handles 10 URLs at a time with rate limiting
- **Smart Classification**: Automatically flags non-podcastable content

## Testing

Comprehensive test suite using Vitest:

- **Service Testing**: All core services have dedicated test suites
- **Configuration Testing**: Monday.com setup validation
- **Content Analysis Testing**: Metadata extraction and scoring

Key test files:

- `src/services/*.test.ts` - Service-specific tests
- `src/monday/*.test.ts` - Monday.com integration tests
- `src/utils.test.ts` - Core utility functions

## Code Patterns & Architecture

### Functional Programming

- Pure functions with clear inputs/outputs
- Immutable data structures where possible
- Single Responsibility Principle throughout
- Comprehensive error handling with context

### Type Safety

- Zero `any` types - full TypeScript compliance
- Official Monday.com API types integration
- Template literal types for URL validation
- Proper error type definitions with custom error classes

### Error Handling

- Fail-fast approach with early validation
- Context-rich error messages for debugging
- Comprehensive logging with structured data

## Production Features

### Audio Quality Standards

- **MP3 format** directly from NotebookLM CLI
- **Consistent metadata** embedding for podcast platforms

### Reliability & Performance

- **Rate limiting protection** (15-second delays for API calls)
- **Batch processing** (10 URLs at a time for metadata)
- **Audio-ready optimization** (prioritizes existing NotebookLM content)
- **Generous timeouts** for NotebookLM generation (10-12 minutes)

### Monitoring & Debugging

- **Structured logging** throughout the pipeline
- **Progress tracking** for batch operations
- **Error reporting** with full context and stack traces
- **Performance metrics** for optimization

## Current Limitations

- **Daily Limits**: NotebookLM restricts podcast generations (typically 3 per day)
- **Authentication**: CLI uses browser-based OAuth via `./scripts/nlm login`
- **Browser Requirements**: Chrome needed for RedCircle upload
- **Network Sensitivity**: Captchas or rate limits may interrupt automation
- **CLI API Stability**: notebooklm-py uses undocumented APIs that may change

## Main Operations

### Monday.com Batch Processing (Default)

```bash
# Processes candidates from Monday board with intelligent prioritization
yarn generate-podcasts
```

This command:

1. Fetches candidates from Monday.com board
2. Prioritizes audio-ready items first
3. Processes remaining candidates up to daily limit
4. Updates board with generated podcast URLs
5. Provides comprehensive progress reporting

### Architecture Flow

1. **Board Analysis**: Fetches and filters Monday.com board items
2. **Candidate Prioritization**: Ranks by fitness score and audio-ready status
3. **Metadata Processing**: Extracts and analyzes content for each URL
4. **Podcast Generation**: Uses notebooklm-py CLI for audio creation
5. **Audio Download**: Downloads MP3 directly from NotebookLM
6. **Publishing**: Uploads to RedCircle and updates Monday.com board

## File Organization

```
src/
├── services/           # Content analysis, NotebookLM CLI service, metadata extraction
│   ├── notebookLMCliService.ts   # CLI wrapper for notebooklm-py
│   └── notebookLMAdapter.ts      # Adapter interface for NotebookLM operations
├── monday/            # Monday.com API integration layer
├── scripts/           # CLI entry points
├── utils/             # Shared utility functions
└── __tests__/         # Test configuration

scripts/               # Shell scripts for CLI setup
├── setup-nlm.sh       # Python environment setup script
└── nlm                # Wrapper for notebooklm-py CLI

Key orchestration files:
- mondayBatchOrchestrator.ts    # Main batch processing logic
- singleRunGeneration.ts        # Individual podcast generation
- scripts/generatePodcastForUrl.ts # CLI entry point
```

## Troubleshooting

### CLI Issues

- **Not installed**: Run `./scripts/setup-nlm.sh` to set up Python environment
- **Not authenticated**: Run `./scripts/nlm login` to authenticate with Google
- **Command not found**: Ensure `uv` is installed (`brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **Rate limited**: NotebookLM limits to ~3 new generations per day

### Browser Automation (RedCircle Upload)

- Update Playwright browsers: `npx playwright install chrome`
- Check for captchas or account restrictions
- Verify Chrome browser installation and version compatibility

### Monday.com Integration

- Validate API token has board read/write permissions
- Ensure board URL format matches expected pattern
- Confirm all required columns exist with correct types
- Check excluded group IDs configuration

This project demonstrates a production-ready automation pipeline with comprehensive error handling, intelligent prioritization, and robust monitoring capabilities for automated podcast generation at scale.

## Podcast Personalization

Custom podcast instructions are stored in `podcast-instructions.md` at project root.

For guidance on crafting effective instructions, see `prompts/podcast-instructions-guide.md`.
