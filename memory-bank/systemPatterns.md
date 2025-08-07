# σ₂: System Patterns

_v1.1 | Created: 24-07-2025 | Updated: 07-08-2025_
_Π: DEVELOPMENT | Ω: REVIEW_

## 🏛️ Architecture Overview

A TypeScript-based automation system for Google's Notebook LM with Playwright browser control and monday.com integration.

## 🧩 Design Patterns

- **Browser Automation Pattern**: Playwright-based control of Notebook LM
- **Authentication Flow**: Token-based authentication system
- **Integration Pipeline**: monday.com → Notebook LM → Podcast Generation

## 🔄 Component Interactions

- Authentication Service → Browser Automation
- Browser Automation → Notebook LM
- monday.com Integration → Workflow Automation
- Notebook LM Output → Podcast Generation

## 🏗️ Key Architecture Decisions

- TypeScript for type safety and maintainability
- Playwright for browser automation
- Modular design for separation of concerns
- Integration-focused approach for monday.com connectivity
