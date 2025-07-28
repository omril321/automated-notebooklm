# σ₃: Technical Context

_v1.0 | Created: 24-07-2025 | Updated: 28-07-2025_
_Π: DEVELOPMENT | Ω: COMPLETED_

## 🛠️ Technology Stack

- 🖥️ **Language**: TypeScript (functional programming approach)
- 🧰 **Package Manager**: Yarn
- 🎭 **Browser Automation**: Playwright
- 📓 **Target Service**: Google Notebook LM
- 🎙️ **Upload Target**: RedCircle (placeholder implementation)
- 🔊 **Audio Processing**: fluent-ffmpeg (functional wrapper)
- 🔐 **Configuration**: dotenv (.env credentials)

## 🏗️ Final Architecture (v1.1)

### Core Pipeline

```
URL → generateAndUpload.ts → podcastGeneration.ts → NotebookLM → WAV
                          ↓
audioConversionService.ts → FFmpeg → MP3 → redCircleService.ts → Upload
```

### Service Breakdown

- **Core generation**: NotebookLM integration via podcastGeneration.ts
- **Download utilities**: Consolidated operations in downloadUtils.ts
- **Functional conversion**: Audio processing via audioConversionService.ts
- **Upload placeholder**: RedCircle service ready for implementation
- **Simple orchestration**: Main flow coordination via generateAndUpload.ts

## 📁 Architectural Principles

### ✅ Applied Successfully

- **Single Responsibility**: Each function has one clear purpose
- **Functional Programming**: Functions over classes throughout
- **Type Safety**: Proper TypeScript types, eliminated all `any` usage
- **Simple Error Handling**: Just throw errors, no complex wrapper types
- **Separation of Concerns**: Generation ≠ Conversion ≠ Upload
- **Modern Patterns**: Types over interfaces, destructuring, const assertions

### 🚫 Explicitly Avoided

- **Complex Error Wrappers**: No Result<T, E> types
- **Class-based Services**: Converted to pure functions
- **Temp File Management**: Files are desired output, not cleanup burden
- **URL-based Metadata**: Filename provides better episode titles
- **Deep Nesting**: Flat, readable function calls

## 🔧 Implementation Patterns

### Audio Conversion Approach

- Refactored from class-based to functional service
- Simple functions with clear contracts
- Direct error handling without complex wrappers

### Error Handling Philosophy

- Eliminated complex wrapper types
- Simple throws for transparent error handling
- Clear and direct error messaging

### Metadata Generation Strategy

- Uses WAV filename instead of URL for better episode titles
- Improves title quality over generic URL-based naming

## 🔐 Configuration Requirements

### Environment Variables

- **Required**: Google credentials for NotebookLM access
- **Optional**: RedCircle credentials for future upload implementation
- **Optional**: Temp directory configuration for FFmpeg

### System Dependencies

- **FFmpeg**: Required with libmp3lame codec for audio conversion
- **Node.js**: TypeScript runtime environment

## 📊 Quality Standards

### Audio Quality

- Highest standard bitrate (320k) for optimal sound quality
- CD-quality sample rate configuration
- Best quality encoding settings

### Code Quality Achievements

- ✅ **Zero `any` types**: Full TypeScript compliance
- ✅ **Function exports only**: No unused exports
- ✅ **Error transparency**: Clear error messaging
- ✅ **Type safety**: Proper generic usage and type inference
- ✅ **Readability**: Focused, single-responsibility functions

## 🚀 Recent Simplifications

### Download Consolidation (v1.1 → v1.2)

**Problem**: Download-related operations were scattered across multiple files with repeated logic for filename processing, path generation, and validation.

**Solution**: Created single `downloadUtils.ts` module consolidating all download operations into one location.

**Benefits**: Zero code repetition, simplified flows, better maintenance, cleaner imports.

### Major Refactoring (v1.0 → v1.1)

1. **podcastFlow.ts** → **generateAndUpload.ts** (simpler orchestration)
2. **Class-based audio service** → **Functional audio service**
3. **Complex error handling** → **Simple throws**
4. **URL metadata** → **Filename metadata**
5. **Temp file cleanup** → **Desired output files**

### Performance Improvements

- Eliminated unnecessary try-catch nesting
- Reduced function call complexity
- Cleaner memory management (no complex cleanup)
- Better TypeScript compilation (proper types)

## 🔮 Future Implementation Notes

### RedCircle Integration (Ready for Implementation)

```typescript
// Current placeholder is ready for real implementation
export async function uploadEpisode(metadata: EpisodeMetadata): Promise<void> {
  // Will use Playwright automation here
  // Metadata includes: title, description, filePath
}
```

### Potential Extensions

- Additional hosting services (Anchor, Spotify for Podcasters)
- Batch processing capabilities
- Custom metadata templates
- Quality/bitrate options in CLI

## 📋 Architecture Summary

**Simple, functional, type-safe podcast generation pipeline that:**

1. Generates podcasts from URLs via NotebookLM
2. Converts WAV to high-quality MP3 using FFmpeg
3. Provides placeholder for upload service implementation
4. Uses modern TypeScript functional programming patterns
5. Handles errors transparently without complex wrappers
