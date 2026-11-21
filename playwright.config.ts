import { defineConfig, devices } from "@playwright/test";
import { DARK_CLIP, FLASH_CLIP } from "./e2e/fixtures.ts";

// Always Playwright's bundled Chromium (no `channel: 'chrome'`): managed desktop Chrome can
// block DevTools automation by policy, which looks like the page freezing after a few seconds.
const fakeCamera = (clip: string) => ({
  ...devices["Pixel 7"],
  permissions: ["camera"],
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${clip}`,
    ],
  },
});

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  reporter: "list",
  use: { baseURL: "http://localhost:4173/morse/" },
  webServer: {
    command: "npm run build && node scripts/serve.js 4173 /morse/",
    url: "http://localhost:4173/morse/",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "flashing-camera",
      testIgnore: "**/fallback.e2e.ts",
      use: fakeCamera(FLASH_CLIP),
    },
    {
      name: "dark-camera",
      testMatch: "**/fallback.e2e.ts",
      use: fakeCamera(DARK_CLIP),
    },
  ],
});
