import { defineConfig, devices } from "@playwright/test";

const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutablePath
          ? { launchOptions: { executablePath: chromiumExecutablePath } }
          : {}),
      },
    },
    {
      name: "mobile-chromium",
      testMatch: ["**/word-games-input-focus.spec.ts", "**/letter-dodge-variant-flows.spec.ts"],
      grep: /focuses the answer after Play Again|keeps the replayed answer visible|keeps the answer visible and focused after replay in landscape|reduced mobile viewport|mobile Expert Survival replay|Fresh Answers stays keyboard and mobile accessible with enlarged text/,
      use: {
        ...devices["Pixel 7"],
        ...(chromiumExecutablePath
          ? { launchOptions: { executablePath: chromiumExecutablePath } }
          : {}),
      },
    },
    {
      name: "mobile-webkit",
      testMatch: ["**/word-games-input-focus.spec.ts", "**/letter-dodge-variant-flows.spec.ts"],
      grep: /focuses the answer after Play Again|keeps the replayed answer visible|keeps the answer visible and focused after replay in landscape|reduced mobile viewport|mobile Expert Survival replay|Fresh Answers stays keyboard and mobile accessible with enlarged text/,
      use: { ...devices["iPhone 13"] },
    },
  ],
});
