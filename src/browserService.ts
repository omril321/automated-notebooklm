import { Browser, BrowserContext, chromium, LaunchOptions, BrowserContextOptions, Page } from "playwright";
import UserAgent from "user-agents";
import { error, info } from "./logger";
import * as path from "path";
import { getProjectRoot } from "./utils";

const DEFAULT_SLOW_MO_MS = 80;
const DOWNLOADS_DIR_NAME = "downloads";
const DEFAULT_LOCALE = "en-US";

/**
 * Browser Service - Browser initialization service for NotebookLM automation
 */
export type BrowserOptions = {
  headless?: boolean;
};

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
    slowMo: DEFAULT_SLOW_MO_MS,
    downloadsPath: path.join(getProjectRoot(), DOWNLOADS_DIR_NAME),
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
  const userAgentString = new UserAgent({ deviceCategory: "desktop" }).toString();
  info(`Using user agent: ${userAgentString}`);

  // Create context options
  const contextOptions: BrowserContextOptions = {
    userAgent: userAgentString,
    javaScriptEnabled: true,
    hasTouch: false,
    isMobile: false,
    locale: DEFAULT_LOCALE,
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

/**
 * Capture a debug screenshot with timestamp for troubleshooting automation failures
 * @param page - Playwright page instance
 * @param prefix - Prefix for the screenshot filename
 * @returns Promise that resolves to the screenshot path or null if failed
 */
export async function captureDebugScreenshot(page: Page, prefix: string): Promise<string | null> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const screenshotPath = `temp/${prefix}-error-${timestamp}.png`;

    await page.screenshot({ path: screenshotPath, fullPage: true });
    info(`Debug screenshot saved to: ${screenshotPath}`);

    return screenshotPath;
  } catch (screenshotError) {
    error(`Failed to capture debug screenshot: ${screenshotError}`);
    return null;
  }
}
