# Automated NotebookLM

A TypeScript automation tool using Playwright to generate document summaries with Google's NotebookLM.

## Prerequisites

- Node.js (v14 or higher)
- A Google account with access to NotebookLM
- Google Chrome browser installed on your system

## Installation

1. Clone the repository:

   ```bash
   git clone git@github.com:omril321/automated-notebooklm.git
   cd automated-notebooklm
   ```

2. Install dependencies:

   ```bash
   yarn install
   ```

3. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

## Usage

### Step 1: Authentication (One-time setup)

Run the authentication script to authenticate with your Google account. This will open a Chrome browser window where you need to log in manually. Once logged in, close the browser to save your authentication state.

```bash
yarn auth
```

This will:

1. Launch Chrome with anti-automation detection features
2. Navigate to NotebookLM
3. Wait for you to log in manually
4. Save your session state when you close the browser

The authentication process is designed to be as secure and unobtrusive as possible, using techniques that prevent Google from detecting automation.

### Step 2: Summarize content

To summarize content, use the `summarize` script with the `--input` parameter:

```bash
# For URLs
yarn summarize --input="https://example.com/article"

# For text
yarn summarize --input="This is the text I want to summarize."
```

The script will:

1. Launch Chrome using your saved session state
2. Navigate to NotebookLM
3. Pause for you to confirm the page loaded properly
4. Create a new notebook or use an existing one
5. Add your input as a source
6. Ask for a summary
7. Display the summary in the terminal

## How It Works

This tool uses several anti-automation techniques to ensure smooth operation with Google's security systems:

1. **Disabled Automation Flags**: Disables Chrome features that expose browser automation, making it appear as a regular user.

2. **Random User Agents**: Generates realistic user agent strings for each session to avoid detection patterns.

3. **Browser Fingerprint Modification**: Modifies browser fingerprinting data to appear as a standard Chrome installation.

4. **Manual Intervention Points**: Strategic pauses that allow you to handle any security challenges that might appear.

## Troubleshooting

### Authentication Issues

If you encounter issues with authentication:

1. Delete the `auth.json` file in the project directory
2. Run the `auth` script again and ensure you complete the login process
3. If you see any security warnings, handle them manually according to your comfort level

### Security Warnings

If you see security warnings:

1. Read the warning carefully and assess the risk based on your comfort level
2. You can proceed if you're comfortable with the security implications
3. If the warning persists, you may need to use a different Google account or try from a different network

## Notes

- Your session may expire after some time, requiring re-authentication
- This tool uses visible browser automation, which means you'll see Chrome while it's working
- The tool is designed to respect Google's security measures while still allowing automation

## Future Features

- Audio generation from summaries
- Support for batch processing multiple inputs
- Customizable prompt templates
