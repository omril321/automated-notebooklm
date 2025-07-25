# σ₃: Technical Context

_v1.0 | Created: 24-07-2025 | Updated: 25-07-2025_
_Π: INITIALIZING | Ω: RESEARCH_

## 🛠️ Technology Stack

- 🖥️ **Language**: TypeScript
- 🧰 **Package Manager**: Yarn
- 🎭 **Browser Automation**: Playwright
- 📓 **Target Service**: Google Notebook LM
- 🔄 **Integration Target**: monday.com
- 🔐 **Configuration**: dotenv

## 🏗️ Architecture Components

- **configService** - Environment configuration service
  - Loads environment variables for authentication
  - Validates required configuration
- **browserService** - Browser initialization service
  - Implements direct Google authentication
  - Removes dependency on auth file storage
- **cliService** - Command-line interface interaction service
  - Handles user input/output operations
- **logger** - Console logging service
  - Provides different log types
- **summarize** - Document summarization module
  - Uses direct Google authentication
  - Handles source addition and processing

## 🔌 Dependencies

- TypeScript for type-safe development
- Playwright for browser automation
- user-agents for realistic user agent generation
- chalk for terminal coloring
- yargs for command-line argument parsing
- dotenv for environment variable management

## 🛡️ Security Mechanisms

- Environment-based authentication
- Direct Google authentication
- Anti-bot detection mechanisms

## 🧠 Architecture Principles

- Functional programming approach
- Strong type safety with TypeScript
- Single-responsibility functions
- Environment-based configuration
- Separation of concerns
