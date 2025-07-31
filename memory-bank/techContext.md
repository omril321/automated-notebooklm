# σ₃: Technical Context

_v1.5 | Created: 24-07-2025 | Updated: 2025-07-31_
_Π: DEVELOPMENT | Ω: EXECUTE_

## 🛠️ Technology Stack

- 🖥️ **Language**: TypeScript (functional programming approach)
- 🧰 **Package Manager**: Yarn
- 🎭 **Browser Automation**: Playwright
- 📓 **Target Service**: Google Notebook LM
- 🎙️ **Upload Target**: RedCircle (placeholder implementation)
- 🔊 **Audio Processing**: fluent-ffmpeg (functional wrapper)
- 🔐 **Configuration**: dotenv (.env credentials)
- 🧪 **Testing Framework**: Vitest 3.2.4 (Node.js v24 - COMPLETED ✅)

## 🚀 Upcoming Technology Requirements (Next Development Cycle)

### Phase 1: Red Circle Automation ✅ COMPLETED

- **Browser Automation**: Implemented using existing browserService integration
- **Authentication Flow**: Complete login workflow with environment variables
- **File Upload**: MP3 episode upload with title and description metadata
- **Environment**: RED_CIRCLE_USER, RED_CIRCLE_PASSWORD, PUBLISHED_PODCAST_NAME vars
- **Modular Architecture**: Refactored into focused, single-responsibility functions
- **Direct File Upload**: Added new feature to upload existing MP3 files without generation
- **CLI Enhancement**: Added file upload options with title and description parameters
- **Error Handling**: Comprehensive error handling with debug screenshots

### Phase 2: Podcast Customization

- **Configuration System**: Runtime customization options
- **Metadata Enhancement**: Extended episode information handling
- **Template System**: Configurable prompt management

### Phase 3: LangChain Integration

- **LangChain Core**: Framework for flexible workflow orchestration
- **LangChain Tools**: Integration with existing services
- **Chain Architecture**: Modular pipeline design

### Phase 4: Monday.com Integration

- **Monday.com API**: Board and item management
- **Authentication**: OAuth or API key management
- **Batch Processing**: Bulk URL handling capabilities

### Phase 5: Content Enhancement

- **Cheerio**: Web scraping for metadata extraction
- **AI Integration**: Content enhancement service (TBD)
- **URL Analysis**: Automated content detection and categorization

## 🧪 Testing Technology Stack (IMPLEMENTED)

### Core Testing Dependencies ✅ ACTIVE

- **Vitest 3.2.4**: Modern testing framework with TypeScript support
- **@vitest/ui**: UI dashboard for test visualization
- **@vitest/coverage-v8**: Coverage reporting with V8 provider
- **Node.js v24**: Upgraded for Vitest compatibility

### Testing Architecture Implementation (REAL FFMPEG)

- **Target**: `src/audioConversionService.ts` wav-to-mp3 conversion functions
- **Approach**: Real FFmpeg integration testing (NO MOCKING)
- **Strategy**: Test actual audio conversion with system FFmpeg
- **Validation**: Real WAV to MP3 file processing and output verification

### Audio Testing Technical Requirements (CURRENT)

- **System FFmpeg**: Requires actual FFmpeg installation with libmp3lame
- **Real Audio Processing**: Uses user-provided WAV files for realistic testing
- **File System Integration**: Tests actual file creation, processing, and validation
- **Error Integration**: Tests real FFmpeg errors and system integration scenarios

### Test File Organization (USER PREFERENCES - IMPLEMENTED)

- **Co-located with source**: `src/__tests__/audioConversionService.test.ts`
- **API preservation**: Tests existing exported functions without modifications
- **Real fixture integration**: User-provided audio files in `src/__tests__/fixtures/`
- **Utility co-location**: Test helpers in `src/__tests__/utils/test-helpers.ts`

## 🏗️ Current Architecture (v1.2 + Testing)

### Core Pipeline with Testing Layer

```
URL → generateAndUpload.ts → podcastGeneration.ts → NotebookLM → WAV
                          ↓
audioConversionService.ts → FFmpeg → MP3 → redCircleService.ts → Upload
                          ↑                     ↑
                    [Vitest Testing Layer]      |
                    Real FFmpeg Integration    MP3 File → uploadExistingFile()
```

### Service Breakdown (Updated)

- **Core generation**: NotebookLM integration via podcastGeneration.ts
- **Download utilities**: Consolidated operations in downloadUtils.ts
- **Functional conversion**: Audio processing via audioConversionService.ts (TESTED)
- **Upload placeholder**: RedCircle service ready for implementation
- **Simple orchestration**: Main flow coordination via generateAndUpload.ts
- **Testing layer**: Real FFmpeg integration testing via Vitest

## 🔧 Current Testing Implementation Patterns

### Vitest Configuration (ACTIVE)

- **Environment**: Node.js for real FFmpeg integration
- **TypeScript**: Out-of-the-box support with proper type safety
- **Coverage**: V8 provider for accurate coverage reporting
- **Co-located structure**: Tests next to source code as requested

### Real FFmpeg Integration Approach (IMPLEMENTED)

- **System Integration**: Tests actual FFmpeg installation and codec availability
- **Real Audio Processing**: Uses actual WAV to MP3 conversion with user fixtures
- **File System Integration**: Tests real file operations and output validation
- **Error Testing**: Real FFmpeg errors and system integration edge cases

### API Testing Approach (CRITICAL - IMPLEMENTED)

- **Black Box Testing**: Test `convertFromDownload()` through public API only
- **No Internal Access**: Tests only exported functions with real operations
- **Contract Validation**: Ensures input/output contracts work with real FFmpeg
- **API Preservation**: Zero changes to existing exported functions

### Current Test Implementation Quality (ACTIVE SESSION)

- **Enhanced Mocking**: Proper `Partial<Mocked<Download>>` with `vi.fn()` patterns
- **Type Safety**: Eliminated `as any` usage with proper Download interface
- **Exact Assertions**: Specific file size validation (51037484 → 11009292)
- **Service Simplification**: Removed title metadata complexity for cleaner testing
- **Test Organization**: Streamlined test cases, removed redundancy

## 📁 Architectural Principles (MAINTAINED + ENHANCED)

### ✅ Successfully Applied

- **Single Responsibility**: Each function has one clear purpose
- **Functional Programming**: Functions over classes throughout
- **Type Safety**: Proper TypeScript types, eliminated all `any` usage
- **Simple Error Handling**: Direct throws, no complex wrapper types
- **Separation of Concerns**: Generation ≠ Conversion ≠ Upload ≠ Testing
- **Modern Patterns**: Types over interfaces, destructuring, const assertions
- **Testing Integration**: Real system testing without API modifications

### 🧪 Testing Principles (NEW - IMPLEMENTED)

- **Real Integration**: Test actual FFmpeg usage, not mocked behavior
- **API Preservation**: Test existing exports without modifications
- **Co-located Organization**: Tests next to source for maintainability
- **Type Safety**: Proper mock typing and test assertions
- **User-Centric**: Use real audio fixtures provided by user

## 🔐 Configuration Requirements (UPDATED)

### Environment Variables

- **Required**: Google credentials for NotebookLM access
- **Optional**: RedCircle credentials for future upload implementation
- **Optional**: Temp directory configuration for FFmpeg

### System Dependencies (TESTING ENHANCED)

- **FFmpeg**: Required with libmp3lame codec for audio conversion
- **Node.js v24**: Upgraded for Vitest compatibility and modern testing
- **System FFmpeg**: Must be available for integration testing

## 📊 Quality Standards (ENHANCED)

### Audio Quality (MAINTAINED)

- Highest standard bitrate (320k) for optimal sound quality
- CD-quality sample rate configuration
- Best quality encoding settings

### Code Quality + Testing Achievements (CURRENT)

- ✅ **Zero `any` types**: Full TypeScript compliance in source and tests
- ✅ **Function exports only**: No unused exports, preserved API
- ✅ **Error transparency**: Clear error messaging in source and test validation
- ✅ **Type safety**: Proper generic usage and test mock typing
- ✅ **Real Integration**: Tests validate actual FFmpeg behavior
- ✅ **Testing Quality**: Co-located, type-safe, real integration testing

## 🔮 Testing Architecture Benefits (REALIZED)

### Development Benefits (ACTIVE)

- **Real Integration Confidence**: Tests validate actual FFmpeg usage
- **System Validation**: Ensures FFmpeg is properly integrated
- **Actual Conversion Testing**: Validates real audio processing pipeline
- **Type Safety**: Proper mock patterns prevent runtime errors

### Production Benefits (DELIVERED)

- **System Reliability**: Validated real FFmpeg integration
- **Performance Testing**: Real audio conversion performance validation
- **Error Handling**: Tested real FFmpeg error scenarios
- **Maintenance**: Co-located tests improve code maintainability

## 📋 Current Architecture Summary

**Simple, functional, type-safe podcast generation and upload pipeline with comprehensive testing that:**

1. Generates podcasts from URLs via NotebookLM
2. Converts WAV to high-quality MP3 using FFmpeg (TESTED with real integration)
3. Uploads to RedCircle with browser automation using modular functions
4. Supports direct MP3 file upload without generation process
5. Uses modern TypeScript functional programming patterns
6. Handles errors transparently with debug screenshots
7. **Tests real FFmpeg integration without API modifications**
8. **Maintains co-located test structure for maintainability**
9. **Follows Single Responsibility Principle with focused functions**
