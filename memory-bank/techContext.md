# σ₃: Technical Context

_v1.12 | Created: 24-07-2025 | Updated: 2025-08-06_
_Π: DEVELOPMENT | Ω: REVIEW_

## 🛠️ Technology Stack

- 🖥️ **Language**: TypeScript (functional programming approach)
- 🧰 **Package Manager**: Yarn
- 🎭 **Browser Automation**: Playwright
- 📓 **Target Service**: Google Notebook LM
- 🎙️ **Upload Target**: RedCircle (placeholder implementation)
- 🔊 **Audio Processing**: fluent-ffmpeg (functional wrapper)
- 🔐 **Configuration**: dotenv (.env credentials)
- 🧪 **Testing Framework**: Vitest 3.2.4 (Node.js v24 - COMPLETED ✅)
- 📋 **Monday.com Integration**: @mondaydotcomorg/api v11.0.0 (Foundation Complete ✅)

## 🚀 Development Phase Status

### Phase 5: Monday Board Integration with Podcast Generation ✅ PRODUCTION EXCELLENCE

**Production-Grade Implementation Delivered:**

- **Smart Filtering System**: `fittingForPodcast` column for intelligent article pre-filtering
- **Advanced Type Safety**: Template literal URLs (`\`${"http"}${string}\``) + `SourceBoardItem` interface
- **Formula Column Support**: Proper handling of Monday formula columns with `display_value` parsing
- **Enhanced Data Parsing**: `parseBoardItems()` and `parseSourceUrl()` with type guards
- **Production Scalability**: 500-item limit detection with pagination readiness
- **Bulletproof Error Handling**: Safe JSON parsing and comprehensive validation
- **Business Logic Integration**: Intelligent filtering with formula-based boolean logic

**Production Features:**

```typescript
// Advanced Type Safety with Template Literals
export type ArticleCandidate = {
  readonly sourceUrl: `${"http"}${string}`; // Only HTTP URLs allowed
};

// Smart Filtering with Business Logic
const filterCandidates = (items: SourceBoardItem[]): ArticleCandidate[] => {
  return items.filter((item): item is SourceBoardItem =>
    Boolean(item.fittingForPodcast && item.sourceUrlValue?.url?.startsWith("http"))
  );
};

// Formula Column Support
fittingForPodcast: rawFittingForPodcast?.display_value?.toLowerCase() === "true";
```

**Usage Pattern:**

```bash
# Process candidates from Monday board (with smart filtering)
yarn generatePodcastForUrl --monday-mode

# Traditional single URL processing (unchanged)
yarn generatePodcastForUrl --url "https://example.com/article"
```

### Phase 4: Monday.com Integration Foundation ✅ 100% COMPLETE

**Production-Ready Foundation Delivered:**

- **SDK Integration**: @mondaydotcomorg/api with proper GraphQL TypeScript patterns
- **Authentication**: Personal API token via MONDAY_API_TOKEN environment variable
- **Board Configuration**: URL-based access with MONDAY_BOARD_URL (supports views/filters)
- **Type Safety**: Official Monday.com API types (Board, Column, ColumnValue) throughout
- **Error Handling**: Clean 3-error system (INVALID_CONFIG, BOARD_ACCESS_ERROR, API_ERROR)
- **Configuration**: Consolidated column definitions with title and type in single location
- **Validation**: Comprehensive board structure validation with early failure detection
- **Testing**: 10/10 tests passing for configuration service with it.each patterns

**Foundation Services Architecture:**

```typescript
// Consolidated Configuration (Single Source of Truth)
const REQUIRED_COLUMNS = {
  podcastLink: { title: "Podcast link", type: "url" },
  type: { title: "Type", type: "status" },
  sourceUrl: { title: "🔗", type: "url" },
} as const;

// Functional Service Pattern
export const createConfigFromEnvironment = (): MondayConfig
export const getMondayApiClient = (): ApiClient
export const validateBoardAccess = async (boardId: string): Promise<void>
```

**Integration Pattern Established:**

- **Step 1**: Board access validation and configuration loading
- **Step 2**: Filter candidates (Type=Article AND empty Podcast link)
- **Step 3**: Update board with generated podcast URLs

**Ready for Service Layer**: Foundation provides all infrastructure for core services implementation

### Phase 1: Red Circle Automation ✅ COMPLETED

- **Browser Automation**: Implemented using existing browserService integration
- **Authentication Flow**: Complete login workflow with environment variables
- **File Upload**: MP3 episode upload with title and description metadata
- **Environment**: RED_CIRCLE_USER, RED_CIRCLE_PASSWORD, PUBLISHED_PODCAST_NAME vars
- **Modular Architecture**: Refactored into focused, single-responsibility functions
- **Direct File Upload**: Added new feature to upload existing MP3 files without generation
- **CLI Enhancement**: Added file upload options with title and description parameters
- **Error Handling**: Comprehensive error handling with debug screenshots

### Phase 2: Podcast Customization (Future)

- **Configuration System**: Runtime customization options
- **Metadata Enhancement**: Extended episode information handling
- **Template System**: Configurable prompt management

### Phase 3: LangChain Integration (Future)

- **LangChain Core**: Framework for flexible workflow orchestration
- **LangChain Tools**: Integration with existing services
- **Chain Architecture**: Modular pipeline design

### Phase 5: Content Enhancement (Future)

- **Cheerio**: Web scraping for metadata extraction
- **AI Integration**: Content enhancement service (TBD)
- **URL Analysis**: Automated content detection and categorization

## 🧪 Testing Technology Stack (IMPLEMENTED)

### Core Testing Dependencies ✅ ACTIVE

- **Vitest 3.2.4**: Modern testing framework with TypeScript support
- **@vitest/ui**: UI dashboard for test visualization
- **@vitest/coverage-v8**: Coverage reporting with V8 provider
- **Node.js v24**: Upgraded for Vitest compatibility

### Monday.com Integration Testing (CURRENT)

- **Configuration Service Testing**: 10 comprehensive tests using it.each patterns
- **Environment Variable Validation**: Complete coverage of config scenarios
- **Error Handling Testing**: All 3 error types tested with proper assertions
- **URL Parsing Testing**: Board URL validation with views/filters support
- **Mock Data Integration**: Proper Monday.com enums and type structures

## 🏗️ Current Architecture (v1.3 + Monday.com Foundation)

### Complete Pipeline with Monday.com Integration Foundation

```
Monday.com Board → monday/config.ts → monday/api-client.ts → monday/board-validator.ts
                                    ↓
URL → generateAndUpload.ts → podcastGeneration.ts → NotebookLM → WAV
                          ↓
audioConversionService.ts → FFmpeg → MP3 → redCircleService.ts → Upload
                          ↑                     ↑
                    [Vitest Testing Layer]      |
                    Real FFmpeg Integration    MP3 File → uploadExistingFile()
```

### Monday.com Integration Foundation (NEW - COMPLETE)

```
src/monday/
├── index.ts              # Module exports
├── types.ts              # Official Monday.com API types + app-specific types
├── config.ts             # Environment configuration + consolidated column definitions
├── api-client.ts         # Singleton API client with token management
├── board-validator.ts    # Board access and structure validation
├── errors.ts             # 3-error system with proper TypeScript types
└── config.test.ts        # Comprehensive test coverage (10/10 tests)
```

### Service Breakdown (Updated with Monday.com)

- **Monday.com foundation**: Complete configuration, validation, and API client services
- **Core generation**: NotebookLM integration via podcastGeneration.ts
- **Download utilities**: Consolidated operations in downloadUtils.ts
- **Functional conversion**: Audio processing via audioConversionService.ts (TESTED)
- **Upload service**: RedCircle automation with browser automation
- **Simple orchestration**: Main flow coordination via generateAndUpload.ts
- **Testing layer**: Real FFmpeg integration testing via Vitest

## 🔧 Monday.com Foundation Implementation Patterns (COMPLETE)

### Configuration Management

- **Environment Variables**: MONDAY_API_TOKEN, MONDAY_BOARD_URL validation
- **URL Parsing**: Supports board views and filters (e.g., /boards/123/views/456)
- **Column Configuration**: Consolidated REQUIRED_COLUMNS with title + type
- **Early Validation**: Fail fast on configuration errors with clear messaging

### API Integration Approach

- **Official Types**: Board, Column, ColumnValue from @mondaydotcomorg/api
- **GraphQL Typing**: Proper generic typing with ApiClient.request<T>()
- **Singleton Pattern**: Single API client instance with token management
- **Error Propagation**: Clean error handling without complex wrappers

### Board Validation Strategy

- **Access Validation**: Verify board existence and user permissions
- **Column Structure**: Validate required columns exist with correct types
- **Type Safety**: Proper GraphQL response typing with BoardQueryResponse
- **Early Detection**: Board structure issues caught at startup

### Testing Implementation Quality

- **Comprehensive Coverage**: 10 tests covering all configuration scenarios
- **DRY Principles**: Helper functions eliminate 80% code duplication
- **Proper Mocking**: Environment variable testing with beforeEach/afterEach
- **Type Safety**: Proper test assertions and mock data structures

## 📁 Architectural Principles (MAINTAINED + ENHANCED)

### ✅ Successfully Applied

- **Single Responsibility**: Each function has one clear purpose
- **Functional Programming**: Functions over classes throughout
- **Type Safety**: Official Monday.com API types, eliminated all `any` usage
- **Simple Error Handling**: Direct throws, no complex wrapper types
- **Separation of Concerns**: Configuration ≠ Validation ≠ API Client ≠ Error Handling
- **Modern Patterns**: Types over interfaces, destructuring, const assertions
- **Testing Integration**: Real system testing without API modifications
- **Consolidated Configuration**: Single source of truth for column definitions

### 🧪 Testing Principles (IMPLEMENTED)

- **Real Integration**: Test actual FFmpeg usage, not mocked behavior
- **API Preservation**: Test existing exports without modifications
- **Co-located Organization**: Tests next to source for maintainability
- **Type Safety**: Proper mock typing and test assertions
- **User-Centric**: Use real audio fixtures provided by user
- **Comprehensive Coverage**: Configuration service fully tested

### 📋 Monday.com Integration Principles (NEW - COMPLETE)

- **Official API Types**: Use @mondaydotcomorg/api types, avoid custom types
- **Early Validation**: Validate board structure on startup, fail fast
- **Consolidated Configuration**: Single source of truth for column definitions
- **Clean Error Handling**: 3-error system with proper TypeScript types
- **Functional Patterns**: Pure functions with clear inputs/outputs
- **Environment-Based**: Configuration from environment variables only

## 🔐 Configuration Requirements (COMPLETE)

### Environment Variables (Updated)

- **Required**: Google credentials for NotebookLM access
- **Required**: MONDAY_API_TOKEN for Monday.com board access
- **Required**: MONDAY_BOARD_URL for board configuration (supports views/filters)
- **Optional**: RedCircle credentials for upload functionality
- **Optional**: Temp directory configuration for FFmpeg

### System Dependencies (Enhanced)

- **FFmpeg**: Required with libmp3lame codec for audio conversion
- **Node.js v24**: Required for Vitest compatibility and modern testing
- **Monday.com API Access**: Personal API token with board read/write permissions

## 📊 Quality Standards (ENHANCED)

### Audio Quality (MAINTAINED)

- Highest standard bitrate (320k) for optimal sound quality
- CD-quality sample rate configuration
- Best quality encoding settings

### Code Quality + Monday.com Foundation (CURRENT)

- ✅ **Zero `any` types**: Full TypeScript compliance in all services
- ✅ **Official API Types**: Monday.com types throughout integration layer
- ✅ **Function exports only**: No unused exports, clean API surface
- ✅ **Error transparency**: Clear error messaging with 3-error system
- ✅ **Type safety**: Proper generic usage and official type integration
- ✅ **Testing Quality**: Co-located, comprehensive configuration testing
- ✅ **Consolidated Configuration**: Single source of truth for column definitions
- ✅ **Clean Architecture**: Single Responsibility Principle applied consistently

## 🔮 Monday.com Foundation Benefits (REALIZED)

### Development Benefits (DELIVERED)

- **Type Safety Confidence**: Official Monday.com API types prevent runtime errors
- **Early Error Detection**: Board validation catches issues at startup
- **Maintainable Configuration**: Consolidated column definitions in one location
- **Comprehensive Testing**: Full configuration service test coverage
- **Clean Error Handling**: 3-error system simplifies error management

### Production Benefits (READY)

- **Robust Configuration**: Environment-based setup with validation
- **API Reliability**: Official SDK with proper error handling
- **Board Structure Validation**: Early detection of configuration issues
- **Type Safety**: Runtime type safety with official Monday.com types
- **Performance**: Efficient GraphQL queries with proper typing

## 📋 Current Architecture Summary

**Complete, production-ready podcast generation pipeline with Monday.com integration foundation:**

1. **Monday.com Board Integration**: Complete foundation for board access, validation, and configuration
2. Generates podcasts from URLs via NotebookLM
3. Converts WAV to high-quality MP3 using FFmpeg (TESTED with real integration)
4. Uploads to RedCircle with browser automation using modular functions
5. Supports direct MP3 file upload without generation process
6. Uses modern TypeScript functional programming patterns with official API types
7. Handles errors transparently with consolidated error system
8. **Tests Monday.com configuration service comprehensively (10/10 tests)**
9. **Maintains consolidated configuration for all column definitions**
10. **Follows Single Responsibility Principle with clean functional architecture**

**Ready for Core Services**: Foundation complete - next phase can implement item filtering, updating, and orchestration services.
