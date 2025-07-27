import { Browser, BrowserContext, chromium, LaunchOptions, BrowserContextOptions, Page } from "playwright";
import UserAgent from "user-agents";
import { info } from "./logger";
import * as path from "path";
import { getProjectRoot } from "./utils";

/**
 * Browser Service - Browser initialization service for NotebookLM automation
 */
export interface BrowserOptions {
  headless?: boolean;
}

/**
 * Initialize and launch a browser with anti-detection settings
 */
export async function initializeBrowser(options: BrowserOptions = {}): Promise<{
  browser: Browser;
  context: BrowserContext;
}> {
  const { headless = false } = options;

  info("Initializing browser...");

  // Launch options with anti-detection settings
  const launchOptions: LaunchOptions = {
    headless,
    channel: "chrome", // Use installed Chrome browser
    slowMo: 80,
    downloadsPath: path.join(getProjectRoot(), "downloads"),
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
    javaScriptEnabled: true,
    hasTouch: false,
    isMobile: false,
    locale: "en-US",
  };

  const context = await browser.newContext(contextOptions);

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
