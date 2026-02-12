import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: "npm run serve",
    url: "http://localhost:3939",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
