# σ₃: Technical Context

_v1.0 | Created: 24-07-2025 | Updated: 24-07-2025_
_Π: INITIALIZING | Ω: RESEARCH_

## 🛠️ Technology Stack

- 🖥️ **Language**: TypeScript
- 🧰 **Package Manager**: Yarn
- 🎭 **Browser Automation**: Playwright
- 📓 **Target Service**: Google Notebook LM
- 🔄 **Integration Target**: monday.com

## 🏗️ Architecture Components

- **browserService** - Browser initialization service with anti-detection features
  - Uses a simplified authentication approach with a default auth file path
  - Exports centralized AUTH_FILE_PATH constant for use across the application
  - Implements strong TypeScript typing with no use of `any`
- **cliService** - Command-line interface interaction service
  - Handles user input/output operations
  - Focused on user input collection only
  - Follows single responsibility principle
- **logger** - Console logging service
  - Provides different log types (info, success, warning, error)
  - Implements functional programming approach with individual exported functions
  - Improves error handling with formatted error messages
- **login** - Authentication module using browserService and cliService
  - Creates and stores authentication data at the centralized path
  - Refactored into small, focused functions for better modularity
  - Implements strong typing with Playwright types
- **summarize** - Document summarization using browserService and NotebookLM
  - Uses automatic page load detection
  - Reads authentication from the centralized path
  - Uses logger for consistent output formatting
  - Implements strong typing with no `any` types

## 🔌 Dependencies

Based on package.json:

- TypeScript for type-safe development
- Playwright for browser automation
- user-agents for realistic user agent generation
- chalk for terminal coloring
- yargs for command-line argument parsing

## 🛡️ Security Mechanisms

- Authentication system via login.ts
- Token-based security
- Anti-bot detection mechanisms via browserService

## 🧪 Testing Approach

- To be determined

## 📦 Deployment Strategy

- To be determined

## 🧠 Architecture Principles

- Functional programming approach for services
- Strong type safety with TypeScript
- Small, single-responsibility functions
- Clear module boundaries with minimal API surface
- Centralized configuration
- Separation of concerns (UI input vs logging)
