# Automated NotebookLM

Automate Google NotebookLM for document summarization using Playwright.

## Features

- Automate login to Google NotebookLM
- Create summaries of documents from URLs or text
- Automatically create or select notebooks
- Handle source addition (URL or text)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/omril321/automated-notebooklm.git
cd automated-notebooklm
```

2. Install dependencies:

```bash
yarn install
```

3. Create a `.env` file with your Google credentials:

```bash
cp .env.example .env
```

4. Edit the `.env` file with your Google email and password:

```
GOOGLE_EMAIL=your_email@gmail.com
GOOGLE_PASSWORD=your_password
```

## Usage

### Summarize a URL:

```bash
yarn summarize --input "https://example.com/article"
```

### Summarize text:

```bash
yarn summarize --input "This is a long text that I want to summarize..."
```

## Security Notes

- Your Google credentials are stored only in your local `.env` file
- The `.env` file is ignored by git and will not be committed
- Consider using an app password for better security if your account has 2FA enabled

## Requirements

- Google account (without 2FA for now)
- Chrome browser installed

## License

ISC
