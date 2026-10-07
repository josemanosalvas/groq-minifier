import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test/browser",
  timeout: 30_000,
  use: { baseURL: "http://localhost:4173" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "node scripts/serve-consumer.mjs",
    url: "http://localhost:4173/raw.html",
    reuseExistingServer: !process.env.CI,
  },
});
