import { Browser, BrowserContext, chromium, LaunchOptions, BrowserContextOptions } from "playwright";
import UserAgent from "user-agents";
import * as path from "path";
import * as fs from "fs";
import { info, warning } from "./logger";

/**
 * Browser Service - Browser initialization service for NotebookLM automation
 */
export interface BrowserOptions {
  headless?: boolean;
  useAuth?: boolean;
}

// Default configuration
export const AUTH_FILE_PATH = path.join(__dirname, "auth.json");

/**
 * Initialize and launch a browser with anti-detection settings
 */
export async function initializeBrowser(options: BrowserOptions = {}): Promise<{
  browser: Browser;
  context: BrowserContext;
}> {
  const { headless = false, useAuth = false } = options;

  info("Initializing browser...");

  // Launch options with anti-detection settings
  const launchOptions: LaunchOptions = {
    headless,
    channel: "chrome", // Use installed Chrome browser
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-sandbox",
      "--start-maximized",
      "--disable-extensions",
      "--disable-popup-blocking",
      "--disable-notifications",
    ],
  };

  // Launch browser with arguments to bypass automation detection
  const browser = await chromium.launch(launchOptions);

  // Generate a realistic user agent
  const ua = new UserAgent({ deviceCategory: "desktop" }).toString();
  info(`Using user agent: ${ua}`);

  // Create context options
  const contextOptions: BrowserContextOptions = {
    userAgent: ua,
    viewport: { width: 1920, height: 1080 },
    javaScriptEnabled: true,
    hasTouch: false,
    isMobile: false,
    locale: "en-US",
  };

  // Add storage state if auth is required and file exists
  if (useAuth) {
    if (fs.existsSync(AUTH_FILE_PATH)) {
      info(`Using authentication from ${AUTH_FILE_PATH}`);
      contextOptions.storageState = AUTH_FILE_PATH;
    } else {
      warning(`Authentication file not found at ${AUTH_FILE_PATH}. Please run 'yarn auth' to authenticate.`);
      process.exit(1);
    }
  }

  // Create a new context with the user agent and a defined viewport
  const context = await browser.newContext(contextOptions);

  // Add script to override automation flags
  await addAntiDetectionScripts(context);

  return { browser, context };
}

/**
 * Add scripts to bypass automation detection
 */
async function addAntiDetectionScripts(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    // Override the properties that detect automation
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });

    // Override permission requests
    const originalQuery = window.navigator.permissions.query;
    // @ts-ignore - We need this ignore because we're modifying a browser API
    window.navigator.permissions.query = (parameters) => {
      if (parameters.name === "notifications") {
        return Promise.resolve({ state: "granted" });
      }
      return originalQuery(parameters);
    };

    // Empty plugins array
    // @ts-ignore - We need this ignore because we're modifying a browser API
    Object.defineProperty(navigator, "plugins", { get: () => [] });
  });
}
