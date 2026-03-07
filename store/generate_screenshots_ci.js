const playwright = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 550, height: 600 },
    deviceScaleFactor: 2, // High DPI for store quality
  });
  const page = await context.newPage();
  
  const mockPath = 'file://' + path.resolve(__dirname, 'mock/mock.html');
  const storeDir = path.resolve(__dirname);

  // 1. Capture Dark Mode (Default)
  await page.goto(mockPath);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(storeDir, 'screenshot_dark.png') });
  console.log('Saved screenshot_dark.png');

  // 2. Capture Light Mode
  // Inject style to override :root vars with light palette
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --bg-color: #ffffff !important;
        --card-bg: #f6f8fa !important;
        --text-primary: #24292f !important;
        --text-secondary: #57606a !important;
        --accent: #0969da !important;
        --success: #1a7f37 !important;
        --error: #cf222e !important;
        --border: #d0d7de !important;
        --hover-bg: #eaeef2 !important;
        --tag-bg: #eff2f5 !important;
      }
      body { background-color: var(--bg-color) !important; color: var(--text-primary) !important; }
      header { background-color: var(--card-bg) !important; border-bottom-color: var(--border) !important; }
      h1 { background: none !important; -webkit-text-fill-color: var(--accent) !important; color: var(--accent) !important; }
      .resource-item { border-bottom-color: var(--border) !important; }
      .tag { background-color: var(--tag-bg) !important; border-color: var(--border) !important; }
    `;
    document.head.appendChild(style);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(storeDir, 'screenshot_light.png') });
  console.log('Saved screenshot_light.png');

  await browser.close();
})();
