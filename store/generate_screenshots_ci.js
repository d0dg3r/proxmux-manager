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

  // 1. Capture Dark Mode
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(mockPath);
  await page.waitForTimeout(1000); // Wait for CSS to settle
  await page.screenshot({ path: path.join(storeDir, 'screenshot_dark.png') });
  console.log('Saved screenshot_dark.png (Dark Mode)');

  // 2. Capture Light Mode
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload(); // Ensure media queries re-evaluate
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(storeDir, 'screenshot_light.png') });
  console.log('Saved screenshot_light.png (Light Mode)');

  await browser.close();
})();
